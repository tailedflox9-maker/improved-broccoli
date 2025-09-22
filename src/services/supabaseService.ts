import { supabase, getAdminClient } from '../supabase';
import { Profile, Conversation, Note, Quiz, FlaggedMessage, Message, GeneratedQuiz, QuizAssignmentWithDetails } from '../types';

// --- PROFILE & USER MGMT (NO RPC NEEDED) ---
export const getProfile = async (): Promise<Profile> => {
  console.log('Getting user profile...');
  
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      throw new Error('User not authenticated');
    }
    
    console.log('Authenticated user found:', user.email);
    
    // Get profile directly from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Profile query error:', profileError);
      
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        console.log('Profile not found, creating new profile...');
        
        const newProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
          role: user.user_metadata?.role || 'student',
          teacher_id: user.user_metadata?.teacher_id || null
        };
        
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();
          
        if (createError) {
          console.error('Failed to create profile:', createError);
          throw new Error(`Failed to create profile: ${createError.message}`);
        }
        
        console.log('Profile created successfully:', createdProfile);
        return createdProfile as Profile;
      }
      
      throw new Error(`Profile error: ${profileError.message}`);
    }
    
    if (!profile) {
      throw new Error('Profile data is null');
    }
    
    console.log('Profile loaded successfully:', profile.email, profile.role);
    return profile as Profile;
    
  } catch (error: any) {
    console.error('getProfile failed:', error.message);
    throw new Error(`Could not load user profile: ${error.message}`);
  }
};

// --- CONVERSATIONS & MESSAGES (DATABASE-DRIVEN) ---
export const getConversations = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(conv => ({
      ...conv,
      created_at: new Date(conv.created_at),
      updated_at: new Date(conv.updated_at),
  })) as Conversation[];
};

export const getConversationMessages = async (conversationId: string): Promise<Message[]> => {
    console.log('Fetching messages for conversation ID:', conversationId);

    if (!conversationId || conversationId.trim() === '') {
        console.error('Invalid conversation ID provided:', conversationId);
        throw new Error('Conversation ID is required');
    }

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Supabase error fetching messages:', error);
            throw error;
        }

        console.log('Raw message data from database:', data);

        if (!data) {
            console.log('No data returned from query');
            return [];
        }

        const messages = data.map(msg => ({
            ...msg,
            created_at: new Date(msg.created_at)
        })) as Message[];

        console.log('Processed messages:', messages);

        return messages;
    } catch (error) {
        console.error('Error in getConversationMessages:', error);
        throw error;
    }
};

// Admin-specific message fetching function
export const getConversationMessages_Admin = async (conversationId: string): Promise<Message[]> => {
    console.log('Admin: Fetching messages for conversation ID:', conversationId);

    if (!conversationId || conversationId.trim() === '') {
        console.error('Invalid conversation ID provided:', conversationId);
        throw new Error('Conversation ID is required');
    }

    try {
        // Try with admin client first
        const adminClient = getAdminClient();
        const { data: adminData, error: adminError } = await adminClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (!adminError && adminData) {
            console.log('Admin client successful, found messages:', adminData.length);
            return adminData.map(msg => ({
                ...msg,
                created_at: new Date(msg.created_at)
            })) as Message[];
        }

        console.log('Admin client failed, trying regular client:', adminError);

        // Fallback to regular client
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Both admin and regular client failed:', error);
            throw error;
        }

        console.log('Regular client result:', data?.length || 0, 'messages');

        if (!data) {
            return [];
        }

        return data.map(msg => ({
            ...msg,
            created_at: new Date(msg.created_at)
        })) as Message[];

    } catch (error) {
        console.error('Error in getConversationMessages_Admin:', error);
        throw error;
    }
};

export const createConversation = async (userId: string, title: string): Promise<Conversation> => {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) throw error;
  return { ...data, created_at: new Date(data.created_at), updated_at: new Date(data.updated_at) } as Conversation;
};

export const addMessage = async (message: Omit<Message, 'id' | 'created_at'>): Promise<Message> => {
    const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();
    if (error) throw error;
    return { ...data, created_at: new Date(data.created_at) } as Message;
};

