import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitChangeRequest } from '../../services/assignmentService';
import { ChangesFormData } from '../../types';
import Button from '../Button';
import FileInput from '../common/FileInput';
import EnhancedModal from '../common/EnhancedModal';
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
        <EnhancedModal
            isOpen={isOpen}
            onClose={onClose}
            title="Request Changes"
            size="md"
        >
            {status === 'success' ? (
                <div className="text-center py-12">
                    <div className="success-message bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-2xl font-bold text-green-700 mb-3">Request Submitted!</h3>
                        <p className="text-green-600 text-lg">Your change request has been sent. The project status has been updated.</p>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                        <h4 className="font-bold text-lg text-blue-800 mb-2 flex items-center">
                            <span className="text-2xl mr-3">📝</span>
                            Change Instructions
                        </h4>
                        <p className="text-blue-700">
                            Clearly describe what changes you need. Be specific to help the worker understand your requirements.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="instructions" className="text-sm font-bold text-gray-700 mb-3 block">
                            Instructions *
                        </label>
                        <textarea
                            id="instructions"
                            name="instructions"
                            placeholder="Clearly describe the changes you need..."
                            className="form-input w-full rounded-xl p-4 text-base h-32 resize-none focus:outline-none"
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div>
                        <p className="text-sm font-bold text-gray-700 mb-3 block">
                            Upload Additional Files (optional)
                        </p>
                        <FileInput onFilesSelected={setFiles} maxFiles={5} />
                    </div>

                    {status === 'error' && (
                        <div className="error-message bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="pt-4">
                        <Button 
                            type="submit" 
                            disabled={status === 'submitting' || !isFormValid} 
                            className="w-full btn-enhanced"
                        >
                            {status === 'submitting' ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    <span>Submitting...</span>
                                </div>
                            ) : (
                                'Submit Request'
                            )}
                        </Button>
                    </div>
                </form>
            )}
        </EnhancedModal>
    );
};

export default RequestChangesModal;