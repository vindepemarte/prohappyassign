

import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { getAllProjectsForAgent, updateProjectStatus, getAllWorkers, assignWorkerToProject } from '../../services/assignmentService';
import { Project, ProjectStatus, Profile } from '../../types';
import { WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import Select from '../common/Select';
import AgentNotificationSender from './AgentNotificationSender';

const ALL_STATUSES: ProjectStatus[] = [
    'pending_payment_approval',
    'rejected_payment',
    'awaiting_worker_assignment',
    'in_progress',
    'pending_quote_approval',
    'needs_changes',
    'pending_final_approval',
    'completed'
];

const StatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
    const statusStyles: Record<ProjectStatus, string> = {
        pending_payment_approval: 'bg-orange-100 text-orange-800',
        rejected_payment: 'bg-red-100 text-red-800',
        awaiting_worker_assignment: 'bg-cyan-100 text-cyan-800',
        in_progress: 'bg-blue-100 text-blue-800',
        pending_quote_approval: 'bg-purple-100 text-purple-800',
        needs_changes: 'bg-yellow-100 text-yellow-800',
        pending_final_approval: 'bg-indigo-100 text-indigo-800',
        completed: 'bg-green-100 text-green-800',
    };
    const formattedStatus = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[status]}`}>
            {formattedStatus}
        </span>
    );
};

const AgentDashboard: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [workers, setWorkers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedWorkers, setSelectedWorkers] = useState<{[projectId: number]: string}>({});
    
    useEffect(() => {
        fetchAgentData();
    }, []);

    const fetchAgentData = async () => {
        try {
            setLoading(true);
            const [projectsData, workersData] = await Promise.all([
                getAllProjectsForAgent(),
                getAllWorkers()
            ]);
            setProjects(projectsData);
            setWorkers(workersData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    };
    
    const calculateWorkerPayoutGbp = (wordCount: number): number => {
        return (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
    };

    const handleStatusChange = async (projectId: number, newStatus: ProjectStatus) => {
        const originalProjects = [...projects];
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
        try {
            await updateProjectStatus(projectId, newStatus);
        } catch (updateError) {
            setError(`Failed to update project ${projectId}.`);
            setProjects(originalProjects);
        }
    };

    const handleAssignWorker = async (projectId: number) => {
        const workerId = selectedWorkers[projectId];
        if (!workerId) {
            alert('Please select a worker to assign.');
            return;
        }
        const originalProjects = [...projects];
        // Optimistically update the UI
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, worker_id: workerId, status: 'in_progress' } : p));
        try {
            await assignWorkerToProject(projectId, workerId);
        } catch (assignError) {
            setError(`Failed to assign worker to project ${projectId}.`);
            setProjects(originalProjects);
        }
    }

    return (
        <DashboardLayout title="Agent Control Panel">
                <div className="mb-8">
                    <AgentNotificationSender />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-t pt-6">All Projects</h2>
                {loading && <div className="text-center text-gray-500">Loading all projects...</div>}
                {error && <div className="text-center text-red-500">{error}</div>}
                 
                {!loading && projects.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <p>There are no projects in the system yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => {
                            const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                            const workerPayout = calculateWorkerPayoutGbp(currentWordCount);
                            const profit = project.cost_gbp - workerPayout;
                            
                            return (
                             <div key={project.id} className={`border rounded-xl bg-slate-50 shadow-md transition-shadow flex flex-col ${project.status === 'pending_quote_approval' ? 'border-2 border-purple-400' : ''}`}>
                                <div className="p-4 bg-white rounded-t-xl">
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-lg text-[#4A90E2] break-all">{project.title}</p>
                                        <StatusBadge status={project.status} />
                                    </div>
                                    <p className="text-xs text-gray-500">Client ID: {project.client_id.substring(0, 8)}...</p>
                                </div>
                                
                                <div className="p-4 border-t space-y-2 text-sm text-gray-700 flex-grow">
                                    <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                    <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()} {project.adjusted_word_count ? <span className="text-purple-600">(Adjusted)</span> : ''}</p>
                                    <div className="mt-2 pt-2 border-t">
                                        <p><strong>Client Price:</strong> £{project.cost_gbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                        <p><strong>Worker Payout:</strong> £{workerPayout.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                        <p className="font-bold text-[#F5A623]"><strong>Profit:</strong> £{profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-100 p-4 border-t rounded-b-xl space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Manage Worker:</label>
                                        {project.worker_id ? (
                                            <p className="text-sm text-gray-600 bg-slate-200 p-2 rounded-lg">Assigned to: {workers.find(w => w.id === project.worker_id)?.full_name || 'Unknown Worker'}</p>
                                        ) : (
                                            <div className="flex space-x-2">
                                                <Select
                                                    containerClassName="flex-grow"
                                                    onChange={(e) => setSelectedWorkers(prev => ({...prev, [project.id]: e.target.value}))}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select a worker</option>
                                                    {workers.map(w => <option key={w.id} value={w.id}>{w.full_name} ({w.id.substring(0,6)}...)</option>)}
                                                </Select>
                                                <Button className="!w-auto py-2 px-3 text-xs" onClick={() => handleAssignWorker(project.id)}>Assign</Button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <Select
                                            label="Update Status:"
                                            value={project.status}
                                            onChange={(e) => handleStatusChange(project.id, e.target.value as ProjectStatus)}
                                        >
                                            {ALL_STATUSES.map(status => (
                                                <option key={status} value={status}>
                                                    {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                 )}
        </DashboardLayout>
    );
};

export default AgentDashboard;