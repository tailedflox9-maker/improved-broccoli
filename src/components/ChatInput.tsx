import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, PlusCircle, Square, ClipboardCheck, Loader2, X, FileText, AlertCircle } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isQuizLoading: boolean;
  disabled?: boolean;
  onStopGenerating: () => void;
  onGenerateQuiz: () => void;
  canGenerateQuiz: boolean;
}

interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.html', '.css', '.json', '.xml', '.csv'];

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
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const messageContent = input.trim();
    if (!messageContent && !attachedFile) return;
    if (isLoading || disabled) return;

    let finalMessage = messageContent;
    
    // Include attached file content
    if (attachedFile) {
      finalMessage = `${messageContent ? messageContent + '\n\n' : ''}**File: ${attachedFile.name}**\n\`\`\`\n${attachedFile.content}\n\`\`\``;
    }

    onSendMessage(finalMessage);
    setInput('');
    setAttachedFile(null);
    setFileError(null);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachedFile, isLoading, disabled, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit, isComposing]);

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

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return `File type not supported. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`;
    }

    return null;
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError(null);
    
    const validation = validateFile(file);
    if (validation) {
      setFileError(validation);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setAttachedFile({
        name: file.name,
        content,
        size: file.size
      });
      setTimeout(() => textareaRef.current?.focus(), 0);
    };
    
    reader.onerror = () => {
      setFileError('Failed to read file');
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }, [validateFile]);

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null);
    setFileError(null);
    textareaRef.current?.focus();
  }, []);

  const handlePlusClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleQuizClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canGenerateQuiz && !isQuizLoading && !isLoading) {
      onGenerateQuiz();
    }
  }, [canGenerateQuiz, isQuizLoading, isLoading, onGenerateQuiz]);

  const canSend = (input.trim() || attachedFile) && !disabled;
  const inputPlaceholder = disabled 
    ? 'Configure API keys first...'
    : attachedFile 
      ? `File attached: ${attachedFile.name}. Add your message or press Enter to send...`
      : 'Ask anything...';

  return (
    <div className="chat-input">
      {/* Stop generating button */}
      {isLoading && (
        <div className="flex justify-center mb-2">
          <button
            onClick={onStopGenerating}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs sm:text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all touch-target"
          >
            <Square className="w-3 h-3" />
            <span className="hidden sm:inline">Stop generating</span>
            <span className="sm:hidden">Stop</span>
          </button>
        </div>
      )}

      {/* File error display */}
      {fileError && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attached file display */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-blue-300 truncate">
              {attachedFile.name}
            </div>
            <div className="text-xs text-blue-400/70">
              {(attachedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            onClick={handleRemoveFile}
            className="text-blue-400 hover:text-blue-300 transition-colors p-1 hover:bg-blue-500/20 rounded"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        {/* File attach button */}
        <button
          type="button"
          onClick={handlePlusClick}
          disabled={disabled || isLoading}
          className={`interactive-button flex-shrink-0 p-2 transition-colors touch-target ${
            attachedFile 
              ? 'text-blue-400 bg-blue-500/10' 
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
          title={attachedFile ? 'File attached' : 'Attach file'}
        >
          <PlusCircle className={`w-5 h-5 ${attachedFile ? 'rotate-45' : ''} transition-transform`} />
        </button>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={SUPPORTED_EXTENSIONS.join(',')}
          className="hidden"
        />

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={inputPlaceholder}
          disabled={disabled || isLoading}
          className="chat-input-textarea resize-none"
          rows={1}
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none'
          }}
          aria-label="Type your message"
        />

        {/* Action buttons */}
        <div className="chat-input-buttons">
          {/* Quiz button */}
          <button
            type="button"
            onClick={handleQuizClick}
            disabled={!canGenerateQuiz || isQuizLoading || isLoading}
            className={`interactive-button w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
              !canGenerateQuiz || isQuizLoading || isLoading
                ? 'bg-transparent text-[var(--color-text-placeholder)] cursor-not-allowed opacity-50'
                : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
            }`}
            title={
              !canGenerateQuiz 
                ? 'Have a conversation first to generate a quiz'
                : isQuizLoading
                  ? 'Generating quiz...'
                  : 'Generate Quiz'
            }
            aria-label="Generate quiz from conversation"
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
                : 'bg-[var(--color-accent-bg)] text-[var(--color-bg)] hover:bg-[var(--color-accent-bg-hover)] shadow-sm hover:shadow-md'
            }`}
            title={!canSend ? 'Enter a message to send' : 'Send message (Enter)'}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Keyboard shortcut hint */}
      {!disabled && (
        <div className="flex justify-between items-center mt-2 px-1 text-xs text-[var(--color-text-placeholder)]">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded text-xs">Enter</kbd> 
              {' '}to send
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded text-xs">Shift + Enter</kbd> 
              {' '}for new line
            </span>
          </div>
          {attachedFile && (
            <span className="text-blue-400/70">
              File ready to send
            </span>
          )}
        </div>
      )}
    </div>
  );
}
