import React, { useState, useEffect } from 'react';
import Button from '../Button';
import ModernSearchField from '../common/ModernSearchField';

interface HierarchyUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
    hierarchy_level: number;
    parent_id: string | null;
    parent_name: string | null;
    created_at: string;
    reference_code_used: string | null;
}

interface HierarchyStats {
    total_users: number;
    by_level: Array<{
        level: number;
        count: number;
        roles: string[];
    }>;
    by_role: Array<{
        role: string;
        count: number;
        recent_count: number;
    }>;
    integrity_issues: Array<{
        type: string;
        count: number;
        details: any[];
    }>;
}

const HierarchyOverview: React.FC = () => {
    const [hierarchyUsers, setHierarchyUsers] = useState<HierarchyUser[]>([]);
    const [hierarchyStats, setHierarchyStats] = useState<HierarchyStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('');
    const [showIntegrityCheck, setShowIntegrityCheck] = useState(false);

    useEffect(() => {
        fetchHierarchyData();
    }, []);

    const fetchHierarchyData = async () => {
        setLoading(true);
        try {
            // Fetch hierarchy users
            const usersResponse = await fetch('/api/hierarchy/super-agent-network', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                setHierarchyUsers(usersData.data);
            }

            // Fetch hierarchy statistics
            const statsResponse = await fetch('/api/permissions/hierarchy-overview', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                
                // Process the stats data
                const processedStats: HierarchyStats = {
                    total_users: statsData.data.hierarchy_stats.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0),
                    by_role: statsData.data.hierarchy_stats,
                    by_level: [], // Will be calculated from users data
                    integrity_issues: []
                };

                setHierarchyStats(processedStats);
            }

            // Check hierarchy integrity
            const integrityResponse = await fetch('/api/hierarchy/validate-integrity', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (integrityResponse.ok) {
                const integrityData = await integrityResponse.json();
                if (hierarchyStats) {
                    setHierarchyStats(prev => prev ? {
                        ...prev,
                        integrity_issues: integrityData.data.issues || []
                    } : null);
                }
            }

        } catch (error) {
            console.error('Error fetching hierarchy data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = hierarchyUsers.filter(user => {
        // Search filter
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            if (!user.full_name?.toLowerCase().includes(searchLower) &&
                !user.email?.toLowerCase().includes(searchLower) &&
                !user.id.toLowerCase().includes(searchLower)) {
                return false;
            }
        }

        // Role filter
        if (selectedRole && user.role !== selectedRole) {
            return false;
        }

        // Level filter
        if (selectedLevel && user.hierarchy_level.toString() !== selectedLevel) {
            return false;
        }

        return true;
    });

    const handleReassignUser = async (userId: string, newParentId: string) => {
        try {
            const response = await fetch('/api/hierarchy/reassign-user', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId, newParentId })
            });

            if (response.ok) {
                await fetchHierarchyData();
                alert('User reassigned successfully');
            } else {
                throw new Error('Failed to reassign user');
            }
        } catch (error) {
            console.error('Error reassigning user:', error);
            alert('Failed to reassign user. Please try again.');
        }
    };

    const runIntegrityCheck = async () => {
        setShowIntegrityCheck(true);
        try {
            const response = await fetch('/api/hierarchy/validate-integrity', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setHierarchyStats(prev => prev ? {
                    ...prev,
                    integrity_issues: data.data.issues || []
                } : null);
            }
        } catch (error) {
            console.error('Error running integrity check:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading hierarchy data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Hierarchy Overview</h2>
                    <p className="text-gray-600">Manage your network hierarchy and user relationships</p>
                </div>
                <Button onClick={runIntegrityCheck} className="!w-auto">
                    Run Integrity Check
                </Button>
            </div>

            {/* Stats Overview */}
            {hierarchyStats && (
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Hierarchy Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h4 className="font-medium text-gray-700 mb-2">By Role</h4>
                            <div className="space-y-2">
                                {hierarchyStats.by_role.map(stat => (
                                    <div key={stat.role} className="flex justify-between text-sm">
                                        <span className="capitalize">{stat.role.replace('_', ' ')}</span>
                                        <span className="font-medium">{stat.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <h4 className="font-medium text-gray-700 mb-2">Recent Activity</h4>
                            <div className="space-y-2">
                                {hierarchyStats.by_role.map(stat => (
                                    <div key={stat.role} className="flex justify-between text-sm">
                                        <span className="capitalize">{stat.role.replace('_', ' ')}</span>
                                        <span className="text-green-600 font-medium">{stat.recent_count} new</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium text-gray-700 mb-2">System Health</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Total Users</span>
                                    <span className="font-medium">{hierarchyStats.total_users}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Integrity Issues</span>
                                    <span className={`font-medium ${hierarchyStats.integrity_issues.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {hierarchyStats.integrity_issues.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Integrity Issues */}
            {showIntegrityCheck && hierarchyStats && hierarchyStats.integrity_issues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Integrity Issues Found</h3>
                    {hierarchyStats.integrity_issues.map((issue, index) => (
                        <div key={index} className="mb-2">
                            <p className="text-red-700 font-medium">{issue.type}: {issue.count} issues</p>
                            {issue.details.length > 0 && (
                                <div className="mt-1 text-sm text-red-600">
                                    <p>Affected users: {issue.details.map((d: any) => d.full_name || d.user_id).join(', ')}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                        <ModernSearchField
                            placeholder="Search by name, email, or ID"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />
                    </div>
                    <div className="flex-1">
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Roles</option>
                            <option value="agent">Agents</option>
                            <option value="client">Clients</option>
                            <option value="super_worker">Super Workers</option>
                            <option value="worker">Workers</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <select
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Levels</option>
                            <option value="2">Level 2 (Agents/Super Workers)</option>
                            <option value="3">Level 3 (Clients)</option>
                            <option value="4">Level 4 (Workers)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Network Users ({filteredUsers.length})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{user.full_name || 'Unknown'}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                            user.role === 'agent' ? 'bg-blue-100 text-blue-800' :
                                            user.role === 'client' ? 'bg-green-100 text-green-800' :
                                            user.role === 'super_worker' ? 'bg-purple-100 text-purple-800' :
                                            user.role === 'worker' ? 'bg-orange-100 text-orange-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {user.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        Level {user.hierarchy_level}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.parent_name || 'Direct to Super Agent'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                            {user.reference_code_used || 'N/A'}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => {
                                                    const newParent = prompt('Enter new parent user ID:');
                                                    if (newParent) {
                                                        handleReassignUser(user.id, newParent);
                                                    }
                                                }}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Reassign
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Are you sure you want to deactivate ${user.full_name}?`)) {
                                                        handleDeactivateUser(user.id);
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Deactivate
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* No Results */}
            {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">No users found</div>
                    <p className="text-gray-500">Try adjusting your search criteria</p>
                </div>
            )}
        </div>
    );


};

export default HierarchyOverview;