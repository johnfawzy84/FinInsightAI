import React, { useState, useRef, useEffect } from 'react';
import { analyzeFinancesDeeply, chatWithFinanceAssistant } from '../services/gemini';
import { Transaction } from '../types';
import { Sparkles, Send, BrainCircuit, Loader2, Bot } from 'lucide-react';

interface AIConsultantProps {
  transactions: Transaction[];
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
}

const AIConsultant: React.FC<AIConsultantProps> = ({ transactions }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'model', content: "Hello! I'm your financial AI assistant. I can help categorize your spending, analyze trends, or give saving advice. How can I help today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinkingModel, setUseThinkingModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = "";

      // Ensure data is sorted chronologically for the AI context
      const sortedTransactions = [...transactions].sort((a, b) => {
         // robust comparison handling string dates
         return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      if (useThinkingModel) {
        // Use Gemini 3 Pro with Thinking (Pass all sorted data)
        responseText = await analyzeFinancesDeeply(sortedTransactions, userMessage.content);
      } else {
        // Use standard chat (Flash)
        // We pass the full sorted list now, as Gemini 2.5 Flash has a large context window.
        // Previously slicing (-50) caused hallucinations for yearly queries.
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        responseText = await chatWithFinanceAssistant(history, userMessage.content, sortedTransactions);
      }

      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        isThinking: useThinkingModel
      };
      
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Sorry, I encountered an error. Please check your API key or try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-surface rounded-xl border border-slate-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Bot size={20} />
            </div>
            <h3 className="font-semibold text-white">Financial Consultant</h3>
        </div>
        
        {/* Thinking Mode Toggle */}
        <button
          onClick={() => setUseThinkingModel(!useThinkingModel)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            useThinkingModel 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' 
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
          title="Use Gemini 3 Pro reasoning for complex analysis"
        >
          <BrainCircuit size={14} />
          <span>Deep Reasoning {useThinkingModel ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-700 text-slate-200 rounded-bl-none border border-slate-600'
              }`}
            >
              {msg.isThinking && (
                 <div className="flex items-center space-x-1 text-purple-300 mb-2 text-xs font-bold uppercase tracking-wider">
                    <Sparkles size={12} />
                    <span>Deep Analysis</span>
                 </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-600 flex items-center space-x-2 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">
                {useThinkingModel ? 'Thinking deeply about your finances...' : 'Gemini is typing...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder={useThinkingModel ? "Ask for a deep audit of your spending..." : "Ask a quick question..."}
            className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConsultant;