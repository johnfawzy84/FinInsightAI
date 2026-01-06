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
  Upload,
  Target,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { Session, GoogleUser } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: (name: string) => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  activeTab: string;
  onSelectTab: (tab: 'dashboard' | 'transactions' | 'settings' | 'goals' | 'budgets') => void;
  onImportFile: () => void;
  activeSessionName: string;
  onToggleChat: () => void;
  isChatOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  googleUser: GoogleUser | null;
  isSyncing: boolean;
  onCloudSync: () => void;
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
  isChatOpen,
  isCollapsed,
  onToggleCollapse,
  googleUser,
  isSyncing,
  onCloudSync
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
    <nav className={`fixed top-0 left-0 h-full bg-surface border-r border-slate-700 hidden md:flex flex-col z-20 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo Section */}
      <div className={`p-6 border-b border-slate-700 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex items-center space-x-2 text-indigo-400">
            <ShieldCheck size={28} />
            <span className="text-xl font-bold text-white tracking-tight">FinSight AI</span>
          </div>
        )}
        {isCollapsed && (
          <div className="text-indigo-400">
             <ShieldCheck size={28} />
          </div>
        )}
        <button 
          onClick={onToggleCollapse} 
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ${!isCollapsed ? '' : 'absolute -right-3 top-20 bg-slate-800 border border-slate-700 rounded-full shadow-lg z-30'}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Cloud Sync Status */}
      {!isCollapsed && (
        <div className="px-6 py-3 border-b border-slate-700/50 flex items-center justify-between group">
            {googleUser ? (
                <div className="flex items-center gap-2 overflow-hidden">
                    <img src={googleUser.picture} className="w-6 h-6 rounded-full border border-indigo-500/50" alt="profile" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-white truncate">{googleUser.name}</span>
                        <span className="text-[9px] text-indigo-400 flex items-center gap-1">
                            {isSyncing ? <RefreshCw size={8} className="animate-spin" /> : <Cloud size={8} />}
                            {isSyncing ? 'Syncing...' : 'Cloud Active'}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-slate-500 italic">
                    <CloudOff size={14} />
                    <span className="text-[10px] font-semibold">Local Session</span>
                </div>
            )}
            {googleUser && (
                <button 
                    onClick={onCloudSync}
                    disabled={isSyncing}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-all opacity-0 group-hover:opacity-100"
                    title="Force Sync Now"
                >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                </button>
            )}
        </div>
      )}

      {/* Sessions Section */}
      <div className={`px-4 pt-4 pb-2 border-b border-slate-700/50 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        {!isCollapsed && (
          <div 
            className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => setIsSessionsExpanded(!isSessionsExpanded)}
          >
            <span>Sessions</span>
            {isSessionsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
        )}

        {(isSessionsExpanded || isCollapsed) && (
          <div className={`w-full max-h-[30vh] overflow-y-auto custom-scrollbar space-y-1 mb-2 animate-fade-in ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between rounded-lg text-sm cursor-pointer transition-all ${
                  activeSessionId === session.id 
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                } ${isCollapsed ? 'p-2' : 'px-3 py-1.5'}`}
                title={isCollapsed ? session.name : ''}
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <Folder size={14} className={activeSessionId === session.id ? 'text-indigo-400' : 'text-slate-500'} />
                  {!isCollapsed && <span className="truncate text-xs">{session.name}</span>}
                </div>
                {sessions.length > 1 && !isCollapsed && (
                  <button 
                    onClick={(e) => onDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            
            {!isCollapsed && (
              isCreatingSession ? (
                <div className="mt-2 p-2 bg-slate-800 rounded-lg border border-slate-600 animate-scale-in">
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
                    <button onClick={handleCreate} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-1 rounded font-bold">OK</button>
                    <button onClick={() => setIsCreatingSession(false)} className="px-2 bg-slate-700 text-slate-300 text-[10px] py-1 rounded"><X size={10}/></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsCreatingSession(true)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors">
                  <Plus size={12} /> New Session
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Nav Section */}
      <div className={`flex-1 py-4 space-y-1.5 px-4 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'transactions', icon: List, label: 'Transactions' },
          { id: 'budgets', icon: Wallet, label: 'Budgets' },
          { id: 'goals', icon: Target, label: 'Goals' },
          { id: 'settings', icon: Settings, label: 'Settings' },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => onSelectTab(item.id as any)}
            className={`w-full flex items-center rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            } ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-2.5'}`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={18} />
            {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
          </button>
        ))}

        <div className={`border-t border-slate-700 my-2 mx-2 ${isCollapsed ? 'w-8' : 'w-full'}`}></div>

        <button 
          onClick={onToggleChat}
          className={`w-full flex items-center rounded-xl transition-all ${
            isChatOpen 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          } ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-2.5'}`}
          title={isCollapsed ? 'Consult AI' : ''}
        >
          <MessageSquareText size={18} />
          {!isCollapsed && <span className="font-medium text-sm">Consult AI</span>}
        </button>
      </div>

      <div className={`p-4 border-t border-slate-700 bg-slate-900/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button 
            onClick={onImportFile}
            className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all group ${isCollapsed ? 'w-10 h-10' : 'w-full h-20'}`}
        >
          <Upload size={isCollapsed ? 16 : 20} className="text-slate-400 group-hover:text-indigo-400" />
          {!isCollapsed && (
            <p className="text-[10px] text-slate-500 group-hover:text-slate-300 text-center px-2 mt-1 uppercase font-bold tracking-tight">
               Import to <span className="text-indigo-400">{activeSessionName}</span>
            </p>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;