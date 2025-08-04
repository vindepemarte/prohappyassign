import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import ClientDashboard from './ClientDashboard';
import WorkerDashboard from './WorkerDashboard';
import AgentDashboard from './AgentDashboard';
import Logo from '../Logo';

const LoadingDashboard: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <Logo className="w-32 h-32 animate-spin" />
        <p className="mt-4 text-gray-600">Loading Dashboard...</p>
    </div>
);

const Dashboard: React.FC = () => {
    const { profile, loading } = useAuth();

    if (loading || !profile) {
        return <LoadingDashboard />;
    }

    switch (profile.role) {
        case 'client':
            return <ClientDashboard />;
        case 'worker':
            return <WorkerDashboard />;
        case 'agent':
            return <AgentDashboard />;
        default:
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-700">
                    <h1 className="text-2xl font-bold">Role not recognized!</h1>
                    <p>Please contact support for assistance.</p>
                </div>
            );
    }
};

export default Dashboard;
