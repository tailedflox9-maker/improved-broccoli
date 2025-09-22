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

    const initializeAuth = async () => {
      try {
        // Get the current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!isMounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          const userProfile = await getProfile();
          if (isMounted) {
            setProfile(userProfile);
            setError(null);
          }
        }
      } catch (err: any) {
        console.error('Authentication initialization failed:', err);
        if (isMounted) {
          setError(new Error(`Authentication failed: ${err.message}`));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setError(null);
          return;
        }

        if (newSession?.user) {
          try {
            const userProfile = await getProfile();
            if (isMounted) {
              setProfile(userProfile);
              setError(null); // Clear previous errors
            }
          } catch (profileError: any) {
            console.error('Profile loading failed after auth change:', profileError.message);
            if (isMounted) {
              setProfile(null); // On failure, clear profile and set an error
              setError(new Error(`Failed to refresh profile: ${profileError.message}`));
            }
          }
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []); // FIX: Run only once on component mount.

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    // The onAuthStateChange listener will handle clearing the state.
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
