import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { Profile, FlaggedMessage, GeneratedQuiz, Assignment, StudentAssignmentDetails } from '../types';
import { 
  BookOpen, MessageSquare, CheckCircle, Users, GraduationCap, TrendingUp, RefreshCw, AlertTriangle, User, Flag, ClipboardCheck, PlusCircle, X, Loader2, Share2, Eye, Trash2, Award, FileText, Send, Edit, Sparkles, UserCheck
} from 'lucide-react';
import { formatDate } from '../utils/helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quiz Modal State
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  
  // Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<GeneratedQuiz | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Quiz Review Modal State
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
        db.getAssignmentsForTeacher(userId)
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
      setAssignments(teacherAssignments);

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

  // ================== FIX START ==================
  if (!user && !profile) {
    return (
      <div className="h-full overflow-y-auto bg-grid-slate-900 flex items-center justify-center">
        <div className="text-center p-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-400 mt-2">Loading user data...</p>
        </div>
      </div>
    );
  }
  // =================== FIX END ===================

  return (
    <>
    <div className="h-full overflow-y-auto bg-grid-slate-900">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GraduationCap size={28} className="text-blue-500" /> 
            Teacher Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor progress, review content, and create learning materials.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-500 mt-2">
              User ID: {user?.id || profile?.id} | Students: {students.length} | Messages: {flaggedMessages.length} | Quizzes: {generatedQuizzes.length}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="stats-card">
            <Users size={24} className="text-blue-500 mb-3"/>
            <p className="text-3xl font-bold">{students.length}</p>
            <p className="text-gray-400">Total Students</p>
          </div>
          <div className="stats-card">
            <MessageSquare size={24} className="text-green-500 mb-3"/>
            <p className="text-3xl font-bold">{totals.questions}</p>
            <p className="text-gray-400">Questions Asked</p>
          </div>
          <div className="stats-card">
            <BookOpen size={24} className="text-purple-400 mb-3"/>
            <p className="text-3xl font-bold">{totals.quizzes}</p>
            <p className="text-gray-400">Quizzes Completed</p>
          </div>
          <div className="stats-card">
            <TrendingUp size={24} className="text-yellow-400 mb-3"/>
            <p className="text-3xl font-bold">{totals.average.toFixed(1)}%</p>
            <p className="text-gray-400">Class Average</p>
          </div>
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
            
            <div className="admin-card">
              <h3 className="card-header">Generated Quizzes ({generatedQuizzes.length})</h3>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {generatedQuizzes.length > 0 ? (
                  generatedQuizzes.map(quiz => (
                    <div key={quiz.id} className="bg-gray-900/50 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{quiz.topic}</p>
                          <p className="text-xs text-gray-400">{quiz.questions.length} Questions</p>
                          <p className="text-xs text-gray-500">Created: {formatDate(new Date(quiz.created_at))}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => handleReviewQuiz(quiz)}
                          className="flex-1 text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-900/70"
                        >
                          <Eye size={12} className="inline mr-1"/> Review
                        </button>
                        <button 
                          onClick={() => handleAssignQuiz(quiz)}
                          className="flex-1 text-xs px-2 py-1 bg-green-900/50 text-green-300 rounded hover:bg-green-900/70"
                          disabled={students.length === 0}
                        >
                          <Share2 size={12} className="inline mr-1"/> Assign
                        </button>
                        <button 
                          onClick={() => handleDeleteQuiz(quiz)}
                          className="flex-1 text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-900/70"
                        >
                          <Trash2 size={12} className="inline mr-1"/> Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No quizzes generated yet. Click "Generate New Quiz" to create one.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="admin-card">
              <div className="card-header flex justify-between items-center">
                <h3 className="flex items-center gap-3">
                  <Flag size={18} className="text-yellow-400" /> 
                  Flagged Messages for Review
                </h3>
                <span className="text-sm font-bold bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full">
                  {flaggedMessages.length}
                </span>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {flaggedMessages.length > 0 ? (
                  <ul className="space-y-3">
                    {flaggedMessages.map(msg => (
                      <li key={msg.id} className="bg-gray-900/50 p-3 rounded-lg text-sm">
                        <p className="text-gray-300 line-clamp-2">"{msg.message_content}"</p>
                        <div className="text-xs text-gray-500 mt-2 flex justify-between">
                          <span>From: <span className="font-semibold text-gray-400">{msg.student_name}</span></span>
                          <span>{formatDate(new Date(msg.created_at))}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center py-8 text-gray-500">
                    No messages have been flagged for review.
                  </p>
                )}
              </div>
            </div>
            
            <div className="admin-card">
              <div className="card-header flex justify-between items-center">
                <h3 className="flex items-center gap-3">
                  <User size={18}/> Student Progress
                </h3>
                <button 
                  onClick={fetchData} 
                  disabled={loading} 
                  className="btn-secondary"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
                  Refresh
                </button>
              </div>
              
              {loading && (
                <div className="text-center p-12">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  <p className="text-gray-400 mt-2">Loading students...</p>
                </div>
              )}
              
              {error && (
                <div className="text-center p-12">
                  <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                  <p className="text-red-400 font-semibold mt-2">Error Loading Data</p>
                  <p className="text-gray-400 text-sm">{error}</p>
                  <button 
                    onClick={fetchData}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
              
              {!loading && !error && students.length === 0 && (
                <div className="text-center p-20">
                  <Users size={48} className="mx-auto text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Students Assigned</h3>
                  <p className="text-gray-400">
                    Please contact an administrator to have students assigned to you.
                  </p>
                </div>
              )}
              
              {!loading && !error && students.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                  {students.map((student) => (
                    <div 
                      key={student.id} 
                      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4 transition-all hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-900/40 rounded-full flex items-center justify-center shrink-0 border border-green-500/30">
                          <User className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {student.full_name || 'No Name'}
                          </h3>
                          <p className="text-sm text-gray-400 truncate">{student.email}</p>
                        </div>
                      </div>
                      
                      <ProgressBar score={student.stats.averageScore} />
                      
                      <div className="flex justify-between items-center text-sm pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 text-gray-300">
                          <MessageSquare size={14} className="text-green-400"/> 
                          Questions: <span className="font-bold text-white">{student.stats.questionCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <CheckCircle size={14} className="text-purple-400"/> 
                          Quizzes: <span className="font-bold text-white">{student.stats.quizAttempts}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {isQuizModalOpen && (
      <div 
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" 
        onClick={() => setIsQuizModalOpen(false)}
      >
        <div 
          className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-lg w-full" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={20}/> Generate Quiz
            </h2>
            <button 
              onClick={() => setIsQuizModalOpen(false)} 
              className="p-2 hover:bg-[var(--color-border)] rounded-lg"
            >
              <X size={18}/>
            </button>
          </div>
          
          <form onSubmit={handleGenerateQuiz}>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label">Quiz Topic</label>
                <input 
                  type="text" 
                  value={quizTopic} 
                  onChange={e => setQuizTopic(e.target.value)} 
                  placeholder="e.g., 'Photosynthesis' or 'The American Revolution'" 
                  required 
                  className="input-style"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Enter a topic and the AI will create a 5-question quiz.
                </p>
              </div>
              {quizError && <p className="text-red-400 text-sm">{quizError}</p>}
            </div>
            
            <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
              <button 
                type="submit" 
                disabled={isGeneratingQuiz} 
                className="btn-primary w-auto px-6 py-2"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2"/>
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {isAssignModalOpen && selectedQuiz && (
      <div 
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" 
        onClick={() => setIsAssignModalOpen(false)}
      >
        <div 
          className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Share2 size={20}/> Assign Quiz: {selectedQuiz.topic}
            </h2>
            <button 
              onClick={() => setIsAssignModalOpen(false)} 
              className="p-2 hover:bg-[var(--color-border)] rounded-lg"
            >
              <X size={18}/>
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="input-label mb-3">Select Students ({selectedStudents.length} selected)</label>
              {students.length === 0 ? (
                <div className="text-center p-8 border border-[var(--color-border)] rounded-lg bg-gray-900/20">
                  <Users size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-gray-400">No students assigned to you</p>
                  <p className="text-xs text-gray-500 mt-1">Contact an admin to assign students</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-3 bg-gray-900/20">
                  <button
                    type="button"
                    onClick={() => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.id))}
                    className="text-sm text-blue-400 hover:text-blue-300 mb-2"
                  >
                    {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-900/40 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{student.full_name}</p>
                          <p className="text-gray-400 text-xs">{student.email}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="input-label mb-2">Quiz Preview</label>
              <div className="bg-gray-900/20 border border-[var(--color-border)] rounded-lg p-3 text-sm">
                <p className="text-white font-medium">{selectedQuiz.questions.length} Questions</p>
                <p className="text-gray-400 mt-1">Topic: {selectedQuiz.topic}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  {selectedQuiz.questions.slice(0, 2).map((q, idx) => (
                    <p key={idx}>• {q.question.substring(0, 80)}...</p>
                  ))}
                  {selectedQuiz.questions.length > 2 && <p>• And {selectedQuiz.questions.length - 2} more questions...</p>}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-between">
            <button 
              onClick={() => setIsAssignModalOpen(false)}
              className="btn-secondary px-6 py-2"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmAssignment}
              disabled={isAssigning || selectedStudents.length === 0} 
              className="btn-primary px-6 py-2"
            >
              {isAssigning ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2"/>
                  Assigning...
                </>
              ) : (
                `Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {isReviewModalOpen && reviewQuiz && (
      <div 
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" 
        onClick={() => setIsReviewModalOpen(false)}
      >
        <div 
          className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Eye size={20}/> Review Quiz: {reviewQuiz.topic}
            </h2>
            <button 
              onClick={() => setIsReviewModalOpen(false)} 
              className="p-2 hover:bg-[var(--color-border)] rounded-lg"
            >
              <X size={18}/>
            </button>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <Award size={16}/> {reviewQuiz.questions.length} Questions
                </span>
                <span>Created: {formatDate(new Date(reviewQuiz.created_at))}</span>
              </div>
            </div>
            
            <div className="space-y-6">
              {reviewQuiz.questions.map((question, index) => (
                <div key={question.id} className="bg-gray-900/20 border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm shrink-0 mt-1">
                      {index + 1}
                    </div>
                    <h4 className="text-white font-semibold text-base leading-relaxed">
                      {question.question}
                    </h4>
                  </div>
                  
                  <div className="ml-9 space-y-2">
                    {question.options.map((option, optIndex) => (
                      <div 
                        key={optIndex} 
                        className={`p-2 rounded-lg text-sm ${
                          question.correctAnswer === optIndex 
                            ? 'bg-green-900/30 border border-green-500/50 text-green-300' 
                            : 'bg-gray-800/50 text-gray-300'
                        }`}
                      >
                        <span className="font-medium mr-2">
                          {String.fromCharCode(65 + optIndex)}.
                        </span>
                        {option}
                        {question.correctAnswer === optIndex && (
                          <CheckCircle size={16} className="inline ml-2 text-green-400" />
                        )}
                      </div>
                    ))}
                    
                    {question.explanation && (
                      <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-200">
                          <strong>Explanation:</strong> {question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
            <button 
              onClick={() => setIsReviewModalOpen(false)}
              className="btn-secondary px-6 py-2"
            >
              Close Review
            </button>
          </div>
        </div>
      </div>
    )}

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
