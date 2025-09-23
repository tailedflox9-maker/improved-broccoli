import React, { useEffect, useState, useMemo } from 'react';
import * as db from '../services/supabaseService';
import { Profile, Conversation, Message, StudentProfileWithDetails } from '../types';
import {
  PlusCircle,
  UserPlus,
  Users,
  Link as LinkIcon,
  RefreshCw,
  AlertTriangle,
  Shield,
  GraduationCap,
  BookOpen,
  UserCheck,
  Search,
  ChevronDown,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Trash2,
  Eye,
  UserCog,
  Brain,
  Heart,
  Lightbulb
} from 'lucide-react';
import { formatDate } from '../utils/helpers';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanelComponent({ onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'users' | 'chats'>('users');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userConversations, setUserConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [studentProfiles, setStudentProfiles] = useState<StudentProfileWithDetails[]>([]);
  const [showStudentProfiles, setShowStudentProfiles] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await db.getAllUsers();
      setUsers(allUsers);
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentProfiles = async () => {
    setProfilesLoading(true);
    try {
      const profiles = await db.getAllStudentProfiles();
      setStudentProfiles(profiles);
    } catch (error: any) {
      setError(`Failed to load student profiles: ${error.message}`);
    } finally {
      setProfilesLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = users.filter(user => {
      const searchQuery = searchTerm.toLowerCase();
      const nameMatch = user.full_name?.toLowerCase().includes(searchQuery) || false;
      const emailMatch = user.email.toLowerCase().includes(searchQuery);
      return nameMatch || emailMatch;
    });
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }
    setFilteredUsers(filtered);
  }, [users, searchTerm, filterRole]);

  const clearMessages = () => {
    setCreateSuccess(null);
    setCreateError(null);
    setAssignSuccess(null);
    setAssignError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !password.trim() || password.length < 6 || !fullName.trim()) {
      setCreateError("All fields are required and password must be at least 6 characters.");
      return;
    }
    setIsCreating(true);
    try {
      await db.createUser({ email: email.trim(), password: password.trim(), full_name: fullName.trim(), role });
      setCreateSuccess(`User "${fullName}" created successfully!`);
      setEmail(''); setPassword(''); setFullName(''); setRole('student');
      setTimeout(() => fetchUsers(), 2000);
      setTimeout(() => setCreateSuccess(null), 5000);
    } catch (error: any) {
      setCreateError(`Error creating user: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!selectedStudent || !selectedTeacher || selectedStudent === selectedTeacher) {
      setAssignError("Please select a valid student and a different teacher.");
      return;
    }
    setIsAssigning(true);
    try {
      await db.assignTeacherToStudent(selectedTeacher, selectedStudent);
      const student = users.find(u => u.id === selectedStudent);
      const teacher = users.find(u => u.id === selectedTeacher);
      setAssignSuccess(`Student "${student?.full_name}" assigned to teacher "${teacher?.full_name}"!`);
      setSelectedStudent(''); setSelectedTeacher('');
      fetchUsers();
      setTimeout(() => setAssignSuccess(null), 5000);
    } catch (error: any) {
      setAssignError(`Error assigning student: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
  const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
  const unassignedStudents = useMemo(() => students.filter(s => !s.teacher_id), [students]);
  const admins = useMemo(() => users.filter(u => u.role === 'admin'), [users]);

  const getRoleUI = (role: string) => {
    switch (role) {
      case 'admin': return { icon: <Shield size={14} />, class: 'text-red-400 bg-red-900/40 border-red-500/30' };
      case 'teacher': return { icon: <GraduationCap size={14} />, class: 'text-blue-400 bg-blue-900/40 border-blue-500/30' };
      case 'student': return { icon: <BookOpen size={14} />, class: 'text-green-400 bg-green-900/40 border-green-500/30' };
      default: return { icon: <Users size={14} />, class: 'text-gray-400 bg-gray-800 border-gray-700' };
    }
  };

  const handleViewChats = async (user: Profile) => {
    setSelectedUser(user);
    setViewMode('chats');
    setSelectedConversation(null);
    setConversationMessages([]);
    setMessageError(null);
    setChatLoading(true);
    try {
      const convos = await db.getAllConversationsForUser_Admin(user.id);
      setUserConversations(convos);
    } catch (err: any) {
      setError(`Failed to load chats: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    console.log('Selected conversation:', conversation);
    console.log('Conversation ID:', conversation.id);

    setSelectedConversation(conversation);
    setConversationMessages([]);
    setMessageError(null);
    setChatLoading(true);

    try {
      const messages = await db.getConversationMessages_Admin(conversation.id);
      console.log('Loaded messages count:', messages?.length || 0);
      console.log('Loaded messages:', messages);

      if (messages && messages.length > 0) {
        setConversationMessages(messages);
        setMessageError(null);
      } else {
        setConversationMessages([]);
        if (messages && Array.isArray(messages) && messages.length === 0) {
          setMessageError('This conversation has no messages.');
        } else {
          setMessageError('Unable to load messages for this conversation.');
        }
      }
    } catch (err: any) {
      console.error('Error loading messages:', err);
      console.error('Full error object:', err);
      setMessageError(`Failed to load messages: ${err.message || 'Unknown error'}`);
      setConversationMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePermanentDelete = async (conversationId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this conversation? This action cannot be undone.')) {
      try {
        await db.permanentDeleteConversation(conversationId);
        setUserConversations(prev => prev.filter(c => c.id !== conversationId));
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setConversationMessages([]);
          setMessageError(null);
        }
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleBackToUsers = () => {
    setViewMode('users');
    setSelectedUser(null);
    setUserConversations([]);
    setSelectedConversation(null);
    setConversationMessages([]);
    setError(null);
    setMessageError(null);
  };

  if (viewMode === 'chats' && selectedUser) {
    return (
      <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={handleBackToUsers} className="btn-secondary"><ArrowLeft size={16}/> Back to Users</button>
          <div>
            <h1 className="text-xl font-bold text-white">Chat History for {selectedUser.full_name || selectedUser.email}</h1>
            <p className="text-gray-400 text-sm">Viewing all conversations, including those deleted by the user.</p>
          </div>
        </div>
        <div className="flex-1 flex gap-6 overflow-hidden">
          <div className="w-1/3 flex flex-col bg-black/20 border border-white/10 rounded-xl">
            <h3 className="card-header text-base">Conversations ({userConversations.length})</h3>
            <div className="p-2 overflow-y-auto">
              {chatLoading && !userConversations.length && (
                <div className="text-center text-gray-400 p-4">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/>
                  <p>Loading conversations...</p>
                </div>
              )}
              {!chatLoading && userConversations.length === 0 && (
                <p className="text-center text-gray-400 p-4">No conversations found</p>
              )}
              {userConversations.map(convo => (
                <div key={convo.id} onClick={() => handleSelectConversation(convo)} className={`p-3 rounded-lg cursor-pointer group hover:bg-white/10 ${selectedConversation?.id === convo.id ? 'bg-blue-500/20' : ''}`}>
                  <div className="flex justify-between items-start">
                    <p className={`font-semibold truncate pr-2 ${convo.is_deleted ? 'text-red-400 italic' : 'text-white'}`}>{convo.title}</p>
                    <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(convo.id); }} className="p-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-900/40 rounded"><Trash2 size={14}/></button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(new Date(convo.updated_at))}</p>
                  {convo.is_deleted && <span className="text-xs text-red-500 font-bold">(Deleted by user)</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="w-2/3 flex flex-col bg-black/20 border border-white/10 rounded-xl">
            <h3 className="card-header text-base">Messages</h3>
            <div className="p-4 overflow-y-auto flex-1">
              {chatLoading && selectedConversation && (
                <div className="text-center text-gray-400 p-4">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/>
                  <p>Loading messages...</p>
                </div>
              )}
              {!selectedConversation && !chatLoading && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Select a conversation to view messages</p>
                </div>
              )}
              {messageError && (
                <div className="flex items-center justify-center h-full text-red-400">
                  <div className="text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2"/>
                    <p>{messageError}</p>
                  </div>
                </div>
              )}
              {!chatLoading && selectedConversation && !messageError && (
                <div className="space-y-4">
                  {conversationMessages.length === 0 ? (
                    <div className="text-center text-gray-500 p-4">
                      <p>This conversation has no messages</p>
                    </div>
                  ) : (
                    conversationMessages.map(msg => (
                      <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-gray-800' : 'bg-gray-700'}`}>
                        <p className={`font-bold capitalize ${msg.role === 'user' ? 'text-blue-300' : 'text-green-300'}`}>{msg.role}</p>
                        <p className="text-white whitespace-pre-wrap mt-1">{msg.content}</p>
                        <p className="text-xs text-gray-500 text-right mt-2">{formatDate(new Date(msg.created_at))}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-grid-slate-900">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Shield size={28} className="text-blue-500" /> Admin Dashboard</h1>
                <p className="text-gray-400 mt-1">Global management of users and assignments.</p>
            </div>
            <button onClick={fetchUsers} disabled={loading} className="btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="stats-card"><Users size={24} className="text-blue-500 mb-3"/><p className="text-3xl font-bold">{users.length}</p><p className="text-gray-400">Total Users</p></div>
            <div className="stats-card"><BookOpen size={24} className="text-green-500 mb-3"/><p className="text-3xl font-bold">{students.length}</p><p className="text-gray-400">Students</p></div>
            <div className="stats-card"><GraduationCap size={24} className="text-blue-400 mb-3"/><p className="text-3xl font-bold">{teachers.length}</p><p className="text-gray-400">Teachers</p></div>
            <div className="stats-card"><Shield size={24} className="text-red-500 mb-3"/><p className="text-3xl font-bold">{admins.length}</p><p className="text-gray-400">Admins</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="admin-card">
                    <h3 className="card-header"><UserPlus size={18} /> Create New User</h3>
                    <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                        {createSuccess && (<div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-500/30 rounded-lg text-green-400"><CheckCircle size={16} /><span className="text-sm">{createSuccess}</span></div>)}
                        {createError && (<div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400"><XCircle size={16} /><span className="text-sm">{createError}</span></div>)}
                        <div>
                          <label className="input-label">Full Name *</label>
                          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" required className="input-style" disabled={isCreating}/>
                        </div>
                        <div>
                          <label className="input-label">Email Address *</label>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required className="input-style" disabled={isCreating}/>
                        </div>
                        <div>
                          <label className="input-label">Password *</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required className="input-style" disabled={isCreating} minLength={6}/>
                        </div>
                        <div>
                          <label className="input-label">Role *</label>
                          <select value={role} onChange={e => setRole(e.target.value as any)} className="input-style" disabled={isCreating}>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                          </select>
                        </div>
                        <button type="submit" disabled={isCreating || !email.trim() || !password.trim() || !fullName.trim()} className="btn-primary w-full"><PlusCircle size={16}/>{isCreating ? 'Creating...' : 'Create User'}</button>
                    </form>
                </div>
                <div className="admin-card">
                    <h3 className="card-header"><LinkIcon size={18} /> Assign Teacher</h3>
                    <form onSubmit={handleAssignStudent} className="p-6 space-y-4">
                        {assignSuccess && (<div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-500/30 rounded-lg text-green-400"><CheckCircle size={16} /><span className="text-sm">{assignSuccess}</span></div>)}
                        {assignError && (<div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400"><XCircle size={16} /><span className="text-sm">{assignError}</span></div>)}
                        <div>
                          <label className="input-label">Select Student *</label>
                          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} required className="input-style" disabled={isAssigning}>
                            <option value="">Choose a student...</option>
                            {students.map(s => (<option key={s.id} value={s.id}>{s.full_name || s.email} {s.teacher_id ? '(Assigned)' : '(Unassigned)'}</option>))}
                          </select>
                          {students.length === 0 && (<p className="text-xs text-gray-500 mt-1">No students available</p>)}
                        </div>
                        <div>
                          <label className="input-label">Select Teacher *</label>
                          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} required className="input-style" disabled={isAssigning}>
                            <option value="">Choose a teacher...</option>
                            {teachers.map(t => (<option key={t.id} value={t.id}>{t.full_name || t.email}</option>))}
                          </select>
                          {teachers.length === 0 && (<p className="text-xs text-gray-500 mt-1">No teachers available</p>)}
                        </div>
                        <button type="submit" disabled={isAssigning || !selectedStudent || !selectedTeacher} className="btn-primary w-full"><UserCheck size={16}/>{isAssigning ? 'Assigning...' : 'Assign Teacher'}</button>
                        {unassignedStudents.length > 0 && (<p className="text-xs text-blue-400 mt-2">{unassignedStudents.length} unassigned student{unassignedStudents.length !== 1 ? 's' : ''}.</p>)}
                    </form>
                </div>
            </div>
            <div className="lg:col-span-2 admin-card">
                <h3 className="card-header"><Users size={18}/> User Management</h3>
                <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-style pl-10" />
                    </div>
                    <div className="relative">
                      <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-style pr-8">
                        <option value="all">All Roles</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option>
                      </select>
                      <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
                    </div>
                </div>
                {loading && (<div className="text-center p-12"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" /><p className="text-gray-400 mt-2">Loading users...</p></div>)}
                {error && (<div className="text-center p-12"><AlertTriangle className="w-8 h-8 mx-auto text-red-500" /><p className="text-red-400 font-semibold mt-2">Error</p><p className="text-gray-400 text-sm">{error}</p><button onClick={fetchUsers} className="mt-4 btn-secondary"><RefreshCw size={14} /> Retry</button></div>)}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-gray-400">
                              <tr className="border-b border-[var(--color-border)]">
                                <th className="table-header">User</th><th className="table-header">Role</th><th className="table-header">Assigned Teacher</th><th className="table-header">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {filteredUsers.map(user => {
                                    const roleUI = getRoleUI(user.role);
                                    const assignedTeacher = user.teacher_id ? teachers.find(t => t.id === user.teacher_id) : null;
                                    return (
                                        <tr key={user.id} className="hover:bg-white/5">
                                            <td className="p-4">
                                              <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${roleUI.class}`}>{roleUI.icon}</div>
                                                <div><p className="font-semibold text-white">{user.full_name || 'No Name'}</p><p className="text-gray-400">{user.email}</p></div>
                                              </div>
                                            </td>
                                            <td className="p-4">
                                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleUI.class}`}>{roleUI.icon}<span>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></div>
                                            </td>
                                            <td className="p-4 text-gray-300">
                                              {user.role === 'student' ? (assignedTeacher ? (<span className="text-green-400">{assignedTeacher.full_name || assignedTeacher.email}</span>) : (<span className="text-yellow-400 italic">Unassigned</span>)) : (<span className="text-gray-500">—</span>)}
                                            </td>
                                            <td className="p-4">
                                              <button onClick={() => handleViewChats(user)} className="btn-secondary"><Eye size={14}/> View Chats</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && (<div className="text-center p-12 text-gray-500">No users match your criteria.</div>)}
                    </div>
                )}
            </div>
        </div>

        <div className="admin-card">
            <div className="card-header flex justify-between items-center">
                <h3 className="flex items-center gap-3">
                <UserCog size={18}/> Student Profiles Management
                </h3>
                <div className="flex gap-2">
                <button
                    onClick={() => {
                    setShowStudentProfiles(!showStudentProfiles);
                    if (!showStudentProfiles && studentProfiles.length === 0) {
                        fetchStudentProfiles();
                    }
                    }}
                    className="btn-secondary"
                >
                    {showStudentProfiles ? 'Hide Profiles' : 'View All Student Profiles'}
                </button>
                {showStudentProfiles && (
                    <button
                    onClick={fetchStudentProfiles}
                    disabled={profilesLoading}
                    className="btn-secondary"
                    >
                    <RefreshCw size={14} className={profilesLoading ? 'animate-spin' : ''} />
                    Refresh
                    </button>
                )}
                </div>
            </div>

            {showStudentProfiles && (
                <div className="p-4">
                {profilesLoading && (
                    <div className="text-center p-12">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    <p className="text-gray-400 mt-2">Loading student profiles...</p>
                    </div>
                )}

                {!profilesLoading && studentProfiles.length === 0 && (
                    <div className="text-center p-12">
                    <UserCog size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Student Profiles</h3>
                    <p className="text-gray-400">
                        Teachers haven't created any student profiles yet.
                    </p>
                    </div>
                )}

                {!profilesLoading && studentProfiles.length > 0 && (
                    <>
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <p className="text-blue-300 text-sm">
                        <strong>Total Profiles:</strong> {studentProfiles.length} students have personalized learning profiles
                        </p>
                    </div>

                    <div className="grid gap-4 max-h-96 overflow-y-auto">
                        {studentProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            className="bg-gray-900/50 border border-white/10 rounded-xl p-4"
                        >
                            <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-900/40 rounded-full flex items-center justify-center border border-blue-500/30">
                                <UserCog className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                <h4 className="text-white font-semibold">{profile.student_name}</h4>
                                <p className="text-gray-400 text-sm">
                                    Student: {profile.profiles.full_name || profile.profiles.email}
                                </p>
                                {(profile.age || profile.grade_level) && (
                                    <p className="text-gray-500 text-xs">
                                    {[profile.age ? `Age ${profile.age}` : '', profile.grade_level].filter(Boolean).join(' • ')}
                                    </p>
                                )}
                                </div>
                            </div>
                            <div className="text-xs text-gray-500">
                                Updated: {new Date(profile.updated_at).toLocaleDateString()}
                            </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {profile.learning_strengths && (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <Lightbulb className="w-3 h-3 text-green-400" />
                                    <span className="font-semibold text-green-300">Strengths</span>
                                </div>
                                <p className="text-gray-300 line-clamp-2">{profile.learning_strengths}</p>
                                </div>
                            )}
                            {profile.learning_challenges && (
                                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                                    <span className="font-semibold text-yellow-300">Challenges</span>
                                </div>
                                <p className="text-gray-300 line-clamp-2">{profile.learning_challenges}</p>
                                </div>
                            )}
                            {profile.learning_style && (
                                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <Brain className="w-3 h-3 text-purple-400" />
                                    <span className="font-semibold text-purple-300">Style</span>
                                </div>
                                <p className="text-gray-300 line-clamp-2">{profile.learning_style}</p>
                                </div>
                            )}
                            {profile.interests && (
                                <div className="bg-pink-900/20 border border-pink-500/30 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <Heart className="w-3 h-3 text-pink-400" />
                                    <span className="font-semibold text-pink-300">Interests</span>
                                </div>
                                <p className="text-gray-300 line-clamp-2">{profile.interests}</p>
                                </div>
                            )}
                            </div>
                            {profile.custom_context && (
                            <div className="mt-3 bg-gray-800/50 border border-gray-600/30 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-1">
                                <BookOpen className="w-3 h-3 text-gray-400" />
                                <span className="font-semibold text-gray-300 text-xs">Additional Context</span>
                                </div>
                                <p className="text-gray-300 text-xs line-clamp-3">{profile.custom_context}</p>
                            </div>
                            )}
                        </div>
                        ))}
                    </div>
                    </>
                )}
                </div>
            )}
            </div>
      </div>
    </div>
  );
}
