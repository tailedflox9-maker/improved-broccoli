import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { Profile, FlaggedMessage, GeneratedQuiz, Assignment, StudentAssignmentDetails } from '../types'; // <-- UPDATED
import { 
  BookOpen, MessageSquare, CheckCircle, Users, GraduationCap, TrendingUp, RefreshCw, AlertTriangle, User, Flag, ClipboardCheck, PlusCircle, X, Loader2, Share2, Eye, Trash2, Award, FileText, Send, Edit, Sparkles, UserCheck
} from 'lucide-react';
import { formatDate } from '../utils/helpers';
import ReactMarkdown from 'react-markdown'; // <-- NEW
import remarkGfm from 'remark-gfm'; // <-- NEW

// ... (Keep StudentStats and StudentWithStats interfaces)
interface StudentStats {
  questionCount: number;
  quizAttempts: number;
  averageScore: number;
}

interface StudentWithStats extends Profile {
  stats: StudentStats;
}

export function TeacherDashboardComponent() {
  const { user, profile } = useAuth();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([]);
  const [generatedQuizzes, setGeneratedQuizzes] = useState<GeneratedQuiz[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]); // <-- NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz Modal State (Existing)
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  
  // Assignment Modal State (Existing)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<GeneratedQuiz | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Quiz Review Modal State (Existing)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewQuiz, setReviewQuiz] = useState<GeneratedQuiz | null>(null);

  // NEW MODAL STATES FOR ASSIGNMENTS
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<StudentAssignmentDetails[]>([]);

  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<StudentAssignmentDetails | null>(null);
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState<number | ''>('');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);


  const fetchData = async () => {
    const userId = user?.id || profile?.id;
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [assignedStudents, messages, quizzes, teacherAssignments] = await Promise.all([
        db.getStudentsForTeacher(userId),
        db.getFlaggedMessagesForTeacher(userId),
        db.getGeneratedQuizzesForTeacher(userId),
        db.getAssignmentsForTeacher(userId) // <-- NEW
      ]);

      const studentsWithStats = await Promise.all(
        assignedStudents.map(async (student) => {
          const stats = await db.getStudentStatsImproved(student.id);
          return { ...student, stats };
        })
      );
      
      setStudents(studentsWithStats);
      setFlaggedMessages(messages);
      setGeneratedQuizzes(quizzes);
      setAssignments(teacherAssignments); // <-- NEW

    } catch (error: any) {
      setError(error.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || profile?.id) {
      fetchData();
    }
  }, [user?.id, profile?.id]);

  // ... (Keep all existing handlers for quizzes: handleGenerateQuiz, handleAssignQuiz, etc.)
  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim()) {
      setQuizError("Please enter a topic for the quiz.");
      return;
    }
    
    setIsGeneratingQuiz(true);
    setQuizError('');
    
    try {
      const newQuiz = await aiService.generateQuizFromTopic(quizTopic);
      setGeneratedQuizzes(prev => [newQuiz, ...prev]);
      setIsQuizModalOpen(false);
      setQuizTopic('');
      setQuizError('');
    } catch (error: any) {
      console.error('Quiz generation error:', error);
      setQuizError(error.message || "An unknown error occurred.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAssignQuiz = (quiz: GeneratedQuiz) => {
    setSelectedQuiz(quiz);
    setSelectedStudents([]);
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedQuiz || selectedStudents.length === 0) {
      alert('Please select at least one student to assign the quiz to.');
      return;
    }

    if (!user?.id && !profile?.id) {
      alert('Unable to identify teacher. Please try logging in again.');
      return;
    }

    const teacherId = user?.id || profile?.id!;
    
    setIsAssigning(true);
    try {
      await db.assignQuizToStudents(
        selectedQuiz.id,
        teacherId,
        selectedStudents,
        null // Removed deadline
      );
      
      alert(`Successfully assigned "${selectedQuiz.topic}" to ${selectedStudents.length} student(s)!`);
      setIsAssignModalOpen(false);
      setSelectedQuiz(null);
      setSelectedStudents([]);
      // Refresh data to update assignment counts
      await fetchData();
    } catch (error: any) {
      console.error('Assignment error:', error);
      alert(`Failed to assign quiz: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReviewQuiz = (quiz: GeneratedQuiz) => {
    setReviewQuiz(quiz);
    setIsReviewModalOpen(true);
  };

  const handleDeleteQuiz = async (quiz: GeneratedQuiz) => {
    if (!confirm(`Are you sure you want to delete the quiz "${quiz.topic}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await db.deleteGeneratedQuiz(quiz.id);
      setGeneratedQuizzes(prev => prev.filter(q => q.id !== quiz.id));
      alert('Quiz deleted successfully!');
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete quiz: ${error.message}`);
    }
  };
  
  // NEW HANDLERS FOR ASSIGNMENTS
  const handleOpenAssignmentModal = () => {
    setAssignmentTitle('');
    setAssignmentDesc('');
    setSelectedStudents([]);
    setIsAssignmentModalOpen(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim() || !assignmentDesc.trim() || selectedStudents.length === 0) {
        alert("Title, description, and at least one student are required.");
        return;
    }
    const teacherId = user?.id || profile?.id;
    if (!teacherId) return;

    setIsAssigning(true);
    try {
        await db.createAssignment({
            teacher_id: teacherId,
            title: assignmentTitle,
            description: assignmentDesc,
            type: 'essay',
            due_at: null,
            quiz_id: null
        }, selectedStudents);
        
        setIsAssignmentModalOpen(false);
        await fetchData(); // Refresh data
    } catch (err: any) {
        alert("Failed to create assignment: " + err.message);
    } finally {
        setIsAssigning(false);
    }
  };
  
  const handleViewSubmissions = async (assignment: Assignment) => {
    setViewingAssignment(assignment);
    setIsSubmissionsModalOpen(true);
    setSubmissions([]); // Clear previous
    const subs = await db.getSubmissionsForAssignment(assignment.id);
    setSubmissions(subs);
  };

  const handleGradeSubmission = (submission: StudentAssignmentDetails) => {
    setGradingSubmission(submission);
    setFeedback(submission.feedback || '');
    setGrade(submission.grade || '');
    setIsGradingModalOpen(true);
  };

  const handleGetAIFeedback = async () => {
    if (!gradingSubmission || !viewingAssignment) return;
    setIsGeneratingFeedback(true);
    try {
      const aiFeedback = await aiService.provideFeedbackOnSubmission(viewingAssignment, gradingSubmission);
      setFeedback(aiFeedback);
    } catch (err: any) {
      alert("Failed to get AI feedback: " + err.message);
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission || grade === '' || feedback.trim() === '') {
        alert("Feedback and a numeric grade are required.");
        return;
    }
    
    try {
      await db.gradeAssignment(gradingSubmission.id, feedback, Number(grade));
      setIsGradingModalOpen(false);
      // Refresh submissions in the background
      if (viewingAssignment) {
        const subs = await db.getSubmissionsForAssignment(viewingAssignment.id);
        setSubmissions(subs);
      }
    } catch (err: any) {
      alert("Failed to save grade: " + err.message);
    }
  };


  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const totals = useMemo(() => ({
    questions: students.reduce((acc, s) => acc + s.stats.questionCount, 0),
    quizzes: students.reduce((acc, s) => acc + s.stats.quizAttempts, 0),
    average: students.length > 0 ? students.reduce((acc, s) => acc + s.stats.averageScore, 0) / students.length : 0,
  }), [students]);

  const ProgressBar = ({ score }: { score: number }) => (
    // ... (Keep ProgressBar component as is)
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-blue-300">Avg. Score</span>
        <span className="text-xs font-bold text-white">{score.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700/50 rounded-full h-1.5">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );

  if (!user && !profile) {
    return ( /* ... existing loading state ... */ );
  }

  return (
    <>
    <div className="h-full overflow-y-auto bg-grid-slate-900">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header and Overview Stats (keep as is) */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GraduationCap size={28} className="text-blue-500" /> 
            Teacher Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor progress, review content, and create learning materials.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
           {/* ... stats cards ... */}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="admin-card">
              <h3 className="card-header"><ClipboardCheck size={18} /> Class Tools</h3>
              <div className="p-6 space-y-3">
                <button onClick={() => setIsQuizModalOpen(true)} className="btn-primary w-full"><PlusCircle size={16} /> Generate Quiz</button>
                <button onClick={handleOpenAssignmentModal} className="btn-primary w-full bg-white/5 text-white hover:bg-white/10 border border-white/10"><FileText size={16} /> Create Assignment</button>
              </div>
            </div>
            
            {/* Assignments Card - NEW */}
            <div className="admin-card">
              <h3 className="card-header">Assignments ({assignments.length})</h3>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {assignments.length > 0 ? (
                  assignments.map(ass => (
                    <div key={ass.id} className="bg-gray-900/50 p-3 rounded-lg">
                      <p className="font-semibold text-white truncate">{ass.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{ass.type} &bull; {formatDate(new Date(ass.created_at))}</p>
                      <button onClick={() => handleViewSubmissions(ass)} className="w-full mt-3 text-sm btn-secondary py-1.5">
                        <UserCheck size={14}/> View Submissions
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No assignments created yet.</p>
                )}
              </div>
            </div>
            
            {/* Generated Quizzes Card (keep as is) */}
            <div className="admin-card">{/* ... */}</div>

          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* Flagged Messages (keep as is) */}
            <div className="admin-card">{/* ... */}</div>
            {/* Student Progress (keep as is) */}
            <div className="admin-card">{/* ... */}</div>
          </div>
        </div>
      </div>
    </div>
    
    {/* All existing modals (Quiz Generation, Quiz Assignment, Quiz Review) stay here */}
    
    {/* Create Assignment Modal - NEW */}
    {isAssignmentModalOpen && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsAssignmentModalOpen(false)}>
        <form onSubmit={handleCreateAssignment} className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText size={20}/> Create New Assignment</h2>
            <button type="button" onClick={() => setIsAssignmentModalOpen(false)} className="p-2 hover:bg-[var(--color-border)] rounded-lg"><X size={18}/></button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="input-label">Title</label>
              <input type="text" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="e.g., Essay on The Great Gatsby" required className="input-style"/>
            </div>
            <div>
              <label className="input-label">Description / Prompt</label>
              <textarea value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)} placeholder="Provide clear instructions for the student." required className="input-style" rows={4}/>
            </div>
            <div>
              <label className="input-label">Assign to Students ({selectedStudents.length} selected)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-3 bg-gray-900/20">
                <button type="button" onClick={() => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.id))} className="text-sm text-blue-400 hover:text-blue-300 mb-2">
                  {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
                {students.map(student => (
                  <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-2"/>
                    <p className="text-white text-sm font-medium">{student.full_name}</p>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
            <button type="submit" disabled={isAssigning} className="btn-primary w-auto px-6 py-2">
              {isAssigning ? <><Loader2 size={16} className="animate-spin mr-2"/> Creating...</> : 'Create & Assign'}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* View Submissions Modal - NEW */}
    {isSubmissionsModalOpen && viewingAssignment && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsSubmissionsModalOpen(false)}>
        <div className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><UserCheck size={20}/> Submissions for: {viewingAssignment.title}</h2>
            <button onClick={() => setIsSubmissionsModalOpen(false)} className="p-2 hover:bg-[var(--color-border)] rounded-lg"><X size={18}/></button>
          </div>
          <div className="p-6 overflow-y-auto">
            <div className="divide-y divide-[var(--color-border)]">
              {submissions.map(sub => (
                <div key={sub.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">{sub.profiles?.full_name || sub.profiles?.email}</p>
                    <p className={`text-sm capitalize font-medium ${sub.status === 'graded' ? 'text-green-400' : sub.status === 'submitted' ? 'text-blue-400' : 'text-yellow-400'}`}>Status: {sub.status}</p>
                    {sub.submitted_at && <p className="text-xs text-gray-500">Submitted: {formatDate(new Date(sub.submitted_at))}</p>}
                  </div>
                  <div>
                    {sub.status === 'submitted' || sub.status === 'graded' ? (
                      <button onClick={() => handleGradeSubmission(sub)} className="btn-secondary"><Edit size={14}/> {sub.status === 'graded' ? 'View/Edit Grade' : 'Grade'}</button>
                    ) : (
                      <span className="text-sm text-gray-500">Not Submitted</span>
                    )}
                  </div>
                </div>
              ))}
              {submissions.length === 0 && <p className="text-center py-8 text-gray-500">No submissions yet.</p>}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Grading Modal - NEW */}
    {isGradingModalOpen && gradingSubmission && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsGradingModalOpen(false)}>
        <div className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white">Grading: {gradingSubmission.profiles?.full_name}</h2>
            <p className="text-sm text-gray-400">Assignment: {viewingAssignment?.title}</p>
          </div>
          <div className="flex-1 flex gap-4 p-6 overflow-hidden">
            <div className="w-1/2 flex flex-col">
              <h3 className="font-semibold mb-2">Student Submission</h3>
              <div className="flex-1 p-4 bg-gray-900/50 rounded-lg overflow-y-auto border border-[var(--color-border)]">
                <pre className="text-white whitespace-pre-wrap text-sm">{gradingSubmission.submission_content}</pre>
              </div>
            </div>
            <div className="w-1/2 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Feedback</h3>
                <button onClick={handleGetAIFeedback} disabled={isGeneratingFeedback} className="btn-secondary">
                  {isGeneratingFeedback ? <><Loader2 size={14} className="animate-spin mr-1.5"/> Working...</> : <><Sparkles size={14} className="mr-1.5"/> Get AI Feedback</>}
                </button>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Enter feedback..." className="input-style flex-1 resize-none"/>
                <div>
                  <label className="input-label">Grade (0-100)</label>
                  <input type="number" value={grade} onChange={e => setGrade(e.target.value === '' ? '' : Math.max(0, Math.min(100, parseInt(e.target.value))))} className="input-style"/>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-between items-center">
            <button onClick={() => setIsGradingModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveGrade} className="btn-primary">Save Grade & Feedback</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
