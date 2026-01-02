import React, { useState, useMemo } from 'react';
import { Goal, Asset, Transaction, TransactionType } from '../types';
import { Target, Plus, TrendingUp, AlertCircle, CheckCircle, BrainCircuit, X, Trash2, Calendar, Coins, AlertTriangle } from 'lucide-react';

interface GoalManagerProps {
  goals: Goal[];
  assets: Asset[];
  transactions: Transaction[];
  onUpdateGoals: (updater: (goals: Goal[]) => Goal[]) => void;
}

export const GoalManager: React.FC<GoalManagerProps> = ({ goals, assets, transactions, onUpdateGoals }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({
    title: '',
    targetAmount: 0,
    allocatedAmount: 0,
    targetDate: '',
    priority: 3,
    icon: '🎯'
  });

  // --- Financial Context Calculations ---
  
  // 1. Total Liquid Assets (Cash-like)
  const totalLiquidAssets = useMemo(() => {
    return assets
      .filter(a => a.type === 'Cash' || a.type === 'Other')
      .reduce((sum, a) => sum + a.value, 0);
  }, [assets]);

  const allocatedTotal = goals.reduce((sum, g) => sum + g.allocatedAmount, 0);
  const unallocatedFunds = totalLiquidAssets - allocatedTotal;

  // 2. Average Monthly Savings Rate (Last 6 months)
  const monthlySavingsRate = useMemo(() => {
    if (transactions.length === 0) return 0;
    
    // Sort transactions
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Group by month YYYY-MM
    const months = new Map<string, number>();
    sorted.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const curr = months.get(key) || 0;
      if (t.type === TransactionType.INCOME) months.set(key, curr + t.amount);
      else months.set(key, curr - t.amount);
    });

    if (months.size === 0) return 0;

    // Average the surplus
    const totalSurplus = Array.from(months.values()).reduce((sum, val) => sum + val, 0);
    return totalSurplus / months.size; // Simple average
  }, [transactions]);


  // --- Logic Handlers ---

  const handleAddGoal = () => {
    if (!newGoal.title || !newGoal.targetAmount || !newGoal.targetDate) return;
    
    onUpdateGoals(prev => [...prev, {
      id: `goal-${Date.now()}`,
      title: newGoal.title!,
      targetAmount: Number(newGoal.targetAmount),
      allocatedAmount: Number(newGoal.allocatedAmount || 0),
      targetDate: newGoal.targetDate!,
      priority: newGoal.priority || 3,
      icon: newGoal.icon || '🎯'
    }]);
    setIsAdding(false);
    setNewGoal({ title: '', targetAmount: 0, targetDate: '', priority: 3, icon: '🎯' });
  };

  const handleDeleteGoal = (id: string) => {
    if(confirm("Remove this goal? Funds allocated to it will be returned to the general pool.")) {
      onUpdateGoals(prev => prev.filter(g => g.id !== id));
    }
  };

  const handleUpdateAllocation = (id: string, amount: number) => {
    // Prevent allocating more than available (logic check happens in UI feedback too)
    // We allow "virtual" over-allocation in the simulator to show red flags, 
    // but strict enforcement might be better. Let's strict enforce max liquid limit total.
    
    const otherGoalsAllocated = goals.filter(g => g.id !== id).reduce((sum, g) => sum + g.allocatedAmount, 0);
    const maxAvailable = totalLiquidAssets - otherGoalsAllocated;
    
    // Clamp
    const safeAmount = Math.max(0, Math.min(amount, maxAvailable));
    
    onUpdateGoals(prev => prev.map(g => g.id === id ? { ...g, allocatedAmount: safeAmount } : g));
  };

  const handleSmartDistribute = () => {
    // 1. Sort goals by Priority (Desc), then by Date (Asc)
    const sortedGoals = [...goals].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

    let remainingLiquid = totalLiquidAssets;
    const newAllocations = new Map<string, number>();

    // 2. Fill buckets
    sortedGoals.forEach(g => {
      const needed = g.targetAmount;
      const take = Math.min(needed, remainingLiquid);
      newAllocations.set(g.id, take);
      remainingLiquid -= take;
    });

    // 3. Update state
    onUpdateGoals(prev => prev.map(g => ({
      ...g,
      allocatedAmount: newAllocations.get(g.id) || 0
    })));
  };

  const getFeasibilityStatus = (goal: Goal) => {
    if (goal.allocatedAmount >= goal.targetAmount) return { status: 'green', msg: 'Fully Funded' };

    const today = new Date();
    const target = new Date(goal.targetDate);
    const monthsAway = Math.max(0, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()));
    
    // How much more needed?
    const deficit = goal.targetAmount - goal.allocatedAmount;

    // Can we save that much in time?
    // We assume the monthly savings rate is available for *all* unfunded goals. 
    // This is a naive simulator: it checks if THIS goal can be met with the FULL savings rate.
    // A robust engine would split the savings rate across concurrent goals.
    
    // Logic: If (Savings Rate * Months) > Deficit -> Yellow (On Track via savings)
    // Else -> Red (Shortfall)
    
    if (monthlySavingsRate <= 0) return { status: 'red', msg: 'No monthly surplus' };
    
    if ((monthlySavingsRate * monthsAway) >= deficit) {
      return { status: 'yellow', msg: `On track (${Math.ceil(deficit/monthlySavingsRate)} mo)` };
    }
    
    return { status: 'red', msg: 'Projected Shortfall' };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* --- Simulation Dashboard --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Pool */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Liquid Savings Pool</h3>
                <div className="text-3xl font-bold text-white">${totalLiquidAssets.toLocaleString()}</div>
                <p className="text-xs text-slate-500 mt-1">From Cash & 'Other' Assets</p>
            </div>
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Allocated</span>
                    <span className="text-white font-mono">${allocatedTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Unallocated</span>
                    <span className={`font-mono font-bold ${unallocatedFunds < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ${unallocatedFunds.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>

        {/* Savings Rate */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Avg. Monthly Surplus</h3>
                <div className={`text-3xl font-bold ${monthlySavingsRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${monthlySavingsRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">Based on recent income vs expenses</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-indigo-300 bg-indigo-500/10 p-2 rounded border border-indigo-500/20 text-xs">
                <TrendingUp size={16} />
                <span>Positive cash flow powers your goals.</span>
            </div>
        </div>

        {/* Action Panel */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 rounded-xl border border-indigo-500/30 flex flex-col justify-center gap-3">
             <div className="flex items-center gap-2 text-white font-bold text-lg mb-1">
                <BrainCircuit className="text-purple-400" />
                <span>AI Auto-Allocator</span>
             </div>
             <p className="text-xs text-indigo-200 mb-2">Automatically distribute your liquid savings to goals based on priority (1-5) and urgency.</p>
             <button 
                onClick={handleSmartDistribute}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
             >
                <Coins size={18} /> Smart Distribute
             </button>
        </div>
      </div>


      {/* --- Goal Cards Grid --- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="text-emerald-400" /> Your Wishlist
            </h2>
            <button 
                onClick={() => setIsAdding(true)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
            >
                <Plus size={16} /> Add Goal
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {goals.map(goal => {
                const feasibility = getFeasibilityStatus(goal);
                const progress = Math.min(100, (goal.allocatedAmount / goal.targetAmount) * 100);
                
                let statusColor = 'bg-red-500';
                let statusIcon = <AlertTriangle size={16} className="text-red-400" />;
                let borderColor = 'border-red-500/30';
                
                if (feasibility.status === 'green') {
                    statusColor = 'bg-emerald-500';
                    statusIcon = <CheckCircle size={16} className="text-emerald-400" />;
                    borderColor = 'border-emerald-500/30';
                } else if (feasibility.status === 'yellow') {
                    statusColor = 'bg-amber-500';
                    statusIcon = <AlertCircle size={16} className="text-amber-400" />;
                    borderColor = 'border-amber-500/30';
                }

                return (
                    <div key={goal.id} className={`bg-surface rounded-xl border ${borderColor} p-6 shadow-lg relative group transition-all hover:border-indigo-500/30`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">{goal.icon}</div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{goal.title}</h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="flex items-center gap-1"><Calendar size={12}/> {goal.targetDate}</span>
                                        <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">P{goal.priority}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-white">${goal.targetAmount.toLocaleString()}</div>
                                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${feasibility.status === 'green' ? 'text-emerald-400' : feasibility.status === 'yellow' ? 'text-amber-400' : 'text-red-400'}`}>
                                    {statusIcon} {feasibility.msg}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2 flex justify-between text-xs text-slate-400">
                            <span>Allocated: ${goal.allocatedAmount.toLocaleString()}</span>
                            <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mb-6">
                            <div 
                                className={`${statusColor} h-full transition-all duration-500`} 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>

                        {/* Allocation Simulation Slider */}
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <label className="text-xs text-slate-500 uppercase font-semibold mb-2 block">Allocate Funds (Simulator)</label>
                            <input 
                                type="range" 
                                min="0" 
                                max={Math.max(goal.targetAmount, goal.allocatedAmount + unallocatedFunds)} 
                                step="50"
                                value={goal.allocatedAmount}
                                onChange={(e) => handleUpdateAllocation(goal.id, Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-2"
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">$0</span>
                                <input 
                                    type="number"
                                    value={goal.allocatedAmount}
                                    onChange={(e) => handleUpdateAllocation(goal.id, Number(e.target.value))}
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white text-right w-24 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="absolute top-4 right-4 p-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                );
            })}
        </div>

        {/* Add Goal Modal (Inline for simplicity) */}
        {isAdding && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Add New Goal</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Goal Title</label>
                            <input type="text" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none" placeholder="e.g. Dream Vacation"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Target Amount</label>
                                <input type="number" value={newGoal.targetAmount || ''} onChange={e => setNewGoal({...newGoal, targetAmount: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none" placeholder="0.00"/>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Target Date</label>
                                <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Priority (1-5)</label>
                                <select value={newGoal.priority} onChange={e => setNewGoal({...newGoal, priority: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none">
                                    {[1,2,3,4,5].map(p => <option key={p} value={p}>{p} {p === 5 ? '(Critical)' : p === 1 ? '(Low)' : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Icon</label>
                                <input type="text" value={newGoal.icon} onChange={e => setNewGoal({...newGoal, icon: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none" placeholder="e.g. 🏠"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setIsAdding(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancel</button>
                        <button onClick={handleAddGoal} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Create Goal</button>
                    </div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
};