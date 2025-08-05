import React, { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'white';
  text?: string;
  className?: string;
  fullScreen?: boolean;
  timeout?: number; // in milliseconds
  onTimeout?: () => void;
  showProgress?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  text,
  className = '',
  fullScreen = false,
  timeout = 30000, // 30 seconds default
  onTimeout,
  showProgress = false,
  error,
  onRetry
}) => {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const variantClasses = {
    primary: 'border-blue-500 border-t-transparent',
    secondary: 'border-gray-500 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // Handle timeout
  useEffect(() => {
    if (!timeout || hasTimedOut || error) return;

    const timeoutId = setTimeout(() => {
      setHasTimedOut(true);
      onTimeout?.();
    }, timeout);

    // Progress animation if enabled
    let progressInterval: NodeJS.Timeout | null = null;
    if (showProgress) {
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const increment = 100 / (timeout / 100); // Update every 100ms
          return Math.min(prev + increment, 95); // Cap at 95% until completion
        });
      }, 100);
    }

    return () => {
      clearTimeout(timeoutId);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [timeout, onTimeout, hasTimedOut, error, showProgress]);

  // Reset states when error is cleared
  useEffect(() => {
    if (!error) {
      setHasTimedOut(false);
      setProgress(0);
    }
  }, [error]);

  // Show error state
  if (error || hasTimedOut) {
    const errorMessage = error || 'Request timed out. Please try again.';
    
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <div className="text-center">
          <div className={`
            ${sizeClasses[size]} mx-auto mb-4 flex items-center justify-center
            rounded-full bg-red-100 text-red-600
          `}>
            <svg className="w-1/2 h-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <p className={`
            font-medium text-red-600 mb-2
            ${textSizeClasses[size]}
          `}>
            {hasTimedOut ? 'Loading Timeout' : 'Error'}
          </p>
          
          <p className={`
            text-red-500 mb-4
            ${size === 'sm' ? 'text-xs' : size === 'lg' || size === 'xl' ? 'text-base' : 'text-sm'}
          `}>
            {errorMessage}
          </p>
          
          {onRetry && (
            <button
              onClick={onRetry}
              className={`
                px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                transition-colors duration-200 font-medium
                ${size === 'sm' ? 'text-xs px-3 py-1' : size === 'lg' || size === 'xl' ? 'text-base px-6 py-3' : 'text-sm'}
              `}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        {/* Outer ring */}
        <div className={`
          ${sizeClasses[size]} border-4 rounded-full loading-spinner
          ${variantClasses[variant]} opacity-75
        `}></div>
        
        {/* Inner pulse */}
        <div className={`
          absolute inset-0 ${sizeClasses[size]} border-2 rounded-full
          ${variant === 'primary' ? 'border-blue-200' : variant === 'secondary' ? 'border-gray-200' : 'border-white border-opacity-30'}
          loading-pulse
        `}></div>

        {/* Progress ring if enabled */}
        {showProgress && (
          <div className={`
            absolute inset-0 ${sizeClasses[size]}
          `}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className={variant === 'primary' ? 'text-blue-200' : variant === 'secondary' ? 'text-gray-200' : 'text-white text-opacity-30'}
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                className={variant === 'primary' ? 'text-blue-500' : variant === 'secondary' ? 'text-gray-500' : 'text-white'}
                style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
              />
            </svg>
          </div>
        )}
      </div>
      
      {text && (
        <p className={`
          mt-4 font-medium animate-pulse
          ${textSizeClasses[size]}
          ${variant === 'white' ? 'text-white' : 'text-gray-600'}
        `}>
          {text}
        </p>
      )}

      {showProgress && (
        <div className={`
          mt-2 text-xs
          ${variant === 'white' ? 'text-white text-opacity-75' : 'text-gray-500'}
        `}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;