import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { NoteView } from '../components/NoteView';
import { SettingsModal } from '../components/SettingsModal';
import { QuizModal } from '../components/QuizModal';
import { AdminPanelComponent } from '../components/AdminPanelComponent';
import { TeacherDashboardComponent } from '../components/TeacherDashboardComponent';
import { Conversation, Message, APISettings, Note, StudySession, QuizAssignmentWithDetails } from '../types';
import { generateId, generateConversationTitle } from '../utils/helpers';
import { Menu, ArrowLeft } from 'lucide-react';
import { storageUtils } from '../utils/storage';
import { aiService } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';

export default function ChatPage() {
  const { profile, loading, error } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<QuizAssignmentWithDetails[]>([]);
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
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
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

  useEffect(() => {
    aiService.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    storageUtils.saveSettings(settings);
  }, [settings]);

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

  const createNewConversation = useCallback(async (title: string): Promise<Conversation> => {
    if (!profile) throw new Error("User profile not available.");
    const newConversation = await db.createConversation(profile.id, title);
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    handleSwitchToChatView();
    return newConversation;
  }, [profile, handleSwitchToChatView]);

  const handleNewConversation = useCallback(async () => {
    await createNewConversation('New Chat');
  }, [createNewConversation]);

  useEffect(() => {
    if (!profile || initialized) return;
    const fetchInitialData = async () => {
      try {
        const [userConversations, userNotes] = await Promise.all([
          db.getConversations(profile.id),
          db.getNotes(profile.id)
        ]);
        setConversations(userConversations);
        setNotes(userNotes);
        if (userConversations.length > 0) {
          setCurrentConversationId(userConversations[0].id);
        }
        if (profile.role === 'student') {
          const quizzes = await db.getAssignedQuizzesForStudent(profile.id);
          setAssignedQuizzes(quizzes);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setInitialized(true);
      }
    };
    fetchInitialData();
  }, [profile, initialized]);

  useEffect(() => {
    if (!currentConversationId) return;
    const currentConvo = conversations.find(c => c.id === currentConversationId);
    if (currentConvo && !currentConvo.messages) {
      const fetchMessages = async () => {
        const messages = await db.getConversationMessages(currentConversationId);
        setConversations(prev => prev.map(c =>
          c.id === currentConversationId ? { ...c, messages } : c
        ));
      };
      fetchMessages().catch(err => console.error("Failed to fetch messages:", err));
    }
  }, [currentConversationId, conversations]);

  useEffect(() => {
    localStorage.setItem('ai-tutor-sidebar-folded', JSON.stringify(sidebarFolded));
  }, [sidebarFolded]);

  const currentConversation = useMemo(() =>
    conversations.find(c => c.id === currentConversationId),
    [conversations, currentConversationId]
  );

  const currentNote = useMemo(() =>
    notes.find(n => n.id === currentNoteId),
    [notes, currentNoteId]
  );

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setCurrentNoteId(null);
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);

  const handleSelectNote = useCallback((id: string | null) => {
    setCurrentNoteId(id);
    setCurrentConversationId(null);
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);
  
  // =================================================================
  // == THIS IS THE MAIN FIX FOR CHAT AND TOKEN USAGE
  // =================================================================
  const handleSendMessage = useCallback(async (content: string) => {
    if (!profile) return;

    let convId = currentConversationId;
    let isFirstMessageInConv = false;
    let currentMessages: Message[] = [];

    // If no active conversation, create one first
    if (!convId) {
      const newConv = await createNewConversation(generateConversationTitle(content));
      convId = newConv.id;
      isFirstMessageInConv = true;
    } else {
      currentMessages = conversations.find(c => c.id === convId)?.messages || [];
    }

    const userMessage: Message = {
      id: generateId(),
      conversation_id: convId,
      user_id: profile.id,
      content,
      role: 'user',
      created_at: new Date()
    };
    
    // Optimistically update UI with user's message
    setConversations(prev => prev.map(c => c.id === convId ? {
      ...c, messages: [...(c.messages || []), userMessage]
    } : c));

    setIsChatLoading(true);
    stopStreamingRef.current = false;
    
    // Save user message to DB
    db.addMessage(userMessage).catch(err => console.error("Failed to save user message:", err));
    if (!isFirstMessageInConv) {
        db.updateConversationTimestamp(convId).catch(err => console.error("Failed to update timestamp:", err));
    }
    
    const assistantMessageId = generateId(); // Generate ID *before* streaming for token tracking
    
    try {
      const assistantMessagePlaceholder: Message = {
        id: assistantMessageId,
        conversation_id: convId,
        user_id: profile.id,
        content: '',
        role: 'assistant',
        created_at: new Date(),
        model: settings.selectedModel
      };
      
      // Use streaming state for the AI response bubble
      setStreamingMessage(assistantMessagePlaceholder);
      
      const messagesForApi = [...currentMessages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      let fullResponse = '';
      let tokenData: { input: number; output: number; total: number } | undefined;
      
      for await (const result of aiService.generateStreamingResponse(messagesForApi, profile.id, assistantMessageId)) {
        if (stopStreamingRef.current) break;

        if (result.chunk) {
          fullResponse += result.chunk;
          setStreamingMessage(prev => prev ? { ...prev, content: fullResponse } : null);
        }

        if (result.tokenData) {
          tokenData = result.tokenData;
        }
      }

      if (!stopStreamingRef.current && fullResponse.trim()) {
        const finalAssistantMessage: Message = { 
          ...assistantMessagePlaceholder, 
          content: fullResponse,
          ...(tokenData && {
            input_tokens: tokenData.input,
            output_tokens: tokenData.output,
            total_tokens: tokenData.total,
          })
        };
        
        // Save final message to database
        db.addMessage(finalAssistantMessage).catch(err => console.error("Failed to save assistant message:", err));
        
        // Add final message to the conversation state
        setConversations(prev => prev.map(c => c.id === convId ? {
          ...c, messages: [...(c.messages || []), finalAssistantMessage]
        } : c));
      }
    } catch (error) {
      const errorContent = `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const errorMessage = {
        id: generateId(), conversation_id: convId, user_id: profile.id,
        role: 'assistant', content: errorContent, created_at: new Date()
      } as Message;
      
      setConversations(prev => prev.map(c => c.id === convId ? {
        ...c, messages: [...(c.messages || []), errorMessage]
      } : c));
      db.addMessage(errorMessage).catch(err => console.error("Failed to save error message:", err));
    } finally {
      setIsChatLoading(false);
      setStreamingMessage(null); // Clear the streaming message state
      stopStreamingRef.current = false;
    }
  }, [profile, currentConversationId, conversations, settings.selectedModel, createNewConversation]);
  // =================================================================
  // == END OF FIX
  // =================================================================


  const handleGenerateQuiz = useCallback(async () => {
    // ... (This function remains unchanged)
  }, [currentConversation]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    // ... (This function remains unchanged)
  }, [conversations, currentConversationId]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    // ... (This function remains unchanged)
  }, [conversations]);

  const getActiveView = () => {
    if (showAdminPanel) return 'admin';
    if (showTeacherDashboard) return 'dashboard';
    if (currentNoteId) return 'note';
    return 'chat';
  };

  // ... (The rest of the file remains unchanged, including loading/error states and JSX)
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
        <div className="flex h-screen w-screen items-center justify-center bg-grid-slate-900 text-white p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50" />
            <div className="relative z-10 text-center max-w-sm w-full animate-fade-in-up">
                <img
                    src="/white-logo.png"
                    alt="AI Tutor Logo"
                    className="w-24 h-24 mx-auto mb-6 pulse-subtle"
                />
                <h1 className="text-3xl font-bold text-white mb-2">
                    Loading your learning space...
                </h1>
                <p className="text-gray-400 mb-8">
                    Getting your conversations and notes ready.
                </p>
                <div className="w-full bg-black/20 border border-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div className="animate-shimmer h-2.5" />
                </div>
            </div>
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
        notes={notes}
        assignedQuizzes={assignedQuizzes}
        activeView={getActiveView()}
        currentConversationId={currentConversationId}
        currentNoteId={currentNoteId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onSelectNote={handleSelectNote}
        onSelectAssignedQuiz={handleSelectAssignedQuiz}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteNote={handleDeleteNote}
        onOpenSettings={() => setSettingsOpen(true)}
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
        ) : currentNoteId ? (
          <>
            <button
              onClick={() => {
                setCurrentNoteId(null);
                setCurrentConversationId(conversations.length > 0 ? conversations[0].id : null);
              }}
              className="m-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft size={16} /> Back to Chats
            </button>
            <NoteView note={currentNote || null} />
          </>
        ) : (
          <ChatArea
            conversation={currentConversation}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            isQuizLoading={isQuizLoading}
            streamingMessage={streamingMessage}
            hasApiKey={true}
            onStopGenerating={() => { stopStreamingRef.current = true; }}
            onSaveAsNote={handleSaveAsNote}
            onGenerateQuiz={handleGenerateQuiz}
          />
        )}
      </div>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setCurrentQuizSession(null);
        }}
        onFinish={handleFinishQuiz}
        session={currentQuizSession}
      />
    </div>
  );
}
