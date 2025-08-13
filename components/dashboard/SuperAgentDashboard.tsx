import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';
import { Project, ProjectStatus, Profile } from '../../types';
import { WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';
import Button from '../Button';
import Select from '../common/Select';
import ModernStatusSelector from '../common/ModernStatusSelector';
import ModernSearchField from '../common/ModernSearchField';
import LoadingWrapper from '../common/LoadingWrapper';
import ProjectCard from '../common/ProjectCard';
import FilterBar, { TimeFilter, EarningsDisplay } from '../common/FilterBar';
import { useRobustLoading } from '../../hooks/useRobustLoading';
import { useAuth } from '../../hooks/useAuth';

// Super Agent specific components
import SuperAgentAnalytics from './SuperAgentAnalytics';
import AgentManagement from './AgentManagement';
import SystemBroadcast from './SystemBroadcast';
import HierarchyOverview from './HierarchyOverview';
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

type DashboardView = 'projects' | 'analytics' | 'agents' | 'hierarchy' | 'broadcast' | 'notifications';

const SuperAgentDashboard: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [workers, setWorkers] = useState<Profile[]>([]);
    const [agents, setAgents] = useState<Profile[]>([]);
    const [selectedWorkers, setSelectedWorkers] = useState<{ [projectId: number]: string }>({});
    const [loadingState, loadingActions] = useRobustLoading({
        timeout: 25000, // 25 seconds for super agent data loading
        maxRetries: 3,
        preventTabSwitchReload: true,
        minLoadingTime: 800
    });

    // Filter and profit tracking state
    const [currentFilter, setCurrentFilter] = useState<TimeFilter>({ type: 'month' });
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [profitData, setProfitData] = useState<EarningsDisplay | null>(null);

    // Advanced filtering state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | ''>('');
    const [uniqueAgentIds, setUniqueAgentIds] = useState<string[]>([]);
    const [agentNames, setAgentNames] = useState<Record<string, string>>({});
    const [clientNames, setClientNames] = useState<Record<string, string>>({});

    // Dashboard view state
    const [currentView, setCurrentView] = useState<DashboardView>('projects');

    useEffect(() => {
        fetchSuperAgentData();
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

            // Extract unique agent IDs for filters
            const agentIds = [...new Set(projects.map(p => p.agent_id || p.sub_agent_id).filter(Boolean))];
            setUniqueAgentIds(agentIds);
        }
    }, [projects]);

    // Update filtered data when search or filter criteria change
    useEffect(() => {
        if (projects.length > 0) {
            updateFilteredData(projects, currentFilter);
        }
    }, [searchTerm, selectedAgentId, selectedStatus]);

    const updateFilteredData = (allProjects: Project[], filter: TimeFilter) => {
        // Calculate total profit for the filtered period
        let totalRevenue = 0;
        let totalWorkerPayments = 0;

        // Apply all filters: time, search, agent, and status
        const filtered = allProjects.filter(project => {
            // Time filter
            if (filter.startDate && filter.endDate) {
                const projectDate = new Date(project.created_at);
                if (projectDate < filter.startDate || projectDate > filter.endDate) {
                    return false;
                }
            }

            // Search term filter (order reference, client name, or project title)
            if (searchTerm.trim()) {
                const orderRef = project.order_reference || '';
                const clientName = clientNames[project.client_id] || '';
                const title = project.title || '';
                const searchLower = searchTerm.toLowerCase();
                
                if (!orderRef.toLowerCase().includes(searchLower) && 
                    !clientName.toLowerCase().includes(searchLower) &&
                    !title.toLowerCase().includes(searchLower)) {
                    return false;
                }
            }

            // Agent filter
            if (selectedAgentId && project.agent_id !== selectedAgentId && project.sub_agent_id !== selectedAgentId) {
                return false;
            }

            // Status filter
            if (selectedStatus && project.status !== selectedStatus) {
                return false;
            }

            return true;
        });

        // Calculate financial data for filtered projects
        filtered.forEach(project => {
            if (project.status === 'completed') {
                const currentWordCount = project.adjusted_word_count || project.initial_word_count;
                const workerPayout = (currentWordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
                
                totalRevenue += project.cost_gbp;
                totalWorkerPayments += workerPayout;
            }
        });

        const totalProfit = totalRevenue - totalWorkerPayments;

        // Set profit data for display
        const earnings: EarningsDisplay = {
            gbp: totalRevenue,
            inr: 0, // Not needed for super agent dashboard
            profit: totalProfit,
            toPay: totalWorkerPayments
        };

        setProfitData(earnings);
        setFilteredProjects(filtered);
    };

    const fetchSuperAgentData = async () => {
        try {
            loadingActions.startLoading();

            // Fetch all accessible projects for super agent
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

            // Fetch all workers and agents in the network
            const hierarchyResponse = await fetch('/api/hierarchy/super-agent-network', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (hierarchyResponse.ok) {
                const hierarchyData = await hierarchyResponse.json();
                const networkUsers = hierarchyData.data;

                const workersData = networkUsers.filter((u: Profile) => u.role === 'worker');
                const agentsData = networkUsers.filter((u: Profile) => u.role === 'agent');

                setWorkers(workersData);
                setAgents(agentsData);

                // Create agent names mapping
                const agentNamesMap = agentsData.reduce((acc: Record<string, string>, agent: Profile) => {
                    acc[agent.id] = agent.full_name || 'Unknown Agent';
                    return acc;
                }, {});
                setAgentNames(agentNamesMap);

                // Create client names mapping
                const clientsData = networkUsers.filter((u: Profile) => u.role === 'client');
                const clientNamesMap = clientsData.reduce((acc: Record<string, string>, client: Profile) => {
                    acc[client.id] = client.full_name || 'Unknown Client';
                    return acc;
                }, {});
                setClientNames(clientNamesMap);
            }

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

    const handleStatusChange = async (projectId: number, newStatus: ProjectStatus) => {
        const originalProjects = [...projects];
        const updatedProjects = projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p);
        setProjects(updatedProjects);
        updateFilteredData(updatedProjects, currentFilter);

        try {
            const response = await fetch('/api/projects/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ projectId, status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update project status');
            }

            console.log(`Successfully updated project ${projectId} status to ${newStatus}`);
        } catch (updateError) {
            console.error(`Failed to update project ${projectId} status:`, updateError);
            loadingActions.setError(`Failed to update project ${projectId}`);
            
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
        const updatedProjects = projects.map(p => 
            p.id === projectId ? { ...p, worker_id: workerId, status: 'in_progress' as ProjectStatus } : p
        );

        setProjects(updatedProjects);
        updateFilteredData(updatedProjects, currentFilter);

        try {
            const response = await fetch('/api/projects/assign-worker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ projectId, workerId })
            });

            if (!response.ok) {
                throw new Error('Failed to assign worker');
            }
        } catch (assignError) {
            loadingActions.setError(`Failed to assign worker to project ${projectId}.`);
            setProjects(originalProjects);
            updateFilteredData(originalProjects, currentFilter);
        }
    };

    const calculateWorkerPayoutGbp = (wordCount: number): number => {
        return (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedAgentId('');
        setSelectedStatus('');
        updateFilteredData(projects, currentFilter);
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            console.log('Copied to clipboard:', text);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const renderViewContent = () => {
        switch (currentView) {
            case 'analytics':
                return <SuperAgentAnalytics projects={projects} timeFilter={currentFilter} />;
            case 'agents':
                return <AgentManagement agents={agents} />;
            case 'hierarchy':
                return <HierarchyOverview />;
            case 'broadcast':
                return <SystemBroadcast />;
            case 'notifications':
                return <NotificationCenter userId={user?.id || ''} userRole="super_agent" />;
            default:
                return renderProjectsView();
        }
    };

    const renderProjectsView = () => (
        <>
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

            {/* Advanced Filtering Controls */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                    {/* Search Field */}
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                            Search Projects
                        </label>
                        <ModernSearchField
                            placeholder="Search by order reference, client name, or title"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />
                    </div>

                    {/* Agent Filter */}
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Filter by Agent
                        </label>
                        <select
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="">All Agents</option>
                            {uniqueAgentIds.map(agentId => (
                                <option key={agentId} value={agentId}>
                                    {agentNames[agentId] || agentId.substring(0, 8) + '...'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
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
                            const workerPayout = calculateWorkerPayoutGbp(currentWordCount);
                            const profit = project.cost_gbp - workerPayout;

                            return (
                                <ProjectCard key={project.id} project={project}>
                                    <div className="p-4 space-y-2 text-sm text-gray-700 flex-grow">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-500">
                                                Client: {clientNames[project.client_id] || project.client_id.substring(0, 8) + '...'}
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

                                        <p><strong>Agent:</strong> {agentNames[project.agent_id || project.sub_agent_id || ''] || 'Unassigned'}</p>
                                        <p><strong>Deadline:</strong> {new Date(project.deadline).toLocaleDateString()}</p>
                                        <p><strong>Word Count:</strong> {currentWordCount.toLocaleString()} {project.adjusted_word_count ? <span className="text-purple-600">(Adjusted)</span> : ''}</p>
                                        
                                        <div className="mt-2 pt-2 border-t">
                                            <p><strong>Client Price:</strong> £{project.cost_gbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                            <p><strong>Worker Payout:</strong> £{workerPayout.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                            <p className="font-bold text-green-600"><strong>Profit:</strong> £{profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-100 p-4 border-t rounded-b-xl space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Manage Worker:</label>
                                            {project.worker_id ? (
                                                <p className="text-sm text-gray-600 bg-slate-200 p-2 rounded-lg">
                                                    Assigned to: {workers?.find(w => w.id === project.worker_id)?.full_name || 'Unknown Worker'}
                                                </p>
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
                                                    <Button className="!w-auto py-2 px-3 text-xs" onClick={() => handleAssignWorker(project.id)}>
                                                        Assign
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div>
                                            <ModernStatusSelector
                                                currentStatus={project.status}
                                                onStatusChange={(status) => handleStatusChange(project.id, status)}
                                                options={ALL_STATUSES.map(status => ({
                                                    value: status,
                                                    label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                                    description: getStatusDescription(status)
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </ProjectCard>
                            );
                        })}
                    </div>
                )}
            </LoadingWrapper>
        </>
    );

    return (
        <DashboardLayout title="Super Agent Control Center">
            {/* Navigation Tabs */}
            <div className="mb-8 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'projects', label: 'Projects', icon: '📊' },
                        { id: 'analytics', label: 'Analytics', icon: '📈' },
                        { id: 'agents', label: 'Agent Management', icon: '👥' },
                        { id: 'hierarchy', label: 'Hierarchy', icon: '🏗️' },
                        { id: 'broadcast', label: 'Broadcast', icon: '📢' },
                        { id: 'notifications', label: 'Notifications', icon: '🔔' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setCurrentView(tab.id as DashboardView)}
                            className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                                currentView === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* View Content */}
            {renderViewContent()}
        </DashboardLayout>
    );
};

export default SuperAgentDashboard;