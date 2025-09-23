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

  // FIXED: Keep track of the established role to prevent switching
  const [establishedRole, setEstablishedRole] = useState<Role | null>(null);

  // Helper function to safely get user role with proper fallback
  const getUserRole = (user: any, currentProfile?: Profile | null): Role => {
    // CRITICAL FIX: Use establishedRole first to prevent role switching
    if (establishedRole) {
      console.log('Using established role to prevent switching:', establishedRole);
      return establishedRole;
    }

    // Priority 1: Use existing profile role if available (prevents role switching)
    if (currentProfile?.role) {
      console.log('Using existing profile role:', currentProfile.role);
      return currentProfile.role;
    }

    // Priority 2: Use user metadata role
    if (user?.user_metadata?.role) {
      console.log('Using user metadata role:', user.user_metadata.role);
      return user.user_metadata.role;
    }

    // Priority 3: Determine role based on email domain or other heuristics
    const email = user?.email || '';
    
    // Check if email suggests teacher/admin role
    if (email.includes('teacher') || email.includes('admin') || email.includes('edu')) {
      console.log('Email suggests teacher role, using teacher as fallback');
      return 'teacher';
    }

    // Priority 4: Final fallback to student (but log this as it might indicate an issue)
    console.warn('No role information available, defaulting to student. This might indicate a data issue.');
    return 'student';
  };

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
                  setEstablishedRole(userProfile.role); // FIXED: Set established role
                  setError(null);
                }
              } catch (profileError: any) {
                console.warn('Profile loading failed, creating fallback:', profileError.message);
                
                if (isMounted) {
                  // Create a robust fallback profile with proper role handling
                  const fallbackRole = getUserRole(currentSession.user, profile);
                  const fallbackProfile: Profile = {
                    id: currentSession.user.id,
                    email: currentSession.user.email || 'unknown@example.com',
                    full_name: currentSession.user.user_metadata?.full_name || 'User',
                    role: fallbackRole,
                    teacher_id: currentSession.user.user_metadata?.teacher_id || null
                  };
                  
                  setProfile(fallbackProfile);
                  setEstablishedRole(fallbackRole); // FIXED: Set established role
                  setError(null); // Don't treat fallback as an error
                  console.log('Using fallback profile with role:', fallbackProfile.role, '- app will continue working');
                }
              }
            } else {
              if (isMounted) {
                console.log('No user session - clearing profile');
                setProfile(null);
                setEstablishedRole(null); // FIXED: Clear established role
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
              const basicRole = getUserRole(session.user, profile);
              const basicProfile: Profile = {
                id: session.user.id,
                email: session.user.email || 'user@example.com',
                full_name: 'User',
                role: basicRole,
                teacher_id: null
              };
              setProfile(basicProfile);
              setEstablishedRole(basicRole); // FIXED: Set established role
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
            setEstablishedRole(null); // FIXED: Clear established role
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
          setEstablishedRole(null); // FIXED: Clear established role on signout
          setLoading(false);
          return;
        }

        // Update session state
        setSession(newSession);

        // CRITICAL FIX: For token refresh events, DON'T reload profile if we already have one
        // This prevents the admin->student role switching bug
        if (event === 'TOKEN_REFRESHED' && profile && establishedRole) {
          console.log('Token refreshed - keeping existing profile and role:', establishedRole);
          setLoading(false);
          return;
        }

        // For sign in or initial load, load profile
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession?.user) {
          // FIXED: Only load profile if we don't already have one with an established role
          if (!profile || !establishedRole) {
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
                setEstablishedRole(userProfile.role); // FIXED: Set established role
              }
            } catch (profileError: any) {
              console.warn('Profile loading failed after auth change, using fallback:', profileError.message);
              
              // FIXED: Only create a fallback profile if one doesn't already exist
              if (isMounted && !profile) {
                const fallbackRole = getUserRole(newSession.user, profile);
                const fallbackProfile: Profile = {
                  id: newSession.user.id,
                  email: newSession.user.email || 'unknown@example.com',
                  full_name: newSession.user.user_metadata?.full_name || 'User',
                  role: fallbackRole,
                  teacher_id: newSession.user.user_metadata?.teacher_id || null
                };
                setProfile(fallbackProfile);
                setEstablishedRole(fallbackRole); // FIXED: Set established role
                console.log('Using fallback profile with role:', fallbackProfile.role, 'as no profile was present.');
              } else if (isMounted) {
                console.log('An existing profile is already loaded; not overwriting due to a refresh error. Current role:', profile?.role);
              }
            }
          } else {
            console.log('Profile already exists with established role:', establishedRole, '- skipping profile reload to prevent role switching');
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
  }, []); // FIXED: Remove profile and establishedRole from dependencies to prevent infinite loops

  const logout = useCallback(async () => {
    try {
      console.log('Initiating logout...');
      
      // Clear local state immediately to prevent UI flickering
      setLoading(true);
      setProfile(null);
      setEstablishedRole(null); // FIXED: Clear established role
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
      setEstablishedRole(null); // FIXED: Clear established role
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
