import React, { useState, useRef, useEffect } from 'react';
import { ProjectStatus } from '../../types';

interface StatusOption {
  value: ProjectStatus;
  label: string;
  description?: string;
}

interface ModernStatusSelectorProps {
  currentStatus: ProjectStatus;
  onStatusChange: (status: ProjectStatus) => void;
  options: StatusOption[];
  disabled?: boolean;
}

const ModernStatusSelector: React.FC<ModernStatusSelectorProps> = ({
  currentStatus,
  onStatusChange,
  options,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = (status: ProjectStatus) => {
    setSelectedStatus(status);
    onStatusChange(status);
    setIsOpen(false);
  };

  const currentOption = options.find(opt => opt.value === currentStatus);

  if (disabled) {
    return (
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Current Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {currentOption?.label || currentStatus}
            </p>
          </div>
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={selectorRef}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">Update Status</h3>
        <p className="text-sm text-gray-600 mt-1">
          Select the new status for this project
        </p>
      </div>

      {/* Status Options */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {options.map((option, index) => {
          const isSelected = option.value === currentStatus;
          const isLast = index === options.length - 1;
          
          return (
            <div
              key={option.value}
              className={`
                px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50
                ${!isLast ? 'border-b border-gray-100' : ''}
                ${isSelected ? 'bg-blue-50' : ''}
              `}
              onClick={() => handleStatusSelect(option.value)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {option.label}
                  </p>
                  {option.description && (
                    <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                      {option.description}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="ml-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="mt-6">
        <button
          onClick={() => setIsOpen(false)}
          className="w-full bg-gray-900 text-white py-4 px-6 rounded-2xl font-semibold text-sm hover:bg-gray-800 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default ModernStatusSelector;