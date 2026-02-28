import React from 'react';
import { useTheme } from './ThemeContext';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  Sankey, Tooltip, 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, Brush
} from 'recharts';
import { X, ZoomIn } from 'lucide-react';

interface ExpandedChartModalProps {
  config: any;
  onClose: () => void;
  currency: string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label, currency, theme }: any) => {
  if (active && payload && payload.length) {
    const isDark = theme === 'dark';
    return (
      <div className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border p-4 rounded-lg shadow-2xl z-50`}>
        <p className={`${isDark ? 'text-slate-200' : 'text-slate-800'} text-base font-bold mb-2`}>{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color || entry.fill }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
            {entry.name}: <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{currency}{(typeof entry.value === 'number') ? entry.value.toLocaleString() : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ExpandedChartModal: React.FC<ExpandedChartModalProps> = ({ config, onClose, currency }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const tooltipText = isDark ? '#f1f5f9' : '#0f172a';
  const brushFill = isDark ? '#1e293b' : '#f1f5f9';
  const brushStroke = isDark ? '#6366f1' : '#4f46e5';

  if (!config) return null;

  const { chartType, data, xAxisKey, series, title, description } = config;

  const CustomTooltipContent = (props: any) => <CustomTooltip {...props} currency={currency} theme={isDark ? 'dark' : 'light'} />;

  const renderChart = () => {
    switch (chartType) {
        case 'bar':
            return (
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} />
                    <YAxis stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} tickFormatter={(val) => `${currency}${val}`} />
                    <Tooltip content={CustomTooltipContent} cursor={{ fill: brushFill }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {series.map((s: any) => (
                        <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={60} />
                    ))}
                    <Brush dataKey={xAxisKey} height={30} stroke={brushStroke} fill={brushFill} tickFormatter={() => ''} />
                </BarChart>
            );
        case 'line':
            return (
                <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} />
                    <YAxis stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} />
                    <Tooltip content={CustomTooltipContent} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {series.map((s: any) => (
                        <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                    ))}
                    <Brush dataKey={xAxisKey} height={30} stroke={brushStroke} fill={brushFill} tickFormatter={() => ''} />
                </LineChart>
            );
         case 'area':
            return (
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                        {series.map((s: any, i: number) => (
                            <linearGradient key={s.dataKey} id={`expandedColor${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={s.color} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey={xAxisKey} stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} />
                    <YAxis stroke={axisColor} fontSize={12} tick={{ fill: axisColor }} />
                    <Tooltip content={CustomTooltipContent} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {series.map((s: any, i: number) => (
                        <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} strokeWidth={3} fill={`url(#expandedColor${i})`} />
                    ))}
                    <Brush dataKey={xAxisKey} height={30} stroke={brushStroke} fill={brushFill} tickFormatter={() => ''} />
                </AreaChart>
            );
         case 'pie':
             return (
                 <PieChart>
                     <Pie
                        data={data}
                        dataKey={series[0].dataKey || 'value'} 
                        nameKey={xAxisKey || 'name'}
                        cx="50%"
                        cy="50%"
                        innerRadius={100}
                        outerRadius={160}
                        paddingAngle={5}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                     >
                        {data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.1)" />
                        ))}
                     </Pie>
                     <Tooltip content={CustomTooltipContent} />
                     <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 </PieChart>
             );
        case 'sankey':
            return (
                <Sankey
                    data={data}
                    node={{ stroke: isDark ? '#1e293b' : '#ffffff', strokeWidth: 0 }}
                    link={{ stroke: isDark ? '#64748b' : '#94a3b8', fillOpacity: 0.3 }}
                    nodePadding={50}
                    margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                >
                    <Tooltip content={CustomTooltipContent} />
                </Sankey>
            );
        default:
            return <div className="text-center text-textMuted">Chart type not supported for expanded view.</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border bg-surface/90">
            <div>
                <h2 className="text-2xl font-bold text-textMain flex items-center gap-3">
                    {title}
                    {['bar', 'line', 'area'].includes(chartType) && (
                        <span className="text-xs font-normal bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/30 flex items-center gap-1">
                            <ZoomIn size={12} /> Zoom Enabled
                        </span>
                    )}
                </h2>
                {description && <p className="text-textMuted mt-1">{description}</p>}
            </div>
            <button 
                onClick={onClose}
                className="p-2 bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMuted hover:text-textMain rounded-xl transition-all border border-border"
            >
                <X size={28} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 w-full h-full overflow-hidden flex flex-col items-center justify-center">
             <div className="w-full h-full max-w-7xl">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart() || <div/>}
                </ResponsiveContainer>
             </div>
             {['bar', 'line', 'area'].includes(chartType) && (
                <p className="text-textMuted text-sm mt-4">
                    Use the slider below the graph to zoom and pan across the data range.
                </p>
             )}
        </div>
    </div>
  );
};