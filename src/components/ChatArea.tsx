// src/components/ChatArea.tsx

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Conversation, Message } from '../types';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';

interface ChatAreaProps {
  conversation: Conversation | undefined;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isQuizLoading: boolean;
  streamingMessage?: Message | null;
  hasApiKey: boolean;
  onStopGenerating: () => void;
  onSaveAsNote: (content: string, title?: string) => Promise<void>;
  onGenerateQuiz: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onLoadMoreMessages?: (conversationId: string, offset: number) => Promise<Message[]>;
}

const MESSAGES_PER_PAGE = 20;
const SCROLL_THRESHOLD = 100; // Pixels from bottom to trigger scroll button

// Welcome screen component
const WelcomeScreen = React.memo(({ 
  onSendMessage, 
  isLoading, 
  isQuizLoading, 
  hasApiKey, 
  onStopGenerating, 
  onGenerateQuiz 
}: {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isQuizLoading: boolean;
  hasApiKey: boolean;
  onStopGenerating: () => void;
  onGenerateQuiz: () => void;
}) => (
  <div className="chat-area">
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full px-4 animate-fade-in-up">
        <div className="relative mb-6">
          <img
            src="/white-logo.png"
            alt="AI Tutor Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto pulse-subtle"
          />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl animate-pulse" />
        </div>
        
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-primary)] mb-4">
          AI Tutor
        </h2>
        
        <p className="text-sm sm:text-base text-[var(--color-text-secondary)] opacity-90 mb-6 leading-relaxed">
          Your intelligent learning companion is ready to help. Ask anything to get started!
        </p>
        
        {!hasApiKey && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <p className="text-sm text-orange-300">
              Configure your API keys in settings to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
    <div className="chat-input-container">
      <ChatInput
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        isQuizLoading={isQuizLoading}
        disabled={!hasApiKey}
        onStopGenerating={onStopGenerating}
        onGenerateQuiz={onGenerateQuiz}
        canGenerateQuiz={false}
      />
    </div>
  </div>
));

// Load more button component
const LoadMoreButton = React.memo(({ 
  onClick, 
  isLoading, 
  hasMore 
}: { 
  onClick: () => void; 
  isLoading: boolean; 
  hasMore: boolean; 
}) => {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading earlier messages...</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 rotate-180" />
            <span>Load earlier messages</span>
          </>
        )}
      </button>
    </div>
  );
});

// Scroll to bottom button
const ScrollToBottomButton = React.memo(({ 
  onClick, 
  show 
}: { 
  onClick: () => void; 
  show: boolean; 
}) => (
  <div className={`scroll-to-bottom ${show ? 'visible' : 'hidden'}`}>
    <button
      onClick={onClick}
      className="interactive-button p-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-full shadow-lg hover:shadow-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] backdrop-blur-sm"
      title="Scroll to bottom"
    >
      <ChevronDown className="w-5 h-5" />
    </button>
  </div>
));

// Messages container component
const MessagesContainer = React.memo(({ 
  messages, 
  streamingMessage, 
  onSaveAsNote 
}: {
  messages: Message[];
  streamingMessage: Message | null;
  onSaveAsNote: (content: string, title?: string) => Promise<void>;
}) => {
  const displayMessages = streamingMessage ? [...messages, streamingMessage] : messages;
  
  return (
    <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
      {displayMessages.map((message, index) => (
        <MessageBubble
          key={`${message.id}-${index}`}
          message={message}
          isStreaming={streamingMessage?.id === message.id}
          onSaveAsNote={onSaveAsNote}
        />
      ))}
    </div>
  );
});

export function ChatArea({
  conversation,
  onSendMessage,
  isLoading,
  isQuizLoading,
  streamingMessage,
  hasApiKey,
  onStopGenerating,
  onSaveAsNote,
  onGenerateQuiz,
  onEditMessage,
  onRegenerateResponse,
  onLoadMoreMessages,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  
  // Pagination and scroll state
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const allMessages = useMemo(() => {
    const baseMessages = conversation?.messages || [];
    return streamingMessage ? [...baseMessages, streamingMessage] : baseMessages;
  }, [conversation?.messages, streamingMessage]);

  // Initialize displayed messages and pagination
  useEffect(() => {
    if (conversation) {
      const messages = conversation.messages || [];
      const initialMessages = messages.slice(-MESSAGES_PER_PAGE);
      setDisplayedMessages(initialMessages);
      setHasMoreMessages(messages.length > MESSAGES_PER_PAGE);
      setCurrentOffset(Math.max(0, messages.length - MESSAGES_PER_PAGE));
    } else {
      setDisplayedMessages([]);
      setHasMoreMessages(false);
      setCurrentOffset(0);
    }
  }, [conversation]);

  // Enhanced scroll management
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(() => {
    if (!chatMessagesRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Show scroll button if user has scrolled up significantly
    setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  // Load more messages (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!conversation || !onLoadMoreMessages || isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    try {
      const moreMessages = await onLoadMoreMessages(conversation.id, currentOffset);
      if (moreMessages.length > 0) {
        setDisplayedMessages(prev => [...moreMessages, ...prev]);
        setCurrentOffset(prev => Math.max(0, prev - MESSAGES_PER_PAGE));
        setHasMoreMessages(currentOffset > MESSAGES_PER_PAGE);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversation, onLoadMoreMessages, isLoadingMore, hasMoreMessages, currentOffset]);

  // Auto-scroll behavior
  useEffect(() => {
    // Only auto-scroll if the user hasn't scrolled up (indicated by the scroll button's visibility).
    if (!showScrollButton) {
      // Use 'auto' for instant jump on new messages to feel responsive
      scrollToBottom('auto');
    }
  }, [allMessages.length, streamingMessage?.content, showScrollButton, scrollToBottom]);

  // Add scroll event listener
  useEffect(() => {
    const chatContainer = chatMessagesRef.current;
    if (!chatContainer) return;

    chatContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      chatContainer.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Reset scroll state when conversation changes
  useEffect(() => {
    setShowScrollButton(false);
    if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [conversation?.id]);

  const showWelcomeScreen = !conversation || allMessages.length === 0;
  const canGenerateQuiz = conversation && allMessages.length >= 2;

  if (showWelcomeScreen) {
    return (
      <WelcomeScreen
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        isQuizLoading={isQuizLoading}
        hasApiKey={hasApiKey}
        onStopGenerating={onStopGenerating}
        onGenerateQuiz={onGenerateQuiz}
      />
    );
  }

  return (
    <div className="chat-area">
      <div
        ref={chatMessagesRef}
        className="chat-messages"
      >
        <div className="chat-messages-container">
          {/* Load More Button */}
          <LoadMoreButton
            onClick={handleLoadMore}
            isLoading={isLoadingMore}
            hasMore={hasMoreMessages}
          />
          
          {/* Messages */}
          <MessagesContainer
            messages={displayedMessages}
            streamingMessage={streamingMessage}
            onSaveAsNote={onSaveAsNote}
          />
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton
        onClick={() => scrollToBottom('smooth')}
        show={showScrollButton}
      />

      {/* Chat Input */}
      <div className="chat-input-container">
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          isQuizLoading={isQuizLoading}
          disabled={!hasApiKey}
          onStopGenerating={onStopGenerating}
          onGenerateQuiz={onGenerateQuiz}
          canGenerateQuiz={!!canGenerateQuiz}
        />
      </div>
    </div>
  );
}
