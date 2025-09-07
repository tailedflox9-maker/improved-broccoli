import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, XCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { StudySession } from '../types';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySession | null;
}

export function QuizModal({ isOpen, onClose, session }: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const currentQuestion = session?.questions[currentQuestionIndex];

  // Reset state when a new session is passed or the modal is closed
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setUserAnswers({});
      setShowFeedback(false);
      setQuizCompleted(false);
    }
  }, [isOpen, session]);

  const handleAnswerSelect = (option: string) => {
    if (showFeedback) return;
    setSelectedAnswer(option);
    setUserAnswers(prev => ({ ...prev, [currentQuestion!.id]: option }));
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    if (session && currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const score = useMemo(() => {
    if (!session) return 0;
    return session.questions.reduce((acc, question, index) => {
      const correctAnswer = question.options[question.correctAnswer];
      return userAnswers[question.id] === correctAnswer ? acc + 1 : acc;
    }, 0);
  }, [quizCompleted, session, userAnswers]);

  const scorePercentage = useMemo(() => {
    if (!session || session.questions.length === 0) return 0;
    return (score / session.questions.length) * 100;
  }, [score, session]);

  const getScoreFeedback = useMemo(() => {
    if (scorePercentage === 100) return "Perfect Score! You're a master!";
    if (scorePercentage >= 75) return "Great job! You know your stuff.";
    if (scorePercentage >= 50) return "Good effort! A little more review might help.";
    return "Keep studying! You'll get it next time.";
  }, [scorePercentage]);

  if (!isOpen || !session) return null;

  const progress = ((currentQuestionIndex + 1) / session.questions.length) * 100;

  const renderQuizContent = () => {
    if (!currentQuestion) return null;
    return (
      <div className="animate-fadeIn">
        <p className="mb-4 text-center">
          <span className="bg-[var(--color-card)] px-3 py-1 rounded-full text-sm font-semibold text-[var(--color-text-secondary)]">
            Question {currentQuestionIndex + 1} / {session.questions.length}
          </span>
        </p>
        <h3 className="text-xl md:text-2xl font-bold text-center text-[var(--color-text-primary)] mb-8 leading-tight">
          {currentQuestion.question}
        </h3>

        <div className="space-y-3">
          {currentQuestion.options?.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = currentQuestion.correctAnswer === index;
            let buttonClass = 'bg-[var(--color-card)] border-transparent hover:bg-[var(--color-border)]';

            if (showFeedback) {
              if (isCorrectAnswer) {
                buttonClass = 'bg-green-900/50 border-green-500/60 text-green-300';
              } else if (isSelected && !isCorrectAnswer) {
                buttonClass = 'bg-red-900/50 border-red-500/60 text-red-300';
              } else {
                 buttonClass = 'bg-[var(--color-card)] border-transparent opacity-60';
              }
            }
            return (
              <button
                key={option}
                onClick={() => handleAnswerSelect(option)}
                disabled={showFeedback}
                className={`w-full text-left p-4 border rounded-lg transition-all duration-200 text-base font-semibold flex items-center justify-between disabled:cursor-not-allowed group ${buttonClass}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold ${showFeedback && isCorrectAnswer ? 'bg-green-500/80 text-white' : 'bg-[var(--color-border)] group-hover:bg-white/10'}`}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span>{option}</span>
                </div>
                {showFeedback && isCorrectAnswer && <CheckCircle className="w-5 h-5 text-green-400" />}
                {showFeedback && isSelected && !isCorrectAnswer && <XCircle className="w-5 h-5 text-red-400" />}
              </button>
            );
          })}
        </div>

        {showFeedback && currentQuestion.explanation && (
          <div className="mt-8 p-4 rounded-lg bg-[var(--color-bg)] animate-fade-in-up border border-[var(--color-border)] flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-text-secondary)]">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  const renderCompletedContent = () => (
    <div className="text-center flex flex-col items-center justify-center h-full p-4 sm:p-8 animate-fadeIn">
      <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
      <h3 className="text-2xl font-bold mb-2">
        Quiz Completed!
      </h3>
      <p className="text-base text-[var(--color-text-secondary)] mb-6">{getScoreFeedback}</p>
      <p className="text-6xl font-bold text-[var(--color-accent-bg)] mb-2">
        {score} <span className="text-3xl text-[var(--color-text-secondary)]">/ {session.questions.length}</span>
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col animate-fade-in-up overflow-hidden max-h-[90vh] max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-title"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full bg-[var(--color-card)] h-1.5">
          <div
            className="bg-[var(--color-accent-bg)] h-1.5 rounded-r-full transition-all duration-300 ease-out"
            style={{ width: `${quizCompleted ? 100 : progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[var(--color-border)]">
          <h2 id="quiz-title" className="text-lg font-bold">
            Study Quiz
          </h2>
          <button onClick={onClose} className="interactive-button w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-card)] transition-colors" aria-label="Close quiz">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto">
          {quizCompleted ? renderCompletedContent() : renderQuizContent()}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 mt-auto">
          {quizCompleted ? (
            <button onClick={onClose} className="w-full sm:w-auto interactive-button px-6 py-2.5 rounded-lg font-bold bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-bg-hover)]">
              Finish
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              disabled={!showFeedback}
              className="w-full sm:w-auto interactive-button px-6 py-2.5 rounded-lg font-bold bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
