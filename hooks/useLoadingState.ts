import { useState, useEffect, useCallback, useRef } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  hasTimedOut: boolean;
  retryCount: number;
}

export interface LoadingOptions {
  timeout?: number; // in milliseconds, default 30 seconds
  maxRetries?: number; // default 3
  retryDelay?: number; // in milliseconds, default 1000
}

export interface LoadingActions {
  startLoading: () => void;
  stopLoading: () => void;
  setError: (error: string | null) => void;
  retry: () => void;
  reset: () => void;
}

export const useLoadingState = (
  options: LoadingOptions = {}
): [LoadingState, LoadingActions] => {
  const {
    timeout = 30000, // 30 seconds default
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    hasTimedOut: false,
    retryCount: 0
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      hasTimedOut: false
    }));

    // Set timeout
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
  }, [timeout]);

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      hasTimedOut: false
    }));
  }, []);

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
      // Set timeout for the retry attempt
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
    }, delay);
  }, [state.retryCount, maxRetries, retryDelay, timeout]);

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
      retryCount: 0
    });
  }, []);

  return [
    state,
    {
      startLoading,
      stopLoading,
      setError,
      retry,
      reset
    }
  ];
};

// Helper hook for async operations with automatic loading state management
export const useAsyncOperation = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options: LoadingOptions = {}
) => {
  const [loadingState, actions] = useLoadingState(options);

  const execute = useCallback(async (...args: T): Promise<R | null> => {
    try {
      actions.startLoading();
      const result = await operation(...args);
      actions.stopLoading();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      actions.setError(errorMessage);
      return null;
    }
  }, [operation, actions]);

  const executeWithRetry = useCallback(async (...args: T): Promise<R | null> => {
    try {
      actions.startLoading();
      const result = await operation(...args);
      actions.stopLoading();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      if (loadingState.retryCount < (options.maxRetries || 3)) {
        actions.retry();
        // The retry will be handled by the timeout in the retry function
        return null;
      } else {
        actions.setError(errorMessage);
        return null;
      }
    }
  }, [operation, actions, loadingState.retryCount, options.maxRetries]);

  return {
    ...loadingState,
    execute,
    executeWithRetry,
    retry: actions.retry,
    reset: actions.reset
  };
};