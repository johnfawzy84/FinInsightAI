import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CategorizationRule } from "../types";

// Initialize Gemini Client
// CRITICAL: API KEY MUST BE FROM process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Auto-categorizes a list of transactions using Gemini Flash for speed.
 */
export const categorizeTransactionsAI = async (
  transactions: { id: string; description: string; amount: number }[],
  availableCategories: string[]
): Promise<{ id: string; category: string }[]> => {
  if (transactions.length === 0) return [];

  // If no categories provided, fallback to generic instruction
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
      model: "gemini-2.5-flash",
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

/**
 * Analyzes existing transactions to generate categorization rules.
 */
export const generateRulesFromHistory = async (
  transactions: Transaction[],
  availableCategories: string[]
): Promise<CategorizationRule[]> => {
  if (transactions.length < 5) return [];

  // Filter out uncategorized items to learn from what is already sorted
  const categorized = transactions.filter(t => 
    t.category !== 'Uncategorized' && t.category !== 'General'
  ).slice(0, 100); // Limit to 100 recent for performance

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
      model: "gemini-2.5-flash",
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

/**
 * Performs deep financial analysis using Gemini 3 Pro with Thinking Mode.
 */
export const analyzeFinancesDeeply = async (
  transactions: Transaction[],
  userQuery: string
): Promise<string> => {
  if (transactions.length === 0) return "No transaction data available for analysis.";

  // Calculate metadata for grounding
  const count = transactions.length;
  // Assume sorted by AIConsultant, but safe to grab ends
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
      model: "gemini-3-pro-preview", // Use Pro for complex tasks
      contents: prompt,
      config: {
        // Thinking Budget setup for deep reasoning
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    return response.text || "I couldn't generate an analysis at this time.";
  } catch (error) {
    console.error("Error in deep analysis:", error);
    return "Sorry, I encountered an error while thinking about your finances. Please try again.";
  }
};

/**
 * Simple chat helper for quick questions using Flash.
 */
export const chatWithFinanceAssistant = async (
  history: { role: 'user' | 'model'; content: string }[],
  currentMessage: string,
  transactions: Transaction[]
): Promise<string> => {
    
  // Data Grounding
  const count = transactions.length;
  if (count === 0) return "I don't have any transaction data to analyze yet.";

  // Calculate stats to guide the model
  const startDate = transactions[0].date;
  const endDate = transactions[count - 1].date;

  // Compress data slightly to save tokens while keeping readability
  const dataStr = JSON.stringify(transactions.map(t => ({
      d: t.date,
      desc: t.description,
      amt: t.amount,
      cat: t.category,
      type: t.type
  })));

  const systemInstruction = `
    You are a helpful financial assistant. 
    You have access to the user's transaction data.
    
    DATA METADATA:
    - Total Transactions: ${count}
    - Date Range Available: ${startDate} to ${endDate}
    - Today's Date: ${new Date().toISOString().split('T')[0]}

    INSTRUCTIONS:
    1. Base your answers ONLY on the provided JSON data.
    2. If the user asks about a month or year that is NOT in the "Date Range Available", explicitly state that you have no data for that period. Do not make up numbers.
    3. Keep answers concise unless asked for detail.
    
    TRANSACTION DATA (JSON):
    ${dataStr}
  `;

  try {
    // Note: We use generateContent with history injected manually for a stateless-like wrapper
    // ideally utilize chats.create for multi-turn if persistent context is needed, 
    // but here we rebuild context every time to ensure data freshness.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ text: currentMessage }] }
        ],
        config: { systemInstruction }
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting to the AI service right now.";
  }
};