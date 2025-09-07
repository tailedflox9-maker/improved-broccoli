import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthProvider'; // Correctly import the context itself

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
