import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ErrorState {
  message: string;
  code?: string;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface UseHierarchyErrorHandlingReturn {
  error: ErrorState | null;
  isLoading: boolean;
  clearError: () => void;
  handleError: (error: any, context?: string) => void;
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    options?: {
      loadingMessage?: string;
      successMessage?: string;
      context?: string;
      showToast?: boolean;
    }
  ) => Promise<T | null>;
}

export const useHierarchyErrorHandling = (): UseHierarchyErrorHandlingReturn => {
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getUserFriendlyMessage = (error: any): string => {
    // API error responses
    if (error?.response?.data?.error) {
      return error.response.data.error;
    }

    // Network errors
    if (error?.code === 'NETWORK_ERROR' || !error?.response) {
      return 'Network error. Please check your connection and try again.';
    }

    // Authentication errors
    if (error?.response?.status === 401) {
      return 'Your session has expired. Please log in again.';
    }

    // Permission errors
    if (error?.response?.status === 403) {
      return 'You don\'t have permission to perform this action.';
    }

    // Validation errors
    if (error?.response?.status === 400) {
      return error?.response?.data?.error || 'Invalid request. Please check your input.';
    }

    // Not found errors
    if (error?.response?.status === 404) {
      return 'The requested resource was not found.';
    }

    // Server errors
    if (error?.response?.status >= 500) {
      return 'Server error. Please try again later or contact support.';
    }

    // Hierarchy-specific errors
    if (error?.code) {
      const hierarchyErrors: Record<string, string> = {
        'HIERARCHY_CIRCULAR_REFERENCE': 'Cannot create a circular reference in the hierarchy.',
        'HIERARCHY_LEVEL_VIOLATION': 'This action would violate organizational hierarchy rules.',
        'HIERARCHY_USER_NOT_FOUND': 'The specified user was not found in the hierarchy.',
        'REFERENCE_CODE_INVALID': 'The reference code is not valid or has expired.',
        'REFERENCE_CODE_EXPIRED': 'This reference code has expired.',
        'ASSIGNMENT_HIERARCHY_VIOLATION': 'This assignment violates hierarchy rules.',
        'FINANCIAL_ACCESS_DENIED': 'You don\'t have permission to view this financial information.',
        'PRICING_CALCULATION_FAILED': 'Failed to calculate pricing. Please check your inputs.',
        'NOTIFICATION_SEND_FAILED': 'Failed to send notification. Please try again.',
        'DATABASE_CONNECTION_ERROR': 'Database connection error. Please try again later.',
        'VALIDATION_ERROR': 'Please check your input and try again.'
      };

      if (hierarchyErrors[error.code]) {
        return hierarchyErrors[error.code];
      }
    }

    // Generic error message
    if (error?.message) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  };

  const getErrorSeverity = (error: any): ErrorState['severity'] => {
    // Critical errors
    if (error?.response?.status >= 500 || error?.code === 'DATABASE_CONNECTION_ERROR') {
      return 'critical';
    }

    // High severity errors
    if (error?.response?.status === 401 || error?.code === 'NETWORK_ERROR') {
      return 'high';
    }

    // Medium severity errors
    if (error?.response?.status === 403 || error?.code?.includes('HIERARCHY_')) {
      return 'medium';
    }

    // Low severity errors (validation, etc.)
    return 'low';
  };

  const handleError = useCallback((error: any, context?: string) => {
    console.error(`Hierarchy operation error${context ? ` (${context})` : ''}:`, error);

    const errorState: ErrorState = {
      message: getUserFriendlyMessage(error),
      code: error?.code || error?.response?.data?.code,
      details: error?.response?.data?.details || error?.details,
      severity: getErrorSeverity(error)
    };

    setError(errorState);

    // Show toast notification for high/critical errors
    if (errorState.severity === 'high' || errorState.severity === 'critical') {
      toast.error(errorState.message, {
        duration: errorState.severity === 'critical' ? 10000 : 5000,
        action: errorState.severity === 'critical' ? {
          label: 'Contact Support',
          onClick: () => {
            // Could open support modal or redirect to support page
            console.log('Contact support clicked');
          }
        } : undefined
      });
    }

    // Log to error reporting service if available
    if (window.errorReporting && errorState.severity !== 'low') {
      window.errorReporting.captureException(error, {
        context: context || 'hierarchy_operation',
        severity: errorState.severity,
        user_action: true
      });
    }
  }, []);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string;
      successMessage?: string;
      context?: string;
      showToast?: boolean;
    } = {}
  ): Promise<T | null> => {
    const {
      loadingMessage = 'Processing...',
      successMessage,
      context = 'operation',
      showToast = true
    } = options;

    setIsLoading(true);
    clearError();

    try {
      const result = await operation();
      
      if (successMessage && showToast) {
        toast.success(successMessage);
      }
      
      return result;
    } catch (error) {
      handleError(error, context);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, clearError]);

  return {
    error,
    isLoading,
    clearError,
    handleError,
    executeWithErrorHandling
  };
};

