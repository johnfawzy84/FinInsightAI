import React, { useState, useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { Transaction, Category, CategorizationRule, Session, ImportSelection } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AIConsultant from './components/AIConsultant';
import TransactionDetailModal from './components/TransactionDetailModal';
import Sidebar from './components/Sidebar';
import SettingsView from './components/SettingsView';
import { RuleProgressModal, SanitizationProposalModal, SanitizationResultModal, BulkUpdateModal } from './components/StatusModals';
import { ImportSelectionModal } from './components/ImportSelectionModal';
import { SmartImportModal } from './components/SmartImportModal';
import { ManualTransactionModal } from './components/ManualTransactionModal';
import { useSessionData, applyRulesToTransactions } from './hooks/useSessionData';
import { categorizeTransactionsAI, generateRulesFromHistory } from './services/gemini';
import { BrainCircuit, ShieldCheck, LayoutDashboard, List, MessageSquareText, Settings, Target, Wallet } from 'lucide-react';
import { GoalManager } from './components/GoalManager';
import { BudgetManager } from './components/BudgetManager';
import { TutorialOverlay, TutorialStep } from './components/TutorialOverlay';
import { HelpCircle } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'settings' | 'goals' | 'budgets'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  
  const { 
    sessions, 
    activeSession, 
    activeSessionId, 
    setActiveSessionId, 
    addSession, 
    removeSession, 
    mergeSession,
    updateTransactions,
    updateSettings,
    updateCategories,
    updateRules,
    updateAssets,
    updateGoals,
    updateBudgets,
    updateDashboardWidgets,
    updateSessionRaw,
    deleteSource,
    googleUser,
    isSyncing,
    handleGoogleLogin,
    syncToCloud,
    syncFromCloud
  } = useSessionData();

  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [importCandidate, setImportCandidate] = useState<Session | null>(null);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);

  const [bulkUpdateProposal, setBulkUpdateProposal] = useState<{
    targetDescription: string;
    newCategory: string;
    count: number;
    transactionIds: string[];
  } | null>(null);

  const [ruleApplicationStatus, setRuleApplicationStatus] = useState<{
    active: boolean;
    progress: number;
    total: number;
    updated: number;
    finished: boolean;
  } | null>(null);

  const [sanitizationResult, setSanitizationResult] = useState<{ count: number; categories: string[] } | null>(null);
  const [sanitizationProposal, setSanitizationProposal] = useState<{
    totalCount: number;
    unusedCount: number;
    unusedCategories: string[];
  } | null>(null);

  const tutorialSteps: TutorialStep[] = [
    {
        targetId: 'tutorial-new-session',
        title: 'Create a Session',
        content: 'Start by creating a new session to organize your financial data. You can have multiple sessions for different purposes.',
        position: 'right'
    },
    {
        targetId: 'tutorial-import',
        title: 'Import Data',
        content: 'Import your bank statements or transaction files here. We support various formats like CSV and Excel.',
        position: 'right'
    },
    {
        targetId: 'tutorial-nav-transactions',
        title: 'View Transactions',
        content: 'Navigate to the Transactions tab to manage your imported data.',
        position: 'right',
        action: () => setActiveTab('transactions')
    },
    {
        targetId: 'tutorial-add-transaction',
        title: 'Add Manually',
        content: 'You can also add transactions manually if you prefer.',
        position: 'bottom',
        action: () => setActiveTab('transactions')
    },
    {
        targetId: 'tutorial-auto-categorize',
        title: 'AI Categorization',
        content: 'Use our AI to automatically categorize your transactions based on their descriptions.',
        position: 'bottom',
        action: () => setActiveTab('transactions')
    },
    {
        targetId: 'tutorial-nav-budgets',
        title: 'Manage Budgets',
        content: 'Set up budgets for different categories to keep your spending on track.',
        position: 'right',
        action: () => setActiveTab('budgets')
    },
    {
        targetId: 'tutorial-nav-goals',
        title: 'Set Financial Goals',
        content: 'Define your financial goals and track your progress towards them.',
        position: 'right',
        action: () => setActiveTab('goals')
    },
    {
        targetId: 'tutorial-nav-settings',
        title: 'Settings & Rules',
        content: 'Configure your categories, rules, and other settings here.',
        position: 'right',
        action: () => setActiveTab('settings')
    },
    {
        targetId: 'tutorial-consult-ai',
        title: 'Consult AI',
        content: 'Chat with our AI consultant to get insights, advice, and answers about your finances.',
        position: 'right'
    }
  ];

  const derivedTransactionData = useMemo(() => {
    if (!selectedTransactionId) return null;
    const transaction = activeSession.transactions.find(t => t.id === selectedTransactionId);
    if (!transaction) return null;

    const similar = activeSession.transactions.filter(t => 
        t.description.toLowerCase().trim() === transaction.description.toLowerCase().trim()
    );
    const inCategory = activeSession.transactions.filter(t => t.category === transaction.category);
    const sortedRules = [...activeSession.rules].sort((a, b) => b.keyword.length - a.keyword.length);
    const activeRule = sortedRules.find(r => {
        if (r.isRegex) {
            try { return new RegExp(r.keyword, 'i').test(transaction.description); } catch(e) { return false; }
        }
        return transaction.description.toLowerCase().includes(r.keyword.toLowerCase());
    });

    return { transaction, similar, inCategory, activeRule };
  }, [selectedTransactionId, activeSession]);


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

  const handleImportSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.transactions || !Array.isArray(json.transactions)) {
            throw new Error("Invalid file structure");
        }
        setImportCandidate(json);
      } catch (err) {
        console.error(err);
        alert("Failed to read session file. Invalid format.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (selection: ImportSelection) => {
    if (importCandidate) {
        mergeSession(importCandidate, selection);
        alert("Selected data merged successfully!");
        setImportCandidate(null);
    }
  };

  const handleSmartImportComplete = (newTransactions: Transaction[], newCategories: string[], source: string) => {
      const taggedTransactions = newTransactions.map(t => ({ ...t, source }));
      const currentSources = activeSession.sources || [];
      const updatedSources = currentSources.includes(source) ? currentSources : [...currentSources, source];

      updateSessionRaw(s => ({
          ...s,
          categories: Array.from(new Set([...s.categories, ...newCategories])),
          transactions: [...s.transactions, ...taggedTransactions],
          sources: updatedSources
      }));
      setActiveTab('transactions');
  };

  const handleAddManualTransaction = (data: any) => {
      const newTransaction: Transaction = {
          id: `manual-${Date.now()}`,
          ...data
      };
      
      // Update transactions
      updateTransactions(prev => [...prev, newTransaction]);
      
      // Update sources if manual entry is new
      if (newTransaction.source && !activeSession.sources?.includes(newTransaction.source)) {
          updateSessionRaw(s => ({ ...s, sources: [...(s.sources || []), newTransaction.source!] }));
      }
  };

  const handleAutoCategorize = async () => {
    const currentTransactions = activeSession.transactions;
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

        updateTransactions(prev => prev.map(t => {
            const match = results.find(r => r.id === t.id);
            return match ? { ...t, category: match.category } : t;
        }));
    } catch (err) {
        console.error(err);
        alert("AI Categorization failed.");
    } finally {
        setIsCategorizing(false);
    }
  };

  const handleTransactionCategoryChange = (transactionId: string, newCategory: string) => {
    const targetTransaction = activeSession.transactions.find(t => t.id === transactionId);
    if (!targetTransaction) return;

    updateTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, category: newCategory } : t));

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
    updateTransactions(prev => prev.map(t => 
      bulkUpdateProposal.transactionIds.includes(t.id) ? { ...t, category: bulkUpdateProposal.newCategory } : t
    ));

    if (createRule) {
      updateRules(prev => [...prev, {
        id: `rule-${Date.now()}`,
        keyword: bulkUpdateProposal.targetDescription.toLowerCase(),
        category: bulkUpdateProposal.newCategory
      }]);
    }
    setBulkUpdateProposal(null);
  };

  const handleSaveDetails = (transactionId: string, newCategory: string, applyToSimilar: boolean, newRule: { keyword: string, category: string, isRegex: boolean } | null) => {
    let currentRules = [...activeSession.rules];
    if (newRule) {
        currentRules = currentRules.filter(r => r.keyword !== newRule.keyword.toLowerCase());
        currentRules.push({
            id: `rule-${Date.now()}`,
            keyword: newRule.keyword,
            category: newRule.category,
            isRegex: newRule.isRegex
        });
        updateRules(() => currentRules);
    }

    const targetTransaction = activeSession.transactions.find(t => t.id === transactionId);
    if (targetTransaction) {
        updateTransactions(prev => {
            let nextTransactions = [...prev];
            if (newRule) {
               nextTransactions = applyRulesToTransactions(nextTransactions, currentRules);
            } else {
                if (applyToSimilar) {
                    const descToMatch = targetTransaction.description.toLowerCase().trim();
                    nextTransactions = nextTransactions.map(t => t.description.toLowerCase().trim() === descToMatch ? { ...t, category: newCategory } : t);
                } else {
                    nextTransactions = nextTransactions.map(t => t.id === transactionId ? { ...t, category: newCategory } : t);
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
            const existingKeywords = activeSession.rules.map(r => r.keyword);
            const uniqueNewRules = newRules.filter(r => !existingKeywords.includes(r.keyword));
            updateRules(prev => [...prev, ...uniqueNewRules]);
            alert(`Generated ${uniqueNewRules.length} new rules!`);
            if(confirm("Apply these new rules to existing transactions?")) {
                 updateTransactions(prev => applyRulesToTransactions(prev, uniqueNewRules));
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
    setRuleApplicationStatus({ active: true, progress: 0, total, updated: 0, finished: false });

    const sortedRules = rules.sort((a, b) => b.keyword.length - a.keyword.length);
    const BATCH_SIZE = 500;
    const newTransactions: Transaction[] = [];
    let updatedCount = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const end = Math.min(i + BATCH_SIZE, total);
        const chunk = transactions.slice(i, end);
        chunk.forEach(t => {
            const matchingRule = sortedRules.find(r => {
                if (r.isRegex) {
                     try { return new RegExp(r.keyword, 'i').test(t.description); } catch(e) { return false; }
                }
                return t.description.toLowerCase().includes(r.keyword.toLowerCase());
            });

            if (matchingRule) {
                if (t.category !== matchingRule.category) updatedCount++;
                newTransactions.push({ ...t, category: matchingRule.category });
            } else {
                newTransactions.push(t);
            }
        });
        setRuleApplicationStatus({ active: true, progress: end, total, updated: updatedCount, finished: false });
    }
    updateTransactions(() => newTransactions);
    setRuleApplicationStatus({ active: true, progress: total, total, updated: updatedCount, finished: true });
  };

  const handleSanitizeCategories = () => {
    try {
        const transactions = activeSession.transactions || [];
        const categories = activeSession.categories || [];
        const usedCategories = new Set(transactions.map(t => t.category));
        const categoriesToRemove = categories.filter(c => !usedCategories.has(c) && c !== 'Uncategorized');

        setSanitizationProposal({
            totalCount: categories.length,
            unusedCount: categoriesToRemove.length,
            unusedCategories: categoriesToRemove
        });
    } catch (error) {
        console.error(error);
        alert("An error occurred while analyzing categories.");
    }
  };

  const confirmSanitization = () => {
    if (!sanitizationProposal) return;
    if (sanitizationProposal.unusedCount > 0) {
        const categoriesToRemove = sanitizationProposal.unusedCategories;
        const newCategories = activeSession.categories.filter(c => !categoriesToRemove.includes(c));
        updateCategories(newCategories);
        setSanitizationResult({ count: categoriesToRemove.length, categories: categoriesToRemove });
    }
    setSanitizationProposal(null);
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden">
        
        <AIConsultant 
            transactions={activeSession.transactions} 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)}
            onUpdateDashboardWidgets={updateDashboardWidgets}
            onUpdateRules={updateRules}
            onUpdateCategories={updateCategories}
            onUpdateBudgets={updateBudgets}
            onUpdateGoals={updateGoals}
            goals={activeSession.goals || []}
            budgets={activeSession.budgets || []}
            categories={activeSession.categories}
            currency={activeSession.currency || '$'}
        />
        
        {!isChatOpen && (
            <button 
                onClick={() => setIsChatOpen(true)}
                className="hidden md:flex fixed bottom-8 right-8 z-30 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 items-center justify-center animate-bounce-subtle"
                title="Open Financial Assistant"
            >
                <MessageSquareText size={24} />
            </button>
        )}

        <SmartImportModal 
            isOpen={isSmartImportOpen}
            onClose={() => setIsSmartImportOpen(false)}
            onImportComplete={handleSmartImportComplete}
            existingRules={activeSession.rules}
            existingCategories={activeSession.categories}
            defaultSettings={activeSession.importSettings}
            existingSources={activeSession.sources || []}
        />

        <ManualTransactionModal 
            isOpen={isManualAddOpen}
            onClose={() => setIsManualAddOpen(false)}
            onSave={handleAddManualTransaction}
            categories={activeSession.categories}
            currency={activeSession.currency || '$'}
        />

        <RuleProgressModal 
            status={ruleApplicationStatus} 
            onClose={() => setRuleApplicationStatus(null)} 
        />
        
        <SanitizationProposalModal 
            proposal={sanitizationProposal} 
            onConfirm={confirmSanitization} 
            onCancel={() => setSanitizationProposal(null)} 
        />
        
        <SanitizationResultModal 
            result={sanitizationResult} 
            onClose={() => setSanitizationResult(null)} 
        />

        <BulkUpdateModal 
            proposal={bulkUpdateProposal && !selectedTransactionId ? bulkUpdateProposal : null}
            onConfirm={confirmBulkUpdate}
            onCancel={() => setBulkUpdateProposal(null)}
        />
        
        {importCandidate && (
            <ImportSelectionModal 
                importData={importCandidate}
                onConfirm={handleConfirmImport}
                onCancel={() => setImportCandidate(null)}
            />
        )}

        {derivedTransactionData && (
            <TransactionDetailModal
                transaction={derivedTransactionData.transaction}
                similarTransactions={derivedTransactionData.similar}
                categoryTransactions={derivedTransactionData.inCategory}
                activeRule={derivedTransactionData.activeRule}
                availableCategories={activeSession.categories}
                onClose={() => setSelectedTransactionId(null)}
                onSave={handleSaveDetails}
                currency={activeSession.currency || '$'}
            />
        )}

        <Sidebar 
            sessions={sessions}
            activeSessionId={activeSessionId}
            activeSessionName={activeSession.name}
            onSelectSession={setActiveSessionId}
            onCreateSession={addSession}
            onDeleteSession={(e, id) => {
                e.stopPropagation();
                removeSession(id);
            }}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onImportFile={() => setIsSmartImportOpen(true)}
            onToggleChat={() => setIsChatOpen(prev => !prev)}
            isChatOpen={isChatOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            googleUser={googleUser}
            isSyncing={isSyncing}
            onCloudSync={syncToCloud}
        />

        <div className="md:hidden fixed top-0 w-full bg-surface border-b border-slate-700 z-30 px-4 py-3 flex justify-between items-center">
             <div className="flex items-center space-x-2 text-indigo-400">
                <ShieldCheck size={24} />
                <span className="font-bold text-white">FinSight AI</span>
            </div>
            <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
              {activeSession.name}
            </div>
        </div>

        <div className="md:hidden fixed bottom-0 w-full bg-surface border-t border-slate-700 z-30 flex justify-around p-3 pb-safe">
             <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><LayoutDashboard size={24} /></button>
             <button onClick={() => setActiveTab('transactions')} className={`p-2 rounded-lg ${activeTab === 'transactions' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><List size={24} /></button>
             <button onClick={() => setActiveTab('budgets')} className={`p-2 rounded-lg ${activeTab === 'budgets' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><Wallet size={24} /></button>
             <button onClick={() => setActiveTab('goals')} className={`p-2 rounded-lg ${activeTab === 'goals' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><Target size={24} /></button>
             <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-lg ${activeTab === 'settings' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}><Settings size={24} /></button>
        </div>

        <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} p-6 pt-20 md:pt-6 pb-24 md:pb-6 min-h-screen ${isChatOpen ? 'md:mr-[450px]' : ''}`}>
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h1 className="text-3xl font-bold text-white">
                          {activeTab === 'dashboard' && 'Financial Overview'}
                          {activeTab === 'transactions' && 'Transaction History'}
                          {activeTab === 'goals' && 'Goals & Allocations'}
                          {activeTab === 'budgets' && 'Spending Budgets'}
                          {activeTab === 'settings' && 'Session Settings'}
                      </h1>
                      <span className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30 font-medium">
                        {activeSession.name}
                      </span>
                      <button 
                        onClick={() => setIsTutorialOpen(true)}
                        className="p-1.5 text-indigo-400 bg-indigo-500/10 rounded-full transition-all animate-glow hover:animate-none"
                        title="Start Tutorial"
                      >
                        <HelpCircle size={20} />
                      </button>
                    </div>
                    <p className="text-slate-400">
                        {activeTab === 'dashboard' && 'Track your wealth and regular spending.'}
                        {activeTab === 'transactions' && 'Manage and organize your financial records.'}
                        {activeTab === 'goals' && 'Simulate, prioritize, and fund your dreams.'}
                        {activeTab === 'budgets' && 'Monitor category spending against your limits.'}
                        {activeTab === 'settings' && 'Configure cloud sync and rules.'}
                    </p>
                </div>
                
                {activeTab === 'transactions' && (
                    <button 
                        id="tutorial-auto-categorize"
                        onClick={handleAutoCategorize}
                        disabled={isCategorizing}
                        className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all disabled:opacity-50"
                    >
                        {isCategorizing ? <BrainCircuit className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                        <span>{isCategorizing ? 'Categorizing...' : 'AI Auto-Categorize'}</span>
                    </button>
                )}
            </header>

            {activeTab === 'dashboard' && (
                <Dashboard 
                    transactions={activeSession.transactions} 
                    assets={activeSession.assets || []}
                    onUpdateAssets={updateAssets}
                    activeSession={activeSession}
                    onUpdateDashboardWidgets={updateDashboardWidgets}
                    currency={activeSession.currency || '$'}
                />
            )}
            {activeTab === 'transactions' && (
                <TransactionList 
                    transactions={activeSession.transactions} 
                    availableCategories={activeSession.categories} 
                    onCategoryChange={handleTransactionCategoryChange} 
                    onTransactionClick={setSelectedTransactionId} 
                    currency={activeSession.currency || '$'}
                    onManualAdd={() => setIsManualAddOpen(true)}
                />
            )}
            {activeTab === 'budgets' && (
                <BudgetManager 
                    budgets={activeSession.budgets || []}
                    transactions={activeSession.transactions}
                    categories={activeSession.categories}
                    onUpdateBudgets={updateBudgets}
                    goals={activeSession.goals || []}
                    currency={activeSession.currency || '$'}
                />
            )}
            {activeTab === 'goals' && (
               <GoalManager 
                    goals={activeSession.goals || []} 
                    assets={activeSession.assets || []}
                    transactions={activeSession.transactions}
                    onUpdateGoals={updateGoals}
                    currency={activeSession.currency || '$'}
               /> 
            )}
            {activeTab === 'settings' && (
                <SettingsView 
                    activeSession={activeSession}
                    onUpdateSettings={updateSettings}
                    onUpdateRules={updateRules}
                    onUpdateCategories={updateCategories}
                    onUpdateTransactions={updateTransactions}
                    onExportSession={handleExportSession}
                    onImportSession={handleImportSessionFile}
                    onApplyRulesToExisting={handleApplyRulesToExisting}
                    onGenerateRules={handleGenerateRules}
                    isGeneratingRules={isGeneratingRules}
                    onSanitizeCategories={handleSanitizeCategories}
                    onUpdateDashboardWidgets={updateDashboardWidgets}
                    transactions={activeSession.transactions}
                    onDeleteSource={deleteSource}
                    googleUser={googleUser}
                    onGoogleLogin={handleGoogleLogin}
                    onCloudSave={syncToCloud}
                    onCloudLoad={syncFromCloud}
                    isSyncing={isSyncing}
                    onUpdateCurrency={(c) => updateSessionRaw(s => ({ ...s, currency: c }))}
                />
            )}
        </main>
        <TutorialOverlay 
            steps={tutorialSteps} 
            isOpen={isTutorialOpen} 
            onClose={() => setIsTutorialOpen(false)} 
        />
      </div>
    </HashRouter>
  );
};

export default App;