import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, PlusCircle, Square, ClipboardCheck, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isQuizLoading: boolean;
  disabled?: boolean;
  onStopGenerating: () => void;
  onGenerateQuiz: () => void;
  canGenerateQuiz: boolean;
}

export function ChatInput({
  onSendMessage,
  isLoading,
  isQuizLoading,
  disabled = false,
  onStopGenerating,
  onGenerateQuiz,
  canGenerateQuiz
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [input, isLoading, disabled, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(prev => `${prev}${prev ? '\n' : ''}${text}`);
      setTimeout(() => textareaRef.current?.focus(), 0);
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  // FIX: Handle quiz generation with proper event handling
  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canGenerateQuiz && !isQuizLoading && !isLoading) {
      onGenerateQuiz();
    }
  }, [canGenerateQuiz, isQuizLoading, isLoading, onGenerateQuiz]);

  const canSend = input.trim() && !disabled;

  return (
    <div className="chat-input">
      {/* Stop generating button */}
      {isLoading && (
        <div className="flex justify-center mb-2">
          <button
            onClick={onStopGenerating}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-gray-600 transition-all touch-target"
          >
            <Square className="w-3 h-3" />
            <span className="hidden sm:inline">
              Stop generating
            </span>
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        {/* File attach button */}
        <button
          type="button"
          onClick={handlePlusClick}
          className="interactive-button flex-shrink-0 p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors touch-target"
          title={'Attach file content'}
        >
          <PlusCircle className="w-5 h-5" />
        </button>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.html,.css,.json"
          className="hidden"
        />

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Configure API keys first...'
              : 'Ask anything...'
          }
          disabled={disabled || isLoading}
          className="chat-input-textarea"
          rows={1}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        />

        {/* Action buttons */}
        <div className="chat-input-buttons">
          {/* Quiz button - FIX: Proper button type and event handling */}
          <button
            type="button"
            onClick={handleQuizClick}
            disabled={!canGenerateQuiz || isQuizLoading || isLoading}
            className={`interactive-button w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
              !canGenerateQuiz || isQuizLoading || isLoading
                ? 'bg-transparent text-[var(--color-text-placeholder)] cursor-not-allowed opacity-50'
                : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
            title={canGenerateQuiz ? 'Generate Quiz' : 'Have a conversation first to generate a quiz'}
          >
            {isQuizLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ClipboardCheck className="w-4 h-4" />
            )}
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!canSend || isLoading}
            className={`interactive-button w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
              !canSend || isLoading
                ? 'bg-transparent text-[var(--color-text-placeholder)] cursor-not-allowed opacity-50'
                : 'bg-[var(--color-accent-bg)] text-[var(--color-bg)] hover:bg-[var(--color-accent-bg-hover)]'
            }`}
            title={'Send message'}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
