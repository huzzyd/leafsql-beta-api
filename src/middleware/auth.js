const { verifyUserToken } = require('../config/supabase');

/**
 * Authentication middleware that verifies Supabase JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateRequest(req, res, next) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authorization header provided'
      });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid authorization format',
        message: 'Authorization header must start with "Bearer "'
      });
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        error: 'Token required',
        message: 'No token provided after "Bearer "'
      });
    }

    // Verify the token using Supabase
    const user = await verifyUserToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }

    // Attach user object to request
    req.user = {
      id: user.id,
      email: user.email
    };

    // Call next middleware
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
}

module.exports = {
  authenticateRequest
};
