import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { TimeFilter } from '../common/FilterBar';
import { WORKER_PAY_RATE_PER_500_WORDS } from '../../constants';

interface SuperAgentAnalyticsProps {
    projects: Project[];
    timeFilter: TimeFilter;
}

interface AnalyticsData {
    totalRevenue: number;
    totalProfit: number;
    totalWorkerPayments: number;
    projectCount: number;
    completedProjects: number;
    averageProjectValue: number;
    profitMargin: number;
    clientCount: number;
    agentCount: number;
    workerCount: number;
    monthlyData: Array<{
        month: string;
        revenue: number;
        profit: number;
        projects: number;
    }>;
    statusDistribution: Array<{
        status: string;
        count: number;
        percentage: number;
    }>;
    topClients: Array<{
        clientId: string;
        clientName: string;
        projectCount: number;
        totalRevenue: number;
    }>;
    topAgents: Array<{
        agentId: string;
        agentName: string;
        projectCount: number;
        totalRevenue: number;
        profit: number;
    }>;
}

const SuperAgentAnalytics: React.FC<SuperAgentAnalyticsProps> = ({ projects, timeFilter }) => {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [clientNames, setClientNames] = useState<Record<string, string>>({});
    const [agentNames, setAgentNames] = useState<Record<string, string>>({});

    useEffect(() => {
        calculateAnalytics();
        fetchUserNames();
    }, [projects, timeFilter]);

    const fetchUserNames = async () => {
        try {
            // Get unique client and agent IDs
            const clientIds = [...new Set(projects.map(p => p.client_id))];
            const agentIds = [...new Set(projects.map(p => p.agent_id || p.sub_agent_id).filter(Boolean))];

            // Fetch user details
            const response = await fetch('/api/hierarchy/super-agent-network', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const users = data.data;

                const clientNamesMap: Record<string, string> = {};
                const agentNamesMap: Record<string, string> = {};

                users.forEach((user: any) => {
                    if (clientIds.includes(user.id)) {
                        clientNamesMap[user.id] = user.full_name || 'Unknown Client';
                    }
                    if (agentIds.includes(user.id)) {
                        agentNamesMap[user.id] = user.full_name || 'Unknown Agent';
                    }
                });

                setClientNames(clientNamesMap);
                setAgentNames(agentNamesMap);
            }
        } catch (error) {
            console.error('Error fetching user names:', error);
        }
    };

    const calculateAnalytics = () => {
        setLoading(true);

        // Filter projects based on time filter
        let filteredProjects = projects;
        if (timeFilter.startDate && timeFilter.endDate) {
            filteredProjects = projects.filter(project => {
                const projectDate = new Date(project.created_at);
                return projectDate >= timeFilter.startDate! && projectDate <= timeFilter.endDate!;
            });
        }

        // Basic metrics
        let totalRevenue = 0;
        let totalWorkerPayments = 0;
        const completedProjects = filteredProjects.filter(p => p.status === 'completed');
        const uniqueClients = new Set(filteredProjects.map(p => p.client_id));
        const uniqueAgents = new Set(filteredProjects.map(p => p.agent_id || p.sub_agent_id).filter(Boolean));
        const uniqueWorkers = new Set(filteredProjects.map(p => p.worker_id || p.sub_worker_id).filter(Boolean));

        // Calculate revenue and worker payments
        completedProjects.forEach(project => {
            const wordCount = project.adjusted_word_count || project.initial_word_count;
            const workerPayout = (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
            
            totalRevenue += project.cost_gbp;
            totalWorkerPayments += workerPayout;
        });

        const totalProfit = totalRevenue - totalWorkerPayments;
        const averageProjectValue = completedProjects.length > 0 ? totalRevenue / completedProjects.length : 0;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        // Monthly data (last 12 months)
        const monthlyData = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            
            const monthProjects = filteredProjects.filter(p => {
                const projectDate = new Date(p.created_at);
                return projectDate >= monthStart && projectDate <= monthEnd && p.status === 'completed';
            });

            let monthRevenue = 0;
            let monthWorkerPayments = 0;

            monthProjects.forEach(project => {
                const wordCount = project.adjusted_word_count || project.initial_word_count;
                const workerPayout = (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
                
                monthRevenue += project.cost_gbp;
                monthWorkerPayments += workerPayout;
            });

            monthlyData.push({
                month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                revenue: monthRevenue,
                profit: monthRevenue - monthWorkerPayments,
                projects: monthProjects.length
            });
        }

        // Status distribution
        const statusCounts: Record<string, number> = {};
        filteredProjects.forEach(project => {
            statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
        });

        const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
            status: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            count,
            percentage: (count / filteredProjects.length) * 100
        }));

        // Top clients
        const clientStats: Record<string, { projectCount: number; totalRevenue: number }> = {};
        completedProjects.forEach(project => {
            if (!clientStats[project.client_id]) {
                clientStats[project.client_id] = { projectCount: 0, totalRevenue: 0 };
            }
            clientStats[project.client_id].projectCount++;
            clientStats[project.client_id].totalRevenue += project.cost_gbp;
        });

        const topClients = Object.entries(clientStats)
            .map(([clientId, stats]) => ({
                clientId,
                clientName: clientNames[clientId] || clientId.substring(0, 8) + '...',
                ...stats
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);

        // Top agents
        const agentStats: Record<string, { projectCount: number; totalRevenue: number; profit: number }> = {};
        completedProjects.forEach(project => {
            const agentId = project.agent_id || project.sub_agent_id;
            if (!agentId) return;

            if (!agentStats[agentId]) {
                agentStats[agentId] = { projectCount: 0, totalRevenue: 0, profit: 0 };
            }

            const wordCount = project.adjusted_word_count || project.initial_word_count;
            const workerPayout = (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
            const projectProfit = project.cost_gbp - workerPayout;

            agentStats[agentId].projectCount++;
            agentStats[agentId].totalRevenue += project.cost_gbp;
            agentStats[agentId].profit += projectProfit;
        });

        const topAgents = Object.entries(agentStats)
            .map(([agentId, stats]) => ({
                agentId,
                agentName: agentNames[agentId] || agentId.substring(0, 8) + '...',
                ...stats
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);

        setAnalyticsData({
            totalRevenue,
            totalProfit,
            totalWorkerPayments,
            projectCount: filteredProjects.length,
            completedProjects: completedProjects.length,
            averageProjectValue,
            profitMargin,
            clientCount: uniqueClients.size,
            agentCount: uniqueAgents.size,
            workerCount: uniqueWorkers.size,
            monthlyData,
            statusDistribution,
            topClients,
            topAgents
        });

        setLoading(false);
    };

    if (loading || !analyticsData) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Calculating analytics...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold">£</span>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                            <p className="text-2xl font-bold text-gray-900">
                                £{analyticsData.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold">💰</span>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Total Profit</p>
                            <p className="text-2xl font-bold text-gray-900">
                                £{analyticsData.totalProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-purple-600 font-semibold">📊</span>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Profit Margin</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {analyticsData.profitMargin.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                <span className="text-orange-600 font-semibold">📈</span>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Completed Projects</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {analyticsData.completedProjects}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Network Overview */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{analyticsData.clientCount}</div>
                        <div className="text-sm text-gray-500">Active Clients</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{analyticsData.agentCount}</div>
                        <div className="text-sm text-gray-500">Active Agents</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{analyticsData.workerCount}</div>
                        <div className="text-sm text-gray-500">Active Workers</div>
                    </div>
                </div>
            </div>

            {/* Monthly Performance */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {analyticsData.monthlyData.slice(-6).map((month, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{month.projects}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        £{month.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        £{month.profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Clients */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clients</h3>
                    <div className="space-y-3">
                        {analyticsData.topClients.map((client, index) => (
                            <div key={client.clientId} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-blue-600 font-semibold">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{client.clientName}</p>
                                        <p className="text-xs text-gray-500">{client.projectCount} projects</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">
                                        £{client.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Agents */}
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Agents</h3>
                    <div className="space-y-3">
                        {analyticsData.topAgents.map((agent, index) => (
                            <div key={agent.agentId} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-green-600 font-semibold">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{agent.agentName}</p>
                                        <p className="text-xs text-gray-500">{agent.projectCount} projects</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">
                                        £{agent.profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-500">profit</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
                <div className="space-y-3">
                    {analyticsData.statusDistribution.map((status, index) => (
                        <div key={index} className="flex items-center">
                            <div className="flex-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-900">{status.status}</span>
                                    <span className="text-gray-500">{status.count} ({status.percentage.toFixed(1)}%)</span>
                                </div>
                                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: `${status.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SuperAgentAnalytics;