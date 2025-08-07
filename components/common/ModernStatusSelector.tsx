import React, { useState, useRef, useEffect } from 'react';
import { ProjectStatus } from '../../types';
import { getStatusColors, getStatusDisplayName } from '../../utils/statusColors';

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
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleStatusSelect = (status: ProjectStatus) => {
    setSelectedStatus(status);
  };

  const handleDone = () => {
    onStatusChange(selectedStatus);
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
    <>
      {/* Trigger Button */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Update Status:</label>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-900">{currentOption?.label || currentStatus}</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Modal Popup */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Update Status</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Select the new status for this project
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Status Options */}
            <div className="max-h-96 overflow-y-auto">
              {options.map((option, index) => {
                const isSelected = option.value === selectedStatus;
                const isLast = index === options.length - 1;
                const colors = getStatusColors(option.value);
                
                return (
                  <div
                    key={option.value}
                    className={`
                      px-6 py-4 cursor-pointer transition-all duration-200
                      ${!isLast ? 'border-b border-gray-100' : ''}
                      ${isSelected 
                        ? `${colors.background} ${colors.border} border-l-4` 
                        : 'hover:bg-gray-50'
                      }
                    `}
                    onClick={() => handleStatusSelect(option.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          {/* Status Color Indicator */}
                          <div className={`w-3 h-3 rounded-full ${colors.badge.split(' ')[0]}`}></div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? colors.text : 'text-gray-900'}`}>
                              {getStatusDisplayName(option.value)}
                            </p>
                            {(option.description || colors.description) && (
                              <p className={`text-xs mt-1 ${isSelected ? colors.text : 'text-gray-600'}`}>
                                {option.description || colors.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${colors.badge.split(' ')[0]}`}>
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
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleDone}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModernStatusSelector;