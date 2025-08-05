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
        className={`
          w-full p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer 
          transition-all duration-300 transform hover:scale-[1.02]
          ${isDragActive 
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg' 
            : 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center">
          <div className={`
            p-4 rounded-full mb-4 transition-all duration-300
            ${isDragActive 
              ? 'bg-blue-100 text-blue-600 animate-pulse' 
              : 'bg-gray-200 text-gray-500'
            }
          `}>
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div className={`transition-colors duration-200 ${isDragActive ? 'text-blue-700' : 'text-gray-600'}`}>
            <p className="font-bold text-lg mb-2">
              {isDragActive ? '📁 Drop the files here!' : '📤 Click to upload or drag and drop'}
            </p>
            <p className="text-sm opacity-75">
              All file types accepted • Max {maxFiles} files • Up to 100MB each
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 error-message">
          <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {files.length > 0 && (
        <div className="mt-6 animate-slideInFromBottom">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800 flex items-center">
              <span className="text-lg mr-2">📋</span>
              Selected Files ({files.length}/{maxFiles})
            </h4>
            <button
              onClick={() => {
                setFiles([]);
                onFilesSelected([]);
                setError('');
              }}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors duration-200 font-medium"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 animate-slideInFromTop"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => removeFile(file.name)} 
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 flex-shrink-0 ml-3"
                    title="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileInput;