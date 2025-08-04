import React from 'react';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './components/dashboard/Dashboard';
import Logo from './components/Logo';

const SplashScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#4A90E2]">
        <Logo className="w-48 h-48 animate-pulse" />
    </div>
);

const App: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return <Dashboard />;
};

export default App;