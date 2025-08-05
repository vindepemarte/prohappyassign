

import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { getAllProjectsForAgent, updateProjectStatus, getAllWorkers, assignWorkerToProject, processRefund } from '../../services/assignmentService';
import { Project, ProjectStatus, Profile } from '../../types';
import { WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import Select from '../common/Select';
import LoadingWrapper from '../common/LoadingWrapper';
import AgentNotificationSender from './AgentNotificationSender';
import NotificationStatusMonitor from './NotificationStatusMonitor';
import FilterBar, { TimeFilter, EarningsDisplay } from '../common/FilterBar';
import { ProfitCalculator } from '../../utils/profitCalculator';
import AnalyticsDashboard from './AnalyticsDashboard';
import { useLoadingState } from '../../hooks/useLoadingState';
import { performanceMonitor } from '../../utils/performanceMonitor';

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

const AgentDashboard: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [workers, setWorkers] = useState<Profile[]>([]);
    const [selectedWorkers, setSelectedWorkers] = useState<{ [projectId: number]: string }>({});
    const [loadingState, loadingActions] = useLoadingState({
        timeout: 20000, // 20 seconds for agent data loading
        maxRetries: 2
    });
    const [showNotificationMonitor, setShowNotificationMonitor] = useState(false);

    // Filter and profit tracking state
    const [currentFilter, setCurrentFilter] = useState<TimeFilter>({ type: 'month' });
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [profitData, setProfitData] = useState<EarningsDisplay | null>(null);

    // Advanced filtering state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedModuleName, setSelectedModuleName] = useState('');
    const [uniqueClientIds, setUniqueClientIds] = useState<string[]>([]);
    const [uniqueModuleNames, setUniqueModuleNames] = useState<string[]>([]);

    // Analytics dashboard state
    const [viewMode, setViewMode] = useState<'docs' | 'charts'>('docs');

    useEffect(() => {
        fetchAgentData();
    }, []);

    // Initialize filter with current month when projects are loaded
    useEffect(() => {
        if (projects.length > 0) {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);

            const initialFilter: TimeFilter = {
                type: 'month',
                startDate: startOfMonth,
                endDate: endOfMonth
            };

            setCurrentFilter(initialFilter);
            updateFilteredData(projects, initialFilter);

            // Extract unique client IDs and module names for filters
            const clientIds = [...new Set(projects.map(p => p.client_id))].sort();
            const moduleNames = [...new Set(projects.map(p => p.title.split(' ')[0] || 'Unknown'))].sort();

            setUniqueClientIds(clientIds);
            setUniqueModuleNames(moduleNames);
        }
    }, [projects]);

    // Update filtered data when search or filter criteria change
    useEffect(() => {
        if (projects.length > 0) {
            updateFilteredData(projects, currentFilter);
        }
    }, [searchTerm, selectedClientId, selectedModuleName]);

    const updateFilteredData = (allProjects: Project[], filter: TimeFilter) => {
        // Calculate profit breakdown for the filtered period
        const profitBreakdown = ProfitCalculator.calculateProfitBreakdown(allProjects, filter);

        // Set profit data for display
        const earnings: EarningsDisplay = {
            gbp: profitBreakdown.totalRevenue,
            inr: 0, // Not needed for agent dashboard
            profit: profitBreakdown.totalProfit,
            toPay: profitBreakdown.totalWorkerPayments
        };

        setProfitData(earnings);

        // Apply all filters: time, search, client ID, and module name
        const filtered = allProjects.filter(project => {
            // Time filter
            if (filter.startDate && filter.endDate) {
                const projectDate = new Date(project.created_at);
                if (projectDate < filter.startDate || projectDate > filter.endDate) {
                    return false;
                }
            }

            // Search term filter (order reference)
            if (searchTerm.trim()) {
                const orderRef = project.order_reference || '';
                if (!orderRef.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }
            }

            // Client ID filter
            if (selectedClientId && project.client_id !== selectedClientId) {
                return false;
            }

            // Module name filter (based on first word of title)
            if (selectedModuleName) {
                const moduleName = project.title.split(' ')[0] || 'Unknown';
                if (moduleName !== selectedModuleName) {
                    return false;
                }
            }

            return true;
        });

        setFilteredProjects(filtered);
    };

    const fetchAgentData = async () => {
        try {
            loadingActions.startLoading();

            const [projectsData, workersData] = await performanceMonitor.measure(
                'agent-data-fetch',
                () => Promise.all([
                    getAllProjectsForAgent(),
                    getAllWorkers()
                ])
            );

            setProjects(projectsData);
            setWorkers(workersData);
            loadingActions.stopLoading();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            loadingActions.setError(errorMessage);
        }
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

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        updateFilteredData(projects, currentFilter);
    };

    const handleClientIdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedClientId(e.target.value);
        updateFilteredData(projects, currentFilter);
    };

    const handleModuleNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedModuleName(e.target.value);
        updateFilteredData(projects, currentFilter);
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            // You could add a toast notification here
            console.log('Copied to clipboard:', text);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedClientId('');
        setSelectedModuleName('');
        updateFilteredData(projects, currentFilter);
    };

    const calculateWorkerPayoutGbp = (wordCount: number): number => {
        return (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
    };

    const handleStatusChange = async (projectId: number, newStatus: ProjectStatus) => {
        const originalProjects = [...projects];
        const currentProject = projects.find(p => p.id === projectId);
        
        if (!currentProject) {
            loadingActions.setError(`Project ${projectId} not found.`);
            return;
        }

        console.log(`Attempting to change project ${projectId} status from ${currentProject.status} to ${newStatus}`);
        
        const updatedProjects = projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p);
        setProjects(updatedProjects);

        // Update filtered data with new status
        updateFilteredData(updatedProjects, currentFilter);

        try {
            await updateProjectStatus(projectId, newStatus);
            console.log(`Successfully updated project ${projectId} status to ${newStatus}`);
        } catch (updateError) {
            console.error(`Failed to update project ${projectId} status:`, updateError);
            const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error occurred';
            
            // If it's a validation error, offer to bypass validation
            if (errorMessage.includes('Invalid status transition')) {
                const shouldBypass = confirm(`Status transition validation failed: ${errorMessage}\n\nAs an agent, you can bypass this validation. Do you want to force this status change?`);
                if (shouldBypass) {
                    try {
                        await updateProjectStatus(projectId, newStatus, true); // Bypass validation
                        console.log(`Successfully updated project ${projectId} status to ${newStatus} (bypassed validation)`);
                        return; // Success, don't revert changes
                    } catch (bypassError) {
                        console.error(`Failed to update project ${projectId} status even with bypass:`, bypassError);
                        loadingActions.setError(`Failed to update project ${projectId} even with bypass: ${bypassError instanceof Error ? bypassError.message : 'Unknown error'}`);
                    }
                }
            } else {
                loadingActions.setError(`Failed to update project ${projectId}: ${errorMessage}`);
            }
            
            // Revert changes on failure
            setProjects(originalProjects);
            updateFilteredData(originalProjects, currentFilter);
        }
    };

    const handleAssignWorker = async (projectId: number) => {
        const workerId = selectedWorkers[projectId];
        if (!workerId) {
            alert('Please select a worker to assign.');
            return;
        }
        const originalProjects = [...projects];
        const updatedProjects = projects.map(p => p.id === projectId ? { ...p, worker_id: workerId, status: 'in_progress' as ProjectStatus } : p);

        // Optimistically update the UI
        setProjects(updatedProjects);
        updateFilteredData(updatedProjects, currentFilter);

        try {
            await assignWorkerToProject(projectId, workerId);
        } catch (assignError) {
            loadingActions.setError(`Failed to assign worker to project ${projectId}.`);
            setProjects(originalProjects);
            updateFilteredData(originalProjects, currentFilter);
        }
    }

    const handleProcessRefund = async (projectId: number) => {
        if (!confirm('Are you sure you want to process this refund? This will change the project status to "cancelled" and notify the client.')) {
            return;
        }

        const originalProjects = [...projects];
        const updatedProjects = projects.map(p => p.id === projectId ? { ...p, status: 'cancelled' as ProjectStatus } : p);

        // Optimistically update the UI
        setProjects(updatedProjects);
        updateFilteredData(updatedProjects, currentFilter);

        try {
            await processRefund(projectId);
        } catch (refundError) {
            loadingActions.setError(`Failed to process refund for project ${projectId}.`);
            setProjects(originalProjects);
            updateFilteredData(originalProjects, currentFilter);
        }
    }

    return (
        <DashboardLayout title="Agent Control Panel">
            {/* Filter Bar with Profit Tracking */}
            <div className="mb-6">
                <FilterBar
                    onFilterChange={handleFilterChange}
                    onDateRangeChange={handleDateRangeChange}
                    currentFilter={currentFilter}
                    earnings={profitData || undefined}
                    showEarnings={true}
                    showProfit={true}
                    className="mb-4"
                />
            </div>

            {/* Advanced Filtering Controls - Only show in docs mode */}
            {viewMode === 'docs' && (
                <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                        {/* Search by Order Reference */}
                        <div className="flex-1 min-w-0">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Search by Order Reference
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Enter order reference..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                        </div>

                        {/* Client ID Filter */}
                        <div className="flex-1 min-w-0">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Client ID
                            </label>
                            <select
                                value={selectedClientId}
                                onChange={handleClientIdChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                <option value="">All Clients</option>
                                {uniqueClientIds.map(clientId => (
                                    <option key={clientId} value={clientId}>
                                        {clientId.substring(0, 8)}...
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Module Name Filter */}
                        <div className="flex-1 min-w-0">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Module
                            </label>
                            <select
                                value={selectedModuleName}
                                onChange={handleModuleNameChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                <option value="">All Modules</option>
                                {uniqueModuleNames.map(moduleName => (
                                    <option key={moduleName} value={moduleName}>
                                        {moduleName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Clear Filters Button */}
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
            )}

            <div className="mb-8">
                <AgentNotificationSender />
            </div>

            {/* Notification Status Monitor */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">System Monitoring</h2>
                    <button
                        onClick={() => setShowNotificationMonitor(!showNotificationMonitor)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <svg
                            className={`w-4 h-4 transform transition-transform ${showNotificationMonitor ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>{showNotificationMonitor ? 'Hide' : 'Show'} Notification Monitor</span>
                    </button>
                </div>

                {showNotificationMonitor && (
                    <div className="mb-6">
                        <NotificationStatusMonitor />
                    </div>
                )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center justify-between mb-6 border-t pt-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    {viewMode === 'docs' ? `Filtered Projects (${filteredProjects.length})` : 'Analytics Dashboard'}
                </h2>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setViewMode('docs')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${viewMode === 'docs'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Projects</span>
                    </button>
                    <button
                        onClick={() => setViewMode('charts')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${viewMode === 'charts'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Analytics</span>
                    </button>
                </div>
            </div>
            <LoadingWrapper
                isLoading={loadingState.isLoading}
                error={loadingState.error}
                onRetry={loadingActions.retry}
            >
                {/* Conditional Content Based on View Mode */}
                {viewMode === 'charts' ? (
                    <AnalyticsDashboard projects={projects} timeFilter={currentFilter} />
                ) : (
                    <>
                        {!loadingState.isLoading && filteredProjects.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>No projects found for the selected time period.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProjects.map(project => {
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
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-xs text-gray-500">
                                                        Client ID: {project.client_id.substring(0, 8)}...
                                                    </p>
                                                    <button
                                                        onClick={() => copyToClipboard(project.client_id)}
                                                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                        title="Copy full client ID"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                {project.order_reference && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Order: <span className="font-mono font-semibold text-blue-600">{project.order_reference}</span>
                                                    </p>
                                                )}
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
                                                        <p className="text-sm text-gray-600 bg-slate-200 p-2 rounded-lg">Assigned to: {workers?.find(w => w.id === project.worker_id)?.full_name || 'Unknown Worker'}</p>
                                                    ) : (
                                                        <div className="flex space-x-2">
                                                            <Select
                                                                containerClassName="flex-grow"
                                                                onChange={(value) => setSelectedWorkers(prev => ({ ...prev, [project.id]: value }))}
                                                                value={selectedWorkers[project.id] || ""}
                                                                placeholder="Select a worker"
                                                                options={[
                                                                    ...workers.map(w => ({
                                                                        value: w.id,
                                                                        label: `${w.full_name} (${w.id.substring(0, 6)}...)`
                                                                    }))
                                                                ]}
                                                            />
                                                            <Button className="!w-auto py-2 px-3 text-xs" onClick={() => handleAssignWorker(project.id)}>Assign</Button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <Select
                                                        label="Update Status:"
                                                        value={project.status}
                                                        onChange={(value) => handleStatusChange(project.id, value as ProjectStatus)}
                                                        options={ALL_STATUSES.map(status => ({
                                                            value: status,
                                                            label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                        }))}
                                                    />
                                                </div>

                                                {/* Refund Processing UI */}
                                                {project.status === 'refund' && (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-red-800">⚠️ Refund Required</p>
                                                                <p className="text-xs text-red-600 mt-1">
                                                                    This project has been cancelled and requires refund processing.
                                                                </p>
                                                            </div>
                                                            <Button
                                                                onClick={() => handleProcessRefund(project.id)}
                                                                className="!w-auto py-1 px-3 text-xs !bg-red-600 hover:!bg-red-700 !border-red-600"
                                                            >
                                                                Process Refund
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </LoadingWrapper>
        </DashboardLayout>
    );
};

export default AgentDashboard;