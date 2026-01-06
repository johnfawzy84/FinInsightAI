import { useState, useMemo, useEffect } from 'react';
import { Session, Transaction, CategorizationRule, ImportSettings, DEFAULT_CATEGORIES, TransactionType, Category, Asset, DashboardWidget, ImportSelection, Goal, Budget, GoogleUser } from '../types';
import { initGoogleClient, loginToGoogle, saveToDrive, loadFromDrive } from '../services/googleDrive';

export const applyRulesToTransactions = (transactions: Transaction[], rules: CategorizationRule[]): Transaction[] => {
  if (rules.length === 0) return transactions;
  const sortedRules = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);
  return transactions.map(t => {
    const matchingRule = sortedRules.find(r => {
      if (r.isRegex) {
        try {
          const regex = new RegExp(r.keyword, 'i');
          return regex.test(t.description);
        } catch (e) {
          console.warn(`Invalid regex rule: ${r.keyword}`);
          return false;
        }
      }
      return t.description.toLowerCase().includes(r.keyword.toLowerCase());
    });
    return matchingRule ? { ...t, category: matchingRule.category } : t;
  });
};

export const useSessionData = () => {
  const defaultSettings: ImportSettings = {
    delimiter: ';', 
    dateFormat: 'DD.MM.YYYY',
    decimalSeparator: ','
  };

  const initialTransactions: Transaction[] = [
    { id: '1', date: '2023-10-01', description: 'Monthly Salary', amount: 5000, type: TransactionType.INCOME, category: Category.INCOME, source: 'Manual Entry' },
    { id: '2', date: '2023-10-02', description: 'Rent Payment', amount: 1500, type: TransactionType.EXPENSE, category: Category.HOUSING, source: 'Manual Entry' },
    { id: '3', date: '2023-10-05', description: 'Grocery Store', amount: 150, type: TransactionType.EXPENSE, category: Category.FOOD, source: 'Manual Entry' },
    { id: '4', date: '2023-10-06', description: 'Uber Trip', amount: 25, type: TransactionType.EXPENSE, category: Category.TRANSPORT, source: 'Manual Entry' },
    { id: '5', date: '2023-10-08', description: 'Netflix Subscription', amount: 15, type: TransactionType.EXPENSE, category: Category.ENTERTAINMENT, source: 'Manual Entry' },
    { id: '6', date: '2023-10-10', description: 'Electric Bill', amount: 120, type: TransactionType.EXPENSE, category: Category.UTILITIES, source: 'Manual Entry' },
  ];

  const initialAssets: Asset[] = [
    { id: 'a1', name: 'Main Checking', value: 2500, type: 'Cash', color: '#10b981' },
    { id: 'a2', name: 'Savings Account', value: 10000, type: 'Cash', color: '#34d399' },
    { id: 'a3', name: 'Investment Portfolio', value: 15000, type: 'Stock', color: '#6366f1' },
  ];

  const initialGoals: Goal[] = [
    { id: 'g1', type: 'GOAL', title: 'Summer Vacation', targetAmount: 2000, allocatedAmount: 500, targetDate: '2024-07-01', priority: 3, icon: '✈️' },
    { id: 'g2', type: 'GOAL', title: 'New Laptop', targetAmount: 1500, allocatedAmount: 1500, targetDate: '2024-02-01', priority: 5, icon: '💻' }
  ];

  const initialBudgets: Budget[] = [
    { id: 'b1', category: 'Food & Dining', limit: 600, period: 'monthly' },
    { id: 'b2', category: 'Transportation', limit: 100, period: 'monthly' },
  ];

  const defaultWidgets: DashboardWidget[] = [
    { id: 'w-networth', type: 'net-worth', title: 'Net Worth Trend', visible: true, width: 'full' },
    { id: 'w-assets', type: 'assets', title: 'Assets', visible: true, width: 'half' },
    { id: 'w-cashflow', type: 'cash-flow', title: 'Cash Flow', visible: true, width: 'half' },
    { id: 'w-recurring', type: 'recurring', title: 'Regular Expenses', visible: true, width: 'half' },
    { id: 'w-spending', type: 'spending', title: 'Spending Categories', visible: true, width: 'half' },
    { id: 'w-sankey', type: 'sankey', title: 'Income to Expense Flow', visible: true, width: 'full' },
  ];

  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('finsight_sessions');
    if (saved) return JSON.parse(saved);
    return [
        {
          id: 'default-session',
          name: 'Personal Finance',
          currency: '$',
          transactions: initialTransactions,
          categories: [...DEFAULT_CATEGORIES],
          rules: [],
          assets: initialAssets,
          goals: initialGoals,
          budgets: initialBudgets,
          sources: ['Manual Entry'],
          dashboardWidgets: defaultWidgets,
          createdAt: Date.now(),
          importSettings: defaultSettings
        }
    ];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
      const saved = localStorage.getItem('finsight_active_id');
      return saved || 'default-session';
  });

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Persistence to LocalStorage
  useEffect(() => {
    localStorage.setItem('finsight_sessions', JSON.stringify(sessions));
    localStorage.setItem('finsight_active_id', activeSessionId);
  }, [sessions, activeSessionId]);

  // Init Google Client
  useEffect(() => {
    initGoogleClient().catch(err => console.error('Failed to init Google Client', err));
  }, []);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const addSession = (name: string) => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name,
      currency: '$',
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      rules: [],
      assets: [],
      goals: [],
      budgets: [],
      sources: [],
      dashboardWidgets: [...defaultWidgets],
      createdAt: Date.now(),
      importSettings: { ...defaultSettings }
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  };

  const removeSession = (sessionId: string) => {
    if (sessions.length <= 1) return;
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (activeSessionId === sessionId) {
      setActiveSessionId(newSessions[0].id);
    }
  };

  const handleGoogleLogin = async () => {
    try {
        const user = await loginToGoogle();
        setGoogleUser(user);
        return user;
    } catch (err) {
        console.error('Login failed', err);
        throw err;
    }
  };

  const syncToCloud = async () => {
    if (!googleUser) return;
    setIsSyncing(true);
    try {
        const dataToSave = {
            sessions,
            activeSessionId,
            lastSyncedAt: Date.now()
        };
        await saveToDrive(dataToSave);
        // Update local sync time
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, lastSyncedAt: Date.now() } : s));
    } catch (err) {
        console.error('Sync failed', err);
        alert('Cloud sync failed. Please check your connection.');
    } finally {
        setIsSyncing(false);
    }
  };

  const syncFromCloud = async () => {
    if (!googleUser) return;
    setIsSyncing(true);
    try {
        const cloudData = await loadFromDrive();
        if (cloudData && cloudData.sessions) {
            setSessions(cloudData.sessions);
            setActiveSessionId(cloudData.activeSessionId);
            alert('Cloud data loaded successfully!');
        } else {
            alert('No cloud backup found. Save your first session to Drive!');
        }
    } catch (err) {
        console.error('Load from cloud failed', err);
        alert('Failed to load from cloud.');
    } finally {
        setIsSyncing(false);
    }
  };

  const mergeSession = (incomingData: Session, selection: ImportSelection) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;

      const merged = { ...s };

      if (selection.categories) {
        const currentCats = s.categories || [];
        const incomingCats = incomingData.categories || [];
        const newCats = new Set([...currentCats, ...incomingCats]);
        merged.categories = Array.from(newCats);
      }

      if (selection.rules) {
        const currentRules = s.rules || [];
        const existingKeywords = new Set(currentRules.map(r => r.keyword.toLowerCase()));
        const incomingRules = incomingData.rules || [];
        const rulesToAdd = incomingRules.filter(r => !existingKeywords.has(r.keyword.toLowerCase()));
        merged.rules = [...currentRules, ...rulesToAdd];
      }

      if (selection.transactions) {
        const currentTx = s.transactions || [];
        const existingIds = new Set(currentTx.map(t => t.id));
        const incomingTx = incomingData.transactions || [];
        const txToAdd = incomingTx.filter(t => !existingIds.has(t.id));
        merged.transactions = [...currentTx, ...txToAdd];

        // Ensure sources from incoming session are added too
        const incomingSources = incomingData.sources || [];
        const combinedSources = Array.from(new Set([...(s.sources || []), ...incomingSources]));
        merged.sources = combinedSources;
      }

      if (selection.assets) {
         const incomingAssets = incomingData.assets || [];
         const newAssets = incomingAssets.map(a => ({ ...a, id: `imported-asset-${Date.now()}-${Math.random()}` }));
         merged.assets = [...(s.assets || []), ...newAssets];
      }

      if (selection.dashboard) {
         const existingWidgets = s.dashboardWidgets || [];
         const incomingWidgets = incomingData.dashboardWidgets || [];
         const standardTypes = ['net-worth', 'assets', 'cash-flow', 'spending', 'sankey', 'recurring'];
         const updatedWidgets = existingWidgets.map(w => {
            const match = incomingWidgets.find(iw => iw.type === w.type);
            if (match && standardTypes.includes(w.type)) {
                return { ...w, visible: match.visible, width: match.width };
            }
            return w;
         });
         const newCustomWidgets = incomingWidgets
            .filter(iw => iw.type === 'custom')
            .map(iw => ({ ...iw, id: `imported-widget-${Date.now()}-${Math.random()}` })); 
         merged.dashboardWidgets = [...updatedWidgets, ...newCustomWidgets];
      }

      if (selection.goals) {
         const incomingGoals = incomingData.goals || [];
         const newGoals = incomingGoals.map(g => ({ ...g, id: `imported-goal-${Date.now()}-${Math.random()}` }));
         merged.goals = [...(s.goals || []), ...newGoals];
      }

      if (selection.budgets) {
        const incomingBudgets = incomingData.budgets || [];
        const newBudgets = incomingBudgets.map(b => ({ ...b, id: `imported-budget-${Date.now()}-${Math.random()}` }));
        merged.budgets = [...(s.budgets || []), ...newBudgets];
      }

      return merged;
    }));
  };

  const updateTransactions = (updater: (currentTransactions: Transaction[]) => Transaction[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, transactions: updater(s.transactions) } : s));
  };

  const updateSettings = (newSettings: Partial<ImportSettings>) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, importSettings: { ...s.importSettings, ...newSettings } } : s));
  };

  const updateCategories = (newCategories: string[], renamedFrom?: string, renamedTo?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        let updatedTransactions = s.transactions;
        if (renamedFrom && renamedTo) {
          updatedTransactions = s.transactions.map(t => t.category === renamedFrom ? { ...t, category: renamedTo } : t);
        }
        return { ...s, categories: newCategories, transactions: updatedTransactions };
      }
      return s;
    }));
  };

  const updateRules = (updater: (rules: CategorizationRule[]) => CategorizationRule[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, rules: updater(s.rules) } : s));
  };

  const updateAssets = (updater: (assets: Asset[]) => Asset[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, assets: updater(s.assets || []) } : s));
  };
  
  const updateGoals = (updater: (goals: Goal[]) => Goal[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, goals: updater(s.goals || []) } : s));
  };

  const updateBudgets = (updater: (budgets: Budget[]) => Budget[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, budgets: updater(s.budgets || []) } : s));
  };

  const updateDashboardWidgets = (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, dashboardWidgets: updater(s.dashboardWidgets || []) } : s));
  };

  const updateSessionRaw = (updater: (session: Session) => Session) => {
     setSessions(prev => prev.map(s => s.id === activeSessionId ? updater(s) : s));
  };
  
  const deleteSource = (sourceName: string) => {
    setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;
        const newSources = s.sources.filter(src => src !== sourceName);
        const newTransactions = s.transactions.filter(t => t.source !== sourceName);
        return { ...s, sources: newSources, transactions: newTransactions };
    }));
  };

  return {
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
  };
};