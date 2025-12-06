import { cache } from '../utils/cache.js';

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 */
export const cacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and user ID
    const cacheKey = `${req.user?.id || 'anon'}:${req.originalUrl}`;

    // Check cache
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[CACHE HIT] ${cacheKey}`);
      return res.json(cachedResponse);
    }

    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json function to cache response
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode === 200 && body.success !== false) {
        cache.set(cacheKey, body, ttl);
        console.log(`[CACHE SET] ${cacheKey} (TTL: ${ttl}s)`);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate cache for specific patterns
 */
export const invalidateCache = (userId, pattern = '.*') => {
  const fullPattern = `${userId}:${pattern}`;
  cache.deletePattern(fullPattern);
  console.log(`[CACHE INVALIDATE] ${fullPattern}`);
};

/**
 * Invalidate user's agent cache
 */
export const invalidateAgentCache = (userId) => {
  invalidateCache(userId, '/api/agents.*');
};

/**
 * Invalidate user's usage cache
 */
export const invalidateUsageCache = (userId) => {
  invalidateCache(userId, '/api/usage.*');
};

export default cacheMiddleware;
