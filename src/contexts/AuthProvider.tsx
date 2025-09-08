import { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../supabase';
import { getProfile } from '../services/supabaseService';
import { Profile } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authInitialized = false;

    const initializeAuth = async () => {
      try {
        console.log('Starting authentication initialization...');

        // Get the current session with retries
        let sessionAttempt = 0;
        let currentSession = null;
        let sessionError = null;

        while (sessionAttempt < 3 && !currentSession && !sessionError) {
          try {
            const { data: { session: attemptSession }, error: attemptError } = await supabase.auth.getSession();
            
            if (attemptError) {
              sessionError = attemptError;
              break;
            }
            
            currentSession = attemptSession;
            break;
          } catch (err) {
            sessionAttempt++;
            if (sessionAttempt < 3) {
              console.log(`Session retrieval attempt ${sessionAttempt} failed, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              sessionError = err;
            }
          }
        }

        if (sessionError) {
          console.error('Session retrieval error after retries:', sessionError);
          throw new Error(`Failed to retrieve session: ${sessionError.message}`);
        }

        if (!isMounted) return;

        console.log('Session status:', currentSession ? 'Active session found' : 'No active session');
        setSession(currentSession);

        if (currentSession?.user) {
          try {
            console.log('Loading user profile for user:', currentSession.user.id);
            
            // Try to get profile with retries and better error handling
            let profileAttempt = 0;
            let userProfile = null;
            let profileError = null;

            while (profileAttempt < 2 && !userProfile && !profileError) {
              try {
                userProfile = await getProfile();
                break;
              } catch (err: any) {
                profileAttempt++;
                profileError = err;
                
                if (profileAttempt < 2) {
                  console.log(`Profile loading attempt ${profileAttempt} failed, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                  console.error('Profile loading failed after retries:', err);
                }
              }
            }
            
            if (isMounted) {
              if (userProfile) {
                console.log('User profile loaded successfully:', userProfile.email, userProfile.role);
                setProfile(userProfile);
                setError(null);
              } else {
                // Create a more robust fallback profile
                console.warn('Creating fallback profile due to loading issues');
                const fallbackProfile: Profile = {
                  id: currentSession.user.id,
                  email: currentSession.user.email || 'unknown@example.com',
                  full_name: currentSession.user.user_metadata?.full_name || 
                             currentSession.user.email?.split('@')[0] || 'User',
                  role: currentSession.user.user_metadata?.role || 'student',
                  created_at: new Date(),
                  updated_at: new Date(),
                  teacher_id: currentSession.user.user_metadata?.teacher_id || null
                };
                
                setProfile(fallbackProfile);
                // Don't set error for fallback - just log it
                console.warn('Using fallback profile due to:', profileError?.message || 'Profile loading failed');
              }
            }
          } catch (profileError: any) {
            console.error('Critical profile loading error:', profileError);
            
            if (isMounted) {
              // Even if profile loading fails completely, create a basic fallback
              const basicFallback: Profile = {
                id: currentSession.user.id,
                email: currentSession.user.email || 'unknown@example.com',
                full_name: currentSession.user.user_metadata?.full_name || 'User',
                role: 'student', // Default to student if role is unclear
                created_at: new Date(),
                updated_at: new Date(),
                teacher_id: null
              };
              
              console.log('Using basic fallback profile');
              setProfile(basicFallback);
              // Only set error if it's truly critical
              if (profileError.message?.includes('RPC') || profileError.message?.includes('permission')) {
                setError(new Error('Profile access issue. Please try logging out and back in.'));
              }
            }
          }
        } else {
          if (isMounted) {
            console.log('No user session - clearing profile');
            setProfile(null);
            setError(null);
          }
        }

        authInitialized = true;

      } catch (err: any) {
        console.error('Authentication initialization failed:', err);
        
        if (isMounted) {
          // Only set critical errors that require user action
          if (err.message?.includes('network') || err.message?.includes('connection')) {
            setError(new Error('Connection issue. Please check your internet and refresh.'));
          } else if (err.message?.includes('session')) {
            setError(new Error('Session expired. Please log in again.'));
          } else {
            // For other errors, just log them but don't block the user
            console.warn('Non-critical auth error:', err.message);
          }
          
          setSession(null);
          setProfile(null);
        }
        
        authInitialized = true;
      } finally {
        if (isMounted) {
          console.log('Authentication initialization complete - stopping loading');
          setLoading(false);
        }
      }
    };

    // Initialize authentication
    initializeAuth();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state change detected:', event);

        if (!isMounted) return;

        // For sign out events, clear immediately
        if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing all state');
          setSession(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        // Update session state
        setSession(newSession);
        setError(null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (newSession?.user) {
            try {
              console.log('Loading profile after auth change...');
              const userProfile = await getProfile();
              
              if (isMounted) {
                console.log('Profile updated after auth change');
                setProfile(userProfile);
              }
            } catch (profileError: any) {
              console.error('Profile loading failed after auth change:', profileError);
              
              if (isMounted) {
                // Create fallback instead of failing completely
                const fallbackProfile: Profile = {
                  id: newSession.user.id,
                  email: newSession.user.email || 'unknown@example.com',
                  full_name: newSession.user.user_metadata?.full_name || 'User',
                  role: newSession.user.user_metadata?.role || 'student',
                  created_at: new Date(),
                  updated_at: new Date(),
                  teacher_id: newSession.user.user_metadata?.teacher_id || null
                };
                
                setProfile(fallbackProfile);
                console.log('Using fallback profile after auth change');
              }
            }
          }
        }
      }
    );

    return () => {
      console.log('AuthProvider cleanup');
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('Initiating logout...');
      
      // Clear local state immediately to prevent UI flickering
      setLoading(true);
      setProfile(null);
      setError(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        throw error;
      }

      console.log('Logout successful');
      setSession(null);
      setLoading(false);
      
    } catch (error: any) {
      console.error('Error during logout:', error);
      // Even if logout fails, clear local state
      setSession(null);
      setProfile(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  const value = {
    session,
    profile,
    loading,
    error,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
