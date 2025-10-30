import express from 'express';
import { LoggingService } from '../services/logging.service.js';
import { ErrorTrackingService } from '../services/error-tracking.service.js';
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
 * @route   GET /api/monitoring/health
 * @desc    Get system health status
 * @access  Admin only
 */
router.get('/health', async (req, res, next) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: {
        usage: process.cpuUsage()
      },
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0'
    };
    
    // Calculate memory usage percentage
    health.memory.usage_percent = Math.round((health.memory.used / health.memory.total) * 100);
    
    // Determine health status based on metrics
    if (health.memory.usage_percent > 90) {
      health.status = 'critical';
    } else if (health.memory.usage_percent > 75) {
      health.status = 'warning';
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/logs/statistics
 * @desc    Get log statistics
 * @access  Admin only
 */
router.get('/logs/statistics', securityAuditLog, async (req, res, next) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const statistics = await LoggingService.getLogStatistics(timeframe);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/logs/search
 * @desc    Search logs by criteria
 * @access  Admin only
 */
router.get('/logs/search', validatePagination, securityAuditLog, async (req, res, next) => {
  try {
    const {
      query,
      level,
      type,
      user_id,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;
    
    const criteria = {
      query,
      level,
      type,
      user_id,
      start_date,
      end_date,
      offset: (page - 1) * limit,
      limit: parseInt(limit)
    };
    
    const results = await LoggingService.searchLogs(criteria);
    
    res.json({
      success: true,
      data: {
        logs: results.logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: results.total,
          pages: Math.ceil(results.total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/logs/export
 * @desc    Export logs as CSV
 * @access  Admin only
 */
router.get('/logs/export', securityAuditLog, async (req, res, next) => {
  try {
    const {
      start_date,
      end_date,
      format = 'json'
    } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date and end_date are required for export'
      });
    }
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    const exportData = await LoggingService.exportLogs(startDate, endDate, format);
    
    const filename = `voxflow-logs-${start_date}-${end_date}.${format}`;
    
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
    res.send(exportData);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/errors/statistics
 * @desc    Get error statistics
 * @access  Admin only
 */
router.get('/errors/statistics', securityAuditLog, async (req, res, next) => {
  try {
    const {
      timeframe = '24h',
      severity,
      environment
    } = req.query;
    
    const statistics = await ErrorTrackingService.getErrorStatistics({
      timeframe,
      severity,
      environment
    });
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/errors/trends
 * @desc    Get error trends over time
 * @access  Admin only
 */
router.get('/errors/trends', securityAuditLog, async (req, res, next) => {
  try {
    const {
      timeframe = '7d',
      groupBy = 'day',
      environment
    } = req.query;
    
    const trends = await ErrorTrackingService.getErrorTrends({
      timeframe,
      groupBy,
      environment
    });
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/errors/search
 * @desc    Search errors by criteria
 * @access  Admin only
 */
router.get('/errors/search', validatePagination, securityAuditLog, async (req, res, next) => {
  try {
    const {
      query,
      severity,
      environment,
      resolved,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;
    
    const criteria = {
      query,
      severity,
      environment,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: (page - 1) * parseInt(limit)
    };
    
    const results = await ErrorTrackingService.searchErrors(criteria);
    
    res.json({
      success: true,
      data: {
        errors: results.errors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: results.total,
          pages: Math.ceil(results.total / limit),
          has_more: results.has_more
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/errors/:errorId
 * @desc    Get error details by ID
 * @access  Admin only
 */
router.get('/errors/:errorId', securityAuditLog, async (req, res, next) => {
  try {
    const { errorId } = req.params;
    
    const errorDetails = await ErrorTrackingService.getErrorDetails(errorId);
    
    if (!errorDetails) {
      return res.status(404).json({
        success: false,
        message: 'Error not found'
      });
    }
    
    res.json({
      success: true,
      data: errorDetails
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/monitoring/errors/:errorId/resolve
 * @desc    Mark error as resolved
 * @access  Admin only
 */
router.put('/errors/:errorId/resolve', securityAuditLog, async (req, res, next) => {
  try {
    const { errorId } = req.params;
    const resolvedBy = req.user.email;
    
    const result = await ErrorTrackingService.resolveError(errorId, resolvedBy);
    
    res.json({
      success: true,
      message: 'Error marked as resolved',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/errors/export
 * @desc    Export errors as CSV
 * @access  Admin only
 */
router.get('/errors/export', securityAuditLog, async (req, res, next) => {
  try {
    const {
      severity,
      environment,
      resolved,
      start_date,
      end_date
    } = req.query;
    
    const criteria = {
      severity,
      environment,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      startDate: start_date,
      endDate: end_date
    };
    
    const csvData = await ErrorTrackingService.exportErrors(criteria);
    
    const filename = `voxflow-errors-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
    res.send(csvData);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/monitoring/errors/track
 * @desc    Manually track an error (for testing)
 * @access  Admin only
 */
router.post('/errors/track', securityAuditLog, async (req, res, next) => {
  try {
    const { name, message, stack, context } = req.body;
    
    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: 'name and message are required'
      });
    }
    
    const error = new Error(message);
    error.name = name;
    if (stack) error.stack = stack;
    
    const errorId = await ErrorTrackingService.trackError(error, {
      ...context,
      manually_tracked: true,
      tracked_by: req.user.email
    });
    
    res.json({
      success: true,
      message: 'Error tracked successfully',
      data: { error_id: errorId }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/metrics/system
 * @desc    Get system metrics
 * @access  Admin only
 */
router.get('/metrics/system', securityAuditLog, async (req, res, next) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      system: {
        load_average: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
        total_memory: require('os').totalmem(),
        free_memory: require('os').freemem(),
        cpu_count: require('os').cpus().length,
        hostname: require('os').hostname(),
        uptime: require('os').uptime()
      },
      environment: {
        node_env: process.env.NODE_ENV,
        app_version: process.env.APP_VERSION || '1.0.0'
      }
    };
    
    // Calculate derived metrics
    metrics.system.memory_usage_percent = Math.round(
      ((metrics.system.total_memory - metrics.system.free_memory) / metrics.system.total_memory) * 100
    );
    
    metrics.process.memory_usage_mb = Math.round(metrics.process.memory.heapUsed / 1024 / 1024);
    metrics.process.memory_total_mb = Math.round(metrics.process.memory.heapTotal / 1024 / 1024);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/monitoring/alerts
 * @desc    Get system alerts and notifications
 * @access  Admin only
 */
router.get('/alerts', validatePagination, securityAuditLog, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, severity } = req.query;
    
    // This would typically query an alerts database
    // For now, return mock alerts based on current system state
    const alerts = [];
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      alerts.push({
        id: 'alert_memory_high',
        type: 'system',
        severity: 'critical',
        title: 'High Memory Usage',
        message: `Memory usage is at ${Math.round(memoryUsagePercent)}%`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Check uptime
    const uptime = process.uptime();
    if (uptime < 300) { // Less than 5 minutes
      alerts.push({
        id: 'alert_recent_restart',
        type: 'system',
        severity: 'medium',
        title: 'Recent System Restart',
        message: `System was restarted ${Math.round(uptime / 60)} minutes ago`,
        created_at: new Date(Date.now() - uptime * 1000).toISOString(),
        resolved: false
      });
    }
    
    // Filter by severity if specified
    let filteredAlerts = severity ? alerts.filter(alert => alert.severity === severity) : alerts;
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        alerts: paginatedAlerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredAlerts.length,
          pages: Math.ceil(filteredAlerts.length / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;