import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  Sankey, Tooltip as RechartsTooltip, 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
  Sector
} from 'recharts';
import { Transaction, TransactionType, Asset } from '../types';
import { AssetManagerModal } from './AssetManagerModal';
import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart as PieIcon, Layers, Activity, Edit2 } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  assets: Asset[];
  onUpdateAssets: (updater: (assets: Asset[]) => Asset[]) => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
        <p className="text-slate-200 text-sm font-medium mb-1">{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || entry.fill }}>
            {entry.name}: <span className="font-bold font-mono">${entry.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, assets, onUpdateAssets }) => {
  // Date State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // UI State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  // Quick Select Handler
  const setQuickRange = (months: number | 'YTD' | 'ALL') => {
    const end = new Date();
    let start = new Date();
    
    if (months === 'ALL') {
        // Find earliest transaction
        if (transactions.length > 0) {
            const earliest = transactions.reduce((a, b) => a.date < b.date ? a : b);
            start = new Date(earliest.date);
        } else {
            start.setFullYear(end.getFullYear() - 1);
        }
    } else if (months === 'YTD') {
        start = new Date(end.getFullYear(), 0, 1);
    } else {
        start.setMonth(end.getMonth() - months);
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // --- Filter Data by Date Range ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);

  // --- 1. Net Worth Trend (Back-calculation) ---
  const netWorthData = useMemo(() => {
    // Current Total Wealth
    const currentWealth = assets.reduce((sum, a) => sum + a.value, 0);
    
    // Sort all transactions desc to walk backwards
    const allSorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Create daily points from today backwards to start of time (or reasonably far)
    // Map: Date -> NetWorth at end of that day
    const trendMap = new Map<string, number>();
    let runningWealth = currentWealth;
    
    // We walk backwards. 
    // Wealth(Yesterday) = Wealth(Today) - Income(Today) + Expense(Today)
    
    // We need points for every day in the requested range + some buffer? 
    // Actually, let's just generate points for every transaction date, plus today.
    
    const todayStr = new Date().toISOString().split('T')[0];
    trendMap.set(todayStr, runningWealth);

    // Group transactions by date
    const txByDate = new Map<string, { income: number, expense: number }>();
    allSorted.forEach(t => {
        const curr = txByDate.get(t.date) || { income: 0, expense: 0 };
        if (t.type === TransactionType.INCOME) curr.income += t.amount;
        else curr.expense += t.amount;
        txByDate.set(t.date, curr);
    });

    // Get all unique dates from transactions + today, sorted DESC
    const dates = Array.from(new Set([todayStr, ...allSorted.map(t => t.date)])).sort().reverse();
    
    dates.forEach((date, i) => {
        if (i > 0) {
            // Calculate wealth at END of previous date (which is next in sorted DESC list)
            // But actually we are iterating backwards in time.
            // runningWealth is currently at 'date'. 
            // To get to 'prevDate' (tomorrow in list, yesterday in time), we undo the flow of 'date'.
            // Wait, iterating DESC (Today -> Past).
            
            // Loop starts at Today. runningWealth = Current.
            // Move to yesterday. 
            // Wealth(Yesterday) = Wealth(Today) - Income(Today) + Expense(Today)
            
            // We need to adjust runningWealth based on transactions of the *previous loop date*? 
            // No, strictly: Wealth(Start of Day X) = Wealth(End of Day X) - Income(X) + Expense(X)
            // Wealth(End of Day X-1) = Wealth(Start of Day X)
            
            // So:
            // 1. We have Wealth(End of Date[i])
            // 2. Adjust for transactions on Date[i] to get Wealth(Start of Date[i])
            // 3. This equals Wealth(End of Date[i+1]) -- where i+1 is the previous day chronologically
            
            const flow = txByDate.get(date) || { income: 0, expense: 0 };
            runningWealth = runningWealth - flow.income + flow.expense;
            
            // This 'runningWealth' is now the balance at the end of the day BEFORE 'date'.
            // We need to look ahead to what the next date in our list is to record it?
            // Actually, simplified: just record the value for the *next* date in the array (which is further in past).
        }
        
        // However, gaps in dates need to be filled or handled by chart line.
        // Let's just store the point we just calculated for the day BEFORE the current date being processed.
        // Actually, easier:
        // Iterate dates DESC. 
        // For 'date', we know End Balance.
        // We calculate Start Balance = End - Income + Expense.
        // Start Balance of 'date' is End Balance of 'date - 1'.
    });

    // Re-do Logic strictly:
    const dataPoints: { date: string, value: number }[] = [];
    let cursorWealth = currentWealth;
    
    // We need a continuous timeline from End Date back to Start Date
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const todayObj = new Date();
    
    // Adjust endObj to be at least today if we want to show current balance
    const effectiveEnd = endObj > todayObj ? endObj : todayObj;
    
    // Generate array of dates from Effective End down to Start
    const dateArray: string[] = [];
    for (let d = new Date(effectiveEnd); d >= startObj; d.setDate(d.getDate() - 1)) {
        dateArray.push(d.toISOString().split('T')[0]);
    }

    dateArray.forEach(d => {
        // Record End of Day Balance
        dataPoints.push({ date: d, value: cursorWealth });
        
        // Undo transactions of this day to prep for yesterday
        const flow = txByDate.get(d) || { income: 0, expense: 0 };
        cursorWealth = cursorWealth - flow.income + flow.expense;
    });

    return dataPoints.reverse(); // Return ASC for chart
  }, [transactions, assets, startDate, endDate]);


  // --- 2. Cash Flow (Monthly Bar Chart) ---
  const cashFlowData = useMemo(() => {
    const grouped = new Map<string, { income: number; expense: number }>();
    
    filteredTransactions.forEach(t => {
      // Format YYYY-MM
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const current = grouped.get(key) || { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) current.income += t.amount;
      else current.expense += t.amount;
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions]);

  // --- 3. Spending Breakdown (Donut) ---
  const spendingData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE);
    const grouped = new Map<string, number>();
    
    expenses.forEach(t => {
      const current = grouped.get(t.category) || 0;
      grouped.set(t.category, current + t.amount);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const totalSpent = spendingData.reduce((acc, curr) => acc + curr.value, 0);

  // --- 4. Sankey Data ---
  const sankeyData = useMemo(() => {
    // Nodes: 0 = Income, 1 = Surplus (if any), 2..N = Categories
    const incomeTotal = filteredTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Get top expense categories
    const expenseCats = spendingData.slice(0, 6); // Limit to top 6 to keep sankey clean
    const otherExpense = spendingData.slice(6).reduce((sum, t) => sum + t.value, 0);
    
    const totalExpense = totalSpent;
    const surplus = Math.max(0, incomeTotal - totalExpense);

    const nodes = [
      { name: 'Income' },
      ...expenseCats.map(c => ({ name: c.name })),
    ];
    
    if (otherExpense > 0) nodes.push({ name: 'Other' });
    if (surplus > 0) nodes.push({ name: 'Savings' });

    const links = [];
    
    // Link Income to Categories
    expenseCats.forEach((cat, idx) => {
      links.push({ source: 0, target: idx + 1, value: cat.value });
    });

    if (otherExpense > 0) {
        links.push({ source: 0, target: expenseCats.length + 1, value: otherExpense });
    }

    if (surplus > 0) {
        links.push({ source: 0, target: nodes.length - 1, value: surplus });
    }

    // Safety: If total expenses > total income, Recharts sankey can glitch. 
    if (incomeTotal === 0 && totalExpense > 0) {
       nodes[0].name = "Capital";
    }

    return { nodes, links };
  }, [filteredTransactions, spendingData, totalSpent]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Asset Manager Modal */}
      {isAssetModalOpen && (
        <AssetManagerModal 
            assets={assets} 
            onUpdateAssets={onUpdateAssets} 
            onClose={() => setIsAssetModalOpen(false)} 
        />
      )}

      {/* Date Range Selector */}
      <div className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
           <Calendar size={20} className="text-indigo-400" />
           <span>Analysis Period</span>
        </div>
        
        <div className="flex items-center gap-2">
            <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            />
            <span className="text-slate-500">-</span>
             <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            />
        </div>

        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          {[
            { label: '1M', val: 1 },
            { label: '3M', val: 3 }, 
            { label: '6M', val: 6 },
            { label: 'YTD', val: 'YTD' }, 
            { label: 'ALL', val: 'ALL' }
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => setQuickRange(opt.val as any)}
              className="px-3 py-1 text-xs font-medium rounded-md transition-all text-slate-400 hover:text-white hover:bg-slate-700"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Net Worth & Asset Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Net Worth Trend */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-slate-700 shadow-lg min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
             <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={20}/>
                    Net Worth Trend
                </h3>
                <p className="text-xs text-slate-500">Wealth evolution based on cash flow + assets</p>
             </div>
             <div className="text-right">
                <p className="text-2xl font-bold text-white">
                    ${(netWorthData[netWorthData.length - 1]?.value || 0).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-400">Current Estimate</p>
             </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={netWorthData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={10} 
                tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                minTickGap={40}
              />
              <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Asset Allocation (Pie) */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg min-h-[350px] flex flex-col">
            <div className="mb-4 flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <PieIcon className="text-purple-400" size={20}/>
                        Assets
                    </h3>
                    <p className="text-xs text-slate-500">Portfolio Distribution</p>
                </div>
                <button 
                    onClick={() => setIsAssetModalOpen(true)}
                    className="p-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-lg transition-all"
                    title="Manage Assets"
                >
                    <Edit2 size={16} />
                </button>
            </div>
            {assets.length > 0 ? (
                <div className="flex-1 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={assets as any[]}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                dataKey="value"
                            >
                                {assets.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs text-slate-400">Total</span>
                        <span className="text-lg font-bold text-white">
                            ${assets.reduce((sum, a) => sum + a.value, 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
                    <p className="text-sm">No assets added.</p>
                    <button onClick={() => setIsAssetModalOpen(true)} className="text-xs text-indigo-400 underline">Add Assets</button>
                </div>
            )}
        </div>
      </div>

      {/* Row 2: Cash Flow & Spending Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Cash Flow Bars */}
          <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
             <div className="mb-6 flex justify-between items-end">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-indigo-400" size={20}/>
                        Cash Flow
                    </h3>
                    <p className="text-xs text-slate-500">Monthly Income vs Expenses</p>
                </div>
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Income
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div> Expenses
                    </div>
                </div>
             </div>
             <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
             </ResponsiveContainer>
          </div>

          {/* Spending Donut */}
          <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
             <div className="mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="text-amber-400" size={20}/>
                    Spending Categories
                </h3>
                <p className="text-xs text-slate-500">Distribution of expenses</p>
             </div>
             {spendingData.length > 0 ? (
                <div className="flex-1 flex items-center gap-4">
                    <div className="w-1/2 h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={spendingData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {spendingData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-slate-400">Total Spent</span>
                            <span className="text-lg font-bold text-white">${totalSpent.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    {/* Custom Legend */}
                    <div className="w-1/2 max-h-[250px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {spendingData.map((entry, index) => (
                            <div key={index} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-slate-300 truncate max-w-[100px]">{entry.name}</span>
                                </div>
                                <span className="font-mono text-slate-400">${entry.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
             ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    No expense data for this period.
                </div>
             )}
          </div>
      </div>

      {/* Row 3: Sankey Diagram */}
      <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg min-h-[400px]">
         <div className="mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="text-indigo-400" size={20}/>
                Income to Expense Flow
            </h3>
            <p className="text-xs text-slate-500">Visualizing how your income distributes into expenses and savings</p>
         </div>
         {sankeyData.links.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
                <Sankey
                    data={sankeyData}
                    node={{ stroke: '#1e293b', strokeWidth: 0, fill: '#6366f1' }}
                    link={{ stroke: '#64748b' }}
                    nodePadding={50}
                    margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                >
                    <RechartsTooltip content={<CustomTooltip />} />
                </Sankey>
            </ResponsiveContainer>
         ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
                Not enough data to generate flow diagram.
            </div>
         )}
      </div>

    </div>
  );
};

export default Dashboard;