import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, PlusCircle, Square, ClipboardCheck, Loader2, Paperclip } from 'lucide-react';

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
  const [isFocused, setIsFocused] = useState(false);
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
      {/* Enhanced Stop generating button */}
      {isLoading && (
        <div className="flex justify-center mb-3">
          <button
            onClick={onStopGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/20 transition-all duration-200 touch-target backdrop-blur-sm"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="font-medium">Stop generating</span>
          </button>
        </div>
      )}

      {/* Enhanced Input form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`chat-input-form relative overflow-hidden transition-all duration-300 ${
          isFocused ? 'ring-2 ring-blue-500/50 border-blue-500/30' : ''
        } ${disabled ? 'opacity-50' : ''}`}>
          
          {/* Subtle gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />
          
          {/* File attach button with enhanced styling */}
          <div className="relative">
            <button
              type="button"
              onClick={handlePlusClick}
              disabled={disabled || isLoading}
              className="interactive-button flex-shrink-0 p-2.5 text-[var(--color-text-secondary)] hover:text-blue-400 transition-all duration-200 touch-target rounded-lg hover:bg-blue-500/10 disabled:opacity-50"
              title="Attach file content"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.md,.js,.ts,.jsx,.tsx,.py,.html,.css,.json"
            className="hidden"
          />

          {/* Enhanced text area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                disabled
                  ? 'Configure API keys first...'
                  : 'Ask me anything... (Shift + Enter for new line)'
              }
              disabled={disabled || isLoading}
              className="chat-input-textarea resize-none leading-relaxed placeholder:text-[var(--color-text-placeholder)] focus:placeholder:text-gray-500 transition-colors"
              rows={1}
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                minHeight: '24px'
              }}
            />
            
            {/* Character counter for long messages */}
            {input.length > 200 && (
              <div className="absolute bottom-1 right-1 text-xs text-gray-500 pointer-events-none">
                {input.length}
              </div>
            )}
          </div>

          {/* Enhanced action buttons */}
          <div className="chat-input-buttons">
            {/* Quiz button with better visual feedback */}
            <button
              type="button"
              onClick={handleQuizClick}
              disabled={!canGenerateQuiz || isQuizLoading || isLoading}
              className={`interactive-button w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
                !canGenerateQuiz || isQuizLoading || isLoading
                  ? 'bg-transparent text-[var(--color-text-placeholder)] cursor-not-allowed opacity-40'
                  : 'bg-transparent text-[var(--color-text-secondary)] hover:text-purple-400 hover:bg-purple-500/10'
              }`}
              title={canGenerateQuiz ? 'Generate Quiz' : 'Have a conversation first to generate a quiz'}
            >
              {isQuizLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardCheck className="w-4 h-4" />
              )}
            </button>

            {/* Enhanced Send button */}
            <button
              type="submit"
              disabled={!canSend || isLoading}
              className={`interactive-button w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 relative overflow-hidden ${
                !canSend || isLoading
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-blue-500/25'
              }`}
              title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {canSend && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  )}
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Enhanced input status indicators */}
        {disabled && (
          <div className="absolute -top-8 left-4 text-xs text-yellow-400 font-medium">
            ⚠️ API configuration required
          </div>
        )}
      </form>
    </div>
  );
}
