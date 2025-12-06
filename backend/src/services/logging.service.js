/**
 * Logging Service
 * 
 * Provides structured logging, error tracking, and monitoring capabilities
 * for the VoxFlow multi-tenant system.
 */

import winston from 'winston';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Determine if running in serverless environment (Vercel)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Create Winston logger instance
const transports = [
  // Console transport (works in all environments)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// Only add file transports in non-serverless environments
if (!isServerless) {
  const path = await import('path');
  const fs = await import('fs');
  
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'voxflow-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports
});

class LoggingService {
  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  static info(message, meta = {}) {
    logger.info(message, {
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  static warn(message, meta = {}) {
    logger.warn(message, {
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or metadata
   * @param {Object} meta - Additional metadata
   */
  static error(message, error = {}, meta = {}) {
    const errorMeta = {
      ...meta,
      timestamp: new Date().toISOString()
    };

    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (typeof error === 'object') {
      errorMeta.error = error;
    }

    logger.error(message, errorMeta);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  static debug(message, meta = {}) {
    logger.debug(message, {
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log API request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  static logApiRequest(req, res, duration) {
    const logData = {
      type: 'api_request',
      method: req.method,
      url: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id,
      user_email: req.user?.email,
      user_role: req.user?.role,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_id: req.id || req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    };

    // Log different levels based on status code
    if (res.statusCode >= 500) {
      this.error('API Request - Server Error', logData);
    } else if (res.statusCode >= 400) {
      this.warn('API Request - Client Error', logData);
    } else {
      this.info('API Request', logData);
    }
  }

  /**
   * Log authentication events
   * @param {string} event - Authentication event type
   * @param {Object} data - Event data
   */
  static logAuthEvent(event, data = {}) {
    const logData = {
      type: 'authentication',
      event,
      ...data,
      timestamp: new Date().toISOString()
    };

    // Security-related events should be logged as warnings
    if (['login_failed', 'invalid_token', 'unauthorized_access'].includes(event)) {
      this.warn(`Authentication Event: ${event}`, logData);
    } else {
      this.info(`Authentication Event: ${event}`, logData);
    }
  }

  /**
   * Log security events
   * @param {string} event - Security event type
   * @param {Object} data - Event data
   */
  static logSecurityEvent(event, data = {}) {
    const logData = {
      type: 'security',
      event,
      severity: data.severity || 'medium',
      ...data,
      timestamp: new Date().toISOString()
    };

    // All security events are warnings or errors
    if (data.severity === 'high' || data.severity === 'critical') {
      this.error(`Security Event: ${event}`, logData);
    } else {
      this.warn(`Security Event: ${event}`, logData);
    }
  }

  /**
   * Log admin actions
   * @param {string} action - Admin action type
   * @param {Object} data - Action data
   */
  static logAdminAction(action, data = {}) {
    const logData = {
      type: 'admin_action',
      action,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.info(`Admin Action: ${action}`, logData);
  }

  /**
   * Log usage tracking events
   * @param {string} event - Usage event type
   * @param {Object} data - Usage data
   */
  static logUsageEvent(event, data = {}) {
    const logData = {
      type: 'usage_tracking',
      event,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.info(`Usage Event: ${event}`, logData);
  }

  /**
   * Log performance metrics
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {Object} data - Additional data
   */
  static logPerformanceMetric(metric, value, data = {}) {
    const logData = {
      type: 'performance_metric',
      metric,
      value,
      unit: data.unit || 'ms',
      ...data,
      timestamp: new Date().toISOString()
    };

    this.info(`Performance Metric: ${metric}`, logData);
  }

  /**
   * Log database operations
   * @param {string} operation - Database operation type
   * @param {Object} data - Operation data
   */
  static logDatabaseOperation(operation, data = {}) {
    const logData = {
      type: 'database_operation',
      operation,
      ...data,
      timestamp: new Date().toISOString()
    };

    if (data.error) {
      this.error(`Database Operation Failed: ${operation}`, logData);
    } else {
      this.debug(`Database Operation: ${operation}`, logData);
    }
  }

  /**
   * Log API service calls (Groq, Deepgram, Twilio)
   * @param {string} service - Service name
   * @param {Object} data - Service call data
   */
  static logServiceCall(service, data = {}) {
    const logData = {
      type: 'service_call',
      service,
      ...data,
      timestamp: new Date().toISOString()
    };

    if (data.error) {
      this.error(`Service Call Failed: ${service}`, logData);
    } else {
      this.info(`Service Call: ${service}`, logData);
    }
  }

  /**
   * Log rate limiting events
   * @param {string} event - Rate limit event type
   * @param {Object} data - Event data
   */
  static logRateLimitEvent(event, data = {}) {
    const logData = {
      type: 'rate_limiting',
      event,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.warn(`Rate Limit Event: ${event}`, logData);
  }

  /**
   * Log system health events
   * @param {string} component - System component
   * @param {string} status - Health status
   * @param {Object} data - Health data
   */
  static logHealthEvent(component, status, data = {}) {
    const logData = {
      type: 'system_health',
      component,
      status,
      ...data,
      timestamp: new Date().toISOString()
    };

    if (status === 'unhealthy' || status === 'critical') {
      this.error(`System Health: ${component} - ${status}`, logData);
    } else if (status === 'degraded') {
      this.warn(`System Health: ${component} - ${status}`, logData);
    } else {
      this.info(`System Health: ${component} - ${status}`, logData);
    }
  }

  /**
   * Create structured error log entry
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Object} Structured error log
   */
  static createErrorLog(error, context = {}) {
    return {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get log statistics
   * @param {string} timeframe - Timeframe for statistics (1h, 24h, 7d)
   * @returns {Promise<Object>} Log statistics
   */
  static async getLogStatistics(timeframe = '24h') {
    try {
      // This would typically query a log aggregation service
      // For now, we'll return mock statistics
      const stats = {
        timeframe,
        total_logs: 0,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        debug_count: 0,
        top_errors: [],
        performance_metrics: {
          avg_response_time: 0,
          error_rate: 0,
          request_count: 0
        },
        security_events: 0,
        timestamp: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', error);
      throw error;
    }
  }

  /**
   * Search logs by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching log entries
   */
  static async searchLogs(criteria = {}) {
    try {
      // This would typically query a log aggregation service
      // For now, we'll return empty results
      const results = {
        logs: [],
        total: 0,
        criteria,
        timestamp: new Date().toISOString()
      };

      return results;
    } catch (error) {
      this.error('Failed to search logs', error);
      throw error;
    }
  }

  /**
   * Export logs for a specific time period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<string>} Exported logs
   */
  static async exportLogs(startDate, endDate, format = 'json') {
    try {
      // This would typically export from log files or aggregation service
      const exportData = {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        format,
        logs: [],
        exported_at: new Date().toISOString()
      };

      if (format === 'csv') {
        return this.convertLogsToCSV(exportData.logs);
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.error('Failed to export logs', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   * @param {Array} logs - Log entries
   * @returns {string} CSV formatted logs
   */
  static convertLogsToCSV(logs) {
    if (!logs || logs.length === 0) {
      return 'timestamp,level,message,type,user_id,ip_address\n';
    }

    const headers = ['timestamp', 'level', 'message', 'type', 'user_id', 'ip_address'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = headers.map(header => {
        const value = log[header] || '';
        // Escape CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Get Winston logger instance
   * @returns {Object} Winston logger
   */
  static getLogger() {
    return logger;
  }

  /**
   * Set log level dynamically
   * @param {string} level - Log level (error, warn, info, debug)
   */
  static setLogLevel(level) {
    logger.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  /**
   * Add custom transport
   * @param {Object} transport - Winston transport
   */
  static addTransport(transport) {
    logger.add(transport);
    this.info('Custom transport added to logger');
  }

  /**
   * Remove transport
   * @param {Object} transport - Winston transport
   */
  static removeTransport(transport) {
    logger.remove(transport);
    this.info('Transport removed from logger');
  }
}

export { LoggingService };