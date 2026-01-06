import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Transaction, CategorizationRule, Budget, Goal } from "../types";

// Always use named parameters and exclusively get the API key from process.env.API_KEY.
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key is not configured. Please set it in Settings.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const CONSULTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'create_chart_widget',
    description: 'Create a visual chart on the dashboard to help the user understand their data. Use this when the user asks to see, visualize, or graph something.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A short, descriptive title for the chart" },
        query: { type: Type.STRING, description: "The natural language query to generate the data, e.g. 'Spending on Food vs Transport in 2023'" },
      },
      required: ['title', 'query']
    }
  },
  {
    name: 'manage_category',
    description: 'Add, remove, or rename a transaction category.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'remove', 'rename'] },
        category: { type: Type.STRING, description: "The category to act upon" },
        newCategoryName: { type: Type.STRING, description: "Required only for 'rename' action" }
      },
      required: ['action', 'category']
    }
  },
  {
    name: 'add_rule',
    description: 'Add a new auto-categorization rule.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: "The text to look for in transaction descriptions (case-insensitive)" },
        category: { type: Type.STRING, description: "The target category" },
        isRegex: { type: Type.BOOLEAN, description: "Whether the keyword is a regular expression" }
      },
      required: ['keyword', 'category']
    }
  },
  {
    name: 'manage_budget',
    description: 'Create, update, or remove a spending budget.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'update', 'remove'] },
        category: { type: Type.STRING, description: "The category for the budget" },
        limit: { type: Type.NUMBER, description: "The spending limit amount" },
        period: { type: Type.STRING, enum: ['monthly', 'yearly'] }
      },
      required: ['action', 'category']
    }
  },
  {
    name: 'manage_goal',
    description: 'Create, update, or remove a savings goal or pocket. Use update to modify existing ones.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['add', 'update', 'remove'] },
        title: { type: Type.STRING, description: "Name of the goal/pocket (must match existing name to update)" },
        targetAmount: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ['GOAL', 'POCKET'] },
        priority: { type: Type.NUMBER },
        targetDate: { type: Type.STRING, description: "YYYY-MM-DD" },
        savingRuleAmount: { type: Type.NUMBER, description: "Monthly saving amount" },
        savingRuleFrequency: { type: Type.STRING, enum: ['monthly', 'once', 'custom'] }
      },
      required: ['action', 'title']
    }
  }
];

