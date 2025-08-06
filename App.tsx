import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './components/dashboard/Dashboard';
import Logo from './components/Logo';
import { initializeOrderReferences } from './services/initializeOrderReferences';
import { initializeNotificationSystem } from './services/notificationTracker';
import { performanceMonitor } from './utils/performanceMonitor';

const App: React.FC = () => {
  const { session, loading } = useAuth();

  // Initialize order references, notification system, and performance monitoring on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize performance monitoring immediately
        performanceMonitor.initialize();
        
        if (session) {
          // Initialize services with error handling
          try {
            await initializeOrderReferences();
          } catch (error) {
            console.error('Failed to initialize order references:', error);
          }
          
          try {
            await initializeNotificationSystem();
          } catch (error) {
            console.error('Failed to initialize notification system:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      performanceMonitor.disconnect();
    };
  }, [session]);

  // Show auth page immediately if no session, no loading screen
  if (!session) {
    return <AuthPage />;
  }

  // Show dashboard immediately if session exists, no loading screen
  return <Dashboard />;
};

export default App;