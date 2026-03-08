import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Transaction, CategorizationRule, Budget, Goal, TransactionType, AISettings } from "../types";

// Helper to retrieve API Key
const getApiKey = (settings?: AISettings): string | null => {
  if (settings?.provider === 'gemini' && settings.geminiApiKey) {
    return settings.geminiApiKey;
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0) {
    return process.env.GEMINI_API_KEY;
  }
  return null;
};

const getAI = (settings?: AISettings) => {
  const apiKey = getApiKey(settings);
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    throw new Error("Gemini API Key is not configured.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry<T>(
  apiCall: () => Promise<T>,
  retries = 3,
  initialDelay = 2000
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    const errorCode = error?.status || error?.error?.code;
    const errorMessage = error?.message || error?.error?.message || '';
    
    const isRateLimit = errorCode === 429 || errorCode === 503 || errorMessage.includes('429') || errorMessage.includes('quota');

    if (retries > 0 && isRateLimit) {
      console.warn(`Rate Limit hit (${errorCode}). Retrying in ${initialDelay}ms...`);
      await delay(initialDelay);
      return callGeminiWithRetry(apiCall, retries - 1, initialDelay * 2);
    }
    throw error;
  }
}

// Unified AI Caller
async function callAI(
  settings: AISettings | undefined,
  params: {
    model?: string;
    systemInstruction?: string;
    messages: { role: 'user' | 'model' | 'system'; content: string }[];
    tools?: any[];
    jsonSchema?: any;
    jsonMode?: boolean;
  }
): Promise<{ text: string; functionCalls?: any[] }> {
  
  // 1. Local LLM
  if (settings?.provider === 'local') {
    const url = (settings.localUrl || 'http://localhost:11434').replace(/\/$/, '') + '/v1/chat/completions';
    const model = settings.localModelName || 'llama3';
    
    const messages = params.messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content
    }));

    if (params.systemInstruction) {
      messages.unshift({ role: 'system', content: params.systemInstruction });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: params.jsonMode ? 'json' : undefined,
          tools: params.tools ? params.tools.map(t => ({
             type: 'function',
             function: {
               name: t.name,
               description: t.description,
               parameters: t.parameters
             }
          })) : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Local LLM Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      // Handle Tool Calls (OAI format)
      let functionCalls: any[] = [];
      if (choice?.message?.tool_calls) {
        functionCalls = choice.message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        }));
      }

      return {
        text: choice?.message?.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
    } catch (e) {
      console.error("Local LLM Call Failed", e);
      throw e;
    }
  }

  // 2. Gemini (Default)
  const ai = getAI(settings);
  const model = params.model || 'gemini-3-flash-preview';
  
  const contents = params.messages.map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const config: any = {
    systemInstruction: params.systemInstruction,
  };

  if (params.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = params.jsonSchema;
  } else if (params.jsonMode) {
    config.responseMimeType = "application/json";
  }

  if (params.tools) {
    // Gemini tools format
    config.tools = [{ functionDeclarations: params.tools }];
  }

  return callGeminiWithRetry(async () => {
    const result = await ai.models.generateContent({
      model,
      contents,
      config
    });
    
    let text = "";
    let functionCalls: any[] = [];
    
    if (result.candidates?.[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.text) text += part.text;
        if (part.functionCall) functionCalls.push(part.functionCall);
      }
    }

    return { text, functionCalls: functionCalls.length > 0 ? functionCalls : undefined };
  });
}

// --- OPTIMIZATION HELPER ---
// Condenses transaction history to fit within token limits while preserving recent context
const prepareEfficientContext = (transactions: Transaction[]) => {
  // Sort descending (newest first)
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (sorted.length === 0) return { recentJson: "[]", summary: "No data", meta: { count: 0 } };

  // 1. Recent Transactions (Raw details for specific queries)
  // Limit to last 60 items to keep token count manageable (~1.5k tokens)
  const recentRaw = sorted.slice(0, 60).map(t => ({
      d: t.date,
      desc: t.description,
      amt: Math.round(t.amount), // Round to save chars
      cat: t.category,
      t: t.type === TransactionType.INCOME ? 'INC' : 'EXP' // Abbreviate
  }));

  // 2. Monthly Aggregates (For trends context)
  const monthlyStats: Record<string, { inc: number, exp: number }> = {};
  
  sorted.slice(60).forEach(t => {
      const m = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyStats[m]) monthlyStats[m] = { inc: 0, exp: 0 };
      
      if (t.type === TransactionType.INCOME) monthlyStats[m].inc += t.amount;
      else monthlyStats[m].exp += t.amount;
  });

  const summaryStr = Object.entries(monthlyStats)
      .sort((a, b) => b[0].localeCompare(a[0])) // Sort months desc
      .slice(0, 12) // Last 12 months only
      .map(([m, s]) => `${m}: +${Math.round(s.inc)} / -${Math.round(s.exp)}`)
      .join('\n');

  return {
      recentJson: JSON.stringify(recentRaw),
      summary: summaryStr,
      meta: { count: transactions.length, start: sorted[sorted.length-1]?.date, end: sorted[0]?.date }
  };
};

const CONSULTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'create_chart_widget',
    description: 'Create a visual chart on the dashboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        query: { type: Type.STRING },
      },
      required: ['title', 'query']
    }
  },
  {
    name: 'manage_category',
    description: 'Add, remove, or rename a category.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'remove', 'rename'] },
        category: { type: Type.STRING },
        newCategoryName: { type: Type.STRING }
      },
      required: ['action', 'category']
    }
  },
  {
    name: 'add_rule',
    description: 'Add auto-categorization rule.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING },
        category: { type: Type.STRING },
        isRegex: { type: Type.BOOLEAN }
      },
      required: ['keyword', 'category']
    }
  },
  {
    name: 'manage_budget',
    description: 'Manage spending budget.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'update', 'remove'] },
        category: { type: Type.STRING },
        limit: { type: Type.NUMBER },
        period: { type: Type.STRING, enum: ['monthly', 'yearly'] }
      },
      required: ['action', 'category']
    }
  },
  {
    name: 'manage_goal',
    description: 'Manage savings goal/pocket.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'update', 'remove'] },
        title: { type: Type.STRING },
        targetAmount: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ['GOAL', 'POCKET'] },
        priority: { type: Type.NUMBER },
        targetDate: { type: Type.STRING },
        savingRuleAmount: { type: Type.NUMBER },
        savingRuleFrequency: { type: Type.STRING, enum: ['monthly', 'once', 'custom'] }
      },
      required: ['action', 'title']
    }
  }
];

export const proposeBudgetsAI = async (
  transactions: Transaction[],
  availableCategories: string[],
  settings?: AISettings
): Promise<Partial<Budget>[]> => {
  if (transactions.length < 5) return [];

  // Limit to recent 200 for proposal to save tokens
  const recentTx = transactions.slice(-200).map(t => ({
      c: t.category,
      a: Math.round(t.amount),
      d: t.date
  }));
  
  const prompt = `
    Propose monthly budgets.
    Cats: ${availableCategories.join(', ')}
    Data: ${JSON.stringify(recentTx)}
    Return JSON array: [{ "category": "Food", "limit": 500, "period": "monthly" }]
  `;

  try {
    const response = await callAI(settings, {
      model: "gemini-3-flash-preview",
      messages: [{ role: 'user', content: prompt }],
      jsonSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              limit: { type: Type.NUMBER },
              period: { type: Type.STRING }
            },
            required: ["category", "limit", "period"]
          }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error proposing budgets:", error);
    return [];
  }
};

export const categorizeTransactionsAI = async (
  transactions: { id: string; description: string; amount: number }[],
  availableCategories: string[],
  settings?: AISettings
): Promise<{ id: string; category: string }[]> => {
  if (transactions.length === 0) return [];

  const catStr = availableCategories.join(', ');

  const prompt = `
    Categorize these transactions into: ${catStr}.
    Return JSON: [{ "id": "1", "category": "Food" }]
    
    Tx:
    ${JSON.stringify(transactions.map(t => ({ id: t.id, d: t.description, a: t.amount })))}
  `;

  try {
    const response = await callAI(settings, {
      model: "gemini-3-flash-preview",
      messages: [{ role: 'user', content: prompt }],
      jsonSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["id", "category"]
          }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error categorizing transactions:", error);
    return [];
  }
};

export const generateRulesFromHistory = async (
  transactions: Transaction[],
  availableCategories: string[],
  settings?: AISettings
): Promise<CategorizationRule[]> => {
  if (transactions.length < 5) return [];

  // Limit input
  const categorized = transactions
    .filter(t => t.category !== 'Uncategorized' && t.category !== 'General')
    .slice(0, 100)
    .map(t => ({ d: t.description, c: t.category }));

  const prompt = `
    Create strict keyword rules from this data.
    Cats: ${availableCategories.join(', ')}
    Return JSON: [{ "keyword": "uber", "category": "Transport" }]
    Data: ${JSON.stringify(categorized)}
  `;

  try {
    const response = await callAI(settings, {
      model: "gemini-3-flash-preview",
      messages: [{ role: 'user', content: prompt }],
      jsonSchema: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  keyword: { type: Type.STRING },
                  category: { type: Type.STRING }
              },
              required: ["keyword", "category"]
          }
      }
    });

    const rawRules = JSON.parse(response.text || "[]");
    return rawRules.map((r: any) => ({
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        keyword: r.keyword.toLowerCase(),
        category: r.category
    }));

  } catch (error) {
    console.error("Error generating rules:", error);
    return [];
  }
};

