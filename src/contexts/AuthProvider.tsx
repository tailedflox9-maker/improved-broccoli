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
    let initTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('Starting authentication initialization...');

        // Set a maximum timeout for the entire initialization process
        const initPromise = new Promise<void>(async (resolve, reject) => {
          try {
            // Get the current session - simplified approach
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
              console.error('Session retrieval error:', sessionError);
              throw new Error(`Session error: ${sessionError.message}`);
            }

            if (!isMounted) {
              resolve();
              return;
            }

            console.log('Session status:', currentSession ? 'Active session found' : 'No active session');
            setSession(currentSession);

            if (currentSession?.user) {
              try {
                console.log('Loading user profile for user:', currentSession.user.id);
                
                // Try to get profile with a timeout
                const profilePromise = getProfile();
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Profile loading timeout')), 8000);
                });

                const userProfile = await Promise.race([profilePromise, timeoutPromise]) as Profile;
                
                if (isMounted) {
                  console.log('User profile loaded successfully:', userProfile.email, userProfile.role);
                  setProfile(userProfile);
                  setError(null);
                }
              } catch (profileError: any) {
                console.warn('Profile loading failed, creating fallback:', profileError.message);
                
                if (isMounted) {
                  // Create a robust fallback profile
                  const fallbackProfile: Profile = {
                    id: currentSession.user.id,
                    email: currentSession.user.email || 'unknown@example.com',
                    full_name: currentSession.user.user_metadata?.full_name || 'User',
                    role: currentSession.user.user_metadata?.role || 'student',
                    teacher_id: currentSession.user.user_metadata?.teacher_id || null
                  };
                  
                  setProfile(fallbackProfile);
                  setError(null); // Don't treat fallback as an error
                  console.log('Using fallback profile - app will continue working');
                }
              }
            } else {
              if (isMounted) {
                console.log('No user session - clearing profile');
                setProfile(null);
                setError(null);
              }
            }

            resolve();
          } catch (err: any) {
            reject(err);
          }
        });

        // Set a hard timeout for initialization
        initTimeout = setTimeout(() => {
          console.warn('Auth initialization timeout - forcing completion');
          if (isMounted) {
            setLoading(false);
            // If we have a session but no profile, create a basic one
            if (session?.user && !profile) {
              const basicProfile: Profile = {
                id: session.user.id,
                email: session.user.email || 'user@example.com',
                full_name: 'User',
                role: 'student',
                teacher_id: null
              };
              setProfile(basicProfile);
            }
          }
        }, 10000); // 10 second hard limit

        await initPromise;

      } catch (err: any) {
        console.error('Authentication initialization failed:', err);
        
        if (isMounted) {
          // Only set error for truly critical issues
          if (err.message?.includes('network') || err.message?.includes('connection')) {
            setError(new Error('Connection issue. Please check your internet.'));
          } else {
            // For other errors, just log them but don't block the user
            console.warn('Non-critical auth error:', err.message);
            setError(null);
          }
          
          // Clear session on critical errors only
          if (err.message?.includes('Session expired') || err.message?.includes('Invalid session')) {
            setSession(null);
            setProfile(null);
          }
        }
      } finally {
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
        
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

        // Clear any existing errors on auth changes
        setError(null);

        // For sign out events, clear immediately
        if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing all state');
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Update session state
        setSession(newSession);

        // For sign in or token refresh, load profile
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
          try {
            console.log('Loading profile after auth change...');
            
            // Quick profile load with timeout
            const profilePromise = getProfile();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Profile timeout')), 5000);
            });

            const userProfile = await Promise.race([profilePromise, timeoutPromise]) as Profile;
            
            if (isMounted) {
              console.log('Profile updated after auth change');
              setProfile(userProfile);
            }
          } catch (profileError: any) {
            console.warn('Profile loading failed after auth change, using fallback:', profileError.message);
            
            // Only create a fallback profile if one doesn't already exist.
            // This prevents a valid profile from being overwritten by a temporary network error.
            if (isMounted && !profile) {
              const fallbackProfile: Profile = {
                id: newSession.user.id,
                email: newSession.user.email || 'unknown@example.com',
                full_name: newSession.user.user_metadata?.full_name || 'User',
                role: newSession.user.user_metadata?.role || 'student',
                teacher_id: newSession.user.user_metadata?.teacher_id || null
              };
              setProfile(fallbackProfile);
              console.log('Using fallback profile as no profile was present.');
            } else if (isMounted) {
              console.log('An existing profile is already loaded; not overwriting due to a refresh error.');
            }
          }
        }

        // Ensure loading is always set to false after auth state changes
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('AuthProvider cleanup');
      isMounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
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
