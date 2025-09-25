import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Smile, Sparkles, Copy, Check, Bookmark, Download, Flag, ExternalLink } from 'lucide-react';
import { Message } from '../types';
import { flagMessage } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onSaveAsNote?: (content: string, title?: string) => Promise<void>;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  searchTerm?: string;
  isHighlighted?: boolean;
}

// Optimized code block component with better UX
const CodeBlock = React.memo(({ 
  language, 
  children, 
  fileName 
}: { 
  language: string; 
  children: string; 
  fileName?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');
  const lineCount = codeContent.split('\n').length;
  const shouldShowCollapse = lineCount > 15;
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }, [codeContent]);

  const displayedCode = isCollapsed ? 
    codeContent.split('\n').slice(0, 10).join('\n') + '\n...' : 
    codeContent;

  return (
    <div className="relative my-4 text-sm rounded-lg overflow-hidden border border-gray-700">
      {/* Header with language and actions */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
            {language || 'text'}
          </span>
          {fileName && (
            <span className="text-xs text-gray-400">
              {fileName}
            </span>
          )}
          {lineCount > 1 && (
            <span className="text-xs text-gray-500">
              {lineCount} lines
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {shouldShowCollapse && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="interactive-button p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
              title={isCollapsed ? "Expand code" : "Collapse code"}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                {isCollapsed ? (
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                )}
              </svg>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="interactive-button p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            title="Copy code"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      
      {/* Code content */}
      <div className="relative">
        <SyntaxHighlighter 
          style={vscDarkPlus} 
          language={language} 
          PreTag="div" 
          className="!bg-[#1e1e1e] !m-0"
          customStyle={{
            padding: '1rem',
            margin: 0,
            background: '#1e1e1e',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          showLineNumbers={lineCount > 5}
          lineNumberStyle={{
            color: '#6b7280',
            fontSize: '0.75rem',
            paddingRight: '1rem',
            userSelect: 'none'
          }}
        >
          {displayedCode}
        </SyntaxHighlighter>
        
        {isCollapsed && shouldShowCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#1e1e1e] to-transparent flex items-end justify-center pb-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
            >
              Show {lineCount - 10} more lines
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// Enhanced link component
const LinkRenderer = ({ href, children }: { href?: string; children: React.ReactNode }) => {
  if (!href) return <span>{children}</span>;
  
  const isExternal = href.startsWith('http') || href.startsWith('https');
  
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-300 underline-offset-2 transition-colors inline-flex items-center gap-1"
    >
      {children}
      {isExternal && <ExternalLink className="w-3 h-3 opacity-70" />}
    </a>
  );
};

// Optimized table component
const TableRenderer = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto my-4">
    <table className="min-w-full divide-y divide-gray-600">
      {children}
    </table>
  </div>
);

// Function to highlight search terms in text (improved)
const highlightSearchTerm = (text: string, searchTerm: string) => {
  if (!searchTerm || !text) return text;
  
  try {
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-400 text-black rounded px-1">$1</mark>');
  } catch (error) {
    console.warn('Error highlighting search term:', error);
    return text;
  }
};

// Message actions component
const MessageActions = React.memo(({ 
  message, 
  onSaveAsNote, 
  onCopy, 
  onExport, 
  onFlag, 
  copied, 
  noteSaved, 
  flagged, 
  isNoteSaving,
  isUser 
}: {
  message: Message;
  onSaveAsNote: () => void;
  onCopy: () => void;
  onExport: () => void;
  onFlag: () => void;
  copied: boolean;
  noteSaved: boolean;
  flagged: boolean;
  isNoteSaving: boolean;
  isUser: boolean;
}) => (
  <div className="absolute -bottom-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
    <div className="flex gap-1 p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg backdrop-blur-sm">
      {!isUser && (
        <button 
          onClick={onSaveAsNote} 
          disabled={isNoteSaving}
          className={`btn-icon transition-all duration-200 ${
            noteSaved 
              ? 'text-blue-400 scale-110' 
              : isNoteSaving 
                ? 'text-gray-500 cursor-not-allowed animate-pulse' 
                : 'text-gray-400 hover:text-blue-400 hover:scale-110'
          }`}
          title={isNoteSaving ? 'Saving...' : noteSaved ? 'Saved!' : 'Save as Note'}
        >
          <Bookmark size={14} className={noteSaved ? 'fill-current' : ''} />
        </button>
      )}
      <button 
        onClick={onCopy} 
        className={`btn-icon transition-all duration-200 ${
          copied 
            ? 'text-green-400 scale-110' 
            : 'text-gray-400 hover:text-green-400 hover:scale-110'
        }`}
        title={copied ? 'Copied!' : 'Copy message'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {!isUser && (
        <button 
          onClick={onExport} 
          className="btn-icon text-gray-400 hover:text-purple-400 hover:scale-110 transition-all duration-200" 
          title="Export as Markdown"
        >
          <Download size={14} />
        </button>
      )}
      <button 
        onClick={onFlag} 
        disabled={flagged} 
        className={`btn-icon transition-all duration-200 ${
          flagged 
            ? 'text-yellow-400 cursor-not-allowed scale-110' 
            : 'text-gray-400 hover:text-yellow-400 hover:scale-110'
        }`}
        title={flagged ? 'Flagged for review' : 'Flag for review'}
      >
        <Flag size={14} className={flagged ? 'fill-current' : ''} />
      </button>
    </div>
  </div>
));

export function MessageBubble({
  message,
  isStreaming = false,
  onSaveAsNote,
  searchTerm,
  isHighlighted = false,
}: MessageBubbleProps) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout>();
  const wasStreaming = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      wasStreaming.current = true;
    }
  }, [isStreaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, [message.content]);
  
  const handleSaveNote = useCallback(async () => {
    if (onSaveAsNote && !isNoteSaving) {
      setIsNoteSaving(true);
      try {
        // Generate a smarter title from the content
        const title = message.content
          .replace(/[#*`_~]/g, '') // Remove markdown
          .split('\n')[0]
          .slice(0, 60)
          .trim() + (message.content.length > 60 ? '...' : '');
        
        await onSaveAsNote(message.content, title || 'Untitled Note');
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 3000);
      } catch (error) {
        console.error('Failed to save note:', error);
        // Show a better error message
        alert('Failed to save note. Please check your connection and try again.');
      } finally {
        setIsNoteSaving(false);
      }
    }
  }, [message.content, onSaveAsNote, isNoteSaving]);

  const handleExport = useCallback(() => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `ai-tutor-response-${timestamp}-${message.id.slice(-6)}.md`;
      
      const blob = new Blob([message.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export message:', error);
    }
  }, [message.content, message.id]);

  const handleFlag = useCallback(async () => {
    if (!user || flagged) return;
    
    const confirmed = window.confirm(
      "Flag this message for teacher review?\n\nThis will help your teacher understand what topics you're working on."
    );
    
    if (confirmed) {
      try {
        const flagPayload = {
          message_content: message.content,
          student_id: message.user_id,
        };
        await flagMessage(flagPayload);
        setFlagged(true);
        
        // Show success message
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-up';
        notification.textContent = 'Message flagged for review';
        document.body.appendChild(notification);
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      } catch (error) {
        console.error("Error flagging message:", error);
        alert("Could not flag message. Please try again later.");
      }
    }
  }, [user, flagged, message.content, message.user_id]);

  useEffect(() => {
    return () => { 
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); 
    };
  }, []);

  // Optimized markdown components with better performance
  const markdownComponents = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && (match || String(children).includes('\n'))) {
        return (
          <CodeBlock 
            language={language} 
            children={String(children)}
            fileName={props['data-filename']}
          />
        );
      }
      
      return (
        <code 
          className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" 
          {...props}
        >
          {children}
        </code>
      );
    },
    
    a: LinkRenderer,
    
    table: TableRenderer,
    
    th: ({ children }: { children: React.ReactNode }) => (
      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider bg-gray-800">
        {children}
      </th>
    ),
    
    td: ({ children }: { children: React.ReactNode }) => (
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 border-b border-gray-700">
        {children}
      </td>
    ),
    
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-blue-500/5 rounded-r">
        <div className="text-gray-300 italic">
          {children}
        </div>
      </blockquote>
    ),
    
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0 pb-2 border-b border-gray-700">
        {children}
      </h1>
    ),
    
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className="text-xl font-semibold text-white mb-3 mt-5 first:mt-0">
        {children}
      </h2>
    ),
    
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className="text-lg font-medium text-white mb-2 mt-4 first:mt-0">
        {children}
      </h3>
    ),
    
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className="list-disc list-inside space-y-1 my-3 ml-4 text-gray-300">
        {children}
      </ul>
    ),
    
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className="list-decimal list-inside space-y-1 my-3 ml-4 text-gray-300">
        {children}
      </ol>
    ),
    
    li: ({ children }: { children: React.ReactNode }) => (
      <li className="text-gray-300 leading-relaxed">
        {children}
      </li>
    ),
    
    p: ({ children }: { children: React.ReactNode }) => (
      <p className="text-gray-300 leading-relaxed my-3 first:mt-0 last:mb-0">
        {children}
      </p>
    ),
  }), []);

  // Enhanced content with search highlighting
  const enhancedContent = useMemo(() => {
    if (!searchTerm) return message.content;
    return highlightSearchTerm(message.content, searchTerm);
  }, [message.content, searchTerm]);

  // Streaming indicator component
  const StreamingIndicator = () => (
    <div className="flex items-center gap-1 mt-2">
      <div className="flex gap-1">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
    </div>
  );

  return (
    <div 
      className={`message-wrapper flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} group transition-all duration-200 ${
        isHighlighted ? 'bg-yellow-400/10 rounded-lg p-3 -m-3 shadow-lg ring-1 ring-yellow-400/20' : ''
      } ${isStreaming ? 'is-streaming' : ''} ${wasStreaming.current ? 'was-streaming' : ''}`}
      id={`message-${message.id}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
      )}
      
      <div className="message-bubble relative bg-[var(--color-card)] p-3 sm:p-4 rounded-xl border border-[var(--color-border)] shadow-sm hover:shadow-md transition-all duration-200">
        <div className="prose prose-invert prose-base max-w-none">
          {searchTerm ? (
            <div 
              dangerouslySetInnerHTML={{ __html: enhancedContent }}
              className="leading-relaxed" 
            />
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              components={markdownComponents}
              className="leading-relaxed"
            >
              {message.content}
            </ReactMarkdown>
          )}
          
          {isStreaming && (
            <StreamingIndicator />
          )}
        </div>
        
        {!isStreaming && message.content.length > 0 && (
          <MessageActions
            message={message}
            onSaveAsNote={handleSaveNote}
            onCopy={handleCopy}
            onExport={handleExport}
            onFlag={handleFlag}
            copied={copied}
            noteSaved={noteSaved}
            flagged={flagged}
            isNoteSaving={isNoteSaving}
            isUser={isUser}
          />
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30">
          <Smile className="w-4 h-4 text-green-400" />
        </div>
      )}
    </div>
  );
}
