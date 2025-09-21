import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Smile, Sparkles, Copy, Check, Bookmark, Download, Flag } from 'lucide-react';
import { Message } from '../types';
import { flagMessage } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onSaveAsNote?: (content: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
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
    <div className="relative my-2 text-sm">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="interactive-button p-1.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
          title={'Copy code'}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <SyntaxHighlighter style={vscDarkPlus} language={language} PreTag="div" className="!bg-[#121212] rounded-md !p-4 !pt-8">
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
});

export function MessageBubble({
  message,
  isStreaming = false,
  onSaveAsNote,
}: MessageBubbleProps) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [flagged, setFlagged] = useState(false);
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
      setTimeout(() => setNoteSaved(false), 2500);
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
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const markdownComponents = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <CodeBlock language={match[1]} children={String(children)} />
      ) : (
        <code className="bg-[var(--color-bg)] px-1.5 py-0.5 rounded text-sm" {...props}>{children}</code>
      );
    },
  }), []);

  return (
    <div className={`message-wrapper flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-card)]">
          <Sparkles className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </div>
      )}
      
      <div className="message-bubble relative bg-[var(--color-card)] p-3 sm:p-4 rounded-xl">
        <div className="prose prose-invert prose-base max-w-none leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {isStreaming && <span className="inline-block w-2 h-2 ml-1 bg-white rounded-full animate-pulse" />}
        </div>
        
        {!isStreaming && message.content.length > 0 && (
          <div className="absolute -bottom-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex gap-1 p-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-sm">
              {!isUser && (
                <button onClick={handleSaveNote} className={`btn-icon ${noteSaved ? 'text-blue-400' : ''}`} title="Save as Note"><Bookmark size={14} /></button>
              )}
              <button onClick={handleCopy} className="btn-icon" title="Copy">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
              {!isUser && (
                <button onClick={handleExport} className="btn-icon" title="Export as Markdown"><Download size={14} /></button>
              )}
              <button onClick={handleFlag} disabled={flagged} className={`btn-icon ${flagged ? 'text-yellow-400 cursor-not-allowed' : ''}`} title={flagged ? 'Flagged' : 'Flag for review'}><Flag size={14} /></button>
            </div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-card)]">
          <Smile className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </div>
      )}
    </div>
  );
}
