import React, { useState } from 'react';
import DashboardLayout from './DashboardLayout';
import MyProjects from './MyAssignments';
import NewProjectForm from '../ClientForm';
import { WHATSAPP_SUPPORT_NUMBER } from '../../constants';

type DashboardTab = 'myAssignments' | 'newAssignment';

const ClientDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('myAssignments');

    const handleFormSuccess = () => {
        // To refresh the list of projects, we switch back to the main tab.
        // The MyProjects component will re-fetch data when it mounts.
        setActiveTab('myAssignments');
    };

    return (
        <DashboardLayout title="Client Dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Navigation and Forms */}
                <div className="lg:col-span-1 space-y-8">
                     <div className="bg-white rounded-2xl shadow-lg p-6 border">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Dashboard Menu</h2>
                        <nav className="space-y-2">
                            <button 
                                onClick={() => setActiveTab('myAssignments')}
                                className={`w-full text-left font-semibold p-3 rounded-lg transition-colors ${activeTab === 'myAssignments' ? 'bg-[#4A90E2] text-white' : 'text-gray-700 hover:bg-slate-100'}`}
                            >
                                My Assignments
                            </button>
                            <button 
                                onClick={() => setActiveTab('newAssignment')}
                                className={`w-full text-left font-semibold p-3 rounded-lg transition-colors ${activeTab === 'newAssignment' ? 'bg-[#4A90E2] text-white' : 'text-gray-700 hover:bg-slate-100'}`}
                            >
                                New Assignment
                            </button>
                            <a 
                                href={`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full block text-left font-semibold p-3 rounded-lg transition-colors text-gray-700 hover:bg-slate-100"
                            >
                                Contact Support
                            </a>
                        </nav>
                    </div>
                    
                    {activeTab === 'newAssignment' && (
                         <div className="bg-white rounded-2xl shadow-lg p-6 border">
                            <NewProjectForm onFormSubmit={handleFormSuccess} />
                        </div>
                    )}
                </div>

                {/* Right Column - Main Content */}
                <div className="lg:col-span-2">
                     {activeTab === 'myAssignments' && <MyProjects key={Date.now()} />}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ClientDashboard;