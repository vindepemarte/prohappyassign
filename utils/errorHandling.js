/**
 * Comprehensive Error Handling Utilities
 * Provides consistent error handling across the application
 */

// Error types for hierarchy operations
export const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  HIERARCHY_VIOLATION: 'HIERARCHY_VIOLATION',
  REFERENCE_CODE_ERROR: 'REFERENCE_CODE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error codes with user-friendly messages
export const ERROR_MESSAGES = {
  // Authentication errors
  'AUTH_TOKEN_MISSING': 'Please log in to access this feature.',
  'AUTH_TOKEN_INVALID': 'Your session has expired. Please log in again.',
  'AUTH_TOKEN_EXPIRED': 'Your session has expired. Please log in again.',
  'AUTH_INSUFFICIENT_PERMISSIONS': 'You don\'t have permission to perform this action.',
  
  // Hierarchy errors
  'HIERARCHY_INVALID_MOVE': 'This user cannot be moved to the selected position in the hierarchy.',
  'HIERARCHY_CIRCULAR_REFERENCE': 'Cannot create a circular reference in the hierarchy.',
  'HIERARCHY_LEVEL_VIOLATION': 'This action would violate the organizational hierarchy rules.',
  'HIERARCHY_USER_NOT_FOUND': 'The specified user was not found in the hierarchy.',
  'HIERARCHY_PARENT_NOT_FOUND': 'The selected parent user was not found.',
  
  // Reference code errors
  'REFERENCE_CODE_INVALID': 'The reference code you entered is not valid or has expired.',
  'REFERENCE_CODE_ALREADY_USED': 'This reference code has already been used.',
  'REFERENCE_CODE_EXPIRED': 'This reference code has expired.',
  'REFERENCE_CODE_NOT_FOUND': 'Reference code not found.',
  'REFERENCE_CODE_GENERATION_FAILED': 'Failed to generate reference code. Please try again.',
  
  // Project assignment errors
  'ASSIGNMENT_INVALID_USER': 'The selected user cannot be assigned to this project.',
  'ASSIGNMENT_HIERARCHY_VIOLATION': 'This assignment violates hierarchy rules.',
  'ASSIGNMENT_PROJECT_NOT_FOUND': 'The specified project was not found.',
  'ASSIGNMENT_USER_OVERLOADED': 'The selected user has too many active assignments.',
  
  // Financial data errors
  'FINANCIAL_ACCESS_DENIED': 'You don\'t have permission to view this financial information.',
  'FINANCIAL_DATA_NOT_FOUND': 'The requested financial data was not found.',
  'PRICING_INVALID_RANGE': 'Please enter a valid pricing range.',
  'PRICING_CALCULATION_FAILED': 'Failed to calculate pricing. Please check your inputs.',
  
  // Notification errors
  'NOTIFICATION_SEND_FAILED': 'Failed to send notification. Please try again.',
  'NOTIFICATION_INVALID_RECIPIENTS': 'One or more recipients are invalid.',
  'NOTIFICATION_TEMPLATE_NOT_FOUND': 'The selected notification template was not found.',
  
  // General errors
  'VALIDATION_REQUIRED_FIELD': 'This field is required.',
  'VALIDATION_INVALID_EMAIL': 'Please enter a valid email address.',
  'VALIDATION_PASSWORD_TOO_WEAK': 'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
  'VALIDATION_INVALID_FORMAT': 'Please enter data in the correct format.',
  'DATABASE_CONNECTION_ERROR': 'Unable to connect to the database. Please try again later.',
  'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
  'SERVER_ERROR': 'An unexpected error occurred. Please try again later.',
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please contact support if this continues.'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Create a standardized error object
 */
export class AppError extends Error {
  constructor(code, message, type = ERROR_TYPES.UNKNOWN_ERROR, severity = ERROR_SEVERITY.MEDIUM, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      type: this.type,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || error;
  }
  
  if (error?.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Handle API errors consistently
 */
export const handleApiError = (error, context = '') => {
  console.error(`API Error ${context}:`, error);
  
  // Network errors
  if (!error.response) {
    return new AppError(
      'NETWORK_ERROR',
      ERROR_MESSAGES.NETWORK_ERROR,
      ERROR_TYPES.NETWORK_ERROR,
      ERROR_SEVERITY.HIGH
    );
  }
  
  const { status, data } = error.response;
  
  // Authentication errors
  if (status === 401) {
    return new AppError(
      'AUTH_TOKEN_INVALID',
      ERROR_MESSAGES.AUTH_TOKEN_INVALID,
      ERROR_TYPES.AUTHENTICATION_ERROR,
      ERROR_SEVERITY.HIGH
    );
  }
  
  // Permission errors
  if (status === 403) {
    return new AppError(
      'AUTH_INSUFFICIENT_PERMISSIONS',
      ERROR_MESSAGES.AUTH_INSUFFICIENT_PERMISSIONS,
      ERROR_TYPES.PERMISSION_DENIED,
      ERROR_SEVERITY.MEDIUM
    );
  }
  
  // Validation errors
  if (status === 400) {
    const message = data?.error || ERROR_MESSAGES.VALIDATION_INVALID_FORMAT;
    return new AppError(
      'VALIDATION_ERROR',
      message,
      ERROR_TYPES.VALIDATION_ERROR,
      ERROR_SEVERITY.LOW
    );
  }
  
  // Not found errors
  if (status === 404) {
    const message = data?.error || 'The requested resource was not found.';
    return new AppError(
      'RESOURCE_NOT_FOUND',
      message,
      ERROR_TYPES.VALIDATION_ERROR,
      ERROR_SEVERITY.LOW
    );
  }
  
  // Server errors
  if (status >= 500) {
    return new AppError(
      'SERVER_ERROR',
      ERROR_MESSAGES.SERVER_ERROR,
      ERROR_TYPES.DATABASE_ERROR,
      ERROR_SEVERITY.CRITICAL
    );
  }
  
  // Default error
  return new AppError(
    'UNKNOWN_ERROR',
    data?.error || ERROR_MESSAGES.UNKNOWN_ERROR,
    ERROR_TYPES.UNKNOWN_ERROR,
    ERROR_SEVERITY.MEDIUM
  );
};

/**
 * Validate hierarchy operations
 */
export const validateHierarchyOperation = (operation, data) => {
  const errors = [];
  
  switch (operation) {
    case 'move_user':
      if (!data.userId) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'User ID is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      if (!data.newParentId) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'New parent ID is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      if (data.userId === data.newParentId) {
        errors.push(new AppError('HIERARCHY_CIRCULAR_REFERENCE', ERROR_MESSAGES.HIERARCHY_CIRCULAR_REFERENCE, ERROR_TYPES.HIERARCHY_VIOLATION));
      }
      break;
      
    case 'assign_project':
      if (!data.projectId) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'Project ID is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      if (!data.assigneeId) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'Assignee ID is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      if (!data.assignmentType) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'Assignment type is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      break;
      
    case 'validate_reference_code':
      if (!data.code) {
        errors.push(new AppError('VALIDATION_REQUIRED_FIELD', 'Reference code is required', ERROR_TYPES.VALIDATION_ERROR));
      }
      if (data.code && data.code.length < 8) {
        errors.push(new AppError('REFERENCE_CODE_INVALID', ERROR_MESSAGES.REFERENCE_CODE_INVALID, ERROR_TYPES.REFERENCE_CODE_ERROR));
      }
      break;
  }
  
  return errors;
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (errors) => {
  if (!Array.isArray(errors)) {
    return [getUserFriendlyMessage(errors)];
  }
  
  return errors.map(error => getUserFriendlyMessage(error));
};

/**
 * Create error boundary handler
 */
export const createErrorBoundaryHandler = (componentName) => {
  return (error, errorInfo) => {
    console.error(`Error in ${componentName}:`, error, errorInfo);
    
    // Log to error reporting service if available
    if (window.errorReporting) {
      window.errorReporting.captureException(error, {
        component: componentName,
        errorInfo
      });
    }
    
    return new AppError(
      'COMPONENT_ERROR',
      `An error occurred in ${componentName}. Please refresh the page.`,
      ERROR_TYPES.UNKNOWN_ERROR,
      ERROR_SEVERITY.HIGH,
      { componentName, errorInfo }
    );
  };
};

/**
 * Retry mechanism for failed operations
 */
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry certain types of errors
      if (error instanceof AppError) {
        if (error.type === ERROR_TYPES.AUTHENTICATION_ERROR || 
            error.type === ERROR_TYPES.PERMISSION_DENIED ||
            error.type === ERROR_TYPES.VALIDATION_ERROR) {
          throw error;
        }
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
};

export default {
  ERROR_TYPES,
  ERROR_MESSAGES,
  ERROR_SEVERITY,
  AppError,
  getUserFriendlyMessage,
  handleApiError,
  validateHierarchyOperation,
  formatValidationErrors,
  createErrorBoundaryHandler,
  withRetry
};