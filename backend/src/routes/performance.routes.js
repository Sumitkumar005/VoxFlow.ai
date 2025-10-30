import express from 'express';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { 
  validatePagination,
  securityAuditLog
} from '../middleware/security.middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply admin requirement to all routes
router.use(requireAdmin);

/**
 * @route   GET /api/performance/metrics
 * @desc    Get comprehensive database performance metrics
 * @access  Admin only
 */
router.get('/metrics', securityAuditLog, async (req, res, next) => {
  try {
    const metrics = await PerformanceMonitoringService.getDatabaseMetrics();
    
    res.json({
      success: true,
      data: metrics.data,
      timestamp: metrics.timestamp
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/performance/realtime
 * @desc    Get real-time performance metrics
 * @access  Admin only
 */
router.get('/realtime', securityAuditLog, async (req, res, next) => {
  try {
    const metrics = await PerformanceMonitoringService.getRealTimeMetrics();
    
    res.json({
      success: true,
      data: metrics.data,
      timestamp: metrics.timestamp
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/performance/recommendations
 * @desc    Get performance optimization recommendations
 * @access  Admin only
 */
router.get('/recommendations', securityAuditLog, async (req, res, next) => {
  try {
    const recommendations = await PerformanceMonitoringService.getPerformanceRecommendations();
    
    res.json({
      success: true,
      data: recommendations.recommendations,
      count: recommendations.recommendations.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/performance/health
 * @desc    Get overall database health status
 * @access  Admin only
 */
router.get('/health', securityAuditLog, async (req, res, next) => {
  try {
    const metrics = await PerformanceMonitoringService.getDatabaseMetrics();
    const realtimeMetrics = await PerformanceMonitoringService.getRealTimeMetrics();
    
    // Calculate health score based on various metrics
    let healthScore = 100;
    const issues = [];
    
    // Check cache hit ratio
    const cacheHitRatio = metrics.data.cache_hit_ratio.cache_hit_ratio;
    if (cacheHitRatio < 90) {
      healthScore -= 20;
      issues.push({
        type: 'cache_performance',
        severity: 'high',
        message: `Low cache hit ratio: ${cacheHitRatio}%`
      });
    } else if (cacheHitRatio < 95) {
      healthScore -= 10;
      issues.push({
        type: 'cache_performance',
        severity: 'medium',
        message: `Cache hit ratio could be improved: ${cacheHitRatio}%`
      });
    }
    
    // Check for lock waits
    const lockWaits = realtimeMetrics.data.lock_waits.length;
    if (lockWaits > 0) {
      healthScore -= lockWaits * 5;
      issues.push({
        type: 'lock_contention',
        severity: lockWaits > 5 ? 'high' : 'medium',
        message: `${lockWaits} lock waits detected`
      });
    }
    
    // Check connection count
    const connectionStats = metrics.data.connection_stats;
    if (connectionStats.active_connections > 50) {
      healthScore -= 10;
      issues.push({
        type: 'connection_usage',
        severity: 'medium',
        message: `High connection count: ${connectionStats.active_connections}`
      });
    }
    
    // Determine overall health status
    let healthStatus;
    if (healthScore >= 90) {
      healthStatus = 'excellent';
    } else if (healthScore >= 75) {
      healthStatus = 'good';
    } else if (healthScore >= 60) {
      healthStatus = 'fair';
    } else {
      healthStatus = 'poor';
    }
    
    res.json({
      success: true,
      data: {
        health_score: Math.max(0, healthScore),
        health_status: healthStatus,
        issues,
        metrics_summary: {
          cache_hit_ratio: cacheHitRatio,
          active_connections: connectionStats.active_connections,
          lock_waits: lockWaits,
          database_size: realtimeMetrics.data.database_size.database_size
        },
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;