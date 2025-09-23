import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as db from '../services/supabaseService';
import { Profile, StudentProfile, StudentProfileWithDetails } from '../types';
import { 
  User, 
  UserPlus, 
  Edit3, 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle,
  GraduationCap,
  Brain,
  Heart,
  BookOpen,
  Lightbulb,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface StudentProfilesProps {
  onClose: () => void;
}

export function StudentProfilesComponent({ onClose }: StudentProfilesProps) {
  const { user, profile } = useAuth();
  const [studentProfiles, setStudentProfiles] = useState<StudentProfileWithDetails[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StudentProfile | null>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    student_name: '',
    age: '',
    grade_level: '',
    learning_strengths: '',
    learning_challenges: '',
    learning_style: '',
    interests: '',
    custom_context: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    const userId = user?.id || profile?.id;
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch student profiles and assigned students in parallel
      const [profiles, students] = await Promise.all([
        db.getStudentProfilesForTeacher(userId),
        db.getStudentsForTeacher(userId)
      ]);

      setStudentProfiles(profiles);
      setAssignedStudents(students);
    } catch (err: any) {
      console.error('Error fetching student profile data:', err);
      setError(err.message || 'Failed to load student profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, profile?.id]);

  const resetForm = () => {
    setFormData({
      student_id: '',
      student_name: '',
      age: '',
      grade_level: '',
      learning_strengths: '',
      learning_challenges: '',
      learning_style: '',
      interests: '',
      custom_context: ''
    });
    setFormError('');
    setIsCreating(false);
    setEditingProfile(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleEdit = (profileData: StudentProfile) => {
    setFormData({
      student_id: profileData.student_id,
      student_name: profileData.student_name,
      age: profileData.age?.toString() || '',
      grade_level: profileData.grade_level || '',
      learning_strengths: profileData.learning_strengths || '',
      learning_challenges: profileData.learning_challenges || '',
      learning_style: profileData.learning_style || '',
      interests: profileData.interests || '',
      custom_context: profileData.custom_context || ''
    });
    setEditingProfile(profileData);
    setIsCreating(false);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userId = user?.id || profile?.id;
    if (!userId) return;

    setIsSubmitting(true);
    setFormError('');

    try {
      // Validation
      if (!formData.student_id || !formData.student_name.trim()) {
        setFormError('Please select a student and provide a name.');
        return;
      }

      const profileData = {
        student_id: formData.student_id,
        teacher_id: userId,
        student_name: formData.student_name.trim(),
        age: formData.age ? parseInt(formData.age) : undefined,
        grade_level: formData.grade_level.trim() || undefined,
        learning_strengths: formData.learning_strengths.trim() || undefined,
        learning_challenges: formData.learning_challenges.trim() || undefined,
        learning_style: formData.learning_style.trim() || undefined,
        interests: formData.interests.trim() || undefined,
        custom_context: formData.custom_context.trim() || undefined,
        is_active: true
      };

      if (editingProfile) {
        // Update existing profile
        await db.updateStudentProfile(editingProfile.id, profileData);
      } else {
        // Create new profile
        await db.createStudentProfile(profileData);
      }

      // Refresh data
      await fetchData();
      resetForm();
      
    } catch (err: any) {
      console.error('Error saving student profile:', err);
      if (err.message?.includes('duplicate key')) {
        setFormError('A profile for this student already exists.');
      } else {
        setFormError(err.message || 'Failed to save student profile');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (profileId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete the profile for ${studentName}? This will remove all personalization for this student.`)) {
      return;
    }

    try {
      await db.deleteStudentProfile(profileId);
      await fetchData();
    } catch (err: any) {
      console.error('Error deleting profile:', err);
      alert(`Failed to delete profile: ${err.message}`);
    }
  };

  // Get students that don't have profiles yet
  const availableStudents = assignedStudents.filter(student => 
    !studentProfiles.some(profile => profile.student_id === student.id)
  );

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-grid-slate-900">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center p-12">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
            <p className="text-gray-400 mt-2">Loading student profiles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-grid-slate-900">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center p-12">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
            <p className="text-red-400 font-semibold mt-2">Error Loading Profiles</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <button onClick={fetchData} className="mt-4 btn-secondary">
              <RefreshCw size={14} /> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-grid-slate-900">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <User size={28} className="text-blue-500" /> 
              Student Profiles
            </h1>
            <p className="text-gray-400 mt-1">
              Create personalized learning contexts for your students to enhance AI tutoring.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchData} disabled={loading} className="btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={onClose} className="btn-secondary">
              <X size={14} /> Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Creation/Edit Form */}
          <div className="lg:col-span-1">
            <div className="admin-card">
              <h3 className="card-header flex items-center gap-2">
                {isCreating || editingProfile ? <Edit3 size={18} /> : <UserPlus size={18} />}
                {editingProfile ? 'Edit Profile' : isCreating ? 'Create Profile' : 'Student Profiles'}
              </h3>
              
              {!isCreating && !editingProfile ? (
                <div className="p-6">
                  <p className="text-gray-400 mb-4">
                    Create personalized profiles for your students to enhance their AI tutoring experience.
                  </p>
                  <button 
                    onClick={handleCreateNew} 
                    className="btn-primary w-full"
                    disabled={availableStudents.length === 0}
                  >
                    <UserPlus size={16} /> Create New Profile
                  </button>
                  {availableStudents.length === 0 && assignedStudents.length > 0 && (
                    <p className="text-xs text-yellow-400 mt-2">
                      All assigned students already have profiles.
                    </p>
                  )}
                  {assignedStudents.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      No students assigned to you yet.
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {formError && (
                    <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400">
                      <AlertTriangle size={16} />
                      <span className="text-sm">{formError}</span>
                    </div>
                  )}

                  {/* Student Selection */}
                  <div>
                    <label className="input-label">Select Student *</label>
                    <select
                      value={formData.student_id}
                      onChange={e => setFormData({...formData, student_id: e.target.value})}
                      required
                      className="input-style"
                      disabled={!!editingProfile}
                    >
                      <option value="">Choose a student...</option>
                      {(editingProfile ? assignedStudents : availableStudents).map(student => (
                        <option key={student.id} value={student.id}>
                          {student.full_name || student.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Name */}
                  <div>
                    <label className="input-label">Student Name *</label>
                    <input
                      type="text"
                      value={formData.student_name}
                      onChange={e => setFormData({...formData, student_name: e.target.value})}
                      placeholder="How should the AI address this student?"
                      required
                      className="input-style"
                    />
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Age</label>
                      <input
                        type="number"
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: e.target.value})}
                        placeholder="Optional"
                        min="5"
                        max="25"
                        className="input-style"
                      />
                    </div>
                    <div>
                      <label className="input-label">Grade Level</label>
                      <input
                        type="text"
                        value={formData.grade_level}
                        onChange={e => setFormData({...formData, grade_level: e.target.value})}
                        placeholder="e.g., 9th Grade"
                        className="input-style"
                      />
                    </div>
                  </div>

                  {/* Learning Characteristics */}
                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Lightbulb size={14} className="text-green-400" />
                      Learning Strengths
                    </label>
                    <textarea
                      value={formData.learning_strengths}
                      onChange={e => setFormData({...formData, learning_strengths: e.target.value})}
                      placeholder="What is this student good at? e.g., visual learning, math concepts, creative thinking..."
                      rows={2}
                      className="input-style"
                    />
                  </div>

                  <div>
                    <label className="input-label flex items-center gap-2">
                      <AlertTriangle size={14} className="text-yellow-400" />
                      Learning Challenges
                    </label>
                    <textarea
                      value={formData.learning_challenges}
                      onChange={e => setFormData({...formData, learning_challenges: e.target.value})}
                      placeholder="What does this student struggle with? e.g., reading comprehension, attention span, abstract concepts..."
                      rows={2}
                      className="input-style"
                    />
                  </div>

                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Brain size={14} className="text-purple-400" />
                      Learning Style
                    </label>
                    <input
                      type="text"
                      value={formData.learning_style}
                      onChange={e => setFormData({...formData, learning_style: e.target.value})}
                      placeholder="e.g., visual, auditory, kinesthetic, needs examples..."
                      className="input-style"
                    />
                  </div>

                  <div>
                    <label className="input-label flex items-center gap-2">
                      <Heart size={14} className="text-pink-400" />
                      Interests
                    </label>
                    <input
                      type="text"
                      value={formData.interests}
                      onChange={e => setFormData({...formData, interests: e.target.value})}
                      placeholder="e.g., sports, video games, art, science, music..."
                      className="input-style"
                    />
                  </div>

                  <div>
                    <label className="input-label">Additional Context</label>
                    <textarea
                      value={formData.custom_context}
                      onChange={e => setFormData({...formData, custom_context: e.target.value})}
                      placeholder="Any other important information about how to best teach this student..."
                      rows={3}
                      className="input-style"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="btn-primary flex-1"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin mr-2"/>
                          {editingProfile ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          {editingProfile ? 'Update Profile' : 'Create Profile'}
                        </>
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={resetForm} 
                      className="btn-secondary"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Student Profiles List */}
          <div className="lg:col-span-2">
            <div className="admin-card">
              <h3 className="card-header">
                Current Student Profiles ({studentProfiles.length})
              </h3>
              
              <div className="p-4">
                {studentProfiles.length === 0 ? (
                  <div className="text-center p-12">
                    <User size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Student Profiles Yet</h3>
                    <p className="text-gray-400 mb-4">
                      Create personalized profiles to enhance your students' AI tutoring experience.
                    </p>
                    <button 
                      onClick={handleCreateNew} 
                      className="btn-primary"
                      disabled={availableStudents.length === 0}
                    >
                      <UserPlus size={16} /> Create First Profile
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {studentProfiles.map((profile) => (
                      <div 
                        key={profile.id} 
                        className="bg-gray-900/50 border border-white/10 rounded-xl p-5 hover:border-blue-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-900/40 rounded-full flex items-center justify-center border border-blue-500/30">
                              <GraduationCap className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <h4 className="text-white font-semibold">{profile.student_name}</h4>
                              <p className="text-gray-400 text-sm">
                                {profile.profiles.full_name || profile.profiles.email}
                              </p>
                              {(profile.age || profile.grade_level) && (
                                <p className="text-gray-500 text-xs">
                                  {[profile.age ? `Age ${profile.age}` : '', profile.grade_level].filter(Boolean).join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(profile)}
                              className="p-2 hover:bg-blue-900/40 rounded-lg text-blue-400 transition-colors"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(profile.id, profile.student_name)}
                              className="p-2 hover:bg-red-900/40 rounded-lg text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {profile.learning_strengths && (
                            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-green-400" />
                                <span className="font-semibold text-green-300">Strengths</span>
                              </div>
                              <p className="text-gray-300">{profile.learning_strengths}</p>
                            </div>
                          )}

                          {profile.learning_challenges && (
                            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                <span className="font-semibold text-yellow-300">Challenges</span>
                              </div>
                              <p className="text-gray-300">{profile.learning_challenges}</p>
                            </div>
                          )}

                          {profile.learning_style && (
                            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-4 h-4 text-purple-400" />
                                <span className="font-semibold text-purple-300">Learning Style</span>
                              </div>
                              <p className="text-gray-300">{profile.learning_style}</p>
                            </div>
                          )}

                          {profile.interests && (
                            <div className="bg-pink-900/20 border border-pink-500/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Heart className="w-4 h-4 text-pink-400" />
                                <span className="font-semibold text-pink-300">Interests</span>
                              </div>
                              <p className="text-gray-300">{profile.interests}</p>
                            </div>
                          )}
                        </div>

                        {profile.custom_context && (
                          <div className="mt-4 bg-gray-800/50 border border-gray-600/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-300">Additional Context</span>
                            </div>
                            <p className="text-gray-300 text-sm">{profile.custom_context}</p>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs text-gray-500">
                            Created: {new Date(profile.created_at).toLocaleDateString()} • 
                            Updated: {new Date(profile.updated_at).toLocaleDateString()}
                          </p>
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
    </div>
  );
}
