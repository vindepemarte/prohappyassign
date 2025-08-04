import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { createNewProject, calculatePrice } from '../services/assignmentService';
import { NewProjectFormData } from '../types';
import Button from './Button';
import Input from './Input';
import FileInput from './common/FileInput';
import { COLORS } from '../constants';

const NewProjectForm: React.FC<{ onFormSubmit: () => void }> = ({ onFormSubmit }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState<NewProjectFormData>({
        title: '',
        wordCount: 0,
        deadline: '',
        guidance: '',
        files: [],
    });
    const [price, setPrice] = useState(0);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    useEffect(() => {
        const calculatedPrice = calculatePrice(formData.wordCount);
        setPrice(calculatedPrice);
    }, [formData.wordCount]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'wordCount' ? parseInt(value, 10) || 0 : value }));
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
            await createNewProject(formData, user.id);
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
            
            {price > 0 && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-semibold text-gray-700">Estimated Price: </span>
                    <span className="font-bold text-xl text-blue-600">£{price.toFixed(2)}</span>
                </div>
            )}

            <Input name="deadline" type="date" label="📅 Project Deadline*" onChange={handleInputChange} required />

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