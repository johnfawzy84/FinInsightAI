import React, { useState, useMemo } from 'react';
import { Budget, Transaction, TransactionType, Goal } from '../types';
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
    Target,
    Settings2,
    Link,
    Lock
} from 'lucide-react';

interface BudgetManagerProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: string[];
  onUpdateBudgets: (updater: (budgets: Budget[]) => Budget[]) => void;
  goals: Goal[]; // Passed to allow linking to Pockets
  currency: string;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({ 
  budgets, 
  transactions, 
  categories, 
  onUpdateBudgets,
  goals,
  currency
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null); // For detailed edit

  const [newBudget, setNewBudget] = useState<Partial<Budget>>({
    category: '',
    limit: 0,
    period: 'monthly',
    linkedPocketId: ''
  });

  const pockets = useMemo(() => goals.filter(g => g.type === 'POCKET'), [goals]);

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
      // If linked to pocket, override the limit with pocket amount
      const linkedPocket = b.linkedPocketId ? pockets.find(p => p.id === b.linkedPocketId) : null;
      const effectiveLimit = linkedPocket ? linkedPocket.allocatedAmount : b.limit;

      return { ...b, spent, limit: effectiveLimit };
    });
  }, [budgets, transactions, pockets]);

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
    if (!newBudget.category || (newBudget.limit === undefined && !newBudget.linkedPocketId)) return;
    
    // Check if category already has a budget for this period
    const exists = budgets.some(b => b.category === newBudget.category && b.period === newBudget.period);
    if (exists) {
        alert("A budget for this category and period already exists.");
        return;
    }

    // If linked, limit is 0 (dynamic), otherwise user input
    const initialLimit = newBudget.linkedPocketId ? 0 : Number(newBudget.limit);

    onUpdateBudgets(prev => [...prev, {
      id: `budget-${Date.now()}`,
      category: newBudget.category!,
      limit: initialLimit,
      period: newBudget.period as any,
      linkedPocketId: newBudget.linkedPocketId
    }]);
    
    setIsAdding(false);
    setNewBudget({ category: '', limit: 0, period: 'monthly', linkedPocketId: '' });
  };

  const handleUpdate = (id: string, updates: Partial<Budget>) => {
    onUpdateBudgets(prev => prev.map(b => {
        if (b.id !== id) return b;
        // If unlinking, keep current limit. If linking, limit becomes irrelevant (handled dynamically)
        return { ...b, ...updates };
    }));
    setEditingId(null);
    setSettingsId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this budget?")) {
      onUpdateBudgets(prev => prev.filter(b => b.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                <Wallet className="text-primary" size={24} />
                Budget Limits
            </h2>
            <p className="text-sm text-textMuted">Track and control your spending limits.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
                onClick={handleProposeAI}
                disabled={isProposing}
                className="flex-1 sm:flex-none justify-center bg-secondary hover:bg-secondary/90 disabled:bg-surfaceHighlight text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-secondary/20"
            >
                {isProposing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                AI Propose
            </button>
            <button 
                onClick={() => setIsAdding(true)}
                className="flex-1 sm:flex-none justify-center bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
                <Plus size={16} /> New Budget
            </button>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="bg-surfaceHighlight p-6 rounded-xl border border-primary/30 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-textMain font-bold">Configure New Budget</h3>
                <button onClick={() => setIsAdding(false)} className="text-textMuted hover:text-textMain"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                    <label className="text-xs text-textMuted uppercase block mb-1">Category</label>
                    <select 
                        value={newBudget.category}
                        onChange={e => setNewBudget({...newBudget, category: e.target.value})}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-textMain focus:outline-none focus:border-primary"
                    >
                        <option value="">Select Category</option>
                        {categories.filter(c => c !== 'Income').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-textMuted uppercase block mb-1">Limit ({currency})</label>
                    <input 
                        type="number"
                        value={newBudget.limit || ''}
                        onChange={e => setNewBudget({...newBudget, limit: parseFloat(e.target.value)})}
                        disabled={!!newBudget.linkedPocketId}
                        className={`w-full bg-background border border-border rounded-lg px-3 py-2 text-textMain focus:outline-none focus:border-primary ${newBudget.linkedPocketId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={newBudget.linkedPocketId ? "Linked to Pocket" : "0.00"}
                    />
                </div>
                <div>
                    <label className="text-xs text-textMuted uppercase block mb-1">Period</label>
                    <select 
                        value={newBudget.period}
                        onChange={e => setNewBudget({...newBudget, period: e.target.value as any})}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-textMain focus:outline-none focus:border-primary"
                    >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-textMuted uppercase block mb-1">Link Pocket</label>
                    <select 
                        value={newBudget.linkedPocketId}
                        onChange={e => setNewBudget({...newBudget, linkedPocketId: e.target.value})}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-textMain focus:outline-none focus:border-primary"
                    >
                        <option value="">None (Manual Limit)</option>
                        {pockets.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button 
                    onClick={handleAdd}
                    disabled={!newBudget.category || (!newBudget.limit && !newBudget.linkedPocketId)}
                    className="bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight text-white px-6 py-2 rounded-lg font-bold transition-colors"
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
              const linkedPocket = budget.linkedPocketId ? pockets.find(p => p.id === budget.linkedPocketId) : null;

              return (
                  <div 
                    key={budget.id} 
                    className={`bg-surface rounded-xl border p-6 shadow-lg transition-all relative group ${
                        isOver ? 'border-danger/50 shadow-danger/10' : 'border-border'
                    }`}
                  >
                      {/* Detailed Settings Toggle Panel */}
                      {settingsId === budget.id && (
                          <div className="absolute inset-0 bg-background/95 z-20 p-4 rounded-xl flex flex-col justify-center animate-fade-in space-y-4">
                              <h4 className="text-sm font-bold text-textMain uppercase flex items-center gap-2"><Settings2 size={16}/> Budget Settings</h4>
                              <div>
                                  <label className="text-xs text-textMuted block mb-1">Source Pocket</label>
                                  <select 
                                    className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1 text-sm text-textMain focus:outline-none focus:border-primary"
                                    defaultValue={budget.linkedPocketId || ''}
                                    onChange={(e) => handleUpdate(budget.id, { linkedPocketId: e.target.value })}
                                  >
                                      <option value="">-- No linked pocket --</option>
                                      {pockets.map(p => <option key={p.id} value={p.id}>{p.icon} {p.title}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs text-textMuted block mb-1">Period</label>
                                  <select 
                                    className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1 text-sm text-textMain focus:outline-none focus:border-primary"
                                    defaultValue={budget.period}
                                    onChange={(e) => handleUpdate(budget.id, { period: e.target.value as any })}
                                  >
                                      <option value="monthly">Monthly</option>
                                      <option value="yearly">Yearly</option>
                                  </select>
                              </div>
                              <button onClick={() => setSettingsId(null)} className="bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain py-2 rounded-lg text-xs font-bold uppercase border border-border">Close</button>
                          </div>
                      )}

                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="font-bold text-textMain text-lg">{budget.category}</h3>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-textMuted uppercase tracking-widest font-bold">
                                    {budget.period} limit
                                </span>
                                {linkedPocket && (
                                    <span className="text-[10px] text-primary flex items-center gap-1">
                                        <Link size={10} /> Pocket: {linkedPocket.title}
                                    </span>
                                )}
                              </div>
                          </div>
                          <div className="flex items-center gap-1">
                                {editingId === budget.id && !linkedPocket ? (
                                    <div className="flex items-center gap-1">
                                        <input 
                                            autoFocus
                                            type="number"
                                            defaultValue={budget.limit}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdate(budget.id, { limit: parseFloat((e.target as HTMLInputElement).value) });
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            className="w-20 bg-background border border-primary rounded px-1 text-sm text-textMain focus:outline-none"
                                        />
                                        <button onClick={() => setEditingId(null)} className="text-textMuted hover:text-textMain"><X size={14}/></button>
                                    </div>
                                ) : (
                                    <>
                                        <button onClick={() => setSettingsId(budget.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-textMuted hover:text-primary rounded hover:bg-surfaceHighlight transition-all"><Settings2 size={14}/></button>
                                        {!linkedPocket && (
                                            <button onClick={() => setEditingId(budget.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-textMuted hover:text-textMain rounded hover:bg-surfaceHighlight transition-all"><Edit2 size={14}/></button>
                                        )}
                                        <button onClick={() => handleDelete(budget.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-textMuted hover:text-danger rounded hover:bg-surfaceHighlight transition-all"><Trash2 size={14}/></button>
                                    </>
                                )}
                          </div>
                      </div>

                      <div className="flex justify-between items-end mb-2">
                          <div>
                              <div className="text-2xl font-bold text-textMain font-mono">
                                  {currency}{budget.spent.toLocaleString()}
                              </div>
                              <div className="text-xs text-textMuted">Spent so far</div>
                          </div>
                          <div className="text-right">
                              <div className="text-sm font-semibold text-textMain flex items-center justify-end gap-1">
                                  of {currency}{budget.limit.toLocaleString()} {linkedPocket && <span title="Locked by Pocket Amount"><Lock size={10} className="text-textMuted" /></span>}
                              </div>
                              <div className={`text-xs font-bold ${isOver ? 'text-danger' : 'text-success'}`}>
                                  {isOver ? (
                                      <span className="flex items-center gap-1 justify-end"><TrendingUp size={12}/> Over by {currency}{Math.abs(remaining).toLocaleString()}</span>
                                  ) : (
                                      <span className="flex items-center gap-1 justify-end"><TrendingDown size={12}/> {currency}{remaining.toLocaleString()} left</span>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surfaceHighlight rounded-full h-2.5 overflow-hidden mb-1">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                                isOver ? 'bg-danger' : progress > 80 ? 'bg-amber-500' : 'bg-primary'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                      </div>
                      
                      {isOver && (
                          <div className="mt-2 text-[10px] text-danger font-bold flex items-center gap-1 animate-pulse">
                              <AlertCircle size={10}/> CATEGORY OVER BUDGET
                          </div>
                      )}
                      
                      {linkedPocket && (
                          <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-xs">
                              <span className="text-textMuted">Fund Source Available:</span>
                              <span className={`font-mono font-bold ${linkedPocket.allocatedAmount < budget.limit ? 'text-amber-400' : 'text-textMain'}`}>
                                  {currency}{linkedPocket.allocatedAmount.toLocaleString()}
                              </span>
                          </div>
                      )}
                  </div>
              );
          })}

          {budgets.length === 0 && !isAdding && (
              <div className="col-span-full border-2 border-dashed border-border rounded-2xl p-12 text-center text-textMuted">
                  <PieChart size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No budgets set up yet.</p>
                  <p className="text-sm mb-6">Use the buttons above to create budgets manually or let AI propose them.</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="text-primary hover:text-primary/80 font-bold underline"
                  >
                      Set your first budget
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};