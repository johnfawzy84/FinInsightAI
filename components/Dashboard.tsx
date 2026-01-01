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
import { generateDynamicChart } from '../services/gemini';
import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart as PieIcon, Layers, Activity, Edit2, Sparkles, Loader2, RefreshCw, AlertCircle, Save, Check, X, Maximize2 } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  assets: Asset[];
  onUpdateAssets: (updater: (assets: Asset[]) => Asset[]) => void;
  activeSession: Session;
  onUpdateDashboardWidgets: (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
        <p className="text-slate-200 text-sm font-medium mb-1">{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || entry.fill }}>
            {entry.name}: <span className="font-bold font-mono">${(typeof entry.value === 'number') ? entry.value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Generic Chart Renderer
const GenericChartRenderer = ({ config }: { config: any }) => {
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
                    <RechartsTooltip content={<CustomTooltip />} />
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
                    <RechartsTooltip content={<CustomTooltip />} />
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
                    <RechartsTooltip content={<CustomTooltip />} />
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
                     <RechartsTooltip content={<CustomTooltip />} />
                     <Legend />
                 </PieChart>
             );
        default:
            return null;
    }
};


const Dashboard: React.FC<DashboardProps> = ({ transactions, assets, onUpdateAssets, activeSession, onUpdateDashboardWidgets }) => {
  // Date State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // UI State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [expandedChartConfig, setExpandedChartConfig] = useState<any>(null);

  // Dynamic Chart State (Playground)
  const [customQuery, setCustomQuery] = useState('');
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [customChartConfig, setCustomChartConfig] = useState<any>(null);

  // Custom Widget State (Refresh & Edit)
  const [refreshingWidgetId, setRefreshingWidgetId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editWidgetQuery, setEditWidgetQuery] = useState('');

  // Auto-fit Date Range on Data Load
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

  // Quick Select Handler
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

  // --- Filter Data by Date Range ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);

  // --- AI Chart Generator (Playground) ---
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

  // --- Custom Widget Management ---
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
    setRefreshingWidgetId(widgetId); // Use refreshing state to show loading
    
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


  // --- 1. Net Worth Trend (Back-calculation) ---
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

  // --- 2. Cash Flow (Monthly Bar Chart) ---
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
    const incomeTotal = filteredTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseCats = spendingData.slice(0, 6);
    const otherExpense = spendingData.slice(6).reduce((sum, t) => sum + t.value, 0);
    const totalExpense = totalSpent;
    const surplus = Math.max(0, incomeTotal - totalExpense);
    const nodes = [ { name: 'Income' }, ...expenseCats.map(c => ({ name: c.name })) ];
    if (otherExpense > 0) nodes.push({ name: 'Other' });
    if (surplus > 0) nodes.push({ name: 'Savings' });
    const links = [];
    expenseCats.forEach((cat, idx) => { links.push({ source: 0, target: idx + 1, value: cat.value }); });
    if (otherExpense > 0) links.push({ source: 0, target: expenseCats.length + 1, value: otherExpense });
    if (surplus > 0) links.push({ source: 0, target: nodes.length - 1, value: surplus });
    if (incomeTotal === 0 && totalExpense > 0) nodes[0].name = "Capital";
    return { nodes, links };
  }, [filteredTransactions, spendingData, totalSpent]);

  // --- RENDERERS FOR PREDEFINED CHARTS ---
  const renderNetWorth = () => (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={netWorthData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => { const d = new Date(val); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }} minTickGap={40} />
          <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${val/1000}k`} />
          <RechartsTooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
  );

  const renderAssets = () => (
      assets.length > 0 ? (
        <div className="flex-1 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie data={assets as any[]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                        {assets.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400">Total</span>
                <span className="text-lg font-bold text-white">${assets.reduce((sum, a) => sum + a.value, 0).toLocaleString()}</span>
            </div>
        </div>
    ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <p className="text-sm">No assets added.</p>
            <button onClick={() => setIsAssetModalOpen(true)} className="text-xs text-indigo-400 underline">Add Assets</button>
        </div>
    )
  );

  const renderCashFlow = () => (
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
  );

  const renderSpending = () => (
      spendingData.length > 0 ? (
        <div className="flex-1 flex items-center gap-4">
            <div className="w-1/2 h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={spendingData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {spendingData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />)}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-400">Total Spent</span>
                    <span className="text-lg font-bold text-white">${totalSpent.toLocaleString()}</span>
                </div>
            </div>
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
        <div className="flex-1 flex items-center justify-center text-slate-500">No expense data.</div>
     )
  );

  const renderSankey = () => (
      sankeyData.links.length > 0 ? (
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
        <div className="h-[300px] flex items-center justify-center text-slate-500">Not enough data.</div>
     )
  );

  // --- EXPANSION HANDLER ---
  const handleExpandWidget = (widget: DashboardWidget) => {
    let config = null;

    if (widget.type === 'custom' && widget.cachedConfig) {
        config = { ...widget.cachedConfig, description: widget.query };
    } else if (widget.type === 'net-worth') {
        config = {
            chartType: 'area',
            title: widget.title,
            description: "Detailed view of your net worth over time.",
            data: netWorthData,
            xAxisKey: 'date',
            series: [{ dataKey: 'value', name: 'Net Worth', color: '#10b981' }]
        };
    } else if (widget.type === 'cash-flow') {
        config = {
            chartType: 'bar',
            title: widget.title,
            description: "Monthly income vs expenses comparison.",
            data: cashFlowData,
            xAxisKey: 'name',
            series: [
                { dataKey: 'income', name: 'Income', color: '#10b981' },
                { dataKey: 'expense', name: 'Expenses', color: '#ef4444' }
            ]
        };
    } else if (widget.type === 'spending') {
        config = {
            chartType: 'pie',
            title: widget.title,
            description: "Breakdown of expenses by category.",
            data: spendingData,
            xAxisKey: 'name', // Label
            series: [{ dataKey: 'value' }] // Value
        };
    } else if (widget.type === 'assets') {
         config = {
            chartType: 'pie',
            title: widget.title,
            description: "Distribution of your assets.",
            data: assets.map((a, i) => ({ ...a, color: a.color || COLORS[i % COLORS.length] })),
            xAxisKey: 'name',
            series: [{ dataKey: 'value' }]
        };
    } else if (widget.type === 'sankey') {
         config = {
             chartType: 'sankey',
             title: widget.title,
             description: "Flow of money from income sources to expense categories.",
             data: sankeyData,
             // Sankey doesn't use standard axis keys
             xAxisKey: '', 
             series: []
         };
    }

    if (config) {
        setExpandedChartConfig(config);
    }
  };


  // --- WIDGET MAP ---
  const renderWidget = (widget: DashboardWidget) => {
      const ExpandButton = () => (
          <button 
            onClick={() => handleExpandWidget(widget)}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors ml-2"
            title="Maximize and Zoom"
          >
              <Maximize2 size={16} />
          </button>
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
                                <p className="text-2xl font-bold text-white">${(netWorthData[netWorthData.length - 1]?.value || 0).toLocaleString()}</p>
                                <p className="text-xs text-emerald-400">Current Estimate</p>
                            </div>
                            <ExpandButton />
                        </div>
                    </div>
                    {assets.length === 0 && (
                        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 p-2 rounded flex items-center gap-2 text-xs text-amber-300">
                            <AlertCircle size={14} />
                            <span>Wealth starts at $0. Add your assets.</span>
                            <button onClick={() => setIsAssetModalOpen(true)} className="underline font-bold">Add Assets</button>
                        </div>
                    )}
                    {renderNetWorth()}
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
                            <button onClick={() => setIsAssetModalOpen(true)} className="p-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-lg transition-all" title="Manage Assets"><Edit2 size={16} /></button>
                            <ExpandButton />
                        </div>
                    </div>
                    {renderAssets()}
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
                        <div className="flex items-center gap-4">
                            <div className="flex gap-4 text-xs">
                                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Income</div>
                                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Expenses</div>
                            </div>
                            <ExpandButton />
                        </div>
                     </div>
                     {renderCashFlow()}
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
                        {renderSpending()}
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
                        {renderSankey()}
                    </div>
                );
            case 'custom':
                return (
                    <div className="flex flex-col h-full">
                         <div className="mb-4 flex justify-between items-center gap-2 min-h-[40px]">
                            {editingWidgetId === widget.id ? (
                                <>
                                    <div className="flex-1">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            value={editWidgetQuery}
                                            onChange={(e) => setEditWidgetQuery(e.target.value)}
                                            className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
                                            placeholder="Update prompt..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEditingWidget(widget.id);
                                                if (e.key === 'Escape') cancelEditingWidget();
                                            }}
                                        />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => saveEditingWidget(widget.id)} className="p-1.5 text-emerald-400 hover:bg-slate-700 rounded"><Check size={16}/></button>
                                        <button onClick={cancelEditingWidget} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded"><X size={16}/></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-indigo-400" size={20}/> {widget.title}</h3>
                                        {widget.description && <p className="text-xs text-slate-500 truncate" title={widget.description}>{widget.description}</p>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => startEditingWidget(widget)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                                            title="Edit Prompt"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => refreshCustomWidget(widget)} 
                                            disabled={refreshingWidgetId === widget.id}
                                            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                            title="Refresh data"
                                        >
                                            {refreshingWidgetId === widget.id ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                                        </button>
                                        <ExpandButton />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex-1 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {GenericChartRenderer({ config: widget.cachedConfig }) || <div>No data</div>}
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            default:
                return <div>Unknown Widget</div>;
      }
  };


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

      {/* Expanded Chart Overlay */}
      <ExpandedChartModal 
        config={expandedChartConfig} 
        onClose={() => setExpandedChartConfig(null)} 
      />

      {/* Dynamic AI Chart Designer (Playground) */}
      <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 p-6 rounded-xl border border-indigo-500/30 shadow-lg relative overflow-hidden group">
         <div className="relative z-10">
             <div className="flex items-center gap-2 mb-4">
                 <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-300">
                     <Sparkles size={20} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-white">AI Insights Designer</h3>
                    <p className="text-xs text-indigo-200">Describe what you want to visualize (e.g. "Monthly food spending for 2024" or "Income vs Rent")</p>
                 </div>
             </div>
             
             <div className="flex gap-2 mb-4">
                 <input 
                    type="text" 
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="Ask for a specific graph..."
                    className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateCustomChart()}
                 />
                 <button 
                    onClick={handleGenerateCustomChart}
                    disabled={isGeneratingChart || !customQuery.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                 >
                    {isGeneratingChart ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    Generate
                 </button>
             </div>

             {/* Rendered Chart Area */}
             {customChartConfig && (
                 <div className="bg-slate-900/50 rounded-xl p-4 border border-indigo-500/20 animate-fade-in min-h-[300px]">
                     <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-white">{customChartConfig.title}</h4>
                        <div className="flex gap-2">
                            <button onClick={handleSavePlaygroundChart} className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition-colors shadow">
                                <Save size={14}/> Save to Dashboard
                            </button>
                            <button onClick={() => setExpandedChartConfig({...customChartConfig, description: customQuery})} className="text-slate-500 hover:text-white p-1"><Maximize2 size={14}/></button>
                            <button onClick={() => setCustomChartConfig(null)} className="text-slate-500 hover:text-white p-1"><RefreshCw size={14}/></button>
                        </div>
                     </div>
                     <ResponsiveContainer width="100%" height={250}>
                        {GenericChartRenderer({ config: customChartConfig }) || <div></div>}
                     </ResponsiveContainer>
                 </div>
             )}
         </div>
      </div>


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

      {/* Dynamic Widget Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeSession.dashboardWidgets
            .filter(w => w.visible)
            .map(widget => (
              <div 
                key={widget.id} 
                className={`bg-surface p-6 rounded-xl border border-slate-700 shadow-lg ${widget.width === 'full' ? 'lg:col-span-2' : ''} min-h-[350px]`}
              >
                  {renderWidget(widget)}
              </div>
          ))}
      </div>

    </div>
  );
};

export default Dashboard;