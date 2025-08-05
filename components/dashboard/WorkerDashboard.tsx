import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from './DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { getProjectsForWorker } from '../../services/assignmentService';
import { Project, ProjectStatus } from '../../types';
import { GBP_TO_INR_RATE, WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import ProjectDetailModal from '../modals/ProjectDetailModal';
import FilterBar, { TimeFilter, EarningsDisplay } from '../common/FilterBar';
import LoadingWrapper from '../common/LoadingWrapper';
import useFilterState from '../../hooks/useFilterState';
import { EarningsCalculator, WorkerEarnings } from '../../utils/earningsCalculator';
import { useLoadingState } from '../../hooks/useLoadingState';
import { performanceMonitor } from '../../utils/performanceMonitor';

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

const WorkerDashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [earningsLoading, setEarningsLoading] = useState(false);
    const [loadingState, loadingActions] = useLoadingState({
        timeout: 15000, // 15 seconds for project loading
        maxRetries: 2
    });

    // Filter state management
    const { currentFilter, setFilter } = useFilterState({
        defaultFilter: { type: 'month' },
        persistToUrl: true,
        urlParamPrefix: 'worker_filter'
    });

    useEffect(() => {
        fetchWorkerProjects();
    }, [user]);

    const fetchWorkerProjects = async () => {
        if (!user) return;

        try {
            loadingActions.startLoading();

            const data = await performanceMonitor.measure(
                'worker-projects-fetch',
                () => getProjectsForWorker(user.id),
                { userId: user.id }
            );

            setProjects(data);
            loadingActions.stopLoading();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            loadingActions.setError(errorMessage);
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

    // Filter projects based on current time filter
    const filteredProjects = useMemo(() => {
        if (!currentFilter.startDate || !currentFilter.endDate) {
            return projects;
        }
        return EarningsCalculator.filterProjectsByTimeRange(projects, currentFilter);
    }, [projects, currentFilter]);

    // Calculate earnings for filtered projects
    const earnings = useMemo((): WorkerEarnings => {
        if (projects.length === 0) {
            return {
                totalGbp: 0,
                totalInr: 0,
                projectCount: 0,
                averagePerProject: 0,
                projects: []
            };
        }
        return EarningsCalculator.calculateWorkerEarnings(projects, currentFilter);
    }, [projects, currentFilter]);

    // Format earnings for display
    const earningsDisplay = useMemo((): EarningsDisplay => ({
        gbp: earnings.totalGbp,
        inr: earnings.totalInr
    }), [earnings]);

    // Handle filter changes
    const handleFilterChange = async (filter: TimeFilter) => {
        setEarningsLoading(true);
        try {
            setFilter(filter);
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 300));
        } finally {
            setEarningsLoading(false);
        }
    };

    // Handle date range changes
    const handleDateRangeChange = (startDate: Date, endDate: Date) => {
        // This is handled by the FilterBar component internally
        // The filter change will trigger through handleFilterChange
    };

    return (
        <>
            <DashboardLayout title="My Assigned Projects">
                {/* Filter Bar with Earnings Display */}
                <div className="mb-6">
                    <FilterBar
                        onFilterChange={handleFilterChange}
                        onDateRangeChange={handleDateRangeChange}
                        currentFilter={currentFilter}
                        earnings={earningsDisplay}
                        showEarnings={true}
                        className="mb-4"
                    />

                    {/* Earnings Summary Card */}
                    {!loadingState.isLoading && !loadingState.error && projects.length > 0 && (
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {earningsLoading ? 'Calculating...' : 'Your Earnings'}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Based on {earnings.projectCount} completed project{earnings.projectCount !== 1 ? 's' : ''}
                                        {currentFilter.type === 'week' && ' this week'}
                                        {currentFilter.type === 'month' && ' this month'}
                                        {currentFilter.type === 'custom' && ' in selected period'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-green-700">
                                        {earningsLoading ? (
                                            <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>
                                        ) : (
                                            `₹${earnings.totalInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {earningsLoading ? (
                                            <div className="animate-pulse bg-gray-200 h-4 w-20 rounded mt-1"></div>
                                        ) : (
                                            `£${earnings.totalGbp.toFixed(2)}`
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                                    Showing {filteredProjects.length} of {projects.length} projects for the selected time period
                                </p>
                            </div>
                        )}

                        {filteredProjects.map(project => {
                            const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                            const isCompleted = project.status === 'completed';
                            return (
                                <div key={project.id} className="border p-4 rounded-xl bg-slate-50 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                        <div>
                                            <p className="font-bold text-lg text-[#4A90E2]">{project.title}</p>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                                <p className="text-sm text-gray-500">
                                                    Assigned on: {new Date(project.updated_at).toLocaleDateString()}
                                                </p>
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
                                        <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()}</p>
                                    </div>
                                    <div className={`mt-3 border rounded-lg p-3 text-center ${isCompleted
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-gray-50 border-gray-200'
                                        }`}>
                                        <p className={`font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-600'
                                            }`}>
                                            {isCompleted ? 'Earned: ' : 'Potential Payout: '}
                                            ₹{calculateWorkerPayout(currentWordCount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </p>
                                        {!isCompleted && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Payment upon completion
                                            </p>
                                        )}
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
                            )
                        })}

                        {/* No Filtered Projects */}
                        {projects.length > 0 && filteredProjects.length === 0 && (
                            <div className="text-center py-10">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                                    <p className="text-yellow-800 font-medium mb-2">No Projects in Selected Period</p>
                                    <p className="text-yellow-700 text-sm">
                                        Try selecting a different time range to see your projects.
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