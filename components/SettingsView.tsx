import React, { useState, useEffect } from 'react';
import { Session, CategorizationRule, ImportSettings, Transaction, DashboardWidget, GoogleUser } from '../types';
import { 
  FileJson, 
  Download, 
  Upload, 
  Zap, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  List, 
  Eraser, 
  Plus, 
  Regex,
  Sparkles,
  Loader2,
  Save,
  Database,
  Cloud,
  CloudOff,
  LogOut,
  Info,
  Key,
  CheckCircle,
  AlertCircle,
  Globe,
  LayoutDashboard,
  Eye,
  EyeOff,
  X
} from 'lucide-react';

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
  googleUser: GoogleUser | null;
  onGoogleLogin: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;
  isSyncing: boolean;
  onUpdateCurrency: (currency: string) => void;
}

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
  onDeleteSource,
  googleUser,
  onGoogleLogin,
  onCloudSave,
  onCloudLoad,
  isSyncing,
  onUpdateCurrency
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newRule, setNewRule] = useState<{ keyword: string, category: string, isRegex: boolean }>({ keyword: '', category: '', isRegex: false });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

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

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (activeSession.categories.includes(newCategoryName.trim())) { alert("Category already exists."); return; }
    onUpdateCategories([...activeSession.categories, newCategoryName.trim()]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === 'Income' || cat === 'Uncategorized') {
      alert("Cannot delete reserved categories.");
      return;
    }
    if (confirm(`Delete category "${cat}"? Transactions in this category will be moved to "Uncategorized".`)) {
        const newCategories = activeSession.categories.filter(c => c !== cat);
        onUpdateCategories(newCategories, cat, 'Uncategorized');
    }
  };

  const currencyOptions = [
      { code: '$', label: 'USD/CAD/AUD ($)' },
      { code: '€', label: 'Euro (€)' },
      { code: '£', label: 'Pound (£)' },
      { code: '¥', label: 'Yen (¥)' },
      { code: '₹', label: 'Rupee (₹)' },
      { code: 'CHF', label: 'Swiss Franc (CHF)' },
      { code: 'kr', label: 'Krona (kr)' },
      { code: 'R$', label: 'Real (R$)' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20 relative">
      
      {/* 1. AI Configuration */}
      <section className="bg-surface rounded-xl border border-indigo-500/30 overflow-hidden shadow-lg shadow-indigo-500/5">
        <div className="p-6 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                    <Key size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">AI Reasoning Service</h3>
                    <p className="text-sm text-slate-400">Powered by Google Gemini.</p>
                </div>
            </div>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 font-medium">Service Provider:</span>
                    <span className="text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wider">Google Gemini API</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 font-medium">Status:</span>
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle size={14} /> Active (Managed by Platform)
                    </span>
                </div>
                <p className="text-[11px] text-slate-500 italic max-w-lg mt-1">
                    The AI service is pre-configured and managed by the platform environment. No manual key setup required.
                </p>
            </div>
        </div>
      </section>

      {/* 2. Dashboard Widgets */}
      <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-700 bg-slate-800/30 flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><LayoutDashboard size={24} /></div>
            <div>
                <h3 className="text-xl font-bold text-white">Dashboard Widgets</h3>
                <p className="text-sm text-slate-400">Manage visibility of your charts.</p>
            </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSession.dashboardWidgets.map(widget => (
                <div key={widget.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${widget.visible ? 'bg-slate-800 border-slate-600' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                    <span className="text-sm font-medium text-slate-200 truncate pr-2">{widget.title}</span>
                    <button 
                        onClick={() => onUpdateDashboardWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, visible: !w.visible } : w))}
                        className={`p-2 rounded-lg transition-colors ${widget.visible ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-slate-500 bg-slate-800 hover:text-slate-300'}`}
                        title={widget.visible ? "Hide Widget" : "Show Widget"}
                    >
                        {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                </div>
            ))}
        </div>
      </section>

      {/* 3. Google Drive Sync */}
      <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                    <Cloud size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Google Drive Sync</h3>
                    <p className="text-sm text-slate-400">Keep your finances backed up and synced across devices.</p>
                </div>
            </div>
            {googleUser && (
                <button className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                    <LogOut size={14} /> Disconnect
                </button>
            )}
        </div>
        <div className="p-6">
            {!googleUser ? (
                <div className="flex flex-col items-center py-8 text-center max-w-sm mx-auto">
                    <div className="bg-slate-900 p-4 rounded-full mb-4">
                        <CloudOff size={48} className="text-slate-600" />
                    </div>
                    <h4 className="text-white font-bold mb-2">Cloud Storage is Disabled</h4>
                    <p className="text-sm text-slate-400 mb-6">
                        Log in with your Google account to save your sessions to a private file in your Google Drive.
                    </p>
                    <button 
                        onClick={onGoogleLogin}
                        className="bg-white hover:bg-slate-100 text-slate-900 px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-xl"
                    >
                        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="google" />
                        Sign in with Google
                    </button>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex-1 w-full">
                        <img src={googleUser.picture} className="w-16 h-16 rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/20" alt="profile" />
                        <div>
                            <h4 className="text-white font-bold">{googleUser.name}</h4>
                            <p className="text-sm text-slate-500">{googleUser.email}</p>
                            <div className="mt-2 text-[10px] text-indigo-400 font-bold flex items-center gap-1 uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                                Authenticated
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[200px]">
                        <button 
                            onClick={onCloudSave}
                            disabled={isSyncing}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                        >
                            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            Save to Cloud
                        </button>
                        <button 
                            onClick={onCloudLoad}
                            disabled={isSyncing}
                            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"
                        >
                            <Download size={18} />
                            Load from Cloud
                        </button>
                    </div>
                </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
                <Info size={14} />
                <span>
                    We only request access to files created by this app (<code>finsight_backup_cloud.json</code>). 
                    Your privacy is protected by the Google Drive "file-scope" permission.
                </span>
            </div>
        </div>
      </section>

      {/* 4. Session Data (Import/Export/Currency) */}
      <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-lg">
         <div className="p-6 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400">
                    <Database size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Session Data</h3>
                    <p className="text-sm text-slate-400">Manage sources, currency, and backup.</p>
                </div>
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-600 transition-all cursor-pointer">
                  <Upload size={18} /> Import Session
                  <input type="file" accept=".json" onChange={onImportSession} className="hidden" />
              </label>
              <button onClick={onExportSession} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
                  <Download size={18} /> Export Session
              </button>
            </div>
        </div>
        <div className="p-6">
            
            {/* Currency Selector */}
            <div className="mb-8 border-b border-slate-700 pb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Globe size={14} /> Currency & Region
                </h4>
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between max-w-xl">
                    <div>
                        <p className="text-white font-medium text-sm">Display Symbol</p>
                        <p className="text-xs text-slate-500">Changes the currency symbol across the dashboard.</p>
                    </div>
                    <select 
                        value={activeSession.currency || '$'}
                        onChange={(e) => onUpdateCurrency(e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                        {currencyOptions.map(opt => (
                            <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Imported Sources</h4>
            <div className="space-y-3 max-w-2xl">
                {(activeSession.sources || []).map(source => (
                    <div key={source} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl p-4 group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><FileJson size={20}/></div>
                            <div>
                                <h5 className="font-bold text-white text-sm">{source}</h5>
                                <p className="text-[10px] text-slate-500">
                                    {transactions.filter(t => t.source === source).length} transactions linked
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => onDeleteSource(source)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete Source & Transactions"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {(activeSession.sources || []).length === 0 && (
                    <div className="text-center p-8 bg-slate-900 border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
                        No external sources imported yet.
                    </div>
                )}
            </div>
        </div>
      </section>

      {/* 5. Categorization Rules */}
      <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                    <Zap size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Auto-Categorization Rules</h3>
                    <p className="text-sm text-slate-400">Rules are checked against transaction descriptions.</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={onGenerateRules}
                    disabled={isGeneratingRules}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                >
                    {isGeneratingRules ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    AI Generate Rules
                </button>
                <button 
                    onClick={onApplyRulesToExisting}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-600 transition-all"
                >
                    <RefreshCw size={16} />
                    Apply All Rules
                </button>
            </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Rule Form */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">{editingRuleId ? 'Edit Rule' : 'Add New Rule'}</h4>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-slate-500">Description Keyword</label>
                            <button onClick={() => setNewRule({...newRule, isRegex: !newRule.isRegex})} className={`text-[10px] font-bold px-1.5 rounded ${newRule.isRegex ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                REGEX
                            </button>
                        </div>
                        <input 
                            type="text"
                            value={newRule.keyword}
                            onChange={(e) => setNewRule({...newRule, keyword: e.target.value})}
                            placeholder={newRule.isRegex ? "e.g. ^uber.*" : "e.g. netflix"}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Target Category</label>
                        <select 
                            value={newRule.category}
                            onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">Select Category</option>
                            {activeSession.categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        {editingRuleId && <button onClick={cancelEditRule} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-lg text-sm font-bold">Cancel</button>}
                        <button 
                            onClick={handleAddOrUpdateRule}
                            disabled={!newRule.keyword || !newRule.category}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                        >
                            {editingRuleId ? <Save size={16}/> : <Plus size={16}/>}
                            {editingRuleId ? 'Save Rule' : 'Add Rule'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Rule List */}
            <div className="lg:col-span-2 overflow-hidden border border-slate-700 rounded-xl bg-slate-900/20">
                <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 text-slate-500 text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-3">Match Pattern</th>
                                <th className="p-3 text-center">Type</th>
                                <th className="p-3">Assign Category</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {activeSession.rules.length === 0 ? (
                                <tr><td colSpan={4} className="p-10 text-center text-slate-600 italic">No rules defined yet. Use AI to generate some from history!</td></tr>
                            ) : (
                                activeSession.rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-3 font-mono text-indigo-300 font-bold">{rule.keyword}</td>
                                        <td className="p-3 text-center">
                                            {rule.isRegex ? <Regex size={14} className="inline text-indigo-400" /> : <span className="text-[10px] text-slate-500">SUBSTR</span>}
                                        </td>
                                        <td className="p-3"><span className="bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded text-xs border border-indigo-500/20">{rule.category}</span></td>
                                        <td className="p-3 text-right space-x-2">
                                            <button onClick={() => startEditingRule(rule)} className="text-slate-500 hover:text-white transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </section>

      {/* 6. Category Manager */}
      <section className="bg-surface rounded-xl border border-slate-700 overflow-hidden shadow-lg">
         <div className="p-6 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                    <List size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Categories</h3>
                    <p className="text-sm text-slate-400">Add, rename or clean up your spending categories.</p>
                </div>
            </div>
            <button 
                onClick={onSanitizeCategories}
                className="flex items-center gap-2 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-bold transition-all"
            >
                <Eraser size={16} /> Clean Unused
            </button>
        </div>
        <div className="p-6">
            <div className="flex gap-3 mb-6 max-w-md">
                <input 
                    type="text" 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="New category name..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-indigo-500/20">
                    <Plus size={18} /> Add
                </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeSession.categories.map(cat => (
                    <div key={cat} className="group relative bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between hover:border-indigo-500/50 transition-all">
                        <span className="text-sm font-medium text-slate-300 truncate">{cat}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDeleteCategory(cat)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsView;