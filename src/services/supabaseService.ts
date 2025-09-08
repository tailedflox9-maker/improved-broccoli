import { supabase, getAdminClient } from '../supabase';
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

export const createUser = async (userData: { email: string; password: string; full_name: string; role: 'student' | 'teacher' }): Promise<any> => {
  try {
    console.log('Creating user with Supabase Auth Admin API...', { email: userData.email, role: userData.role });
    
    // Validate input
    if (!userData.email?.trim()) {
      throw new Error('Email is required');
    }
    if (!userData.password?.trim() || userData.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    if (!userData.full_name?.trim()) {
      throw new Error('Full name is required');
    }
    if (!['student', 'teacher'].includes(userData.role)) {
      throw new Error('Role must be either student or teacher');
    }

    // Get admin client
    const adminClient = getAdminClient();

    // Create user using Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email.trim(),
      password: userData.password.trim(),
      email_confirm: true,
      user_metadata: { 
        full_name: userData.full_name.trim(), 
        role: userData.role 
      }
    });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('User creation succeeded but no user data returned');
    }

    console.log('User created successfully:', authData.user.id);

    // Wait a bit for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the profile with correct data (in case trigger didn't work properly)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        full_name: userData.full_name.trim(), 
        role: userData.role 
      })
      .eq('id', authData.user.id);
    
    if (profileError) {
      console.warn(`User created but profile update failed: ${profileError.message}`);
      // Don't throw here as the user was created successfully
    }

    return authData.user;
    
  } catch (error: any) {
    console.error('createUser comprehensive error:', error);
    
    // Better error messages
    if (error.message?.includes('already registered')) {
      throw new Error('A user with this email address already exists');
    }
    if (error.message?.includes('invalid email')) {
      throw new Error('Please provide a valid email address');
    }
    if (error.message?.includes('weak password')) {
      throw new Error('Password is too weak. Please use at least 6 characters');
    }
    
    throw new Error(error.message || 'Failed to create user');
  }
};

export const assignTeacherToStudent = async (teacherId: string, studentId: string): Promise<void> => {
  try {
    console.log(`Assigning teacher ${teacherId} to student ${studentId}`);
    
    // Validate inputs
    if (!teacherId?.trim()) {
      throw new Error('Teacher ID is required');
    }
    if (!studentId?.trim()) {
      throw new Error('Student ID is required');
    }
    if (teacherId === studentId) {
      throw new Error('A user cannot be assigned to themselves');
    }

    // Verify teacher exists and has teacher role
    const { data: teacher, error: teacherError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single();

    if (teacherError) {
      console.error('Teacher verification error:', teacherError);
      throw new Error('Selected teacher not found or invalid');
    }

    if (!teacher) {
      throw new Error('Selected user is not a valid teacher');
    }

    // Verify student exists and has student role
    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', studentId)
      .eq('role', 'student')
      .single();

    if (studentError) {
      console.error('Student verification error:', studentError);
      throw new Error('Selected student not found or invalid');
    }

    if (!student) {
      throw new Error('Selected user is not a valid student');
    }

    // Perform the assignment
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        teacher_id: teacherId 
      })
      .eq('id', studentId)
      .eq('role', 'student');

    if (updateError) {
      console.error('Assignment update error:', updateError);
      throw new Error(`Failed to assign teacher: ${updateError.message}`);
    }

    console.log('Teacher assignment successful');

  } catch (error: any) {
    console.error('assignTeacherToStudent comprehensive error:', error);
    
    // Better error messages
    if (error.message?.includes('not found')) {
      throw new Error('Selected teacher or student not found');
    }
    if (error.message?.includes('permission')) {
      throw new Error('Insufficient permissions to assign teacher');
    }
    
    throw new Error(error.message || 'Failed to assign teacher to student');
  }
};
