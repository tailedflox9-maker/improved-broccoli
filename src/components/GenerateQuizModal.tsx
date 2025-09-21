import React, { useState } from 'react';
import { X, ClipboardCheck, Loader2 } from 'lucide-react';
import { aiService } from '../../services/aiService';

interface GenerateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizGenerated: (newQuiz: any) => void;
}

export function GenerateQuizModal({ isOpen, onClose, onQuizGenerated }: GenerateQuizModalProps) {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a topic for the quiz.");
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      const newQuiz = await aiService.generateQuizFromTopic(topic, numQuestions, difficulty);
      onQuizGenerated(newQuiz);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unknown error occurred during quiz generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content open max-w-lg w-full bg-[var(--color-card)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck size={20}/> Generate Quiz
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border)] rounded-full">
            <X size={18}/>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="input-label">Quiz Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., 'Photosynthesis'" required className="input-style"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Number of Questions</label>
                <input type="number" value={numQuestions} onChange={e => setNumQuestions(Math.max(3, Math.min(10, parseInt(e.target.value) || 3)))} min="3" max="10" required className="input-style"/>
              </div>
              <div>
                <label className="input-label">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input-style">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
            <button type="submit" disabled={isGenerating} className="btn-primary w-auto px-6 py-2">
              {isGenerating ? (<><Loader2 size={16} className="animate-spin mr-2"/>Generating...</>) : ('Generate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
