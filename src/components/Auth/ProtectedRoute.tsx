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
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
            <p>Loading user profile...</p>
        </div>
      );
  }

  // **THE FIX IS HERE:** If a user's role is not allowed, they are now correctly sent back to '/app'.
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // A user is trying to access a page they don't have permission for.
    // We send them back to the main app page.
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};
