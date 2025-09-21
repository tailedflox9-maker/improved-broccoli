import React, { useEffect, useRef, useCallback, useMemo } from 'react';
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
  onSaveAsNote: (content: string) => void;
  onGenerateQuiz: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
}

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
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(() => {
    const baseMessages = conversation?.messages || [];
    return streamingMessage ? [...baseMessages, streamingMessage] : baseMessages;
  }, [conversation?.messages, streamingMessage]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // A small delay allows the DOM to update before scrolling
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [allMessages.length, streamingMessage?.content, scrollToBottom]);

  // Show welcome screen if there is no active conversation OR if the active conversation has no messages
  const showWelcomeScreen = !conversation || allMessages.length === 0;
  const canGenerateQuiz = conversation && allMessages.length >= 2;

  if (showWelcomeScreen) {
    return (
      <div className="chat-area">
        <div className="flex-1 flex items-center justify-center p-4 relative">
          {/* Enhanced background with subtle animation */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10" />
          </div>
          
          <div className="text-center max-w-lg w-full px-4 animate-fade-in-up relative z-10">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
              <img
                src="/white-logo.png"
                alt="AI Tutor Logo"
                className="w-24 h-24 sm:w-28 sm:h-28 mx-auto relative z-10 drop-shadow-xl"
              />
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent mb-4 leading-tight">
              AI Tutor
            </h2>
            
            <div className="space-y-3 text-gray-300 mb-8">
              <p className="text-lg sm:text-xl font-medium">
                Your intelligent learning companion
              </p>
              <p className="text-sm sm:text-base opacity-75 max-w-md mx-auto">
                Ask questions, explore topics, and get personalized explanations tailored to your learning style
              </p>
            </div>
            
            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-xs sm:text-sm">
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-2 h-2 bg-blue-400 rounded-full" />
                <span>Instant Answers</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-2 h-2 bg-purple-400 rounded-full" />
                <span>Interactive Quizzes</span>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <span>Personalized Learning</span>
              </div>
            </div>
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
          <div className="space-y-6 sm:space-y-8 py-6 sm:py-8">
            {allMessages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={streamingMessage?.id === message.id}
                onSaveAsNote={onSaveAsNote}
                onEditMessage={onEditMessage}
                onRegenerateResponse={onRegenerateResponse}
                isFirst={index === 0}
              />
            ))}
            
            {/* Typing indicator */}
            {isLoading && streamingMessage && (
              <div className="flex items-end gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse" />
                </div>
                <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 backdrop-blur-sm border border-white/10 p-4 rounded-2xl rounded-bl-md shadow-xl">
                  <div className="flex items-center gap-1">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
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
