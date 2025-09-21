import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Smile, Sparkles, Copy, Check, Bookmark, Download, Flag, User, Bot } from 'lucide-react';
import { Message } from '../types';
import { flagMessage } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onSaveAsNote?: (content: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  isFirst?: boolean;
}

const CodeBlock = React.memo(({ language, children }: { language: string; children: string; }) => {
  const [copied, setCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeContent]);

  return (
    <div className="relative my-3 text-sm">
      <div className="absolute right-3 top-3 z-10">
        <button
          onClick={handleCopy}
          className="interactive-button p-1.5 bg-gray-800/90 backdrop-blur-sm rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors shadow-lg"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <SyntaxHighlighter 
        style={vscDarkPlus} 
        language={language} 
        PreTag="div" 
        className="!bg-[#0d1117] !border !border-gray-800 rounded-lg !p-4 !pt-10 shadow-inner"
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
});

export function MessageBubble({
  message,
  isStreaming = false,
  onSaveAsNote,
  isFirst = false,
}: MessageBubbleProps) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [message.content]);
  
  const handleSaveNote = useCallback(() => {
    if (onSaveAsNote) {
      onSaveAsNote(message.content);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    }
  }, [message.content, onSaveAsNote]);

  const handleExport = useCallback(() => {
    const blob = new Blob([message.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-tutor-response-${message.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [message.content, message.id]);

  const handleFlag = async () => {
    if (!user || flagged) return;
    if (window.confirm("Are you sure you want to flag this message for teacher review?")) {
        try {
            await flagMessage({
                message_content: message.content,
                message_role: message.role,
                conversation_id: message.conversation_id,
                flagged_by_user_id: user.id,
                student_id: message.user_id,
            });
            setFlagged(true);
            alert("Message flagged for review.");
        } catch (error) {
            console.error("Error flagging message:", error);
            alert("Could not flag message.");
        }
    }
  };

  useEffect(() => {
    return () => { 
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); 
    };
  }, []);

  const markdownComponents = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <CodeBlock language={match[1]} children={String(children)} />
      ) : (
        <code className="bg-gray-800/50 px-2 py-0.5 rounded-md text-sm font-mono border border-gray-700/50" {...props}>
          {children}
        </code>
      );
    },
    p: ({ children }: any) => (
      <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="mb-3 space-y-1 pl-4">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="mb-3 space-y-1 pl-4">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-relaxed">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-blue-500/50 pl-4 py-2 my-3 bg-blue-500/5 rounded-r-lg italic text-gray-300">
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-white border-b border-gray-700 pb-2">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-white">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-gray-200">{children}</h3>
    ),
    table: ({ children }: any) => (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full border border-gray-700 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="bg-gray-800 border-b border-gray-700 px-3 py-2 text-left font-semibold text-gray-200">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border-b border-gray-700/50 px-3 py-2 text-gray-300">
        {children}
      </td>
    ),
  }), []);

  return (
    <div className={`message-wrapper flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} group relative`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 shadow-lg">
          <Bot className="w-4 h-4 text-blue-400" />
        </div>
      )}
      
      <div className={`message-bubble relative backdrop-blur-sm border shadow-lg ${
        isUser 
          ? 'bg-gradient-to-br from-blue-600/90 to-purple-600/90 border-blue-500/30 text-white' 
          : 'bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border-white/10'
      } p-4 sm:p-5 rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      >
        {/* Enhanced content styling */}
        <div className={`prose prose-invert prose-base max-w-none ${
          isUser ? 'prose-blue' : ''
        }`}>
          {isUser ? (
            <p className="leading-relaxed font-medium">{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )}
          
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-flex items-center ml-1">
              <span className="w-2 h-5 bg-blue-400 rounded-sm animate-pulse" />
            </span>
          )}
        </div>
        
        {/* Enhanced action buttons */}
        {!isStreaming && message.content.length > 0 && (
          <div className={`absolute -bottom-2 ${isUser ? '-left-2' : '-right-2'} transition-all duration-200 ${
            showActions ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-1'
          }`}>
            <div className="flex gap-1 p-1.5 bg-[var(--color-sidebar)]/95 backdrop-blur-sm border border-[var(--color-border)] rounded-lg shadow-lg">
              {!isUser && (
                <button 
                  onClick={handleSaveNote} 
                  className={`btn-icon transition-colors ${noteSaved ? 'text-green-400 bg-green-400/10' : 'hover:text-blue-400 hover:bg-blue-400/10'}`} 
                  title="Save as Note"
                >
                  <Bookmark size={14} />
                </button>
              )}
              
              <button 
                onClick={handleCopy} 
                className={`btn-icon transition-colors ${copied ? 'text-green-400 bg-green-400/10' : 'hover:text-gray-300 hover:bg-gray-300/10'}`} 
                title="Copy message"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              
              {!isUser && (
                <button 
                  onClick={handleExport} 
                  className="btn-icon hover:text-purple-400 hover:bg-purple-400/10 transition-colors" 
                  title="Export as Markdown"
                >
                  <Download size={14} />
                </button>
              )}
              
              <button 
                onClick={handleFlag} 
                disabled={flagged} 
                className={`btn-icon transition-colors ${
                  flagged ? 'text-yellow-400 cursor-not-allowed bg-yellow-400/10' : 'hover:text-red-400 hover:bg-red-400/10'
                }`} 
                title={flagged ? 'Flagged for review' : 'Flag for review'}
              >
                <Flag size={14} />
              </button>
            </div>
          </div>
        )}
        
        {/* Message timestamp */}
        {isFirst && (
          <div className={`text-xs opacity-60 mt-2 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
            {new Date(message.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 shadow-lg">
          <User className="w-4 h-4 text-blue-400" />
        </div>
      )}
    </div>
  );
}
