import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { SettingsModal } from '../components/SettingsModal';
import { QuizModal } from '../components/QuizModal';
import { AdminPanelComponent } from '../components/AdminPanelComponent';
import { TeacherDashboardComponent } from '../components/TeacherDashboardComponent';
import { Conversation, Message, APISettings, Note, StudySession } from '../types';
import { generateId, generateConversationTitle } from '../utils/helpers';
import { Menu } from 'lucide-react';
import { storageUtils } from '../utils/storage';
import { aiService } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';

export default function ChatPage() {
  const { profile, loading, error } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settings, setSettings] = useState<APISettings>(() => storageUtils.getSettings());
  const [initialized, setInitialized] = useState(false);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  
  // Quiz-related state
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [currentQuizSession, setCurrentQuizSession] = useState<StudySession | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // State for panels
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);
  
  const stopStreamingRef = useRef(false);
  const [sidebarFolded, setSidebarFolded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ai-tutor-sidebar-folded') || 'false');
    } catch {
      return false;
    }
  });

  // Handler to toggle admin panel view
  const handleToggleAdminPanel = useCallback(() => {
    if (profile?.role === 'admin') {
      setShowAdminPanel(prev => !prev);
      setShowTeacherDashboard(false);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    }
  }, [profile]);
  
  // Handler to toggle teacher dashboard view
  const handleToggleTeacherDashboard = useCallback(() => {
      if (profile?.role === 'teacher') {
          setShowTeacherDashboard(prev => !prev);
          setShowAdminPanel(false);
          if (window.innerWidth < 1024) setSidebarOpen(false);
      }
  }, [profile]);
  
  // Handler to switch back to chat view
  const handleSwitchToChatView = useCallback(() => {
      setShowAdminPanel(false);
      setShowTeacherDashboard(false);
      if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  // Create new conversation function
  const createNewConversation = useCallback((autoSelect: boolean = true) => {
    if (!profile) return null;
    
    const newConversation: Conversation = {
      id: generateId(),
      user_id: profile.id,
      title: 'New Chat',
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    setConversations(prev => [newConversation, ...prev]);
    
    if (autoSelect) {
      setCurrentConversationId(newConversation.id);
      handleSwitchToChatView();
    }
    
    return newConversation;
  }, [profile, handleSwitchToChatView]);

  const handleNewConversation = useCallback(() => {
    createNewConversation(true);
    
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [createNewConversation]);

  // FIXED: Initialize conversations without auto-creation
  useEffect(() => {
    if (!profile || initialized) return;
    
    // Migrate existing data for current user
    storageUtils.migrateExistingData(profile.id);
    
    const storedConversations = storageUtils.getConversations(profile.id);
    setConversations(storedConversations);
    
    // FIXED: Don't auto-create conversation, let user start manually
    if (storedConversations.length > 0) {
      const sorted = [...storedConversations].sort((a, b) => 
        b.updated_at.getTime() - a.updated_at.getTime()
      );
      setCurrentConversationId(sorted[0].id);
    } else {
      // FIXED: Set to null when no conversations exist
      setCurrentConversationId(null);
    }
    
    setInitialized(true);
  }, [profile, initialized]); // Removed createNewConversation dependency

  // Save conversations with user-specific storage
  useEffect(() => { 
    if (initialized && profile) { 
      storageUtils.saveConversations(conversations, profile.id); 
    } 
  }, [conversations, initialized, profile]);

  useEffect(() => { storageUtils.saveSettings(settings); aiService.updateSettings(settings); }, [settings]);
  useEffect(() => { localStorage.setItem('ai-tutor-sidebar-folded', JSON.stringify(sidebarFolded)); }, [sidebarFolded]);
  useEffect(() => { 
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024); 
    handleResize(); 
    window.addEventListener('resize', handleResize); 
    return () => window.removeEventListener('resize', handleResize); 
  }, []);
  
  const currentConversation = useMemo(() => 
    conversations.find(c => c.id === currentConversationId), 
    [conversations, currentConversationId]
  );

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!profile) return;
    
    // If no current conversation, create one
    let conversationId = currentConversationId;
    if (!conversationId) {
      const newConv = createNewConversation(false);
      if (!newConv) return;
      conversationId = newConv.id;
      setCurrentConversationId(conversationId);
    }
    
    const userMessage: Message = { 
      id: generateId(), 
      conversation_id: conversationId, 
      user_id: profile.id, 
      content, 
      role: 'user', 
      created_at: new Date() 
    };
    
    const currentConv = conversations.find(c => c.id === conversationId);
    if (!currentConv) return;
    
    const isFirstMessage = currentConv.messages.length === 0;
    
    setConversations(prev => prev.map(c => c.id === conversationId ? { 
      ...c, 
      title: isFirstMessage ? generateConversationTitle(content) : c.title, 
      messages: [...c.messages, userMessage], 
      updated_at: new Date() 
    } : c));
    
    setIsChatLoading(true);
    stopStreamingRef.current = false;
    
    try {
      const assistantMessage: Message = { 
        id: generateId(), 
        conversation_id: conversationId, 
        user_id: profile.id, 
        content: '', 
        role: 'assistant', 
        created_at: new Date(), 
        model: settings.selectedModel 
      };
      
      setStreamingMessage(assistantMessage);
      const messagesForApi = [...currentConv.messages, userMessage].map(m => ({ role: m.role, content: m.content }));
      
      let fullResponse = '';
      for await (const chunk of aiService.generateStreamingResponse(messagesForApi)) {
        if (stopStreamingRef.current) break;
        fullResponse += chunk;
        setStreamingMessage(prev => prev ? { ...prev, content: fullResponse } : null);
      }
      
      if (!stopStreamingRef.current) {
        setConversations(prev => prev.map(c => c.id === conversationId ? { 
          ...c, 
          messages: [...c.messages, { ...assistantMessage, content: fullResponse }] 
        } : c));
      }
    } catch (error) {
      console.error('Error generating response:', error);
      const errorContent = `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setConversations(prev => prev.map(c => c.id === conversationId ? { 
        ...c, 
        messages: [...c.messages, { 
          id: generateId(), 
          conversation_id: conversationId, 
          user_id: profile.id, 
          role: 'assistant', 
          content: errorContent, 
          created_at: new Date() 
        }] 
      } : c));
    } finally {
      setIsChatLoading(false);
      setStreamingMessage(null);
      stopStreamingRef.current = false;
    }
  }, [profile, currentConversationId, conversations, settings.selectedModel, createNewConversation]);

  // Quiz generation functionality
  const handleGenerateQuiz = useCallback(async () => {
    if (!currentConversation || currentConversation.messages.length < 2) {
      console.warn('Need at least 2 messages to generate quiz');
      return;
    }
    
    setIsQuizLoading(true);
    try {
      const quizSession = await aiService.generateQuiz(currentConversation);
      setCurrentQuizSession(quizSession);
      setIsQuizModalOpen(true);
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsQuizLoading(false);
    }
  }, [currentConversation]);

  // FIXED: Delete conversation without auto-creation
  const handleDeleteConversation = useCallback((id: string) => {
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    
    if (currentConversationId === id) {
      if (remaining.length > 0) {
        const sorted = [...remaining].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
        setCurrentConversationId(sorted[0].id);
      } else {
        // FIXED: Set to null when no conversations remain, don't auto-create
        setCurrentConversationId(null);
      }
    }
  }, [conversations, currentConversationId]); // Removed createNewConversation dependency

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  }, []);

  const getActiveView = () => {
      if (showAdminPanel) return 'admin';
      if (showTeacherDashboard) return 'dashboard';
      return 'chat';
  }

  if (loading || (!profile && !error)) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <p>Initializing AI Tutor...</p>
      </div>
    ); 
  }
  
  if (error) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <p>Error: {error.message}</p>
      </div>
    ); 
  }
  
  if (!initialized) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <p>Loading conversations...</p>
      </div>
    ); 
  }

  return (
    <div className="app-container">
      {sidebarOpen && window.innerWidth < 1024 && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      
      <Sidebar
        conversations={[...conversations].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())}
        notes={[]}
        activeView={getActiveView()}
        currentConversationId={currentConversationId}
        currentNoteId={null}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onSelectNote={() => {}}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteNote={() => {}}
        onOpenSettings={() => setSettingsOpen(true)}
        settings={settings}
        onModelChange={(model) => setSettings(s => ({ ...s, selectedModel: model }))}
        onCloseSidebar={() => setSidebarOpen(false)}
        isFolded={sidebarFolded}
        onToggleFold={() => setSidebarFolded(!sidebarFolded)}
        isSidebarOpen={sidebarOpen}
        userProfile={profile}
        onToggleAdminPanel={handleToggleAdminPanel}
        onToggleTeacherDashboard={handleToggleTeacherDashboard}
        onSwitchToChatView={handleSwitchToChatView}
      />
      
      <div className="main-content">
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="mobile-menu-button interactive-button p-2 bg-gray-800/80 backdrop-blur-sm rounded-full" 
            title="Open sidebar"
          >
            <Menu className="text-white" />
          </button>
        )}
        
        {showAdminPanel ? (
          <AdminPanelComponent onClose={handleToggleAdminPanel} />
        ) : showTeacherDashboard ? (
          <TeacherDashboardComponent />
        ) : (
          <ChatArea
            conversation={currentConversation}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            isQuizLoading={isQuizLoading}
            streamingMessage={streamingMessage}
            hasApiKey={true}
            onStopGenerating={() => { stopStreamingRef.current = true; }}
            onSaveAsNote={() => {}}
            onGenerateQuiz={handleGenerateQuiz}
          />
        )}
      </div>
      
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        settings={settings} 
        onSaveSettings={setSettings} 
      />
      
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setCurrentQuizSession(null);
        }}
        session={currentQuizSession}
      />
    </div>
  );
}
