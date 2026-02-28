import React, { useState, useEffect } from 'react';
import { Session, CategorizationRule, ImportSettings, Transaction, DashboardWidget, GoogleUser } from '../types';
import { useTheme } from './ThemeContext';
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
  X,
  Moon,
  Sun,
  Monitor
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

  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8 animate-fade-in pb-20 relative">

      {/* 0. Appearance */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg shadow-primary/5">
        <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                    <Monitor size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">Appearance</h3>
                    <p className="text-sm text-textMuted">Customize the look and feel of the application.</p>
                </div>
            </div>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex bg-surfaceHighlight p-1 rounded-xl border border-border w-full max-w-md">
                <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'light' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                >
                    <Sun size={16} /> Light
                </button>
                <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'dark' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                >
                    <Moon size={16} /> Dark
                </button>
                <button 
                    onClick={() => setTheme('system')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'system' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                >
                    <Monitor size={16} /> System
                </button>
            </div>
        </div>
      </section>
      
      {/* 1. AI Configuration */}
      <section className="bg-surface rounded-xl border border-primary/30 overflow-hidden shadow-lg shadow-primary/5">
        <div className="p-6 border-b border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                    <Key size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">AI Reasoning Service</h3>
                    <p className="text-sm text-textMuted">Powered by Google Gemini.</p>
                </div>
            </div>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-textMuted font-medium">Service Provider:</span>
                    <span className="text-xs bg-surfaceHighlight text-primary px-2 py-0.5 rounded border border-primary/20 font-bold uppercase tracking-wider">Google Gemini API</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-textMuted font-medium">Status:</span>
                    <span className="text-xs text-secondary flex items-center gap-1 font-bold">
                        <CheckCircle size={14} /> Active (Managed by Platform)
                    </span>
                </div>
                <p className="text-[11px] text-textMuted italic max-w-lg mt-1">
                    The AI service is pre-configured and managed by the platform environment. No manual key setup required.
                </p>
            </div>
        </div>
      </section>

      {/* 2. Dashboard Widgets */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><LayoutDashboard size={24} /></div>
            <div>
                <h3 className="text-xl font-bold text-textMain">Dashboard Widgets</h3>
                <p className="text-sm text-textMuted">Manage visibility of your charts.</p>
            </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSession.dashboardWidgets.map(widget => (
                <div key={widget.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${widget.visible ? 'bg-surfaceHighlight border-border' : 'bg-background border-border opacity-60'}`}>
                    <span className="text-sm font-medium text-textMain truncate pr-2">{widget.title}</span>
                    <button 
                        onClick={() => onUpdateDashboardWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, visible: !w.visible } : w))}
                        className={`p-2 rounded-lg transition-colors ${widget.visible ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-textMuted bg-surfaceHighlight hover:text-textMain'}`}
                        title={widget.visible ? "Hide Widget" : "Show Widget"}
                    >
                        {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                </div>
            ))}
        </div>
      </section>

      {/* 3. Google Drive Sync */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                    <Cloud size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">Google Drive Sync</h3>
                    <p className="text-sm text-textMuted">Keep your finances backed up and synced across devices.</p>
                </div>
            </div>
            {googleUser && (
                <button className="text-xs text-textMuted hover:text-danger flex items-center gap-1 transition-colors">
                    <LogOut size={14} /> Disconnect
                </button>
            )}
        </div>
        <div className="p-6">
            {!googleUser ? (
                <div className="flex flex-col items-center py-8 text-center max-w-sm mx-auto">
                    <div className="bg-background p-4 rounded-full mb-4">
                        <CloudOff size={48} className="text-textMuted" />
                    </div>
                    <h4 className="text-textMain font-bold mb-2">Cloud Storage is Disabled</h4>
                    <p className="text-sm text-textMuted mb-6">
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
                    <div className="flex items-center gap-4 bg-background/50 p-4 rounded-xl border border-border flex-1 w-full">
                        <img src={googleUser.picture} className="w-16 h-16 rounded-full border-2 border-primary shadow-lg shadow-primary/20" alt="profile" />
                        <div>
                            <h4 className="text-textMain font-bold">{googleUser.name}</h4>
                            <p className="text-sm text-textMuted">{googleUser.email}</p>
                            <div className="mt-2 text-[10px] text-primary font-bold flex items-center gap-1 uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                Authenticated
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[200px]">
                        <button 
                            onClick={onCloudSave}
                            disabled={isSyncing}
                            className="bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                        >
                            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            Save to Cloud
                        </button>
                        <button 
                            onClick={onCloudLoad}
                            disabled={isSyncing}
                            className="bg-surfaceHighlight hover:bg-surfaceHighlight/80 disabled:bg-background text-textMain px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border border-border transition-all"
                        >
                            <Download size={18} />
                            Load from Cloud
                        </button>
                    </div>
                </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-border flex items-center gap-2 text-[11px] text-textMuted">
                <Info size={14} />
                <span>
                    We only request access to files created by this app (<code>finsight_backup_cloud.json</code>). 
                    Your privacy is protected by the Google Drive "file-scope" permission.
                </span>
            </div>
        </div>
      </section>

      {/* 4. Session Data (Import/Export/Currency) */}
      <section id="tutorial-session-data" className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg">
         <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400">
                    <Database size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">Session Data</h3>
                    <p className="text-sm text-textMuted">Manage sources, currency, and backup.</p>
                </div>
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain px-4 py-2 rounded-lg text-sm font-bold border border-border transition-all cursor-pointer">
                  <Upload size={18} /> Import Session
                  <input type="file" accept=".json" onChange={onImportSession} className="hidden" />
              </label>
              <button onClick={onExportSession} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20">
                  <Download size={18} /> Export Session
              </button>
            </div>
        </div>
        <div className="p-6">
            
            {/* Currency Selector */}
            <div className="mb-8 border-b border-border pb-6">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Globe size={14} /> Currency & Region
                </h4>
                <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between max-w-xl">
                    <div>
                        <p className="text-textMain font-medium text-sm">Display Symbol</p>
                        <p className="text-xs text-textMuted">Changes the currency symbol across the dashboard.</p>
                    </div>
                    <select 
                        value={activeSession.currency || '$'}
                        onChange={(e) => onUpdateCurrency(e.target.value)}
                        className="bg-surfaceHighlight border border-border rounded-lg px-3 py-2 text-textMain text-sm focus:outline-none focus:border-primary"
                    >
                        {currencyOptions.map(opt => (
                            <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <h4 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-4">Imported Sources</h4>
            <div className="space-y-3 max-w-2xl">
                {(activeSession.sources || []).map(source => (
                    <div key={source} className="flex items-center justify-between bg-background border border-border rounded-xl p-4 group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><FileJson size={20}/></div>
                            <div>
                                <h5 className="font-bold text-textMain text-sm">{source}</h5>
                                <p className="text-[10px] text-textMuted">
                                    {transactions.filter(t => t.source === source).length} transactions linked
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => onDeleteSource(source)}
                            className="p-2 text-textMuted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                            title="Delete Source & Transactions"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {(activeSession.sources || []).length === 0 && (
                    <div className="text-center p-8 bg-background border-2 border-dashed border-border rounded-xl text-textMuted">
                        No external sources imported yet.
                    </div>
                )}
            </div>
        </div>
      </section>

      {/* 5. Categorization Rules */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                    <Zap size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">Auto-Categorization Rules</h3>
                    <p className="text-sm text-textMuted">Rules are checked against transaction descriptions.</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={onGenerateRules}
                    disabled={isGeneratingRules}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                >
                    {isGeneratingRules ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    AI Generate Rules
                </button>
                <button 
                    onClick={onApplyRulesToExisting}
                    className="flex items-center gap-2 bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMain px-4 py-2 rounded-lg text-sm font-bold border border-border transition-all"
                >
                    <RefreshCw size={16} />
                    Apply All Rules
                </button>
            </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Rule Form */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-background/50 p-4 rounded-xl border border-border space-y-4">
                    <h4 className="text-sm font-bold text-textMain uppercase tracking-wider">{editingRuleId ? 'Edit Rule' : 'Add New Rule'}</h4>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-textMuted">Description Keyword</label>
                            <button onClick={() => setNewRule({...newRule, isRegex: !newRule.isRegex})} className={`text-[10px] font-bold px-1.5 rounded ${newRule.isRegex ? 'bg-primary text-white' : 'bg-surfaceHighlight text-textMuted'}`}>
                                REGEX
                            </button>
                        </div>
                        <input 
                            type="text"
                            value={newRule.keyword}
                            onChange={(e) => setNewRule({...newRule, keyword: e.target.value})}
                            placeholder={newRule.isRegex ? "e.g. ^uber.*" : "e.g. netflix"}
                            className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-sm text-textMain focus:outline-none focus:border-primary font-mono"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-textMuted block mb-1">Target Category</label>
                        <select 
                            value={newRule.category}
                            onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                            className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-sm text-textMain focus:outline-none focus:border-primary"
                        >
                            <option value="">Select Category</option>
                            {activeSession.categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        {editingRuleId && <button onClick={cancelEditRule} className="flex-1 bg-surfaceHighlight text-textMuted py-2 rounded-lg text-sm font-bold">Cancel</button>}
                        <button 
                            onClick={handleAddOrUpdateRule}
                            disabled={!newRule.keyword || !newRule.category}
                            className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight disabled:text-textMuted text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                        >
                            {editingRuleId ? <Save size={16}/> : <Plus size={16}/>}
                            {editingRuleId ? 'Save Rule' : 'Add Rule'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Rule List */}
            <div className="lg:col-span-2 overflow-hidden border border-border rounded-xl bg-background/20">
                <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-background text-textMuted text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-3">Match Pattern</th>
                                <th className="p-3 text-center">Type</th>
                                <th className="p-3">Assign Category</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {activeSession.rules.length === 0 ? (
                                <tr><td colSpan={4} className="p-10 text-center text-textMuted italic">No rules defined yet. Use AI to generate some from history!</td></tr>
                            ) : (
                                activeSession.rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-surfaceHighlight/30 transition-colors group">
                                        <td className="p-3 font-mono text-primary font-bold">{rule.keyword}</td>
                                        <td className="p-3 text-center">
                                            {rule.isRegex ? <Regex size={14} className="inline text-primary" /> : <span className="text-[10px] text-textMuted">SUBSTR</span>}
                                        </td>
                                        <td className="p-3"><span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs border border-primary/20">{rule.category}</span></td>
                                        <td className="p-3 text-right space-x-2">
                                            <button onClick={() => startEditingRule(rule)} className="text-textMuted hover:text-textMain transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDeleteRule(rule.id)} className="text-textMuted hover:text-danger transition-colors"><Trash2 size={16}/></button>
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
      <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-lg">
         <div className="p-6 border-b border-border bg-surfaceHighlight/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-secondary/20 p-2 rounded-lg text-secondary">
                    <List size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-textMain">Categories</h3>
                    <p className="text-sm text-textMuted">Add, rename or clean up your spending categories.</p>
                </div>
            </div>
            <button 
                onClick={onSanitizeCategories}
                className="flex items-center gap-2 text-danger hover:bg-danger/10 px-4 py-2 rounded-lg text-sm font-bold transition-all"
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
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary"
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <button onClick={handleAddCategory} className="bg-primary hover:bg-primary/90 text-white px-4 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary/20">
                    <Plus size={18} /> Add
                </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activeSession.categories.map(cat => (
                    <div key={cat} className="group relative bg-surfaceHighlight/50 border border-border rounded-lg px-3 py-2 flex items-center justify-between hover:border-primary/50 transition-all">
                        <span className="text-sm font-medium text-textMain truncate">{cat}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDeleteCategory(cat)} className="p-1 text-textMuted hover:text-danger"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-surface rounded-xl border border-danger/30 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-danger/20 bg-danger/5 flex items-center gap-3">
            <div className="bg-danger/20 p-2 rounded-lg text-danger"><AlertCircle size={24} /></div>
            <div>
                <h3 className="text-xl font-bold text-textMain">Danger Zone</h3>
                <p className="text-sm text-textMuted">Irreversible actions.</p>
            </div>
        </div>
        <div className="p-6">
            <div className="flex items-center justify-between p-4 border border-danger/20 rounded-xl bg-danger/5">
                <div>
                    <h4 className="font-bold text-textMain">Clear All Data</h4>
                    <p className="text-sm text-textMuted">Permanently delete all sessions and reset the application.</p>
                </div>
                <button 
                    onClick={() => {
                        if(window.confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="bg-danger hover:bg-danger/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-danger/20"
                >
                    <Eraser size={16} />
                    Reset App
                </button>
            </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsView;