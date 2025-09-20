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
import * as db from '../services/supabaseService';

export default function ChatPage() {
  const { profile, loading, error } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settings, setSettings] = useState<APISettings>(() => storageUtils.getSettings());
  const [initialized, setInitialized] = useState(false);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [currentQuizSession, setCurrentQuizSession] = useState<StudySession | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
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

  const handleToggleAdminPanel = useCallback(() => {
    if (profile?.role === 'admin') {
      setShowAdminPanel(prev => !prev);
      setShowTeacherDashboard(false);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    }
  }, [profile]);
  
  const handleToggleTeacherDashboard = useCallback(() => {
      if (profile?.role === 'teacher') {
          setShowTeacherDashboard(prev => !prev);
          setShowAdminPanel(false);
          if (window.innerWidth < 1024) setSidebarOpen(false);
      }
  }, [profile]);
  
  const handleSwitchToChatView = useCallback(() => {
      setShowAdminPanel(false);
      setShowTeacherDashboard(false);
      if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  const handleNewConversation = useCallback(async () => {
    if (!profile) return;
    try {
        const newConversation = await db.createConversation(profile.id, 'New Chat');
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        handleSwitchToChatView();
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    } catch (error) {
        console.error("Error creating new conversation:", error);
        alert("Could not create a new conversation. Please try again.");
    }
  }, [profile, handleSwitchToChatView]);

  // Effect to fetch initial conversation list for the user
  useEffect(() => {
    if (!profile || initialized) return;
    
    const fetchConversations = async () => {
        try {
            const userConversations = await db.getConversations(profile.id);
            setConversations(userConversations);
            if (userConversations.length > 0) {
                setCurrentConversationId(userConversations[0].id);
            } else {
                setCurrentConversationId(null);
            }
        } catch (err) {
            console.error("Failed to fetch conversations:", err);
        } finally {
            setInitialized(true);
        }
    };
    
    fetchConversations();
  }, [profile, initialized]);

  // Effect to fetch messages for the currently selected conversation
  useEffect(() => {
      if (!currentConversationId) return;

      const currentConvo = conversations.find(c => c.id === currentConversationId);
      // Only fetch if messages aren't already loaded
      if (currentConvo && !currentConvo.messages) {
          const fetchMessages = async () => {
              try {
                  const messages = await db.getConversationMessages(currentConversationId);
                  setConversations(prev => prev.map(c => 
                      c.id === currentConversationId ? { ...c, messages } : c
                  ));
              } catch (err) {
                  console.error("Failed to fetch messages:", err);
              }
          };
          fetchMessages();
      }
  }, [currentConversationId, conversations]);

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
    if (!profile || !currentConversationId) {
        console.error("Cannot send message without a user profile and selected conversation.");
        return;
    }
    
    const userMessage: Message = { 
      id: generateId(), // Temporary ID for UI
      conversation_id: currentConversationId, 
      user_id: profile.id, 
      content, 
      role: 'user', 
      created_at: new Date() 
    };
    
    // Optimistic UI update
    setConversations(prev => prev.map(c => c.id === currentConversationId ? { 
      ...c,
      messages: [...(c.messages || []), userMessage], 
    } : c));
    
    setIsChatLoading(true);
    stopStreamingRef.current = false;
    
    // Save user message to DB and update timestamp
    db.addMessage({ ...userMessage, model: undefined }).catch(err => console.error("Failed to save user message:", err));
    db.updateConversationTimestamp(currentConversationId).catch(err => console.error("Failed to update timestamp:", err));
    
    try {
      const assistantMessage: Message = { 
        id: generateId(), // Temporary ID
        conversation_id: currentConversationId, 
        user_id: profile.id, 
        content: '', 
        role: 'assistant', 
        created_at: new Date(), 
        model: settings.selectedModel 
      };
      
      setStreamingMessage(assistantMessage);
      
      const messagesForApi = [...(currentConversation?.messages || []), userMessage].map(m => ({ 
        role: m.role, 
        content: m.content 
      }));
      
      let fullResponse = '';
      for await (const chunk of aiService.generateStreamingResponse(messagesForApi)) {
        if (stopStreamingRef.current) break;
        fullResponse += chunk;
        setStreamingMessage(prev => prev ? { ...prev, content: fullResponse } : null);
      }
      
      if (!stopStreamingRef.current && fullResponse.trim()) {
        const finalAssistantMessage = { ...assistantMessage, content: fullResponse };
        
        // Save assistant message to DB
        db.addMessage({ ...finalAssistantMessage, id: undefined, created_at: undefined }).catch(err => console.error("Failed to save assistant message:", err));
        
        // Final UI update
        setConversations(prev => prev.map(c => c.id === currentConversationId ? { 
          ...c, 
          messages: [...(c.messages || []), finalAssistantMessage],
        } : c));
      }
    } catch (error) {
      console.error('Error generating response:', error);
      const errorContent = `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const errorMessage = { 
        id: generateId(), conversation_id: currentConversationId, user_id: profile.id, 
        role: 'assistant', content: errorContent, created_at: new Date() 
      } as Message;
      setConversations(prev => prev.map(c => c.id === currentConversationId ? { 
        ...c, 
        messages: [...(c.messages || []), errorMessage]
      } : c));
      db.addMessage(errorMessage).catch(err => console.error("Failed to save error message:", err));
    } finally {
      setIsChatLoading(false);
      setStreamingMessage(null);
      stopStreamingRef.current = false;
    }
  }, [profile, currentConversationId, conversations, settings.selectedModel, currentConversation]);

  const handleGenerateQuiz = useCallback(async () => {
    if (!currentConversation || !currentConversation.messages || currentConversation.messages.length < 2) {
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

  const handleDeleteConversation = useCallback(async (id: string) => {
    const originalConversations = conversations;
    
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    
    if (currentConversationId === id) {
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
    
    try {
        await db.deleteConversation(id);
    } catch (err) {
        console.error("Failed to delete conversation:", err);
        setConversations(originalConversations); // Revert on failure
        alert("Could not delete the conversation.");
    }
  }, [conversations, currentConversationId]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    const originalTitle = conversations.find(c => c.id === id)?.title;
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    try {
        await db.updateConversationTitle(id, newTitle);
    } catch (err) {
        console.error("Failed to rename conversation:", err);
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: originalTitle || c.title } : c));
        alert("Could not rename the conversation.");
    }
  }, [conversations]);

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
        conversations={conversations}
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
