import React, { useState, useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { Transaction, Category, TransactionType, Session, ImportSettings, DEFAULT_CATEGORIES } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AIConsultant from './components/AIConsultant';
import { categorizeTransactionsAI } from './services/gemini';
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
  Check
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
    delimiter: ';', // Set to ; for German default as per request
    dateFormat: 'DD.MM.YYYY',
    decimalSeparator: ','
  };

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'default-session',
      name: 'Personal Finance',
      transactions: initialTransactions,
      categories: [...DEFAULT_CATEGORIES],
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

  // Settings State
  const [editingCategory, setEditingCategory] = useState<{ oldName: string, newName: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Computed active session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

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
        // If a category was renamed, update all transactions using it
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

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name: newSessionName,
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      createdAt: Date.now(),
      importSettings: { ...defaultSettings } // Copy defaults
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
    
    if (window.confirm("Are you sure you want to delete this session? All data in it will be lost.")) {
      const newSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(newSessions);
      if (activeSessionId === sessionId) {
        setActiveSessionId(newSessions[0].id);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        // Pass the session's specific import settings to the parser
        const newTransactions = await parseFile(file, activeSession.importSettings);
        
        // Extract unique categories from the new transactions that aren't 'Uncategorized' and don't exist yet
        const importedCategories = Array.from(new Set(newTransactions.map(t => t.category)))
            .filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized' && !activeSession.categories.includes(cat));

        // Update session with new transactions AND new categories
        setSessions(prevSessions => prevSessions.map(session => {
          if (session.id === activeSessionId) {
            // Merge new categories with existing ones
            const updatedCategories = [...session.categories, ...importedCategories];
            
            return { 
                ...session, 
                transactions: [...session.transactions, ...newTransactions],
                categories: updatedCategories
            };
          }
          return session;
        }));

        setActiveTab('transactions');
      } catch (err) {
        console.error("Failed to parse file", err);
        alert("Error parsing file. Check your Import Settings (Delimiter, Date format) in the Settings tab.");
      }
      // Reset input
      e.target.value = ''; 
    }
  };

  const handleAutoCategorize = async () => {
    const currentTransactions = activeSession.transactions;
    const uncategorized = currentTransactions.filter(t => 
        t.category === Category.UNCATEGORIZED || 
        t.category === 'Uncategorized' || 
        t.category === 'General'
    );

    if (uncategorized.length === 0) {
        alert("All transactions are already categorized!");
        return;
    }

    setIsCategorizing(true);
    try {
        // Pass available categories to the AI service
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
        alert("AI Categorization failed. Check console.");
    } finally {
        setIsCategorizing(false);
    }
  };

  const handleTransactionCategoryChange = (transactionId: string, newCategory: string) => {
    updateActiveSessionTransactions(prev => prev.map(t => 
      t.id === transactionId ? { ...t, category: newCategory } : t
    ));
  };

  // Category Settings Handlers
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
    if (confirm(`Delete category '${categoryToDelete}'? Transactions with this category will be moved to 'Uncategorized'.`)) {
      const newCategories = activeSession.categories.filter(c => c !== categoryToDelete);
      // Update transactions first: move deleted category items to 'Uncategorized'
      updateActiveSessionTransactions(prev => prev.map(t => 
        t.category === categoryToDelete ? { ...t, category: 'Uncategorized' } : t
      ));
      // Then update category list
      updateActiveSessionCategories(newCategories);
    }
  };

  const startEditingCategory = (category: string) => {
    setEditingCategory({ oldName: category, newName: category });
  };

  const saveEditedCategory = () => {
    if (!editingCategory || !editingCategory.newName.trim()) return;
    
    if (editingCategory.newName !== editingCategory.oldName) {
       if (activeSession.categories.includes(editingCategory.newName)) {
         alert("Category name already exists.");
         return;
       }
       const newCategories = activeSession.categories.map(c => 
         c === editingCategory.oldName ? editingCategory.newName : c
       );
       updateActiveSessionCategories(newCategories, editingCategory.oldName, editingCategory.newName);
    }
    setEditingCategory(null);
  };

  const renderSettings = () => (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 max-w-4xl animate-fade-in space-y-8">
        
        {/* Import Settings Section */}
        <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Settings size={24} className="text-indigo-400"/>
                Import Configuration
            </h2>
            <p className="text-slate-400 mb-6 text-sm">
                Configure how your CSV files are parsed for this session. 
            </p>
            
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">CSV Delimiter</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[';', ',', '|'].map(char => (
                            <button
                                key={char}
                                onClick={() => updateActiveSessionSettings({ delimiter: char })}
                                className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                                    activeSession.importSettings.delimiter === char 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                               {char === ';' ? 'Semicolon (;)' : char === ',' ? 'Comma (,)' : 'Pipe (|)'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Date Format</label>
                        <select 
                            value={activeSession.importSettings.dateFormat}
                            onChange={(e) => updateActiveSessionSettings({ dateFormat: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="DD.MM.YYYY">DD.MM.YYYY (German)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Number Format</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => updateActiveSessionSettings({ decimalSeparator: ',' })}
                                className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                                    activeSession.importSettings.decimalSeparator === ',' 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                1.234,56 (DE)
                            </button>
                            <button
                                onClick={() => updateActiveSessionSettings({ decimalSeparator: '.' })}
                                className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                                    activeSession.importSettings.decimalSeparator === '.' 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                1,234.56 (US)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="border-t border-slate-700 pt-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <List size={24} className="text-indigo-400"/>
                Category Management
            </h2>
            <p className="text-slate-400 mb-6 text-sm">
                Customize the categories used for your transactions. Renaming a category will update all existing transactions associated with it.
            </p>

            <div className="space-y-4">
                {/* Add New Category */}
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New Category Name..."
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    />
                    <button 
                        onClick={handleAddCategory}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus size={18} /> Add
                    </button>
                </div>

                {/* Category List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700 max-h-[400px] overflow-y-auto">
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
                                    <button onClick={saveEditedCategory} className="text-emerald-400 hover:text-emerald-300 p-1">
                                        <Check size={18} />
                                    </button>
                                    <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-300 p-1">
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-slate-200 text-sm font-medium">{cat}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => startEditingCategory(cat)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                                            title="Rename"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCategory(cat)}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-indigo-500/30">
        
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
                        {activeTab === 'settings' && 'Configure import rules and categories.'}
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
            {activeTab === 'transactions' && <TransactionList transactions={activeSession.transactions} availableCategories={activeSession.categories} onCategoryChange={handleTransactionCategoryChange} />}
            {activeTab === 'consultant' && <AIConsultant transactions={activeSession.transactions} />}
            {activeTab === 'settings' && renderSettings()}
        </main>
      </div>
    </HashRouter>
  );
};

export default App;