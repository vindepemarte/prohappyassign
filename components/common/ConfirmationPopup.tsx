import React, { useState } from 'react';
import EnhancedModal from './EnhancedModal';
import Button from '../Button';

interface ConfirmationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  details?: string;
}

const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  isLoading = false,
  details
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const variantStyles = {
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      headerBg: 'bg-gradient-to-r from-red-50 to-red-100',
      borderColor: 'border-red-200'
    },
    warning: {
      icon: '⚠️',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      headerBg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
      borderColor: 'border-yellow-200'
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      headerBg: 'bg-gradient-to-r from-blue-50 to-blue-100',
      borderColor: 'border-blue-200'
    }
  };

  const style = variantStyles[variant];

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!isConfirming && !isLoading}
      closeOnEscape={!isConfirming && !isLoading}
      showCloseButton={false}
      className="confirmation-popup"
    >
      <div className={`${style.headerBg} ${style.borderColor} border-2 rounded-xl p-6 mb-6`}>
        <div className="flex items-start space-x-4">
          <div className={`${style.iconBg} ${style.iconColor} p-3 rounded-full flex-shrink-0`}>
            <span className="text-2xl">{style.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-gray-700 leading-relaxed">{message}</p>
            {details && (
              <div className="mt-4 p-3 bg-white bg-opacity-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 font-medium">Details:</p>
                <p className="text-sm text-gray-700 mt-1">{details}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button
          onClick={onClose}
          variant="ghost"
          disabled={isConfirming || isLoading}
          className="flex-1"
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          variant={variant === 'danger' ? 'danger' : 'primary'}
          disabled={isConfirming || isLoading}
          className="flex-1 btn-enhanced"
        >
          {isConfirming || isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Processing...</span>
            </div>
          ) : (
            confirmText
          )}
        </Button>
      </div>
    </EnhancedModal>
  );
};

export default ConfirmationPopup;