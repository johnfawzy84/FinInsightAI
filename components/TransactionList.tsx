import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { ArrowUpRight, ArrowDownLeft, ChevronDown, X, Filter } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  availableCategories: string[];
  onCategoryChange: (transactionId: string, newCategory: string) => void;
  onTransactionClick?: (transactionId: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  availableCategories, 
  onCategoryChange,
  onTransactionClick
}) => {
  const [filters, setFilters] = useState({
    date: '',
    description: '',
    category: '',
    amount: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchDate = t.date.toLowerCase().includes(filters.date.toLowerCase());
      const matchDesc = t.description.toLowerCase().includes(filters.description.toLowerCase());
      const matchCat = filters.category === '' || t.category === filters.category;
      
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

      return matchDate && matchDesc && matchCat && matchAmount;
    });
  }, [transactions, filters]);

  const clearFilters = () => {
    setFilters({ date: '', description: '', category: '', amount: '' });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="bg-surface rounded-xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            Transactions 
            <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {filteredTransactions.length} / {transactions.length}
            </span>
        </h3>
        {hasActiveFilters && (
            <button 
                onClick={clearFilters}
                className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors"
            >
                <X size={14} />
                <span>Clear Filters</span>
            </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900/80 text-slate-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-4 min-w-[140px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Date <Filter size={10} className="text-slate-500"/></span>
                      <input 
                        type="text" 
                        placeholder="Filter..." 
                        value={filters.date}
                        onChange={e => setFilters({...filters, date: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-normal normal-case placeholder-slate-600"
                      />
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[250px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Description <Filter size={10} className="text-slate-500"/></span>
                      <input 
                        type="text" 
                        placeholder="Search description..." 
                        value={filters.description}
                        onChange={e => setFilters({...filters, description: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-normal normal-case placeholder-slate-600"
                      />
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[180px] align-top">
                  <div className="flex flex-col space-y-2">
                      <span className="flex items-center gap-1">Category <Filter size={10} className="text-slate-500"/></span>
                      <div className="relative">
                        <select
                            value={filters.category}
                            onChange={e => setFilters({...filters, category: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-normal normal-case appearance-none cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                  </div>
              </th>
              <th className="px-6 py-4 min-w-[140px] align-top text-right">
                   <div className="flex flex-col space-y-2 items-end">
                      <span className="flex items-center gap-1">Amount <Filter size={10} className="text-slate-500"/></span>
                      <input 
                        type="text" 
                        placeholder="> 100, < 50" 
                        value={filters.amount}
                        onChange={e => setFilters({...filters, amount: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-normal normal-case text-right placeholder-slate-600"
                      />
                  </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredTransactions.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
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
                    className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                >
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-mono text-xs">{t.date}</td>
                    <td className="px-6 py-4 font-medium text-white">{t.description}</td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block w-full max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.category}
                          onChange={(e) => onCategoryChange(t.id, e.target.value)}
                          className="w-full appearance-none bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium rounded-md py-1.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 cursor-pointer hover:bg-slate-800 hover:border-indigo-500/50 transition-all"
                        >
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat} className="bg-slate-800 text-slate-200">
                              {cat}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-end space-x-1">
                        {t.type === TransactionType.INCOME ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        <span>${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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