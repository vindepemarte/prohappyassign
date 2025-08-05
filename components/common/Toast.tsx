import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
  action
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close timer
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const typeConfig = {
    success: {
      icon: '✅',
      bgColor: 'bg-gradient-to-r from-green-500 to-emerald-500',
      borderColor: 'border-green-400',
      textColor: 'text-white'
    },
    error: {
      icon: '❌',
      bgColor: 'bg-gradient-to-r from-red-500 to-pink-500',
      borderColor: 'border-red-400',
      textColor: 'text-white'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      borderColor: 'border-yellow-400',
      textColor: 'text-white'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      borderColor: 'border-blue-400',
      textColor: 'text-white'
    }
  };

  const config = typeConfig[type];

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
        ${config.bgColor} ${config.textColor}
        rounded-xl shadow-2xl border-l-4 ${config.borderColor}
        p-4 mb-3 max-w-md w-full
        hover:shadow-3xl hover:scale-105
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-2xl">
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-lg leading-tight">{title}</h4>
          {message && (
            <p className="mt-1 text-sm opacity-90 leading-relaxed">{message}</p>
          )}
          
          {action && (
            <button
              onClick={action.onClick}
              className="mt-3 px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105"
            >
              {action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-all duration-200 transform hover:scale-110"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Progress bar for auto-close */}
      {duration > 0 && (
        <div className="mt-3 h-1 bg-white bg-opacity-20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white bg-opacity-40 rounded-full transition-all ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${duration}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  position = 'top-right' 
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={`fixed z-50 ${positionClasses[position]} pointer-events-none`}>
      <div className="space-y-3 pointer-events-auto">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="stagger-item"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};

// Add the shrink animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(style);

export default Toast;