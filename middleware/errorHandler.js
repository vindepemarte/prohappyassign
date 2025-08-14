/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses across all API endpoints
 */

// Error response structure
const createErrorResponse = (error, req) => {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;
  
  // Default error response
  let response = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp,
    path
  };

  // Handle different error types
  if (error.name === 'ValidationError') {
    response = {
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: error.details,
      timestamp,
      path
    };
  } else if (error.code === '23505') { // PostgreSQL unique violation
    response = {
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      timestamp,
      path
    };
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    response = {
      error: 'Referenced resource not found',
      code: 'INVALID_REFERENCE',
      timestamp,
      path
    };
  } else if (error.code === '42P01') { // PostgreSQL table does not exist
    response = {
      error: 'Database resource not found',
      code: 'DATABASE_ERROR',
      timestamp,
      path
    };
  } else if (error.code === '42883') { // PostgreSQL function does not exist
    response = {
      error: 'Database function not available',
      code: 'DATABASE_FUNCTION_ERROR',
      timestamp,
      path
    };
  } else if (error.message) {
    response.error = error.message;
  }

  return response;
};

// Main error handling middleware
export const errorHandler = (error, req, res, next) => {
  console.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const errorResponse = createErrorResponse(error, req);
  
  // Determine HTTP status code
  let statusCode = 500;
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
    statusCode = 404;
  } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
    statusCode = 403;
  } else if (error.message?.includes('token') || error.message?.includes('authentication')) {
    statusCode = 401;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error creator
export const createValidationError = (message, details = null) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.details = details;
  return error;
};

// Permission error creator
export const createPermissionError = (message = 'Insufficient permissions') => {
  const error = new Error(message);
  error.name = 'PermissionError';
  return error;
};

// Not found error creator
export const createNotFoundError = (resource = 'Resource') => {
  const error = new Error(`${resource} not found`);
  error.name = 'NotFoundError';
  return error;
};

export default {
  errorHandler,
  asyncHandler,
  createValidationError,
  createPermissionError,
  createNotFoundError
};