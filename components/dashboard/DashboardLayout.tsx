import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../Logo';
import Button from '../Button';
import NotificationBell from '../notifications/NotificationBell';
import { UserRole } from '../../types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

// Role-based navigation items
const ROLE_NAVIGATION: Record<UserRole, Array<{ label: string; icon: string; description: string }>> = {
  'super_agent': [
    { label: 'Projects', icon: '📊', description: 'Manage all projects and assignments' },
    { label: 'Analytics', icon: '📈', description: 'View system-wide analytics and reports' },
    { label: 'Agent Management', icon: '👥', description: 'Manage agents and their pricing' },
    { label: 'Hierarchy', icon: '🏗️', description: 'Manage user hierarchy and relationships' },
    { label: 'Broadcast', icon: '📢', description: 'Send notifications to all users' }
  ],
  'agent': [
    { label: 'Projects', icon: '📋', description: 'Manage your client projects' },
    { label: 'Analytics', icon: '📊', description: 'View your performance analytics' },
    { label: 'Settings', icon: '⚙️', description: 'Configure your pricing and preferences' }
  ],
  'super_worker': [
    { label: 'Assignments', icon: '📝', description: 'Assign projects to sub-workers' },
    { label: 'Workers', icon: '👷', description: 'Manage your sub-workers' }
  ],
  'worker': [
    { label: 'My Work', icon: '💼', description: 'View your assigned projects' },
    { label: 'Notifications', icon: '🔔', description: 'Assignment notifications' }
  ],
  'client': [
    { label: 'My Projects', icon: '📁', description: 'View your submitted projects' },
    { label: 'New Project', icon: '➕', description: 'Submit a new assignment' },
    { label: 'Support', icon: '💬', description: 'Contact support' }
  ]
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userRole = user?.role as UserRole;
  const navigationItems = userRole ? ROLE_NAVIGATION[userRole] || [] : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRoleInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'super_agent': 'Super Agent',
      'agent': 'Agent',
      'super_worker': 'Super Worker',
      'worker': 'Worker',
      'client': 'Client'
    };
    return roleNames[role] || role;
  };

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      'super_agent': 'bg-purple-100 text-purple-800',
      'agent': 'bg-blue-100 text-blue-800',
      'super_worker': 'bg-green-100 text-green-800',
      'worker': 'bg-orange-100 text-orange-800',
      'client': 'bg-gray-100 text-gray-800'
    };
    return roleColors[role] || 'bg-gray-100 text-gray-800';
  };

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
              
              {/* Role-based navigation info */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowRoleInfo(!showRoleInfo)}
                  className="text-right hover:bg-blue-600 rounded-lg p-2 transition-colors"
                >
                  <p className="font-semibold text-white">{user?.full_name}</p>
                  <div className="flex items-center justify-end space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user?.role || '')}`}>
                      {getRoleDisplayName(user?.role || '')}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-blue-100 transition-transform ${showRoleInfo ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Role info dropdown */}
                {showRoleInfo && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 animate-fadeIn">
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {getRoleDisplayName(user?.role || '')} Dashboard
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Available features for your role:
                      </p>
                      <div className="space-y-2">
                        {navigationItems.map((item, index) => (
                          <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded transition-colors">
                            <span className="text-lg">{item.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                              <p className="text-xs text-gray-500">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Quick actions */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setShowRoleInfo(false);
                              // Could add navigation logic here
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            Dashboard Help
                          </button>
                          <button
                            onClick={() => {
                              setShowRoleInfo(false);
                              logout();
                            }}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            Switch Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={logout}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
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
    </div>
  );
};

export default DashboardLayout;