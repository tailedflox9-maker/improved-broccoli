================================================
FILE: src/App.tsx
================================================
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import { InstallPrompt } from './components/InstallPrompt';
import { usePWA } from './hooks/usePWA';
import { useEffect } from 'react';

function App() {
  const { session, profile, loading, error, logout } = useAuth();
  const { isInstallable, isInstalled, installApp, dismissInstallPrompt } = usePWA();

  // Add a failsafe timeout to prevent infinite loading
  useEffect(() => {
    const failsafeTimeout = setTimeout(() => {
      if (loading) {
        console.warn('App loading timeout reached - this might indicate an issue with auth initialization');
      }
    }, 15000); // 15 second failsafe

    return () => clearTimeout(failsafeTimeout);
  }, [loading]);

  // Show loading screen while auth is initializing, but with a more reasonable timeout
  if (loading) {
    return (
        // Use the consistent grid background from the rest of the app
        <div className="flex h-screen w-screen items-center justify-center bg-grid-slate-900 text-white p-4">
            
            {/* Add a subtle gradient overlay for depth, similar to LoginPage */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50" />

            <div className="relative z-10 text-center max-w-sm w-full animate-fade-in-up">
                {/* Use the app logo with a subtle pulsing animation */}
                <img
                    src="/white-logo.png"
                    alt="AI Tutor Logo"
                    className="w-24 h-24 mx-auto mb-6 pulse-subtle"
                />

                {/* Improve typography */}
                <h1 className="text-3xl font-bold text-white mb-2">
                    Initializing AI Tutor
                </h1>
                <p className="text-gray-400 mb-8">
                    Please wait while we set up your session.
                </p>

                {/* Use the existing shimmer animation for the loading bar */}
                <div className="w-full bg-black/20 border border-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div className="animate-shimmer h-2.5" />
                </div>
                
                {/* Style the refresh button to be less intrusive */}
                <button
                    onClick={() => window.location.reload()}
                    className="mt-8 text-sm font-semibold text-gray-400 hover:text-white transition-colors py-2 px-4 rounded-lg hover:bg-white/5"
                >
                    Taking too long? Refresh
                </button>
            </div>
        </div>
    );
  }

  // Only show error screen for critical errors that prevent the app from functioning
  if (error) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white p-4">
              <div className="text-center max-w-md">
                  <div className="text-6xl mb-6">⚠️</div>
                  <h2 className="text-2xl font-bold text-red-400 mb-4">Connection Issue</h2>
                  <p className="mb-6 text-gray-300">{error.message}</p>
                  <div className="space-y-3">
                      <button 
                          onClick={() => window.location.reload()} 
                          className="w-full px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                      >
                          Refresh Page
                      </button>
                      <button 
                          onClick={logout} 
                          className="w-full px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 font-semibold transition-colors"
                      >
                          Go to Login
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  const getHomeRoute = () => {
    // If we don't have a session, go to login
    if (!session) return "/login";
    
    // If we have a session but no profile yet, still allow access to /app
    // The profile will be loaded or created as a fallback
    return "/app";
  };

  return (
    <>
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <LoginPage /> : <Navigate to={getHomeRoute()} replace />} 
        />
        
        {/* Protected Route for the main application */}
        <Route 
          path="/app"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <ChatPage />
            </ProtectedRoute>
          } 
        />

        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
      
      {isInstallable && !isInstalled && ( 
        <InstallPrompt onInstall={installApp} onDismiss={dismissInstallPrompt} /> 
      )}
    </>
  );
}

export default App;
