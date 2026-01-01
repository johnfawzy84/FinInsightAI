import React, { useState, useRef, useEffect } from 'react';
import { analyzeFinancesDeeply, chatWithFinanceAssistant } from '../services/gemini';
import { Transaction } from '../types';
import { Sparkles, Send, BrainCircuit, Loader2, Bot, X, Minimize2, Maximize2 } from 'lucide-react';

interface AIConsultantProps {
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
}

const AIConsultant: React.FC<AIConsultantProps> = ({ transactions, isOpen, onClose }) => {
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
    if (isOpen) {
        setTimeout(scrollToBottom, 100); // Slight delay for layout transition
    }
  }, [messages, isOpen]);

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
         return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      if (useThinkingModel) {
        // Use Gemini 3 Pro with Thinking
        responseText = await analyzeFinancesDeeply(sortedTransactions, userMessage.content);
      } else {
        // Use standard chat (Flash)
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
    <>
        {/* Mobile Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                onClick={onClose}
            />
        )}

        {/* Drawer Container */}
        <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-slate-900 md:bg-surface border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 backdrop-blur-md shrink-0">
                <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">FinSight AI</h3>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => setUseThinkingModel(!useThinkingModel)}
                        className={`p-2 rounded-lg transition-all ${
                            useThinkingModel 
                            ? 'text-purple-300 bg-purple-500/20' 
                            : 'text-slate-500 hover:text-purple-400 hover:bg-slate-800'
                        }`}
                        title={`Deep Reasoning ${useThinkingModel ? 'ON' : 'OFF'}`}
                    >
                        <BrainCircuit size={18} />
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-900/50 to-transparent">
                {messages.length === 1 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-50">
                        <Bot size={48} />
                        <p className="text-sm">Ask about your spending habits...</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-md ${
                        msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                    }`}
                    >
                    {msg.isThinking && (
                        <div className="flex items-center space-x-1 text-purple-300 mb-2 text-xs font-bold uppercase tracking-wider border-b border-purple-500/20 pb-1">
                            <Sparkles size={12} />
                            <span>Deep Analysis</span>
                        </div>
                    )}
                    {msg.content}
                    </div>
                </div>
                ))}
                
                {isLoading && (
                <div className="flex justify-start animate-fade-in">
                    <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-700 flex items-center space-x-3 text-slate-400 shadow-sm">
                    {useThinkingModel ? (
                        <BrainCircuit size={16} className="animate-pulse text-purple-400" />
                    ) : (
                        <Loader2 size={16} className="animate-spin text-indigo-400" />
                    )}
                    <span className="text-xs font-medium">
                        {useThinkingModel ? 'Thinking deeply...' : 'Analyzing...'}
                    </span>
                    </div>
                </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-700 shrink-0">
                <div className="flex items-end space-x-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!isLoading) handleSend();
                        }
                    }}
                    placeholder={useThinkingModel ? "Ask complex questions..." : "Type a message..."}
                    className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500 resize-none min-h-[50px] max-h-[120px]"
                    disabled={isLoading}
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-lg shadow-indigo-500/20 mb-[1px]"
                >
                    <Send size={20} />
                </button>
                </div>
                <div className="text-[10px] text-slate-500 text-center mt-2">
                    AI can make mistakes. Verify important financial data.
                </div>
            </div>
        </div>
    </>
  );
};

export default AIConsultant;