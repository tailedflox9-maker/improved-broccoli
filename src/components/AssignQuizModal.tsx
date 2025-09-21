import React, { useState } from 'react';
import { X, Share2, Loader2, User, Users } from 'lucide-react';
import { GeneratedQuiz, Profile } from '../../types';
import * as db from '../../services/supabaseService';
import { useAuth } from '../../hooks/useAuth';

interface AssignQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: GeneratedQuiz | null;
  students: Profile[];
}

export function AssignQuizModal({ isOpen, onClose, quiz, students }: AssignQuizModalProps) {
  const { user, profile } = useAuth();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleConfirmAssignment = async () => {
    if (!quiz || selectedStudents.length === 0) return;
    const teacherId = user?.id || profile?.id;
    if (!teacherId) {
        alert("Could not identify the teacher. Please log in again.");
        return;
    }
    
    setIsAssigning(true);
    try {
      await db.assignQuizToStudents(quiz.id, teacherId, selectedStudents, null);
      alert(`Successfully assigned "${quiz.topic}" to ${selectedStudents.length} student(s)!`);
      onClose();
    } catch (error: any) {
      alert(`Failed to assign quiz: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isOpen || !quiz) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content open max-w-2xl w-full bg-[var(--color-card)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 truncate">
            <Share2 size={20}/> Assign Quiz: {quiz.topic}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border)] rounded-full shrink-0 ml-2">
            <X size={18}/>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="input-label mb-3">Select Students ({selectedStudents.length} selected)</label>
            {students.length === 0 ? (
              <div className="text-center p-8 border border-[var(--color-border)] rounded-lg bg-gray-900/20">
                <Users size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-400">No students are assigned to you.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-3 bg-gray-900/20">
                <button type="button" onClick={() => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.id))} className="text-sm text-blue-400 hover:text-blue-300 mb-2">
                  {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
                {students.map(student => (
                  <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-2"/>
                    <div className="flex items-center gap-2"><div className="w-6 h-6 bg-green-900/40 rounded-full flex items-center justify-center"><User className="w-3 h-3 text-green-400" /></div>
                      <div><p className="text-white text-sm font-medium">{student.full_name}</p><p className="text-gray-400 text-xs">{student.email}</p></div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-between items-center">
          <button onClick={onClose} className="btn-secondary px-6 py-2">Cancel</button>
          <button onClick={handleConfirmAssignment} disabled={isAssigning || selectedStudents.length === 0} className="btn-primary px-6 py-2">
            {isAssigning ? (<><Loader2 size={16} className="animate-spin mr-2"/>Assigning...</>) : (`Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
