import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { getProjectsForWorker } from '../../services/assignmentService';
import { Project, ProjectStatus } from '../../types';
import { GBP_TO_INR_RATE, WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import ProjectDetailModal from '../modals/ProjectDetailModal';

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

const WorkerDashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    
    useEffect(() => {
        fetchWorkerProjects();
    }, [user]);

    const fetchWorkerProjects = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await getProjectsForWorker(user.id);
            setProjects(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (projectId: number) => {
        setSelectedProjectId(projectId);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProjectId(null);
        // Refresh project list on close to see any status updates
        fetchWorkerProjects();
    };

    const calculateWorkerPayout = (wordCount: number): number => {
        const payoutGbp = (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
        return payoutGbp * GBP_TO_INR_RATE;
    };

    return (
        <>
            <DashboardLayout title="My Assigned Projects">
                {loading && <div className="text-center text-gray-500">Loading assigned projects...</div>}
                {error && <div className="text-center text-red-500">{error}</div>}
                
                {!loading && !error && projects.length === 0 ? (
                   <div className="text-center py-10 text-gray-500">
                       <p>You have no projects assigned to you at the moment.</p>
                   </div>
                ) : (
                   <div className="space-y-4">
                       {projects.map(project => {
                           const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                           return (
                            <div key={project.id} className="border p-4 rounded-xl bg-slate-50 hover:shadow-md transition-shadow">
                               <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                   <div>
                                       <p className="font-bold text-lg text-[#4A90E2]">{project.title}</p>
                                       <p className="text-sm text-gray-500">Assigned on: {new Date(project.updated_at).toLocaleDateString()}</p>
                                   </div>
                                   <div className="mt-2 sm:mt-0 text-left sm:text-right">
                                       <StatusBadge status={project.status} />
                                   </div>
                               </div>
                               <div className="mt-4 border-t pt-3 text-sm text-gray-600 grid grid-cols-2 gap-2">
                                   <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                   <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()}</p>
                               </div>
                                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                   <p className="font-semibold text-green-800">Your Payout: ₹{calculateWorkerPayout(currentWordCount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                               </div>
                               <div className="mt-4 flex justify-end">
                                    <Button 
                                        className="!w-auto py-2 px-4 text-sm"
                                        onClick={() => handleOpenModal(project.id)}
                                    >
                                        View Details &amp; Actions
                                    </Button>
                               </div>
                           </div>
                       )})}
                   </div>
                )}
            </DashboardLayout>
            
            {isModalOpen && selectedProjectId && (
                <ProjectDetailModal 
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    projectId={selectedProjectId}
                />
            )}
        </>
    );
};

export default WorkerDashboard;