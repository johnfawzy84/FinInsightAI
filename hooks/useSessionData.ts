import { useState, useMemo } from 'react';
import { Session, Transaction, CategorizationRule, ImportSettings, DEFAULT_CATEGORIES, TransactionType, Category } from '../types';

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
        createdAt: Date.now()
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
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
    updateTransactions,
    updateSettings,
    updateCategories,
    updateRules,
    updateSessionRaw
  };
};