export const predictRecurringExpenses = async (
  transactions: Transaction[],
  settings?: AISettings
): Promise<{ 
    total: number; 
    expectedIncome: number;
    breakdown: { category: string; amount: number; reason: string; type: 'income' | 'expense' }[] 
}> => {
  if (transactions.length < 5) return { total: 0, expectedIncome: 0, breakdown: [] };

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(new Date().getMonth() - 3);
  
  // Limit input to recent 200 items to avoid token overflow
  const recentTx = transactions
    .filter(t => new Date(t.date) >= threeMonthsAgo)
    .slice(0, 200)
    .map(t => ({ d: t.date, desc: t.description, a: Math.round(t.amount), t: t.type === TransactionType.INCOME ? 'INC' : 'EXP' }));

  const prompt = `
    Identify recurring monthly bills/income from this recent data.
    Return JSON: { "breakdown": [{ "category": "Rent", "amount": 1000, "reason": "Monthly Rent", "type": "expense" }], "totalExpenses": 1000, "totalIncome": 5000 }
    Data: ${JSON.stringify(recentTx)}
  `;

  try {
    const response = await callAI(settings, {
      model: "gemini-3-flash-preview",
      messages: [{ role: 'user', content: prompt }],
      jsonMode: true
    });

    const res = JSON.parse(response.text || '{"totalExpenses": 0, "totalIncome": 0, "breakdown": []}');
    return {
        total: res.totalExpenses || 0,
        expectedIncome: res.totalIncome || 0,
        breakdown: res.breakdown || []
    };
  } catch (error) {
    console.error("Error predicting expenses:", error);
    return { total: 0, expectedIncome: 0, breakdown: [] };
  }
};

export const analyzeFinancesDeeply = async (
  transactions: Transaction[],
  userQuery: string,
  settings?: AISettings
): Promise<{ text: string }> => {
  if (transactions.length === 0) return { text: "No transaction data available." };

  // Use optimized context
  const context = prepareEfficientContext(transactions);

  const prompt = `
    Deep financial analysis.
    Metadata: ${JSON.stringify(context.meta)}
    Summary History (Monthly):
    ${context.summary}
    
    Recent Transactions (Last 60):
    ${context.recentJson}
    
    User Query: "${userQuery}"
    
    Provide a reasoned answer. Use the recent transactions for specifics and summary for trends.
  `;

  try {
    const response = await callAI(settings, {
      model: "gemini-3-pro-preview",
      messages: [{ role: 'user', content: prompt }]
    });

    return { text: response.text || "Analysis failed." };
  } catch (error) {
    console.error("Error in deep analysis:", error);
    return { text: "Sorry, I encountered an error. Please try again in a moment." };
  }
};

export const chatWithFinanceAssistant = async (
  history: { role: 'user' | 'model'; content: string }[],
  currentMessage: string,
  transactions: Transaction[],
  contextData: { goals: Goal[], budgets: Budget[], categories: string[] },
  settings?: AISettings
): Promise<{ text?: string, groundingChunks?: any[], functionCalls?: any[] }> => {
    
  // Use optimized context
  const context = prepareEfficientContext(transactions);

  const goalsStr = JSON.stringify(contextData.goals.map(g => ({ t: g.title, amt: g.targetAmount, saved: g.allocatedAmount })));
  const budgetsStr = JSON.stringify(contextData.budgets.map(b => ({ c: b.category, l: b.limit })));

  const systemInstruction = `
    You are a financial assistant.
    
    Context:
    - Recent Tx (Last 60): ${context.recentJson}
    - History Summary: ${context.summary}
    - Goals: ${goalsStr}
    - Budgets: ${budgetsStr}
    - Today: ${new Date().toISOString().split('T')[0]}

    Answer the user. Use tools for actions. Keep responses concise.
  `;

  try {
    const messages: { role: 'user' | 'model' | 'system'; content: string }[] = [
        ...history.map(h => ({ role: h.role as 'user' | 'model', content: h.content })),
        { role: 'user', content: currentMessage }
    ];

    const response = await callAI(settings, {
      model: "gemini-3-flash-preview",
      systemInstruction,
      messages,
      tools: CONSULTANT_TOOLS
    });

    return { 
        text: response.text || (response.functionCalls && response.functionCalls.length > 0 ? "I've prepared a proposal." : "No response generated."),
        functionCalls: response.functionCalls
    };
  } catch (error: any) {
    console.error("Chat error:", error);
    return { text: "Connection error. Check API Key or Local LLM settings." };
  }
};

export const generateDynamicChart = async (
    transactions: Transaction[],
    userQuery: string,
    settings?: AISettings
  ): Promise<any> => {
    
    // For charts, we need raw data, but maybe not ALL of it if it's huge.
    // However, charts usually need specific aggregations. 
    // We'll send up to 500 recent items for better chart accuracy, condensed.
    const dataStr = JSON.stringify(transactions.slice(-500).map(t => ({
        d: t.date,
        a: Math.round(t.amount),
        c: t.category,
        t: t.type === TransactionType.INCOME ? 'I' : 'E'
    })));
  
    const prompt = `
      Create a JSON chart config for Recharts.
      Query: "${userQuery}"
      Data: ${dataStr}
      Output: { "chartType": "bar"|"line"|"pie"|"area", "title": "...", "xAxisKey": "...", "series": [{ "dataKey": "...", "color": "#..." }], "data": [...] }
    `;
  
    try {
      const response = await callAI(settings, {
        model: "gemini-3-flash-preview",
        messages: [{ role: 'user', content: prompt }],
        jsonMode: true
      });
  
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Error generating chart:", error);
      return { chartType: "error", title: "Failed to generate chart." };
    }
  };