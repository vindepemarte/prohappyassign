
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getProjectsForUser, approveQuoteChange, rejectQuoteChange, rejectDeadlineChange, calculatePrice } from '../../services/assignmentService';
import { Project, ProjectStatus } from '../../types';
import Button from '../Button';
import RequestChangesModal from '../modals/RequestChangesModal';
import DownloadFilesModal from '../modals/DownloadFilesModal';
import Select from '../common/Select';

type StatusFilter = 'all' | ProjectStatus;
type SortType = 'newest' | 'oldest';

const StatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
    const statusStyles: Record<ProjectStatus, string> = {
        pending_payment_approval: 'bg-orange-100 text-orange-800',
        rejected_payment: 'bg-red-100 text-red-800',
        awaiting_worker_assignment: 'bg-cyan-100 text-cyan-800',
        in_progress: 'bg-blue-100 text-blue-800',
        pending_quote_approval: 'bg-purple-100 text-purple-800 border-2 border-purple-300',
        needs_changes: 'bg-yellow-100 text-yellow-800',
        pending_final_approval: 'bg-indigo-100 text-indigo-800',
        completed: 'bg-green-100 text-green-800',
        refund: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-100 text-gray-800',
    };
    const formattedStatus = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[status]}`}>
            {formattedStatus}
        </span>
    );
};

const MyProjects: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [sort, setSort] = useState<SortType>('newest');

    const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
    const [selectedProjectIdForChanges, setSelectedProjectIdForChanges] = useState<number | null>(null);

    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [selectedProjectIdForDownload, setSelectedProjectIdForDownload] = useState<number | null>(null);

    const fetchProjects = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await getProjectsForUser(user.id);
            setProjects(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [user]);

    const handleOpenChangesModal = (projectId: number) => {
        setSelectedProjectIdForChanges(projectId);
        setIsChangesModalOpen(true);
    };
    
    const handleCloseChangesModal = () => {
        setIsChangesModalOpen(false);
        setSelectedProjectIdForChanges(null);
        fetchProjects(); // Refresh on close
    };

    const handleOpenDownloadModal = (projectId: number) => {
        setSelectedProjectIdForDownload(projectId);
        setIsDownloadModalOpen(true);
    };

    const handleCloseDownloadModal = () => {
        setIsDownloadModalOpen(false);
        setSelectedProjectIdForDownload(null);
    };

    const handleApproveQuote = async (projectId: number) => {
        try {
            await approveQuoteChange(projectId);
            fetchProjects();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to approve quote');
        }
    };

    const handleRejectQuote = async (project: Project) => {
        try {
            await rejectQuoteChange(project.id, project.initial_word_count);
            fetchProjects();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to reject quote');
        }
    };

    const handleRejectDeadlineChange = async (project: Project, originalDeadline: Date) => {
        try {
            await rejectDeadlineChange(project.id, originalDeadline);
            fetchProjects();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to reject deadline change');
        }
    };

    const filteredAndSortedProjects = useMemo(() => {
        let result = projects;

        if (filter !== 'all') {
            result = result.filter(p => p.status === filter);
        }

        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [projects, filter, sort]);

    if (loading) {
        return <div className="bg-white rounded-2xl shadow-lg p-6 text-center text-gray-500">Loading projects...</div>;
    }
    
    if (error) {
        return <div className="bg-white rounded-2xl shadow-lg p-6 text-center text-red-500">{error}</div>;
    }

    return (
        <>
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">My Projects &amp; Order History</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Select 
                            value={filter} 
                            onChange={(value) => setFilter(value as StatusFilter)}
                            options={[
                                { value: 'all', label: 'All Statuses' },
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'needs_changes', label: 'Needs Changes' }
                            ]}
                        />
                        <Select 
                            value={sort} 
                            onChange={(value) => setSort(value as SortType)}
                            options={[
                                { value: 'newest', label: 'Newest First' },
                                { value: 'oldest', label: 'Oldest First' }
                            ]}
                        />
                    </div>
                </div>

                {filteredAndSortedProjects.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <p>You haven't submitted any projects yet.</p>
                        <p className="text-sm">Click "New Assignment" to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredAndSortedProjects.map(project => {
                             if (project.status === 'pending_quote_approval') {
                                const originalPrice = calculatePrice(project.initial_word_count);
                                return (
                                    <div key={project.id} className="border-2 border-yellow-400 p-4 rounded-xl bg-yellow-50 shadow-lg">
                                        <div className="text-center mb-3 p-2 bg-yellow-200 text-yellow-800 font-bold rounded-md">
                                            ACTION REQUIRED: New Quote Proposed
                                        </div>
                                        <p className="font-bold text-lg text-purple-800">{project.title}</p>
                                        {project.order_reference && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                Order: <span className="font-mono font-semibold text-blue-600">{project.order_reference}</span>
                                            </p>
                                        )}
                                        <div className="mt-4 border-t pt-3 text-sm text-gray-700 grid grid-cols-2 gap-x-4 gap-y-2">
                                            <div>
                                                <p className="font-semibold">Original:</p>
                                                <p>{project.initial_word_count.toLocaleString()} words</p>
                                                <p>£{originalPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-purple-700">New Proposal:</p>
                                                <p>{project.adjusted_word_count?.toLocaleString()} words</p>
                                                <p>£{project.cost_gbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
                                            <Button onClick={() => handleRejectQuote(project)} variant="danger" className="py-2 px-4 !w-auto text-sm">Reject & Revert</Button>
                                            <Button onClick={() => handleApproveQuote(project.id)} className="py-2 px-4 !w-auto text-sm bg-green-600 border-green-800 hover:bg-green-700">Approve New Quote</Button>
                                        </div>
                                    </div>
                                )
                            }
                            
                            const currentWordCount = project.adjusted_word_count || project.initial_word_count;

                            return (
                                <div key={project.id} className="border p-4 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                        <div>
                                            <p className="font-bold text-lg text-[#4A90E2]">{project.title}</p>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                                <p className="text-sm text-gray-500">Submitted: {new Date(project.created_at).toLocaleDateString()}</p>
                                                {project.order_reference && (
                                                    <p className="text-sm text-gray-600">
                                                        <span className="font-mono font-semibold text-blue-600">{project.order_reference}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:mt-0 text-left sm:text-right">
                                            <StatusBadge status={project.status} />
                                        </div>
                                    </div>
                                    <div className="mt-4 border-t pt-3 text-sm text-gray-600 grid grid-cols-2 gap-2">
                                        <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                        <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()} {project.adjusted_word_count ? <span className="text-purple-600 font-semibold">(Adjusted)</span> : ''}</p>
                                        <p><strong>Price:</strong> £{project.cost_gbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="mt-4 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
                                        <Button
                                            onClick={() => handleOpenDownloadModal(project.id)}
                                            disabled={project.status !== 'completed'}
                                            className="py-2 px-4 !w-auto text-sm"
                                            variant={project.status === 'completed' ? 'primary' : 'ghost'}
                                        >
                                            Download Final Work
                                        </Button>
                                        <Button
                                            onClick={() => handleOpenChangesModal(project.id)}
                                            className="py-2 px-4 !w-auto text-sm"
                                            variant="secondary"
                                        >
                                            Request Changes
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {selectedProjectIdForChanges && (
                <RequestChangesModal 
                    isOpen={isChangesModalOpen} 
                    onClose={handleCloseChangesModal}
                    projectId={selectedProjectIdForChanges}
                />
            )}
             {selectedProjectIdForDownload && (
                <DownloadFilesModal
                    isOpen={isDownloadModalOpen}
                    onClose={handleCloseDownloadModal}
                    projectId={selectedProjectIdForDownload}
                />
            )}
        </>
    );
};

export default MyProjects;
