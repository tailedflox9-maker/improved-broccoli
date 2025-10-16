import { supabase, getAdminClient } from '../supabase';
import { Profile, Conversation, Note, Quiz, FlaggedMessage, Message, GeneratedQuiz, QuizAssignmentWithDetails, StudentProfile, StudentProfileWithDetails, TokenUsage, TokenAnalytics, DailyTokenStats, UserTokenStats, ModelTokenStats } from '../types';

// --- PROFILE & USER MGMT (NO RPC NEEDED) ---
export const getProfile = async (): Promise<Profile> => {
  console.log('Getting user profile...');
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      throw new Error('User not authenticated');
    }
    console.log('Authenticated user found:', user.email);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError) {
      console.error('Profile query error:', profileError);
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
    if (!profile) throw new Error('Profile data is null');
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

export const getConversationMessages_Admin = async (conversationId: string): Promise<Message[]> => {
    console.log('Admin: Fetching messages for conversation ID:', conversationId);
    if (!conversationId || conversationId.trim() === '') {
        console.error('Invalid conversation ID provided:', conversationId);
        throw new Error('Conversation ID is required');
    }
    try {
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
        if (!data) return [];
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

// =====================================================
// TOKEN TRACKING: UPDATE MESSAGE WITH TOKEN COUNTS
// =====================================================
export const updateMessageTokens = async (
  messageId: string, 
  inputTokens: number, 
  outputTokens: number, 
  totalTokens: number
): Promise<void> => {
  try {
    console.log(`[Token Update] Updating message ${messageId} with tokens: ${totalTokens}`);
    const { error } = await supabase
      .from('messages')
      .update({
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens
      })
      .eq('id', messageId);
    
    if (error) {
      console.error('[Token Update] Error updating message tokens:', error);
      throw error;
    }
    
    console.log('[Token Update] ✓ Message tokens updated successfully');
  } catch (error: any) {
    console.error('[Token Update] Failed to update message tokens:', error);
    // Don't throw - we don't want to break the chat if token update fails
    // The data is still recorded in token_usage table
  }
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

export const deleteGeneratedQuiz = async (quizId: string): Promise<void> => {
  try {
    const { data: assignments, error: checkError } = await supabase
      .from('quiz_assignments')
      .select('id')
      .eq('quiz_id', quizId)
      .limit(1);
    if (checkError) throw checkError;
    if (assignments && assignments.length > 0) {
      throw new Error('Cannot delete quiz that has been assigned to students. Please remove assignments first.');
    }
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

export const unassignQuizFromStudents = async (quizId: string, studentIds: string[]): Promise<void> => {
  try {
    const { error } = await supabase
      .from('quiz_assignments')
      .delete()
      .eq('quiz_id', quizId)
      .in('student_id', studentIds)
      .is('completed_at', null);
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

export const getStudentStatsImproved = async (studentId: string) => {
  try {
    const { count: questionCount, error: convError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', studentId)
      .eq('is_deleted', false);
    if (convError) throw convError;
    const { data: completedAssignments, error: assignmentError } = await supabase
      .from('quiz_assignments')
      .select('score, total_questions')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null);
    if (assignmentError) throw assignmentError;
    const { data: oldQuizzes, error: oldQuizError } = await supabase
      .from('quizzes')
      .select('score, total_questions')
      .eq('user_id', studentId);
    if (oldQuizError) throw oldQuizError;
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
      averageScore: Math.round(averageScore * 10) / 10
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

// =================================================================
// == STUDENT PROFILES
// =================================================================
export const getStudentProfilesForTeacher = async (teacherId: string): Promise<StudentProfileWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select(`
        *,
        profiles!student_profiles_student_id_fkey(
          full_name,
          email
        )
      `)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .order('student_name', { ascending: true });
    if (error) throw error;
    return data as StudentProfileWithDetails[];
  } catch (error: any) {
    console.error('Error fetching student profiles:', error);
    throw error;
  }
};

export const getAllStudentProfiles = async (): Promise<StudentProfileWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select(`
        *,
        profiles!student_profiles_student_id_fkey(
          full_name,
          email
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as StudentProfileWithDetails[];
  } catch (error: any) {
    console.error('Error fetching all student profiles:', error);
    throw error;
  }
};

export const getStudentProfile = async (studentId: string, teacherId: string): Promise<StudentProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as StudentProfile;
  } catch (error: any) {
    console.error('Error fetching student profile:', error);
    throw error;
  }
};

export const createStudentProfile = async (profileData: Omit<StudentProfile, 'id' | 'created_at' | 'updated_at'>): Promise<StudentProfile> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .insert(profileData)
      .select()
      .single();
    if (error) throw error;
    return data as StudentProfile;
  } catch (error: any) {
    console.error('Error creating student profile:', error);
    throw error;
  }
};

export const updateStudentProfile = async (
  profileId: string, 
  updates: Partial<Omit<StudentProfile, 'id' | 'student_id' | 'teacher_id' | 'created_at'>>
): Promise<StudentProfile> => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .update(updates)
      .eq('id', profileId)
      .select()
      .single();
    if (error) throw error;
    return data as StudentProfile;
  } catch (error: any) {
    console.error('Error updating student profile:', error);
    throw error;
  }
};

export const deleteStudentProfile = async (profileId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('student_profiles')
      .update({ is_active: false })
      .eq('id', profileId);
    if (error) throw error;
  } catch (error: any) {
    console.error('Error deleting student profile:', error);
    throw error;
  }
};

export const getActiveStudentProfileForChat = async (studentId: string): Promise<StudentProfile | null> => {
  try {
    const { data: studentData, error: studentError } = await supabase
      .from('profiles')
      .select('teacher_id')
      .eq('id', studentId)
      .single();
    if (studentError || !studentData?.teacher_id) return null;
    return await getStudentProfile(studentId, studentData.teacher_id);
  } catch (error: any) {
    console.error('Error fetching active student profile:', error);
    return null;
  }
};

export const generatePersonalizedPrompt = (studentProfile: StudentProfile, basePrompt: string): string => {
  let personalizedPrompt = basePrompt;
  const studentContext = [];
  studentContext.push(`The student you're tutoring is ${studentProfile.student_name}`);
  if (studentProfile.age) studentContext.push(`who is ${studentProfile.age} years old`);
  if (studentProfile.grade_level) studentContext.push(`and is in ${studentProfile.grade_level}`);
  if (studentProfile.learning_strengths) studentContext.push(`\n\nLEARNING STRENGTHS: ${studentProfile.learning_strengths}`);
  if (studentProfile.learning_challenges) studentContext.push(`\n\nLEARNING CHALLENGES: ${studentProfile.learning_challenges}. Please be especially patient and provide additional support in these areas.`);
  if (studentProfile.learning_style) studentContext.push(`\n\nLEARNING STYLE: ${studentProfile.learning_style}. Adapt your teaching approach to match this style.`);
  if (studentProfile.interests) studentContext.push(`\n\nSTUDENT INTERESTS: ${studentProfile.interests}. Try to connect lessons to these interests when possible.`);
  if (studentProfile.custom_context) studentContext.push(`\n\nADDITIONAL CONTEXT: ${studentProfile.custom_context}`);
  if (studentContext.length > 0) {
    personalizedPrompt += `\n\n--- STUDENT PROFILE ---\n${studentContext.join(' ')}\n\nAdjust your teaching style, examples, and explanations to work best for this specific student. Be encouraging and build on their strengths while providing extra support for their challenges.`;
  }
  return personalizedPrompt;
};

// =================================================================
// == TOKEN USAGE TRACKING
// =================================================================
export const recordTokenUsage = async (tokenData: Omit<TokenUsage, 'id' | 'created_at'>): Promise<void> => {
  try {
    console.log('[Token Recording] Saving token usage to database:', tokenData);
    const { error } = await supabase
      .from('token_usage')
      .insert(tokenData);
    if (error) {
      console.error('[Token Recording] Database error:', error);
      throw error;
    }
    console.log('[Token Recording] ✓ Successfully saved to database');
  } catch (error: any) {
    console.error('[Token Recording] Failed to record token usage:', error);
    throw error;
  }
};

export const getTokenAnalytics = async (): Promise<TokenAnalytics> => {
  try {
    console.log('[Token Analytics] Fetching analytics data...');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Today's stats
    const { data: todayData, error: todayError } = await supabase
      .from('token_usage')
      .select('total_tokens, input_tokens, output_tokens, user_id')
      .gte('created_at', todayStart);
    if (todayError) throw todayError;

    const todayStats = {
      total_tokens: todayData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0,
      input_tokens: todayData?.reduce((sum, row) => sum + (row.input_tokens || 0), 0) || 0,
      output_tokens: todayData?.reduce((sum, row) => sum + (row.output_tokens || 0), 0) || 0,
      message_count: todayData?.length || 0,
      unique_users: new Set(todayData?.map(row => row.user_id) || []).size
    };

    // Week stats
    const { data: weekData, error: weekError } = await supabase
      .from('token_usage')
      .select('total_tokens, created_at')
      .gte('created_at', weekAgo);
    if (weekError) throw weekError;

    const dailyMap = new Map<string, number>();
    weekData?.forEach(row => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + (row.total_tokens || 0));
    });

    let peakDay = '';
    let peakTokens = 0;
    dailyMap.forEach((tokens, date) => {
      if (tokens > peakTokens) {
        peakTokens = tokens;
        peakDay = date;
      }
    });

    const weekStats = {
      total_tokens: weekData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0,
      daily_average: Math.round((weekData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0) / 7),
      peak_day: peakDay,
      peak_tokens: peakTokens
    };

    // Month stats
    const { data: monthData, error: monthError } = await supabase
      .from('token_usage')
      .select('total_tokens')
      .gte('created_at', monthAgo);
    if (monthError) throw monthError;

    const monthStats = {
      total_tokens: monthData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0,
      daily_average: Math.round((monthData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0) / 30)
    };

    // All-time stats
    const { data: allTimeData, error: allTimeError } = await supabase
      .from('token_usage')
      .select('total_tokens, user_id');
    if (allTimeError) throw allTimeError;

    const allTimeStats = {
      total_tokens: allTimeData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0,
      total_messages: allTimeData?.length || 0,
      total_users: new Set(allTimeData?.map(row => row.user_id) || []).size
    };

    // Daily history for last 30 days
    const { data: historyData, error: historyError } = await supabase
      .from('token_usage')
      .select('total_tokens, input_tokens, output_tokens, created_at, user_id')
      .gte('created_at', monthAgo)
      .order('created_at', { ascending: true });
    if (historyError) throw historyError;

    const dailyHistory: DailyTokenStats[] = [];
    const historyMap = new Map<string, { total: number; input: number; output: number; count: number; users: Set<string> }>();

    historyData?.forEach(row => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      if (!historyMap.has(date)) {
        historyMap.set(date, { total: 0, input: 0, output: 0, count: 0, users: new Set() });
      }
      const day = historyMap.get(date)!;
      day.total += row.total_tokens || 0;
      day.input += row.input_tokens || 0;
      day.output += row.output_tokens || 0;
      day.count += 1;
      day.users.add(row.user_id);
    });

    historyMap.forEach((stats, date) => {
      dailyHistory.push({
        date,
        total_tokens: stats.total,
        input_tokens: stats.input,
        output_tokens: stats.output,
        message_count: stats.count,
        unique_users: stats.users.size
      });
    });

    // Top users
    const { data: userData, error: userError } = await supabase
      .from('token_usage')
      .select('user_id, total_tokens')
      .gte('created_at', monthAgo);
    if (userError) throw userError;

    const userMap = new Map<string, { total: number; count: number }>();
    userData?.forEach(row => {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, { total: 0, count: 0 });
      }
      const user = userMap.get(row.user_id)!;
      user.total += row.total_tokens || 0;
      user.count += 1;
    });

    const topUsersData: UserTokenStats[] = [];
    for (const [userId, stats] of userMap.entries()) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();
      
      topUsersData.push({
        user_id: userId,
        user_name: profile?.full_name || 'Unknown User',
        user_email: profile?.email || '',
        total_tokens: stats.total,
        message_count: stats.count,
        avg_tokens_per_message: Math.round(stats.total / stats.count)
      });
    }

    topUsersData.sort((a, b) => b.total_tokens - a.total_tokens);
    const topUsers = topUsersData.slice(0, 10);

    // Model breakdown
    const { data: modelData, error: modelError } = await supabase
      .from('token_usage')
      .select('model, total_tokens')
      .gte('created_at', monthAgo);
    if (modelError) throw modelError;

    const modelMap = new Map<string, { total: number; count: number }>();
    modelData?.forEach(row => {
      const model = row.model || 'unknown';
      if (!modelMap.has(model)) {
        modelMap.set(model, { total: 0, count: 0 });
      }
      const m = modelMap.get(model)!;
      m.total += row.total_tokens || 0;
      m.count += 1;
    });

    const totalTokensAllModels = Array.from(modelMap.values()).reduce((sum, m) => sum + m.total, 0);
    const modelBreakdown: ModelTokenStats[] = [];
    modelMap.forEach((stats, model) => {
      modelBreakdown.push({
        model,
        total_tokens: stats.total,
        message_count: stats.count,
        percentage: totalTokensAllModels > 0 ? Math.round((stats.total / totalTokensAllModels) * 100 * 10) / 10 : 0
      });
    });

    modelBreakdown.sort((a, b) => b.total_tokens - a.total_tokens);

    console.log('[Token Analytics] ✓ Analytics data fetched successfully');

    return {
      today: todayStats,
      week: weekStats,
      month: monthStats,
      all_time: allTimeStats,
      daily_history: dailyHistory,
      top_users: topUsers,
      model_breakdown: modelBreakdown
    };
  } catch (error: any) {
    console.error('[Token Analytics] Error fetching analytics:', error);
    throw error;
  }
};

export const getUserTokenUsage = async (userId: string, days: number = 30): Promise<DailyTokenStats[]> => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('token_usage')
      .select('total_tokens, input_tokens, output_tokens, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });
    
    if (error) throw error;

    const dailyMap = new Map<string, { total: number; input: number; output: number; count: number }>();
    
    data?.forEach(row => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, input: 0, output: 0, count: 0 });
      }
      const day = dailyMap.get(date)!;
      day.total += row.total_tokens || 0;
      day.input += row.input_tokens || 0;
      day.output += row.output_tokens || 0;
      day.count += 1;
    });

    const dailyHistory: DailyTokenStats[] = [];
    dailyMap.forEach((stats, date) => {
      dailyHistory.push({
        date,
        total_tokens: stats.total,
        input_tokens: stats.input,
        output_tokens: stats.output,
        message_count: stats.count,
        unique_users: 1
      });
    });

    return dailyHistory;
  } catch (error: any) {
    console.error('Error fetching user token usage:', error);
    throw error;
  }
};
