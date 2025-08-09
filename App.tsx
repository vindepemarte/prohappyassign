import React from 'react';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './components/dashboard/Dashboard';
import Logo from './components/Logo';

const App: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <Logo className="w-32 h-32 animate-spin" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  // Show auth page if no user
  if (!user) {
    return <AuthPage />;
  }

  // Show the proper dashboard based on user role
  return <Dashboard />;
};

export default App;