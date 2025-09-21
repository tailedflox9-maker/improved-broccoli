import React, { useState, useCallback } from 'react';
import {
  MessageSquarePlus,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Edit2,
  Trash2,
  Plus,
  Star,
  StarOff,
  Pin,
  PinOff,
  Bookmark,
  BookmarkCheck,
  ClipboardCheck,
  Check,
  Shield,
  GraduationCap,
  Users,
  ArrowLeft
} from 'lucide-react';
import { Conversation, Note, APISettings, Profile, QuizAssignmentWithDetails } from '../types';
import { formatDate } from '../utils/helpers';

interface SidebarProps {
  conversations: Conversation[];
  notes: Note[];
  assignedQuizzes: QuizAssignmentWithDetails[];
  activeView: 'chat' | 'note' | 'admin' | 'dashboard';
  currentConversationId: string | null;
  currentNoteId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onSelectNote: (id: string) => void;
  onSelectAssignedQuiz: (assignment: QuizAssignmentWithDetails) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenSettings: () => void;
  settings: APISettings;
  onModelChange: (model: APISettings['selectedModel']) => void;
  onCloseSidebar: () => void;
  isFolded: boolean;
  onToggleFold: () => void;
  isSidebarOpen: boolean;
  userProfile: Profile | null;
  onToggleAdminPanel: () => void;
  onToggleTeacherDashboard: () => void;
  onSwitchToChatView: () => void;
}

