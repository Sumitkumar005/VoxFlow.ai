import express from 'express';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service.js';
import { LoggingService } from '../services/logging.service.js';
import { ErrorTrackingService } from '../services/error-tracking.service.js';

const router = express.Router();

/**
 * @route   GET /health
 * @desc    Basic health check endpoint (public)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with database and service checks
 * @access  Public
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    checks: {
      database: { status: 'unknown', response_time: 0 },
      memory: { status: 'unknown', usage_mb: 0, usage_percent: 0 },
      disk: { status: 'unknown' },
      external_services: { status: 'unknown' }
    },
    response_time: 0
  };
  
  try {
    // Database health check
    try {
      const dbStart = Date.now();
      await PerformanceMonitoringService.getDatabaseSize();
      const dbDuration = Date.now() - dbStart;
      
      health.checks.database = {
        status: dbDuration < 1000 ? 'healthy' : 'slow',
        response_time: dbDuration
      };
    } catch (error) {
      health.checks.database = {
        status: 'unhealthy',
        error: error.message,
        response_time: 0
      };
      health.status = 'unhealthy';
    }
    
    // Memory usage check
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    health.checks.memory = {
      status: memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'healthy',
      usage_mb: Math.round(usedMemory / 1024 / 1024),
      usage_percent: Math.round(memoryUsagePercent),
      heap_used: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    if (memoryUsagePercent > 90) {
      health.status = 'critical';
    } else if (memoryUsagePercent > 75 && health.status === 'healthy') {
      health.status = 'warning';
    }
    
    // Disk space check (simplified)
    health.checks.disk = {
      status: 'healthy' // Would implement actual disk space check in production
    };
    
    // External services check (simplified)
    health.checks.external_services = {
      status: 'healthy' // Would check Groq, Deepgram, Twilio APIs in production
    };
    
    // Calculate total response time
    health.response_time = Date.now() - startTime;
    
    // Log health check
    LoggingService.logHealthEvent('application', health.status, {
      response_time: health.response_time,
      memory_usage: health.checks.memory.usage_percent,
      database_response_time: health.checks.database.response_time
    });
    
    res.json(health);
  } catch (error) {
    LoggingService.error('Health check failed', error);
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      response_time: Date.now() - startTime
    });
  }
});

/**
 * @route   GET /health/readiness
 * @desc    Kubernetes readiness probe endpoint
 * @access  Public
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check if application is ready to serve requests
    const checks = {
      database: false,
      memory: false
    };
    
    // Database readiness check
    try {
      await PerformanceMonitoringService.getDatabaseSize();
      checks.database = true;
    } catch (error) {
      // Database not ready
    }
    
    // Memory readiness check
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = memoryUsagePercent < 95; // Ready if memory usage < 95%
    
    const isReady = Object.values(checks).every(check => check === true);
    
    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @route   GET /health/liveness
 * @desc    Kubernetes liveness probe endpoint
 * @access  Public
 */
router.get('/liveness', (req, res) => {
  // Simple liveness check - if this endpoint responds, the app is alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * @route   GET /health/metrics
 * @desc    Prometheus-style metrics endpoint
 * @access  Public
 */
router.get('/metrics', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Get error statistics
    let errorStats = { total_errors: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } };
    try {
      errorStats = await ErrorTrackingService.getErrorStatistics({ timeframe: '1h' });
    } catch (error) {
      // Ignore error statistics if not available
    }
    
    // Generate Prometheus-style metrics
    const metrics = `
# HELP voxflow_uptime_seconds Total uptime of the application in seconds
# TYPE voxflow_uptime_seconds counter
voxflow_uptime_seconds ${uptime}

# HELP voxflow_memory_usage_bytes Memory usage in bytes
# TYPE voxflow_memory_usage_bytes gauge
voxflow_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}
voxflow_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}
voxflow_memory_usage_bytes{type="external"} ${memUsage.external}
voxflow_memory_usage_bytes{type="rss"} ${memUsage.rss}

# HELP voxflow_memory_usage_percent Memory usage percentage
# TYPE voxflow_memory_usage_percent gauge
voxflow_memory_usage_percent ${(memUsage.heapUsed / memUsage.heapTotal) * 100}

# HELP voxflow_errors_total Total number of errors by severity
# TYPE voxflow_errors_total counter
voxflow_errors_total{severity="critical"} ${errorStats.by_severity.critical}
voxflow_errors_total{severity="high"} ${errorStats.by_severity.high}
voxflow_errors_total{severity="medium"} ${errorStats.by_severity.medium}
voxflow_errors_total{severity="low"} ${errorStats.by_severity.low}

# HELP voxflow_process_info Process information
# TYPE voxflow_process_info gauge
voxflow_process_info{version="${process.version}",platform="${process.platform}",arch="${process.arch}"} 1
`.trim();
    
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    LoggingService.error('Failed to generate metrics', error);
    res.status(500).send('# Error generating metrics');
  }
});

export default router;