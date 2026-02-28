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
import { currentVersion } from '../changelog';

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
  onOpenChangelog: () => void;
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
  onCloudSync,
  onOpenChangelog
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
    <nav className={`fixed top-0 left-0 h-full bg-surface border-r border-border hidden md:flex flex-col z-20 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo Section */}
      <div className={`p-6 border-b border-border flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 text-primary">
              <ShieldCheck size={28} />
              <span className="text-xl font-bold text-textMain tracking-tight">FinSight AI</span>
            </div>
            <button onClick={onOpenChangelog} className="text-[10px] text-textMuted font-mono ml-9 hover:text-primary hover:underline text-left">v{currentVersion}</button>
          </div>
        )}
        {isCollapsed && (
          <div className="text-primary">
             <ShieldCheck size={28} />
          </div>
        )}
        <button 
          onClick={onToggleCollapse} 
          className={`p-1.5 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors ${!isCollapsed ? '' : 'absolute -right-3 top-20 bg-surfaceHighlight border border-border rounded-full shadow-lg z-30'}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Cloud Sync Status */}
      {!isCollapsed && (
        <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between group">
            {googleUser ? (
                <div className="flex items-center gap-2 overflow-hidden">
                    <img src={googleUser.picture} className="w-6 h-6 rounded-full border border-primary/50" alt="profile" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-textMain truncate">{googleUser.name}</span>
                        <span className="text-[9px] text-primary flex items-center gap-1">
                            {isSyncing ? <RefreshCw size={8} className="animate-spin" /> : <Cloud size={8} />}
                            {isSyncing ? 'Syncing...' : 'Cloud Active'}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-textMuted italic">
                    <CloudOff size={14} />
                    <span className="text-[10px] font-semibold">Local Session</span>
                </div>
            )}
            {googleUser && (
                <button 
                    onClick={onCloudSync}
                    disabled={isSyncing}
                    className="p-1.5 text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-md transition-all opacity-0 group-hover:opacity-100"
                    title="Force Sync Now"
                >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                </button>
            )}
        </div>
      )}

      {/* Sessions Section */}
      <div className={`px-4 pt-4 pb-2 border-b border-border/50 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        {!isCollapsed && (
          <div 
            className="flex items-center justify-between text-[10px] font-bold text-textMuted uppercase tracking-widest mb-2 cursor-pointer hover:text-textMain transition-colors"
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
                    ? 'bg-primary/20 text-primary border border-primary/30' 
                    : 'text-textMuted hover:bg-surfaceHighlight/50 hover:text-textMain'
                } ${isCollapsed ? 'p-2' : 'px-3 py-1.5'}`}
                title={isCollapsed ? session.name : ''}
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <Folder size={14} className={activeSessionId === session.id ? 'text-primary' : 'text-textMuted'} />
                  {!isCollapsed && <span className="truncate text-xs">{session.name}</span>}
                </div>
                {sessions.length > 1 && !isCollapsed && (
                  <button 
                    onClick={(e) => onDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger/20 hover:text-danger rounded transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            
            {!isCollapsed && (
              isCreatingSession ? (
                <div className="mt-2 p-2 bg-surfaceHighlight rounded-lg border border-border animate-scale-in">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Session Name"
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-textMain focus:outline-none focus:border-primary mb-2"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <div className="flex space-x-1">
                    <button onClick={handleCreate} className="flex-1 bg-primary hover:bg-primary/90 text-white text-[10px] py-1 rounded font-bold">OK</button>
                    <button onClick={() => setIsCreatingSession(false)} className="px-2 bg-surfaceHighlight text-textMuted text-[10px] py-1 rounded"><X size={10}/></button>
                  </div>
                </div>
              ) : (
                <button 
                  id="tutorial-new-session"
                  onClick={() => setIsCreatingSession(true)} 
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-textMuted hover:text-primary transition-colors"
                >
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
            id={`tutorial-nav-${item.id}`}
            onClick={() => onSelectTab(item.id as any)}
            className={`w-full flex items-center rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-textMuted hover:bg-surfaceHighlight hover:text-textMain'
            } ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-2.5'}`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={18} />
            {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
          </button>
        ))}

        <div className={`border-t border-border my-2 mx-2 ${isCollapsed ? 'w-8' : 'w-full'}`}></div>

        <button 
          id="tutorial-consult-ai"
          onClick={onToggleChat}
          className={`w-full flex items-center rounded-xl transition-all ${
            isChatOpen 
              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg' 
              : 'text-textMuted hover:bg-surfaceHighlight hover:text-textMain'
          } ${isCollapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-2.5'}`}
          title={isCollapsed ? 'Consult AI' : ''}
        >
          <MessageSquareText size={18} />
          {!isCollapsed && <span className="font-medium text-sm">Consult AI</span>}
        </button>
      </div>

      <div className={`p-4 border-t border-border bg-background/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button 
            id="tutorial-import"
            onClick={onImportFile}
            className={`flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-surfaceHighlight transition-all group ${isCollapsed ? 'w-10 h-10' : 'w-full h-20'}`}
        >
          <Upload size={isCollapsed ? 16 : 20} className="text-textMuted group-hover:text-primary" />
          {!isCollapsed && (
            <p className="text-[10px] text-textMuted group-hover:text-textMain text-center px-2 mt-1 uppercase font-bold tracking-tight">
               Import to <span className="text-primary">{activeSessionName}</span>
            </p>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
