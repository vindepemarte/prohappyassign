import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import useFinancialSecurity from '../../hooks/useFinancialSecurity';

interface AuditLog {
  id: number;
  user_id: string;
  user_role: string;
  access_type: string;
  resource_id?: string;
  resource_type?: string;
  success: boolean;
  error_message?: string;
  created_at: string;
  full_name: string;
  email: string;
}

const FinancialSecurityDashboard: React.FC = () => {
  const { user } = useAuth();
  const { permissions, summary, getAuditLogs } = useFinancialSecurity();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    success: 'all',
    userRole: 'all',
    accessType: 'all'
  });
  const [stats, setStats] = useState({
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    uniqueUsers: 0
  });

  useEffect(() => {
    if (user?.role === 'super_agent') {
      loadAuditLogs();
    }
  }, [user]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await getAuditLogs(200);
      setAuditLogs(logs);
      calculateStats(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logs: AuditLog[]) => {
    const totalAttempts = logs.length;
    const successfulAttempts = logs.filter(log => log.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const uniqueUsers = new Set(logs.map(log => log.user_id)).size;

    setStats({
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      uniqueUsers
    });
  };

  const filteredLogs = auditLogs.filter(log => {
    if (filter.success !== 'all' && log.success.toString() !== filter.success) return false;
    if (filter.userRole !== 'all' && log.user_role !== filter.userRole) return false;
    if (filter.accessType !== 'all' && log.access_type !== filter.accessType) return false;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getAccessTypeIcon = (accessType: string) => {
    const icons: Record<string, string> = {
      'permissions_check': '🔍',
      'financial_summary': '📊',
      'project_financial_data': '💼',
      'user_financial_data': '👥',
      'audit_log_access': '📋',
      'system_initialization': '⚙️'
    };
    return icons[accessType] || '📄';
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'super_agent': 'bg-purple-100 text-purple-800',
      'agent': 'bg-blue-100 text-blue-800',
      'super_worker': 'bg-green-100 text-green-800',
      'worker': 'bg-gray-100 text-gray-800',
      'client': 'bg-orange-100 text-orange-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (user?.role !== 'super_agent') {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
        <p className="text-red-600">Only Super Agents can access the Financial Security Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="financial-security-dashboard">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Financial Security Dashboard</h2>
        <p className="text-gray-600">Monitor financial data access and security audit logs</p>
      </div>

      {/* Security Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.successfulAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-2xl">❌</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unique Users</p>
              <p className="text-2xl font-bold text-purple-600">{stats.uniqueUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {summary && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Financial Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-xl font-bold text-gray-900">{summary.total_projects}</p>
            </div>
            {summary.total_revenue && (
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold text-green-600">${summary.total_revenue.toFixed(2)}</p>
              </div>
            )}
            {summary.accessible_profit && (
              <div>
                <p className="text-sm text-gray-600">Total Profit</p>
                <p className="text-xl font-bold text-blue-600">${summary.accessible_profit.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Audit Logs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Success Status</label>
            <select
              value={filter.success}
              onChange={(e) => setFilter({ ...filter, success: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="true">Successful</option>
              <option value="false">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
            <select
              value={filter.userRole}
              onChange={(e) => setFilter({ ...filter, userRole: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="super_agent">Super Agent</option>
              <option value="agent">Agent</option>
              <option value="super_worker">Super Worker</option>
              <option value="worker">Worker</option>
              <option value="client">Client</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Type</label>
            <select
              value={filter.accessType}
              onChange={(e) => setFilter({ ...filter, accessType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="permissions_check">Permissions Check</option>
              <option value="financial_summary">Financial Summary</option>
              <option value="project_financial_data">Project Data</option>
              <option value="user_financial_data">User Data</option>
              <option value="audit_log_access">Audit Access</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={loadAuditLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setFilter({ success: 'all', userRole: 'all', accessType: 'all' })}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Financial Access Audit Logs ({filteredLogs.length} entries)
          </h3>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading audit logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No audit logs found matching the current filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Access Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{log.full_name}</div>
                          <div className="text-sm text-gray-500">{log.email}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(log.user_role)}`}>
                            {log.user_role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-2">{getAccessTypeIcon(log.access_type)}</span>
                        <span className="text-sm text-gray-900">{log.access_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.resource_type && (
                        <div>
                          <div>{log.resource_type}</div>
                          {log.resource_id && <div className="text-xs text-gray-400">ID: {log.resource_id}</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.success ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          ✅ Success
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            ❌ Failed
                          </span>
                          {log.error_message && (
                            <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialSecurityDashboard;