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
    try {
        const newConversation = await db.createConversation(profile.id, title);
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        handleSwitchToChatView();
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
        return newConversation;
    } catch (error) {
        console.error("Error creating new conversation:", error);
        alert("Could not create a new conversation. Please try again.");
        throw error;
    }
  }, [profile, handleSwitchToChatView]);

  const handleNewConversation = useCallback(async () => {
    await createNewConversation('New Chat');
  }, [createNewConversation]);

  // Effect to fetch initial data for the user
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
            } else {
                setCurrentConversationId(null);
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

  // Effect to fetch messages for the currently selected conversation
  useEffect(() => {
      if (!currentConversationId) return;

      const currentConvo = conversations.find(c => c.id === currentConversationId);
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

  const currentNote = useMemo(() => 
    notes.find(n => n.id === currentNoteId), 
    [notes, currentNoteId]
  );

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setCurrentNoteId(null); // Clear note selection when selecting conversation
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);
  
  // NEW: Handle selecting a note
  const handleSelectNote = useCallback((id: string) => {
    setCurrentNoteId(id);
    setCurrentConversationId(null); // Clear conversation selection when selecting note
    handleSwitchToChatView();
  }, [handleSwitchToChatView]);
  
  const handleSelectAssignedQuiz = useCallback((assignment: QuizAssignmentWithDetails) => {
    if (assignment.completed_at) {
        alert(`You have already completed this quiz. Your score was ${assignment.score}/${assignment.total_questions}.`);
        return;
    }
    const session: StudySession = {
      id: generateId(),
      conversationId: '', // Not from a conversation
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
    // Ensure we have a profile and a quiz session before proceeding
    if (!profile || !currentQuizSession) {
        setIsQuizModalOpen(false);
        setCurrentQuizSession(null);
        return;
    }

    try {
        // Case 1: The quiz is an assignment from a teacher.
        // We need to update the assignment record in the database.
        if (currentQuizSession.assignmentId) {
            await db.markQuizAsCompleted(currentQuizSession.assignmentId, score, totalQuestions);
            
            // After completing, refetch the list of assignments to update its status in the UI.
            const updatedQuizzes = await db.getAssignedQuizzesForStudent(profile.id);
            setAssignedQuizzes(updatedQuizzes);
            
            // Notify the student their assignment was submitted.
            alert(`Assignment submitted successfully! Your score: ${score}/${totalQuestions}`);
        } 
        // Case 2: The quiz was generated from a conversation for self-study.
        // We save this to the 'quizzes' table for personal progress tracking.
        else if (currentQuizSession.conversationId) {
            await db.createQuiz(profile.id, currentQuizSession.conversationId, score, totalQuestions);
            console.log(`Self-study quiz result saved. Score: ${score}/${totalQuestions}`);
        }
    } catch (err) {
        console.error("Failed to save quiz result:", err);
        alert("There was an error saving your quiz result. Please try again.");
    } finally {
        // This block ensures the modal always closes and the session is cleared,
        // regardless of whether the database operations succeeded or failed.
        setIsQuizModalOpen(false);
        setCurrentQuizSession(null);
    }
  }, [currentQuizSession, profile]);

  // NEW: Handle saving message as note
  const handleSaveAsNote = useCallback(async (content: string, title?: string) => {
    if (!profile) {
      console.error("User profile not available for saving note");
      return;
    }

    try {
      const noteTitle = title || `Note from ${new Date().toLocaleDateString()}`;
      const newNote = await db.createNote(
        profile.id, 
        noteTitle, 
        content, 
        currentConversationId || undefined
      );
      
      setNotes(prev => [newNote, ...prev]);
      console.log("Note saved successfully:", newNote);
    } catch (error) {
      console.error("Error saving note:", error);
      throw error; // Re-throw so MessageBubble can show error to user
    }
  }, [profile, currentConversationId]);

  // NEW: Handle deleting note
  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await db.deleteNote(noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Could not delete the note. Please try again.");
    }
  }, []);

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
        console.error("Failed to create a new conversation for the first message:", err);
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
    
    setConversations(prev => prev.map(c => c.id === conversationToUseId ? { 
      ...c,
      messages: [...(c.messages || []), userMessage], 
    } : c));
    
    setIsChatLoading(true);
    stopStreamingRef.current = false;
    
    db.addMessage({
      conversation_id: userMessage.conversation_id,
      user_id: userMessage.user_id,
      content: userMessage.content,
      role: userMessage.role,
    }).catch(err => console.error("Failed to save user message:", err));
    
    const isFirstMessage = (conversations.find(c => c.id === conversationToUseId)?.messages?.length || 0) === 0;
    if (isFirstMessage) {
        const newTitle = generateConversationTitle(content);
        setConversations(prev => prev.map(c => c.id === conversationToUseId ? {...c, title: newTitle} : c));
        db.updateConversationTitle(conversationToUseId, newTitle).catch(err => console.error("Failed to update title:", err));
    } else {
        db.updateConversationTimestamp(conversationToUseId).catch(err => console.error("Failed to update timestamp:", err));
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
        
        db.addMessage({ ...finalAssistantMessage, id: undefined, created_at: undefined }).catch(err => console.error("Failed to save assistant message:", err));
        
        setConversations(prev => prev.map(c => {
          if (c.id === conversationToUseId) {
            const existingMessages = c.messages || [];
            return { ...c, messages: [...existingMessages, finalAssistantMessage] };
          }
          return c;
        }));
      }
    } catch (error) {
      console.error('Error generating response:', error);
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
      db.addMessage(errorMessage).catch(err => console.error("Failed to save error message:", err));
    } finally {
      setIsChatLoading(false);
      setStreamingMessage(null);
      stopStreamingRef.current = false;
    }
  }, [profile, currentConversationId, conversations, settings.selectedModel, createNewConversation]);

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
          <NoteView note={currentNote || null} />
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
