import React, { useEffect, useState, useMemo } from 'react';
import * as db from '../services/supabaseService';
import { Profile, Conversation } from '../types';
import { 
  PlusCircle, UserPlus, Users, Link as LinkIcon, RefreshCw, AlertTriangle, Shield,
  GraduationCap, BookOpen, UserCheck, Search, ChevronDown, CheckCircle, XCircle,
  Trash2, EyeOff, MessageSquare
} from 'lucide-react';

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

  // --- NEW: State for conversation management ---
  const [selectedUserForConvos, setSelectedUserForConvos] = useState<Profile | null>(null);
  const [userConversations, setUserConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true); setError(null);
    try {
      const allUsers = await db.getAllUsers();
      setUsers(allUsers);
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    let filtered = users.filter(user => {
      const nameMatch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const emailMatch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || emailMatch;
    });
    if (filterRole !== 'all') { filtered = filtered.filter(user => user.role === filterRole); }
    setFilteredUsers(filtered);
  }, [users, searchTerm, filterRole]);

  const clearMessages = () => {
    setCreateSuccess(null); setCreateError(null); setAssignSuccess(null); setAssignError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages();
    if (!email.trim() || !password.trim() || password.length < 6 || !fullName.trim()) {
      setCreateError("Please fill all fields correctly (password min 6 chars)."); return;
    }
    setIsCreating(true);
    try {
      await db.createUser({ email: email.trim(), password: password.trim(), full_name: fullName.trim(), role });
      setCreateSuccess(`User "${fullName}" created successfully!`);
      setEmail(''); setPassword(''); setFullName(''); setRole('student');
      setTimeout(fetchUsers, 2000);
      setTimeout(() => setCreateSuccess(null), 5000);
    } catch (error: any) { setCreateError(`Error creating user: ${error.message}`);
    } finally { setIsCreating(false); }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages();
    if (!selectedStudent || !selectedTeacher || selectedStudent === selectedTeacher) {
      setAssignError("Please select a valid student and teacher."); return;
    }
    setIsAssigning(true);
    try {
      await db.assignTeacherToStudent(selectedTeacher, selectedStudent);
      const student = users.find(u => u.id === selectedStudent);
      const teacher = users.find(u => u.id === selectedTeacher);
      setAssignSuccess(`Assigned "${student?.full_name}" to "${teacher?.full_name}"!`);
      setSelectedStudent(''); setSelectedTeacher('');
      await fetchUsers();
      setTimeout(() => setAssignSuccess(null), 5000);
    } catch (error: any) { setAssignError(`Error assigning student: ${error.message}`);
    } finally { setIsAssigning(false); }
  };
  
  // --- NEW: Handler to view a user's conversations ---
  const handleViewUserConversations = async (user: Profile) => {
    setSelectedUserForConvos(user);
    setConvosLoading(true);
    try {
      const convos = await db.getAllConversationsForUser_Admin(user.id);
      setUserConversations(convos);
    } catch (error: any) {
      console.error("Failed to fetch user conversations:", error);
      alert(`Could not load conversations: ${error.message}`);
    } finally {
      setConvosLoading(false);
    }
  };

  // --- NEW: Handler for permanent deletion by admin ---
  const handleHardDeleteConversation = async (convoId: string) => {
    if (!window.confirm("PERMANENTLY DELETE? This action cannot be undone.")) return;
    try {
      await db.hardDeleteConversation_Admin(convoId);
      setUserConversations(prev => prev.filter(c => c.id !== convoId));
    } catch (error: any) {
      console.error("Failed to hard delete conversation:", error);
      alert(`Could not delete conversation: ${error.message}`);
    }
  };

  const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
  const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
  const admins = useMemo(() => users.filter(u => u.role === 'admin'), [users]);

  const getRoleUI = (role: string) => {
    switch (role) {
      case 'admin': return { icon: <Shield size={14} />, class: 'text-red-400 bg-red-900/40 border-red-500/30' };
      case 'teacher': return { icon: <GraduationCap size={14} />, class: 'text-blue-400 bg-blue-900/40 border-blue-500/30' };
      case 'student': return { icon: <BookOpen size={14} />, class: 'text-green-400 bg-green-900/40 border-green-500/30' };
      default: return { icon: <Users size={14} />, class: 'text-gray-400 bg-gray-800 border-gray-700' };
    }
  };
  
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="admin-card">
                    <h3 className="card-header"><UserPlus size={18} /> Create New User</h3>
                    <form onSubmit={handleCreateUser} className="p-6 space-y-4">{/* Form fields... */}</form>
                </div>
                <div className="admin-card">
                    <h3 className="card-header"><LinkIcon size={18} /> Assign Teacher</h3>
                    <form onSubmit={handleAssignStudent} className="p-6 space-y-4">{/* Form fields... */}</form>
                </div>
            </div>

            <div className="lg:col-span-1 admin-card">
                <h3 className="card-header"><Users size={18}/> User Management</h3>
                <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row gap-4">{/* Search/filter... */}</div>
                {!loading && !error && (
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-sm">
                            <thead className="text-gray-400 sticky top-0 bg-[var(--color-card)]">
                              <tr className="border-b border-[var(--color-border)]"><th className="table-header">User</th><th className="table-header">Role</th></tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {filteredUsers.map(user => {
                                    const roleUI = getRoleUI(user.role);
                                    return (
                                        <tr key={user.id} className="hover:bg-white/5 cursor-pointer" onClick={() => handleViewUserConversations(user)}>
                                            <td className="p-4">
                                              <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${roleUI.class}`}>{roleUI.icon}</div>
                                                <div>
                                                  <p className="font-semibold text-white">{user.full_name || 'No Name Set'}</p>
                                                  <p className="text-gray-400">{user.email}</p>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="p-4">
                                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleUI.class}`}>{roleUI.icon}<span>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
        
        {/* --- NEW: Conversation Management Section --- */}
        {selectedUserForConvos && (
          <div className="admin-card mt-8">
            <div className="card-header flex justify-between items-center">
              <h3 className="flex items-center gap-3"><MessageSquare size={18}/> Conversations for {selectedUserForConvos.full_name}</h3>
              <button onClick={() => setSelectedUserForConvos(null)} className="btn-icon p-1"><XCircle size={16}/></button>
            </div>
            {convosLoading ? (
              <div className="text-center p-8"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>
            ) : userConversations.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 sticky top-0 bg-black/30 backdrop-blur-sm">
                    <tr className="border-b border-[var(--color-border)]"><th className="table-header">Title</th><th className="table-header">Status</th><th className="table-header">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {userConversations.map(convo => (
                      <tr key={convo.id} className={`${convo.is_deleted_by_user ? 'opacity-60 bg-red-900/10' : ''}`}>
                        <td className="p-4 text-white font-medium">{convo.title}</td>
                        <td className="p-4">
                          {convo.is_deleted_by_user ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400"><EyeOff size={14}/> Hidden</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400"><CheckCircle size={14}/> Active</span>
                          )}
                        </td>
                        <td className="p-4">
                          <button onClick={() => handleHardDeleteConversation(convo.id)} className="btn-secondary !text-red-400 hover:!bg-red-900/30 hover:!border-red-500/50">
                            <Trash2 size={14}/> Hard Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center p-8 text-gray-500">This user has no conversations.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
