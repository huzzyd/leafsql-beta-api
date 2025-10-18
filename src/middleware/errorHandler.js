/**
 * Global Error Handler Middleware
 * Handles all unhandled errors in the application
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Handle non-Error objects
  if (!err || typeof err !== 'object') {
    err = new Error(String(err || 'Unknown error'));
  }

  // Ensure err has message property
  if (!err.message) {
    err.message = 'Unknown error occurred';
  }

  // Log the full error object for debugging
  console.error('🚨 Global Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Determine appropriate status code based on error message
  let statusCode = 500;
  let errorMessage = err.message;

  // Check for specific error patterns
  if (err.message.toLowerCase().includes('not found')) {
    statusCode = 404;
  } else if (
    err.message.toLowerCase().includes('validation') ||
    err.message.toLowerCase().includes('invalid') ||
    err.message.toLowerCase().includes('required') ||
    err.message.toLowerCase().includes('missing')
  ) {
    statusCode = 400;
  } else if (
    err.message.toLowerCase().includes('unauthorized') ||
    err.message.toLowerCase().includes('authentication')
  ) {
    statusCode = 401;
  } else if (
    err.message.toLowerCase().includes('forbidden') ||
    err.message.toLowerCase().includes('permission')
  ) {
    statusCode = 403;
  } else if (
    err.message.toLowerCase().includes('timeout') ||
    err.message.toLowerCase().includes('too many requests')
  ) {
    statusCode = 429;
  } else if (
    err.message.toLowerCase().includes('connection failed') ||
    err.message.toLowerCase().includes('database') ||
    err.message.toLowerCase().includes('server error')
  ) {
    statusCode = 500;
  }

  // Sanitize error message in production
  if (!isDevelopment) {
    errorMessage = sanitizeErrorMessage(errorMessage, statusCode);
  }

  // Prepare response object
  const response = {
    error: errorMessage,
    status: statusCode,
    timestamp: new Date().toISOString()
  };

  // Add stack trace in development mode only
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  // Add request ID if available (for tracing)
  if (req.id) {
    response.requestId = req.id;
  }

  // Send response
  res.status(statusCode).json(response);
}

/**
 * Sanitize error messages in production to avoid exposing sensitive information
 * @param {string} message - Original error message
 * @param {number} statusCode - HTTP status code
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(message, statusCode) {
  // Generic messages for different status codes
  const genericMessages = {
    400: 'Bad Request - Invalid input provided',
    401: 'Unauthorized - Authentication required',
    403: 'Forbidden - Access denied',
    404: 'Not Found - Resource does not exist',
    429: 'Too Many Requests - Rate limit exceeded',
    500: 'Internal Server Error - Something went wrong'
  };

  // Check for sensitive information patterns
  const sensitivePatterns = [
    /connection.*string/i,
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /credential/i,
    /auth/i,
    /database.*url/i,
    /postgresql:\/\/.*/i,
    /mysql:\/\/.*/i,
    /mongodb:\/\/.*/i,
    /sqlite:\/\/.*/i,
    /dangerous.*sql/i,
    /sql.*injection/i,
    /blocked.*query/i,
    /exceeds.*maximum.*rows/i
  ];

  // If message contains sensitive information, use generic message
  const containsSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(message));
  
  if (containsSensitiveInfo) {
    return genericMessages[statusCode] || genericMessages[500];
  }

  // For non-sensitive errors, return a cleaned version
  return message
    .replace(/at.*\(.*\)/g, '') // Remove stack trace info
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Handle specific error types with custom logic
 * @param {Error} err - The error object
 * @returns {Object} Custom error response
 */
function handleSpecificErrors(err) {
  // Handle validation errors (e.g., from Joi, express-validator)
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      message: 'Validation failed',
      details: err.details || err.errors
    };
  }

  // Handle database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return {
      statusCode: 503,
      message: 'Service temporarily unavailable'
    };
  }

  // Handle timeout errors
  if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
    return {
      statusCode: 408,
      message: 'Request timeout'
    };
  }

  // Handle rate limiting errors
  if (err.status === 429) {
    return {
      statusCode: 429,
      message: 'Too many requests'
    };
  }

  return null;
}

module.exports = {
  errorHandler,
  sanitizeErrorMessage,
  handleSpecificErrors
};
