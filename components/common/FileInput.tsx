import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { COLORS } from '../../constants';

interface FileInputProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
}

const FileInput: React.FC<FileInputProps> = ({ onFilesSelected, maxFiles = 5 }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError('');
    if (fileRejections.length > 0) {
      setError('Some files were rejected. Please check file size limits (100MB max).');
    }
    
    const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
    setFiles(newFiles);
    onFilesSelected(newFiles);

    if ([...files, ...acceptedFiles].length > maxFiles) {
        setError(`You can only upload a maximum of ${maxFiles} files.`);
    }

  }, [files, maxFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // The 'accept' property has been removed to allow all file types.
    maxSize: 100 * 1024 * 1024, // 100MB
  });
  
  const removeFile = (fileName: string) => {
    const newFiles = files.filter(file => file.name !== fileName);
    setFiles(newFiles);
    onFilesSelected(newFiles);
    setError(''); // Clear error when a file is removed
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-gray-500">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="font-semibold">{isDragActive ? 'Drop the files here...' : 'Click to upload or drag and drop'}</p>
            <p className="text-xs mt-1">All file types accepted. Max {maxFiles} files, up to 100MB each.</p>
        </div>
      </div>
      {error && <p className="text-sm mt-2" style={{ color: COLORS.red }}>{error}</p>}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
            <h4 className="font-semibold text-gray-700">Selected files:</h4>
            <ul className="list-disc list-inside bg-white p-3 rounded-lg border">
                {files.map((file, index) => (
                    <li key={index} className="text-sm text-gray-800 flex justify-between items-center break-all">
                        <span className="flex-1 mr-2">{file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button onClick={() => removeFile(file.name)} className="text-red-500 hover:text-red-700 font-bold text-lg flex-shrink-0">&times;</button>
                    </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};

export default FileInput;