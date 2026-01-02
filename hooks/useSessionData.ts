import { useState, useMemo } from 'react';
import { Session, Transaction, CategorizationRule, ImportSettings, DEFAULT_CATEGORIES, TransactionType, Category, Asset, DashboardWidget, ImportSelection, Goal } from '../types';

// Helper for synchronous rule application
export const applyRulesToTransactions = (transactions: Transaction[], rules: CategorizationRule[]): Transaction[] => {
  if (rules.length === 0) return transactions;
  const sortedRules = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);
  return transactions.map(t => {
    const matchingRule = sortedRules.find(r => {
      if (r.isRegex) {
        try {
          // Use safe regex matching (case-insensitive by default)
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
    { id: '1', date: '2023-10-01', description: 'Monthly Salary', amount: 5000, type: TransactionType.INCOME, category: Category.INCOME },
    { id: '2', date: '2023-10-02', description: 'Rent Payment', amount: 1500, type: TransactionType.EXPENSE, category: Category.HOUSING },
    { id: '3', date: '2023-10-05', description: 'Grocery Store', amount: 150, type: TransactionType.EXPENSE, category: Category.FOOD },
    { id: '4', date: '2023-10-06', description: 'Uber Trip', amount: 25, type: TransactionType.EXPENSE, category: Category.TRANSPORT },
    { id: '5', date: '2023-10-08', description: 'Netflix Subscription', amount: 15, type: TransactionType.EXPENSE, category: Category.ENTERTAINMENT },
    { id: '6', date: '2023-10-10', description: 'Electric Bill', amount: 120, type: TransactionType.EXPENSE, category: Category.UTILITIES },
  ];

  const initialAssets: Asset[] = [
    { id: 'a1', name: 'Main Checking', value: 2500, type: 'Cash', color: '#10b981' },
    { id: 'a2', name: 'Savings Account', value: 10000, type: 'Cash', color: '#34d399' },
    { id: 'a3', name: 'Investment Portfolio', value: 15000, type: 'Stock', color: '#6366f1' },
  ];

  const initialGoals: Goal[] = [
    { id: 'g1', title: 'Summer Vacation', targetAmount: 2000, allocatedAmount: 500, targetDate: '2024-07-01', priority: 3, icon: '✈️' },
    { id: 'g2', title: 'New Laptop', targetAmount: 1500, allocatedAmount: 1500, targetDate: '2024-02-01', priority: 5, icon: '💻' }
  ];

  const defaultWidgets: DashboardWidget[] = [
    { id: 'w-networth', type: 'net-worth', title: 'Net Worth Trend', visible: true, width: 'full' },
    { id: 'w-assets', type: 'assets', title: 'Assets', visible: true, width: 'half' },
    { id: 'w-cashflow', type: 'cash-flow', title: 'Cash Flow', visible: true, width: 'half' },
    { id: 'w-spending', type: 'spending', title: 'Spending Categories', visible: true, width: 'half' },
    { id: 'w-sankey', type: 'sankey', title: 'Income to Expense Flow', visible: true, width: 'full' },
  ];

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'default-session',
      name: 'Personal Finance',
      transactions: initialTransactions,
      categories: [...DEFAULT_CATEGORIES],
      rules: [],
      assets: initialAssets,
      goals: initialGoals,
      dashboardWidgets: defaultWidgets,
      createdAt: Date.now(),
      importSettings: defaultSettings
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default-session');

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const addSession = (name: string) => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name,
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      rules: [],
      assets: [],
      goals: [],
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

  const importSession = (sessionData: any) => {
    const newSession: Session = {
        ...sessionData,
        id: `session-${Date.now()}`,
        name: sessionData.name ? `${sessionData.name} (Imported)` : 'Imported Session',
        // Ensure widgets exist if importing older version
        dashboardWidgets: sessionData.dashboardWidgets || [...defaultWidgets],
        // Ensure goals exist if importing older version
        goals: sessionData.goals || [],
        createdAt: Date.now()
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  };

  /**
   * Merges imported data into the active session based on user selection.
   */
  const mergeSession = (incomingData: Session, selection: ImportSelection) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;

      const merged = { ...s };

      // 1. Merge Categories (Unique union)
      if (selection.categories) {
        const currentCats = s.categories || [];
        const incomingCats = incomingData.categories || [];
        const newCats = new Set([...currentCats, ...incomingCats]);
        merged.categories = Array.from(newCats);
      }

      // 2. Merge Rules (Avoid duplicate keywords)
      if (selection.rules) {
        const currentRules = s.rules || [];
        const existingKeywords = new Set(currentRules.map(r => r.keyword.toLowerCase()));
        const incomingRules = incomingData.rules || [];
        const rulesToAdd = incomingRules.filter(r => !existingKeywords.has(r.keyword.toLowerCase()));
        merged.rules = [...currentRules, ...rulesToAdd];
      }

      // 3. Merge Transactions (Avoid duplicate IDs, though usually IDs are unique per session)
      if (selection.transactions) {
        const currentTx = s.transactions || [];
        const existingIds = new Set(currentTx.map(t => t.id));
        const incomingTx = incomingData.transactions || [];
        const txToAdd = incomingTx.filter(t => !existingIds.has(t.id));
        merged.transactions = [...currentTx, ...txToAdd];
      }

      // 4. Merge Assets (Append new assets)
      if (selection.assets) {
         // Optionally check for name duplicates or just append
         // Here we simply append to avoid data loss, user can delete duplicates
         const incomingAssets = incomingData.assets || [];
         const newAssets = incomingAssets.map(a => ({ ...a, id: `imported-asset-${Date.now()}-${Math.random()}` }));
         merged.assets = [...(s.assets || []), ...newAssets];
      }

      // 5. Merge Dashboard (Add custom widgets)
      if (selection.dashboard) {
         const existingWidgets = s.dashboardWidgets || [];
         const incomingWidgets = incomingData.dashboardWidgets || [];
         
         const standardTypes = ['net-worth', 'assets', 'cash-flow', 'spending', 'sankey'];
         
         const updatedWidgets = existingWidgets.map(w => {
            const match = incomingWidgets.find(iw => iw.type === w.type);
            if (match && standardTypes.includes(w.type)) {
                return { ...w, visible: match.visible, width: match.width };
            }
            return w;
         });

         const newCustomWidgets = incomingWidgets
            .filter(iw => iw.type === 'custom')
            .map(iw => ({ ...iw, id: `imported-widget-${Date.now()}-${Math.random()}` })); // Regen ID to avoid conflict

         merged.dashboardWidgets = [...updatedWidgets, ...newCustomWidgets];
      }

      // 6. Merge Goals (Append new goals)
      if (selection.goals) {
         const incomingGoals = incomingData.goals || [];
         const newGoals = incomingGoals.map(g => ({ ...g, id: `imported-goal-${Date.now()}-${Math.random()}` }));
         merged.goals = [...(s.goals || []), ...newGoals];
      }

      return merged;
    }));
  };

  // Updaters
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

  const updateDashboardWidgets = (updater: (widgets: DashboardWidget[]) => DashboardWidget[]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, dashboardWidgets: updater(s.dashboardWidgets || []) } : s));
  };

  // Raw Session Updater (for complex batch operations involving multiple fields)
  const updateSessionRaw = (updater: (session: Session) => Session) => {
     setSessions(prev => prev.map(s => s.id === activeSessionId ? updater(s) : s));
  };

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    addSession,
    removeSession,
    importSession,
    mergeSession,
    updateTransactions,
    updateSettings,
    updateCategories,
    updateRules,
    updateAssets,
    updateGoals,
    updateDashboardWidgets,
    updateSessionRaw
  };
};