import { supabase, getAdminClient } from '../supabase';
import { Profile, Conversation, Note, Quiz, FlaggedMessage, Message, GeneratedQuiz, QuizAssignmentWithDetails } from '../types';

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
    if (!conversationId || conversationId.trim() === '') {
        throw new Error('Conversation ID is required');
    }
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    if (!data) return [];
    return data.map(msg => ({ ...msg, created_at: new Date(msg.created_at) })) as Message[];
};

// Admin-specific message fetching function
export const getConversationMessages_Admin = async (conversationId: string): Promise<Message[]> => {
    if (!conversationId || conversationId.trim() === '') throw new Error('Conversation ID is required');
    const adminClient = getAdminClient();
    const { data, error } = await adminClient.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    if (!data) return [];
    return data.map(msg => ({ ...msg, created_at: new Date(msg.created_at) })) as Message[];
};

export const createConversation = async (userId: string, title: string): Promise<Conversation> => {
  const { data, error } = await supabase.from('conversations').insert({ user_id: userId, title }).select().single();
  if (error) throw error;
  return { ...data, created_at: new Date(data.created_at), updated_at: new Date(data.updated_at) } as Conversation;
};

export const addMessage = async (message: Omit<Message, 'id' | 'created_at'>): Promise<Message> => {
    const { data, error } = await supabase.from('messages').insert(message).select().single();
    if (error) throw error;
    return { ...data, created_at: new Date(data.created_at) } as Message;
};

export const updateConversationTitle = async (id: string, title: string) => {
  const { error } = await supabase.from('conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const updateConversationTimestamp = async (id: string) => {
    const { error } = await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
};

export const deleteConversation = async (id: string) => {
  const { error } = await supabase.from('conversations').update({ is_deleted: true }).eq('id', id);
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
  const { data, error } = await supabase.from('generated_quizzes').insert({ teacher_id: quizData.teacher_id, topic: quizData.topic, questions: quizData.questions }).select().single();
  if (error) throw error;
  return data as GeneratedQuiz;
};

export const getGeneratedQuizzesForTeacher = async (teacherId: string): Promise<GeneratedQuiz[]> => {
  const { data, error } = await supabase.from('generated_quizzes').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as GeneratedQuiz[];
};

export const assignQuizToStudents = async (quizId: string, teacherId: string, studentIds: string[], deadline: string | null): Promise<void> => {
  const assignments = studentIds.map(student_id => ({ quiz_id: quizId, teacher_id: teacherId, student_id, due_at: deadline }));
  const { error } = await supabase.from('quiz_assignments').insert(assignments);
  if (error) throw error;
};

export const getAssignedQuizzesForStudent = async (studentId: string): Promise<QuizAssignmentWithDetails[]> => {
  const { data, error } = await supabase.rpc('get_student_assignments', { student_id_param: studentId });
  if (error) throw error;
  return data as QuizAssignmentWithDetails[];
};

export const markQuizAsCompleted = async (assignmentId: string, score: number, totalQuestions: number): Promise<void> => {
  const { error } = await supabase.from('quiz_assignments').update({ completed_at: new Date().toISOString(), score, total_questions }).eq('id', assignmentId);
  if (error) throw error;
};

export const deleteGeneratedQuiz = async (quizId: string): Promise<void> => {
  const adminClient = getAdminClient();
  try {
    const { error: assignmentError } = await adminClient.from('quiz_assignments').delete().eq('quiz_id', quizId);
    if (assignmentError) throw new Error(`Failed to delete quiz assignments: ${assignmentError.message}`);
    
    const { error: quizError } = await adminClient.from('generated_quizzes').delete().eq('id', quizId);
    if (quizError) throw new Error(`Failed to delete quiz: ${quizError.message}`);
  } catch (error: any) {
    console.error('Error deleting quiz and its assignments:', error);
    throw error;
  }
};

export const getQuizAssignmentsForQuiz = async (quizId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('quiz_assignments')
    .select(`id, completed_at, score, total_questions, profiles (full_name, email)`)
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching quiz assignments for quiz:', error);
    throw error;
  }
  return data || [];
};

export const unassignQuizFromStudents = async (quizId: string, studentIds: string[]): Promise<void> => {
  const { error } = await supabase.from('quiz_assignments').delete().eq('quiz_id', quizId).in('student_id', studentIds).is('completed_at', null);
  if (error) throw error;
};

