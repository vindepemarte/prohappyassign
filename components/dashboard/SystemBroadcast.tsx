import React, { useState, useEffect } from 'react';
import Button from '../Button';

interface BroadcastHistory {
    id: number;
    title: string;
    message: string;
    sent_at: string;
    recipient_count: number;
    delivery_status: 'pending' | 'sent' | 'delivered' | 'failed';
}

const SystemBroadcast: React.FC = () => {
    const [broadcastForm, setBroadcastForm] = useState({
        title: '',
        message: '',
        target_roles: [] as string[],
        urgent: false
    });
    const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [networkStats, setNetworkStats] = useState({
        total_users: 0,
        agents: 0,
        clients: 0,
        workers: 0,
        super_workers: 0
    });

    const availableRoles = [
        { value: 'agent', label: 'Agents', description: 'All agents in your network' },
        { value: 'client', label: 'Clients', description: 'All clients in your network' },
        { value: 'worker', label: 'Workers', description: 'All workers in your network' },
        { value: 'super_worker', label: 'Super Workers', description: 'All super workers in your network' },
        { value: 'all', label: 'Everyone', description: 'All users in your network' }
    ];

    useEffect(() => {
        fetchBroadcastHistory();
        fetchNetworkStats();
    }, []);

    const fetchBroadcastHistory = async () => {
        try {
            const response = await fetch('/api/notifications/broadcast-history', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setBroadcastHistory(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching broadcast history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchNetworkStats = async () => {
        try {
            const response = await fetch('/api/hierarchy/overview', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.data;
                
                let totalUsers = 0;
                const roleStats = {
                    agents: 0,
                    clients: 0,
                    workers: 0,
                    super_workers: 0
                };

                stats.forEach((stat: any) => {
                    totalUsers += parseInt(stat.count);
                    if (stat.role === 'agent') roleStats.agents = parseInt(stat.count);
                    if (stat.role === 'client') roleStats.clients = parseInt(stat.count);
                    if (stat.role === 'worker') roleStats.workers = parseInt(stat.count);
                    if (stat.role === 'super_worker') roleStats.super_workers = parseInt(stat.count);
                });

                setNetworkStats({
                    total_users: totalUsers,
                    ...roleStats
                });
            }
        } catch (error) {
            console.error('Error fetching network stats:', error);
        }
    };

    const handleRoleToggle = (role: string) => {
        if (role === 'all') {
            setBroadcastForm(prev => ({
                ...prev,
                target_roles: prev.target_roles.includes('all') ? [] : ['all']
            }));
        } else {
            setBroadcastForm(prev => ({
                ...prev,
                target_roles: prev.target_roles.includes('all') 
                    ? [role]
                    : prev.target_roles.includes(role)
                        ? prev.target_roles.filter(r => r !== role)
                        : [...prev.target_roles.filter(r => r !== 'all'), role]
            }));
        }
    };

    const getEstimatedRecipients = () => {
        if (broadcastForm.target_roles.includes('all')) {
            return networkStats.total_users;
        }

        let count = 0;
        broadcastForm.target_roles.forEach(role => {
            switch (role) {
                case 'agent':
                    count += networkStats.agents;
                    break;
                case 'client':
                    count += networkStats.clients;
                    break;
                case 'worker':
                    count += networkStats.workers;
                    break;
                case 'super_worker':
                    count += networkStats.super_workers;
                    break;
            }
        });

        return count;
    };

    const handleSendBroadcast = async () => {
        if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
            alert('Please fill in both title and message');
            return;
        }

        if (broadcastForm.target_roles.length === 0) {
            alert('Please select at least one target role');
            return;
        }

        const estimatedRecipients = getEstimatedRecipients();
        if (!confirm(`Are you sure you want to send this broadcast to ${estimatedRecipients} users?`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/notifications/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(broadcastForm)
            });

            if (response.ok) {
                setBroadcastForm({
                    title: '',
                    message: '',
                    target_roles: [],
                    urgent: false
                });
                await fetchBroadcastHistory();
                alert('Broadcast sent successfully!');
            } else {
                throw new Error('Failed to send broadcast');
            }
        } catch (error) {
            console.error('Error sending broadcast:', error);
            alert('Failed to send broadcast. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">System Broadcast</h2>
                <p className="text-gray-600">Send notifications to your entire network</p>
            </div>

            {/* Network Overview */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{networkStats.total_users}</div>
                        <div className="text-sm text-gray-500">Total Users</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{networkStats.agents}</div>
                        <div className="text-sm text-gray-500">Agents</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{networkStats.clients}</div>
                        <div className="text-sm text-gray-500">Clients</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{networkStats.super_workers}</div>
                        <div className="text-sm text-gray-500">Super Workers</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{networkStats.workers}</div>
                        <div className="text-sm text-gray-500">Workers</div>
                    </div>
                </div>
            </div>

            {/* Broadcast Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Send New Broadcast</h3>
                
                <div className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={broadcastForm.title}
                            onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter broadcast title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                        </label>
                        <textarea
                            value={broadcastForm.message}
                            onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                            placeholder="Enter your message"
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Target Roles */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Target Audience
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableRoles.map(role => (
                                <div
                                    key={role.value}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                        broadcastForm.target_roles.includes(role.value)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                    onClick={() => handleRoleToggle(role.value)}
                                >
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={broadcastForm.target_roles.includes(role.value)}
                                            onChange={() => handleRoleToggle(role.value)}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">{role.label}</div>
                                            <div className="text-sm text-gray-500">{role.description}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Urgent Flag */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="urgent"
                            checked={broadcastForm.urgent}
                            onChange={(e) => setBroadcastForm(prev => ({ ...prev, urgent: e.target.checked }))}
                            className="mr-2"
                        />
                        <label htmlFor="urgent" className="text-sm font-medium text-gray-700">
                            Mark as urgent (high priority notification)
                        </label>
                    </div>

                    {/* Estimated Recipients */}
                    {broadcastForm.target_roles.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                                <strong>Estimated Recipients:</strong> {getEstimatedRecipients()} users
                            </p>
                        </div>
                    )}

                    {/* Send Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSendBroadcast}
                            disabled={loading || !broadcastForm.title.trim() || !broadcastForm.message.trim() || broadcastForm.target_roles.length === 0}
                            className="px-6"
                        >
                            {loading ? 'Sending...' : 'Send Broadcast'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Broadcast History */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Broadcast History</h3>
                
                {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading history...</span>
                    </div>
                ) : broadcastHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No broadcasts sent yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {broadcastHistory.map(broadcast => (
                            <div key={broadcast.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900">{broadcast.title}</h4>
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            broadcast.delivery_status === 'delivered' 
                                                ? 'bg-green-100 text-green-800'
                                                : broadcast.delivery_status === 'failed'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {broadcast.delivery_status}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {broadcast.recipient_count} recipients
                                        </span>
                                    </div>
                                </div>
                                <p className="text-gray-700 mb-2">{broadcast.message}</p>
                                <p className="text-sm text-gray-500">
                                    Sent on {new Date(broadcast.sent_at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemBroadcast;