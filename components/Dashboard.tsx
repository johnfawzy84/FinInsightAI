import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  Sankey, Tooltip as RechartsTooltip, 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
  Sector, LineChart, Line
} from 'recharts';
import { Transaction, TransactionType, Asset, Session, DashboardWidget } from '../types';
import { AssetManagerModal } from './AssetManagerModal';
import { ExpandedChartModal } from './ExpandedChartModal';
import { generateDynamicChart, predictRecurringExpenses } from '../services/gemini';
import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart as PieIcon, Layers, Activity, Edit2, Sparkles, Loader2, RefreshCw, AlertCircle, Save, Check, X, Maximize2, Shield, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  assets: Asset[];
  onUpdateAssets: (updater: (assets: Asset[]) => Asset[]) => void;
  activeSession: Session;
  onUpdateDashboardWidgets: (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => void;
  currency: string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
        <p className="text-slate-200 text-sm font-medium mb-1">{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || entry.fill }}>
            {entry.name}: <span className="font-bold font-mono">{currency}{(typeof entry.value === 'number') ? entry.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const GenericChartRenderer = ({ config, currency }: { config: any, currency: string }) => {
    if (!config || config.chartType === 'error') {
        return <div className="flex items-center justify-center h-full text-red-400 text-sm">{config?.title || "Error loading chart"}</div>
    }

    const { chartType, data, xAxisKey, series } = config;

    switch (chartType) {
        case 'bar':
            return (
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                    <Legend />
                    {series.map((s: any) => (
                        <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
            );
        case 'line':
            return (
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                    <Legend />
                    {series.map((s: any) => (
                        <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} strokeWidth={2} />
                    ))}
                </LineChart>
            );
         case 'area':
            return (
                <AreaChart data={data}>
                    <defs>
                        {series.map((s: any, i: number) => (
                            <linearGradient key={s.dataKey} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={s.color} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                    <Legend />
                    {series.map((s: any, i: number) => (
                        <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} fill={`url(#color${i})`} />
                    ))}
                </AreaChart>
            );
         case 'pie':
             return (
                 <PieChart>
                     <Pie
                        data={data}
                        dataKey={series[0].dataKey} 
                        nameKey={xAxisKey}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                     >
                        {data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                        ))}
                     </Pie>
                     <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                     <Legend />
                 </PieChart>
             );
        default:
            return null;
    }
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, assets, onUpdateAssets, activeSession, onUpdateDashboardWidgets, currency }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [expandedChartConfig, setExpandedChartConfig] = useState<any>(null);

  const [customQuery, setCustomQuery] = useState('');
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [customChartConfig, setCustomChartConfig] = useState<any>(null);

  const [refreshingWidgetId, setRefreshingWidgetId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editWidgetQuery, setEditWidgetQuery] = useState('');

  // AI Recurring Data
  const [recurringData, setRecurringData] = useState<any>(null);
  const [isLoadingRecurring, setIsLoadingRecurring] = useState(false);

  useEffect(() => {
    if (transactions.length > 0) {
      const dates = transactions.map(t => t.date).sort();
      const minData = dates[0];
      const maxData = dates[dates.length - 1];
      const today = new Date().toISOString().split('T')[0];
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
      if (maxData < sixMonthsAgoStr || minData > today) {
         setStartDate(minData);
         setEndDate(maxData);
      }
    }
  }, [transactions.length]);

  useEffect(() => {
      const fetchRecurring = async () => {
          setIsLoadingRecurring(true);
          try {
              const res = await predictRecurringExpenses(transactions);
              setRecurringData(res);
          } catch (e) {
              console.error(e);
          } finally {
              setIsLoadingRecurring(false);
          }
      };
      if (transactions.length > 5) fetchRecurring();
  }, [transactions.length]);

  const setQuickRange = (months: number | 'YTD' | 'ALL') => {
    const end = new Date();
    let start = new Date();
    if (months === 'ALL') {
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);

  const handleGenerateCustomChart = async () => {
    if (!customQuery.trim()) return;
    setIsGeneratingChart(true);
    setCustomChartConfig(null);
    try {
        const config = await generateDynamicChart(transactions, customQuery);
        setCustomChartConfig(config);
    } catch (e) {
        console.error(e);
        alert("Failed to generate chart. Please try again.");
    } finally {
        setIsGeneratingChart(false);
    }
  };

  const handleSavePlaygroundChart = () => {
      if(!customChartConfig) return;
      const newWidget: DashboardWidget = {
          id: `custom-${Date.now()}`,
          type: 'custom',
          title: customChartConfig.title,
          description: customQuery,
          query: customQuery,
          cachedConfig: customChartConfig,
          visible: true,
          width: 'half'
      };
      onUpdateDashboardWidgets(prev => [...prev, newWidget]);
      setCustomChartConfig(null);
      setCustomQuery('');
      alert("Chart added to Dashboard!");
  };

  const refreshCustomWidget = async (widget: DashboardWidget) => {
      if (!widget.query) return;
      setRefreshingWidgetId(widget.id);
      try {
          const config = await generateDynamicChart(transactions, widget.query);
          onUpdateDashboardWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, cachedConfig: config } : w));
      } catch(e) {
          console.error(e);
      } finally {
          setRefreshingWidgetId(null);
      }
  };

  const startEditingWidget = (widget: DashboardWidget) => {
    setEditingWidgetId(widget.id);
    setEditWidgetQuery(widget.query || '');
  };

  const cancelEditingWidget = () => {
    setEditingWidgetId(null);
    setEditWidgetQuery('');
  };

  const saveEditingWidget = async (widgetId: string) => {
    if (!editWidgetQuery.trim()) return;
    setEditingWidgetId(null);
    setRefreshingWidgetId(widgetId);
    try {
        const config = await generateDynamicChart(transactions, editWidgetQuery);
        onUpdateDashboardWidgets(prev => prev.map(w => w.id === widgetId ? { 
            ...w, 
            query: editWidgetQuery, 
            description: editWidgetQuery,
            cachedConfig: config,
            title: config.title || w.title 
        } : w));
    } catch (e) {
        console.error(e);
        alert("Failed to update chart prompt.");
    } finally {
        setRefreshingWidgetId(null);
    }
  };

  const netWorthData = useMemo(() => {
    const currentWealth = assets.reduce((sum, a) => sum + a.value, 0);
    const allSorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const txByDate = new Map<string, { income: number, expense: number }>();
    allSorted.forEach(t => {
        const curr = txByDate.get(t.date) || { income: 0, expense: 0 };
        if (t.type === TransactionType.INCOME) curr.income += t.amount;
        else curr.expense += t.amount;
        txByDate.set(t.date, curr);
    });
    const dataPoints: { date: string, value: number }[] = [];
    let cursorWealth = currentWealth;
    const endUTC = new Date(endDate);
    const startUTC = new Date(startDate);
    for (let d = new Date(endUTC); d >= startUTC; d.setUTCDate(d.getUTCDate() - 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dataPoints.push({ date: dateStr, value: cursorWealth });
        const flow = txByDate.get(dateStr) || { income: 0, expense: 0 };
        cursorWealth = cursorWealth - flow.income + flow.expense;
    }
    return dataPoints.reverse();
  }, [transactions, assets, startDate, endDate]);

  const cashFlowData = useMemo(() => {
    const grouped = new Map<string, { income: number; expense: number }>();
    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const current = grouped.get(key) || { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) current.income += t.amount;
      else current.expense += t.amount;
      grouped.set(key, current);
    });
    return Array.from(grouped.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions]);

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

  const sankeyData = useMemo(() => {
    // 1. Income Data
    const incomeTx = filteredTransactions.filter(t => t.type === TransactionType.INCOME);
    const incomeGrouped = new Map<string, number>();
    incomeTx.forEach(t => {
        const cat = t.category || 'Uncategorized';
        incomeGrouped.set(cat, (incomeGrouped.get(cat) || 0) + t.amount);
    });
    
    let incomeNodesList = Array.from(incomeGrouped.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Collapse small income if > 6
    if (incomeNodesList.length > 6) {
        const top = incomeNodesList.slice(0, 5);
        const otherVal = incomeNodesList.slice(5).reduce((s, i) => s + i.value, 0);
        incomeNodesList = [...top, { name: 'Other Income', value: otherVal }];
    }

    const totalIncome = incomeNodesList.reduce((s, i) => s + i.value, 0);

    // 2. Expense Data (use spendingData which is already processed expenses)
    let expenseNodesList = [...spendingData];
    
    // Collapse small expenses if > 8 (Sankey gets tall)
    if (expenseNodesList.length > 8) {
        const top = expenseNodesList.slice(0, 7);
        const otherVal = expenseNodesList.slice(7).reduce((s, i) => s + i.value, 0);
        expenseNodesList = [...top, { name: 'Other Expenses', value: otherVal }];
    }

    const totalExpense = expenseNodesList.reduce((s, i) => s + i.value, 0);

    // 3. Balance
    const surplus = Math.max(0, totalIncome - totalExpense);
    const deficit = Math.max(0, totalExpense - totalIncome);

    // 4. Build Nodes & Links
    const nodes: { name: string; fill?: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];
    
    // A. Income Nodes (Emerald)
    const incomeIndices = incomeNodesList.map(item => {
        nodes.push({ name: item.name, fill: '#10b981' });
        return nodes.length - 1;
    });

    // B. Deficit Node (if needed) (Amber)
    let deficitIndex = -1;
    if (deficit > 0) {
        nodes.push({ name: 'Deficit (Reserves)', fill: '#f59e0b' });
        deficitIndex = nodes.length - 1;
    }

    // C. Center Node (Indigo)
    nodes.push({ name: 'Total Budget', fill: '#6366f1' });
    const centerIndex = nodes.length - 1;

    // D. Expense Nodes (Varied Colors)
    const expenseIndices = expenseNodesList.map((item, i) => {
        nodes.push({ name: item.name, fill: COLORS[i % COLORS.length] });
        return nodes.length - 1;
    });

    // E. Savings Node (if needed) (Cyan)
    let savingsIndex = -1;
    if (surplus > 0) {
        nodes.push({ name: 'Savings', fill: '#06b6d4' });
        savingsIndex = nodes.length - 1;
    }

    // Links: Income -> Center
    incomeNodesList.forEach((item, i) => {
        links.push({ source: incomeIndices[i], target: centerIndex, value: item.value });
    });

    // Links: Deficit -> Center
    if (deficit > 0) {
        links.push({ source: deficitIndex, target: centerIndex, value: deficit });
    }

    // Links: Center -> Expenses
    expenseNodesList.forEach((item, i) => {
        links.push({ source: centerIndex, target: expenseIndices[i], value: item.value });
    });

    // Links: Center -> Savings
    if (surplus > 0) {
        links.push({ source: centerIndex, target: savingsIndex, value: surplus });
    }

    return { nodes, links };
  }, [filteredTransactions, spendingData]);

  const handleExpandWidget = (widget: DashboardWidget) => {
    let config = null;
    if (widget.type === 'custom' && widget.cachedConfig) {
        config = { ...widget.cachedConfig, description: widget.query };
    } else if (widget.type === 'net-worth') {
        config = { chartType: 'area', title: widget.title, description: "Detailed view of your net worth over time.", data: netWorthData, xAxisKey: 'date', series: [{ dataKey: 'value', name: 'Net Worth', color: '#10b981' }] };
    } else if (widget.type === 'cash-flow') {
        config = { chartType: 'bar', title: widget.title, description: "Monthly income vs expenses comparison.", data: cashFlowData, xAxisKey: 'name', series: [{ dataKey: 'income', name: 'Income', color: '#10b981' }, { dataKey: 'expense', name: 'Expenses', color: '#ef4444' }] };
    } else if (widget.type === 'spending') {
        config = { chartType: 'pie', title: widget.title, description: "Breakdown of expenses by category.", data: spendingData, xAxisKey: 'name', series: [{ dataKey: 'value' }] };
    } else if (widget.type === 'assets') {
         config = { chartType: 'pie', title: widget.title, description: "Distribution of your assets.", data: assets, xAxisKey: 'name', series: [{ dataKey: 'value' }] };
    } else if (widget.type === 'sankey') {
         config = { chartType: 'sankey', title: widget.title, description: "Flow of money from income sources to expense categories.", data: sankeyData, xAxisKey: '', series: [] };
    }
    if (config) setExpandedChartConfig(config);
  };

  const renderWidget = (widget: DashboardWidget) => {
      const ExpandButton = () => (
          <button onClick={() => handleExpandWidget(widget)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors ml-2"><Maximize2 size={16} /></button>
      );
      switch(widget.type) {
          case 'net-worth':
              return (
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><TrendingUp className="text-emerald-400" size={20}/> {widget.title}</h3>
                            <p className="text-xs text-slate-500">Wealth based on cash flow + assets</p>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className="text-right">
                                <p className="text-2xl font-bold text-white">{currency}{(netWorthData[netWorthData.length - 1]?.value || 0).toLocaleString()}</p>
                                <p className="text-xs text-emerald-400">Current Estimate</p>
                            </div>
                            <ExpandButton />
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={netWorthData}>
                            <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => { const d = new Date(val); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }} minTickGap={40} />
                            <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `${currency}${val/1000}k`} />
                            <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                            <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
              );
          case 'assets':
              return (
                  <div className="flex flex-col h-full">
                    <div className="mb-4 flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><PieIcon className="text-purple-400" size={20}/> {widget.title}</h3>
                            <p className="text-xs text-slate-500">Portfolio Distribution</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsAssetModalOpen(true)} className="p-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-lg transition-all"><Edit2 size={16} /></button>
                            <ExpandButton />
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={assets} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                                {assets.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
              );
          case 'recurring':
              return (
                  <div className="flex flex-col h-full">
                      <div className="mb-4 flex justify-between items-start">
                          <div>
                              <h3 className="text-xl font-bold text-white flex items-center gap-2"><RefreshCw className="text-cyan-400" size={20}/> {widget.title}</h3>
                              <p className="text-xs text-slate-500">Auto-detected regular payments</p>
                          </div>
                          {isLoadingRecurring && <Loader2 size={16} className="animate-spin text-slate-500" />}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {recurringData?.breakdown?.map((item: any, idx: number) => (
                              <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                                  <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                          {item.type === 'income' ? <ArrowUpRight size={16}/> : <ArrowDownLeft size={16}/>}
                                      </div>
                                      <div>
                                          <div className="text-sm font-medium text-white">{item.reason}</div>
                                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.category}</div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-sm font-bold font-mono ${item.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                                          {currency}{item.amount.toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-slate-500">Est. Monthly</div>
                                  </div>
                              </div>
                          ))}
                          {(!recurringData || recurringData.breakdown.length === 0) && !isLoadingRecurring && (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                                  No regular payments detected yet.
                              </div>
                          )}
                      </div>
                  </div>
              );
          case 'cash-flow':
               return (
                  <div className="flex flex-col h-full">
                     <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-indigo-400" size={20}/> {widget.title}</h3>
                            <p className="text-xs text-slate-500">Monthly Income vs Expenses</p>
                        </div>
                        <ExpandButton />
                     </div>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={cashFlowData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                            <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               );
           case 'spending':
               return (
                   <div className="flex flex-col h-full">
                        <div className="mb-4 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="text-amber-400" size={20}/> {widget.title}</h3>
                                <p className="text-xs text-slate-500">Distribution of expenses</p>
                            </div>
                            <ExpandButton />
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={spendingData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                                    {spendingData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                            </PieChart>
                        </ResponsiveContainer>
                   </div>
               );
            case 'sankey':
                return (
                    <div className="flex flex-col h-full">
                        <div className="mb-6 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-indigo-400" size={20}/> {widget.title}</h3>
                                <p className="text-xs text-slate-500">Flow from Income to Expenses</p>
                            </div>
                            <ExpandButton />
                        </div>
                        <ResponsiveContainer width="100%" height={350}>
                            <Sankey 
                                data={sankeyData} 
                                node={{ stroke: '#1e293b', strokeWidth: 0 }} 
                                link={{ stroke: '#64748b', fillOpacity: 0.3 }}
                            >
                                <RechartsTooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
                            </Sankey>
                        </ResponsiveContainer>
                    </div>
                );
            case 'custom':
                return (
                    <div className="flex flex-col h-full">
                         <div className="mb-4 flex justify-between items-center gap-2 min-h-[40px]">
                            {editingWidgetId === widget.id ? (
                                <div className="flex-1 flex gap-1">
                                    <input autoFocus value={editWidgetQuery} onChange={(e) => setEditWidgetQuery(e.target.value)} className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none" onKeyDown={(e) => e.key === 'Enter' && saveEditingWidget(widget.id)} />
                                    <button onClick={() => saveEditingWidget(widget.id)} className="p-1.5 text-emerald-400 hover:bg-slate-700 rounded"><Check size={16}/></button>
                                    <button onClick={cancelEditingWidget} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded"><X size={16}/></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-indigo-400" size={20}/> {widget.title}</h3>
                                        <p className="text-xs text-slate-500 truncate">{widget.description}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => startEditingWidget(widget)} className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 rounded"><Edit2 size={16}/></button>
                                        <button onClick={() => refreshCustomWidget(widget)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors">{refreshingWidgetId === widget.id ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}</button>
                                        <ExpandButton />
                                    </div>
                                </>
                            )}
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                            <GenericChartRenderer config={widget.cachedConfig} currency={currency} />
                        </ResponsiveContainer>
                    </div>
                );
            default:
                return null;
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {isAssetModalOpen && <AssetManagerModal assets={assets} onUpdateAssets={onUpdateAssets} onClose={() => setIsAssetModalOpen(false)} currency={currency} />}
      <ExpandedChartModal config={expandedChartConfig} onClose={() => setExpandedChartConfig(null)} currency={currency} />

      <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 p-6 rounded-xl border border-indigo-500/30 shadow-lg group relative">
         <div className="flex items-center gap-2 mb-4">
             <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-300"><Sparkles size={20} /></div>
             <div><h3 className="text-xl font-bold text-white">AI Insights Designer</h3><p className="text-xs text-indigo-200">Describe what you want to visualize (e.g. "Monthly food spending")</p></div>
         </div>
         <div className="flex gap-2 mb-4">
             <input type="text" value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="Ask for a specific graph..." className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleGenerateCustomChart()} />
             <button onClick={handleGenerateCustomChart} disabled={isGeneratingChart || !customQuery.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-lg font-medium flex items-center gap-2">{isGeneratingChart ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} Generate</button>
         </div>
         {customChartConfig && (
             <div className="bg-slate-900/50 rounded-xl p-4 border border-indigo-500/20 animate-fade-in min-h-[300px]">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-white">{customChartConfig.title}</h4>
                    <button onClick={handleSavePlaygroundChart} className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition-colors shadow"><Save size={14}/> Save to Dashboard</button>
                 </div>
                 <ResponsiveContainer width="100%" height={250}><GenericChartRenderer config={customChartConfig} currency={currency} /></ResponsiveContainer>
             </div>
         )}
      </div>

      <div className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold"><Calendar size={20} className="text-indigo-400" /><span>Analysis Period</span></div>
        <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white" />
            <span className="text-slate-500">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white" />
        </div>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          {['1M', '3M', '6M', 'YTD', 'ALL'].map(opt => <button key={opt} onClick={() => setQuickRange(opt as any)} className="px-3 py-1 text-xs font-medium rounded-md transition-all text-slate-400 hover:text-white hover:bg-slate-700">{opt}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeSession.dashboardWidgets.filter(w => w.visible).map(widget => (
              <div key={widget.id} className={`bg-surface p-6 rounded-xl border border-slate-700 shadow-lg ${widget.width === 'full' ? 'lg:col-span-2' : ''} min-h-[350px]`}>{renderWidget(widget)}</div>
          ))}
      </div>
    </div>
  );
};

export default Dashboard;