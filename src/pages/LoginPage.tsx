import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../hooks/useAuth';
import { LogIn, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Successful sign-in will trigger the useEffect hook to navigate.
    } catch (error: any) {
      setErrorMsg(error.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect authenticated users to '/app'
  useEffect(() => {
    if (!authLoading && session && profile) {
      navigate('/app', { replace: true });
    }
  }, [session, profile, authLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid-slate-900 p-4">
      {/* Background overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
      
      {/* Login container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Main login card */}
        <div className="admin-card p-0 overflow-hidden backdrop-blur-xl bg-black/30 border-white/20 shadow-2xl">
          {/* Header section */}
          <div className="p-8 pb-6 text-center border-b border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-6 backdrop-blur-sm border border-white/20">
              <img 
                src="/white-logo.png" 
                alt="AI Tutor Logo" 
                className="w-10 h-10"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-400 text-sm">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* Form section */}
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email field */}
              <div className="space-y-2">
                <label className="input-label">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-style"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="input-label">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-style"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 animate-shake">
                  <p className="text-red-400 text-sm text-center">
                    {errorMsg}
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button 
                type="submit" 
                disabled={isSubmitting || authLoading}
                className="btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer text */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Powered by AI Tutor • Secure Learning Platform
          </p>
        </div>
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl" />
      <div className="absolute bottom-20 right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-xl" />
      <div className="absolute top-1/2 right-10 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl" />
    </div>
  );
};

export default LoginPage;
