import React, { useState } from 'react';
import { Asset } from '../types';
import { X, Plus, Trash2, Edit2, Check, Wallet, PieChart, Briefcase, Coins, Building, CircleDollarSign } from 'lucide-react';

interface AssetManagerModalProps {
  assets: Asset[];
  onUpdateAssets: (updater: (assets: Asset[]) => Asset[]) => void;
  onClose: () => void;
  currency: string;
}

const COLORS = ['#10b981', '#34d399', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const ASSET_TYPES = ['Cash', 'Stock', 'Crypto', 'Real Estate', 'Other'];

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({ assets, onUpdateAssets, onClose, currency }) => {
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({ name: '', value: 0, type: 'Cash', color: COLORS[0] });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newAsset.name || newAsset.value === undefined) return;
    const asset: Asset = {
      id: `asset-${Date.now()}`,
      name: newAsset.name,
      value: Number(newAsset.value),
      type: newAsset.type as any || 'Other',
      color: newAsset.color || COLORS[0]
    };
    onUpdateAssets(prev => [...prev, asset]);
    setNewAsset({ name: '', value: 0, type: 'Cash', color: COLORS[0] });
  };

  const handleUpdate = (id: string, updates: Partial<Asset>) => {
    onUpdateAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if(confirm("Delete this asset?")) {
        onUpdateAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
        case 'Cash': return <Wallet size={16} />;
        case 'Stock': return <Briefcase size={16} />;
        case 'Crypto': return <Coins size={16} />;
        case 'Real Estate': return <Building size={16} />;
        default: return <CircleDollarSign size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-border flex justify-between items-center bg-surfaceHighlight/50">
           <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
                <PieChart size={20} className="text-primary"/>
                Manage Assets
           </h3>
           <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={24} /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Add New Asset Form */}
            <div className="bg-surfaceHighlight/50 p-4 rounded-xl border border-border">
                <label className="text-xs font-semibold text-textMuted uppercase mb-3 block">Add New Asset</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <input 
                        type="text" 
                        placeholder="Name (e.g. Chase Bank)" 
                        value={newAsset.name}
                        onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                        className="bg-background border border-border rounded px-3 py-2 text-sm text-textMain focus:border-primary focus:outline-none"
                    />
                    <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">{currency}</span>
                        <input 
                            type="number" 
                            placeholder="Value" 
                            value={newAsset.value || ''}
                            onChange={e => setNewAsset({...newAsset, value: parseFloat(e.target.value)})}
                            className="w-full bg-background border border-border rounded px-3 pl-6 py-2 text-sm text-textMain focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                    <select 
                        value={newAsset.type}
                        onChange={e => setNewAsset({...newAsset, type: e.target.value as any})}
                        className="bg-background border border-border rounded px-3 py-2 text-sm text-textMain focus:border-primary focus:outline-none flex-1"
                    >
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex gap-1 items-center bg-background border border-border rounded px-2">
                        {COLORS.slice(0, 5).map(c => (
                            <button 
                                key={c}
                                onClick={() => setNewAsset({...newAsset, color: c})}
                                className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${newAsset.color === c ? 'ring-2 ring-textMain scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <button 
                        onClick={handleAdd}
                        disabled={!newAsset.name || !newAsset.value}
                        className="bg-primary hover:bg-primary/90 disabled:bg-surfaceHighlight disabled:text-textMuted text-white px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Asset List */}
            <div className="space-y-2">
                {assets.length === 0 ? (
                    <p className="text-center text-textMuted text-sm py-4">No assets defined. Add one above!</p>
                ) : (
                    assets.map(asset => (
                        <div key={asset.id} className="flex items-center justify-between bg-surfaceHighlight p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background" style={{ color: asset.color }}>
                                    {getTypeIcon(asset.type)}
                                </div>
                                <div>
                                    <h4 className="font-medium text-textMain text-sm">{asset.name}</h4>
                                    <p className="text-xs text-textMuted">{asset.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-textMain font-mono">{currency}{asset.value.toLocaleString()}</span>
                                <button 
                                    onClick={() => handleDelete(asset.id)}
                                    className="text-textMuted hover:text-danger transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
        
        <div className="p-4 bg-surfaceHighlight/50 border-t border-border text-center text-xs text-textMuted">
            Total Assets: <span className="text-secondary font-bold text-sm ml-1">{currency}{assets.reduce((sum, a) => sum + a.value, 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};