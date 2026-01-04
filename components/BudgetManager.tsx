
import React, { useState, useMemo } from 'react';
import { Budget, Transaction, TransactionType } from '../types';
import { proposeBudgetsAI } from '../services/gemini';
import { 
    Wallet, 
    Plus, 
    TrendingUp, 
    TrendingDown, 
    BrainCircuit, 
    Loader2, 
    Edit2, 
    Trash2, 
    Check, 
    X, 
    AlertCircle, 
    Sparkles, 
    PieChart, 
    Target
} from 'lucide-react';

interface BudgetManagerProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: string[];
  onUpdateBudgets: (updater: (budgets: Budget[]) => Budget[]) => void;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({ 
  budgets, 
  transactions, 
  categories, 
  onUpdateBudgets 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newBudget, setNewBudget] = useState<Partial<Budget>>({
    category: '',
    limit: 0,
    period: 'monthly'
  });

  // Calculate consumption for each budget based on the current period
  const budgetsWithSpent = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return budgets.map(b => {
      const filtered = transactions.filter(t => {
        if (t.type !== TransactionType.EXPENSE || t.category !== b.category) return false;
        
        const tDate = new Date(t.date);
        if (b.period === 'monthly') {
          return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        } else {
          return tDate.getFullYear() === currentYear;
        }
      });

      const spent = filtered.reduce((sum, t) => sum + t.amount, 0);
      return { ...b, spent };
    });
  }, [budgets, transactions]);

  const handleProposeAI = async () => {
    setIsProposing(true);
    try {
      const proposals = await proposeBudgetsAI(transactions, categories);
      if (proposals.length > 0) {
        if (confirm(`AI proposed ${proposals.length} budget limits based on your history. Apply them? (This will overwrite existing budgets for the same categories)`)) {
          onUpdateBudgets(prev => {
            const updated = [...prev];
            proposals.forEach(p => {
              const existingIdx = updated.findIndex(eb => eb.category === p.category && eb.period === p.period);
              if (existingIdx >= 0) {
                updated[existingIdx] = { ...updated[existingIdx], limit: p.limit! };
              } else {
                updated.push({ id: `budget-${Date.now()}-${Math.random()}`, ...p } as Budget);
              }
            });
            return updated;
          });
        }
      } else {
        alert("Not enough data to propose budgets yet.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProposing(false);
    }
  };

  const handleAdd = () => {
    if (!newBudget.category || !newBudget.limit) return;
    
    // Check if category already has a budget for this period
    const exists = budgets.some(b => b.category === newBudget.category && b.period === newBudget.period);
    if (exists) {
        alert("A budget for this category and period already exists.");
        return;
    }

    onUpdateBudgets(prev => [...prev, {
      id: `budget-${Date.now()}`,
      category: newBudget.category!,
      limit: Number(newBudget.limit),
      period: newBudget.period as any
    }]);
    
    setIsAdding(false);
    setNewBudget({ category: '', limit: 0, period: 'monthly' });
  };

  const handleUpdate = (id: string, limit: number) => {
    onUpdateBudgets(prev => prev.map(b => b.id === id ? { ...b, limit } : b));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this budget?")) {
      onUpdateBudgets(prev => prev.filter(b => b.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-indigo-400" size={24} />
                Budget Limits
            </h2>
            <p className="text-sm text-slate-500">Track and control your spending limits.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleProposeAI}
                disabled={isProposing}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
            >
                {isProposing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                AI Propose Budgets
            </button>
            <button 
                onClick={() => setIsAdding(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
            >
                <Plus size={16} /> New Budget
            </button>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500/30 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Configure New Budget</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 uppercase block mb-1">Category</label>
                    <select 
                        value={newBudget.category}
                        onChange={e => setNewBudget({...newBudget, category: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                        <option value="">Select Category</option>
                        {categories.filter(c => c !== 'Income').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 uppercase block mb-1">Limit ($)</label>
                    <input 
                        type="number"
                        value={newBudget.limit || ''}
                        onChange={e => setNewBudget({...newBudget, limit: parseFloat(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500 uppercase block mb-1">Period</label>
                    <select 
                        value={newBudget.period}
                        onChange={e => setNewBudget({...newBudget, period: e.target.value as any})}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button 
                    onClick={handleAdd}
                    disabled={!newBudget.category || !newBudget.limit}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold"
                >
                    Create Budget
                </button>
            </div>
        </div>
      )}

      {/* Grid of Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgetsWithSpent.map(budget => {
              const progress = Math.min(100, (budget.spent / budget.limit) * 100);
              const isOver = budget.spent > budget.limit;
              const remaining = budget.limit - budget.spent;

              return (
                  <div 
                    key={budget.id} 
                    className={`bg-surface rounded-xl border p-6 shadow-lg transition-all relative group ${
                        isOver ? 'border-red-500/50 shadow-red-500/10' : 'border-slate-700'
                    }`}
                  >
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="font-bold text-white text-lg">{budget.category}</h3>
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                  {budget.period} limit
                              </span>
                          </div>
                          <div className="flex items-center gap-1">
                                {editingId === budget.id ? (
                                    <div className="flex items-center gap-1">
                                        <input 
                                            autoFocus
                                            type="number"
                                            defaultValue={budget.limit}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdate(budget.id, parseFloat((e.target as HTMLInputElement).value));
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            className="w-20 bg-slate-900 border border-indigo-500 rounded px-1 text-sm text-white"
                                        />
                                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white"><X size={14}/></button>
                                    </div>
                                ) : (
                                    <>
                                        <button onClick={() => setEditingId(budget.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-700 transition-all"><Edit2 size={14}/></button>
                                        <button onClick={() => handleDelete(budget.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-700 transition-all"><Trash2 size={14}/></button>
                                    </>
                                )}
                          </div>
                      </div>

                      <div className="flex justify-between items-end mb-2">
                          <div>
                              <div className="text-2xl font-bold text-white font-mono">
                                  ${budget.spent.toLocaleString()}
                              </div>
                              <div className="text-xs text-slate-400">Spent so far</div>
                          </div>
                          <div className="text-right">
                              <div className="text-sm font-semibold text-slate-300">
                                  of ${budget.limit.toLocaleString()}
                              </div>
                              <div className={`text-xs font-bold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {isOver ? (
                                      <span className="flex items-center gap-1 justify-end"><TrendingUp size={12}/> Over by ${Math.abs(remaining).toLocaleString()}</span>
                                  ) : (
                                      <span className="flex items-center gap-1 justify-end"><TrendingDown size={12}/> ${remaining.toLocaleString()} left</span>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden mb-1">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                                isOver ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                      </div>
                      
                      {isOver && (
                          <div className="mt-2 text-[10px] text-red-400 font-bold flex items-center gap-1 animate-pulse">
                              <AlertCircle size={10}/> CATEGORY OVER BUDGET
                          </div>
                      )}
                  </div>
              );
          })}

          {budgets.length === 0 && !isAdding && (
              <div className="col-span-full border-2 border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-600">
                  <PieChart size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No budgets set up yet.</p>
                  <p className="text-sm mb-6">Use the buttons above to create budgets manually or let AI propose them.</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline"
                  >
                      Set your first budget
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};
