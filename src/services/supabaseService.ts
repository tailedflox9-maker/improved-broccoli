import { supabase, getAdminClient } from '../supabase';
import { Profile, Conversation, Note, Quiz, FlaggedMessage } from '../types';

// --- PROFILE & USER MGMT ---
export const getProfile = async (): Promise<Profile> => {
  const { data, error } = await supabase.rpc('get_my_profile');

  if (error) {
    console.error("Error calling get_my_profile RPC:", error);
    throw new Error("Could not fetch user profile from the database.");
  }

  if (!data || data.length === 0) {
    throw new Error("User profile not found in the database.");
  }

  return data[0] as Profile;
};

// --- CONVERSATIONS ---
export const getConversations = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(conv => ({
      ...conv,
      messages: [],
      created_at: new Date(conv.created_at),
      updated_at: new Date(conv.updated_at),
  })) as Conversation[];
};

export const createConversation = async (userId: string, title: string): Promise<Conversation> => {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) throw error;
  return { ...data, created_at: new Date(data.created_at), updated_at: new Date(data.updated_at), messages: [] } as Conversation;
};

export const updateConversationTitle = async (id: string, title: string) => {
  const { error } = await supabase.from('conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const deleteConversation = async (id: string) => {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
};

// --- NOTES ---
export const getNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(n => ({...n, created_at: new Date(n.created_at), updated_at: new Date(n.updated_at)})) as Note[];
};

export const createNote = async (user_id: string, title: string, content: string, source_conversation_id?: string): Promise<Note> => {
  const { data, error } = await supabase.from('notes').insert({ user_id, title, content, source_conversation_id }).select().single();
  if (error) throw error;
  return { ...data, created_at: new Date(data.created_at), updated_at: new Date(data.updated_at) } as Note;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
};

// --- QUIZZES ---
export const createQuiz = async (user_id: string, conversation_id: string, score: number, total_questions: number): Promise<Quiz> => {
  const { data, error } = await supabase.from('quizzes').insert({ user_id, conversation_id, score, total_questions }).select().single();
  if (error) throw error;
  return data as Quiz;
};

// --- SAFETY ---
export const flagMessage = async (flaggedMessage: any) => {
  const { error } = await supabase.from('flagged_messages').insert(flaggedMessage);
  if (error) throw error;
};

// --- TEACHER DASHBOARD ---
export const getStudentsForTeacher = async (teacherId: string): Promise<Profile[]> => {
  // Use the new, explicit RPC function to securely fetch students
  const { data, error } = await supabase.rpc('get_students_for_teacher', { teacher_id_param: teacherId });
  if (error) {
    console.error('Error fetching students for teacher:', error);
    throw error;
  }
  return data as Profile[];
};

export const getFlaggedMessagesForTeacher = async (teacherId: string): Promise<FlaggedMessage[]> => {
    // Use the RPC function to securely fetch messages
    const { data, error } = await supabase.rpc('get_flagged_messages_for_teacher', { teacher_id_param: teacherId });
    if (error) {
        console.error('Error fetching flagged messages:', error);
        throw error;
    }
    return data as FlaggedMessage[];
};

export const getStudentStats = async (studentId: string) => {
  const { count: questionCount, error: convError } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', studentId);
  if (convError) throw convError;

  const { data: quizzes, error: quizError } = await supabase.from('quizzes').select('score, total_questions').eq('user_id', studentId);
  if (quizError) throw quizError;

  const quizAttempts = quizzes ? quizzes.length : 0;
  const averageScore = quizAttempts > 0 ? (quizzes.reduce((acc, q) => acc + (q.score / q.total_questions), 0) / quizAttempts) * 100 : 0;

  return { questionCount: questionCount ?? 0, quizAttempts, averageScore, lastActive: null };
};

// --- ADMIN PANEL - ENHANCED WITH BETTER ERROR HANDLING ---
export const getAllUsers = async (): Promise<Profile[]> => {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_users_admin');
        if (!rpcError && rpcData) {
            return rpcData as Profile[];
        }
        const { data: directData, error: directError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (directError) {
            throw new Error(`Unable to fetch users. Error: ${directError.message}`);
        }
        return directData as Profile[];
    } catch (error: any) {
        throw new Error(`Unable to fetch user data: ${error.message}`);
    }
};

export const createUser = async (userData: { email: string; password: string; full_name: string; role: 'student' | 'teacher' }): Promise<any> => {
  try {
    if (!userData.email?.trim()) throw new Error('Email is required');
    if (!userData.password?.trim() || userData.password.length < 6) throw new Error('Password must be at least 6 characters long');
    if (!userData.full_name?.trim()) throw new Error('Full name is required');
    if (!['student', 'teacher'].includes(userData.role)) throw new Error('Role must be either student or teacher');

    const adminClient = getAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email.trim(),
      password: userData.password.trim(),
      email_confirm: true,
      user_metadata: { full_name: userData.full_name.trim(), role: userData.role }
    });
    
    if (authError) throw new Error(`Failed to create user account: ${authError.message}`);
    if (!authData.user) throw new Error('User creation succeeded but no user data returned');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return authData.user;
    
  } catch (error: any) {
    if (error.message?.includes('already registered')) throw new Error('A user with this email address already exists');
    throw new Error(error.message || 'Failed to create user');
  }
};

export const assignTeacherToStudent = async (teacherId: string, studentId: string): Promise<void> => {
  try {
    if (!teacherId?.trim() || !studentId?.trim()) throw new Error('Teacher and Student IDs are required.');
    if (teacherId === studentId) throw new Error('A user cannot be assigned to themselves.');

    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({ teacher_id: teacherId })
      .eq('id', studentId);

    if (error) throw new Error(`Failed to assign teacher: ${error.message}`);
    
  } catch (error: any) {
    throw new Error(error.message || 'An unexpected error occurred while assigning the teacher.');
  }
};
