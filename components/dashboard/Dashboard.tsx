import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../Logo';
import { UserRole } from '../../types';

// Lazy load dashboard components for better performance
const ClientDashboard = lazy(() => import('./ClientDashboard'));
const WorkerDashboard = lazy(() => import('./WorkerDashboard'));
const AgentDashboard = lazy(() => import('./AgentDashboard'));
const SuperAgentDashboard = lazy(() => import('./SuperAgentDashboard'));
const SuperWorkerDashboard = lazy(() => import('./SuperWorkerDashboard'));

interface LoadingDashboardProps {
    message?: string;
    showProgress?: boolean;
}

const LoadingDashboard: React.FC<LoadingDashboardProps> = ({ 
    message = "Loading Dashboard...", 
    showProgress = false 
}) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <Logo className="w-32 h-32 animate-spin" />
        <p className="mt-4 text-gray-600">{message}</p>
        {showProgress && (
            <div className="mt-4 w-64 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
        )}
    </div>
);

interface ErrorDashboardProps {
    error: string;
    userRole?: string;
    onRetry?: () => void;
    onLogout?: () => void;
}

const ErrorDashboard: React.FC<ErrorDashboardProps> = ({ 
    error, 
    userRole, 
    onRetry, 
    onLogout 
}) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-700 mb-2">Dashboard Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            {userRole && (
                <p className="text-sm text-gray-500 mb-4">
                    Current role: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{userRole}</span>
                </p>
            )}
            <div className="flex space-x-3 justify-center">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                )}
                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Logout
                    </button>
                )}
            </div>
        </div>
    </div>
);

// Role validation and dashboard mapping
const VALID_ROLES: UserRole[] = ['client', 'worker', 'agent', 'super_agent', 'super_worker'];

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
    'client': 'Client',
    'worker': 'Worker', 
    'agent': 'Agent',
    'super_agent': 'Super Agent',
    'super_worker': 'Super Worker'
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    'client': 'Submit and track your project assignments',
    'worker': 'View and complete assigned projects',
    'agent': 'Manage clients and assign projects to workers',
    'super_agent': 'Full system control and network management',
    'super_worker': 'Assign projects to sub-workers and manage assignments'
};

const Dashboard: React.FC = () => {
    const { user, loading, logout } = useAuth();
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [roleVerified, setRoleVerified] = useState(false);

    // Role verification effect
    useEffect(() => {
        if (user && !loading) {
            verifyUserRole();
        }
    }, [user, loading]);

    const verifyUserRole = async () => {
        if (!user) return;

        try {
            setIsTransitioning(true);
            
            // Verify role with backend
            const response = await fetch('/api/permissions/my-permissions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to verify user permissions');
            }

            const data = await response.json();
            const backendRole = data.data.role;

            // Check if frontend and backend roles match
            if (backendRole !== user.role) {
                throw new Error(`Role mismatch: Frontend shows "${user.role}" but backend shows "${backendRole}"`);
            }

            // Check if role is valid
            if (!VALID_ROLES.includes(user.role as UserRole)) {
                throw new Error(`Invalid role: "${user.role}". Valid roles are: ${VALID_ROLES.join(', ')}`);
            }

            setRoleVerified(true);
            setDashboardError(null);
        } catch (error) {
            console.error('Role verification failed:', error);
            setDashboardError(error instanceof Error ? error.message : 'Role verification failed');
        } finally {
            // Add a small delay for smooth transition
            setTimeout(() => {
                setIsTransitioning(false);
            }, 500);
        }
    };

    const handleRetry = () => {
        setDashboardError(null);
        setRoleVerified(false);
        verifyUserRole();
    };

    // Loading states
    if (loading) {
        return <LoadingDashboard message="Authenticating..." showProgress={true} />;
    }

    if (!user) {
        return <LoadingDashboard message="Please log in to continue" />;
    }

    if (isTransitioning) {
        return <LoadingDashboard message={`Loading ${ROLE_DISPLAY_NAMES[user.role as UserRole] || user.role} Dashboard...`} showProgress={true} />;
    }

    // Error handling
    if (dashboardError) {
        return (
            <ErrorDashboard 
                error={dashboardError}
                userRole={user.role}
                onRetry={handleRetry}
                onLogout={logout}
            />
        );
    }

    if (!roleVerified) {
        return <LoadingDashboard message="Verifying permissions..." />;
    }

    // Dashboard routing with lazy loading and smooth transitions
    const renderDashboard = () => {
        const DashboardComponent = () => {
            switch (user.role as UserRole) {
                case 'client':
                    return <ClientDashboard />;
                case 'worker':
                    return <WorkerDashboard />;
                case 'agent':
                    return <AgentDashboard />;
                case 'super_agent':
                    return <SuperAgentDashboard />;
                case 'super_worker':
                    return <SuperWorkerDashboard />;
                default:
                    return (
                        <ErrorDashboard 
                            error={`Unknown role: "${user.role}". This role is not supported by the system.`}
                            userRole={user.role}
                            onRetry={handleRetry}
                            onLogout={logout}
                        />
                    );
            }
        };

        return (
            <Suspense fallback={
                <LoadingDashboard 
                    message={`Loading ${ROLE_DISPLAY_NAMES[user.role as UserRole] || user.role} Dashboard...`} 
                    showProgress={true} 
                />
            }>
                <DashboardComponent />
            </Suspense>
        );
    };

    return (
        <div className="dashboard-container">
            {/* Role-based welcome message */}
            <div className="sr-only">
                Welcome to your {ROLE_DISPLAY_NAMES[user.role as UserRole] || user.role} dashboard. 
                {ROLE_DESCRIPTIONS[user.role as UserRole]}
            </div>
            
            {/* Dashboard content with fade-in animation */}
            <div className="animate-fadeIn">
                {renderDashboard()}
            </div>
        </div>
    );
};

export default Dashboard;
