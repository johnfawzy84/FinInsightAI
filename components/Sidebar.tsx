import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  Trash2, 
  Plus, 
  X, 
  LayoutDashboard, 
  List, 
  MessageSquareText, 
  Settings, 
  Upload 
} from 'lucide-react';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: (name: string) => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  activeTab: string;
  onSelectTab: (tab: 'dashboard' | 'transactions' | 'settings') => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeSessionName: string;
  onToggleChat: () => void;
  isChatOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  activeTab,
  onSelectTab,
  onImportFile,
  activeSessionName,
  onToggleChat,
  isChatOpen
}) => {
  const [isSessionsExpanded, setIsSessionsExpanded] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const handleCreate = () => {
    if (!newSessionName.trim()) return;
    onCreateSession(newSessionName);
    setNewSessionName('');
    setIsCreatingSession(false);
    onSelectTab('dashboard');
  };

  return (
    <nav className="fixed top-0 left-0 h-full w-64 bg-surface border-r border-slate-700 hidden md:flex flex-col z-20">
      {/* App Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-2 text-indigo-400">
          <ShieldCheck size={28} />
          <span className="text-xl font-bold text-white tracking-tight">FinSight AI</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">Smart Financial Intelligence</p>
      </div>

      {/* Session Management */}
      <div className="px-4 pt-6 pb-2 border-b border-slate-700/50">
        <div 
          className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 cursor-pointer hover:text-slate-300 transition-colors"
          onClick={() => setIsSessionsExpanded(!isSessionsExpanded)}
        >
          <span>Sessions</span>
          {isSessionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {isSessionsExpanded && (
          <div className="space-y-1 mb-2 animate-fade-in">
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                  activeSessionId === session.id 
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <Folder size={14} className={activeSessionId === session.id ? 'text-indigo-400' : 'text-slate-500'} />
                  <span className="truncate">{session.name}</span>
                </div>
                {sessions.length > 1 && (
                  <button 
                    onClick={(e) => onDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                    title="Delete Session"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            
            {isCreatingSession ? (
              <div className="mt-2 p-2 bg-slate-800 rounded-lg border border-slate-600">
                <input
                  autoFocus
                  type="text"
                  placeholder="Session Name"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 mb-2"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex space-x-1">
                  <button 
                    onClick={handleCreate}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1 rounded"
                  >
                    Create
                  </button>
                  <button 
                    onClick={() => setIsCreatingSession(false)}
                    className="px-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1 rounded"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsCreatingSession(true)}
                className="w-full flex items-center space-x-2 px-3 py-2 mt-2 text-xs text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-dashed border-slate-700 hover:border-indigo-500/30"
              >
                <Plus size={14} />
                <span>New Session</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 space-y-2 px-4">
        <button 
          onClick={() => onSelectTab('dashboard')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <LayoutDashboard size={20} />
          <span className="font-medium">Dashboard</span>
        </button>
        
        <button 
          onClick={() => onSelectTab('transactions')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <List size={20} />
          <span className="font-medium">Transactions</span>
        </button>

        <button 
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <Settings size={20} />
          <span className="font-medium">Settings</span>
        </button>

        <div className="border-t border-slate-700 my-2 mx-2"></div>

        <button 
          onClick={onToggleChat}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isChatOpen ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <MessageSquareText size={20} />
          <span className="font-medium">Consult AI</span>
          {isChatOpen && <span className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse"></span>}
        </button>
      </div>

      {/* Import Area */}
      <div className="p-4 border-t border-slate-700 bg-slate-900/30">
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all group">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload size={24} className="text-slate-400 group-hover:text-indigo-400 mb-2" />
            <p className="text-xs text-slate-500 group-hover:text-slate-300 text-center px-2">
               Import to<br/><span className="font-semibold text-indigo-400">{activeSessionName}</span>
            </p>
          </div>
          <input type="file" className="hidden" accept=".xlsx, .csv, .txt" onChange={onImportFile} />
        </label>
      </div>
    </nav>
  );
};

export default Sidebar;