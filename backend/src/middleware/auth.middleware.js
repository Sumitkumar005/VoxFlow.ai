import { verifyToken, extractToken } from '../utils/jwt.js';

/**
 * Middleware to authenticate requests using JWT with enhanced user data
 */
export const authenticate = (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const decoded = verifyToken(token);
    
    // Attach enhanced user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      subscription_tier: decoded.subscription_tier || 'free',
      max_agents: decoded.max_agents || 2,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Used for routes that work both authenticated and unauthenticated
 */
export const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
        subscription_tier: decoded.subscription_tier || 'free',
        max_agents: decoded.max_agents || 2,
      };
    }

    next();
  } catch (error) {
    // Token was provided but invalid - continue without user
    next();
  }
};