export function Sidebar({
  conversations,
  notes,
  assignedQuizzes,
  activeView,
  currentConversationId,
  currentNoteId,
  onNewConversation,
  onSelectConversation,
  onSelectNote,
  onSelectAssignedQuiz,
  onDeleteConversation,
  onRenameConversation,
  onDeleteNote,
  onOpenSettings,
  settings,
  onModelChange,
  onCloseSidebar,
  isFolded,
  onToggleFold,
  isSidebarOpen,
  userProfile,
  onToggleAdminPanel,
  onToggleTeacherDashboard,
  onSwitchToChatView,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleRename = useCallback((id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  }, []);

  const handleSaveRename = useCallback((id: string) => {
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  }, [editingTitle, onRenameConversation]);

  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  const handleDelete = useCallback((type: 'conversation' | 'note', id: string) => {
    const itemName = type === 'conversation' ? 'conversation' : 'note';
    const confirmMessage = `Are you sure you want to delete this ${itemName}? This action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      if (type === 'conversation') {
        onDeleteConversation(id);
      } else {
        onDeleteNote(id);
      }
    }
  }, [onDeleteConversation, onDeleteNote]);

  const renderConversationItem = useCallback((conversation: Conversation) => {
    const isActive = currentConversationId === conversation.id;
    const isPinned = conversation.is_pinned;
    const isEditing = editingId === conversation.id;
    
    return (
      <div
        key={conversation.id}
        className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
          isActive 
            ? 'bg-[var(--color-accent-bg)] text-[var(--color-bg)]' 
            : 'hover:bg-[var(--color-border)]'
        }`}
        onClick={() => !isEditing && onSelectConversation(conversation.id)}
      >
        {/* Pin indicator */}
        {isPinned && !isFolded && (
          <Star className="w-3 h-3 text-yellow-400 fill-current flex-shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename(conversation.id);
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handleSaveRename(conversation.id)}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelRename}
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${isPinned ? 'font-medium' : ''} ${isFolded ? 'hidden' : ''}`}>
                  {conversation.title}
                </span>
              </div>
              {!isFolded && (
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {formatDate(conversation.updated_at)}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Action buttons */}
        {!isEditing && !isFolded && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRename(conversation.id, conversation.title);
              }}
              className="p-1 hover:bg-[var(--color-sidebar)] rounded text-xs"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete('conversation', conversation.id);
              }}
              className="p-1 hover:bg-red-500/20 rounded text-xs text-red-400 hover:text-red-300"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }, [currentConversationId, onSelectConversation, editingId, editingTitle, isFolded, handleRename, handleDelete, handleSaveRename, handleCancelRename]);

  const renderNoteItem = useCallback((note: Note) => {
    const isActive = currentNoteId === note.id;
    
    return (
      <div
        key={note.id}
        className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
          isActive 
            ? 'bg-[var(--color-accent-bg)] text-[var(--color-bg)]' 
            : 'hover:bg-[var(--color-border)]'
        }`}
        onClick={() => onSelectNote(note.id)}
      >
        <Bookmark className="w-4 h-4 text-blue-400 flex-shrink-0" />
        
        {!isFolded && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">
                {note.title}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1 flex items-center gap-2">
                {formatDate(note.created_at)}
                {note.source_conversation_id && (
                  <span className="px-1 py-0.5 bg-[var(--color-border)] rounded text-xs">
                    From Chat
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete('note', note.id);
                }}
                className="p-1 hover:bg-red-500/20 rounded text-xs text-red-400 hover:text-red-300"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }, [currentNoteId, onSelectNote, handleDelete, isFolded]);

  const renderSidebarContent = () => {
    if (activeView === 'admin' || activeView === 'dashboard') {
      return (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onSwitchToChatView}
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft className="w-4 h-4" />
              {!isFolded && 'Back to Chat'}
            </button>
          </div>
          {!isFolded && (
            <h2 className="text-lg font-semibold mb-4">
              {activeView === 'admin' ? 'Admin Panel' : 'Teacher Dashboard'}
            </h2>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto scroll-container">
        {/* Conversations Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            {!isFolded && (
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                Conversations
              </h3>
            )}
            <button
              onClick={onNewConversation}
              className="p-1 hover:bg-[var(--color-border)] rounded"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-1">
            {conversations.length === 0 ? (
              !isFolded && (
                <div className="text-xs text-[var(--color-text-placeholder)] text-center py-4">
                  No conversations yet
                </div>
              )
            ) : (
              conversations.map(renderConversationItem)
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            {!isFolded ? (
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                Notes
              </h3>
            ) : (
              <div className="w-full flex justify-center">
                <BookmarkCheck className="w-4 h-4 text-[var(--color-text-placeholder)]" />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            {notes.length === 0 ? (
              !isFolded && (
                <div className="text-xs text-[var(--color-text-placeholder)] text-center py-4">
                  No notes saved yet
                </div>
              )
            ) : (
              notes.map(renderNoteItem)
            )}
          </div>
        </div>

        {/* Assigned Quizzes Section (for students) */}
        {userProfile?.role === 'student' && assignedQuizzes.length > 0 && (
          <div className="mb-6">
            {!isFolded ? (
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                Assigned Quizzes
              </h3>
            ) : (
              <div className="w-full flex justify-center mb-3">
                <ClipboardCheck className="w-4 h-4 text-[var(--color-text-placeholder)]" />
              </div>
            )}
            <div className="space-y-1">
              {assignedQuizzes.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    assignment.completed_at ? 'opacity-60' : 'hover:bg-[var(--color-border)]'
                  }`}
                  onClick={() => !assignment.completed_at && onSelectAssignedQuiz(assignment)}
                >
                  <ClipboardCheck className={`w-4 h-4 flex-shrink-0 ${
                    assignment.completed_at ? 'text-green-400' : 'text-blue-400'
                  }`} />
                  
                  {!isFolded && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {assignment.generated_quizzes.topic}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {assignment.completed_at ? (
                            <span className="text-green-400">
                              Completed: {assignment.score}/{assignment.total_questions}
                            </span>
                          ) : assignment.due_at ? (
                            `Due: ${formatDate(new Date(assignment.due_at))}`
                          ) : (
                            'No deadline'
                          )}
                        </div>
                      </div>
                      
                      {assignment.completed_at && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''} ${isFolded ? 'sidebar-folded' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="flex items-center justify-between">
          {!isFolded && (
            <div className="flex items-center gap-3">
              <img src="/white-logo.png" alt="AI Tutor" className="w-6 h-6" />
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                AI Tutor
              </h1>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            {/* Desktop fold/unfold button */}
            <button
              onClick={onToggleFold}
              className="hidden lg:flex interactive-button p-2 hover:bg-[var(--color-border)] rounded"
              title={isFolded ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isFolded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            
            {/* Mobile close button */}
            <button
              onClick={onCloseSidebar}
              className="lg:hidden interactive-button p-2 hover:bg-[var(--color-border)] rounded"
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sidebar-content">
        {renderSidebarContent()}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User Profile & Role-based buttons */}
        {userProfile && !isFolded && (
          <div className="mb-3 p-3 bg-[var(--color-card)] rounded-lg">
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {userProfile.full_name}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-2">
              {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
            </div>
            
            {/* Role-specific buttons */}
            {userProfile.role === 'admin' && (
              <button
                onClick={onToggleAdminPanel}
                className={`w-full flex items-center gap-2 p-2 text-sm rounded transition-colors ${
                  activeView === 'admin'
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-bg)]'
                    : 'hover:bg-[var(--color-border)]'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            
            {userProfile.role === 'teacher' && (
              <button
                onClick={onToggleTeacherDashboard}
                className={`w-full flex items-center gap-2 p-2 text-sm rounded transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-[var(--color-accent-bg)] text-[var(--color-bg)]'
                    : 'hover:bg-[var(--color-border)]'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Dashboard
              </button>
            )}
          </div>
        )}

        {/* Model Selection */}
        {!isFolded && (
          <div className="mb-3">
            <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">
              AI Model
            </label>
            <select
              value={settings.selectedModel}
              onChange={(e) => onModelChange(e.target.value as APISettings['selectedModel'])}
              className="w-full p-2 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent-bg)]"
            >
              <option value="google">Google Gemini</option>
              <option value="zhipu">ZhipuAI GLM</option>
              <option value="mistral-small">Mistral Small</option>
              <option value="mistral-codestral">Mistral Codestral</option>
            </select>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="interactive-button w-full flex items-center gap-3 p-3 hover:bg-[var(--color-border)] rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-[var(--color-text-secondary)]" />
          {!isFolded && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              Settings
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
