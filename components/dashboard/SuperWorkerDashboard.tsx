import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { Project, ProjectStatus, Profile } from '../../types';
import { WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import Select from '../common/Select';
import ModernSearchField from '../common/ModernSearchField';
import LoadingWrapper from '../common/LoadingWrapper';
import ProjectCard from '../common/ProjectCard';
import StatusBadge from '../common/StatusBadge';
import FilterBar, { TimeFilter, EarningsDisplay } from '../common/FilterBar';
import { useRobustLoading } from '../../hooks/useRobustLoading';
import { useAuth } from '../../hooks/useAuth';
import NotificationCenter from './NotificationCenter';

const ALL_STATUSES: ProjectStatus[] = [
    'pending_payment_approval',
    'rejected_payment',
    'awaiting_worker_assignment',
    'in_progress',
    'pending_quote_approval',
    'needs_changes',
    'pending_final_approval',
    'completed',
    'refund',
    'cancelled'
];

const getStatusDescription = (status: ProjectStatus): string => {
    const descriptions: Record<ProjectStatus, string> = {
        'pending_payment_approval': 'Waiting for client payment confirmation',
        'rejected_payment': 'Payment was rejected and needs review',
        'awaiting_worker_assignment': 'Ready to be assigned to a worker',
        'in_progress': 'Currently being worked on by assigned worker',
        'pending_quote_approval': 'Waiting for client to approve quote changes',
        'needs_changes': 'Client has requested modifications',
        'pending_final_approval': 'Waiting for final client approval',
        'completed': 'Project has been successfully completed',
        'refund': 'Project cancelled and requires refund processing',
        'cancelled': 'Project has been cancelled'
    };
    return descriptions[status] || '';
};

const SuperWorkerDashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [workers, setWorkers] = useState<Profile[]>([]);
    const [selectedWorkers, setSelectedWorkers] = useState<{ [projectId: number]: string }>({});
    const [loadingState, loadingActions] = useRobustLoading({
        timeout: 20000,
        maxRetries: 2,
        preventTabSwitchReload: true,
        minLoadingTime: 500
    });

    // Filter and search state
    const [currentFilter, setCurrentFilter] = useState<TimeFilter>({ type: 'month' });
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | ''>('');
    const [assignmentStats, setAssignmentStats] = useState({
        totalProjects: 0,
        assignedProjects: 0,
        unassignedProjects: 0,
        completedProjects: 0
    });

    useEffect(() => {
        fetchSuperWorkerData();
    }, []);

    useEffect(() => {
        if (projects.length > 0) {
            updateFilteredData(projects, currentFilter);
        }
    }, [searchTerm, selectedStatus, projects, currentFilter]);

    const fetchSuperWorkerData = async () => {
        try {
            loadingActions.startLoading();

            // Fetch projects available for assignment (Super Worker can see all projects in their hierarchy)
            const projectsResponse = await fetch('/api/permissions/accessible-projects', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!projectsResponse.ok) {
                throw new Error('Failed to fetch projects');
            }

            const projectsData = await projectsResponse.json();
            setProjects(projectsData.data);

            // Fetch sub-workers (workers in the Super Worker's hierarchy)
            const hierarchyResponse = await fetch('/api/hierarchy/my-subordinates', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (hierarchyResponse.ok) {
                const hierarchyData = await hierarchyResponse.json();
                const subWorkers = hierarchyData.data.filter((u: Profile) => u.role === 'worker');
                setWorkers(subWorkers);
            } else {
                // Fallback: get all workers if hierarchy endpoint fails
                const workersResponse = await fetch('/api/users/by-role/worker', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                });

                if (workersResponse.ok) {
                    const workersData = await workersResponse.json();
                    setWorkers(workersData.data || []);
                }
            }

            loadingActions.stopLoading();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            loadingActions.setError(errorMessage);
        }
    };

    const updateFilteredData = (allProjects: Project[], filter: TimeFilter) => {
        // Apply time filter
        let filtered = allProjects.filter(project => {
            if (filter.startDate && filter.endDate) {
                const projectDate = new Date(project.created_at);
                return projectDate >= filter.startDate && projectDate <= filter.endDate;
            }
            return true;
        });

        // Apply search filter
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(project => 
                project.order_reference?.toLowerCase().includes(searchLower) ||
                project.title?.toLowerCase().includes(searchLower) ||
                project.client_id.toLowerCase().includes(searchLower)
            );
        }

        // Apply status filter
        if (selectedStatus) {
            filtered = filtered.filter(project => project.status === selectedStatus);
        }

        setFilteredProjects(filtered);

        // Calculate assignment statistics
        const stats = {
            totalProjects: allProjects.length,
            assignedProjects: allProjects.filter(p => p.worker_id || p.sub_worker_id).length,
            unassignedProjects: allProjects.filter(p => !p.worker_id && !p.sub_worker_id).length,
            completedProjects: allProjects.filter(p => p.status === 'completed').length
        };
        setAssignmentStats(stats);
    };

    const handleFilterChange = (filter: TimeFilter) => {
        setCurrentFilter(filter);
        updateFilteredData(projects, filter);
    };

    const handleDateRangeChange = (startDate: Date, endDate: Date) => {
        const filter: TimeFilter = {
            type: 'custom',
            startDate,
            endDate
        };
        setCurrentFilter(filter);
        updateFilteredData(projects, filter);
    };

    const handleAssignWorker = async (projectId: number) => {
        const workerId = selectedWorkers[projectId];
        if (!workerId) {
            alert('Please select a worker to assign.');
            return;
        }

        const originalProjects = [...projects];
        const updatedProjects = projects.map(p => 
            p.id === projectId ? { ...p, sub_worker_id: workerId, status: 'in_progress' as ProjectStatus } : p
        );

        setProjects(updatedProjects);
        updateFilteredData(updatedProjects, currentFilter);

        try {
            const response = await fetch(`/api/projects/${projectId}/assign-worker`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ 
                    workerId,
                    assignedBy: 'super_worker' // Indicate this was assigned by Super Worker
                })
            });

            if (!response.ok) {
                throw new Error('Failed to assign worker');
            }

            // Send notification to assigned worker
            await sendAssignmentNotification(projectId, workerId);

        } catch (assignError) {
            console.error('Assignment error:', assignError);
            loadingActions.setError(`Failed to assign worker to project ${projectId}.`);
            setProjects(originalProjects);
            updateFilteredData(originalProjects, currentFilter);
        }
    };

    const sendAssignmentNotification = async (projectId: number, workerId: string) => {
        try {
            const project = projects.find(p => p.id === projectId);
            const worker = workers.find(w => w.id === workerId);
            
            if (!project || !worker) return;

            await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    recipient_id: workerId,
                    title: 'New Project Assignment',
                    message: `You have been assigned to project "${project.title}" (${project.order_reference}). Please check your dashboard for details.`,
                    type: 'assignment',
                    priority: 'normal',
                    metadata: {
                        project_id: projectId,
                        assigned_by: user?.id,
                        assignment_type: 'super_worker_assignment'
                    }
                })
            });
        } catch (error) {
            console.error('Failed to send assignment notification:', error);
        }
    };

    const calculateWorkerPayout = (wordCount: number): number => {
        return (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedStatus('');
        updateFilteredData(projects, currentFilter);
    };

    return (
        <DashboardLayout title="Super Worker Control Panel">
            {/* Assignment Statistics */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{assignmentStats.totalProjects}</div>
                        <div className="text-sm text-gray-500">Total Projects</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{assignmentStats.assignedProjects}</div>
                        <div className="text-sm text-gray-500">Assigned</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{assignmentStats.unassignedProjects}</div>
                        <div className="text-sm text-gray-500">Unassigned</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{assignmentStats.completedProjects}</div>
                        <div className="text-sm text-gray-500">Completed</div>
                    </div>
                </div>
            </div>

            {/* Notification Center */}
            <div className="mb-6">
                <NotificationCenter userId={user?.id || ''} userRole="super_worker" />
            </div>

            {/* Filter Bar */}
            <div className="mb-6">
                <FilterBar
                    onFilterChange={handleFilterChange}
                    onDateRangeChange={handleDateRangeChange}
                    currentFilter={currentFilter}
                    showEarnings={false}
                    className="mb-4"
                />
            </div>

            {/* Search and Filter Controls */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                            Search Projects
                        </label>
                        <ModernSearchField
                            placeholder="Search by order reference, title, or client ID"
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
                            {ALL_STATUSES.map(status => (
                                <option key={status} value={status}>
                                    {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </option>
                            ))}
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

            {/* Projects List */}
            <LoadingWrapper
                isLoading={loadingState.isLoading}
                error={loadingState.error}
                onRetry={loadingActions.retry}
            >
                {!loadingState.isLoading && filteredProjects.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <p>No projects found for the selected criteria.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map(project => {
                            const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                            const workerPayout = calculateWorkerPayout(currentWordCount);
                            const assignedWorker = workers.find(w => w.id === (project.worker_id || project.sub_worker_id));

                            return (
                                <ProjectCard key={project.id} project={project}>
                                    <div className="p-4 space-y-2 text-sm text-gray-700 flex-grow">
                                        <p><strong>Client ID:</strong> {project.client_id.substring(0, 8)}...</p>
                                        <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                        <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()} {project.adjusted_word_count ? <span className="text-purple-600">(Adjusted)</span> : ''}</p>
                                        
                                        <div className="mt-2 pt-2 border-t">
                                            <p><strong>Standard Rate:</strong> £{workerPayout.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-sm text-gray-500">6.25 × {(currentWordCount / 500).toFixed(1)} (500-word blocks)</p>
                                        </div>

                                        <div className="mt-2 pt-2 border-t">
                                            <StatusBadge status={project.status} />
                                            <p className="text-xs text-gray-500 mt-1">
                                                {getStatusDescription(project.status)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-100 p-4 border-t rounded-b-xl space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Worker Assignment:</label>
                                            {assignedWorker ? (
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-green-800">
                                                        ✅ Assigned to: {assignedWorker.full_name}
                                                    </p>
                                                    <p className="text-xs text-green-600 mt-1">
                                                        Worker ID: {assignedWorker.id.substring(0, 8)}...
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <Select
                                                        containerClassName="w-full"
                                                        onChange={(value) => setSelectedWorkers(prev => ({ ...prev, [project.id]: value }))}
                                                        value={selectedWorkers[project.id] || ""}
                                                        placeholder="Select a sub-worker"
                                                        options={workers.map(w => ({
                                                            value: w.id,
                                                            label: `${w.full_name} (${w.id.substring(0, 6)}...)`
                                                        }))}
                                                    />
                                                    <Button 
                                                        className="!w-full py-2 text-sm" 
                                                        onClick={() => handleAssignWorker(project.id)}
                                                        disabled={!selectedWorkers[project.id]}
                                                    >
                                                        Assign & Notify Worker
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ProjectCard>
                            );
                        })}
                    </div>
                )}
            </LoadingWrapper>
        </DashboardLayout>
    );
};

export default SuperWorkerDashboard;