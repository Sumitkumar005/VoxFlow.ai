/**
 * Rate Limit Controller
 * 
 * Provides endpoints for checking and managing rate limits
 */

import { getRateLimitStatus, resetUserRateLimits } from '../middleware/rateLimiting.middleware.js';

/**
 * Get current rate limit status for authenticated user
 */
export const getUserRateLimitStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const status = await getRateLimitStatus(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting user rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve rate limit status'
    });
  }
};

/**
 * Get rate limit status for specific user (admin only)
 */
export const getAdminUserRateLimitStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'User ID is required'
      });
    }
    
    const status = await getRateLimitStatus(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        ...status
      }
    });
  } catch (error) {
    console.error('Error getting admin user rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve rate limit status'
    });
  }
};

/**
 * Reset rate limits for specific user (admin only)
 */
export const resetAdminUserRateLimits = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'User ID is required'
      });
    }
    
    const result = await resetUserRateLimits(userId);
    
    // Log admin action
    try {
      const { supabase } = await import('../config/database.js');
      await supabase
        .from('admin_audit_logs')
        .insert({
          admin_user_id: req.user.id,
          action: 'reset_user_rate_limits',
          target_user_id: userId,
          details: {
            reset_timestamp: new Date().toISOString(),
            admin_email: req.user.email
          },
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
    } catch (auditError) {
      console.error('Error logging rate limit reset:', auditError);
    }
    
    res.json({
      success: true,
      data: result,
      message: 'Rate limits reset successfully'
    });
  } catch (error) {
    console.error('Error resetting user rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reset rate limits'
    });
  }
};

/**
 * Get platform-wide rate limiting statistics (admin only)
 */
export const getPlatformRateLimitStats = async (req, res, next) => {
  try {
    const { redis } = await import('../middleware/rateLimiting.middleware.js');
    
    // Get all rate limit keys
    const keys = await redis.keys('*:*');
    
    // Group by type and analyze
    const stats = {
      total_keys: keys.length,
      by_type: {},
      active_users: new Set(),
      violations: 0
    };
    
    for (const key of keys) {
      const [type, userId] = key.split(':');
      
      if (!stats.by_type[type]) {
        stats.by_type[type] = 0;
      }
      stats.by_type[type]++;
      
      if (userId && userId !== 'undefined') {
        stats.active_users.add(userId);
      }
      
      if (type === 'violations') {
        const violations = await redis.get(key);
        stats.violations += parseInt(violations) || 0;
      }
    }
    
    stats.active_users = stats.active_users.size;
    
    // Get Redis info
    const redisInfo = await redis.info('memory');
    const memoryUsage = redisInfo.split('\n')
      .find(line => line.startsWith('used_memory_human:'))
      ?.split(':')[1]?.trim();
    
    res.json({
      success: true,
      data: {
        ...stats,
        redis_memory_usage: memoryUsage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting platform rate limit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve platform rate limit statistics'
    });
  }
};

/**
 * Get rate limit configuration for all tiers
 */
export const getRateLimitConfiguration = async (req, res, next) => {
  try {
    // Import rate limit configuration
    const { RATE_LIMITS } = await import('../middleware/rateLimiting.middleware.js');
    
    res.json({
      success: true,
      data: {
        rate_limits: RATE_LIMITS,
        description: 'Rate limit configuration by subscription tier',
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting rate limit configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve rate limit configuration'
    });
  }
};