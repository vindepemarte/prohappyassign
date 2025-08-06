import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisibilityManager } from '../components/common/VisibilityManager';

interface RobustLoadingOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  preventTabSwitchReload?: boolean;
  minLoadingTime?: number;
}

interface RobustLoadingState {
  isLoading: boolean;
  error: string | null;
  hasTimedOut: boolean;
  retryCount: number;
  isVisible: boolean;
}

interface RobustLoadingActions {
  startLoading: () => void;
  stopLoading: () => void;
  setError: (error: string | null) => void;
  retry: () => void;
  reset: () => void;
}

/**
 * Enhanced loading hook that handles tab switching gracefully
 * and prevents unnecessary loading states when user switches tabs
 */
export const useRobustLoading = (
  options: RobustLoadingOptions = {}
): [RobustLoadingState, RobustLoadingActions] => {
  const {
    timeout = 30000,
    maxRetries = 3,
    retryDelay = 1000,
    preventTabSwitchReload = true,
    minLoadingTime = 300
  } = options;

  const [state, setState] = useState<RobustLoadingState>({
    isLoading: false,
    error: null,
    hasTimedOut: false,
    retryCount: 0,
    isVisible: true
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStartTime = useRef<number | null>(null);
  const wasLoadingBeforeHidden = useRef(false);

  // Use visibility manager to handle tab switching
  const { isVisible } = useVisibilityManager({
    onVisibilityChange: (visible) => {
      setState(prev => ({ ...prev, isVisible: visible }));
      
      if (!visible && state.isLoading) {
        // Store that we were loading before hiding
        wasLoadingBeforeHidden.current = true;
        
        if (preventTabSwitchReload) {
          // Pause loading state when tab is hidden
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      } else if (visible && wasLoadingBeforeHidden.current) {
        // Resume loading state when tab becomes visible again
        wasLoadingBeforeHidden.current = false;
        
        if (preventTabSwitchReload && state.isLoading) {
          // Resume timeout
          const elapsed = loadingStartTime.current ? Date.now() - loadingStartTime.current : 0;
          const remainingTimeout = Math.max(0, timeout - elapsed);
          
          if (remainingTimeout > 0) {
            timeoutRef.current = setTimeout(() => {
              setState(prev => ({
                ...prev,
                isLoading: false,
                hasTimedOut: true,
                error: 'Request timed out. Please try again.'
              }));
            }, remainingTimeout);
          }
        }
      }
    },
    preventReloadOnTabSwitch: preventTabSwitchReload
  });

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const startLoading = useCallback(() => {
    loadingStartTime.current = Date.now();
    wasLoadingBeforeHidden.current = false;
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      hasTimedOut: false
    }));

    // Set timeout only if tab is visible or we don't prevent tab switch reload
    if (isVisible || !preventTabSwitchReload) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasTimedOut: true,
          error: 'Request timed out. Please try again.'
        }));
      }, timeout);
    }
  }, [timeout, isVisible, preventTabSwitchReload]);

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Ensure minimum loading time has passed to prevent flashing
    const handleStop = () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasTimedOut: false
      }));
      wasLoadingBeforeHidden.current = false;
    };

    if (loadingStartTime.current && minLoadingTime > 0) {
      const elapsed = Date.now() - loadingStartTime.current;
      const remaining = Math.max(0, minLoadingTime - elapsed);
      
      if (remaining > 0) {
        setTimeout(handleStop, remaining);
      } else {
        handleStop();
      }
    } else {
      handleStop();
    }
  }, [minLoadingTime]);

  const setError = useCallback((error: string | null) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      error,
      hasTimedOut: false
    }));
    wasLoadingBeforeHidden.current = false;
  }, []);

  const retry = useCallback(() => {
    setState(prev => {
      const newRetryCount = prev.retryCount + 1;

      if (newRetryCount > maxRetries) {
        return {
          ...prev,
          error: `Maximum retry attempts (${maxRetries}) exceeded. Please refresh the page.`,
          isLoading: false
        };
      }

      return {
        ...prev,
        retryCount: newRetryCount,
        error: null,
        hasTimedOut: false,
        isLoading: true
      };
    });

    // Add exponential backoff delay
    const delay = retryDelay * Math.pow(2, state.retryCount);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(() => {
      startLoading();
    }, delay);
  }, [state.retryCount, maxRetries, retryDelay, startLoading]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setState({
      isLoading: false,
      error: null,
      hasTimedOut: false,
      retryCount: 0,
      isVisible: true
    });
    
    loadingStartTime.current = null;
    wasLoadingBeforeHidden.current = false;
  }, []);

  return [
    { ...state, isVisible },
    {
      startLoading,
      stopLoading,
      setError,
      retry,
      reset
    }
  ];
};

export default useRobustLoading;