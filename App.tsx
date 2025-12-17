import React, { useState, useMemo } from 'react';
import { HashRouter } from 'react-router-dom';
import { Transaction, Category, CategorizationRule, Session } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AIConsultant from './components/AIConsultant';
import TransactionDetailModal from './components/TransactionDetailModal';
import Sidebar from './components/Sidebar';
import SettingsView from './components/SettingsView';
import { RuleProgressModal, SanitizationProposalModal, SanitizationResultModal, BulkUpdateModal } from './components/StatusModals';
import { useSessionData, applyRulesToTransactions } from './hooks/useSessionData';
import { categorizeTransactionsAI, generateRulesFromHistory } from './services/gemini';
import { parseFile } from './utils/parser';
import { BrainCircuit, ShieldCheck, LayoutDashboard, List, MessageSquareText, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'consultant' | 'settings'>('dashboard');
  
  // Data State via Custom Hook
  const { 
    sessions, 
    activeSession, 
    activeSessionId, 
    setActiveSessionId, 
    addSession, 
    removeSession, 
    importSession, 
    updateTransactions,
    updateSettings,
    updateCategories,
    updateRules,
    updateSessionRaw
  } = useSessionData();

  // UI Local State
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Modal States
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


  // --- Logic for Modals & Data Operations ---

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
        if (!json.transactions || !Array.isArray(json.transactions) || !json.categories || !Array.isArray(json.categories)) {
            throw new Error("Invalid file structure");
        }
        importSession(json);
        alert("Session imported successfully!");
      } catch (err) {
        console.error(err);
        alert("Failed to import session.");
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
        const importedCategories = Array.from(new Set(rawTransactions.map(t => t.category)))
            .filter(cat => cat && cat.trim() !== '' && cat !== 'Uncategorized' && !activeSession.categories.includes(cat));
        const processedTransactions = applyRulesToTransactions(rawTransactions, activeSession.rules);

        updateSessionRaw(s => ({
            ...s,
            categories: [...s.categories, ...importedCategories],
            transactions: [...s.transactions, ...processedTransactions]
        }));
        setActiveTab('transactions');
      } catch (err) {
        console.error("Failed to parse file", err);
        alert("Error parsing file.");
      }
      e.target.value = ''; 
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
        // Remove existing rule if we are "overwriting" based on keyword
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
               // Re-apply all rules including the new one
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

    // Sort rules, handling regex vs normal is tricky but length is a decent proxy for specificity in simple cases
    const sortedRules = rules.sort((a, b) => b.keyword.length - a.keyword.length);
    const BATCH_SIZE = 500;
    const newTransactions: Transaction[] = [];
    let updatedCount = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const end = Math.min(i + BATCH_SIZE, total);
        const chunk = transactions.slice(i, end);
        chunk.forEach(t => {
            // Updated matching logic
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
      <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-indigo-500/30 relative">
        
        {/* --- MODALS --- */}
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

        {derivedTransactionData && (
            <TransactionDetailModal
                transaction={derivedTransactionData.transaction}
                similarTransactions={derivedTransactionData.similar}
                categoryTransactions={derivedTransactionData.inCategory}
                activeRule={derivedTransactionData.activeRule}
                availableCategories={activeSession.categories}
                onClose={() => setSelectedTransactionId(null)}
                onSave={handleSaveDetails}
            />
        )}

        {/* --- LAYOUT --- */}
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
            onImportFile={handleFileUpload}
        />

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

        {/* --- MAIN CONTENT --- */}
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
            {activeTab === 'transactions' && (
                <TransactionList 
                    transactions={activeSession.transactions} 
                    availableCategories={activeSession.categories} 
                    onCategoryChange={handleTransactionCategoryChange} 
                    onTransactionClick={setSelectedTransactionId} 
                />
            )}
            {activeTab === 'consultant' && <AIConsultant transactions={activeSession.transactions} />}
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
                />
            )}
        </main>
      </div>
    </HashRouter>
  );
};

export default App;