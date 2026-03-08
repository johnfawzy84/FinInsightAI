import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Goal, Asset, Transaction, TransactionType } from '../types';
import { predictRecurringExpenses } from '../services/gemini';
import { Target, Plus, TrendingUp, AlertCircle, CheckCircle, BrainCircuit, X, Trash2, Calendar, Coins, AlertTriangle, Shield, Wallet, Info, ChevronDown, ChevronUp, Loader2, ArrowRight, Edit2, Save, ArrowUpRight, ArrowDownLeft, Link } from 'lucide-react';

interface GoalManagerProps {
  goals: Goal[];
  assets: Asset[];
  transactions: Transaction[];
  onUpdateGoals: (updater: (goals: Goal[]) => Goal[]) => void;
  currency: string;
}

export const GoalManager: React.FC<GoalManagerProps> = ({ goals, assets, transactions, onUpdateGoals, currency }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null); // Track if editing via Modal
  
  // Inline Editing State
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const defaultGoal: Partial<Goal> = {
    type: 'GOAL',
    title: '',
    targetAmount: 0,
    allocatedAmount: 0,
    targetDate: '',
    priority: 3,
    icon: '🎯',
    quickAdjustStep: 100,
    savingRule: { amount: 0, frequency: 'monthly' },
    linkedPocketId: ''
  };

  const [currentGoal, setCurrentGoal] = useState<Partial<Goal>>(defaultGoal);

  // Filter for available pockets
  const pockets = useMemo(() => goals.filter(g => g.type === 'POCKET'), [goals]);

  // AI State
  const [recurringData, setRecurringData] = useState<{ 
      total: number; 
      expectedIncome: number; 
      breakdown: { category: string; amount: number; reason: string; type: 'income' | 'expense' }[] 
  } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // --- AI Forecasting ---
  useEffect(() => {
      const fetchForecast = async () => {
          setIsLoadingAI(true);
          const result = await predictRecurringExpenses(transactions);
          setRecurringData(result);
          setIsLoadingAI(false);
      };
      if (transactions.length > 0) fetchForecast();
  }, [transactions.length]); 

  // --- Financial Context Calculations ---
  
  const totalLiquidAssets = useMemo(() => {
    return assets
      .filter(a => a.type === 'Cash' || a.type === 'Other')
      .reduce((sum, a) => sum + a.value, 0);
  }, [assets]);

  const allocatedTotal = goals.reduce((sum, g) => sum + g.allocatedAmount, 0);
  const unallocatedFunds = totalLiquidAssets - allocatedTotal;

  // Average Monthly Surplus
  const monthlySavingsRate = useMemo(() => {
    if (transactions.length === 0) return 0;
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const months = new Map<string, number>();
    sorted.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const curr = months.get(key) || 0;
      if (t.type === TransactionType.INCOME) months.set(key, curr + t.amount);
      else months.set(key, curr - t.amount);
    });
    if (months.size === 0) return 0;
    const totalSurplus = Array.from(months.values()).reduce((sum, val) => sum + val, 0);
    return totalSurplus / months.size;
  }, [transactions]);

  // Current Month Snapshot
  const currentMonthSnapshot = useMemo(() => {
      const now = new Date();
      const currentMonthTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const income = currentMonthTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
      const expenses = currentMonthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
      return { income, expenses, surplus: income - expenses };
  }, [transactions]);


  // --- Logic Handlers ---

  const openAddModal = () => {
      setEditingGoalId(null);
      setCurrentGoal(defaultGoal);
      setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
      setEditingGoalId(goal.id);
      setCurrentGoal({ ...goal });
      setIsModalOpen(true);
  };

  const handleSaveGoal = () => {
    if (!currentGoal.title || !currentGoal.targetAmount) return;
    
    const date = currentGoal.targetDate || (currentGoal.type === 'POCKET' ? '2030-01-01' : new Date().toISOString().split('T')[0]);

    if (editingGoalId) {
        // Update existing
        onUpdateGoals(prev => prev.map(g => g.id === editingGoalId ? {
            ...g,
            ...currentGoal,
            targetAmount: Number(currentGoal.targetAmount),
            allocatedAmount: Number(currentGoal.allocatedAmount),
            targetDate: date,
            priority: Number(currentGoal.priority),
            quickAdjustStep: Number(currentGoal.quickAdjustStep),
            // Ensure icons match type if not manually set (basic logic)
            icon: currentGoal.icon || (currentGoal.type === 'POCKET' ? '🛡️' : '🎯'),
            linkedPocketId: currentGoal.linkedPocketId
        } as Goal : g));
    } else {
        // Create new
        onUpdateGoals(prev => [...prev, {
            id: `goal-${Date.now()}`,
            type: currentGoal.type || 'GOAL',
            title: currentGoal.title!,
            targetAmount: Number(currentGoal.targetAmount),
            allocatedAmount: Number(currentGoal.allocatedAmount || 0),
            targetDate: date,
            priority: currentGoal.priority || 3,
            icon: currentGoal.icon || (currentGoal.type === 'POCKET' ? '🛡️' : '🎯'),
            quickAdjustStep: Number(currentGoal.quickAdjustStep || 100),
            savingRule: currentGoal.savingRule,
            linkedPocketId: currentGoal.linkedPocketId
        }]);
    }

    setIsModalOpen(false);
    setCurrentGoal(defaultGoal);
    setEditingGoalId(null);
  };

  const handleDeleteGoal = (id: string) => {
    if(confirm("Remove this item? Funds allocated to it will be returned to the general pool.")) {
      onUpdateGoals(prev => prev.filter(g => g.id !== id));
    }
  };

  const handleUpdateAllocation = (id: string, amount: number) => {
    const safeAmount = Math.max(0, amount);
    onUpdateGoals(prev => prev.map(g => g.id === id ? { ...g, allocatedAmount: safeAmount } : g));
  };

  const handleQuickAdjust = (id: string, delta: number) => {
      const goal = goals.find(g => g.id === id);
      if (!goal) return;
      handleUpdateAllocation(id, goal.allocatedAmount + delta);
  };

  // Inline Editing Handlers
  const startInlineEdit = (goal: Goal) => {
      setInlineEditingId(goal.id);
      setInlineValue(goal.allocatedAmount.toString());
      setTimeout(() => inlineInputRef.current?.focus(), 50);
  };

  const saveInlineEdit = () => {
      if (inlineEditingId) {
          const val = parseFloat(inlineValue);
          if (!isNaN(val)) {
              handleUpdateAllocation(inlineEditingId, val);
          }
      }
      setInlineEditingId(null);
  };

  // Enhanced Feasibility Logic
  const getFeasibilityStatus = (goal: Goal) => {
    if (goal.allocatedAmount >= goal.targetAmount) return { status: 'green', msg: 'Fully Funded' };
    
    // For pockets without a strict date, it's just a reserve
    if (goal.type === 'POCKET' && (!goal.targetDate || goal.targetDate === '2030-01-01')) {
        const pct = (goal.allocatedAmount / goal.targetAmount) * 100;
        return { status: 'blue', msg: `${pct.toFixed(0)}% Filled` }; 
    }

    const today = new Date();
    const target = new Date(goal.targetDate);
    // Months remaining
    const monthsAway = Math.max(0, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()));
    
    if (monthsAway === 0 && goal.allocatedAmount < goal.targetAmount) {
        return { status: 'red', msg: 'Target Date Reached' };
    }

    const deficit = goal.targetAmount - goal.allocatedAmount;
    
    // Determine "Monthly Power" for this goal
    let monthlyPower = 0;
    let method = 'surplus'; // 'rule' or 'surplus'

    // If there is a specific saving rule, use that as the primary predictor
    if (goal.savingRule && goal.savingRule.amount > 0 && goal.savingRule.frequency === 'monthly') {
        monthlyPower = goal.savingRule.amount;
        method = 'rule';
    } else {
        // Otherwise assume we use the general monthly surplus
        monthlyPower = monthlySavingsRate;
    }

    if (monthlyPower <= 0) return { status: 'red', msg: 'No projected savings' };

    const projectedTotal = goal.allocatedAmount + (monthlyPower * monthsAway);

    if (projectedTotal >= goal.targetAmount) {
        // It fits!
        return { status: 'green', msg: method === 'rule' ? 'On Track (Rule)' : 'Feasible (Surplus)' };
    } else {
        // Shortfall
        const shortfall = goal.targetAmount - projectedTotal;
        return { status: 'yellow', msg: `Shortfall -${currency}${shortfall.toLocaleString(undefined, {maximumFractionDigits:0})}` };
    }
  };

  // --- Renderers ---

  const renderGoalCard = (goal: Goal) => {
      const feasibility = getFeasibilityStatus(goal);
      const progress = Math.min(100, (goal.allocatedAmount / goal.targetAmount) * 100);
      const isExpanded = expandedCardId === goal.id;
      
      let statusColor = 'bg-textMuted';
      let borderColor = 'border-border';
      if (feasibility.status === 'green') { statusColor = 'bg-success'; borderColor = 'border-success/30'; }
      else if (feasibility.status === 'yellow') { statusColor = 'bg-amber-500'; borderColor = 'border-amber-500/30'; }
      else if (feasibility.status === 'red') { statusColor = 'bg-danger'; borderColor = 'border-danger/30'; }
      else if (feasibility.status === 'blue') { statusColor = 'bg-secondary'; borderColor = 'border-secondary/30'; }

      const linkedPocket = goal.linkedPocketId ? pockets.find(p => p.id === goal.linkedPocketId) : null;

      return (
        <div key={goal.id} className={`bg-surface rounded-xl border ${borderColor} p-6 shadow-lg relative group transition-all hover:border-opacity-100`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-3xl">{goal.icon}</div>
                    <div>
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            {goal.title}
                            <button 
                                onClick={(e) => { e.stopPropagation(); openEditModal(goal); }}
                                className="opacity-0 group-hover:opacity-100 text-textMuted hover:text-textMain transition-opacity p-1"
                                title="Edit Goal"
                            >
                                <Edit2 size={14} />
                            </button>
                        </h3>
                        <div className="flex flex-col gap-1 mt-1">
                            {goal.type === 'GOAL' && (
                                <span className="flex items-center gap-1 text-xs text-textMuted">
                                    <Calendar size={12}/> Target: {goal.targetDate}
                                </span>
                            )}
                            {goal.savingRule && goal.savingRule.amount > 0 && (
                                <span className="text-xs text-primary flex items-center gap-1">
                                    <TrendingUp size={12}/> Rule: Save {currency}{goal.savingRule.amount}/{goal.savingRule.frequency}
                                </span>
                            )}
                            {linkedPocket && (
                                <span className="text-xs text-primary flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 w-fit mt-1">
                                    <Link size={10}/> Linked to: {linkedPocket.icon} {linkedPocket.title}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-textMain">{currency}{goal.targetAmount.toLocaleString()}</div>
                    <div className={`text-xs font-bold ${feasibility.status === 'green' ? 'text-success' : 'text-textMuted'} ${feasibility.status === 'yellow' ? 'text-amber-400' : ''} ${feasibility.status === 'red' ? 'text-danger' : ''}`}>
                        {feasibility.msg}
                    </div>
                </div>
            </div>

            {/* Quick Actions (Always Visible) */}
            <div className="flex items-center justify-between gap-4 mb-4 bg-background/50 p-2 rounded-lg border border-border/50">
                 <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleQuickAdjust(goal.id, -(goal.quickAdjustStep || 100))}
                        className="w-8 h-8 rounded bg-surfaceHighlight hover:bg-danger/30 text-textMain hover:text-danger flex items-center justify-center font-bold text-lg transition-colors"
                    >
                        -
                    </button>
                    <div className="text-center min-w-[80px]">
                        <div className="text-xs text-textMuted uppercase font-bold">Allocated</div>
                        {inlineEditingId === goal.id ? (
                            <input 
                                ref={inlineInputRef}
                                type="number" 
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                                className="w-20 bg-surfaceHighlight border border-primary rounded px-1 py-0.5 text-center text-textMain font-mono font-bold text-sm focus:outline-none"
                            />
                        ) : (
                            <div 
                                onClick={() => startInlineEdit(goal)}
                                className="text-textMain font-mono font-bold hover:text-primary cursor-pointer border border-transparent hover:border-border rounded px-1"
                                title="Click to edit"
                            >
                                {currency}{goal.allocatedAmount.toLocaleString()}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => handleQuickAdjust(goal.id, (goal.quickAdjustStep || 100))}
                        className="w-8 h-8 rounded bg-surfaceHighlight hover:bg-success/30 text-textMain hover:text-success flex items-center justify-center font-bold text-lg transition-colors"
                    >
                        +
                    </button>
                 </div>
                 <div className="text-xs text-textMuted text-right">
                     Step: {currency}{goal.quickAdjustStep || 100}
                 </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-surfaceHighlight rounded-full h-2 overflow-hidden mb-2">
                <div className={`${statusColor} h-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
            </div>

            {/* Expander */}
            <div 
                className="flex justify-center -mb-2 cursor-pointer text-textMuted hover:text-textMain transition-colors"
                onClick={() => setExpandedCardId(isExpanded ? null : goal.id)}
            >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border animate-fade-in space-y-4">
                    {/* Full Slider */}
                    <div>
                        <label className="text-xs text-textMuted uppercase font-semibold mb-1 block">Precise Allocation {linkedPocket && '(Updates Pocket)'}</label>
                        <input 
                            type="range" 
                            min="0" 
                            max={Math.max(goal.targetAmount, goal.allocatedAmount + unallocatedFunds)} 
                            step="10"
                            value={goal.allocatedAmount}
                            onChange={(e) => handleUpdateAllocation(goal.id, Number(e.target.value))}
                            className="w-full h-2 bg-surfaceHighlight rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => openEditModal(goal)}
                            className="flex-1 py-2 flex items-center justify-center gap-2 bg-surfaceHighlight hover:bg-border text-textMain rounded-lg transition-colors text-sm"
                        >
                            <Edit2 size={14} /> Edit Details
                        </button>
                        <button 
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="flex-1 py-2 flex items-center justify-center gap-2 text-danger hover:bg-danger/10 rounded-lg transition-colors text-sm"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* --- Top Dashboard --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Liquid Assets */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-lg">
            <h3 className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">Liquid Savings Pool</h3>
            <div className="text-2xl font-bold text-textMain mb-1">{currency}{totalLiquidAssets.toLocaleString()}</div>
            <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border/50">
                <span className="text-textMuted">Unallocated</span>
                <span className={`font-mono font-bold ${unallocatedFunds < 0 ? 'text-danger' : 'text-success'}`}>
                    {currency}{unallocatedFunds.toLocaleString()}
                </span>
            </div>
        </div>

        {/* 2. Avg Surplus */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-lg relative group">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-textMuted text-xs font-semibold uppercase tracking-wider">Avg. Monthly Surplus</h3>
                <Info size={12} className="text-textMuted cursor-help" />
            </div>
            <div className={`text-2xl font-bold ${monthlySavingsRate >= 0 ? 'text-success' : 'text-danger'}`}>
                {currency}{monthlySavingsRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            
            {/* Tooltip */}
            <div className="absolute top-10 left-0 bg-background border border-border p-3 rounded-lg text-xs text-textMain w-64 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                Calculated by averaging your (Income - Expenses) over available history. This is your theoretical "saving power".
            </div>
        </div>

        {/* 3. Current Month Forecast */}
        <div className="bg-surface p-5 rounded-xl border border-border shadow-lg">
            <h3 className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">Current Month Forecast</h3>
            <div className="flex justify-between items-end mb-1">
                <span className="text-xs text-textMuted">Actual Surplus</span>
                <span className={`font-bold ${currentMonthSnapshot.surplus >= 0 ? 'text-textMain' : 'text-danger'}`}>{currency}{currentMonthSnapshot.surplus.toLocaleString()}</span>
            </div>
            {recurringData && (
                <div className="flex justify-between items-end text-xs pt-1 border-t border-border/50">
                    <span className="text-primary">Expected End</span>
                    <span className="font-mono">~{currency}{(currentMonthSnapshot.income - recurringData.total).toLocaleString()}</span>
                </div>
            )}
        </div>

        {/* 4. AI Monthly Baseline (Income vs Fixed Spend) */}
        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-5 rounded-xl border border-primary/30 shadow-lg relative overflow-hidden group">
             <div className="flex items-center gap-2 mb-2 text-primary">
                {isLoadingAI ? <Loader2 size={16} className="animate-spin"/> : <BrainCircuit size={16} />}
                <h3 className="text-xs font-bold uppercase tracking-wider">Monthly Baseline</h3>
             </div>
             {isLoadingAI ? (
                 <div className="text-xs text-textMuted">Analyzing recurring finances...</div>
             ) : recurringData ? (
                 <>
                    <div className="flex justify-between items-end mb-1">
                        <div>
                            <div className="text-xs text-textMuted">Fixed Spend</div>
                            <div className="text-lg font-bold text-danger">-{currency}{recurringData.total.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-textMuted">Exp. Income</div>
                            <div className="text-lg font-bold text-success">+{currency}{recurringData.expectedIncome.toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div className="pt-2 border-t border-primary/20 mt-1 flex justify-between items-center">
                        <span className="text-xs text-primary/80">Baseline Surplus:</span>
                        <span className={`font-bold ${recurringData.expectedIncome - recurringData.total >= 0 ? 'text-textMain' : 'text-danger'}`}>
                            {currency}{(recurringData.expectedIncome - recurringData.total).toLocaleString()}
                        </span>
                    </div>

                    {/* Hover Detail View */}
                    <div className="absolute inset-0 bg-background/95 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 overflow-y-auto">
                        <h4 className="text-xs font-bold text-textMain mb-2 uppercase border-b border-border pb-1">Predictions</h4>
                        <div className="space-y-2">
                            {recurringData.breakdown.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-textMuted">{item.category} ({item.reason})</span>
                                    <span className={`${item.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                        {item.type === 'income' ? '+' : '-'}{currency}{item.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                 </>
             ) : (
                 <div className="text-xs text-textMuted">Not enough data to predict.</div>
             )}
        </div>
      </div>

      {/* --- Action Bar --- */}
      <div className="flex justify-end">
         <button 
            onClick={openAddModal}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
        >
            <Plus size={18} /> New Pocket / Goal
        </button>
      </div>

      {/* --- POCKETS SECTION --- */}
      <div>
          <h2 className="text-lg font-bold text-textMain mb-4 flex items-center gap-2">
              <Shield className="text-secondary" size={20} /> Safety Pockets & Reserves
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {goals.filter(g => g.type === 'POCKET').map(renderGoalCard)}
              {goals.filter(g => g.type === 'POCKET').length === 0 && (
                  <div className="col-span-2 border-2 border-dashed border-border rounded-xl p-8 text-center text-textMuted">
                      Create a pocket for Emergency Funds, Taxes, or Maintenance.
                  </div>
              )}
          </div>
      </div>

      {/* --- GOALS SECTION --- */}
      <div className="pt-4 border-t border-border">
          <h2 className="text-lg font-bold text-textMain mb-4 flex items-center gap-2">
              <Target className="text-success" size={20} /> Savings Goals & Wishlist
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {goals.filter(g => g.type === 'GOAL').map(renderGoalCard)}
              {goals.filter(g => g.type === 'GOAL').length === 0 && (
                  <div className="col-span-2 border-2 border-dashed border-border rounded-xl p-8 text-center text-textMuted">
                      Add goals like Vacation, New Car, or Wedding.
                  </div>
              )}
          </div>
      </div>

      {/* --- Create / Edit Modal --- */}
      {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-textMain">{editingGoalId ? 'Edit Plan' : 'Create Savings Plan'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-textMuted hover:text-textMain"><X size={24}/></button>
                </div>
                
                <div className="space-y-5">
                    {/* Type Selector */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-surfaceHighlight rounded-lg">
                        <button 
                            onClick={() => setCurrentGoal({ ...currentGoal, type: 'POCKET', icon: '🛡️' })}
                            className={`py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${currentGoal.type === 'POCKET' ? 'bg-secondary text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                        >
                            <Shield size={16} /> Pocket (Reserve)
                        </button>
                        <button 
                            onClick={() => setCurrentGoal({ ...currentGoal, type: 'GOAL', icon: '🎯' })}
                            className={`py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${currentGoal.type === 'GOAL' ? 'bg-success text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                        >
                            <Target size={16} /> Goal (Purchase)
                        </button>
                    </div>

                    <div>
                        <label className="text-xs text-textMuted block mb-1">Title</label>
                        <input type="text" value={currentGoal.title} onChange={e => setCurrentGoal({...currentGoal, title: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 text-textMain focus:border-primary outline-none" placeholder={currentGoal.type === 'POCKET' ? "e.g. Emergency Fund" : "e.g. Hawaii Trip"}/>
                    </div>

                    {/* Linked Pocket (Only for Goals) */}
                    {currentGoal.type === 'GOAL' && (
                        <div>
                            <label className="text-xs text-textMuted block mb-1 flex items-center gap-1">
                                <Link size={12} /> Link to Pocket (Optional)
                            </label>
                            <select 
                                value={currentGoal.linkedPocketId || ''}
                                onChange={e => setCurrentGoal({...currentGoal, linkedPocketId: e.target.value})}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-textMain focus:border-primary outline-none text-sm"
                            >
                                <option value="">-- No linked pocket --</option>
                                {pockets.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.icon} {p.title} (Available: {currency}{p.allocatedAmount.toLocaleString()})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-textMuted mt-1">
                                Link this goal to a specific reserve (e.g. 'Vacation Fund') to track funding source.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-textMuted block mb-1">Target Amount</label>
                            <input type="number" value={currentGoal.targetAmount || ''} onChange={e => setCurrentGoal({...currentGoal, targetAmount: Number(e.target.value)})} className="w-full bg-background border border-border rounded px-3 py-2 text-textMain focus:border-primary outline-none" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="text-xs text-textMuted block mb-1">{currentGoal.type === 'POCKET' ? 'Review Date (Optional)' : 'Target Date'}</label>
                            <input type="date" value={currentGoal.targetDate} onChange={e => setCurrentGoal({...currentGoal, targetDate: e.target.value})} className="w-full bg-background border border-border rounded px-3 py-2 text-textMain focus:border-primary outline-none"/>
                        </div>
                    </div>

                    {/* Advanced Config */}
                    <div className="bg-surfaceHighlight/50 p-4 rounded-xl border border-border space-y-4">
                        <h4 className="text-xs font-bold text-textMain uppercase tracking-wider mb-2">Configuration</h4>
                        
                        <div className="flex gap-4">
                             <div className="flex-1">
                                <label className="text-xs text-textMuted block mb-1">Quick Adjust Step (+/-)</label>
                                <input type="number" value={currentGoal.quickAdjustStep} onChange={e => setCurrentGoal({...currentGoal, quickAdjustStep: Number(e.target.value)})} className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-textMain focus:border-primary outline-none"/>
                             </div>
                             <div className="flex-1">
                                <label className="text-xs text-textMuted block mb-1">Priority</label>
                                <select value={currentGoal.priority} onChange={e => setCurrentGoal({...currentGoal, priority: Number(e.target.value)})} className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-textMain focus:border-primary outline-none">
                                    {[1,2,3,4,5].map(p => <option key={p} value={p}>{p} {p===5?'(Critical)':''}</option>)}
                                </select>
                             </div>
                        </div>

                        <div>
                            <label className="text-xs text-textMuted block mb-1">Saving Rule (Monthly)</label>
                            <div className="flex items-center gap-2">
                                <span className="text-textMuted text-sm">Save {currency}</span>
                                <input 
                                    type="number" 
                                    value={currentGoal.savingRule?.amount || 0} 
                                    onChange={e => setCurrentGoal({...currentGoal, savingRule: { amount: Number(e.target.value), frequency: 'monthly' } })} 
                                    className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-textMain focus:border-primary outline-none"
                                />
                                <span className="text-textMuted text-sm">/ month</span>
                            </div>
                            <p className="text-[10px] text-textMuted mt-1">
                                This rule helps predict if you'll reach your goal on time.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain rounded-xl font-medium transition-colors">Cancel</button>
                    <button onClick={handleSaveGoal} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2">
                        {editingGoalId ? <Save size={18} /> : <Plus size={18} />} 
                        {editingGoalId ? 'Save Changes' : 'Create'}
                    </button>
                </div>
            </div>
            </div>
      )}
    </div>
  );
};