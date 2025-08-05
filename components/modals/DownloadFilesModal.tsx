import React, { useState, useEffect } from 'react';
import { getProjectDetails, downloadFile } from '../../services/assignmentService';
import { ProjectFile } from '../../types';
import Button from '../Button';
import EnhancedModal from '../common/EnhancedModal';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

const DownloadSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
);

const DownloadFilesModal: React.FC<ModalProps> = ({ isOpen, onClose, projectId }) => {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState<{[key: number]: boolean}>({});

    useEffect(() => {
        if (!isOpen) return;

        const fetchFiles = async () => {
            setLoading(true);
            setError('');
            try {
                const projectDetails = await getProjectDetails(projectId);
                const finalFiles = projectDetails.project_files
                    .filter(f => f.purpose === 'final_delivery')
                    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
                setFiles(finalFiles);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load files.');
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, [isOpen, projectId]);

    const handleDownload = async (file: ProjectFile) => {
        setDownloading(prev => ({ ...prev, [file.id]: true }));
        try {
            const blob = await downloadFile(file.file_path);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = file.file_name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (downloadError) {
            alert(`Failed to download ${file.file_name}: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
        } finally {
            setDownloading(prev => ({ ...prev, [file.id]: false }));
        }
    };

    if (!isOpen) return null;

    return (
        <EnhancedModal
            isOpen={isOpen}
            onClose={onClose}
            title="Download Final Files"
            size="md"
        >
            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="loading-spinner w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="ml-3 text-gray-600">Loading files...</span>
                </div>
            )}
            
            {error && (
                <div className="error-message bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <div className="text-red-600 font-semibold">{error}</div>
                </div>
            )}

            {!loading && !error && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {files.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📁</div>
                            <p className="text-gray-500 text-lg">No final files have been uploaded yet.</p>
                        </div>
                    ) : (
                        files.map((file, index) => (
                            <div 
                                key={file.id} 
                                className={`
                                    p-4 rounded-xl flex justify-between items-center transition-all duration-200
                                    ${index === 0 
                                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 shadow-sm' 
                                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                    }
                                `}
                            >
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-800 mb-1">{file.file_name}</p>
                                    <p className="text-sm text-gray-500">
                                        Uploaded: {new Date(file.uploaded_at).toLocaleString()}
                                    </p>
                                    {index === 0 && (
                                        <div className="mt-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                                ✨ Latest Version
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={() => handleDownload(file)}
                                    className="!w-auto py-2 px-4 text-sm btn-enhanced ml-4"
                                    disabled={downloading[file.id]}
                                >
                                    {downloading[file.id] ? (
                                        <div className="flex items-center space-x-2">
                                            <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                            <span>Downloading...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2">
                                            <span>📥</span>
                                            <span>Download</span>
                                        </div>
                                    )}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </EnhancedModal>
    );
};

export default DownloadFilesModal;