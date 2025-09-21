import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StudentAssignmentDetails } from '../types';
import { formatDate } from '../utils/helpers';
import * as db from '../services/supabaseService';
import { Award, Clock, FileText, Loader2, Send } from 'lucide-react';

interface AssignmentViewProps {
  assignmentDetails: StudentAssignmentDetails;
  onSubmitted: () => void;
}

export function AssignmentView({ assignmentDetails, onSubmitted }: AssignmentViewProps) {
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionContent.trim()) {
      setError('Your submission cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await db.submitAssignment(assignmentDetails.id, submissionContent);
      onSubmitted(); // This tells ChatPage to refresh the assignments list
    } catch (err: any) {
      setError('Failed to submit: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = () => {
    switch (assignmentDetails.status) {
      case 'pending': return { text: 'Pending Submission', icon: <Clock className="text-yellow-400" size={18} />, color: 'text-yellow-400' };
      case 'submitted': return { text: 'Submitted, Awaiting Grade', icon: <Send className="text-blue-400" size={18} />, color: 'text-blue-400' };
      case 'graded': return { text: 'Graded', icon: <Award className="text-green-400" size={18} />, color: 'text-green-400' };
    }
  };
  
  const statusInfo = getStatusInfo();

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg)] overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center border border-blue-500/30">
              <FileText className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{assignmentDetails.assignments.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
            <span className={`flex items-center gap-2 font-semibold ${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.text}
            </span>
            {assignmentDetails.assignments.due_at && <span>Due: {formatDate(new Date(assignmentDetails.assignments.due_at))}</span>}
            {assignmentDetails.status === 'graded' && assignmentDetails.grade !== null && 
              <span className="font-bold text-lg text-white">Grade: {assignmentDetails.grade}/100</span>}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8 p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
          <h2 className="font-semibold text-lg text-white mb-2">Assignment Prompt</h2>
          <div className="prose prose-invert max-w-none text-gray-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{assignmentDetails.assignments.description}</ReactMarkdown>
          </div>
        </div>

        {/* Content Area */}
        {assignmentDetails.status === 'pending' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-semibold text-lg text-white">Your Submission</h2>
            <textarea
              value={submissionContent}
              onChange={(e) => setSubmissionContent(e.target.value)}
              placeholder="Type your response here..."
              className="w-full h-64 p-3 bg-gray-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-y"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="btn-primary px-6 py-2.5">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2" size={16}/> Submitting...</> : <>Submit Assignment</>}
            </button>
          </form>
        )}
        
        {assignmentDetails.status === 'submitted' && (
          <div>
            <h2 className="font-semibold text-lg text-white mb-2">Your Submission</h2>
            <div className="p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
              <pre className="text-gray-200 whitespace-pre-wrap">{assignmentDetails.submission_content}</pre>
            </div>
          </div>
        )}

        {assignmentDetails.status === 'graded' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-lg text-white mb-2">Your Submission</h2>
              <div className="p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
                <pre className="text-gray-200 whitespace-pre-wrap">{assignmentDetails.submission_content}</pre>
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white mb-2">Teacher's Feedback</h2>
              <div className="p-4 bg-green-900/10 border border-green-500/20 rounded-lg prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{assignmentDetails.feedback}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