export const updateConversationTitle = async (id: string, title: string) => {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const updateConversationTimestamp = async (id: string) => {
    const { error } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
};

// Soft delete for regular users
export const deleteConversation = async (id: string) => {
  const { error } = await supabase
    .from('conversations')
    .update({ is_deleted: true })
    .eq('id', id);
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

export const createGeneratedQuiz = async (quizData: Omit<GeneratedQuiz, 'id' | 'created_at'>): Promise<GeneratedQuiz> => {
  const { data, error } = await supabase
    .from('generated_quizzes')
    .insert({
      teacher_id: quizData.teacher_id,
      topic: quizData.topic,
      questions: quizData.questions,
    })
    .select()
    .single();
  if (error) throw error;
  return data as GeneratedQuiz;
};

export const getGeneratedQuizzesForTeacher = async (teacherId: string): Promise<GeneratedQuiz[]> => {
  const { data, error } = await supabase
    .from('generated_quizzes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as GeneratedQuiz[];
};

export const assignQuizToStudents = async (
  quizId: string,
  teacherId: string,
  studentIds: string[],
  deadline: string | null
): Promise<void> => {
  const assignments = studentIds.map(student_id => ({
    quiz_id: quizId,
    teacher_id: teacherId,
    student_id,
    due_at: deadline,
  }));
  const { error } = await supabase.from('quiz_assignments').insert(assignments);
  if (error) throw error;
};

export const getAssignedQuizzesForStudent = async (studentId: string): Promise<QuizAssignmentWithDetails[]> => {
  const { data, error } = await supabase.rpc('get_student_assignments', { student_id_param: studentId });
  if (error) {
    console.error('Error fetching assigned quizzes:', error);
    throw error;
  }
  return data as QuizAssignmentWithDetails[];
};

export const markQuizAsCompleted = async (assignmentId: string, score: number, totalQuestions: number): Promise<void> => {
  const { error } = await supabase
    .from('quiz_assignments')
    .update({
      completed_at: new Date().toISOString(),
      score,
      total_questions: totalQuestions,
    })
    .eq('id', assignmentId);
  if (error) throw error;
};

// Function to delete a generated quiz
export const deleteGeneratedQuiz = async (quizId: string): Promise<void> => {
  try {
    // First check if there are any assignments for this quiz
    const { data: assignments, error: checkError } = await supabase
      .from('quiz_assignments')
      .select('id')
      .eq('quiz_id', quizId)
      .limit(1);

    if (checkError) throw checkError;

    if (assignments && assignments.length > 0) {
      throw new Error('Cannot delete quiz that has been assigned to students. Please remove assignments first.');
    }

    // Delete the quiz if no assignments exist
    const { error } = await supabase
      .from('generated_quizzes')
      .delete()
      .eq('id', quizId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error deleting quiz:', error);
    throw error;
  }
};

// Function to get quiz assignments with completion details for a teacher
export const getQuizAssignmentDetails = async (teacherId: string) => {
  try {
    const { data, error } = await supabase
      .from('quiz_assignments')
      .select(`
        id,
        due_at,
        completed_at,
        score,
        total_questions,
        generated_quizzes!inner(id, topic, questions),
        profiles!quiz_assignments_student_id_fkey(id, full_name, email)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching quiz assignment details:', error);
    throw error;
  }
};

// Function to unassign a quiz from students
export const unassignQuizFromStudents = async (quizId: string, studentIds: string[]): Promise<void> => {
  try {
    const { error } = await supabase
      .from('quiz_assignments')
      .delete()
      .eq('quiz_id', quizId)
      .in('student_id', studentIds)
      .is('completed_at', null); // Only unassign if not completed

    if (error) throw error;
  } catch (error: any) {
    console.error('Error unassigning quiz:', error);
    throw error;
  }
};

// --- SAFETY ---
export const flagMessage = async (flaggedMessage: any) => {
  const { error } = await supabase.from('flagged_messages').insert(flaggedMessage);
  if (error) throw error;
};

// --- TEACHER DASHBOARD ---
export const getStudentsForTeacher = async (teacherId: string): Promise<Profile[]> => {
  const { data, error } = await supabase.rpc('get_students_for_teacher', { teacher_id_param: teacherId });
  if (error) {
    console.error('Error fetching students for teacher:', error);
    throw error;
  }
  return data as Profile[];
};

export const getFlaggedMessagesForTeacher = async (teacherId: string): Promise<FlaggedMessage[]> => {
    const { data, error } = await supabase.rpc('get_flagged_messages_for_teacher', { teacher_id_param: teacherId });
    if (error) {
        console.error('Error fetching flagged messages:', error);
        throw error;
    }
    return data as FlaggedMessage[];
};

// Improved student stats function that includes quiz assignment data
export const getStudentStatsImproved = async (studentId: string) => {
  try {
    // Count conversations (questions asked)
    const { count: questionCount, error: convError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', studentId)
      .eq('is_deleted', false);

    if (convError) throw convError;

    // Get completed quiz assignments (more accurate than old quiz table)
    const { data: completedAssignments, error: assignmentError } = await supabase
      .from('quiz_assignments')
      .select('score, total_questions')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null);

    if (assignmentError) throw assignmentError;

    // Fallback to old quiz table for backward compatibility
    const { data: oldQuizzes, error: oldQuizError } = await supabase
      .from('quizzes')
      .select('score, total_questions')
      .eq('user_id', studentId);

    if (oldQuizError) throw oldQuizError;

    // Combine both sources
    const allQuizzes = [
      ...(completedAssignments || []),
      ...(oldQuizzes || [])
    ];

    const quizAttempts = allQuizzes.length;
    let averageScore = 0;

    if (quizAttempts > 0) {
      const totalScore = allQuizzes.reduce((acc, quiz) => {
        const percentage = (quiz.score / quiz.total_questions) * 100;
        return acc + percentage;
      }, 0);
      averageScore = totalScore / quizAttempts;
    }

    return {
      questionCount: questionCount ?? 0,
      quizAttempts,
      averageScore: Math.round(averageScore * 10) / 10 // Round to 1 decimal
    };
  } catch (error) {
    console.error('Error fetching improved student stats:', error);
    throw error;
  }
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

// --- ADMIN PANEL ---
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

// Admin function to get ALL conversations (including soft-deleted)
export const getAllConversationsForUser_Admin = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(conv => ({
      ...conv,
      created_at: new Date(conv.created_at),
      updated_at: new Date(conv.updated_at),
  })) as Conversation[];
};

// Hard delete for admins only
export const permanentDeleteConversation = async (id: string): Promise<void> => {
  const adminClient = getAdminClient();
  const { error } = await adminClient.from('conversations').delete().eq('id', id);
  if (error) throw new Error(`Failed to permanently delete conversation: ${error.message}`);
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
