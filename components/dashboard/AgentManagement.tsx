import React, { useState, useEffect } from 'react';
import { Profile } from '../../types';
import Button from '../Button';
import ModernSearchField from '../common/ModernSearchField';

interface AgentManagementProps {
    agents: Profile[];
}

interface AgentPricing {
    id: number;
    agent_id: string;
    min_word_count: number;
    max_word_count: number;
    base_rate_per_500_words: number;
    agent_fee_percentage: number;
    created_at: string;
    updated_at: string;
}

interface AgentWithPricing extends Profile {
    pricing?: AgentPricing;
    stats?: {
        total_projects: number;
        completed_projects: number;
        total_revenue: number;
        total_profit: number;
        clients_recruited: number;
    };
}

const AgentManagement: React.FC<AgentManagementProps> = ({ agents }) => {
    const [agentsWithData, setAgentsWithData] = useState<AgentWithPricing[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentWithPricing | null>(null);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [pricingForm, setPricingForm] = useState({
        min_word_count: 500,
        max_word_count: 20000,
        base_rate_per_500_words: 6.25,
        agent_fee_percentage: 15.0
    });

    useEffect(() => {
        fetchAgentData();
    }, [agents]);

    const fetchAgentData = async () => {
        setLoading(true);
        try {
            const agentsWithPricingAndStats = await Promise.all(
                agents.map(async (agent) => {
                    const agentWithData: AgentWithPricing = { ...agent };

                    // Fetch pricing data
                    try {
                        const pricingResponse = await fetch(`/api/agent-pricing/${agent.id}`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                            }
                        });
                        if (pricingResponse.ok) {
                            const pricingData = await pricingResponse.json();
                            agentWithData.pricing = pricingData.data;
                        }
                    } catch (error) {
                        console.error(`Error fetching pricing for agent ${agent.id}:`, error);
                    }

                    // Fetch stats data
                    try {
                        const statsResponse = await fetch(`/api/agents/${agent.id}/stats`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                            }
                        });
                        if (statsResponse.ok) {
                            const statsData = await statsResponse.json();
                            agentWithData.stats = statsData.data;
                        }
                    } catch (error) {
                        console.error(`Error fetching stats for agent ${agent.id}:`, error);
                    }

                    return agentWithData;
                })
            );

            setAgentsWithData(agentsWithPricingAndStats);
        } catch (error) {
            console.error('Error fetching agent data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAgents = agentsWithData.filter(agent =>
        agent.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSetPricing = (agent: AgentWithPricing) => {
        setSelectedAgent(agent);
        if (agent.pricing) {
            setPricingForm({
                min_word_count: agent.pricing.min_word_count,
                max_word_count: agent.pricing.max_word_count,
                base_rate_per_500_words: agent.pricing.base_rate_per_500_words,
                agent_fee_percentage: agent.pricing.agent_fee_percentage
            });
        } else {
            setPricingForm({
                min_word_count: 500,
                max_word_count: 20000,
                base_rate_per_500_words: 6.25,
                agent_fee_percentage: 15.0
            });
        }
        setShowPricingModal(true);
    };

    const handleSavePricing = async () => {
        if (!selectedAgent) return;

        try {
            const response = await fetch(`/api/agent-pricing/${selectedAgent.id}`, {
                method: selectedAgent.pricing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(pricingForm)
            });

            if (response.ok) {
                // Refresh agent data
                await fetchAgentData();
                setShowPricingModal(false);
                setSelectedAgent(null);
            } else {
                throw new Error('Failed to save pricing');
            }
        } catch (error) {
            console.error('Error saving pricing:', error);
            alert('Failed to save pricing. Please try again.');
        }
    };

    const handleDeactivateAgent = async (agentId: string) => {
        if (!confirm('Are you sure you want to deactivate this agent? This will prevent them from accessing the system.')) {
            return;
        }

        try {
            const response = await fetch(`/api/agents/${agentId}/deactivate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (response.ok) {
                await fetchAgentData();
            } else {
                throw new Error('Failed to deactivate agent');
            }
        } catch (error) {
            console.error('Error deactivating agent:', error);
            alert('Failed to deactivate agent. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading agent data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Agent Management</h2>
                    <p className="text-gray-600">Manage your agent network and pricing</p>
                </div>
                <div className="text-sm text-gray-500">
                    {agents.length} total agents
                </div>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <ModernSearchField
                    placeholder="Search agents by name, email, or ID"
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
            </div>

            {/* Agents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map(agent => (
                    <div key={agent.id} className="bg-white rounded-lg shadow-sm border p-6">
                        {/* Agent Info */}
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-lg">
                                    {agent.full_name?.charAt(0) || 'A'}
                                </span>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-semibold text-gray-900">{agent.full_name || 'Unknown Agent'}</h3>
                                <p className="text-sm text-gray-500">{agent.email}</p>
                            </div>
                        </div>

                        {/* Stats */}
                        {agent.stats && (
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{agent.stats.completed_projects}</div>
                                    <div className="text-xs text-gray-500">Completed</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{agent.stats.clients_recruited}</div>
                                    <div className="text-xs text-gray-500">Clients</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-purple-600">
                                        £{agent.stats.total_revenue.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-xs text-gray-500">Revenue</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-orange-600">
                                        £{agent.stats.total_profit.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-xs text-gray-500">Profit</div>
                                </div>
                            </div>
                        )}

                        {/* Pricing Info */}
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Pricing Configuration</h4>
                            {agent.pricing ? (
                                <div className="text-xs text-gray-600 space-y-1">
                                    <p>Base Rate: £{agent.pricing.base_rate_per_500_words}/500 words</p>
                                    <p>Agent Fee: {agent.pricing.agent_fee_percentage}%</p>
                                    <p>Range: {agent.pricing.min_word_count}-{agent.pricing.max_word_count} words</p>
                                </div>
                            ) : (
                                <p className="text-xs text-red-600">No pricing configured</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                            <Button
                                onClick={() => handleSetPricing(agent)}
                                className="flex-1 !py-2 !text-sm"
                            >
                                {agent.pricing ? 'Update Pricing' : 'Set Pricing'}
                            </Button>
                            <button
                                onClick={() => handleDeactivateAgent(agent.id)}
                                className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                Deactivate
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* No Results */}
            {filteredAgents.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">No agents found</div>
                    <p className="text-gray-500">Try adjusting your search criteria</p>
                </div>
            )}

            {/* Pricing Modal */}
            {showPricingModal && selectedAgent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Set Pricing for {selectedAgent.full_name}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Base Rate per 500 words (£)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={pricingForm.base_rate_per_500_words}
                                    onChange={(e) => setPricingForm(prev => ({
                                        ...prev,
                                        base_rate_per_500_words: parseFloat(e.target.value) || 0
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Agent Fee Percentage (%)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={pricingForm.agent_fee_percentage}
                                    onChange={(e) => setPricingForm(prev => ({
                                        ...prev,
                                        agent_fee_percentage: parseFloat(e.target.value) || 0
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Min Word Count
                                    </label>
                                    <input
                                        type="number"
                                        value={pricingForm.min_word_count}
                                        onChange={(e) => setPricingForm(prev => ({
                                            ...prev,
                                            min_word_count: parseInt(e.target.value) || 0
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Word Count
                                    </label>
                                    <input
                                        type="number"
                                        value={pricingForm.max_word_count}
                                        onChange={(e) => setPricingForm(prev => ({
                                            ...prev,
                                            max_word_count: parseInt(e.target.value) || 0
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <Button onClick={handleSavePricing} className="flex-1">
                                Save Pricing
                            </Button>
                            <button
                                onClick={() => {
                                    setShowPricingModal(false);
                                    setSelectedAgent(null);
                                }}
                                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentManagement;