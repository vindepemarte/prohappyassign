
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getProjectDetails, getFileUrl, submitFinalWork, requestWordCountChange, cancelProject, requestDeadlineExtension } from '../../services/assignmentService';
import { ProjectWithDetails } from '../../types';
import Button from '../Button';
import Input from '../Input';
import FileInput from '../common/FileInput';
import EnhancedModal from '../common/EnhancedModal';
import ConfirmationPopup from '../common/ConfirmationPopup';
import { COLORS } from '../../constants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

type ModalTab = 'overview' | 'changes' | 'submit' | 'adjust' | 'cancel' | 'deadline';

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
);

const ProjectDetailModal: React.FC<ModalProps> = ({ isOpen, onClose, projectId }) => {
    const { user } = useAuth();
    const [project, setProject] = useState<ProjectWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<ModalTab>('overview');
    
    // States for forms
    const [finalFiles, setFinalFiles] = useState<File[]>([]);
    const [newWordCount, setNewWordCount] = useState<number>(0);
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [formError, setFormError] = useState('');
    
    // Cancellation states
    const [cancellationReason, setCancellationReason] = useState('');
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    
    // Deadline extension states
    const [requestedDeadline, setRequestedDeadline] = useState('');
    const [extensionReason, setExtensionReason] = useState('');
    const [deadlineExtensions, setDeadlineExtensions] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && projectId) {
            fetchDetails();
        } else {
            // Reset state when modal is closed
            setProject(null);
            setLoading(true);
            setError('');
            setActiveTab('overview');
            resetForms();
        }
    }, [isOpen, projectId]);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const data = await getProjectDetails(projectId);
            setProject(data);
            setNewWordCount(data.adjusted_word_count || data.initial_word_count);
            
            // Set minimum deadline to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setRequestedDeadline(tomorrow.toISOString().split('T')[0]);
            
            // Set deadline extensions from project data
            setDeadlineExtensions(data.deadline_extension_requests || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load project details.');
        } finally {
            setLoading(false);
        }
    };
    
    const resetForms = () => {
        setFinalFiles([]);
        setNewWordCount(project?.initial_word_count || 0);
        setFormStatus('idle');
        setFormError('');
        setCancellationReason('');
        setShowCancelConfirmation(false);
        setExtensionReason('');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRequestedDeadline(tomorrow.toISOString().split('T')[0]);
    };
    
    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !project) return;
        setFormStatus('submitting');
        setFormError('');
        try {
            await submitFinalWork(project.id, finalFiles, user.id);
            setFormStatus('success');
            setTimeout(onClose, 2000);
        } catch (e) {
            setFormStatus('error');
            setFormError(e instanceof Error ? e.message : 'Submission failed.');
        }
    };
    
    const handleAdjustSubmit = async (e: React.FormEvent) => {
         e.preventDefault();
        if (!user || !project) return;
        setFormStatus('submitting');
        setFormError('');
        try {
            await requestWordCountChange(project.id, newWordCount);
            setFormStatus('success');
            setTimeout(onClose, 2000);
        } catch (e) {
            setFormStatus('error');
            setFormError(e instanceof Error ? e.message : 'Failed to submit adjustment.');
        }
    }

    const handleCancelProject = async () => {
        if (!user || !project || !cancellationReason.trim()) return;
        setFormStatus('submitting');
        setFormError('');
        try {
            await cancelProject(project.id, cancellationReason, user.id);
            setFormStatus('success');
            setTimeout(onClose, 2000);
        } catch (e) {
            setFormStatus('error');
            setFormError(e instanceof Error ? e.message : 'Failed to cancel project.');
        }
    };

    const handleCancelClick = () => {
        if (!cancellationReason.trim()) {
            setFormError('Please provide a reason for cancellation.');
            return;
        }
        setShowCancelConfirmation(true);
    };

    const handleDeadlineExtensionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !project || !requestedDeadline || !extensionReason.trim()) return;
        
        setFormStatus('submitting');
        setFormError('');
        
        try {
            const deadlineDate = new Date(requestedDeadline);
            await requestDeadlineExtension(project.id, deadlineDate, extensionReason, user.id);
            setFormStatus('success');
            setTimeout(onClose, 2000);
        } catch (e) {
            setFormStatus('error');
            setFormError(e instanceof Error ? e.message : 'Failed to submit deadline extension request.');
        }
    };

    if (!isOpen) return null;

    const renderFileLink = (file: { file_name: string; file_path: string }) => (
        <a href={getFileUrl(file.file_path)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {file.file_name}
        </a>
    );

    const renderTabContent = () => {
        if (!project) return null;

        if (formStatus === 'success') {
            return (
                <div className="text-center py-16">
                    <div className="success-message bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-3xl font-bold text-green-700 mb-3">Success!</h3>
                        <p className="text-green-600 text-lg">The project has been updated successfully.</p>
                    </div>
                </div>
            )
        }
        
        switch (activeTab) {
            case 'overview':
                const initialFiles = project.project_files.filter(f => f.purpose === 'initial_brief');
                return (
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg">Project Overview</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description || "No additional guidance provided."}</p>
                        <div className="text-sm border-t pt-4">
                            <h5 className="font-semibold mb-2">Initial Files from Client:</h5>
                            {initialFiles.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {initialFiles.map(file => <li key={file.id}>{renderFileLink(file)}</li>)}
                                </ul>
                            ) : <p className="text-gray-500">No initial files were uploaded.</p>}
                        </div>
                    </div>
                );
            case 'changes': {
                const changeFiles = project.project_files.filter(f => f.purpose === 'change_request');
                const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

                return (
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg">Change Request History</h4>
                        {project.project_change_requests.length > 0 ? (
                            <ul className="space-y-6">
                                {project.project_change_requests.map((req, index) => {
                                    const requestDate = new Date(req.created_at);
                                    const relevantFiles = changeFiles.filter(file => isSameDay(new Date(file.uploaded_at), requestDate));
                                    const isLatest = index === 0;

                                    return (
                                        <li key={req.id} className={`p-4 rounded-xl transition-all ${isLatest ? 'bg-yellow-50 border-2 border-yellow-400 shadow-lg' : 'bg-slate-50 border'}`}>
                                            {isLatest && (
                                                <div className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2">
                                                    Latest Request
                                                </div>
                                            )}
                                            <p className="text-sm font-semibold text-gray-800">Requested on: {requestDate.toLocaleString()}</p>
                                            <p className="mt-2 text-gray-800 whitespace-pre-wrap">{req.instructions}</p>
                                            
                                            {relevantFiles.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-yellow-200">
                                                    <h6 className="font-semibold text-sm text-gray-700">Associated Files:</h6>
                                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                                        {relevantFiles.map(file => <li key={file.id}>{renderFileLink(file)}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : <p className="text-gray-500">No change requests have been made for this project.</p>}
                    </div>
                );
            }
            case 'submit':
                return (
                    <form onSubmit={handleFinalSubmit} className="space-y-6">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                            <h4 className="font-bold text-xl text-green-800 mb-3 flex items-center">
                                <span className="text-2xl mr-3">📤</span>
                                Submit Final Work
                            </h4>
                            <p className="text-green-700 leading-relaxed">
                                Upload your completed assignment files. This will notify the agent for final review.
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <FileInput onFilesSelected={setFinalFiles} maxFiles={10} />
                            
                            {formError && (
                                <div className="error-message bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-red-600 font-medium">{formError}</p>
                                </div>
                            )}
                            
                            <Button 
                                type="submit" 
                                disabled={formStatus === 'submitting' || finalFiles.length === 0}
                                className="btn-enhanced"
                            >
                                {formStatus === 'submitting' ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Submitting...</span>
                                    </div>
                                ) : (
                                    'Submit for Review'
                                )}
                            </Button>
                        </div>
                    </form>
                )
            case 'adjust':
                return (
                    <form onSubmit={handleAdjustSubmit} className="space-y-6">
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                            <h4 className="font-bold text-xl text-orange-800 mb-3 flex items-center">
                                <span className="text-2xl mr-3">📊</span>
                                Adjust Word Count
                            </h4>
                            <p className="text-orange-700 leading-relaxed">
                                If the initial word count was incorrect, you can request an adjustment here. This will send a new quote to the client for approval.
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <Input 
                                label="New Word Count"
                                type="number"
                                value={newWordCount}
                                onChange={(e) => setNewWordCount(parseInt(e.target.value, 10))}
                                required
                                className="form-input"
                            />
                            
                            {formError && (
                                <div className="error-message bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-red-600 font-medium">{formError}</p>
                                </div>
                            )}
                            
                            <Button 
                                type="submit" 
                                variant="secondary" 
                                disabled={formStatus === 'submitting' || newWordCount === project.initial_word_count}
                                className="btn-enhanced"
                            >
                                {formStatus === 'submitting' ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Submitting...</span>
                                    </div>
                                ) : (
                                    'Request Adjustment'
                                )}
                            </Button>
                        </div>
                    </form>
                )
            case 'cancel':
                return (
                    <div className="space-y-6">
                        <div className="danger-zone rounded-xl p-6">
                            <h4 className="font-bold text-xl text-red-800 mb-3 flex items-center">
                                <span className="text-2xl mr-3">⚠️</span>
                                Cancel Project
                            </h4>
                            <p className="text-red-700 leading-relaxed">
                                Cancelling this project will set its status to "refund" and notify the agent to process a refund for the client. 
                                This action cannot be undone.
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Reason for Cancellation *
                                </label>
                                <textarea
                                    value={cancellationReason}
                                    onChange={(e) => setCancellationReason(e.target.value)}
                                    placeholder="Please explain why you need to cancel this project..."
                                    className="form-input w-full px-4 py-3 rounded-xl resize-none focus:outline-none"
                                    rows={4}
                                    required
                                />
                            </div>
                            {formError && (
                                <div className="error-message bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-red-600 font-medium">{formError}</p>
                                </div>
                            )}
                            <Button 
                                onClick={handleCancelClick}
                                variant="danger"
                                disabled={formStatus === 'submitting' || !cancellationReason.trim()}
                                className="btn-enhanced"
                            >
                                {formStatus === 'submitting' ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    'Cancel Project'
                                )}
                            </Button>
                        </div>
                    </div>
                )
            case 'deadline':
                const currentDeadline = new Date(project.deadline);
                const minDate = new Date();
                minDate.setDate(minDate.getDate() + 1);
                
                return (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-bold text-lg text-blue-800 mb-2">📅 Request Deadline Extension</h4>
                            <p className="text-sm text-blue-700 mb-2">
                                Current deadline: <strong>{currentDeadline.toLocaleDateString()}</strong>
                            </p>
                            <p className="text-sm text-blue-700">
                                If you need more time to complete this project, you can request a deadline extension. 
                                The client and agent will be notified of your request.
                            </p>
                        </div>

                        {/* Show existing extension requests */}
                        {deadlineExtensions.length > 0 && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h5 className="font-semibold text-gray-800 mb-3">Previous Extension Requests</h5>
                                <div className="space-y-2">
                                    {deadlineExtensions.map((extension, index) => (
                                        <div key={extension.id} className={`p-3 rounded-lg border ${
                                            extension.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                                            extension.status === 'approved' ? 'bg-green-50 border-green-200' :
                                            'bg-red-50 border-red-200'
                                        }`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        Requested: {new Date(extension.requested_deadline).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        {extension.reason}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    extension.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    extension.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {extension.status.charAt(0).toUpperCase() + extension.status.slice(1)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleDeadlineExtensionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Requested Deadline *
                                </label>
                                <input
                                    type="date"
                                    value={requestedDeadline}
                                    onChange={(e) => setRequestedDeadline(e.target.value)}
                                    min={minDate.toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Must be later than the current deadline ({currentDeadline.toLocaleDateString()})
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason for Extension *
                                </label>
                                <textarea
                                    value={extensionReason}
                                    onChange={(e) => setExtensionReason(e.target.value)}
                                    placeholder="Please explain why you need more time to complete this project..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    rows={4}
                                    required
                                />
                            </div>
                            
                            {formError && <p className="text-sm text-center text-red-600">{formError}</p>}
                            
                            <Button 
                                type="submit"
                                disabled={formStatus === 'submitting' || !requestedDeadline || !extensionReason.trim()}
                                className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600"
                            >
                                {formStatus === 'submitting' ? 'Submitting Request...' : 'Request Extension'}
                            </Button>
                        </form>
                    </div>
                )
        }
    };
    
    const TabButton: React.FC<{ tabId: ModalTab; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => { setActiveTab(tabId); resetForms(); }}
            className={`
                px-6 py-3 font-semibold text-sm rounded-t-xl transition-all duration-200 
                tab-button relative ${
                activeTab === tabId
                    ? 'active text-blue-600 bg-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
        >
            {children}
        </button>
    );

    return (
        <>
            <EnhancedModal
                isOpen={isOpen}
                onClose={onClose}
                size="lg"
                title={project ? project.title : 'Project Details'}
                className="project-detail-modal"
            >
                {project?.order_reference && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                        <p className="text-sm text-blue-700">
                            Order Reference: <span className="font-mono font-bold text-blue-800 text-lg">{project.order_reference}</span>
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center items-center py-20">
                        <div className="loading-spinner w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                        <span className="ml-3 text-gray-600">Loading project details...</span>
                    </div>
                )}
                
                {error && (
                    <div className="text-center py-10">
                        <div className="error-message bg-red-50 border border-red-200 rounded-xl p-6">
                            <div className="text-red-600 text-lg font-semibold mb-2">Error Loading Project</div>
                            <div className="text-red-700">{error}</div>
                        </div>
                    </div>
                )}
                
                {!loading && !error && project && (
                    <div>
                        <div className="bg-gray-50 rounded-xl p-1 mb-6 flex flex-wrap gap-1">
                            <TabButton tabId="overview">Overview</TabButton>
                            <TabButton tabId="changes">Change Requests</TabButton>
                            <TabButton tabId="submit">Submit Work</TabButton>
                            <TabButton tabId="adjust">Adjust Scope</TabButton>
                            {/* Show deadline extension tab only for workers and active projects */}
                            {user?.role === 'worker' && project.worker_id === user.id && 
                             !['completed', 'cancelled', 'refund'].includes(project.status) && (
                                <TabButton tabId="deadline">Request Deadline</TabButton>
                            )}
                            {/* Show cancel tab only for workers and cancellable projects */}
                            {user?.role === 'worker' && project.worker_id === user.id && 
                             !['completed', 'cancelled', 'refund'].includes(project.status) && (
                                <TabButton tabId="cancel">
                                    <span className="text-red-600">Cancel Project</span>
                                </TabButton>
                            )}
                        </div>
                        
                        <div className="min-h-[400px]">
                            {renderTabContent()}
                        </div>
                    </div>
                )}
            </EnhancedModal>

            <ConfirmationPopup
                isOpen={showCancelConfirmation}
                onClose={() => setShowCancelConfirmation(false)}
                onConfirm={handleCancelProject}
                title="Cancel Project"
                message="This will immediately cancel the project and trigger a refund process. The client and agents will be notified."
                details={`Reason: "${cancellationReason}"`}
                confirmText="Yes, Cancel Project"
                cancelText="Go Back"
                variant="danger"
                isLoading={formStatus === 'submitting'}
            />
        </>
    );
};

export default ProjectDetailModal;