// --- SAFETY ---
export const flagMessage = async (flaggedMessage: any) => {
  const { error } = await supabase.from('flagged_messages').insert(flaggedMessage);
  if (error) throw error;
};

// --- TEACHER DASHBOARD ---

// =================================================================
// == START OF CHANGES
// =================================================================

// FIX: Replaced RPC with a direct query to avoid "structure does not match" error.
export const getStudentsForTeacher = async (teacherId: string): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('teacher_id', teacherId);

  if (error) {
    console.error('Error fetching students for teacher:', error);
    throw error;
  }
  return data as Profile[];
};

// FIX: Replaced RPC with a more robust direct query to avoid "structure does not match" error.
export const getFlaggedMessagesForTeacher = async (teacherId: string): Promise<FlaggedMessage[]> => {
    // First, get the IDs of the students assigned to this teacher
    const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('teacher_id', teacherId);

    if (studentsError) {
        console.error('Error fetching student IDs for teacher:', studentsError);
        throw studentsError;
    }

    if (!students || students.length === 0) {
        return []; // Teacher has no students, so no flagged messages
    }

    const studentIds = students.map(s => s.id);

    // Now, fetch flagged messages from those students and join the student's name
    const { data, error } = await supabase
        .from('flagged_messages')
        .select(`
            id,
            message_content,
            student_id,
            created_at,
            profiles (
                full_name
            )
        `)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching flagged messages:', error);
        throw error;
    }
    
    // The result is nested. We need to flatten it to match the FlaggedMessage type.
    return data.map((msg: any) => ({
        id: msg.id,
        message_content: msg.message_content,
        student_id: msg.student_id,
        student_name: msg.profiles?.full_name || 'Unknown Student',
        created_at: msg.created_at,
    }));
};
// =================================================================
// == END OF CHANGES
// =================================================================

export const getStudentStatsImproved = async (studentId: string) => {
  try {
    const { count: questionCount, error: convError } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', studentId).eq('is_deleted', false);
    if (convError) throw convError;
    const { data: completedAssignments, error: assignmentError } = await supabase.from('quiz_assignments').select('score, total_questions').eq('student_id', studentId).not('completed_at', 'is', null);
    if (assignmentError) throw assignmentError;
    const { data: oldQuizzes, error: oldQuizError } = await supabase.from('quizzes').select('score, total_questions').eq('user_id', studentId);
    if (oldQuizError) throw oldQuizError;
    const allQuizzes = [...(completedAssignments || []), ...(oldQuizzes || [])];
    const quizAttempts = allQuizzes.length;
    let averageScore = 0;
    if (quizAttempts > 0) {
      const totalScore = allQuizzes.reduce((acc, quiz) => acc + (quiz.score / quiz.total_questions) * 100, 0);
      averageScore = totalScore / quizAttempts;
    }
    return { questionCount: questionCount ?? 0, quizAttempts, averageScore: Math.round(averageScore * 10) / 10 };
  } catch (error) {
    console.error('Error fetching improved student stats:', error);
    throw error;
  }
};

// --- ADMIN PANEL ---
export const getAllUsers = async (): Promise<Profile[]> => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to fetch users. Error: ${error.message}`);
    return data as Profile[];
};

export const getAllConversationsForUser_Admin = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(conv => ({ ...conv, created_at: new Date(conv.created_at), updated_at: new Date(conv.updated_at) })) as Conversation[];
};

export const permanentDeleteConversation = async (id: string): Promise<void> => {
  const adminClient = getAdminClient();
  const { error } = await adminClient.from('conversations').delete().eq('id', id);
  if (error) throw new Error(`Failed to permanently delete conversation: ${error.message}`);
};

export const createUser = async (userData: { email: string; password: string; full_name: string; role: 'student' | 'teacher' }): Promise<any> => {
    const adminClient = getAdminClient();
    const { data: { user }, error: authError } = await adminClient.auth.admin.createUser({ email: userData.email.trim(), password: userData.password.trim(), email_confirm: true, user_metadata: { full_name: userData.full_name.trim(), role: userData.role }});
    if (authError) throw new Error(`Failed to create user account: ${authError.message}`);
    if (!user) throw new Error('User creation succeeded but no user data returned');
    return user;
};

export const assignTeacherToStudent = async (teacherId: string, studentId: string): Promise<void> => {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('profiles').update({ teacher_id: teacherId }).eq('id', studentId);
    if (error) throw new Error(`Failed to assign teacher: ${error.message}`);
};
