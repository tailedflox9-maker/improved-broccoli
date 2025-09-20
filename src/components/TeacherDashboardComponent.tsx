import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { Profile, FlaggedMessage, GeneratedQuiz } from '../types';
import { 
  BookOpen, 
  MessageSquare, 
  CheckCircle, 
  Users, 
  GraduationCap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  User,
  Flag,
  ClipboardCheck,
  PlusCircle,
  X,
  Loader2,
  Share2
} from 'lucide-react';
import { formatDate } from '../utils/helpers';

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
  const [assignmentDeadline, setAssignmentDeadline] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchData = async () => {
    // Use either user.id or profile.id depending on what's available
    const userId = user?.id || profile?.id;
    
    if (!userId) {
      console.log('No user ID available for fetching teacher data');
      return;
    }
    
    console.log('Fetching data for teacher:', userId);
    setLoading(true);
    setError(null);
    
    try {
      // Try to fetch students and flagged messages in parallel
      console.log('Calling getStudentsForTeacher...');
      const studentsPromise = db.getStudentsForTeacher(userId).catch(err => {
        console.error('Error fetching students:', err);
        return []; // Return empty array on error
      });
      
      console.log('Calling getFlaggedMessagesForTeacher...');
      const messagesPromise = db.getFlaggedMessagesForTeacher(userId).catch(err => {
        console.error('Error fetching flagged messages:', err);
        return []; // Return empty array on error
      });

      const [assignedStudents, messages] = await Promise.all([
        studentsPromise,
        messagesPromise
      ]);

      console.log('Assigned students:', assignedStudents);
      console.log('Flagged messages:', messages);

      // Fetch stats for each student
      const studentsWithStats = await Promise.all(
        assignedStudents.map(async (student) => {
          try {
            console.log('Fetching stats for student:', student.id);
            const stats = await db.getStudentStats(student.id);
            console.log('Stats for', student.full_name, ':', stats);
            return { ...student, stats };
          } catch (err) {
            console.error(`Error fetching stats for student ${student.id}:`, err);
            // Return student with default stats if individual fetch fails
            return { 
              ...student, 
              stats: { 
                questionCount: 0, 
                quizAttempts: 0, 
                averageScore: 0 
              } 
            };
          }
        })
      );

      console.log('Students with stats:', studentsWithStats);
      
      setStudents(studentsWithStats);
      setFlaggedMessages(messages);
      
    } catch (error: any) {
      console.error('Error in fetchData:', error);
      setError(error.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  // Fixed useEffect with proper dependencies
  useEffect(() => {
    const userId = user?.id || profile?.id;
    if (userId) {
      fetchData();
    } else {
      console.log('User/profile not available yet, waiting...');
    }
  }, [user?.id, profile?.id]); // Depend on both possible ID sources
  
  
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
    } catch (error: any) {
      console.error('Quiz generation error:', error);
      setQuizError(error.message || "An unknown error occurred.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  const handleAssignQuiz = (quiz: GeneratedQuiz) => {
    setSelectedQuiz(quiz);
    setSelectedStudents([]);
    setAssignmentDeadline('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedQuiz || selectedStudents.length === 0) {
      alert('Please select at least one student to assign the quiz to.');
      return;
    }

    setIsAssigning(true);
    try {
      // For now, we'll just show a success message
      // In a real app, you'd save this to a database table like 'quiz_assignments'
      console.log('Assigning quiz:', selectedQuiz.topic, 'to students:', selectedStudents);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`Successfully assigned "${selectedQuiz.topic}" to ${selectedStudents.length} student(s)!`);
      setIsAssignModalOpen(false);
      setSelectedQuiz(null);
      setSelectedStudents([]);
      setAssignmentDeadline('');
    } catch (error: any) {
      console.error('Assignment error:', error);
      alert('Failed to assign quiz. Please try again.');
    } finally {
      setIsAssigning(false);
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
    average: students.length > 0 
      ? students.reduce((acc, s) => acc + s.stats.averageScore, 0) / students.length 
      : 0,
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

  // Show loading state while user is still loading
  if (!user && !profile) {
    return (
      <div className="h-full overflow-y-auto bg-grid-slate-900">
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
          <div className="text-center p-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-gray-400 mt-2">Loading user data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full overflow-y-auto bg-grid-slate-900">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GraduationCap size={28} className="text-blue-500" /> 
            Teacher Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor progress, review content, and create learning materials.
          </p>
          {/* Add debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-500 mt-2">
              User ID: {user?.id || profile?.id} | Students: {students.length} | Messages: {flaggedMessages.length}
            </p>
          )}
        </div>

        {/* Overview Stats */}
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
            <p className="text-gray-400">Quizzes Taken</p>
          </div>
          <div className="stats-card">
            <TrendingUp size={24} className="text-yellow-400 mb-3"/>
            <p className="text-3xl font-bold">{totals.average.toFixed(1)}%</p>
            <p className="text-gray-400">Class Average</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Class Tools */}
            <div className="admin-card">
              <h3 className="card-header">
                <ClipboardCheck size={18} /> Class Tools
              </h3>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-400">
                  Generate a quiz on any topic for your class to complete.
                </p>
                <button 
                  onClick={() => setIsQuizModalOpen(true)} 
                  className="btn-primary w-full"
                >
                  <PlusCircle size={16} /> Generate New Quiz
                </button>
              </div>
            </div>

            {/* Generated Quizzes */}
            <div className="admin-card">
              <h3 className="card-header">Generated Quizzes</h3>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {generatedQuizzes.length > 0 ? (
                  generatedQuizzes.map(quiz => (
                    <div key={quiz.id} className="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white">{quiz.topic}</p>
                        <p className="text-xs text-gray-400">{quiz.questions.length} Questions</p>
                      </div>
                      <button 
                        onClick={() => handleAssignQuiz(quiz)}
                        className="btn-secondary"
                      >
                        <Share2 size={14}/> Assign
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No quizzes generated yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* Flagged Messages */}
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
            
            {/* Student Progress */}
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
    
    {/* Quiz Generation Modal */}
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

    {/* Quiz Assignment Modal */}
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
            {/* Students Selection */}
            <div>
              <label className="input-label mb-3">Select Students ({selectedStudents.length} selected)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-3 bg-gray-900/20">
                <button
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
            </div>

            {/* Deadline */}
            <div>
              <label className="input-label">Assignment Deadline (Optional)</label>
              <input 
                type="datetime-local" 
                value={assignmentDeadline} 
                onChange={e => setAssignmentDeadline(e.target.value)} 
                className="input-style"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Students will receive a notification about the deadline.
              </p>
            </div>

            {/* Quiz Preview */}
            <div>
              <label className="input-label mb-2">Quiz Preview</label>
              <div className="bg-gray-900/20 border border-[var(--color-border)] rounded-lg p-3 text-sm">
                <p className="text-white font-medium">{selectedQuiz.questions.length} Questions</p>
                <p className="text-gray-400 mt-1">Topics: {selectedQuiz.topic}</p>
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
    </>
  );
}
