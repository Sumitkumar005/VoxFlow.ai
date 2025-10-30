/**
 * Rate Limiting Middleware (Simplified for Development)
 * 
 * This is a simplified version for development testing.
 * The full rate limiting implementation can be restored later.
 */

// Simple pass-through middleware for development
const createSimpleMiddleware = () => (req, res, next) => next();

// Export simplified rate limiters
export const apiRateLimiter = createSimpleMiddleware();
export const authRateLimiter = createSimpleMiddleware();
export const agentOperationsRateLimiter = createSimpleMiddleware();
export const campaignOperationsRateLimiter = createSimpleMiddleware();
export const uploadRateLimiter = createSimpleMiddleware();
export const concurrentCallLimiter = createSimpleMiddleware();

// Export simplified utility functions
export const getRateLimitStatus = async (userId) => ({
  success: true,
  data: { status: 'Rate limiting disabled for development' }
});

export const resetUserRateLimits = async (userId) => ({
  success: true,
  message: 'Rate limits reset (development mode)'
});