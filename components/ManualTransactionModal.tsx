import React, { useState } from 'react';
import { TransactionType, Category } from '../types';
import { X, Save, Plus, DollarSign, Calendar, Tag, AlignLeft, Wallet } from 'lucide-react';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  categories: string[];
  currency: string;
}

export const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  currency
}) => {
  const [data, setData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: TransactionType.EXPENSE,
    category: '',
    source: 'Manual Entry'
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!data.description || !data.amount) return;
    onSave({
      ...data,
      amount: parseFloat(data.amount),
      category: data.category || 'Uncategorized'
    });
    onClose();
    // Reset form for next time (optional, maybe keep source)
    setData(prev => ({ 
        ...prev, 
        description: '', 
        amount: '', 
        type: TransactionType.EXPENSE,
        category: ''
    }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-6 border-b border-border flex justify-between items-center bg-surfaceHighlight/50 rounded-t-2xl">
          <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
            <Plus size={20} className="text-primary" /> New Transaction
          </h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surfaceHighlight rounded-lg">
            <button
              onClick={() => setData({ ...data, type: TransactionType.EXPENSE })}
              className={`py-2 text-sm font-bold rounded-md transition-all ${
                data.type === TransactionType.EXPENSE 
                  ? 'bg-danger/20 text-danger shadow-sm border border-danger/20' 
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => setData({ ...data, type: TransactionType.INCOME })}
              className={`py-2 text-sm font-bold rounded-md transition-all ${
                data.type === TransactionType.INCOME 
                  ? 'bg-success/20 text-success shadow-sm border border-success/20' 
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              Income
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-textMuted uppercase mb-1 block">Amount ({currency})</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted font-mono text-lg">{currency}</span>
                <input
                    type="number"
                    autoFocus
                    placeholder="0.00"
                    value={data.amount}
                    onChange={e => setData({ ...data, amount: e.target.value })}
                    className="w-full bg-surfaceHighlight border border-border rounded-lg py-2 pl-8 pr-3 text-textMain text-lg font-bold focus:outline-none focus:border-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-textMuted uppercase mb-1 block">Description</label>
            <div className="relative">
                <AlignLeft size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                <input
                    type="text"
                    placeholder="e.g. Grocery Shopping"
                    value={data.description}
                    onChange={e => setData({ ...data, description: e.target.value })}
                    className="w-full bg-surfaceHighlight border border-border rounded-lg py-2 pl-9 pr-3 text-textMain text-sm focus:outline-none focus:border-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-semibold text-textMuted uppercase mb-1 block">Date</label>
                <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                    <input
                        type="date"
                        value={data.date}
                        onChange={e => setData({ ...data, date: e.target.value })}
                        className="w-full bg-surfaceHighlight border border-border rounded-lg py-2 pl-9 pr-3 text-textMain text-sm focus:outline-none focus:border-primary"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-semibold text-textMuted uppercase mb-1 block">Category</label>
                <div className="relative">
                    <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                    <select
                        value={data.category}
                        onChange={e => setData({ ...data, category: e.target.value })}
                        className="w-full bg-surfaceHighlight border border-border rounded-lg py-2 pl-9 pr-3 text-textMain text-sm focus:outline-none focus:border-primary appearance-none"
                    >
                        <option value="">Uncategorized</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-textMuted uppercase mb-1 block">Source</label>
            <div className="relative">
                <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                <input
                    type="text"
                    placeholder="e.g. Cash, Credit Card"
                    value={data.source}
                    onChange={e => setData({ ...data, source: e.target.value })}
                    className="w-full bg-surfaceHighlight border border-border rounded-lg py-2 pl-9 pr-3 text-textMain text-sm focus:outline-none focus:border-primary"
                />
            </div>
          </div>

        </div>

        <div className="p-6 pt-0">
          <button
            onClick={handleSubmit}
            disabled={!data.amount || !data.description}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight disabled:text-textMuted text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} /> Save Transaction
          </button>
        </div>
      </div>
    </div>
  );
};