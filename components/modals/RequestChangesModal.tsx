import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitChangeRequest } from '../../services/assignmentService';
import { ChangesFormData } from '../../types';
import Button from '../Button';
import FileInput from '../common/FileInput';
import { COLORS } from '../../constants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

const RequestChangesModal: React.FC<ModalProps> = ({ isOpen, onClose, projectId }) => {
    const { user } = useAuth();
    const [instructions, setInstructions] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError('You must be logged in.');
            return;
        }
        setStatus('submitting');
        setError('');

        const formData: ChangesFormData = {
            projectId,
            instructions,
            files,
        };

        try {
            await submitChangeRequest(formData, user.id);
            setStatus('success');
            setTimeout(() => {
                onClose(); // Close modal on success
                // Optionally, could have a callback to refresh project list
            }, 2000);
        } catch (submitError) {
            setStatus('error');
            setError(submitError instanceof Error ? submitError.message : 'An unknown error occurred.');
        }
    };
    
    const isFormValid = useMemo(() => instructions.trim().length > 0, [instructions]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Request Changes</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-2xl">&times;</button>
                </div>
                
                {status === 'success' ? (
                     <div className="text-center space-y-4 p-6 rounded-2xl bg-green-50 border border-green-200">
                        <h3 className="text-xl font-bold text-green-700">Request Submitted!</h3>
                        <p className="text-gray-600">Your change request has been sent. The project status has been updated.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="instructions" className="text-sm font-bold text-gray-600 mb-2 block">Instructions*</label>
                            <textarea
                                id="instructions"
                                name="instructions"
                                placeholder="Clearly describe the changes you need..."
                                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-base text-gray-800 focus:outline-none focus:border-[#4A90E2] transition-colors h-32"
                                value={instructions}
                                onChange={e => setInstructions(e.target.value)}
                                required
                            />
                        </div>
                        
                        <div>
                            <p className="text-sm font-bold text-gray-600 mb-2 block">Upload Additional Files (optional)</p>
                            <FileInput onFilesSelected={setFiles} maxFiles={5} />
                        </div>

                        {status === 'error' && <p className="text-sm text-center" style={{ color: COLORS.red }}>{error}</p>}

                        <div className="pt-4">
                            <Button type="submit" disabled={status === 'submitting' || !isFormValid} className="w-full">
                                {status === 'submitting' ? 'Submitting...' : 'Submit Request'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default RequestChangesModal;