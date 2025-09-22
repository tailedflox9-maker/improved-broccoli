import { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../supabase';
import { getProfile } from '../services/supabaseService';
import { Profile, Role } from '../types';
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

        const initPromise = new Promise<void>(async (resolve, reject) => {
          try {
            // Get the current session
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
                
                const userProfile = await getProfile();
                
                if (isMounted) {
                  console.log('User profile loaded successfully:', userProfile.email, userProfile.role);
                  setProfile(userProfile);
                  setError(null);
                }
              } catch (profileError: any) {
                console.error('Profile loading failed:', profileError.message);
                
                if (isMounted) {
                  // DON'T create fallback - let the app handle no profile gracefully
                  setProfile(null);
                  setError(new Error(`Profile loading failed: ${profileError.message}`));
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

        // Set a timeout for initialization
        initTimeout = setTimeout(() => {
          console.warn('Auth initialization timeout - forcing completion');
          if (isMounted) {
            setLoading(false);
          }
        }, 10000);

        await initPromise;

      } catch (err: any) {
        console.error('Authentication initialization failed:', err);
        
        if (isMounted) {
          if (err.message?.includes('network') || err.message?.includes('connection')) {
            setError(new Error('Connection issue. Please check your internet.'));
          } else {
            console.warn('Non-critical auth error:', err.message);
            setError(null);
          }
          
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

        setError(null);

        if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing all state');
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setSession(newSession);

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
          try {
            console.log('Loading profile after auth change...');
            
            const userProfile = await getProfile();
            
            if (isMounted) {
              console.log('Profile updated after auth change:', userProfile.role);
              setProfile(userProfile);
            }
          } catch (profileError: any) {
            console.error('Profile loading failed after auth change:', profileError.message);
            
            // CRITICAL: Don't create fallbacks on auth state changes
            // This preserves existing profile and prevents role switching
            if (isMounted && !profile) {
              console.log('No existing profile to preserve, setting to null');
              setProfile(null);
              setError(new Error('Profile loading failed'));
            } else if (isMounted) {
              console.log('Preserving existing profile to prevent role switching. Current role:', profile?.role);
              // Keep existing profile - don't overwrite with fallback
            }
          }
        }

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
  }, [profile?.role]); // Add dependency to prevent unnecessary re-renders

  const logout = useCallback(async () => {
    try {
      console.log('Initiating logout...');
      
      setLoading(true);
      setProfile(null);
      setError(null);
      
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
