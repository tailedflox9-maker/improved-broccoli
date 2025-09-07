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

    const forceStopLoading = () => {
      if (isMounted && !authInitialized) {
        console.log('Force stopping loading - auth setup took too long');
        setLoading(false);
        setError(new Error('Authentication setup timed out. Please refresh and try again.'));
      }
    };

    // Set a 8-second timeout to prevent infinite loading
    const timeoutId = setTimeout(forceStopLoading, 8000);

    const initializeAuth = async () => {
      try {
        console.log('Starting authentication initialization...');

        // Get the current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          throw new Error(`Failed to retrieve session: ${sessionError.message}`);
        }

        if (!isMounted) return;

        console.log('Session status:', currentSession ? 'Active session found' : 'No active session');
        setSession(currentSession);

        if (currentSession?.user) {
          try {
            console.log('Loading user profile for user:', currentSession.user.id);
            
            // Add timeout to profile loading
            const profilePromise = getProfile();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Profile loading timeout')), 5000);
            });
            
            const userProfile = await Promise.race([profilePromise, timeoutPromise]) as any;
            
            if (isMounted) {
              console.log('User profile loaded successfully:', userProfile.email, userProfile.role);
              setProfile(userProfile);
              setError(null);
            }
          } catch (profileError: any) {
            console.error('Failed to load user profile:', profileError);
            
            if (isMounted) {
              // Create a fallback profile to prevent blocking
              const fallbackProfile = {
                id: currentSession.user.id,
                email: currentSession.user.email || 'unknown@example.com',
                full_name: currentSession.user.user_metadata?.full_name || 'User',
                role: currentSession.user.user_metadata?.role || 'student',
                created_at: new Date(),
                updated_at: new Date()
              };
              
              console.log('Using fallback profile:', fallbackProfile);
              setProfile(fallbackProfile);
              setError(new Error(`Profile loading issue (using fallback): ${profileError.message}`));
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
          setError(err);
          setSession(null);
          setProfile(null);
        }
        
        authInitialized = true;
      } finally {
        if (isMounted) {
          console.log('Authentication initialization complete - stopping loading');
          setLoading(false);
          clearTimeout(timeoutId);
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
                setProfile(null);
                setError(new Error(`Profile loading failed: ${profileError.message}`));
              }
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing profile');
          if (isMounted) {
            setProfile(null);
          }
        }
      }
    );

    return () => {
      console.log('AuthProvider cleanup');
      isMounted = false;
      clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('Initiating logout...');
      
      // Clear local state immediately
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
      
    } catch (error: any) {
      console.error('Error during logout:', error);
      setError(new Error(`Logout failed: ${error.message}`));
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
