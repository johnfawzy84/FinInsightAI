import React, { useState, useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { Transaction, Category, TransactionType, Session, ImportSettings, DEFAULT_CATEGORIES, CategorizationRule } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AIConsultant from './components/AIConsultant';
import TransactionDetailModal from './components/TransactionDetailModal';
import { categorizeTransactionsAI, generateRulesFromHistory } from './services/gemini';
import { parseFile } from './utils/parser';
import { 
  LayoutDashboard, 
  List, 
  MessageSquareText, 
  Upload, 
  BrainCircuit, 
  ShieldCheck, 
  Plus, 
  Folder, 
  Trash2, 
  X,
  ChevronRight,
  ChevronDown,
  Settings,
  Edit2,
  Check,
  Wand2,
  Zap,
  Download,
  FileJson,
  RotateCcw,
  RefreshCw,
  Loader2,
  CheckCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'consultant' | 'settings'>('dashboard');
  
  // Initial Mock Data
  const initialTransactions: Transaction[] = [
    { id: '1', date: '2023-10-01', description: 'Monthly Salary', amount: 5000, type: TransactionType.INCOME, category: Category.INCOME },
    { id: '2', date: '2023-10-02', description: 'Rent Payment', amount: 1500, type: TransactionType.EXPENSE, category: Category.HOUSING },
    { id: '3', date: '2023-10-05', description: 'Grocery Store', amount: 150, type: TransactionType.EXPENSE, category: Category.FOOD },
    { id: '4', date: '2023-10-06', description: 'Uber Trip', amount: 25, type: TransactionType.EXPENSE, category: Category.TRANSPORT },
    { id: '5', date: '2023-10-08', description: 'Netflix Subscription', amount: 15, type: TransactionType.EXPENSE, category: Category.ENTERTAINMENT },
    { id: '6', date: '2023-10-10', description: 'Electric Bill', amount: 120, type: TransactionType.EXPENSE, category: Category.UTILITIES },
  ];

  const defaultSettings: ImportSettings = {
    delimiter: ';', 
    dateFormat: 'DD.MM.YYYY',
    decimalSeparator: ','
  };

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'default-session',
      name: 'Personal Finance',
      transactions: initialTransactions,
      categories: [...DEFAULT_CATEGORIES],
      rules: [],
      createdAt: Date.now(),
      importSettings: defaultSettings
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default-session');
  
  // UI State for session management
  const [isSessionsExpanded, setIsSessionsExpanded] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState(false);

  // Settings State
  const [editingCategory, setEditingCategory] = useState<{ oldName: string, newName: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Rules State
  const [newRule, setNewRule] = useState<{ keyword: string, category: string }>({ keyword: '', category: '' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Bulk Update State
  const [bulkUpdateProposal, setBulkUpdateProposal] = useState<{
    targetDescription: string;
    newCategory: string;
    count: number;
    transactionIds: string[];
  } | null>(null);

  // Detail View State
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Rule Application Progress State
  const [ruleApplicationStatus, setRuleApplicationStatus] = useState<{
    active: boolean;
    progress: number;
    total: number;
    updated: number;
    finished: boolean;
  } | null>(null);

  // Computed active session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  // Derived data for Detail Modal
  const selectedTransactionData = useMemo(() => {
    if (!selectedTransactionId) return null;
    const transaction = activeSession.transactions.find(t => t.id === selectedTransactionId);
    if (!transaction) return null;

    // Similar transactions (same description, case-insensitive)
    const similar = activeSession.transactions.filter(t => 
        t.description.toLowerCase().trim() === transaction.description.toLowerCase().trim()
    );

    // Transactions in same category
    const inCategory = activeSession.transactions.filter(t => t.category === transaction.category);

    // Find active rule for this transaction
    // Logic matches applyRulesToTransactions: sort by specificity first
    const sortedRules = [...activeSession.rules].sort((a, b) => b.keyword.length - a.keyword.length);
    const activeRule = sortedRules.find(r => 
        transaction.description.toLowerCase().includes(r.keyword.toLowerCase())
    );

    return { transaction, similar, inCategory, activeRule };
  }, [selectedTransactionId, activeSession]);


  // Helper to update transactions for the active session
  const updateActiveSessionTransactions = (
    updater: (currentTransactions: Transaction[]) => Transaction[]
  ) => {
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeSessionId) {
        return { ...session, transactions: updater(session.transactions) };
      }
      return session;
    }));
  };

  // Helper to update settings for active session
  const updateActiveSessionSettings = (newSettings: Partial<ImportSettings>) => {
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeSessionId) {
        return { ...session, importSettings: { ...session.importSettings, ...newSettings } };
      }
      return session;
    }));
  };

  // Helper to update categories for active session
  const updateActiveSessionCategories = (newCategories: string[], renamedFrom?: string, renamedTo?: string) => {
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeSessionId) {
        let updatedTransactions = session.transactions;
        if (renamedFrom && renamedTo) {
          updatedTransactions = session.transactions.map(t => 
            t.category === renamedFrom ? { ...t, category: renamedTo } : t
          );
        }
        return { ...session, categories: newCategories, transactions: updatedTransactions };
      }
      return session;
    }));
  };

  // Helper to update Rules
  const updateActiveSessionRules = (updater: (rules: CategorizationRule[]) => CategorizationRule[]) => {
    setSessions(prevSessions => prevSessions.map(session => {
      if (session.id === activeSessionId) {
        return { ...session, rules: updater(session.rules) };
      }
      return session;
    }));
  };

  // Synchronous Rule Application Logic (for internal use)
  const applyRulesToTransactions = (transactions: Transaction[], rules: CategorizationRule[]): Transaction[] => {
    if (rules.length === 0) return transactions;
    
    // Sort rules by specificity (length of keyword descending).
    const sortedRules = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

    return transactions.map(t => {
      const matchingRule = sortedRules.find(r => t.description.toLowerCase().includes(r.keyword.toLowerCase()));
      return matchingRule ? { ...t, category: matchingRule.category } : t;
    });
  };

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name: newSessionName,
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      rules: [],
      createdAt: Date.now(),
      importSettings: { ...defaultSettings }
    };
    
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
    setNewSessionName('');
    setIsCreatingSession(false);
    setActiveTab('dashboard'); 
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      alert("You must have at least one session.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this session?")) {
      const newSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(newSessions);
      if (activeSessionId === sessionId) {
        setActiveSessionId(newSessions[0].id);
      }
    }
  };

  const handleExportSession = () => {
    const dataStr = JSON.stringify(activeSession, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSession.name.replace(/\s+/g, '_')}_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic validation schema check
        if (!json.transactions || !Array.isArray(json.transactions) || !json.categories) {
            throw new Error("Invalid file structure");
        }

        const newSession: Session = {
            ...json,
            id: `session-${Date.now()}`, // Force new ID
            name: json.name ? `${json.name} (Imported)` : 'Imported Session',
            createdAt: Date.now()
        };

        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        alert("Session imported successfully!");
      } catch (err) {
        console.error(err);
        alert("Failed to import session. Invalid JSON format.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const rawTransactions = await parseFile(file, activeSession.importSettings);
        
        // 1. Extract new categories
        const importedCategories = Array.from(new Set(rawTransactions.map(t => t.category)))
            .filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized' && !activeSession.categories.includes(cat));

        // 2. Apply Existing Rules
        const processedTransactions = applyRulesToTransactions(rawTransactions, activeSession.rules);

        setSessions(prevSessions => prevSessions.map(session => {
          if (session.id === activeSessionId) {
            const updatedCategories = [...session.categories, ...importedCategories];
            return { 
                ...session, 
                transactions: [...session.transactions, ...processedTransactions],
                categories: updatedCategories
            };
          }
          return session;
        }));

        setActiveTab('transactions');
      } catch (err) {
        console.error("Failed to parse file", err);
        alert("Error parsing file. Check your Import Settings.");
      }
      e.target.value = ''; 
    }
  };

  const handleAutoCategorize = async () => {
    const currentTransactions = activeSession.transactions;
    // Only categorize items that are Uncategorized AND do not match existing rules
    // (Rules should ideally be applied already, but let's be safe)
    const uncategorized = currentTransactions.filter(t => 
        (t.category === Category.UNCATEGORIZED || t.category === 'Uncategorized' || t.category === 'General')
    );

    if (uncategorized.length === 0) {
        alert("All transactions are already categorized!");
        return;
    }

    setIsCategorizing(true);
    try {
        const results = await categorizeTransactionsAI(
            uncategorized.map(t => ({ id: t.id, description: t.description, amount: t.amount })),
            activeSession.categories
        );

        updateActiveSessionTransactions(prev => prev.map(t => {
            const match = results.find(r => r.id === t.id);
            return match ? { ...t, category: match.category } : t;
        }));
    } catch (err) {
        console.error("Categorization failed", err);
        alert("AI Categorization failed.");
    } finally {
        setIsCategorizing(false);
    }
  };

  const handleTransactionCategoryChange = (transactionId: string, newCategory: string) => {
    // 1. Update the target transaction immediately
    const targetTransaction = activeSession.transactions.find(t => t.id === transactionId);
    if (!targetTransaction) return;

    updateActiveSessionTransactions(prev => prev.map(t => 
      t.id === transactionId ? { ...t, category: newCategory } : t
    ));

    // 2. "Smart Update": Check if other transactions have the exact same description but different category
    const similarTransactions = activeSession.transactions.filter(t => 
      t.id !== transactionId && 
      t.description.trim().toLowerCase() === targetTransaction.description.trim().toLowerCase() &&
      t.category !== newCategory
    );

    if (similarTransactions.length > 0) {
      setBulkUpdateProposal({
        targetDescription: targetTransaction.description,
        newCategory,
        count: similarTransactions.length,
        transactionIds: similarTransactions.map(t => t.id)
      });
    }
  };

  const confirmBulkUpdate = (createRule: boolean) => {
    if (!bulkUpdateProposal) return;

    // Update similar transactions
    updateActiveSessionTransactions(prev => prev.map(t => 
      bulkUpdateProposal.transactionIds.includes(t.id) 
        ? { ...t, category: bulkUpdateProposal.newCategory } 
        : t
    ));

    // Optionally create a rule
    if (createRule) {
      const newRule: CategorizationRule = {
        id: `rule-${Date.now()}`,
        keyword: bulkUpdateProposal.targetDescription.toLowerCase(),
        category: bulkUpdateProposal.newCategory
      };
      updateActiveSessionRules(prev => [...prev, newRule]);
    }

    setBulkUpdateProposal(null);
  };

  // Logic to handle changes from the TransactionDetailModal
  const handleSaveDetails = (
    transactionId: string, 
    newCategory: string, 
    applyToSimilar: boolean, 
    newRule: { keyword: string, category: string } | null
  ) => {
    
    // 1. Update Rules if requested
    let updatedRules = [...activeSession.rules];
    if (newRule) {
        // Remove existing rule if we are "overwriting" based on keyword or id (simplification: remove by exact keyword match to avoid dups)
        updatedRules = updatedRules.filter(r => r.keyword !== newRule.keyword.toLowerCase());
        updatedRules.push({
            id: `rule-${Date.now()}`,
            keyword: newRule.keyword.toLowerCase(),
            category: newRule.category
        });
        updateActiveSessionRules(() => updatedRules);
    }

    // 2. Update Transactions
    // If a rule was created/updated, we should probably re-apply rules to ensure consistency
    // OR we simply apply to the target/similar as requested.
    
    const targetTransaction = activeSession.transactions.find(t => t.id === transactionId);
    
    if (targetTransaction) {
        updateActiveSessionTransactions(prev => {
            let nextTransactions = [...prev];

            // If we have a new rule, apply it globally or just to similar? 
            // The prompt says "apply for all remaining transactions".
            // If a rule exists, we should probably run the rule applicator.
            if (newRule) {
               nextTransactions = applyRulesToTransactions(nextTransactions, updatedRules);
            } else {
                // Manual Update logic
                if (applyToSimilar) {
                    const descToMatch = targetTransaction.description.toLowerCase().trim();
                    nextTransactions = nextTransactions.map(t => 
                        t.description.toLowerCase().trim() === descToMatch 
                        ? { ...t, category: newCategory }
                        : t
                    );
                } else {
                    nextTransactions = nextTransactions.map(t => 
                        t.id === transactionId 
                        ? { ...t, category: newCategory }
                        : t
                    );
                }
            }
            return nextTransactions;
        });
    }

    setSelectedTransactionId(null);
  };

  const handleGenerateRules = async () => {
    setIsGeneratingRules(true);
    try {
        const newRules = await generateRulesFromHistory(activeSession.transactions, activeSession.categories);
        if (newRules.length > 0) {
            // Filter duplicates (basic check based on keyword)
            const existingKeywords = activeSession.rules.map(r => r.keyword);
            const uniqueNewRules = newRules.filter(r => !existingKeywords.includes(r.keyword));
            
            updateActiveSessionRules(prev => [...prev, ...uniqueNewRules]);
            alert(`Generated ${uniqueNewRules.length} new rules!`);
            
            // Apply new rules to existing transactions? Optional, but helpful.
            if(confirm("Apply these new rules to existing transactions?")) {
                 updateActiveSessionTransactions(prev => applyRulesToTransactions(prev, uniqueNewRules));
            }
        } else {
            alert("Not enough data pattern found to generate rules.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingRules(false);
    }
  };

  const handleApplyRulesToExisting = async () => {
    if (activeSession.rules.length === 0) {
       alert("No rules defined.");
       return;
    }

    const rules = [...activeSession.rules];
    const transactions = [...activeSession.transactions];
    const total = transactions.length;

    // Initialize Progress
    setRuleApplicationStatus({ active: true, progress: 0, total, updated: 0, finished: false });

    // Sort rules once
    const sortedRules = rules.sort((a, b) => b.keyword.length - a.keyword.length);
    
    const BATCH_SIZE = 500;
    const newTransactions: Transaction[] = [];
    let updatedCount = 0;

    // Process in batches
    for (let i = 0; i < total; i += BATCH_SIZE) {
        // Allow UI to render
        await new Promise(resolve => setTimeout(resolve, 10));

        const end = Math.min(i + BATCH_SIZE, total);
        const chunk = transactions.slice(i, end);

        chunk.forEach(t => {
            const matchingRule = sortedRules.find(r => t.description.toLowerCase().includes(r.keyword.toLowerCase()));
            if (matchingRule) {
                if (t.category !== matchingRule.category) {
                    updatedCount++;
                }
                newTransactions.push({ ...t, category: matchingRule.category });
            } else {
                newTransactions.push(t);
            }
        });

        // Update progress
        setRuleApplicationStatus({
            active: true,
            progress: end,
            total,
            updated: updatedCount,
            finished: false
        });
    }

    // Finished
    updateActiveSessionTransactions(() => newTransactions);
    setRuleApplicationStatus({
        active: true,
        progress: total,
        total,
        updated: updatedCount,
        finished: true
    });
  };

  // Rule Handlers
  const handleAddOrUpdateRule = () => {
    if (!newRule.keyword.trim() || !newRule.category) return;
    
    // Ensure we trim whitespace from user input for reliable matching
    const cleanKeyword = newRule.keyword.trim().toLowerCase();

    if (editingRuleId) {
        // Update existing rule
        updateActiveSessionRules(prev => prev.map(r => 
            r.id === editingRuleId 
            ? { ...r, keyword: cleanKeyword, category: newRule.category }
            : r
        ));
        setEditingRuleId(null);
    } else {
        // Add new rule
        updateActiveSessionRules(prev => [...prev, {
            id: `rule-${Date.now()}`,
            keyword: cleanKeyword,
            category: newRule.category
        }]);
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
    updateActiveSessionRules(prev => prev.filter(r => r.id !== id));
    if (editingRuleId === id) {
        cancelEditRule();
    }
  };

  // Category Handlers
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (activeSession.categories.includes(newCategoryName.trim())) {
      alert("Category already exists.");
      return;
    }
    updateActiveSessionCategories([...activeSession.categories, newCategoryName.trim()]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    if (categoryToDelete === 'Uncategorized') {
      alert("Cannot delete the default 'Uncategorized' category.");
      return;
    }
    if (confirm(`Delete category '${categoryToDelete}'? Transactions will be 'Uncategorized'.`)) {
      const newCategories = activeSession.categories.filter(c => c !== categoryToDelete);
      updateActiveSessionTransactions(prev => prev.map(t => 
        t.category === categoryToDelete ? { ...t, category: 'Uncategorized' } : t
      ));
      updateActiveSessionCategories(newCategories);
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
       updateActiveSessionCategories(newCategories, editingCategory.oldName, editingCategory.newName);
    }
    setEditingCategory(null);
  };

  const renderSettings = () => (
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
                                onClick={() => updateActiveSessionSettings({ delimiter: char })}
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
                        onChange={(e) => updateActiveSessionSettings({ dateFormat: e.target.value as any })}
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
                         <button onClick={() => updateActiveSessionSettings({ decimalSeparator: ',' })} className={`px-3 py-2 rounded border text-sm ${activeSession.importSettings.decimalSeparator === ',' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>1.234,56</button>
                         <button onClick={() => updateActiveSessionSettings({ decimalSeparator: '.' })} className={`px-3 py-2 rounded border text-sm ${activeSession.importSettings.decimalSeparator === '.' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>1,234.56</button>
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
                        onClick={handleExportSession}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-4 py-3 rounded-lg transition-colors group"
                    >
                        <Download size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span>Export Complete Session</span>
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-500/20 group">
                        <Upload size={18} className="group-hover:scale-110 transition-transform" />
                        <span>Import Session Backup</span>
                        <input type="file" className="hidden" accept=".json" onChange={handleImportSession} />
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
                        onClick={handleApplyRulesToExisting}
                        className="flex items-center space-x-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors border border-slate-600"
                        title="Re-scan all transactions and apply rules"
                    >
                        <RefreshCw size={14} />
                        <span>Apply to All</span>
                    </button>
                    <button 
                        onClick={handleGenerateRules}
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
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <List size={24} className="text-indigo-400"/>
                Categories
            </h2>
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

  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-indigo-500/30 relative">
        
        {/* Rule Application Progress Modal */}
        {ruleApplicationStatus && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                    {ruleApplicationStatus.finished ? (
                        <>
                            <div className="mx-auto bg-emerald-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center text-emerald-400 mb-4 animate-scale-in">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Rules Applied!</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Processed <strong className="text-white">{ruleApplicationStatus.total}</strong> transactions.<br/>
                                Updated <strong className="text-emerald-400">{ruleApplicationStatus.updated}</strong> categorizations.
                            </p>
                            <button 
                                onClick={() => setRuleApplicationStatus(null)}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors border border-slate-600"
                            >
                                Close
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mx-auto mb-4 text-indigo-400 animate-spin">
                                <Loader2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Applying Rules...</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Processing transaction {ruleApplicationStatus.progress} of {ruleApplicationStatus.total}
                            </p>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${(ruleApplicationStatus.progress / ruleApplicationStatus.total) * 100}%` }}
                                ></div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* Transaction Detail Modal */}
        {selectedTransactionData && (
            <TransactionDetailModal
                transaction={selectedTransactionData.transaction}
                similarTransactions={selectedTransactionData.similar}
                categoryTransactions={selectedTransactionData.inCategory}
                activeRule={selectedTransactionData.activeRule}
                availableCategories={activeSession.categories}
                onClose={() => setSelectedTransactionId(null)}
                onSave={handleSaveDetails}
            />
        )}

        {/* Bulk Update Modal (Original - kept for inline edits fallback, though Detail Modal overlaps in utility) */}
        {bulkUpdateProposal && !selectedTransactionId && (
            <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-md w-full">
                <div className="bg-slate-800 border border-indigo-500/50 shadow-2xl rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                            <Zap size={20} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-white text-sm">Update similar transactions?</h4>
                            <p className="text-xs text-slate-400 mt-1">
                                Found <strong className="text-white">{bulkUpdateProposal.count}</strong> other transactions with description <strong className="text-white">"{bulkUpdateProposal.targetDescription}"</strong>.
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Change them to <strong className="text-indigo-400">{bulkUpdateProposal.newCategory}</strong>?
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button 
                                    onClick={() => confirmBulkUpdate(false)}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded font-medium transition-colors"
                                >
                                    Yes, update all
                                </button>
                                <button 
                                    onClick={() => confirmBulkUpdate(true)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded font-medium transition-colors"
                                >
                                    Yes + Create Rule
                                </button>
                                <button 
                                    onClick={() => setBulkUpdateProposal(null)}
                                    className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded font-medium transition-colors"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                        <button onClick={() => setBulkUpdateProposal(null)} className="text-slate-500 hover:text-slate-300">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Sidebar / Navigation */}
        <nav className="fixed top-0 left-0 h-full w-64 bg-surface border-r border-slate-700 hidden md:flex flex-col z-20">
            {/* App Logo */}
            <div className="p-6 border-b border-slate-700">
                <div className="flex items-center space-x-2 text-indigo-400">
                    <ShieldCheck size={28} />
                    <span className="text-xl font-bold text-white tracking-tight">FinSight AI</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Smart Financial Intelligence</p>
            </div>

            {/* Session Management */}
            <div className="px-4 pt-6 pb-2 border-b border-slate-700/50">
              <div 
                className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => setIsSessionsExpanded(!isSessionsExpanded)}
              >
                <span>Sessions</span>
                {isSessionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {isSessionsExpanded && (
                <div className="space-y-1 mb-2 animate-fade-in">
                  {sessions.map(session => (
                    <div 
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                        activeSessionId === session.id 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <Folder size={14} className={activeSessionId === session.id ? 'text-indigo-400' : 'text-slate-500'} />
                        <span className="truncate">{session.name}</span>
                      </div>
                      {sessions.length > 1 && (
                        <button 
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                          title="Delete Session"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {isCreatingSession ? (
                    <div className="mt-2 p-2 bg-slate-800 rounded-lg border border-slate-600">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Session Name"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 mb-2"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                      />
                      <div className="flex space-x-1">
                        <button 
                          onClick={handleCreateSession}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1 rounded"
                        >
                          Create
                        </button>
                        <button 
                          onClick={() => setIsCreatingSession(false)}
                          className="px-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1 rounded"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsCreatingSession(true)}
                      className="w-full flex items-center space-x-2 px-3 py-2 mt-2 text-xs text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-dashed border-slate-700 hover:border-indigo-500/30"
                    >
                      <Plus size={14} />
                      <span>New Session</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-4 space-y-2 px-4">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                    <LayoutDashboard size={20} />
                    <span className="font-medium">Dashboard</span>
                </button>
                
                <button 
                    onClick={() => setActiveTab('transactions')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                    <List size={20} />
                    <span className="font-medium">Transactions</span>
                </button>

                <button 
                    onClick={() => setActiveTab('consultant')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'consultant' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                    <MessageSquareText size={20} />
                    <span className="font-medium">Consult AI</span>
                </button>

                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                    <Settings size={20} />
                    <span className="font-medium">Settings</span>
                </button>
            </div>

            {/* Import Area */}
            <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload size={24} className="text-slate-400 group-hover:text-indigo-400 mb-2" />
                        <p className="text-xs text-slate-500 group-hover:text-slate-300 text-center px-2">
                           Import to<br/><span className="font-semibold text-indigo-400">{activeSession.name}</span>
                        </p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx, .csv, .txt" onChange={handleFileUpload} />
                </label>
            </div>
        </nav>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full bg-surface border-b border-slate-700 z-30 px-4 py-3 flex justify-between items-center">
             <div className="flex items-center space-x-2 text-indigo-400">
                <ShieldCheck size={24} />
                <span className="font-bold text-white">FinSight AI</span>
            </div>
            <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
              {activeSession.name}
            </div>
        </div>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 w-full bg-surface border-t border-slate-700 z-30 flex justify-around p-3">
             <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><LayoutDashboard size={24} /></button>
             <button onClick={() => setActiveTab('transactions')} className={`p-2 rounded-lg ${activeTab === 'transactions' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><List size={24} /></button>
             <button onClick={() => setActiveTab('consultant')} className={`p-2 rounded-lg ${activeTab === 'consultant' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><MessageSquareText size={24} /></button>
             <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-lg ${activeTab === 'settings' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><Settings size={24} /></button>
        </div>

        {/* Main Content */}
        <main className="md:ml-64 p-6 pt-20 md:pt-6 pb-24 md:pb-6 min-h-screen transition-all duration-300">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h1 className="text-3xl font-bold text-white">
                          {activeTab === 'dashboard' && 'Financial Overview'}
                          {activeTab === 'transactions' && 'Transaction History'}
                          {activeTab === 'consultant' && 'AI Consultant'}
                          {activeTab === 'settings' && 'Session Settings'}
                      </h1>
                      <span className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30 font-medium">
                        {activeSession.name}
                      </span>
                    </div>
                    <p className="text-slate-400">
                        {activeTab === 'dashboard' && 'Track your wealth and regular spending.'}
                        {activeTab === 'transactions' && 'Manage and organize your financial records.'}
                        {activeTab === 'consultant' && 'Get personalized advice powered by Gemini 3 Pro.'}
                        {activeTab === 'settings' && 'Configure categorization rules.'}
                    </p>
                </div>
                
                {activeTab === 'transactions' && (
                    <button 
                        onClick={handleAutoCategorize}
                        disabled={isCategorizing}
                        className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all disabled:opacity-50"
                    >
                        {isCategorizing ? <BrainCircuit className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                        <span>{isCategorizing ? 'Categorizing...' : 'AI Auto-Categorize'}</span>
                    </button>
                )}
            </header>

            {activeTab === 'dashboard' && <Dashboard transactions={activeSession.transactions} />}
            {activeTab === 'transactions' && <TransactionList transactions={activeSession.transactions} availableCategories={activeSession.categories} onCategoryChange={handleTransactionCategoryChange} onTransactionClick={setSelectedTransactionId} />}
            {activeTab === 'consultant' && <AIConsultant transactions={activeSession.transactions} />}
            {activeTab === 'settings' && renderSettings()}
        </main>
      </div>
    </HashRouter>
  );
};

export default App;