// --- Simplified APISettings ---
// API keys are no longer stored here; they are read from environment variables.
export interface APISettings {
  selectedModel: 'google' | 'zhipu' | 'mistral-small' | 'mistral-codestral';
}

// --- All other types remain the same ---
export type TutorMode = 'standard' | 'exam' | 'mentor' | 'creative';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  messages?: Message[]; // <-- UPDATED: Messages are now optional
  created_at: Date;
  updated_at: Date;
  is_pinned?: boolean;
  is_deleted?: boolean; // For soft-deleting conversations
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: Date;
  model?: 'google' | 'zhipu' | 'mistral-small' | 'mistral-codestral';
  isEditing?: boolean;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  source_conversation_id?: string;
}

export interface Quiz {
  id: string;
  user_id: string;
  conversation_id?: string;
  score: number;
  total_questions: number;
  created_at: Date;
}

export interface StudySession {
  id: string;
  conversationId: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  score: number;
  totalQuestions: number;
  isCompleted: boolean;
  createdAt: Date;
  // =================================================================
  // == START OF CHANGES
  // =================================================================
  assignmentId?: string; // To link session to a specific assignment
  // =================================================================
  // == END OF CHANGES
  // =================================================================
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  userAnswer?: number;
  isCorrect?: boolean;
}

// --- NEWLY ADDED ---
export interface GeneratedQuiz {
  id: string;
  topic: string;
  questions: QuizQuestion[];
  created_at: Date;
  // =================================================================
  // == START OF CHANGES
  // =================================================================
  teacher_id: string;
  // =================================================================
  // == END OF CHANGES
  // =================================================================
}

export interface FlaggedMessage {
    id: string;
    message_content: string;
    student_id: string;
    student_name: string; // From joined profile
    created_at: string;
}
// =================================================================
// == START OF CHANGES
// =================================================================
export interface QuizAssignment {
  id: string;
  quiz_id: string;
  teacher_id: string;
  student_id: string;
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
  score: number | null;
  total_questions: number | null;
}

export interface QuizAssignmentWithDetails extends QuizAssignment {
  generated_quizzes: {
    topic: string;
    questions: QuizQuestion[];
  };
  profiles: {
    full_name: string | null; // Teacher's name
  };
}
// =================================================================
// == END OF CHANGES
// =================================================================
// -------------------

export type Role = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  teacher_id: string | null;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id'> & { id: string };
        Update: Partial<Profile>;
      }
      conversations: {
        Row: any;
        Insert: any;
        Update: any;
      }
      messages: { // <-- ADD THIS for type safety if you want
        Row: any;
        Insert: any;
        Update: any;
      }
      notes: {
        Row: any;
        Insert: any;
        Update: any;
      }
      quizzes: {
        Row: any;
        Insert: any;
        Update: any;
      }
      flagged_messages: {
          Row: any;
          Insert: any;
          Update: any;
      }
      // =================================================================
      // == START OF CHANGES
      // =================================================================
      generated_quizzes: {
        Row: any;
        Insert: any;
        Update: any;
      }
      quiz_assignments: {
        Row: any;
        Insert: any;
        Update: any;
      }
      // =================================================================
      // == END OF CHANGES
      // =================================================================
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
    }
  }
}
