import React, { useState } from 'react';
import { Session, CategorizationRule, ImportSettings } from '../types';
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
  onSanitizeCategories
}) => {
  // Local State
  const [editingCategory, setEditingCategory] = useState<{ oldName: string, newName: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newRule, setNewRule] = useState<{ keyword: string, category: string }>({ keyword: '', category: '' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Rule Handlers
  const handleAddOrUpdateRule = () => {
    if (!newRule.keyword.trim() || !newRule.category) return;
    const cleanKeyword = newRule.keyword.trim().toLowerCase();

    if (editingRuleId) {
        onUpdateRules(prev => prev.map(r => r.id === editingRuleId ? { ...r, keyword: cleanKeyword, category: newRule.category } : r));
        setEditingRuleId(null);
    } else {
        onUpdateRules(prev => [...prev, { id: `rule-${Date.now()}`, keyword: cleanKeyword, category: newRule.category }]);
    }
    setNewRule({ keyword: '', category: '' });
  };

  const startEditingRule = (rule: CategorizationRule) => {
    setNewRule({ keyword: rule.keyword, category: rule.category });
    setEditingRuleId(rule.id);
  };

  const cancelEditRule = () => {
    setNewRule({ keyword: '', category: '' });
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    onUpdateRules(prev => prev.filter(r => r.id !== id));
    if (editingRuleId === id) cancelEditRule();
  };

  // Category Handlers
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (activeSession.categories.includes(newCategoryName.trim())) {
      alert("Category already exists.");
      return;
    }
    onUpdateCategories([...activeSession.categories, newCategoryName.trim()]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    if (categoryToDelete === 'Uncategorized') {
      alert("Cannot delete the default 'Uncategorized' category.");
      return;
    }
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
       if (activeSession.categories.includes(editingCategory.newName)) {
         alert("Name exists."); return;
       }
       const newCategories = activeSession.categories.map(c => c === editingCategory.oldName ? editingCategory.newName : c);
       onUpdateCategories(newCategories, editingCategory.oldName, editingCategory.newName);
    }
    setEditingCategory(null);
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
                <p className="text-slate-500 mt-3 text-xs text-center">
                    Export saves transactions, categories, rules, and settings to a JSON file. Importing will create a new session from that file.
                </p>
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
            
            <p className="text-slate-400 mb-4 text-sm">Rules are applied automatically when importing files.</p>

            {/* Add / Edit Rule */}
            <div className={`flex gap-2 mb-4 p-3 rounded-lg border transition-colors ${editingRuleId ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
                <input 
                    type="text" 
                    placeholder="If description contains..." 
                    value={newRule.keyword}
                    onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOrUpdateRule()}
                />
                <select
                    value={newRule.category}
                    onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
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

            {/* Rules List */}
            <div className="max-h-60 overflow-y-auto space-y-2">
                {activeSession.rules.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No rules defined yet.</p>
                ) : (
                    activeSession.rules.map(rule => (
                        <div key={rule.id} className={`flex justify-between items-center bg-slate-800 px-4 py-2 rounded border text-sm transition-colors ${editingRuleId === rule.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-slate-700'}`}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-slate-400 whitespace-nowrap">If contains</span>
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
                    placeholder="New Category..."
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