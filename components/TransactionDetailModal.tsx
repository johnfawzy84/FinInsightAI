import React, { useState, useEffect } from 'react';
import { Transaction, CategorizationRule, TransactionType } from '../types';
import { X, Save, AlertCircle, ArrowRight, Wallet, Tag, BookOpen, Calculator, Calendar, AlignLeft, Regex } from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: Transaction;
  similarTransactions: Transaction[];
  categoryTransactions: Transaction[];
  activeRule?: CategorizationRule;
  availableCategories: string[];
  onClose: () => void;
  onSave: (
    transactionId: string, 
    newCategory: string, 
    applyToSimilar: boolean, 
    newRule: { keyword: string, category: string, isRegex: boolean } | null
  ) => void;
  currency: string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  similarTransactions,
  categoryTransactions,
  activeRule,
  availableCategories,
  onClose,
  onSave,
  currency
}) => {
  const [category, setCategory] = useState(transaction.category);
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  
  // Rule State
  const [createRule, setCreateRule] = useState(!!activeRule);
  const [ruleKeyword, setRuleKeyword] = useState(activeRule ? activeRule.keyword : transaction.description.toLowerCase());
  const [ruleIsRegex, setRuleIsRegex] = useState(activeRule?.isRegex || false);

  useEffect(() => {
    setCategory(transaction.category);
    // Default keyword: try to find a meaningful word if no rule exists, otherwise full description
    if (!activeRule) {
        setRuleKeyword(transaction.description.toLowerCase());
        setRuleIsRegex(false);
    } else {
        setRuleKeyword(activeRule.keyword);
        setRuleIsRegex(!!activeRule.isRegex);
    }
  }, [transaction, activeRule]);

  const totalSimilarAmount = similarTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalCategoryAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

  const handleSave = () => {
    if (createRule && ruleIsRegex) {
        try {
            new RegExp(ruleKeyword);
        } catch(e) {
            alert("Invalid Regex pattern");
            return;
        }
    }

    onSave(
        transaction.id, 
        category, 
        applyToSimilar, 
        createRule && ruleKeyword.trim() ? { keyword: ruleKeyword.trim(), category, isRegex: ruleIsRegex } : null
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-start bg-surfaceHighlight/50">
          <div>
            <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                Transaction Details
            </h2>
            <p className="text-textMuted text-sm mt-1">ID: {transaction.id.split('-')[1]}...</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
            
            {/* Primary Info Card */}
            <div className="bg-surfaceHighlight rounded-xl p-5 border border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 text-primary"><AlignLeft size={18} /></div>
                        <div>
                            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Description</label>
                            <div className="text-textMain font-medium text-lg">{transaction.description}</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-1 text-primary"><Calendar size={18} /></div>
                        <div>
                            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Date</label>
                            <div className="text-textMuted">{transaction.date}</div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                     <div className="flex items-start gap-3">
                        <div className={`mt-1 ${transaction.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}`}>
                            <Calculator size={18} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider">Amount</label>
                            <div className={`text-2xl font-bold ${transaction.type === TransactionType.INCOME ? 'text-success' : 'text-textMain'}`}>
                                {currency}{transaction.amount.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categorization Logic Section */}
            <div className="bg-surfaceHighlight/50 rounded-xl p-5 border border-primary/20">
                <div className="flex items-center gap-2 mb-4 text-primary">
                    <Tag size={18} />
                    <h3 className="font-semibold">Categorization & Rules</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-2">Category</label>
                        <select 
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-textMain focus:border-primary focus:outline-none"
                        >
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        
                        <div className="mt-4 flex items-center gap-2">
                             <input 
                                type="checkbox" 
                                id="applySimilar"
                                checked={applyToSimilar}
                                onChange={(e) => setApplyToSimilar(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                            />
                            <label htmlFor="applySimilar" className="text-sm text-textMuted select-none cursor-pointer">
                                Update <strong>{similarTransactions.length}</strong> similar transactions
                            </label>
                        </div>
                    </div>

                    {/* Rule Definition */}
                    <div className={`p-4 rounded-lg border transition-all ${createRule ? 'bg-primary/10 border-primary/50' : 'bg-background/50 border-border'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-medium text-textMuted flex items-center gap-2">
                                <BookOpen size={16} />
                                {activeRule ? 'Active Rule' : 'Create Rule'}
                            </label>
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    checked={createRule}
                                    onChange={(e) => setCreateRule(e.target.checked)}
                                    className="mr-2"
                                />
                                <span className="text-xs text-textMuted">{createRule ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </div>
                        
                        {createRule && (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs text-textMuted">Pattern:</label>
                                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => setRuleIsRegex(!ruleIsRegex)}>
                                        <div className={`w-3 h-3 rounded-full border ${ruleIsRegex ? 'bg-primary border-primary' : 'border-textMuted'}`}></div>
                                        <span className={`text-xs ${ruleIsRegex ? 'text-primary' : 'text-textMuted'}`}>Regex</span>
                                    </div>
                                </div>
                                <input 
                                    type="text" 
                                    value={ruleKeyword}
                                    onChange={(e) => setRuleKeyword(e.target.value)}
                                    className={`w-full bg-background border ${ruleIsRegex ? 'border-primary/50 text-primary font-mono' : 'border-border text-textMain'} rounded px-3 py-2 text-sm focus:border-primary mb-2`}
                                    placeholder={ruleIsRegex ? "^uber.*" : "e.g. uber"}
                                />
                                <p className="text-xs text-primary">
                                    <ArrowRight size={12} className="inline mr-1"/>
                                    Sets category to <strong>{category}</strong>
                                </p>
                            </div>
                        )}
                        {!createRule && activeRule && (
                             <div className="text-xs text-yellow-500 flex items-center gap-1 mt-2">
                                <AlertCircle size={12} />
                                Unchecking this will not delete the rule, only stop updating it now.
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
                    <label className="text-xs text-textMuted uppercase font-semibold flex items-center gap-1 mb-1">
                        <Wallet size={14} /> Similar (Description)
                    </label>
                    <div className="text-lg font-bold text-textMain">{currency}{totalSimilarAmount.toFixed(2)}</div>
                    <div className="text-xs text-textMuted">{similarTransactions.length} transactions</div>
                </div>
                <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
                     <label className="text-xs text-textMuted uppercase font-semibold flex items-center gap-1 mb-1">
                        <Tag size={14} /> Category Total
                    </label>
                    <div className="text-lg font-bold text-textMain">{currency}{totalCategoryAmount.toFixed(2)}</div>
                    <div className="text-xs text-textMuted">{categoryTransactions.length} transactions in '{transaction.category}'</div>
                </div>
            </div>

            {/* Similar Transactions Preview */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-textMuted">Similar Bookings Preview</h4>
                <div className="max-h-32 overflow-y-auto border border-border rounded-lg bg-background/50">
                    <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-border">
                            {similarTransactions.slice(0, 10).map(t => (
                                <tr key={t.id} className="text-textMuted hover:bg-surfaceHighlight/50">
                                    <td className="p-2">{t.date}</td>
                                    <td className="p-2 truncate max-w-[200px]">{t.description}</td>
                                    <td className="p-2 text-right">{currency}{t.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {similarTransactions.length > 10 && (
                        <div className="p-2 text-center text-xs text-textMuted bg-surfaceHighlight/30">
                            + {similarTransactions.length - 10} more...
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-3 bg-surfaceHighlight/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 flex items-center gap-2 transition-all"
          >
            <Save size={18} />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;