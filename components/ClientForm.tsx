import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { createNewProject } from '../services/assignmentService';
import { NewProjectFormData, PricingBreakdown as PricingBreakdownType } from '../types';
import Button from './Button';
import Input from './Input';
import FileInput from './common/FileInput';
import PricingBreakdown from './common/PricingBreakdown';
import { COLORS } from '../constants';

const NewProjectForm: React.FC<{ onFormSubmit: () => void }> = ({ onFormSubmit }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState<NewProjectFormData>({
        title: '',
        wordCount: 0,
        deadline: '',
        guidance: '',
        files: [],
        projectNumbers: '', // Add project numbers field
    });
    const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdownType | null>(null);
    const [agentPricing, setAgentPricing] = useState<any>(null);
    const [agentInfo, setAgentInfo] = useState<any>(null);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');
    const [loadingPricing, setLoadingPricing] = useState(false);

    // Fetch client's assigned agent and their pricing on component mount
    useEffect(() => {
        fetchAgentPricing();
    }, [user]);

    // Calculate pricing when word count, deadline, or agent pricing changes
    useEffect(() => {
        if (formData.wordCount > 0 && formData.deadline && agentPricing) {
            calculateAgentBasedPricing();
        } else {
            setPricingBreakdown(null);
        }
    }, [formData.wordCount, formData.deadline, agentPricing]);

    const fetchAgentPricing = async () => {
        if (!user) return;

        try {
            setLoadingPricing(true);

            // Get client's hierarchy info to find their assigned agent
            const hierarchyResponse = await fetch('/api/hierarchy/my-hierarchy', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (hierarchyResponse.ok) {
                const hierarchyData = await hierarchyResponse.json();
                const parentId = hierarchyData.data.parent_id;

                if (parentId) {
                    // Get agent info
                    const agentResponse = await fetch(`/api/users/by-ids`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ userIds: [parentId] })
                    });

                    if (agentResponse.ok) {
                        const agentData = await agentResponse.json();
                        const agent = agentData.data?.[0];
                        setAgentInfo(agent);

                        // Get agent's pricing configuration
                        const pricingResponse = await fetch(`/api/agent-pricing/${parentId}`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });

                        if (pricingResponse.ok) {
                            const pricingData = await pricingResponse.json();
                            setAgentPricing(pricingData.data);
                        } else {
                            // Use default pricing if agent hasn't configured their rates
                            setAgentPricing({
                                min_word_count: 500,
                                max_word_count: 20000,
                                base_rate_per_500_words: 6.25,
                                agent_fee_percentage: 15.0
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch agent pricing:', error);
            // Use default pricing as fallback
            setAgentPricing({
                min_word_count: 500,
                max_word_count: 20000,
                base_rate_per_500_words: 6.25,
                agent_fee_percentage: 15.0
            });
        } finally {
            setLoadingPricing(false);
        }
    };

    const calculateAgentBasedPricing = () => {
        if (!agentPricing) return;

        const wordCount = formData.wordCount;
        const deadline = new Date(formData.deadline);
        const requestDate = new Date();

        // Calculate base cost using agent's rate
        const baseCost = (wordCount / 500) * agentPricing.base_rate_per_500_words;
        
        // Calculate agent fee
        const agentFee = baseCost * (agentPricing.agent_fee_percentage / 100);
        
        // Calculate deadline charges (same logic as original)
        const timeDiff = deadline.getTime() - requestDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        let deadlineCharge = 0;
        let urgencyLevel: 'normal' | 'moderate' | 'urgent' | 'rush' = 'normal';
        
        if (daysDiff <= 1) {
            deadlineCharge = (baseCost + agentFee) * 0.30; // 30% rush charge
            urgencyLevel = 'rush';
        } else if (daysDiff <= 2) {
            deadlineCharge = (baseCost + agentFee) * 0.10; // 10% urgent charge
            urgencyLevel = 'urgent';
        } else if (daysDiff <= 6) {
            deadlineCharge = (baseCost + agentFee) * 0.05; // 5% moderate charge
            urgencyLevel = 'moderate';
        }

        const totalPrice = baseCost + agentFee + deadlineCharge;

        const breakdown: PricingBreakdownType = {
            basePrice: baseCost,
            deadlineCharge: deadlineCharge,
            totalPrice: totalPrice,
            urgencyLevel: urgencyLevel,
            wordCount: wordCount,
            deadline: deadline,
            agentInfo: {
                name: agentInfo?.full_name || 'Your Agent',
                baseRate: agentPricing.base_rate_per_500_words,
                feePercentage: agentPricing.agent_fee_percentage,
                agentFee: agentFee
            }
        };

        setPricingBreakdown(breakdown);
    };

    const createClientProject = async (
        formData: NewProjectFormData, 
        clientId: string, 
        pricing: PricingBreakdownType | null,
        agentId?: string
    ) => {
        if (!pricing) {
            throw new Error('Pricing information is required');
        }

        // Generate unique order reference
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const orderReference = `PRO-${year}-${random}`;

        const projectData = {
            client_id: clientId,
            agent_id: agentId, // Assign to client's agent
            title: formData.title,
            initial_word_count: formData.wordCount,
            deadline: formData.deadline,
            description: formData.guidance,
            cost_gbp: pricing.totalPrice,
            deadline_charge: pricing.deadlineCharge,
            urgency_level: pricing.urgencyLevel,
            order_reference: orderReference,
            status: 'pending_payment_approval' as const,
            project_numbers: formData.projectNumbers || null, // Add project numbers
        };

        // Create the project
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(projectData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create project');
        }

        const createdProject = await response.json();

        // Upload files if any
        if (formData.files && formData.files.length > 0) {
            const formDataFiles = new FormData();
            formData.files.forEach(file => {
                formDataFiles.append('files', file);
            });

            const uploadResponse = await fetch(`/api/files/upload/${createdProject.data.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formDataFiles
            });

            if (!uploadResponse.ok) {
                console.error('Failed to upload files, but project was created');
            }
        }

        return createdProject.data;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: name === 'wordCount' ? parseInt(value, 10) || 0 : value 
        }));
    };

    const handleFileChange = (acceptedFiles: File[]) => {
        setFormData(prev => ({ ...prev, files: acceptedFiles }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError('You must be logged in to submit a project.');
            return;
        }
        setStatus('submitting');
        setError('');

        try {
            // Create project with agent-specific pricing and assignment
            await createClientProject(formData, user.id, pricingBreakdown, agentInfo?.id);
            setStatus('success');
            setTimeout(() => {
                onFormSubmit();
            }, 3000);
        } catch (submitError) {
            setStatus('error');
            setError(submitError instanceof Error ? submitError.message : 'An unknown error occurred.');
        }
    };
    
    const isFormValid = useMemo(() => {
        return formData.title && formData.wordCount > 0 && formData.deadline && formData.files.length > 0;
    }, [formData]);
    
    if (status === 'success') {
        return (
            <div className="text-center space-y-4 p-6 rounded-2xl bg-green-50 border border-green-200">
                <h3 className="text-2xl font-bold text-green-700">Project Submitted!</h3>
                <p className="text-gray-600">Your project has been submitted for payment approval.</p>
                <p className="text-gray-600">You can track its status in the "My Assignments" section.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="font-bold text-xl text-gray-800 border-b pb-3 mb-6">📝 New Project Details</h3>
            
            <Input name="title" placeholder="e.g., Marketing Strategy Analysis" label="📚 Module Name*" onChange={handleInputChange} required />
            <Input name="wordCount" type="number" placeholder="0" label="📊 Word Count*" onChange={handleInputChange} required />
            
            {/* Project Numbers Field */}
            <div>
                <Input 
                    name="projectNumbers" 
                    placeholder="e.g., PRJ-001, PRJ-002" 
                    label="🔢 Project Numbers (Optional)" 
                    onChange={handleInputChange} 
                />
                <p className="text-xs text-gray-500 mt-1">
                    💡 You can specify multiple project numbers separated by commas
                </p>
            </div>

            <div>
                <Input 
                    name="deadline" 
                    type="date" 
                    label="📅 Project Deadline*" 
                    onChange={handleInputChange} 
                    required 
                    min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">
                    💡 Tip: Shorter deadlines may include urgency charges. Select your deadline to see the pricing breakdown.
                </p>
            </div>

            {/* Agent Information Display */}
            {agentInfo && agentPricing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">📋 Your Agent's Pricing Structure</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                        <p><strong>Agent:</strong> {agentInfo.full_name}</p>
                        <p><strong>Base Rate:</strong> £{agentPricing.base_rate_per_500_words} per 500 words</p>
                        <p><strong>Agent Fee:</strong> {agentPricing.agent_fee_percentage}% of base cost</p>
                        <p><strong>Word Count Range:</strong> {agentPricing.min_word_count} - {agentPricing.max_word_count} words</p>
                    </div>
                </div>
            )}

            {loadingPricing && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-gray-600">Loading pricing information...</p>
                </div>
            )}
            
            {pricingBreakdown && (
                <PricingBreakdown 
                    breakdown={pricingBreakdown} 
                    showDetails={true}
                    className="mt-4"
                />
            )}

            <textarea
                name="guidance"
                placeholder="Enter any additional guidance or requirements for your project"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-base text-gray-800 focus:outline-none focus:border-[#4A90E2] transition-colors h-32"
                onChange={handleInputChange}
            />
            
            <div>
                 <p className="text-sm font-bold text-gray-600 mb-2 block">📎 Project Files*</p>
                 <FileInput onFilesSelected={handleFileChange} maxFiles={5} />
            </div>

            {status === 'error' && <p className="text-sm text-center" style={{ color: COLORS.red }}>{error}</p>}

            <div className="pt-4">
                 <Button type="submit" disabled={status === 'submitting' || !isFormValid} className="w-full">
                    {status === 'submitting' ? 'Submitting...' : 'Submit Project'}
                </Button>
            </div>
        </form>
    );
};

export default NewProjectForm;