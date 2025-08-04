import React, { useState, useEffect } from 'react';
import { getProjectDetails, downloadFile } from '../../services/assignmentService';
import { ProjectFile } from '../../types';
import Button from '../Button';

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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Download Final Files</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-2xl">&times;</button>
                </div>
                
                {loading && <p className="text-center text-gray-500">Loading files...</p>}
                {error && <p className="text-center text-red-500">{error}</p>}

                {!loading && !error && (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {files.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">No final files have been uploaded yet.</p>
                        ) : (
                            files.map((file, index) => (
                                <div key={file.id} className={`p-3 rounded-lg flex justify-between items-center ${index === 0 ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                                    <div>
                                        <p className="font-semibold text-gray-800">{file.file_name}</p>
                                        <p className="text-xs text-gray-500">Uploaded: {new Date(file.uploaded_at).toLocaleString()}</p>
                                        {index === 0 && <p className="text-xs font-bold text-green-700">Latest Version</p>}
                                    </div>
                                    <Button
                                        onClick={() => handleDownload(file)}
                                        className="!w-auto py-2 px-4 text-sm"
                                        disabled={downloading[file.id]}
                                    >
                                        {downloading[file.id] ? <DownloadSpinner /> : 'Download'}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DownloadFilesModal;