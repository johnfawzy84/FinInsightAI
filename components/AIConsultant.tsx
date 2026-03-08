import React, { useState, useRef, useEffect } from 'react';
import { analyzeFinancesDeeply, chatWithFinanceAssistant, generateDynamicChart } from '../services/gemini';
import { Transaction, DashboardWidget, CategorizationRule, Budget, Goal, AISettings } from '../types';
import { Sparkles, Send, BrainCircuit, Loader2, Bot, X, Globe, Copy, Download, Check, Wrench, ThumbsUp, ThumbsDown } from 'lucide-react';
import Markdown from 'react-markdown';

interface AIConsultantProps {
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  // State Mutators
  onUpdateDashboardWidgets: (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => void;
  onUpdateRules: (updater: (rules: CategorizationRule[]) => CategorizationRule[]) => void;
  onUpdateCategories: (newCategories: string[], renamedFrom?: string, renamedTo?: string) => void;
  onUpdateBudgets: (updater: (budgets: Budget[]) => Budget[]) => void;
  onUpdateGoals: (updater: (goals: Goal[]) => Goal[]) => void;
  // Current State
  goals: Goal[];
  budgets: Budget[];
  categories: string[];
  currency: string;
  aiSettings?: AISettings;
}

interface Proposal {
    id: string;
    type: string;
    args: any;
    status: 'pending' | 'approved' | 'denied' | 'completed' | 'failed';
    summary: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
  groundingChunks?: any[];
  proposals?: Proposal[];
}

const AIConsultant: React.FC<AIConsultantProps> = ({ 
    transactions, 
    isOpen, 
    onClose,
    onUpdateDashboardWidgets,
    onUpdateRules,
    onUpdateCategories,
    onUpdateBudgets,
    onUpdateGoals,
    goals,
    budgets,
    categories,
    currency,
    aiSettings
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'model', content: "Hello! I can analyze your finances, create charts, and help manage your budgets and goals. What do you need?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinkingModel, setUseThinkingModel] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
        setTimeout(scrollToBottom, 100); 
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseData: { text?: string; groundingChunks?: any[]; functionCalls?: any[] };

      // Ensure data is sorted chronologically for the AI context
      const sortedTransactions = [...transactions].sort((a, b) => {
         return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      if (useThinkingModel) {
        // Thinking model (Text Only for now)
        const res = await analyzeFinancesDeeply(sortedTransactions, userMessage.content, aiSettings);
        responseData = { text: res.text };
      } else {
        // Standard chat with Tools and full context
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        responseData = await chatWithFinanceAssistant(
            history, 
            userMessage.content, 
            sortedTransactions,
            { goals, budgets, categories },
            aiSettings
        );
      }

      // Process Function Calls into Proposals
      const proposals: Proposal[] = [];
      if (responseData.functionCalls) {
          responseData.functionCalls.forEach((fc, idx) => {
              proposals.push({
                  id: `prop-${Date.now()}-${idx}`,
                  type: fc.name,
                  args: fc.args,
                  status: 'pending',
                  summary: getProposalSummary(fc.name, fc.args)
              });
          });
      }

      const modelMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseData.text || (proposals.length > 0 ? "I have a suggestion:" : "I couldn't generate a text response."),
        isThinking: useThinkingModel,
        groundingChunks: responseData.groundingChunks,
        proposals: proposals.length > 0 ? proposals : undefined
      };
      
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getProposalSummary = (type: string, args: any) => {
      switch(type) {
          case 'create_chart_widget': 
              return `Create Chart: "${args.title}"\n• Query: ${args.query}`;
          
          case 'manage_category':
              if (args.action === 'rename') return `Rename Category:\n• From: "${args.category}"\n• To: "${args.newCategoryName}"`;
              return `${args.action === 'add' ? 'Create' : 'Delete'} Category: "${args.category}"`;

          case 'add_rule': 
              return `New Auto-Categorization Rule\n• Keyword: "${args.keyword}" ${args.isRegex ? '(Regex)' : ''}\n• Assign to: ${args.category}`;

          case 'manage_budget':
              if (args.action === 'remove') return `Delete Budget for "${args.category}"`;
              return `${args.action === 'add' ? 'Create' : 'Update'} Budget: "${args.category}"\n• Limit: ${currency}${args.limit}\n• Period: ${args.period}`;

          case 'manage_goal': {
              if (args.action === 'remove') return `Delete ${args.type || 'Goal'}: "${args.title}"`;
              
              let details = `${args.action === 'add' ? 'Create' : 'Update'} ${args.type || 'Goal'}: "${args.title}"`;
              if (args.targetAmount !== undefined) details += `\n• Target: ${currency}${args.targetAmount}`;
              if (args.targetDate) details += `\n• Date: ${args.targetDate}`;
              if (args.savingRuleAmount) details += `\n• Auto-Save: ${currency}${args.savingRuleAmount} (${args.savingRuleFrequency || 'monthly'})`;
              return details;
          }

          default: return `Execute Action: ${type}`;
      }
  };

  const executeProposal = async (messageId: string, proposal: Proposal) => {
      // Optimistic update to 'completed' or 'failed'
      const updateStatus = (status: Proposal['status']) => {
          setMessages(prev => prev.map(m => {
              if (m.id !== messageId) return m;
              return {
                  ...m,
                  proposals: m.proposals?.map(p => p.id === proposal.id ? { ...p, status } : p)
              };
          }));
      };

      try {
          if (proposal.type === 'create_chart_widget') {
              const config = await generateDynamicChart(transactions, proposal.args.query, aiSettings);
              onUpdateDashboardWidgets(prev => [...prev, {
                  id: `custom-${Date.now()}`,
                  type: 'custom',
                  title: proposal.args.title,
                  description: proposal.args.description || proposal.args.query,
                  query: proposal.args.query,
                  cachedConfig: config,
                  visible: true,
                  width: 'half'
              }]);
          } 
          else if (proposal.type === 'manage_category') {
              if (proposal.args.action === 'add') {
                  onUpdateCategories([proposal.args.category], undefined, undefined); 
              }
          }
          else if (proposal.type === 'add_rule') {
              onUpdateRules(prev => [...prev, {
                  id: `rule-${Date.now()}`,
                  keyword: proposal.args.keyword.toLowerCase(),
                  category: proposal.args.category,
                  isRegex: proposal.args.isRegex
              }]);
          }
          else if (proposal.type === 'manage_budget') {
              onUpdateBudgets(prev => {
                  if (proposal.args.action === 'remove') {
                      return prev.filter(b => b.category !== proposal.args.category);
                  }
                  // Add or Update
                  const newBudget: Budget = {
                      id: `budget-${Date.now()}`,
                      category: proposal.args.category,
                      limit: proposal.args.limit || 0,
                      period: proposal.args.period || 'monthly'
                  };
                  // Remove existing for same cat/period to "update"
                  const cleaned = prev.filter(b => !(b.category === newBudget.category && b.period === newBudget.period));
                  return [...cleaned, newBudget];
              });
          }
          else if (proposal.type === 'manage_goal') {
              onUpdateGoals(prev => {
                  if (proposal.args.action === 'remove') {
                      return prev.filter(g => g.title !== proposal.args.title);
                  }
                  
                  // Construct Saving Rule if present
                  let savingRule = undefined;
                  if (proposal.args.savingRuleAmount) {
                      savingRule = {
                          amount: proposal.args.savingRuleAmount,
                          frequency: proposal.args.savingRuleFrequency || 'monthly'
                      };
                  }

                  // Handle Updates
                  if (proposal.args.action === 'update') {
                      return prev.map(g => {
                          if (g.title.toLowerCase() === proposal.args.title.toLowerCase()) {
                              return {
                                  ...g,
                                  targetAmount: proposal.args.targetAmount !== undefined ? proposal.args.targetAmount : g.targetAmount,
                                  targetDate: proposal.args.targetDate || g.targetDate,
                                  priority: proposal.args.priority || g.priority,
                                  savingRule: savingRule || g.savingRule
                              };
                          }
                          return g;
                      });
                  }

                  // Handle Add (checks existence to prevent dupe if AI failed to use update)
                  const exists = prev.some(g => g.title.toLowerCase() === proposal.args.title.toLowerCase());
                  if (exists) {
                      // Fallback to update logic if exists
                      return prev.map(g => {
                          if (g.title.toLowerCase() === proposal.args.title.toLowerCase()) {
                              return {
                                  ...g,
                                  targetAmount: proposal.args.targetAmount !== undefined ? proposal.args.targetAmount : g.targetAmount,
                                  savingRule: savingRule || g.savingRule
                              };
                          }
                          return g;
                      });
                  }

                  const newGoal: Goal = {
                      id: `goal-${Date.now()}`,
                      type: proposal.args.type || 'GOAL',
                      title: proposal.args.title,
                      targetAmount: proposal.args.targetAmount || 0,
                      allocatedAmount: 0,
                      targetDate: proposal.args.targetDate || '2025-01-01', 
                      priority: proposal.args.priority || 3,
                      icon: proposal.args.type === 'POCKET' ? '🛡️' : '🎯',
                      savingRule: savingRule
                  };
                  return [...prev, newGoal];
              });
          }

          updateStatus('completed');
      } catch (e) {
          console.error(e);
          updateStatus('failed');
      }
  };



  // --- Export & Copy Logic ---

  const getFormattedChat = () => {
    return messages.map(m => {
        const role = m.role === 'user' ? 'You' : 'FinSight AI';
        const time = m.id === 'welcome' ? '' : ` [${new Date(Number(m.id)).toLocaleTimeString()}]`;
        return `### ${role}${time}\n${m.content}\n`;
    }).join('\n-----------------------------------\n');
  };

  const handleCopyChat = async () => {
    try {
        await navigator.clipboard.writeText(getFormattedChat());
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
  };

  const handleExportChat = () => {
    const text = getFormattedChat();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finsight-chat-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                    {/* Copy Button */}
                    <button
                        onClick={handleCopyChat}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
                        title="Copy Chat"
                    >
                         {copySuccess ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>

                    {/* Export Button */}
                    <button
                        onClick={handleExportChat}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Export Chat (.txt)"
                    >
                        <Download size={18} />
                    </button>

                    <div className="w-px h-4 bg-slate-700 mx-1"></div>

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
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                    <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
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
                    
                    {/* Markdown Rendered Content */}
                    <div 
                        className={`markdown-body 
                            [&>h1]:font-bold [&>h1]:text-lg [&>h1]:mb-2 [&>h1]:text-white 
                            [&>h2]:font-bold [&>h2]:text-base [&>h2]:mb-2 [&>h2]:text-white
                            [&>h3]:font-bold [&>h3]:text-sm [&>h3]:mb-1 [&>h3]:text-indigo-300
                            [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-2 
                            [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-2
                            [&>li]:mb-1
                            [&>p]:mb-2 last:[&>p]:mb-0
                            [&>strong]:font-bold [&>strong]:text-white
                            [&>blockquote]:border-l-2 [&>blockquote]:border-slate-600 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-slate-400
                            [&>code]:bg-slate-900 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-xs [&>code]:text-indigo-300
                            [&>pre]:bg-slate-900 [&>pre]:p-2 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:mb-2 [&>pre]:text-xs
                            [&>a]:text-indigo-400 [&>a]:underline hover:[&>a]:text-indigo-300
                        `}
                    >
                        <Markdown>{msg.content}</Markdown>
                    </div>
                    
                    {/* Render Search Sources */}
                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs">
                            <p className="font-semibold text-slate-400 mb-2 flex items-center gap-1">
                            <Globe size={12} /> Sources
                            </p>
                            <div className="flex flex-col gap-1">
                            {msg.groundingChunks.map((chunk, idx) => chunk.web ? (
                                <a 
                                    key={idx} 
                                    href={chunk.web.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-indigo-500/50 text-indigo-300 hover:text-indigo-200 px-2 py-1.5 rounded transition-all truncate"
                                >
                                    <div className="w-1 h-1 bg-indigo-400 rounded-full shrink-0"></div>
                                    <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                                </a>
                            ) : null)}
                            </div>
                        </div>
                    )}
                    </div>

                    {/* Proposal Cards */}
                    {msg.proposals && msg.proposals.length > 0 && (
                        <div className="mt-2 space-y-2 w-full max-w-[85%]">
                            {msg.proposals.map(proposal => (
                                <div key={proposal.id} className="bg-slate-800 border border-indigo-500/30 rounded-xl p-3 shadow-lg flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                                        <Wrench size={12} />
                                        <span>Proposed Action</span>
                                    </div>
                                    <div className="text-white text-sm font-medium whitespace-pre-wrap leading-relaxed">
                                        {proposal.summary}
                                    </div>
                                    {/* Action Buttons */}
                                    {proposal.status === 'pending' && (
                                        <div className="flex gap-2 mt-1">
                                            <button 
                                                onClick={() => executeProposal(msg.id, proposal)}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <ThumbsUp size={12} /> Approve
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setMessages(prev => prev.map(m => {
                                                        if (m.id !== msg.id) return m;
                                                        return { ...m, proposals: m.proposals?.map(p => p.id === proposal.id ? { ...p, status: 'denied' } : p) };
                                                    }));
                                                }}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <ThumbsDown size={12} /> Deny
                                            </button>
                                        </div>
                                    )}
                                    {proposal.status === 'completed' && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 text-emerald-400 text-xs flex items-center gap-1 justify-center">
                                            <Check size={12} /> Approved & Done
                                        </div>
                                    )}
                                    {proposal.status === 'denied' && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-red-400 text-xs flex items-center gap-1 justify-center">
                                            <X size={12} /> Denied
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
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
                        {useThinkingModel ? 'Thinking deeply...' : 'Analyzing & Searching...'}
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
                    placeholder={useThinkingModel ? "Ask complex questions..." : "Ask questions or request changes (e.g. 'Add a rule for Uber')..."}
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