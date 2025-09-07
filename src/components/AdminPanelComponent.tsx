import React, { useEffect, useState, useMemo } from 'react';
import * as db from '../services/supabaseService';
import { Profile } from '../types';
import { 
  PlusCircle, 
  UserPlus, 
  Users, 
  Link as LinkIcon, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Shield,
  GraduationCap,
  BookOpen,
  UserCheck,
  Search,
  ChevronDown
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
  
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = users.filter(user => 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }
    setFilteredUsers(filtered);
  }, [users, searchTerm, filterRole]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }
    setIsCreating(true);
    try {
      await db.createUser({ email, password, full_name: fullName, role });
      alert('User created successfully!');
      setEmail(''); setPassword(''); setFullName('');
      await fetchUsers();
    } catch (error: any) {
      alert(`Error creating user: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTeacher) return;
    setIsAssigning(true);
    try {
      await db.assignTeacherToStudent(selectedTeacher, selectedStudent);
      alert('Student assigned successfully!');
      setSelectedStudent('');
      await fetchUsers();
    } catch (error: any) {
      alert(`Error assigning student: ${error.message}`);
    } finally {
      setIsAssigning(false);
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
        {/* Header */}
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Shield size={28} className="text-blue-500" /> Admin Dashboard</h1>
                <p className="text-gray-400 mt-1">Global management of users and assignments.</p>
            </div>
            <button onClick={fetchUsers} disabled={loading} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="stats-card"><Users size={24} className="text-blue-500 mb-3"/><p className="text-3xl font-bold">{users.length}</p><p className="text-gray-400">Total Users</p></div>
            <div className="stats-card"><BookOpen size={24} className="text-green-500 mb-3"/><p className="text-3xl font-bold">{students.length}</p><p className="text-gray-400">Students</p></div>
            <div className="stats-card"><GraduationCap size={24} className="text-blue-400 mb-3"/><p className="text-3xl font-bold">{teachers.length}</p><p className="text-gray-400">Teachers</p></div>
            <div className="stats-card"><Shield size={24} className="text-red-500 mb-3"/><p className="text-3xl font-bold">{admins.length}</p><p className="text-gray-400">Admins</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                {/* Create User Card */}
                <div className="admin-card">
                    <h3 className="card-header"><UserPlus size={18} /> Create New User</h3>
                    <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                        <div><label className="input-label">Full Name</label><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" required className="input-style" /></div>
                        <div><label className="input-label">Email Address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required className="input-style" /></div>
                        <div><label className="input-label">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required className="input-style" /></div>
                        <div><label className="input-label">Role</label><select value={role} onChange={e => setRole(e.target.value as any)} className="input-style"><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
                        <button type="submit" disabled={isCreating} className="btn-primary w-full">{isCreating ? <><RefreshCw size={16} className="animate-spin"/>Creating...</> : <><PlusCircle size={16}/>Create User</>}</button>
                    </form>
                </div>
                {/* Assign Teacher Card */}
                <div className="admin-card">
                    <h3 className="card-header"><LinkIcon size={18} /> Assign Teacher</h3>
                    <form onSubmit={handleAssignStudent} className="p-6 space-y-4">
                        <div><label className="input-label">Select Student</label><select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} required className="input-style"><option value="">Choose a student...</option>{students.map(s => (<option key={s.id} value={s.id}>{s.full_name || s.email}</option>))}</select></div>
                        <div><label className="input-label">Select Teacher</label><select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} required className="input-style"><option value="">Choose a teacher...</option>{teachers.map(t => (<option key={t.id} value={t.id}>{t.full_name || t.email}</option>))}</select></div>
                        <button type="submit" disabled={isAssigning || !selectedStudent || !selectedTeacher} className="btn-primary w-full">{isAssigning ? <><RefreshCw size={16} className="animate-spin"/>Assigning...</> : <><UserCheck size={16}/>Assign Teacher</>}</button>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-2 admin-card">
                <h3 className="card-header"><Users size={18}/> User Management</h3>
                <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-style pl-10" /></div>
                    <div className="relative"><select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-style pr-8"><option value="all">All Roles</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option></select><ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/></div>
                </div>
                
                {loading && <div className="text-center p-12"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" /><p className="text-gray-400 mt-2">Loading users...</p></div>}
                {error && <div className="text-center p-12"><AlertTriangle className="w-8 h-8 mx-auto text-red-500" /><p className="text-red-400 font-semibold mt-2">Error Loading Data</p><p className="text-gray-400 text-sm">{error}</p></div>}
                
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-gray-400"><tr className="border-b border-[var(--color-border)]"><th className="table-header">User</th><th className="table-header">Role</th><th className="table-header">Assigned Teacher</th></tr></thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {filteredUsers.map(user => {
                                    const roleUI = getRoleUI(user.role);
                                    const assignedTeacher = user.teacher_id ? teachers.find(t => t.id === user.teacher_id) : null;
                                    return (
                                        <tr key={user.id} className="hover:bg-white/5">
                                            <td className="p-4"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${roleUI.class}`}>{roleUI.icon}</div><div><p className="font-semibold text-white">{user.full_name || 'No Name'}</p><p className="text-gray-400">{user.email}</p></div></div></td>
                                            <td className="p-4"><div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleUI.class}`}>{roleUI.icon}<span>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></div></td>
                                            <td className="p-4 text-gray-300">{user.role === 'student' ? (assignedTeacher ? assignedTeacher.full_name : <span className="text-gray-500 italic">Unassigned</span>) : <span className="text-gray-500">—</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && <div className="text-center p-12 text-gray-500">No users match your criteria.</div>}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
