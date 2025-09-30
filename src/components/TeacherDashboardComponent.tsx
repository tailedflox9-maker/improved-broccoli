import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';
import { aiService } from '../services/aiService';
import { Profile, FlaggedMessage, GeneratedQuiz, Announcement } from '../types';
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
  Share2,
  Eye,
  Trash2,
  Award,
  UserCog,
  Bell,
  Edit
} from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { StudentProfilesComponent } from './StudentProfilesComponent';
import { CreateAnnouncementModal } from './CreateAnnouncementModal';

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles'>('dashboard');
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<GeneratedQuiz | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewQuiz, setReviewQuiz] = useState<GeneratedQuiz | null>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const fetchData = async () => {
    const userId = user?.id || profile?.id;
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const [assignedStudents, messages, quizzes, announcementsData] = await Promise.all([
        db.getStudentsForTeacher(userId),
        db.getFlaggedMessagesForTeacher(userId),
        db.getGeneratedQuizzesForTeacher(userId),
        db.getAnnouncements(userId, 'teacher'),
      ]);

      const studentsWithStats = await Promise.all(
        assignedStudents.map(async (student) => {
          try {
            const stats = await db.getStudentStatsImproved(student.id);
            return { ...student, stats };
          } catch (err) {
            console.error(`Error fetching stats for student ${student.id}:`, err);
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

      setStudents(studentsWithStats);
      setFlaggedMessages(messages);
      setGeneratedQuizzes(quizzes);
      setAnnouncements(announcementsData as Announcement[]);

    } catch (error: any) {
      console.error('Error in fetchData:', error);
      setError(error.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userId = user?.id || profile?.id;
    if (userId) {
      fetchData();
    }
  }, [user?.id, profile?.id]);

  const handleOpenCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setIsAnnouncementModalOpen(true);
  };

  const handleOpenEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsAnnouncementModalOpen(true);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await db.deleteAnnouncement(id);
        fetchData(); // Refresh data
      } catch (error: any) {
        alert('Failed to delete announcement: ' + error.message);
      }
    }
  };
  
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
        null
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

  if (activeTab === 'profiles') {
    return <StudentProfilesComponent onClose={() => setActiveTab('dashboard')} />;
  }

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

          <div className="flex mt-4 border-b border-white/20">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'dashboard'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-gray-400'
              }`}
            >
              <GraduationCap size={16} className="inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'profiles'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-gray-400'
              }`}
            >
              <UserCog size={16} className="inline mr-2" />
              Student Profiles
            </button>
          </div>
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
              <h3 className="card-header">
                <ClipboardCheck size={18} /> Class Tools
              </h3>
              <div className="p-6 space-y-4">
                <button
                  onClick={handleOpenCreateAnnouncement}
                  className="btn-primary w-full"
                >
                  <Bell size={16} /> Create Announcement
                </button>
                <button
                  onClick={() => setIsQuizModalOpen(true)}
                  className="btn-primary w-full"
                >
                  <PlusCircle size={16} /> Generate New Quiz
                </button>
                 <button
                  onClick={() => setActiveTab('profiles')}
                  className="btn-secondary w-full"
                >
                  <UserCog size={16} /> Manage Student Profiles
                </button>
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
                    No quizzes generated yet.
                  </p>
                )}
              </div>
            </div>
            
            <div className="admin-card">
              <h3 className="card-header">Announcements ({announcements.length})</h3>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {announcements.length > 0 ? (
                  announcements.map(ann => (
                    <div key={ann.id} className="bg-gray-900/50 p-3 rounded-lg">
                      <p className="font-semibold text-white truncate">{ann.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{ann.priority} Priority</p>
                      <p className="text-xs text-gray-500">Posted: {formatDate(new Date(ann.created_at))}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleOpenEditAnnouncement(ann)} className="flex-1 btn-secondary text-xs"><Edit size={12} className="inline mr-1"/> Edit</button>
                        <button onClick={() => handleDeleteAnnouncement(ann.id)} className="flex-1 btn-secondary text-xs text-red-400 hover:bg-red-900/40"><Trash2 size={12} className="inline mr-1"/> Delete</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No announcements created yet.</p>
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
    <CreateAnnouncementModal 
      isOpen={isAnnouncementModalOpen}
      onClose={() => setIsAnnouncementModalOpen(false)}
      onSave={fetchData}
      announcementToEdit={editingAnnouncement}
    />
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
    </>
  );
}
