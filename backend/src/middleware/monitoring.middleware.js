/**
 * Monitoring Middleware
 * 
 * Provides request monitoring, performance tracking, and error logging
 * for the VoxFlow multi-tenant system.
 */

import { LoggingService } from '../services/logging.service.js';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service.js';

/**
 * Request monitoring middleware
 * Tracks request duration, logs API calls, and monitors performance
 */
export const requestMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate unique request ID if not present
  if (!req.id && !req.headers['x-request-id']) {
    req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to capture response time
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log the API request
    LoggingService.logApiRequest(req, res, duration);
    
    // Log performance metric
    LoggingService.logPerformanceMetric('api_response_time', duration, {
      endpoint: req.originalUrl,
      method: req.method,
      status_code: res.statusCode,
      user_id: req.user?.id
    });
    
    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Error monitoring middleware
 * Captures and logs application errors with context
 */
export const errorMonitoring = (error, req, res, next) => {
  const errorContext = {
    request_id: req.id || req.headers['x-request-id'],
    method: req.method,
    url: req.originalUrl,
    user_id: req.user?.id,
    user_email: req.user?.email,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  };
  
  // Log the error with context
  LoggingService.error('Application Error', error, errorContext);
  
  // Determine error type and response
  let statusCode = 500;
  let message = 'Internal server error';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
    statusCode = 404;
    message = 'Not found';
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Rate limit exceeded';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined,
    request_id: req.id || req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
};

/**
 * Health check monitoring middleware
 * Monitors system health and logs health events
 */
export const healthMonitoring = async (req, res, next) => {
  try {
    // Basic health checks
    const healthChecks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        database: { status: 'unknown', response_time: 0 },
        memory: { status: 'unknown', usage_mb: 0, usage_percent: 0 },
        disk: { status: 'unknown', usage_percent: 0 }
      }
    };
    
    // Database health check
    try {
      const dbStart = Date.now();
      await PerformanceMonitoringService.getDatabaseSize();
      const dbDuration = Date.now() - dbStart;
      
      healthChecks.checks.database = {
        status: dbDuration < 1000 ? 'healthy' : 'slow',
        response_time: dbDuration
      };
    } catch (error) {
      healthChecks.checks.database = {
        status: 'unhealthy',
        error: error.message,
        response_time: 0
      };
      healthChecks.status = 'unhealthy';
    }
    
    // Memory usage check
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    healthChecks.checks.memory = {
      status: memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'healthy',
      usage_mb: Math.round(usedMemory / 1024 / 1024),
      usage_percent: Math.round(memoryUsagePercent)
    };
    
    if (memoryUsagePercent > 90) {
      healthChecks.status = 'critical';
    } else if (memoryUsagePercent > 75 && healthChecks.status === 'healthy') {
      healthChecks.status = 'warning';
    }
    
    // Log health status
    LoggingService.logHealthEvent('application', healthChecks.status, healthChecks);
    
    // Store health data in request for potential use
    req.healthCheck = healthChecks;
    
    next();
  } catch (error) {
    LoggingService.error('Health monitoring failed', error);
    next();
  }
};

/**
 * Security monitoring middleware
 * Monitors for suspicious activities and security events
 */
export const securityMonitoring = (req, res, next) => {
  const securityContext = {
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    user_id: req.user?.id,
    timestamp: new Date().toISOString()
  };
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter)\b/i, // SQL injection attempts
    /<script|javascript:|vbscript:|onload|onerror/i, // XSS attempts
    /\.\.\//g, // Path traversal attempts
    /\b(admin|root|administrator)\b/i // Admin enumeration
  ];
  
  const requestData = JSON.stringify({
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: req.headers
  });
  
  // Check for suspicious patterns in request
  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(requestData)) {
      LoggingService.logSecurityEvent('suspicious_request_pattern', {
        ...securityContext,
        pattern_index: index,
        pattern_type: ['sql_injection', 'xss_attempt', 'path_traversal', 'admin_enumeration'][index],
        severity: 'high'
      });
    }
  });
  
  // Check for rapid requests from same IP (basic rate limiting detection)
  const ipKey = `security_monitor_${securityContext.ip_address}`;
  const now = Date.now();
  
  // This would typically use Redis or similar for distributed systems
  if (!global.securityMonitorCache) {
    global.securityMonitorCache = new Map();
  }
  
  const ipData = global.securityMonitorCache.get(ipKey) || { requests: [], lastCleanup: now };
  
  // Clean old requests (older than 1 minute)
  ipData.requests = ipData.requests.filter(timestamp => now - timestamp < 60000);
  ipData.requests.push(now);
  
  // Check for rapid requests (more than 100 requests per minute)
  if (ipData.requests.length > 100) {
    LoggingService.logSecurityEvent('rapid_requests_detected', {
      ...securityContext,
      request_count: ipData.requests.length,
      time_window: '1_minute',
      severity: 'medium'
    });
  }
  
  global.securityMonitorCache.set(ipKey, ipData);
  
  // Clean up cache periodically
  if (now - ipData.lastCleanup > 300000) { // 5 minutes
    // Remove old entries
    for (const [key, data] of global.securityMonitorCache.entries()) {
      if (now - data.lastCleanup > 300000) {
        global.securityMonitorCache.delete(key);
      }
    }
    ipData.lastCleanup = now;
  }
  
  next();
};

