import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
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
  onLoadMoreMessages,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [allMessages.length, streamingMessage?.content, scrollToBottom]);

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
      <div
        ref={chatMessagesRef}
        className="chat-messages scroll-container"
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
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
