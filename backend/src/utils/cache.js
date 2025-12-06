/**
 * Simple in-memory cache for API responses
 * For production, use Redis
 */

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
  }

  /**
   * Set cache with TTL (time to live in seconds)
   */
  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + (ttlSeconds * 1000));
  }

  /**
   * Get cached value
   */
  get(key) {
    const expiry = this.ttl.get(key);
    
    // Check if expired
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  /**
   * Delete cache entries matching pattern
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of cache.ttl.entries()) {
    if (now > expiry) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default cache;