/**
 * Usage monitoring middleware
 * Tracks API usage for billing and analytics
 */
export const usageMonitoring = (req, res, next) => {
  // Store original json function
  const originalJson = res.json;
  
  // Override res.json to capture response data
  res.json = function(data) {
    // Log usage event
    LoggingService.logUsageEvent('api_call', {
      user_id: req.user?.id,
      endpoint: req.originalUrl,
      method: req.method,
      status_code: res.statusCode,
      response_size: JSON.stringify(data).length,
      timestamp: new Date().toISOString()
    });
    
    // Call original json function
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Database operation monitoring
 * Tracks database queries and performance
 */
export const databaseMonitoring = {
  /**
   * Log database query execution
   * @param {string} operation - Database operation type
   * @param {string} table - Table name
   * @param {number} duration - Query duration in ms
   * @param {Object} context - Additional context
   */
  logQuery: (operation, table, duration, context = {}) => {
    LoggingService.logDatabaseOperation('query_executed', {
      operation,
      table,
      duration_ms: duration,
      ...context
    });
    
    // Log performance metric
    LoggingService.logPerformanceMetric('database_query_time', duration, {
      operation,
      table,
      ...context
    });
    
    // Log slow queries (> 1 second)
    if (duration > 1000) {
      LoggingService.warn('Slow database query detected', {
        operation,
        table,
        duration_ms: duration,
        ...context
      });
    }
  },
  
  /**
   * Log database connection events
   * @param {string} event - Connection event type
   * @param {Object} context - Event context
   */
  logConnection: (event, context = {}) => {
    LoggingService.logDatabaseOperation('connection_event', {
      event,
      ...context
    });
  },
  
  /**
   * Log database errors
   * @param {Error} error - Database error
   * @param {Object} context - Error context
   */
  logError: (error, context = {}) => {
    LoggingService.logDatabaseOperation('error', {
      error: {
        name: error.name,
        message: error.message,
        code: error.code
      },
      ...context
    });
  }
};

/**
 * Service call monitoring
 * Tracks external API calls (Groq, Deepgram, Twilio)
 */
export const serviceCallMonitoring = {
  /**
   * Log service call start
   * @param {string} service - Service name
   * @param {Object} context - Call context
   * @returns {Object} Call tracker
   */
  startCall: (service, context = {}) => {
    const callId = `${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    LoggingService.logServiceCall(service, {
      call_id: callId,
      event: 'call_started',
      ...context
    });
    
    return {
      callId,
      startTime,
      service,
      context
    };
  },
  
  /**
   * Log service call completion
   * @param {Object} tracker - Call tracker from startCall
   * @param {Object} result - Call result
   */
  endCall: (tracker, result = {}) => {
    const duration = Date.now() - tracker.startTime;
    
    LoggingService.logServiceCall(tracker.service, {
      call_id: tracker.callId,
      event: 'call_completed',
      duration_ms: duration,
      ...tracker.context,
      ...result
    });
    
    // Log performance metric
    LoggingService.logPerformanceMetric('service_call_time', duration, {
      service: tracker.service,
      ...tracker.context
    });
  },
  
  /**
   * Log service call error
   * @param {Object} tracker - Call tracker from startCall
   * @param {Error} error - Call error
   */
  errorCall: (tracker, error) => {
    const duration = Date.now() - tracker.startTime;
    
    LoggingService.logServiceCall(tracker.service, {
      call_id: tracker.callId,
      event: 'call_failed',
      duration_ms: duration,
      error: {
        name: error.name,
        message: error.message,
        code: error.code
      },
      ...tracker.context
    });
  }
};

/**
 * Metrics collection middleware
 * Collects various application metrics
 */
export const metricsCollection = (req, res, next) => {
  // Collect request metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl,
    method: req.method,
    user_id: req.user?.id,
    user_role: req.user?.role,
    ip_address: req.ip || req.connection.remoteAddress
  };
  
  // Store metrics in request for later use
  req.metrics = metrics;
  
  next();
};

export default {
  requestMonitoring,
  errorMonitoring,
  healthMonitoring,
  securityMonitoring,
  usageMonitoring,
  databaseMonitoring,
  serviceCallMonitoring,
  metricsCollection
};