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
import { Menu } from 'lucide-react';
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
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [currentQuizSession, setCurrentQuizSession] = useState<StudySession | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);
  
  // Error handling state
  const [lastError, setLastError] = useState<string | null>(null);
  
  const stopStreamingRef = useRef(false);
  const [sidebarFolded, setSidebarFolded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ai-tutor-sidebar-folded') || 'false');
    } catch {
      return false;
    }
  });

  // Error handling helper
  const handleError = useCallback((error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    const errorMessage = db.handleDatabaseError(error, context).message;
    setLastError(errorMessage);
    setTimeout(() => setLastError(null), 5000);
  }, []);

  const handleToggleAdminPanel = useCallback(() => {
    if (profile?.role === 'admin') {
      setShowAdminPanel(prev => !prev);
      setShowTeacherDashboard(false);
      setCurrentNoteId(null);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    }
  }, [profile]);
  
  const handleToggleTeacherDashboard = useCallback(() => {
      if (profile?.role === 'teacher') {
          setShowTeacherDashboard(prev => !prev);
          setShowAdminPanel(false);
          setCurrentNoteId(null);
          if (window.innerWidth < 1024) setSidebarOpen(false);
      }
  }, [profile]);
  
  const handleSwitchToChatView = useCallback(() => {
      setShowAdminPanel(false);
      setShowTeacherDashboard(false);
      setCurrentNoteId(null);
      if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  const createNewConversation = useCallback(async (title: string): Promise<Conversation> => {
    if (!profile) throw new Error("User profile not available.");
    try {
        const newConversation = await db.retryOperation(() => 
          db.createConversation(profile.id, title)
        );
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        handleSwitchToChatView();
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
        return newConversation;
    } catch (error) {
        handleError(error, "create conversation");
        throw error;
    }
  }, [profile, handleSwitchToChatView, handleError]);

  const handleNewConversation = useCallback(async () => {
    await createNewConversation('New Chat');
  }, [createNewConversation]);

  // Enhanced save note function
  const handleSaveAsNote = useCallback(async (content: string, title?: string) => {
    if (!profile) {
      throw new Error("User profile not available");
    }

    try {
      const savedNote = await db.retryOperation(() => 
        db.createNoteFromMessage(
          profile.id, 
          content, 
          title, 
          currentConversationId || undefined
        )
      );
      
      // Optimistic update
      setNotes(prev => [savedNote, ...prev]);
      
      return savedNote;
    } catch (error) {
      handleError(error, "save note");
      throw error;
    }
  }, [profile, currentConversationId, handleError]);

  // Toggle conversation pin
  const handleTogglePin = useCallback(async (conversationId: string) => {
    try {
      // Optimistic update
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, is_pinned: !conv.is_pinned }
          : conv
      ));

      const newPinStatus = await db.retryOperation(() => 
        db.toggleConversationPin(conversationId)
      );

      // Update with actual result (in case optimistic update was wrong)
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, is_pinned: newPinStatus }
          : conv
      ));

    } catch (error) {
      // Rollback optimistic update
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, is_pinned: !conv.is_pinned }
          : conv
      ));
      handleError(error, "toggle pin");
    }
  }, [handleError]);

  // Load more messages for pagination
  const handleLoadMoreMessages = useCallback(async (conversationId: string, offset: number) => {
    try {
      const moreMessages = await db.retryOperation(() => 
        db.getConversationMessagesWithPagination(conversationId, 20, offset)
      );
      return moreMessages;
    } catch (error) {
      handleError(error, "load more messages");
      return [];
    }
  }, [handleError]);

  // Effect to fetch initial data for the user
  useEffect(() => {
    if (!profile || initialized) return;
    
    const fetchInitialData = async () => {
        try {
            const [userConversations, userNotes, userQuizzes] = await Promise.all([
              db.retryOperation(() => db.getConversationsWithPinning(profile.id)),
              db.retryOperation(() => db.getNotes(profile.id)),
              profile.role === 'student' 
                ? db.retryOperation(() => db.getAssignedQuizzesForStudent(profile.id))
                : Promise.resolve([])
            ]);

            setConversations(userConversations);
            setNotes(userNotes);
            setAssignedQuizzes(userQuizzes);
            
            if (userConversations.length > 0) {
                setCurrentConversationId(userConversations[0].id);
            } else {
                setCurrentConversationId(null);
            }
        } catch (err) {
            handleError(err, "fetch initial data");
        } finally {
            setInitialized(true);
        }
    };
    
    fetchInitialData();
  }, [profile, initialized, handleError]);

  // Effect to fetch messages for the currently selected conversation
  useEffect(() => {
      if (!currentConversationId) return;

      const currentConvo = conversations.find(c => c.id === currentConversationId);
      if (currentConvo && !currentConvo.messages) {
          const fetchMessages = async () => {
              try {
                  const messages = await db.retryOperation(() => 
                    db.getConversationMessages(currentConversationId)
                  );
                  setConversations(prev => prev.map(c => 
                      c.id === currentConversationId ? { ...c, messages } : c
                  ));
              } catch (err) {
                  handleError(err, "fetch messages");
              }
          };
          fetchMessages();
      }
  }, [currentConversationId, conversations, handleError]);

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

  const currentNote = useMemo(() =>
    notes.find(n => n.id === currentNoteId),
    [notes, currentNoteId]
  );

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setCurrentNoteId(null);
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);

  const handleSelectNote = useCallback((id: string) => {
    setCurrentNoteId(id);
    setCurrentConversationId(null);
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);
  
  const handleSelectAssignedQuiz = useCallback((assignment: QuizAssignmentWithDetails) => {
    if (assignment.completed_at) {
        alert(`You have already completed this quiz. Your score was ${assignment.score}/${assignment.total_questions}.`);
        return;
    }
    const session: StudySession = {
      id: generateId(),
      conversationId: '',
      questions: assignment.generated_quizzes.questions,
      currentQuestionIndex: 0,
      score: 0,
      totalQuestions: assignment.generated_quizzes.questions.length,
      isCompleted: false,
      createdAt: new Date(),
      assignmentId: assignment.id,
    };
    setCurrentQuizSession(session);
    setIsQuizModalOpen(true);
  }, []);
  
  const handleFinishQuiz = useCallback(async (score: number, totalQuestions: number) => {
    if (currentQuizSession?.assignmentId) {
        try {
            await db.retryOperation(() => 
              db.markQuizAsCompleted(currentQuizSession.assignmentId!, score, totalQuestions)
            );
            if (profile) {
                const quizzes = await db.retryOperation(() => 
                  db.getAssignedQuizzesForStudent(profile.id)
                );
                setAssignedQuizzes(quizzes);
            }
        } catch (err) {
            handleError(err, "mark quiz as completed");
        }
    }
    setCurrentQuizSession(null);
    setIsQuizModalOpen(false);
  }, [currentQuizSession, profile, handleError]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!profile) {
      console.error("User profile is not loaded yet.");
      return;
    }

    let conversationToUseId = currentConversationId;

    if (!conversationToUseId) {
      try {
        const newTitle = generateConversationTitle(content);
        const newConversation = await createNewConversation(newTitle);
        conversationToUseId = newConversation.id;
      } catch (err) {
        return;
      }
    }
    
    const userMessage: Message = { 
      id: generateId(), 
      conversation_id: conversationToUseId, 
      user_id: profile.id, 
      content, 
      role: 'user', 
      created_at: new Date() 
    };
    
    // Optimistic update
    setConversations(prev => prev.map(c => c.id === conversationToUseId ? { 
      ...c,
      messages: [...(c.messages || []), userMessage], 
    } : c));
    
    setIsChatLoading(true);
    stopStreamingRef.current = false;
    
    // Save user message with retry
    db.retryOperation(() => db.addMessage({
      conversation_id: userMessage.conversation_id,
      user_id: userMessage.user_id,
      content: userMessage.content,
      role: userMessage.role,
    })).catch(err => handleError(err, "save user message"));
    
    const isFirstMessage = (conversations.find(c => c.id === conversationToUseId)?.messages?.length || 0) === 0;
    if (isFirstMessage) {
        const newTitle = generateConversationTitle(content);
        setConversations(prev => prev.map(c => c.id === conversationToUseId ? {...c, title: newTitle} : c));
        db.retryOperation(() => db.updateConversationTitle(conversationToUseId, newTitle))
          .catch(err => handleError(err, "update conversation title"));
    } else {
        db.retryOperation(() => db.updateConversationTimestamp(conversationToUseId))
          .catch(err => handleError(err, "update conversation timestamp"));
    }
    
    try {
      const assistantMessage: Message = { 
        id: generateId(), 
        conversation_id: conversationToUseId, 
        user_id: profile.id, 
        content: '', 
        role: 'assistant', 
        created_at: new Date(), 
        model: settings.selectedModel 
      };
      
      setStreamingMessage(assistantMessage);
      
      const latestMessages = [...(conversations.find(c => c.id === conversationToUseId)?.messages || []), userMessage];
      const messagesForApi = latestMessages.map(m => ({ 
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
        
        db.retryOperation(() => db.addMessage({ 
          ...finalAssistantMessage, 
          id: undefined, 
          created_at: undefined 
        })).catch(err => handleError(err, "save assistant message"));
        
        setConversations(prev => prev.map(c => {
          if (c.id === conversationToUseId) {
            const existingMessages = c.messages || [];
            return { ...c, messages: [...existingMessages, finalAssistantMessage] };
          }
          return c;
        }));
      }
    } catch (error) {
      handleError(error, "generate AI response");
      const errorContent = `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
      const errorMessage = { 
        id: generateId(), conversation_id: conversationToUseId, user_id: profile.id, 
        role: 'assistant', content: errorContent, created_at: new Date() 
      } as Message;

      setConversations(prev => prev.map(c => {
        if (c.id === conversationToUseId) {
            const existingMessages = c.messages || [];
            return { ...c, messages: [...existingMessages, errorMessage] };
        }
        return c;
      }));
    } finally {
      setIsChatLoading(false);
      setStreamingMessage(null);
      stopStreamingRef.current = false;
    }
  }, [profile, currentConversationId, conversations, settings.selectedModel, createNewConversation, handleError]);

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
      handleError(error, "generate quiz");
    } finally {
      setIsQuizLoading(false);
    }
  }, [currentConversation, handleError]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    const conversationToDelete = conversations.find(c => c.id === id);
    if (!conversationToDelete) return;

    // Optimistic update
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    
    if (currentConversationId === id) {
        setCurrentConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
    
    try {
        await db.retryOperation(() => db.deleteConversation(id));
    } catch (err) {
        // Rollback
        setConversations(prev => [conversationToDelete, ...prev.filter(c => c.id !== id)]);
        if (currentConversationId === id) {
          setCurrentConversationId(id);
        }
        handleError(err, "delete conversation");
    }
  }, [conversations, currentConversationId, handleError]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    const originalTitle = conversations.find(c => c.id === id)?.title;
    
    // Optimistic update
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    
    try {
        await db.retryOperation(() => db.updateConversationTitle(id, newTitle));
    } catch (err) {
        // Rollback
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: originalTitle || c.title } : c));
        handleError(err, "rename conversation");
    }
  }, [conversations, handleError]);

  const handleDeleteNote = useCallback(async (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (!noteToDelete) return;

    // Optimistic update
    setNotes(prev => prev.filter(n => n.id !== id));
    if (currentNoteId === id) {
      setCurrentNoteId(null);
    }

    try {
      await db.retryOperation(() => db.deleteNote(id));
    } catch (err) {
      // Rollback
      setNotes(prev => [noteToDelete, ...prev.filter(n => n.id !== id)]);
      handleError(err, "delete note");
    }
  }, [notes, currentNoteId, handleError]);

  const getActiveView = () => {
      if (showAdminPanel) return 'admin';
      if (showTeacherDashboard) return 'dashboard';
      if (currentNoteId) return 'note';
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
        <p>Loading your learning space...</p>
      </div>
    ); 
  }

  return (
    <div className="app-container">
      {/* Error notification */}
      {lastError && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {lastError}
        </div>
      )}

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
        ) : currentNoteId ? (
          <NoteView note={currentNote} />
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
            onTogglePin={handleTogglePin}
            onLoadMoreMessages={handleLoadMoreMessages}
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
        onFinish={handleFinishQuiz}
        session={currentQuizSession}
      />
    </div>
  );
}
