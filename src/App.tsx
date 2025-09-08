import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import { InstallPrompt } from './components/InstallPrompt';
import { usePWA } from './hooks/usePWA';

function App() {
  const { session, profile, loading, error, logout } = useAuth();
  const { isInstallable, isInstalled, installApp, dismissInstallPrompt } = usePWA();

  // Show loading screen while auth is initializing
  if (loading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-lg">Initializing AI Tutor...</p>
                <p className="text-sm text-gray-400 mt-2">Please wait while we set up your session</p>
            </div>
        </div>
    );
  }

  // Only show error screen for critical errors that prevent the app from functioning
  if (error && (!session || !profile)) {
      // Check if it's a critical error that requires user action
      const isCriticalError = error.message.includes('Session expired') || 
                             error.message.includes('Connection issue') ||
                             error.message.includes('Permission denied');
      
      if (isCriticalError) {
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
  }

  const getHomeRoute = () => {
    if (!session || !profile) return "/login";
    
    // All authenticated roles now go to the main app view
    switch (profile.role) {
      case 'admin': return "/app";
      case 'teacher': return "/app";
      case 'student': return "/app";
      default: return "/app";
    }
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={!session ? <LoginPage /> : <Navigate to={getHomeRoute()} replace />} />
        
        {/* Protected Route for the main application */}
        <Route 
          path="/app"
          element={<ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}><ChatPage /></ProtectedRoute>} 
        />

        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
      
      {isInstallable && !isInstalled && ( <InstallPrompt onInstall={installApp} onDismiss={dismissInstallPrompt} /> )}
    </>
  );
}

export default App;
