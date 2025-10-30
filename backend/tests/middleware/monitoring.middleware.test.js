import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  requestMonitoring,
  errorMonitoring,
  securityMonitoring,
  usageMonitoring,
  metricsCollection,
  databaseMonitoring,
  serviceCallMonitoring
} from '../../src/middleware/monitoring.middleware.js';

// Mock LoggingService
const mockLoggingService = {
  logApiRequest: vi.fn(),
  logPerformanceMetric: vi.fn(),
  error: vi.fn(),
  logSecurityEvent: vi.fn(),
  logUsageEvent: vi.fn(),
  logDatabaseOperation: vi.fn(),
  logServiceCall: vi.fn(),
  warn: vi.fn()
};

vi.mock('../../src/services/logging.service.js', () => ({
  LoggingService: mockLoggingService
}));

// Mock PerformanceMonitoringService
const mockPerformanceService = {
  getDatabaseSize: vi.fn()
};

vi.mock('../../src/services/performance-monitoring.service.js', () => ({
  PerformanceMonitoringService: mockPerformanceService
}));

describe('Monitoring Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      user: { id: 'user123', email: 'test@example.com', role: 'user' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
      id: 'req123',
      body: { test: 'data' },
      query: { param: 'value' },
      params: { id: '123' },
      headers: { 'x-request-id': 'req123' },
      connection: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      statusCode: 200,
      end: vi.fn(),
      json: vi.fn(),
      setHeader: vi.fn()
    };

    mockNext = vi.fn();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestMonitoring', () => {
    it('should monitor request duration and log API request', (done) => {
      const originalEnd = mockRes.end;
      
      requestMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate response end
      setTimeout(() => {
        mockRes.end('response data');
        
        expect(mockLoggingService.logApiRequest).toHaveBeenCalledWith(
          mockReq,
          mockRes,
          expect.any(Number)
        );
        
        expect(mockLoggingService.logPerformanceMetric).toHaveBeenCalledWith(
          'api_response_time',
          expect.any(Number),
          expect.objectContaining({
            endpoint: '/api/test',
            method: 'GET',
            status_code: 200,
            user_id: 'user123'
          })
        );
        
        done();
      }, 10);
    });

    it('should generate request ID if not present', () => {
      delete mockReq.id;
      delete mockReq.headers['x-request-id'];
      
      requestMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockReq.id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('errorMonitoring', () => {
    it('should log application errors with context', () => {
      const testError = new Error('Test error message');
      
      errorMonitoring(testError, mockReq, mockRes, mockNext);
      
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'Application Error',
        testError,
        expect.objectContaining({
          request_id: 'req123',
          method: 'GET',
          url: '/api/test',
          user_id: 'user123',
          user_email: 'test@example.com',
          ip_address: '127.0.0.1'
        })
      );
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Internal server error',
          request_id: 'req123'
        })
      );
    });

    it('should handle validation errors with 400 status', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      errorMonitoring(validationError, mockReq, mockRes, mockNext);
      
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation error'
        })
      );
    });

    it('should handle unauthorized errors with 401 status', () => {
      const authError = new Error('Unauthorized access');
      authError.name = 'UnauthorizedError';
      
      errorMonitoring(authError, mockReq, mockRes, mockNext);
      
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Unauthorized'
        })
      );
    });

    it('should handle rate limit errors with 429 status', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      errorMonitoring(rateLimitError, mockReq, mockRes, mockNext);
      
      expect(mockRes.statusCode).toBe(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Rate limit exceeded'
        })
      );
    });
  });

  describe('securityMonitoring', () => {
    it('should detect SQL injection patterns', () => {
      mockReq.body = { query: 'SELECT * FROM users WHERE id = 1 UNION SELECT * FROM passwords' };
      
      securityMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockLoggingService.logSecurityEvent).toHaveBeenCalledWith(
        'suspicious_request_pattern',
        expect.objectContaining({
          pattern_type: 'sql_injection',
          severity: 'high'
        })
      );
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect XSS patterns', () => {
      mockReq.body = { content: '<script>alert("xss")</script>' };
      
      securityMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockLoggingService.logSecurityEvent).toHaveBeenCalledWith(
        'suspicious_request_pattern',
        expect.objectContaining({
          pattern_type: 'xss_attempt',
          severity: 'high'
        })
      );
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect path traversal patterns', () => {
      mockReq.originalUrl = '/api/files?path=../../../etc/passwd';
      
      securityMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockLoggingService.logSecurityEvent).toHaveBeenCalledWith(
        'suspicious_request_pattern',
        expect.objectContaining({
          pattern_type: 'path_traversal',
          severity: 'high'
        })
      );
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect admin enumeration patterns', () => {
      mockReq.body = { username: 'admin', password: 'test' };
      
      securityMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockLoggingService.logSecurityEvent).toHaveBeenCalledWith(
        'suspicious_request_pattern',
        expect.objectContaining({
          pattern_type: 'admin_enumeration',
          severity: 'high'
        })
      );
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should track rapid requests from same IP', () => {
      // Clear any existing cache
      global.securityMonitorCache = new Map();
      
      // Simulate multiple rapid requests
      for (let i = 0; i < 101; i++) {
        securityMonitoring(mockReq, mockRes, mockNext);
      }
      
      expect(mockLoggingService.logSecurityEvent).toHaveBeenCalledWith(
        'rapid_requests_detected',
        expect.objectContaining({
          request_count: expect.any(Number),
          time_window: '1_minute',
          severity: 'medium'
        })
      );
    });
  });

  describe('usageMonitoring', () => {
    it('should log API usage events', () => {
      const responseData = { success: true, data: 'test' };
      
      usageMonitoring(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate response
      mockRes.json(responseData);
      
      expect(mockLoggingService.logUsageEvent).toHaveBeenCalledWith(
        'api_call',
        expect.objectContaining({
          user_id: 'user123',
          endpoint: '/api/test',
          method: 'GET',
          status_code: 200,
          response_size: expect.any(Number)
        })
      );
    });
  });

  describe('metricsCollection', () => {
    it('should collect request metrics', () => {
      metricsCollection(mockReq, mockRes, mockNext);
      
      expect(mockReq.metrics).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          endpoint: '/api/test',
          method: 'GET',
          user_id: 'user123',
          user_role: 'user',
          ip_address: '127.0.0.1'
        })
      );
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('databaseMonitoring', () => {
    it('should log database queries', () => {
      databaseMonitoring.logQuery('SELECT', 'users', 150, { user_id: 'user123' });
      
      expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
        'query_executed',
        expect.objectContaining({
          operation: 'SELECT',
          table: 'users',
          duration_ms: 150,
          user_id: 'user123'
        })
      );
      
      expect(mockLoggingService.logPerformanceMetric).toHaveBeenCalledWith(
        'database_query_time',
        150,
        expect.objectContaining({
          operation: 'SELECT',
          table: 'users'
        })
      );
    });

    it('should log slow queries as warnings', () => {
      databaseMonitoring.logQuery('SELECT', 'users', 1500); // > 1 second
      
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Slow database query detected',
        expect.objectContaining({
          operation: 'SELECT',
          table: 'users',
          duration_ms: 1500
        })
      );
    });

    it('should log database connection events', () => {
      databaseMonitoring.logConnection('connected', { pool_size: 10 });
      
      expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
        'connection_event',
        expect.objectContaining({
          event: 'connected',
          pool_size: 10
        })
      );
    });

    it('should log database errors', () => {
      const dbError = new Error('Connection failed');
      dbError.code = 'ECONNREFUSED';
      
      databaseMonitoring.logError(dbError, { query: 'SELECT * FROM users' });
      
      expect(mockLoggingService.logDatabaseOperation).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'Connection failed',
            code: 'ECONNREFUSED'
          },
          query: 'SELECT * FROM users'
        })
      );
    });
  });

  describe('serviceCallMonitoring', () => {
    it('should track service call lifecycle', () => {
      const context = { user_id: 'user123', tokens: 100 };
      
      // Start call
      const tracker = serviceCallMonitoring.startCall('groq', context);
      
      expect(tracker).toHaveProperty('callId');
      expect(tracker).toHaveProperty('startTime');
      expect(tracker).toHaveProperty('service', 'groq');
      expect(tracker).toHaveProperty('context', context);
      
      expect(mockLoggingService.logServiceCall).toHaveBeenCalledWith(
        'groq',
        expect.objectContaining({
          call_id: tracker.callId,
          event: 'call_started',
          user_id: 'user123',
          tokens: 100
        })
      );
      
      // End call successfully
      const result = { tokens_used: 100, cost: 0.001 };
      serviceCallMonitoring.endCall(tracker, result);
      
      expect(mockLoggingService.logServiceCall).toHaveBeenCalledWith(
        'groq',
        expect.objectContaining({
          call_id: tracker.callId,
          event: 'call_completed',
          duration_ms: expect.any(Number),
          tokens_used: 100,
          cost: 0.001
        })
      );
      
      expect(mockLoggingService.logPerformanceMetric).toHaveBeenCalledWith(
        'service_call_time',
        expect.any(Number),
        expect.objectContaining({
          service: 'groq'
        })
      );
    });

    it('should track service call errors', () => {
      const context = { user_id: 'user123' };
      const tracker = serviceCallMonitoring.startCall('deepgram', context);
      
      const error = new Error('API rate limit exceeded');
      error.code = 'RATE_LIMIT';
      
      serviceCallMonitoring.errorCall(tracker, error);
      
      expect(mockLoggingService.logServiceCall).toHaveBeenCalledWith(
        'deepgram',
        expect.objectContaining({
          call_id: tracker.callId,
          event: 'call_failed',
          duration_ms: expect.any(Number),
          error: {
            name: 'Error',
            message: 'API rate limit exceeded',
            code: 'RATE_LIMIT'
          }
        })
      );
    });
  });
});