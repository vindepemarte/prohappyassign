import React, { ReactNode, useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useLoadingState, LoadingOptions } from '../../hooks/useLoadingState';

interface LoadingWrapperProps {
  children: ReactNode;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingText?: string;
  emptyState?: ReactNode;
  isEmpty?: boolean;
  className?: string;
  spinnerSize?: 'sm' | 'md' | 'lg' | 'xl';
  showProgress?: boolean;
  minLoadingTime?: number; // Minimum time to show loading state (prevents flashing)
  fadeTransition?: boolean;
  loadingOptions?: LoadingOptions;
}

const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  children,
  isLoading,
  error,
  onRetry,
  loadingText = 'Loading...',
  emptyState,
  isEmpty = false,
  className = '',
  spinnerSize = 'md',
  showProgress = false,
  minLoadingTime = 300, // 300ms minimum
  fadeTransition = true,
  loadingOptions = {}
}) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const [contentVisible, setContentVisible] = useState(!isLoading);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  // Handle smooth transitions
  useEffect(() => {
    if (isLoading) {
      setLoadingStartTime(Date.now());
      setContentVisible(false);
      
      // Small delay to prevent flashing for very quick loads
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      // Ensure minimum loading time has passed
      const handleLoadingEnd = () => {
        setShowLoading(false);
        
        if (fadeTransition) {
          // Fade in content
          setTimeout(() => {
            setContentVisible(true);
          }, 150);
        } else {
          setContentVisible(true);
        }
      };

      if (loadingStartTime && minLoadingTime > 0) {
        const elapsed = Date.now() - loadingStartTime;
        const remaining = Math.max(0, minLoadingTime - elapsed);
        
        setTimeout(handleLoadingEnd, remaining);
      } else {
        handleLoadingEnd();
      }
    }
  }, [isLoading, loadingStartTime, minLoadingTime, fadeTransition]);

  const containerClasses = `
    relative transition-all duration-300 ease-in-out
    ${className}
    ${fadeTransition ? (contentVisible ? 'opacity-100' : 'opacity-0') : ''}
  `;

  // Show loading state
  if (showLoading) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner
            size={spinnerSize}
            text={loadingText}
            showProgress={showProgress}
            timeout={loadingOptions.timeout}
            error={error}
            onRetry={onRetry}
          />
        </div>
      </div>
    );
  }

  // Show error state (if not handled by spinner)
  if (error && !onRetry) {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-gray-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (isEmpty && emptyState) {
    return (
      <div className={containerClasses}>
        {emptyState}
      </div>
    );
  }

  // Show content
  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
};

export default LoadingWrapper;

// Higher-order component for wrapping components with loading states
export const withLoadingState = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  defaultLoadingProps: Partial<LoadingWrapperProps> = {}
) => {
  return React.forwardRef<any, P & LoadingWrapperProps>((props, ref) => {
    const { children, ...loadingProps } = props;
    const mergedProps = { ...defaultLoadingProps, ...loadingProps };

    return (
      <LoadingWrapper {...mergedProps}>
        <WrappedComponent {...(props as P)} ref={ref} />
      </LoadingWrapper>
    );
  });
};