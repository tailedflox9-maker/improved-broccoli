import React, { useState, useMemo } from 'react';
import {
  Plus,
  MessageSquare,
  Settings,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit,
  LogOut,
  LayoutDashboard,
  Shield
} from 'lucide-react';
import { Conversation, Note, Profile, APISettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

interface SidebarProps {
  conversations: Conversation[];
  notes: Note[];
  activeView: 'chat' | 'note' | 'admin' | 'dashboard';
  currentConversationId: string | null;
  currentNoteId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onSelectNote: (id: string | null) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenSettings: () => void;
  onCloseSidebar: () => void;
  isSidebarOpen: boolean;
  isFolded?: boolean;
  onToggleFold?: () => void;
  userProfile: Profile | null;
  settings: APISettings;
  onModelChange: (model: any) => void;
  onToggleAdminPanel?: () => void;
  onToggleTeacherDashboard?: () => void;
  onSwitchToChatView: () => void;
}

export function Sidebar({
  conversations,
  notes,
  activeView,
  currentConversationId,
  currentNoteId,
  onNewConversation,
  onSelectConversation,
  onSelectNote,
  onDeleteConversation,
  onRenameConversation,
  onDeleteNote,
  onOpenSettings,
  onCloseSidebar,
  isSidebarOpen,
  isFolded = false,
  onToggleFold,
  userProfile,
  onToggleAdminPanel,
  onToggleTeacherDashboard,
  onSwitchToChatView,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [view, setView] = useState<'chats' | 'notes'>('chats');
  const { logout } = useAuth();

  const filteredConversations = useMemo(() =>
    conversations.filter(c =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [conversations, searchQuery]
  );

  const filteredNotes = useMemo(() =>
    notes.filter(n =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [notes, searchQuery]
  );

  const handleStartEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') setEditingId(null);
  };

  const isPanelViewActive = activeView === 'admin' || activeView === 'dashboard';
  const sidebarClasses = `bg-[var(--color-sidebar)] flex flex-col h-full border-r border-[var(--color-border)] sidebar transition-all duration-300 ease-in-out fixed lg:static z-50 ${isSidebarOpen ? 'sidebar-open' : 'hidden lg:flex'} ${isFolded ? 'w-14' : 'w-64'}`;

  return (
    <aside className={sidebarClasses}>
      <div className="p-2 border-b border-[var(--color-border)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {!isFolded && (
            <Link to="/" className="flex items-center gap-2 group px-2">
              <img src="/white-logo.png" alt="Logo" className="w-7 h-7" />
              <h1 className="text-xl font-bold">AI Tutor</h1>
            </Link>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {onToggleFold && (
              <button 
                onClick={onToggleFold} 
                className="p-2 btn-icon hidden lg:block" 
                title={isFolded ? 'Expand' : 'Collapse'}
              >
                {isFolded ? <ChevronRight /> : <ChevronLeft />}
              </button>
            )}
            <button 
              onClick={onCloseSidebar} 
              className="p-2 btn-icon lg:hidden" 
              title="Close sidebar"
            >
              <X />
            </button>
          </div>
        </div>
        
        <button 
          onClick={onNewConversation} 
          className={`w-full flex items-center ${isFolded ? 'justify-center' : 'justify-start'} gap-2 px-3 py-2 bg-[var(--color-accent-bg)] hover:bg-[var(--color-accent-bg-hover)] rounded-lg transition-colors text-black font-semibold`}
        >
          <Plus className="w-4 h-4" />
          {!isFolded && <span>New chat</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col">
        {!isFolded && !isPanelViewActive && (
          <>
            <div className="flex items-center gap-1 p-1 bg-[var(--color-card)] rounded-lg mb-2">
              <button 
                onClick={() => setView('chats')} 
                className={`flex-1 btn-tab ${view === 'chats' ? 'active' : ''}`}
              >
                Chats
              </button>
              <button 
                onClick={() => setView('notes')} 
                className={`flex-1 btn-tab ${view === 'notes' ? 'active' : ''}`}
              >
                Notes
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder={`Search ${view}...`} 
                className="w-full bg-[var(--color-card)] rounded-lg pl-9 pr-3 py-1.5 text-sm" 
              />
            </div>
          </>
        )}
        
        {!isPanelViewActive && (
          <>
            {view === 'chats' && filteredConversations.map(c => (
              <div 
                key={c.id} 
                onClick={() => onSelectConversation(c.id)} 
                className={`group flex items-center gap-2 ${isFolded ? 'justify-center p-2' : 'p-2.5'} rounded-lg cursor-pointer ${currentConversationId === c.id ? 'bg-blue-600 text-white' : 'hover:bg-[var(--color-card)]'}`} 
                title={isFolded ? c.title : undefined}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                {!isFolded && (
                  <>
                    {editingId === c.id ? (
                      <input 
                        type="text" 
                        value={editingTitle} 
                        onChange={(e) => setEditingTitle(e.target.value)} 
                        onBlur={handleSaveEdit} 
                        onKeyDown={handleKeyDown} 
                        className="flex-1 text-sm bg-transparent border-b border-gray-500 focus:outline-none" 
                        autoFocus 
                        onClick={(e) => e.stopPropagation()} 
                      />
                    ) : (
                      <span className="flex-1 text-sm font-semibold truncate">{c.title}</span>
                    )}
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleStartEditing(c); }} 
                        className="p-1 btn-icon"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id); }} 
                        className="p-1 btn-icon text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {view === 'notes' && !isFolded && filteredNotes.map(n => (
              <div 
                key={n.id} 
                onClick={() => onSelectNote(n.id)} 
                className={`group p-2.5 rounded-lg cursor-pointer ${currentNoteId === n.id ? 'bg-blue-600 text-white' : 'hover:bg-[var(--color-card)]'}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold truncate pr-2">{n.title}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(n.id); }} 
                    className="p-1 btn-icon text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs opacity-70 mt-1 line-clamp-2">{n.content}</p>
              </div>
            ))}
          </>
        )}

        {activeView === 'dashboard' && !isFolded && (
          <div className="text-center py-8 px-2">
            <LayoutDashboard className="w-12 h-12 mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg font-semibold mb-2">Dashboard Active</h3>
            <p className="text-sm text-gray-400">Viewing student progress dashboard.</p>
          </div>
        )}
        
        {activeView === 'admin' && !isFolded && (
          <div className="text-center py-8 px-2">
            <Shield className="w-12 h-12 mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg font-semibold mb-2">Admin Panel Active</h3>
            <p className="text-sm text-gray-400">Managing users and system settings.</p>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[var(--color-border)] mt-auto space-y-2">
        {!isFolded && userProfile && (
          <div className="p-2 text-sm text-left">
            <p className="font-semibold truncate">{userProfile.full_name || userProfile.email}</p>
            <p className="text-xs text-gray-400 capitalize">{userProfile.role}</p>
          </div>
        )}
        
        <div className="space-y-1">
          <button 
            onClick={onSwitchToChatView}
            className={`nav-btn ${activeView === 'chat' ? 'active' : ''}`}
          >
            <MessageSquare size={18}/>
            {!isFolded && 'Chats'}
          </button>
          
          {userProfile?.role === 'teacher' && onToggleTeacherDashboard && (
            <button 
              onClick={onToggleTeacherDashboard} 
              className={`nav-btn w-full ${activeView === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18}/>
              {!isFolded && 'Dashboard'}
            </button>
          )}
          
          {userProfile?.role === 'admin' && onToggleAdminPanel && (
            <button 
              onClick={onToggleAdminPanel} 
              className={`nav-btn w-full ${activeView === 'admin' ? 'active' : ''}`}
            >
              <Shield size={18}/>
              {!isFolded && 'Admin Panel'}
            </button>
          )}
          
          <button onClick={onOpenSettings} className="nav-btn w-full">
            <Settings size={18}/>
            {!isFolded && 'Settings'}
          </button>
        </div>
        
        <button 
          onClick={logout} 
          className={`w-full flex items-center gap-2 p-2 rounded-lg text-red-400 hover:bg-red-900/30 font-semibold transition-colors ${isFolded ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4" />
          {!isFolded && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
