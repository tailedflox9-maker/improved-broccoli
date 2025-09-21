import React from 'react';
import { X, Eye, Award, CheckCircle } from 'lucide-react';
import { GeneratedQuiz } from '../../types';
import { formatDate } from '../../utils/helpers';

interface ReviewQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: GeneratedQuiz | null;
}

export function ReviewQuizModal({ isOpen, onClose, quiz }: ReviewQuizModalProps) {
  if (!isOpen || !quiz) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content open max-w-4xl w-full bg-[var(--color-card)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 truncate">
            <Eye size={20}/> Review Quiz: {quiz.topic}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border)] rounded-full shrink-0 ml-2">
            <X size={18}/>
          </button>
        </div>
        <div className="p-6">
          <div className="mb-6 flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1"><Award size={16}/> {quiz.questions.length} Questions</span>
            <span>Created: {formatDate(new Date(quiz.created_at))}</span>
          </div>
          <div className="space-y-6">
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="bg-gray-900/20 border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm shrink-0 mt-1">{index + 1}</div>
                  <h4 className="text-white font-semibold text-base leading-relaxed">{question.question}</h4>
                </div>
                <div className="ml-9 space-y-2">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className={`p-2 rounded-lg text-sm ${question.correctAnswer === optIndex ? 'bg-green-900/30 border border-green-500/50 text-green-300' : 'bg-gray-800/50 text-gray-300'}`}>
                      <span className="font-medium mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                      {option}
                      {question.correctAnswer === optIndex && (<CheckCircle size={16} className="inline ml-2 text-green-400" />)}
                    </div>
                  ))}
                  {question.explanation && (
                    <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <p className="text-xs text-yellow-200"><strong>Explanation:</strong> {question.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="btn-secondary px-6 py-2">Close Review</button>
        </div>
      </div>
    </div>
  );
}