export const proposeBudgetsAI = async (
  transactions: Transaction[],
  availableCategories: string[]
): Promise<Partial<Budget>[]> => {
  if (transactions.length < 5) return [];

  const ai = getAI();
  const recentTx = transactions.slice(-300); 
  
  const prompt = `
    Analyze these transactions and propose a monthly budget for each category.
    Look at historical spending patterns. If a category is volatile, suggest a conservative limit.
    Available Categories: ${availableCategories.join(', ')}

    Return a JSON array of objects:
    [
      { "category": "Food & Dining", "limit": 500, "period": "monthly" },
      ...
    ]

    Data:
    ${JSON.stringify(recentTx.map(t => ({ d: t.date, c: t.category, a: t.amount, t: t.type })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
  availableCategories: string[]
): Promise<{ id: string; category: string }[]> => {
  if (transactions.length === 0) return [];

  const ai = getAI();
  const categoryInstruction = availableCategories.length > 0 
    ? `Classify into one of these exact categories: ${availableCategories.join(', ')}.`
    : `Categorize into standard personal finance categories (e.g., Food, Transport, Utilities).`;

  const prompt = `
    You are a financial assistant. ${categoryInstruction}
    Return a JSON array of objects with 'id' and 'category'.
    
    Transactions:
    ${JSON.stringify(transactions.map(t => ({ id: t.id, description: t.description, amount: t.amount })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
  availableCategories: string[]
): Promise<CategorizationRule[]> => {
  if (transactions.length < 5) return [];

  const ai = getAI();
  const categorized = transactions.filter(t => 
    t.category !== 'Uncategorized' && t.category !== 'General'
  ).slice(0, 100);

  const prompt = `
    Analyze these categorized transactions and create strict keyword matching rules.
    Return a JSON array of rules. Each rule should have a 'keyword' (substring to match in description, lowercase) and a 'category'.
    Only create rules where the pattern is obvious and reliable (e.g., 'uber' -> 'Transportation').
    Available Categories: ${availableCategories.join(', ')}

    Transactions:
    ${JSON.stringify(categorized.map(t => ({ d: t.description, c: t.category })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
  transactions: Transaction[]
): Promise<{ 
    total: number; 
    expectedIncome: number;
    breakdown: { category: string; amount: number; reason: string; type: 'income' | 'expense' }[] 
}> => {
  if (transactions.length < 5) return { total: 0, expectedIncome: 0, breakdown: [] };

  const ai = getAI();
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  
  const recentTx = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);

  const prompt = `
    Analyze these recent transactions to predict the financial baseline for the CURRENT month.
    
    1. Identify recurring FIXED expenses (Rent, Internet, Insurance, Subscriptions).
    2. Estimate essential variable costs (Groceries, Fuel) based on monthly averages.
    3. Identify recurring INCOME (Salary, Dividends, Regular Transfers).
    
    Do NOT include one-off items.
    
    Return JSON:
    {
      "breakdown": [
        { "category": "Income", "amount": 5000, "reason": "Monthly Salary", "type": "income" },
        { "category": "Housing", "amount": 1500, "reason": "Rent", "type": "expense" }
      ],
      "totalExpenses": 1900,
      "totalIncome": 5000
    }

    Data (d=date, desc=description, amt=amount, t=type):
    ${JSON.stringify(recentTx.map(t => ({ d: t.date, desc: t.description, amt: t.amount, t: t.type })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
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
  userQuery: string
): Promise<{ text: string }> => {
  if (transactions.length === 0) return { text: "No transaction data available for analysis." };

  const ai = getAI();
  const count = transactions.length;
  const startDate = transactions[0].date;
  const endDate = transactions[count - 1].date;

  const transactionSummary = transactions.map(t => 
    `${t.date}: ${t.description} - $${t.amount} (${t.type}, ${t.category})`
  ).join('\n');

  const prompt = `
    Analyze the following financial transaction data deeply.
    
    Context Metadata:
    - Transaction Count: ${count}
    - Data Time Range: ${startDate} to ${endDate}
    - Today's Date: ${new Date().toISOString().split('T')[0]}
    
    User Question: "${userQuery}"
    
    Data:
    ${transactionSummary}
    
    Provide a comprehensive, reasoned answer. 
    IMPORTANT: Only use the provided data. If the user asks about a time period outside the 'Data Time Range', explain that you do not have that data.
    Identify patterns, anomalies, and actionable advice.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    return { text: response.text || "I couldn't generate an analysis at this time." };
  } catch (error) {
    console.error("Error in deep analysis:", error);
    return { text: "Sorry, I encountered an error while thinking about your finances. Please try again." };
  }
};

export const chatWithFinanceAssistant = async (
  history: { role: 'user' | 'model'; content: string }[],
  currentMessage: string,
  transactions: Transaction[],
  contextData: { goals: Goal[], budgets: Budget[], categories: string[] }
): Promise<{ text?: string, groundingChunks?: any[], functionCalls?: any[] }> => {
    
  const ai = getAI();
  const count = transactions.length;
  const startDate = transactions.length > 0 ? transactions[0].date : 'N/A';
  const endDate = transactions.length > 0 ? transactions[count - 1].date : 'N/A';

  const dataStr = JSON.stringify(transactions.map(t => ({
      d: t.date,
      desc: t.description,
      amt: t.amount,
      cat: t.category,
      type: t.type
  })));

  const goalsStr = JSON.stringify(contextData.goals.map(g => ({ title: g.title, target: g.targetAmount, saved: g.allocatedAmount, type: g.type, rule: g.savingRule })));
  const budgetsStr = JSON.stringify(contextData.budgets);
  const catsStr = JSON.stringify(contextData.categories);

  const systemInstruction = `
    You are a helpful financial assistant with access to Google Search and the user's transaction data.
    
    DATA METADATA:
    - Total Transactions: ${count}
    - Date Range Available: ${startDate} to ${endDate}
    - Today's Date: ${new Date().toISOString().split('T')[0]}

    CURRENT STATE (Read this to decide between add/update):
    - Existing Goals/Pockets: ${goalsStr}
    - Existing Budgets: ${budgetsStr}
    - Categories: ${catsStr}

    INSTRUCTIONS:
    1. If the user asks about their spending, income, or specific transactions, base your answer PRIMARILY on the provided JSON data.
    2. If the user asks about general financial concepts (e.g., "current inflation rate", "what is an ETF"), market data, or facts not in the database, use Google Search to provide up-to-date information.
    3. If the user asks to visualize data, create a chart, add a budget, change a category, or set a goal, USE THE PROVIDED TOOLS.
    4. Do not simply describe how to do it; use the tool to propose the action.
    5. CHECK "CURRENT STATE" first. If a goal with a similar name exists, use 'update' action instead of 'add'.
    6. If the user asks to "save X amount monthly", update the goal's savingRuleAmount using the 'manage_goal' tool.
    
    TRANSACTION DATA (JSON):
    ${dataStr}
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ text: currentMessage }] }
        ],
        config: { 
            systemInstruction,
            tools: [
                { googleSearch: {} }, 
                { functionDeclarations: CONSULTANT_TOOLS }
            ]
        }
    });

    // Parse Response for Text and Function Calls
    let text = "";
    let functionCalls: any[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                text += part.text;
            }
            if (part.functionCall) {
                functionCalls.push(part.functionCall);
            }
        }
    }

    return { 
        text: text || (functionCalls.length > 0 ? "I've prepared a proposal for you." : "I couldn't generate a response."),
        groundingChunks: chunks,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
    };
  } catch (error) {
    console.error("Chat error:", error);
    return { text: "I'm having trouble connecting to the AI service right now." };
  }
};

