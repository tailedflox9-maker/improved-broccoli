import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
// TeacherDashboard is no longer a page, so we remove the import
// import TeacherDashboard from './pages/TeacherDashboard'; 
import { InstallPrompt } from './components/InstallPrompt';
import { usePWA } from './hooks/usePWA';

function App() {
  const { session, profile, loading, error, logout } = useAuth();
  const { isInstallable, isInstalled, installApp, dismissInstallPrompt } = usePWA();

  if (loading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
            <p>Initializing AI Tutor...</p>
        </div>
    );
  }

  if (session && !profile && error) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white p-4">
              <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-400 mb-4">Authentication Error</h2>
                  <p className="mb-6 text-gray-300">We couldn't load your user profile. This might be a temporary issue.</p>
                  <p className="text-xs text-gray-500 mb-4 break-all">Details: {error.message}</p>
                  <button onClick={logout} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold">
                      Return to Login
                  </button>
              </div>
          </div>
      );
  }

  const getHomeRoute = () => {
    if (!session || !profile) return "/login";
    
    // All authenticated roles now go to the main app view
    switch (profile.role) {
      case 'admin': return "/app";
      case 'teacher': return "/app"; // Teachers now go to /app
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

        {/* The separate dashboard route is now removed */}
        {/* <Route 
          path="/dashboard"
          element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>}
        /> */}

        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
      
      {isInstallable && !isInstalled && ( <InstallPrompt onInstall={installApp} onDismiss={dismissInstallPrompt} /> )}
    </>
  );
}

export default App;
