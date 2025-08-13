import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { Project, ProjectStatus } from '../../types';
import Button from '../Button';
import ProjectDetailModal from '../modals/ProjectDetailModal';
import LoadingWrapper from '../common/LoadingWrapper';
import ProjectCard from '../common/ProjectCard';
import StatusBadge from '../common/StatusBadge';
import ModernSearchField from '../common/ModernSearchField';
import { useRobustLoading } from '../../hooks/useRobustLoading';
import NotificationCenter from './NotificationCenter';


// StatusBadge component moved to components/common/StatusBadge.tsx

const WorkerDashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | ''>('');
    const [loadingState, loadingActions] = useRobustLoading({
        timeout: 15000, // 15 seconds for project loading
        maxRetries: 2,
        preventTabSwitchReload: true,
        minLoadingTime: 500
    });

    // Assignment notifications state
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        fetchWorkerProjects();
        fetchAssignmentNotifications();
    }, [user]);

    useEffect(() => {
        updateFilteredProjects();
    }, [projects, searchTerm, selectedStatus]);

    const fetchWorkerProjects = async () => {
        if (!user) return;

        try {
            loadingActions.startLoading();

            // Fetch only projects assigned to this worker (worker_id or sub_worker_id)
            const response = await fetch('/api/permissions/accessible-projects', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch assigned projects');
            }

            const data = await response.json();
            setProjects(data.data);
            loadingActions.stopLoading();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            loadingActions.setError(errorMessage);
        }
    };

    const fetchAssignmentNotifications = async () => {
        if (!user) return;

        try {
            const response = await fetch(`/api/notifications/history/${user.id}?type=assignment`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setNotifications(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch assignment notifications:', error);
        }
    };

    const updateFilteredProjects = () => {
        let filtered = projects;

        // Apply search filter
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(project => 
                project.order_reference?.toLowerCase().includes(searchLower) ||
                project.title?.toLowerCase().includes(searchLower)
            );
        }

        // Apply status filter
        if (selectedStatus) {
            filtered = filtered.filter(project => project.status === selectedStatus);
        }

        setFilteredProjects(filtered);
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

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedStatus('');
    };

    const getAssignmentSource = (project: Project) => {
        if (project.sub_worker_id === user?.id) {
            return 'Assigned by Super Worker';
        } else if (project.worker_id === user?.id) {
            return 'Assigned by Agent';
        }
        return 'Direct Assignment';
    };

    return (
        <>
            <DashboardLayout title="My Assigned Projects">
                {/* Assignment Overview */}
                <div className="mb-6 bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{projects.length}</div>
                            <div className="text-sm text-gray-500">Total Assigned</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {projects.filter(p => p.status === 'completed').length}
                            </div>
                            <div className="text-sm text-gray-500">Completed</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                                {projects.filter(p => p.status === 'in_progress').length}
                            </div>
                            <div className="text-sm text-gray-500">In Progress</div>
                        </div>
                    </div>
                </div>

                {/* Notification Center */}
                <div className="mb-6">
                    <NotificationCenter userId={user?.id || ''} userRole="worker" />
                </div>

                {/* Search and Filter Controls */}
                <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                        <div className="flex-1 min-w-0">
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                Search Projects
                            </label>
                            <ModernSearchField
                                placeholder="Search by order reference or title"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Status
                            </label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus | '')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                <option value="">All Statuses</option>
                                <option value="in_progress">In Progress</option>
                                <option value="needs_changes">Needs Changes</option>
                                <option value="pending_final_approval">Pending Final Approval</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div className="flex-shrink-0">
                            <button
                                onClick={clearAllFilters}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <LoadingWrapper
                    isLoading={loadingState.isLoading}
                    error={loadingState.error}
                    onRetry={loadingActions.retry}
                    loadingText="Loading assigned projects..."
                    isEmpty={projects.length === 0}
                    showProgress={true}
                    emptyState={
                        <div className="text-center py-10 text-gray-500">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
                                <p className="text-lg font-medium text-gray-600 mb-2">No Projects Assigned</p>
                                <p className="text-sm">You have no projects assigned to you at the moment.</p>
                                <p className="text-sm mt-2 text-blue-600">Check back later or contact your supervisor.</p>
                            </div>
                        </div>
                    }
                >

                    {/* Projects List */}
                    <div className="space-y-4">
                        {/* Show filter info if filtering is active */}
                        {filteredProjects.length !== projects.length && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-700">
                                    Showing {filteredProjects.length} of {projects.length} assigned projects
                                </p>
                            </div>
                        )}

                        {filteredProjects.map(project => {
                            const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                            const assignmentSource = getAssignmentSource(project);
                            
                            return (
                                <ProjectCard key={project.id} project={project}>
                                    <div className="p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                            <p className="text-sm text-gray-500">
                                                {assignmentSource}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Assigned on: {new Date(project.updated_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        
                                        <div className="mt-4 border-t pt-3 text-sm text-gray-600 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                                <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()}</p>
                                            </div>
                                            {project.adjusted_word_count && (
                                                <p className="text-purple-600 text-xs">
                                                    Word count has been adjusted from {project.initial_word_count.toLocaleString()}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-3 border rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <StatusBadge status={project.status} />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-600">
                                                        Order: {project.order_reference}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                className="!w-auto py-2 px-4 text-sm"
                                                onClick={() => handleOpenModal(project.id)}
                                            >
                                                View Details & Work
                                            </Button>
                                        </div>
                                    </div>
                                </ProjectCard>
                            )
                        })}

                        {/* No Filtered Projects */}
                        {projects.length > 0 && filteredProjects.length === 0 && (
                            <div className="text-center py-10">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                                    <p className="text-yellow-800 font-medium mb-2">No Projects Match Filters</p>
                                    <p className="text-yellow-700 text-sm">
                                        Try adjusting your search or status filter to see more projects.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </LoadingWrapper>
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