import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { ArrowUpRight, ArrowDownLeft, ChevronDown, X, Filter, Tag, Plus } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  availableCategories: string[];
  onCategoryChange: (transactionId: string, newCategory: string) => void;
  onTransactionClick?: (transactionId: string) => void;
  currency: string;
  onManualAdd?: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  availableCategories, 
  onCategoryChange,
  onTransactionClick,
  currency,
  onManualAdd
}) => {
  const [filters, setFilters] = useState({
    date: '',
    description: '',
    category: '',
    amount: '',
    source: ''
  });

  const availableSources = useMemo(() => Array.from(new Set(transactions.map(t => t.source || 'Unknown'))), [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchDate = t.date.toLowerCase().includes(filters.date.toLowerCase());
      const matchDesc = t.description.toLowerCase().includes(filters.description.toLowerCase());
      const matchCat = filters.category === '' || t.category === filters.category;
      const matchSource = filters.source === '' || (t.source || 'Unknown') === filters.source;
      
      let matchAmount = true;
      if (filters.amount) {
         const cleanFilter = filters.amount.trim();
         // Check for operators
         if (cleanFilter.startsWith('>=')) {
            const val = parseFloat(cleanFilter.substring(2));
            if (!isNaN(val)) matchAmount = t.amount >= val;
         } else if (cleanFilter.startsWith('<=')) {
            const val = parseFloat(cleanFilter.substring(2));
            if (!isNaN(val)) matchAmount = t.amount <= val;
         } else if (cleanFilter.startsWith('>')) {
            const val = parseFloat(cleanFilter.substring(1));
            if (!isNaN(val)) matchAmount = t.amount > val;
         } else if (cleanFilter.startsWith('<')) {
             const val = parseFloat(cleanFilter.substring(1));
             if (!isNaN(val)) matchAmount = t.amount < val;
         } else if (cleanFilter.startsWith('=')) {
             const val = parseFloat(cleanFilter.substring(1));
             if (!isNaN(val)) matchAmount = Math.abs(t.amount - val) < 0.01;
         } else {
             // String match or exact number match attempt
             matchAmount = t.amount.toString().includes(cleanFilter);
         }
      }

      return matchDate && matchDesc && matchCat && matchAmount && matchSource;
    });
  }, [transactions, filters]);

  const clearFilters = () => {
    setFilters({ date: '', description: '', category: '', amount: '', source: '' });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="bg-surface rounded-xl border border-border shadow-lg overflow-hidden flex flex-col">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surfaceHighlight/30">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h3 className="text-lg sm:text-xl font-semibold text-textMain flex items-center gap-2">
                Transactions 
                <span className="text-xs sm:text-sm font-normal text-textMuted bg-surfaceHighlight px-2 py-0.5 rounded-full border border-border">
                    {filteredTransactions.length} / {transactions.length}
                </span>
            </h3>
            {hasActiveFilters && (
                <button 
                    onClick={clearFilters}
                    className="flex items-center space-x-1 text-xs text-textMuted hover:text-textMain bg-surfaceHighlight hover:bg-surfaceHighlight/80 px-3 py-1.5 rounded-lg border border-border transition-colors"
                >
                    <X size={14} />
                    <span>Clear Filters</span>
                </button>
            )}
        </div>
        {onManualAdd && (
            <button 
                id="tutorial-add-transaction"
                onClick={onManualAdd}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
            >
                <Plus size={16} /> Add Transaction
            </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-textMuted">
          <thead className="bg-background/80 text-textMain uppercase font-medium">
            <tr>
              <th className="px-6 py-4 min-w-[140px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Date <Filter size={10} className="text-textMuted"/></span>
                      <input 
                        type="text" 
                        placeholder="Filter..." 
                        value={filters.date}
                        onChange={e => setFilters({...filters, date: e.target.value})}
                        className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-normal normal-case placeholder-textMuted/50"
                      />
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[200px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Description <Filter size={10} className="text-textMuted"/></span>
                      <input 
                        type="text" 
                        placeholder="Search description..." 
                        value={filters.description}
                        onChange={e => setFilters({...filters, description: e.target.value})}
                        className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-normal normal-case placeholder-textMuted/50"
                      />
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[140px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Source <Filter size={10} className="text-textMuted"/></span>
                      <div className="relative">
                        <select
                            value={filters.source}
                            onChange={e => setFilters({...filters, source: e.target.value})}
                            className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-normal normal-case appearance-none cursor-pointer"
                        >
                            <option value="">All Sources</option>
                            {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-textMuted pointer-events-none" />
                      </div>
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[180px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Category <Filter size={10} className="text-textMuted"/></span>
                      <div className="relative">
                        <select
                            value={filters.category}
                            onChange={e => setFilters({...filters, category: e.target.value})}
                            className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-normal normal-case appearance-none cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-textMuted pointer-events-none" />
                      </div>
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[140px] align-top text-right">
                   <div className="flex flex-col space-y-2 items-end">
                      <span className="flex items-center gap-1">Amount <Filter size={10} className="text-textMuted"/></span>
                      <input 
                        type="text" 
                        placeholder="> 100, < 50" 
                        value={filters.amount}
                        onChange={e => setFilters({...filters, amount: e.target.value})}
                        className="w-full bg-surfaceHighlight border border-border rounded px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary font-normal normal-case text-right placeholder-textMuted/50"
                      />
                  </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredTransactions.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-textMuted">
                        {transactions.length === 0 
                            ? "No transactions available." 
                            : "No transactions match your filters."}
                    </td>
                </tr>
            ) : (
                filteredTransactions.map((t) => (
                <tr 
                    key={t.id} 
                    onClick={() => onTransactionClick && onTransactionClick(t.id)}
                    className="hover:bg-surfaceHighlight/50 transition-colors group cursor-pointer"
                >
                    <td className="px-6 py-4 whitespace-nowrap text-textMuted font-mono text-xs">{t.date}</td>
                    <td className="px-6 py-4 font-medium text-textMain">
                        <div>{t.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                         <span className="text-xs text-textMuted bg-surfaceHighlight px-2 py-1 rounded border border-border">
                             {t.source || 'Unknown'}
                         </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block w-full max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.category}
                          onChange={(e) => onCategoryChange(t.id, e.target.value)}
                          className="w-full appearance-none bg-primary/10 border border-primary/20 text-primary text-xs font-medium rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surfaceHighlight cursor-pointer hover:bg-surfaceHighlight hover:border-primary/50 transition-all"
                        >
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat} className="bg-surface text-textMain">
                              {cat}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-success' : 'text-textMain'}`}>
                    <div className="flex items-center justify-end space-x-1">
                        {t.type === TransactionType.INCOME ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        <span>{currency}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;