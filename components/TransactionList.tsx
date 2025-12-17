import React from 'react';
import { Transaction, TransactionType } from '../types';
import { ArrowUpRight, ArrowDownLeft, Tag, ChevronDown } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  availableCategories: string[];
  onCategoryChange: (transactionId: string, newCategory: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, availableCategories, onCategoryChange }) => {
  return (
    <div className="bg-surface rounded-xl border border-slate-700 shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <h3 className="text-xl font-semibold text-white">Recent Transactions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900/50 text-slate-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {transactions.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No transactions found. Import a file or add manually.
                    </td>
                </tr>
            ) : (
                transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">{t.date}</td>
                    <td className="px-6 py-4 font-medium text-white">{t.description}</td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block w-48">
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
                        <span>${t.amount.toFixed(2)}</span>
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