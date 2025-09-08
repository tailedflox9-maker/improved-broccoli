// src/components/Auth/ProtectedRoute.tsx

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; 

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
      // THIS IS THE UPDATED SECTION
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-grid-slate-900 text-white p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50" />
            <div className="relative z-10 text-center max-w-sm w-full animate-fade-in-up">
                <img
                    src="/white-logo.png"
                    alt="AI Tutor Logo"
                    className="w-24 h-24 mx-auto mb-6 pulse-subtle"
                />
                <h1 className="text-3xl font-bold text-white mb-2">
                    Loading Profile
                </h1>
                <p className="text-gray-400 mb-8">
                    Getting your user details ready.
                </p>
                <div className="w-full bg-black/20 border border-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div className="animate-shimmer h-2.5" />
                </div>
            </div>
        </div>
      );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};