// Specific hooks for different hierarchy operations
export const useHierarchyMoveErrorHandling = () => {
  const base = useHierarchyErrorHandling();
  
  const moveUser = useCallback(async (
    userId: string,
    newParentId: string,
    reason: string
  ) => {
    return base.executeWithErrorHandling(
      async () => {
        const response = await fetch('/api/hierarchy-operations/move-user', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ userId, newParentId, reason })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw {
            response: {
              status: response.status,
              data: errorData
            }
          };
        }

        return response.json();
      },
      {
        context: 'hierarchy_move',
        successMessage: 'User moved successfully in hierarchy',
        loadingMessage: 'Moving user in hierarchy...'
      }
    );
  }, [base]);

  return {
    ...base,
    moveUser
  };
};

export const useReferenceCodeErrorHandling = () => {
  const base = useHierarchyErrorHandling();
  
  const validateCode = useCallback(async (code: string) => {
    return base.executeWithErrorHandling(
      async () => {
        const response = await fetch('/api/reference-codes/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (!response.ok) {
          throw {
            response: {
              status: response.status,
              data
            }
          };
        }

        return data;
      },
      {
        context: 'reference_code_validation',
        showToast: false // Don't show toast for validation, let component handle it
      }
    );
  }, [base]);

  const generateCode = useCallback(async (codeType: string, customPrefix?: string) => {
    return base.executeWithErrorHandling(
      async () => {
        const response = await fetch('/api/reference-codes/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ codeType, customPrefix })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw {
            response: {
              status: response.status,
              data: errorData
            }
          };
        }

        return response.json();
      },
      {
        context: 'reference_code_generation',
        successMessage: 'Reference code generated successfully',
        loadingMessage: 'Generating reference code...'
      }
    );
  }, [base]);

  return {
    ...base,
    validateCode,
    generateCode
  };
};

export const useProjectAssignmentErrorHandling = () => {
  const base = useHierarchyErrorHandling();
  
  const assignProject = useCallback(async (
    projectId: number,
    assigneeId: string,
    assignmentType: string,
    assignmentReason?: string
  ) => {
    return base.executeWithErrorHandling(
      async () => {
        const response = await fetch('/api/project-assignment/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            projectId,
            assigneeId,
            assignmentType,
            assignmentReason
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw {
            response: {
              status: response.status,
              data: errorData
            }
          };
        }

        return response.json();
      },
      {
        context: 'project_assignment',
        successMessage: 'Project assigned successfully',
        loadingMessage: 'Assigning project...'
      }
    );
  }, [base]);

  return {
    ...base,
    assignProject
  };
};

// Global error boundary hook
export const useGlobalErrorHandler = () => {
  const handleGlobalError = useCallback((error: Error, errorInfo?: any) => {
    console.error('Global error caught:', error, errorInfo);
    
    // Log to error reporting service
    if (window.errorReporting) {
      window.errorReporting.captureException(error, {
        context: 'global_error_boundary',
        errorInfo,
        severity: 'critical'
      });
    }
    
    // Show critical error toast
    toast.error('A critical error occurred. Please refresh the page.', {
      duration: 10000,
      action: {
        label: 'Refresh Page',
        onClick: () => window.location.reload()
      }
    });
  }, []);

  return { handleGlobalError };
};

export default useHierarchyErrorHandling;