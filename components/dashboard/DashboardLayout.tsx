import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../Logo';
import Button from '../Button';
import NotificationManager from './NotificationManager';
import NotificationBell from '../notifications/NotificationBell';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const { profile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#4A90E2] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Logo className="h-12 w-12" />
              <span className="ml-3 font-bold text-xl text-white hidden sm:block">ProHappyAssignments</span>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="text-right">
                <p className="font-semibold text-white">{profile?.full_name}</p>
                <p className="text-xs text-blue-100 capitalize">{profile?.role} Account</p>
              </div>
              <Button onClick={logout} variant="danger" className="py-2 px-4 !w-auto text-sm uppercase">Logout</Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <header className="bg-[#4A90E2] p-4 sm:p-6">
             <h1 className="text-2xl font-bold text-white">{title}</h1>
          </header>
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </main>
      <NotificationManager />
    </div>
  );
};

export default DashboardLayout;