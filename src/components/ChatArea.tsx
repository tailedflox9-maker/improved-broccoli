import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { Search, X, ChevronUp, ChevronDown, Star, StarOff, Loader2 } from 'lucide-react';
import { Conversation, Message } from '../types';

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
  onTogglePin?: (conversationId: string) => Promise<void>;
  onLoadMoreMessages?: (conversationId: string, offset: number) => Promise<Message[]>;
}

const MESSAGES_PER_PAGE = 20;

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
  onTogglePin,
  onLoadMoreMessages,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  // Pagination
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Pin functionality
  const [isPinning, setIsPinning] = useState(false);

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

  // Search functionality
  useEffect(() => {
    if (searchTerm && allMessages.length > 0) {
      const results = allMessages.filter(message => 
        message.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSearchResults(results);
      setCurrentSearchIndex(0);
    } else {
      setSearchResults([]);
      setCurrentSearchIndex(0);
    }
  }, [searchTerm, allMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

  // Handle pin/unpin conversation
  const handleTogglePin = useCallback(async () => {
    if (!conversation || !onTogglePin || isPinning) return;
    
    setIsPinning(true);
    try {
      await onTogglePin(conversation.id);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    } finally {
      setIsPinning(false);
    }
  }, [conversation, onTogglePin, isPinning]);

  // Search navigation
  const handleSearchNext = useCallback(() => {
    if (searchResults.length > 0) {
      const nextIndex = (currentSearchIndex + 1) % searchResults.length;
      setCurrentSearchIndex(nextIndex);
      scrollToMessage(searchResults[nextIndex].id);
    }
  }, [searchResults, currentSearchIndex, scrollToMessage]);

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length > 0) {
      const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
      setCurrentSearchIndex(prevIndex);
      scrollToMessage(searchResults[prevIndex].id);
    }
  }, [searchResults, currentSearchIndex, scrollToMessage]);

  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [allMessages.length, streamingMessage?.content, scrollToBottom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            setShowSearch(true);
            break;
          case 'k':
            e.preventDefault();
            if (showSearch && searchResults.length > 0) {
              handleSearchPrev();
            }
            break;
          case 'j':
            e.preventDefault();
            if (showSearch && searchResults.length > 0) {
              handleSearchNext();
            }
            break;
        }
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, searchResults, handleSearchNext, handleSearchPrev]);

  const showWelcomeScreen = !conversation || allMessages.length === 0;
  const canGenerateQuiz = conversation && allMessages.length >= 2;

  if (showWelcomeScreen) {
    return (
      <div className="chat-area">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full px-4 animate-fade-in-up">
            <img
              src="/white-logo.png"
              alt="AI Tutor Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6"
            />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-primary)] mb-2 sm:mb-4">
              AI Tutor
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] opacity-80">
              Start a conversation to begin learning
            </p>
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
    );
  }

  return (
    <div className="chat-area">
      {/* Search Bar - Only show when active */}
      {showSearch && (
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '10px', 
          right: '10px', 
          zIndex: 10,
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search style={{ width: '16px', height: '16px', color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search messages... (Ctrl+F)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: '14px'
              }}
              autoFocus
            />
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
                <button
                  onClick={handleSearchPrev}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--color-text-secondary)'
                  }}
                  title="Previous (Ctrl+K)"
                >
                  <ChevronUp style={{ width: '12px', height: '12px' }} />
                </button>
                <button
                  onClick={handleSearchNext}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--color-text-secondary)'
                  }}
                  title="Next (Ctrl+J)"
                >
                  <ChevronDown style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchTerm('');
              }}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)'
              }}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>
      )}

      {/* Add subtle toolbar for search and pin */}
      {conversation && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-bg)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>
              {conversation.title}
            </span>
            {conversation.is_pinned && (
              <Star style={{ width: '14px', height: '14px', color: '#fbbf24', fill: '#fbbf24' }} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)'
              }}
              title="Search (Ctrl+F)"
            >
              <Search style={{ width: '16px', height: '16px' }} />
            </button>
            {onTogglePin && (
              <button
                onClick={handleTogglePin}
                disabled={isPinning}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-secondary)'
                }}
                title={conversation.is_pinned ? "Unpin conversation" : "Pin conversation"}
              >
                {isPinning ? (
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : conversation.is_pinned ? (
                  <StarOff style={{ width: '16px', height: '16px' }} />
                ) : (
                  <Star style={{ width: '16px', height: '16px' }} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={chatMessagesRef}
        className="chat-messages scroll-container"
        style={{ paddingTop: showSearch ? '80px' : '0' }}
      >
        <div className="chat-messages-container">
          {/* Load More Button */}
          {hasMoreMessages && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Loading...
                  </>
                ) : (
                  'Load earlier messages'
                )}
              </button>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
            {(streamingMessage ? [...displayedMessages, streamingMessage] : displayedMessages).map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={streamingMessage?.id === message.id}
                onSaveAsNote={onSaveAsNote}
                onEditMessage={onEditMessage}
                onRegenerateResponse={onRegenerateResponse}
                searchTerm={searchTerm}
                isHighlighted={searchResults.some(result => result.id === message.id)}
              />
            ))}
          </div>
          <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
        </div>
      </div>

      <div className="chat-input-container mobile-chat-area">
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