export const generateDynamicChart = async (
    transactions: Transaction[],
    userQuery: string
  ): Promise<any> => {
    const ai = getAI();
    const dataStr = JSON.stringify(transactions.map(t => ({
        d: t.date,
        a: t.amount,
        c: t.category,
        t: t.type
    })));
  
    const prompt = `
      You are a data visualization expert. The user wants to graph their financial data.
      
      User Query: "${userQuery}"
      
      Raw Data (d=date, a=amount, c=category, t=type):
      ${dataStr}
  
      INSTRUCTIONS:
      1. Process the Raw Data to answer the User Query (e.g., aggregate by month, filter by category, sum up totals).
      2. Determine the best chart type: 'bar', 'line', 'area', or 'pie'.
      3. Create a JSON object compatible with Recharts.
      4. Colors: Use hex codes like #6366f1 (indigo), #10b981 (emerald), #f59e0b (amber), #ef4444 (red), #ec4899 (pink).
      
      OUTPUT SCHEMA (JSON):
      {
        "chartType": "bar" | "line" | "area" | "pie",
        "title": "Short descriptive title",
        "xAxisKey": "name of the key for x-axis (e.g. 'name', 'date', 'month')",
        "series": [
            { "dataKey": "key for value 1", "name": "Legend Name 1", "color": "#hex" },
            { "dataKey": "key for value 2", "name": "Legend Name 2", "color": "#hex" }
        ],
        "data": [
            { "xAxisKey": "Label 1", "valueKey1": 100, "valueKey2": 50 },
            ...
        ]
      }
      
      If the query is impossible to answer with the data, return chartType: "error" and a title explaining why.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
  
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Error generating chart:", error);
      return { chartType: "error", title: "Failed to generate chart structure." };
    }
  };