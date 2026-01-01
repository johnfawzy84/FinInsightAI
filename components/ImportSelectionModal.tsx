import React, { useState } from 'react';
import { Session, ImportSelection } from '../types';
import { Download, CheckCircle, X, List, Zap, PieChart, Layout } from 'lucide-react';

interface ImportSelectionModalProps {
  importData: Session;
  onConfirm: (selection: ImportSelection) => void;
  onCancel: () => void;
}

export const ImportSelectionModal: React.FC<ImportSelectionModalProps> = ({ importData, onConfirm, onCancel }) => {
  const [selection, setSelection] = useState<ImportSelection>({
    transactions: true,
    categories: true,
    rules: true,
    assets: true,
    dashboard: true
  });

  const handleToggle = (key: keyof ImportSelection) => {
    setSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCount = (key: keyof Session) => {
    const val = importData[key];
    return Array.isArray(val) ? val.length : 0;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Download className="text-indigo-400" size={24} />
            Import Session Data
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Select the components you want to merge into your current session.
          </p>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          {/* Transactions */}
          <div 
            onClick={() => handleToggle('transactions')}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selection.transactions ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selection.transactions ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                <List size={20} />
              </div>
              <div>
                <h4 className={`font-semibold ${selection.transactions ? 'text-white' : 'text-slate-400'}`}>Transactions</h4>
                <p className="text-xs text-slate-500">{getCount('transactions')} items found</p>
              </div>
            </div>
            {selection.transactions && <CheckCircle className="text-indigo-400" size={20} />}
          </div>

          {/* Categories */}
          <div 
            onClick={() => handleToggle('categories')}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selection.categories ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selection.categories ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                <List size={20} />
              </div>
              <div>
                <h4 className={`font-semibold ${selection.categories ? 'text-white' : 'text-slate-400'}`}>Categories</h4>
                <p className="text-xs text-slate-500">{getCount('categories')} items found</p>
              </div>
            </div>
            {selection.categories && <CheckCircle className="text-indigo-400" size={20} />}
          </div>

          {/* Rules */}
          <div 
            onClick={() => handleToggle('rules')}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selection.rules ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selection.rules ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                <Zap size={20} />
              </div>
              <div>
                <h4 className={`font-semibold ${selection.rules ? 'text-white' : 'text-slate-400'}`}>Categorization Rules</h4>
                <p className="text-xs text-slate-500">{getCount('rules')} items found</p>
              </div>
            </div>
            {selection.rules && <CheckCircle className="text-indigo-400" size={20} />}
          </div>

          {/* Assets */}
          <div 
            onClick={() => handleToggle('assets')}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selection.assets ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selection.assets ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                <PieChart size={20} />
              </div>
              <div>
                <h4 className={`font-semibold ${selection.assets ? 'text-white' : 'text-slate-400'}`}>Assets</h4>
                <p className="text-xs text-slate-500">{getCount('assets')} items found</p>
              </div>
            </div>
            {selection.assets && <CheckCircle className="text-indigo-400" size={20} />}
          </div>

          {/* Dashboard */}
          <div 
            onClick={() => handleToggle('dashboard')}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selection.dashboard ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selection.dashboard ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                <Layout size={20} />
              </div>
              <div>
                <h4 className={`font-semibold ${selection.dashboard ? 'text-white' : 'text-slate-400'}`}>Dashboard Config</h4>
                <p className="text-xs text-slate-500">Custom graphs & layout settings</p>
              </div>
            </div>
            {selection.dashboard && <CheckCircle className="text-indigo-400" size={20} />}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(selection)}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Merge Selected
          </button>
        </div>

      </div>
    </div>
  );
};
