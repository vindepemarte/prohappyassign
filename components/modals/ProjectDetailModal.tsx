
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getProjectDetails, getFileUrl, submitFinalWork, requestWordCountChange } from '../../services/assignmentService';
import { ProjectWithDetails, FilePurpose, ProjectFile } from '../../types';
import Button from '../Button';
import Input from '../Input';
import FileInput from '../common/FileInput';
import { COLORS } from '../../constants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

type ModalTab = 'overview' | 'changes' | 'submit' | 'adjust';

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
                <div className="text-center py-10">
                    <h3 className="text-2xl font-bold text-green-600">Success!</h3>
                    <p className="text-gray-600 mt-2">The project has been updated.</p>
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
                    <form onSubmit={handleFinalSubmit} className="space-y-4">
                        <h4 className="font-bold text-lg">Submit Final Work</h4>
                        <p className="text-sm text-gray-600">Upload your completed assignment files. This will notify the agent for final review.</p>
                        <FileInput onFilesSelected={setFinalFiles} maxFiles={10} />
                        {formError && <p className="text-sm text-center" style={{ color: COLORS.red }}>{formError}</p>}
                        <Button type="submit" disabled={formStatus === 'submitting' || finalFiles.length === 0}>
                            {formStatus === 'submitting' ? 'Submitting...' : 'Submit for Review'}
                        </Button>
                    </form>
                )
            case 'adjust':
                return (
                     <form onSubmit={handleAdjustSubmit} className="space-y-4">
                        <h4 className="font-bold text-lg">Adjust Word Count</h4>
                        <p className="text-sm text-gray-600">If the initial word count was incorrect, you can request an adjustment here. This will send a new quote to the client for approval.</p>
                        <Input 
                            label="New Word Count"
                            type="number"
                            value={newWordCount}
                            onChange={(e) => setNewWordCount(parseInt(e.target.value, 10))}
                            required
                        />
                        {formError && <p className="text-sm text-center" style={{ color: COLORS.red }}>{formError}</p>}
                        <Button type="submit" variant="secondary" disabled={formStatus === 'submitting' || newWordCount === project.initial_word_count}>
                             {formStatus === 'submitting' ? 'Submitting...' : 'Request Adjustment'}
                        </Button>
                    </form>
                )
        }
    };
    
    const TabButton: React.FC<{ tabId: ModalTab; children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => { setActiveTab(tabId); resetForms(); }}
            className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors border-b-2 ${
                activeTab === tabId
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center">
                    {project && <h2 className="text-xl font-bold text-gray-800">{project.title}</h2>}
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-2xl">&times;</button>
                </header>

                <div className="p-6 overflow-y-auto flex-grow">
                    {loading && <LoadingSpinner />}
                    {error && <div className="text-center text-red-500">{error}</div>}
                    {!loading && !error && project && (
                        <div>
                            <div className="border-b mb-4">
                                <TabButton tabId="overview">Overview</TabButton>
                                <TabButton tabId="changes">Change Requests</TabButton>
                                <TabButton tabId="submit">Submit Work</TabButton>
                                <TabButton tabId="adjust">Adjust Scope</TabButton>
                            </div>
                            {renderTabContent()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailModal;
