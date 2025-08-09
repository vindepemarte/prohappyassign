import React, { useMemo, useEffect, useState } from 'react';
import { Project } from '../../types';
import { TimeFilter } from '../common/FilterBar';
import { ProfitCalculator } from '../../utils/profitCalculator';
import { queryOptimizer } from '../../utils/queryOptimizer';
// Supabase removed - using PostgreSQL API
// Removed unused imports - LoadingWrapper and useLoadingState

interface AnalyticsDashboardProps {
  projects: Project[];
  timeFilter: TimeFilter;
}

interface MonthlyData {
  month: string;
  year: number;
  clientCount: number;
  projectCount: number;
  revenue: number;
  profit: number;
  averagePrice: number;
  totalToPay: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ projects, timeFilter }) => {
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  // Fetch client names
  useEffect(() => {
    const fetchClientNames = async () => {
      const uniqueClientIds = [...new Set(projects.map(p => p.client_id))];
      if (uniqueClientIds.length > 0) {
        const { data: clientsData, error } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', uniqueClientIds);

        if (!error && clientsData) {
          const clientNamesMap = clientsData.reduce((acc, client) => {
            acc[client.id] = client.full_name || 'Unknown Client';
            return acc;
          }, {} as Record<string, string>);
          setClientNames(clientNamesMap);
        }
      }
    };

    fetchClientNames();
  }, [projects]);

  // Removed unused optimized data loading - using direct calculations instead
  const analyticsData = useMemo(() => {
    // Get monthly trends for the last 12 months
    const monthlyTrends = ProfitCalculator.calculateMonthlyProfitTrends(projects, 12);
    
    // Calculate current period metrics
    const currentPeriodBreakdown = ProfitCalculator.calculateProfitBreakdown(projects, timeFilter);
    
    // Calculate client analysis
    const clientAnalysis = ProfitCalculator.calculateClientProfitAnalysis(projects, timeFilter);
    
    // Transform monthly trends to match our interface
    const monthlyData: MonthlyData[] = monthlyTrends.map(trend => {
      // Calculate unique clients for this month
      const monthStart = new Date(trend.year, new Date(`${trend.month} 1, ${trend.year}`).getMonth(), 1);
      const monthEnd = new Date(trend.year, new Date(`${trend.month} 1, ${trend.year}`).getMonth() + 1, 0);
      
      const monthProjects = projects.filter(p => {
        const projectDate = new Date(p.created_at);
        return projectDate >= monthStart && projectDate <= monthEnd && p.status === 'completed';
      });
      
      const uniqueClients = new Set(monthProjects.map(p => p.client_id)).size;
      const workerPayments = ProfitCalculator.calculateProfitBreakdown(projects, {
        type: 'custom',
        startDate: monthStart,
        endDate: monthEnd
      }).totalWorkerPayments;
      
      return {
        month: trend.month,
        year: trend.year,
        clientCount: uniqueClients,
        projectCount: trend.projects,
        revenue: trend.revenue,
        profit: trend.profit,
        averagePrice: trend.projects > 0 ? trend.revenue / trend.projects : 0,
        totalToPay: workerPayments
      };
    });

    return {
      monthlyData,
      currentPeriod: currentPeriodBreakdown,
      topClients: clientAnalysis.slice(0, 5)
    };
  }, [projects, timeFilter]);

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: number;
    color?: string;
  }> = ({ title, value, subtitle, trend, color = 'blue' }) => (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold text-${color}-600 mt-1`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {trend !== undefined && (
          <div className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );

  const SimpleChart: React.FC<{
    data: MonthlyData[];
    dataKey: keyof MonthlyData;
    title: string;
    color: string;
    format?: (value: number) => string;
  }> = ({ data, dataKey, title, color, format = (v) => v.toString() }) => {
    const maxValue = Math.max(...data.map(d => Number(d[dataKey])));
    const minValue = Math.min(...data.map(d => Number(d[dataKey])));
    const range = maxValue - minValue || 1;

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="space-y-3">
          {data.slice(-6).map((item, index) => {
            const value = Number(item[dataKey]);
            const percentage = ((value - minValue) / range) * 100;
            
            return (
              <div key={`${item.month}-${item.year}`} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-sm font-medium text-gray-600 w-12">
                    {item.month}
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-800 ml-3">
                  {format(value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Clients"
          value={analyticsData.topClients.length}
          color="blue"
        />
        <MetricCard
          title="Total Projects"
          value={analyticsData.currentPeriod.projectCount}
          color="green"
        />
        <MetricCard
          title="Total Revenue"
          value={`£${analyticsData.currentPeriod.totalRevenue.toFixed(2)}`}
          color="purple"
        />
        <MetricCard
          title="Total Profit"
          value={`£${analyticsData.currentPeriod.totalProfit.toFixed(2)}`}
          subtitle={`Margin: ${analyticsData.currentPeriod.profitMargin.toFixed(1)}%`}
          color="green"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="clientCount"
          title="Monthly Client Numbers"
          color="blue"
        />
        
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="projectCount"
          title="Monthly Project Numbers"
          color="green"
        />
        
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="averagePrice"
          title="Average Price per Project"
          color="purple"
          format={(v) => `£${v.toFixed(0)}`}
        />
        
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="revenue"
          title="Monthly Revenue"
          color="indigo"
          format={(v) => `£${v.toFixed(0)}`}
        />
        
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="profit"
          title="Monthly Profit"
          color="green"
          format={(v) => `£${v.toFixed(0)}`}
        />
        
        <SimpleChart
          data={analyticsData.monthlyData}
          dataKey="totalToPay"
          title="Monthly Payments to Workers"
          color="orange"
          format={(v) => `£${v.toFixed(0)}`}
        />
      </div>

      {/* Top Clients Table */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Clients by Profit</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.topClients.map((client) => (
                <tr key={client.clientId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span>{clientNames[client.clientId] || client.clientId.substring(0, 8) + '...'}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(client.clientId)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy full client ID"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.projects}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    £{client.revenue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    £{client.profit.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;