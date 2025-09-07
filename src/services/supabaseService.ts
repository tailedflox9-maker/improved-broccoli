import { supabase } from '../supabase';
import { Profile, Conversation, Note, Quiz } from '../types';

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
  const { data, error } = await supabase.from('profiles').select('*').eq('teacher_id', teacherId);
  if (error) throw error;
  return data as Profile[];
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
        const { data, error } = await supabase.rpc('get_all_users_admin');
        if (error) {
            console.error("Error fetching users with RPC:", error);
            // Fallback for safety, though RPC should be the primary method for admins
            const { data: directData, error: directError } = await supabase.from('profiles').select('*');
            if(directError) {
                throw new Error(`Failed to fetch users. Please ensure you have admin privileges and RLS policies are correctly set. Error: ${directError.message}`);
            }
            return directData as Profile[];
        }
        return data as Profile[];
    } catch (error: any) {
        console.error('getAllUsers comprehensive error:', error);
        throw new Error(`Unable to fetch user data: ${error.message}`);
    }
};

export const createUser = async (userData: any) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Admin not authenticated.");

    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { full_name: userData.full_name, role: userData.role }
    });
    
    if (error) throw error;

    // The profile should be created by a DB trigger. We update it just in case.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: userData.full_name, role: userData.role })
      .eq('id', data.user.id);
    
    if (profileError) {
      console.warn(`User created, but profile update failed: ${profileError.message}`);
    }

    // IMPORTANT: This may sign out the admin. The app should handle this gracefully.
    // Consider creating users via a serverless function to avoid session swapping.
    
    return data.user;
  } catch (error: any) {
    console.error('createUser error:', error);
    throw error;
  }
};

export const assignTeacherToStudent = async (teacherId: string, studentId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ teacher_id: teacherId })
      .eq('id', studentId)
      .eq('role', 'student');

    if (error) {
      throw new Error(`Failed to assign teacher: ${error.message}`);
    }
  } catch (error: any) {
    console.error('assignTeacherToStudent error:', error);
    throw error;
  }
};
