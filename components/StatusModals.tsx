import React from 'react';
import { Loader2, CheckCircle, Eraser, Trash2, X, Zap } from 'lucide-react';

interface RuleProgressModalProps {
  status: { progress: number; total: number; updated: number; finished: boolean } | null;
  onClose: () => void;
}

export const RuleProgressModal: React.FC<RuleProgressModalProps> = ({ status, onClose }) => {
  if (!status) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            {status.finished ? (
                <>
                    <div className="mx-auto bg-emerald-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center text-emerald-400 mb-4 animate-scale-in">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Rules Applied!</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        Processed <strong className="text-white">{status.total}</strong> transactions.<br/>
                        Updated <strong className="text-emerald-400">{status.updated}</strong> categorizations.
                    </p>
                    <button 
                        onClick={onClose}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors border border-slate-600"
                    >
                        Close
                    </button>
                </>
            ) : (
                <>
                    <div className="mx-auto mb-4 text-indigo-400 animate-spin">
                        <Loader2 size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Applying Rules...</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Processing transaction {status.progress} of {status.total}
                    </p>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                            style={{ width: `${(status.progress / status.total) * 100}%` }}
                        ></div>
                    </div>
                </>
            )}
        </div>
    </div>
  );
};

interface SanitizationProposalModalProps {
  proposal: { totalCount: number; unusedCount: number; unusedCategories: string[] } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SanitizationProposalModal: React.FC<SanitizationProposalModalProps> = ({ proposal, onConfirm, onCancel }) => {
  if (!proposal) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                        <Eraser size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Clean Categories</h3>
                    <p className="text-slate-400 text-sm">Analyze and remove unused tags</p>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Total Categories:</span>
                    <span className="text-white font-mono font-bold">{proposal.totalCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Unused Categories:</span>
                    <span className={`font-mono font-bold ${proposal.unusedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {proposal.unusedCount}
                    </span>
                </div>
                
                {proposal.unusedCount > 0 ? (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">To be removed:</p>
                        <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2">
                            {proposal.unusedCategories.map(c => (
                                <span key={c} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded">
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 pt-3 border-t border-slate-700 text-center">
                        <p className="text-emerald-400 text-sm flex items-center justify-center gap-2">
                            <CheckCircle size={14} />
                            All categories are in use!
                        </p>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button 
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium border border-transparent hover:border-slate-600"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    disabled={proposal.unusedCount === 0}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium shadow-lg shadow-red-500/20 transition-all text-sm flex items-center justify-center gap-2"
                >
                    {proposal.unusedCount > 0 ? (
                        <>
                            <Trash2 size={16} />
                            Confirm Delete
                        </>
                    ) : (
                        <span>Close</span>
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};

interface SanitizationResultModalProps {
  result: { count: number; categories: string[] } | null;
  onClose: () => void;
}

export const SanitizationResultModal: React.FC<SanitizationResultModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="mx-auto bg-emerald-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center text-emerald-400 mb-4 animate-scale-in">
                <CheckCircle size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Categories Cleaned!</h3>
            <p className="text-slate-400 text-sm mb-4">
                Removed <strong className="text-white">{result.count}</strong> unused categories.
            </p>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-6 max-h-40 overflow-y-auto text-xs text-slate-300 text-left">
                <p className="font-semibold text-slate-500 uppercase text-[10px] mb-2 tracking-wider">Removed Items:</p>
                <div className="flex flex-wrap gap-2">
                    {result.categories.map(c => (
                        <span key={c} className="bg-slate-800 px-2 py-1 rounded border border-slate-600">
                            {c}
                        </span>
                    ))}
                </div>
            </div>
            <button 
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors border border-slate-600"
            >
                Close
            </button>
        </div>
    </div>
  );
};

interface BulkUpdateModalProps {
  proposal: {
    targetDescription: string;
    newCategory: string;
    count: number;
    transactionIds: string[];
  } | null;
  onConfirm: (createRule: boolean) => void;
  onCancel: () => void;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ proposal, onConfirm, onCancel }) => {
    if (!proposal) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-md w-full">
            <div className="bg-slate-800 border border-indigo-500/50 shadow-2xl rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                        <Zap size={20} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">Update similar transactions?</h4>
                        <p className="text-xs text-slate-400 mt-1">
                            Found <strong className="text-white">{proposal.count}</strong> other transactions with description <strong className="text-white">"{proposal.targetDescription}"</strong>.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Change them to <strong className="text-indigo-400">{proposal.newCategory}</strong>?
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button 
                                onClick={() => onConfirm(false)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded font-medium transition-colors"
                            >
                                Yes, update all
                            </button>
                            <button 
                                onClick={() => onConfirm(true)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded font-medium transition-colors"
                            >
                                Yes + Create Rule
                            </button>
                            <button 
                                onClick={onCancel}
                                className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded font-medium transition-colors"
                            >
                                No
                            </button>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};