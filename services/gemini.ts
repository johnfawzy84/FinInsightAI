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
  const transactionSummary = transactions.map(t => 
    `${t.date}: ${t.description} - $${t.amount} (${t.type}, ${t.category})`
  ).join('\n');

  const prompt = `
    Analyze the following financial transaction data deeply.
    User Question: "${userQuery}"
    
    Data:
    ${transactionSummary}
    
    Provide a comprehensive, reasoned answer. Identify patterns, anomalies, and actionable advice.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Use Pro for complex tasks
      contents: prompt,
      config: {
        // Thinking Budget setup for deep reasoning
        thinkingConfig: { thinkingBudget: 32768 },
        // DO NOT set maxOutputTokens when using thinkingBudget logic for this specific requirement unless calculating the offset, 
        // but the instruction said "Do not set maxOutputTokens".
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
  contextData: string
): Promise<string> => {
    
  const systemInstruction = `You are a helpful financial assistant. You have access to the user's transaction data: ${contextData}. Keep answers concise unless asked for detail.`;

  try {
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction }
    });
    
    // Load history (skipping for simplicity in this implementation pattern, usually we'd add history to the chat object)
    // For this stateless call wrapper:
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: `Context Data: ${contextData}` }] }, // Prime context
            ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ text: currentMessage }] }
        ],
        config: { systemInstruction }
    });

    return response.text || "";
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting right now.";
  }
};