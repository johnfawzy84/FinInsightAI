import React, { useState } from 'react';
import { Session, CategorizationRule, ImportSettings, Transaction, DashboardWidget } from '../types';
import { generateDynamicChart } from '../services/gemini';
import { 
  Settings, 
  FileJson, 
  Download, 
  Upload, 
  Zap, 
  RefreshCw, 
  BrainCircuit, 
  Wand2, 
  RotateCcw, 
  Edit2, 
  Trash2, 
  List, 
  Eraser, 
  Plus, 
  Check, 
  X,
  Regex,
  Layout,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  Save,
  Database
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

interface SettingsViewProps {
  activeSession: Session;
  onUpdateSettings: (settings: Partial<ImportSettings>) => void;
  onUpdateRules: (updater: (rules: CategorizationRule[]) => CategorizationRule[]) => void;
  onUpdateCategories: (newCategories: string[], renamedFrom?: string, renamedTo?: string) => void;
  onUpdateTransactions: (updater: (t: any[]) => any[]) => void;
  onExportSession: () => void;
  onImportSession: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyRulesToExisting: () => void;
  onGenerateRules: () => void;
  isGeneratingRules: boolean;
  onSanitizeCategories: () => void;
  onUpdateDashboardWidgets: (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => void;
  transactions: Transaction[];
  onDeleteSource: (sourceName: string) => void;
}

// Reusable Chart Renderer (Simplified for Preview)
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const renderPreviewChart = (config: any) => {
    if (!config || config.chartType === 'error') return <div className="text-red-400 text-xs p-4 text-center">{config?.title || "Error"}</div>;
    const { chartType, data, xAxisKey, series } = config;

    switch (chartType) {
        case 'bar': return <BarChart data={data}><XAxis dataKey={xAxisKey} hide/><YAxis hide/><Bar dataKey={series[0].dataKey} fill={series[0].color} /></BarChart>;
        case 'line': return <LineChart data={data}><XAxis dataKey={xAxisKey} hide/><YAxis hide/><Line type="monotone" dataKey={series[0].dataKey} stroke={series[0].color} dot={false} /></LineChart>;
        case 'area': return <AreaChart data={data}><XAxis dataKey={xAxisKey} hide/><YAxis hide/><Area type="monotone" dataKey={series[0].dataKey} fill={series[0].color} stroke={series[0].color} /></AreaChart>;
        case 'pie': return <PieChart><Pie data={data} dataKey={series[0].dataKey} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={40}><Cell fill={COLORS[0]}/><Cell fill={COLORS[1]}/></Pie></PieChart>;
        default: return null;
    }
};

const SettingsView: React.FC<SettingsViewProps> = ({
  activeSession,
  onUpdateSettings,
  onUpdateRules,
  onUpdateCategories,
  onUpdateTransactions,
  onExportSession,
  onImportSession,
  onApplyRulesToExisting,
  onGenerateRules,
  isGeneratingRules,
  onSanitizeCategories,
  onUpdateDashboardWidgets,
  transactions,
  onDeleteSource
}) => {
  // Local State
  const [editingCategory, setEditingCategory] = useState<{ oldName: string, newName: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newRule, setNewRule] = useState<{ keyword: string, category: string, isRegex: boolean }>({ keyword: '', category: '', isRegex: false });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  // Dashboard Widget State
  const [newWidgetQuery, setNewWidgetQuery] = useState('');
  const [isGeneratingWidget, setIsGeneratingWidget] = useState(false);
  const [previewWidgetConfig, setPreviewWidgetConfig] = useState<any>(null);

  // --- Widget Handlers ---
  const toggleWidgetVisibility = (id: string) => {
      onUpdateDashboardWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const deleteWidget = (id: string) => {
      if(confirm("Delete this custom graph?")) {
          onUpdateDashboardWidgets(prev => prev.filter(w => w.id !== id));
      }
  };

  const handlePreviewWidget = async () => {
      if(!newWidgetQuery.trim()) return;
      setIsGeneratingWidget(true);
      setPreviewWidgetConfig(null);
      try {
          const config = await generateDynamicChart(transactions, newWidgetQuery);
          setPreviewWidgetConfig(config);
      } catch(e) {
          console.error(e);
          alert("Failed to generate preview.");
      } finally {
          setIsGeneratingWidget(false);
      }
  };

  const handleSaveWidget = () => {
      if(!previewWidgetConfig) return;
      const newWidget: DashboardWidget = {
          id: `custom-${Date.now()}`,
          type: 'custom',
          title: previewWidgetConfig.title,
          description: newWidgetQuery,
          query: newWidgetQuery,
          cachedConfig: previewWidgetConfig,
          visible: true,
          width: 'half' // Default to half width
      };
      onUpdateDashboardWidgets(prev => [...prev, newWidget]);
      setPreviewWidgetConfig(null);
      setNewWidgetQuery('');
      alert("Graph added to Dashboard!");
  };

  // --- Rule Handlers ---
  const handleAddOrUpdateRule = () => {
    if (!newRule.keyword.trim() || !newRule.category) return;
    const cleanKeyword = newRule.isRegex ? newRule.keyword.trim() : newRule.keyword.trim().toLowerCase();

    if (newRule.isRegex) {
        try { new RegExp(cleanKeyword); } catch (e) { alert("Invalid Regular Expression"); return; }
    }

    if (editingRuleId) {
        onUpdateRules(prev => prev.map(r => r.id === editingRuleId ? { ...r, keyword: cleanKeyword, category: newRule.category, isRegex: newRule.isRegex } : r));
        setEditingRuleId(null);
    } else {
        onUpdateRules(prev => [...prev, { id: `rule-${Date.now()}`, keyword: cleanKeyword, category: newRule.category, isRegex: newRule.isRegex }]);
    }
    setNewRule({ keyword: '', category: '', isRegex: false });
  };

  const startEditingRule = (rule: CategorizationRule) => {
    setNewRule({ keyword: rule.keyword, category: rule.category, isRegex: !!rule.isRegex });
    setEditingRuleId(rule.id);
  };

  const cancelEditRule = () => {
    setNewRule({ keyword: '', category: '', isRegex: false });
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    onUpdateRules(prev => prev.filter(r => r.id !== id));
    if (editingRuleId === id) cancelEditRule();
  };

  // Category Handlers
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (activeSession.categories.includes(newCategoryName.trim())) { alert("Category already exists."); return; }
    onUpdateCategories([...activeSession.categories, newCategoryName.trim()]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    if (categoryToDelete === 'Uncategorized') { alert("Cannot delete the default 'Uncategorized' category."); return; }
    if (confirm(`Delete category '${categoryToDelete}'? Transactions will be 'Uncategorized'.`)) {
      const newCategories = activeSession.categories.filter(c => c !== categoryToDelete);
      onUpdateTransactions(prev => prev.map(t => t.category === categoryToDelete ? { ...t, category: 'Uncategorized' } : t));
      onUpdateCategories(newCategories);
    }
  };

  const startEditingCategory = (category: string) => setEditingCategory({ oldName: category, newName: category });
  const saveEditedCategory = () => {
    if (!editingCategory || !editingCategory.newName.trim()) return;
    if (editingCategory.newName !== editingCategory.oldName) {
       if (activeSession.categories.includes(editingCategory.newName)) { alert("Name exists."); return; }
       const newCategories = activeSession.categories.map(c => c === editingCategory.oldName ? editingCategory.newName : c);
       onUpdateCategories(newCategories, editingCategory.oldName, editingCategory.newName);
    }
    setEditingCategory(null);
  };
  
  // Source Handler
  const handleDeleteSource = (sourceName: string) => {
      const count = transactions.filter(t => t.source === sourceName).length;
      if (confirm(`Are you sure you want to delete source "${sourceName}"? \n\nThis will permanently delete ${count} associated transactions.`)) {
          onDeleteSource(sourceName);
      }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 max-w-4xl animate-fade-in space-y-8">
        
        {/* Import Settings */}
        <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Settings size={24} className="text-indigo-400"/>
                Import Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">CSV Delimiter</label>
                    <div className="flex gap-2">
                        {[';', ',', '|'].map(char => (
                            <button
                                key={char}
                                onClick={() => onUpdateSettings({ delimiter: char })}
                                className={`px-3 py-2 rounded border text-sm ${activeSession.importSettings.delimiter === char ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                            >
                               {char}
                            </button>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Date Format</label>
                    <select 
                        value={activeSession.importSettings.dateFormat}
                        onChange={(e) => onUpdateSettings({ dateFormat: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm"
                    >
                        <option value="DD.MM.YYYY">DD.MM.YYYY (DE)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Number Format</label>
                    <div className="flex gap-2">
                         <button onClick={() => onUpdateSettings({ decimalSeparator: ',' })} className={`px-3 py-2 rounded border text-sm ${activeSession.importSettings.decimalSeparator === ',' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>1.234,56</button>
                         <button onClick={() => onUpdateSettings({ decimalSeparator: '.' })} className={`px-3 py-2 rounded border text-sm ${activeSession.importSettings.decimalSeparator === '.' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>1,234.56</button>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Source Management */}
        <div className="border-t border-slate-700 pt-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Database size={24} className="text-cyan-400"/>
                Data Sources
            </h2>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <p className="text-sm text-slate-400 mb-4">Manage your import sources. Deleting a source removes all its transactions.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeSession.sources && activeSession.sources.length > 0 ? (
                        activeSession.sources.map(source => {
                            const count = transactions.filter(t => t.source === source).length;
                            return (
                                <div key={source} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700 group">
                                    <div>
                                        <div className="text-white text-sm font-medium">{source}</div>
                                        <div className="text-xs text-slate-500">{count} transactions</div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteSource(source)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                        title="Delete Source & Data"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-slate-500 text-sm col-span-3">No specific sources defined yet.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Dashboard Configuration */}
        <div className="border-t border-slate-700 pt-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Layout size={24} className="text-indigo-400"/>
                Dashboard Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manage Existing */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Visible Graphs</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {activeSession.dashboardWidgets?.map(widget => (
                            <div key={widget.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                <span className={`text-sm ${widget.visible ? 'text-white' : 'text-slate-500 line-through'}`}>{widget.title}</span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => toggleWidgetVisibility(widget.id)}
                                        className={`p-1.5 rounded transition-colors ${widget.visible ? 'text-indigo-400 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
                                        title={widget.visible ? "Hide" : "Show"}
                                    >
                                        {widget.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                                    </button>
                                    {widget.type === 'custom' && (
                                        <button 
                                            onClick={() => deleteWidget(widget.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                            title="Delete Custom Graph"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Custom */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400"/> 
                        Create Custom Graph
                    </h3>
                    <div className="flex-1 flex flex-col gap-3">
                        <textarea 
                            value={newWidgetQuery}
                            onChange={(e) => setNewWidgetQuery(e.target.value)}
                            placeholder="Describe graph (e.g. 'Coffee spending by month')"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500 flex-1"
                        />
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handlePreviewWidget}
                                disabled={isGeneratingWidget || !newWidgetQuery.trim()}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs font-medium py-2 rounded transition-colors flex justify-center items-center gap-2"
                            >
                                {isGeneratingWidget ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                Preview
                            </button>
                            {previewWidgetConfig && !isGeneratingWidget && (
                                <button 
                                    onClick={handleSaveWidget}
                                    className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 rounded transition-colors flex items-center gap-1"
                                >
                                    <Save size={14}/> Add
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Preview Area */}
                    {previewWidgetConfig && (
                        <div className="mt-3 h-24 bg-slate-900 rounded border border-slate-600 relative overflow-hidden flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                {renderPreviewChart(previewWidgetConfig) || <div/>}
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Session Data Management */}
        <div className="border-t border-slate-700 pt-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileJson size={24} className="text-indigo-400"/>
                Session Data Management
            </h2>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex flex-col md:flex-row gap-4">
                    <button 
                        onClick={onExportSession}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-4 py-3 rounded-lg transition-colors group"
                    >
                        <Download size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span>Export Complete Session</span>
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-500/20 group">
                        <Upload size={18} className="group-hover:scale-110 transition-transform" />
                        <span>Import Session Backup</span>
                        <input type="file" className="hidden" accept=".json" onChange={onImportSession} />
                    </label>
                </div>
            </div>
        </div>

        {/* Categorization Rules */}
        <div className="border-t border-slate-700 pt-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Zap size={24} className="text-yellow-400"/>
                    Categorization Rules
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={onApplyRulesToExisting}
                        className="flex items-center space-x-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors border border-slate-600"
                        title="Re-scan all transactions and apply rules"
                    >
                        <RefreshCw size={14} />
                        <span>Apply to All</span>
                    </button>
                    <button 
                        onClick={onGenerateRules}
                        disabled={isGeneratingRules}
                        className="flex items-center space-x-2 text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isGeneratingRules ? <BrainCircuit size={14} className="animate-spin"/> : <Wand2 size={14} />}
                        <span>AI: Auto-Generate Rules</span>
                    </button>
                </div>
            </div>
            
            {/* Add / Edit Rule */}
            <div className={`flex flex-col sm:flex-row gap-2 mb-4 p-3 rounded-lg border transition-colors ${editingRuleId ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="flex-1 flex gap-2">
                    <button 
                        onClick={() => setNewRule(prev => ({ ...prev, isRegex: !prev.isRegex }))}
                        className={`px-2 py-2 rounded border transition-colors ${newRule.isRegex ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-600 text-slate-500'}`}
                        title="Toggle Regex Mode"
                    >
                        <Regex size={16} />
                    </button>
                    <input 
                        type="text" 
                        placeholder={newRule.isRegex ? "Regex pattern (e.g. ^uber.*)" : "If description contains..."}
                        value={newRule.keyword}
                        onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none font-mono"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOrUpdateRule()}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={newRule.category}
                        onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                        className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none flex-1 sm:flex-none"
                    >
                        <option value="">Select Category</option>
                        {activeSession.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button 
                        onClick={handleAddOrUpdateRule} 
                        className={`${editingRuleId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-4 rounded text-sm font-medium transition-colors`}
                    >
                        {editingRuleId ? 'Update' : 'Add'}
                    </button>
                    {editingRuleId && (
                        <button 
                            onClick={cancelEditRule} 
                            className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 rounded text-sm transition-colors"
                            title="Cancel Edit"
                        >
                            <RotateCcw size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Rules List */}
            <div className="max-h-60 overflow-y-auto space-y-2">
                {activeSession.rules.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No rules defined yet.</p>
                ) : (
                    activeSession.rules.map(rule => (
                        <div key={rule.id} className={`flex justify-between items-center bg-slate-800 px-4 py-2 rounded border text-sm transition-colors ${editingRuleId === rule.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-slate-700'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-slate-400 whitespace-nowrap flex items-center gap-1">
                                    {rule.isRegex ? <Regex size={14} className="text-purple-400"/> : 'If contains'}
                                </span>
                                <span className="text-white font-mono bg-slate-900 px-1 rounded truncate max-w-[150px]" title={rule.keyword}>"{rule.keyword}"</span>
                                <span className="text-slate-400 whitespace-nowrap">set to</span>
                                <span className="text-indigo-400 font-medium truncate max-w-[150px]" title={rule.category}>{rule.category}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => startEditingRule(rule)} 
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                                    title="Edit Rule"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteRule(rule.id)} 
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                    title="Delete Rule"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Categories */}
        <div className="border-t border-slate-700 pt-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <List size={24} className="text-indigo-400"/>
                    Categories
                </h2>
                <button 
                    onClick={onSanitizeCategories}
                    className="flex items-center space-x-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors border border-slate-600"
                    title="Remove categories that are not used by any transaction"
                >
                    <Eraser size={14} />
                    <span>Clean Unused</span>
                </button>
            </div>
            <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New Category (e.g. Utilities.Water)..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"><Plus size={18} /> Add</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {activeSession.categories.map(cat => (
                    <div key={cat} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 group">
                        {editingCategory?.oldName === cat ? (
                            <div className="flex-1 flex gap-2">
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={editingCategory.newName}
                                    onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                                    className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && saveEditedCategory()}
                                />
                                <button onClick={saveEditedCategory} className="text-emerald-400 hover:text-emerald-300 p-1"><Check size={18} /></button>
                                <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-300 p-1"><X size={18} /></button>
                            </div>
                        ) : (
                            <>
                                <span className="text-slate-200 text-sm font-medium">{cat}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditingCategory(cat)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"><Trash2 size={14} /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default SettingsView;