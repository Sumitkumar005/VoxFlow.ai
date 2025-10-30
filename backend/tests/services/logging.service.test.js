import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggingService } from '../../src/services/logging.service.js';
import fs from 'fs';
import path from 'path';

describe('LoggingService', () => {
  const testLogsDir = path.join(process.cwd(), 'test-logs');
  
  beforeEach(() => {
    // Create test logs directory
    if (!fs.existsSync(testLogsDir)) {
      fs.mkdirSync(testLogsDir, { recursive: true });
    }
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up test logs
    if (fs.existsSync(testLogsDir)) {
      fs.rmSync(testLogsDir, { recursive: true, force: true });
    }
    
    vi.restoreAllMocks();
  });

  describe('Basic Logging Methods', () => {
    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.info('Test info message', { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.warn('Test warning message', { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages with Error object', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const testError = new Error('Test error');
      
      LoggingService.error('Test error message', testError, { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.debug('Test debug message', { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log API requests', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        user: { id: 'user123', email: 'test@example.com', role: 'user' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
        id: 'req123'
      };
      
      const mockRes = {
        statusCode: 200
      };
      
      LoggingService.logApiRequest(mockReq, mockRes, 150);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log authentication events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logAuthEvent('login_success', {
        user_id: 'user123',
        email: 'test@example.com'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log security events as warnings', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logSecurityEvent('suspicious_activity', {
        user_id: 'user123',
        ip_address: '127.0.0.1',
        severity: 'high'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log admin actions', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logAdminAction('user_updated', {
        admin_user_id: 'admin123',
        target_user_id: 'user456',
        changes: { subscription_tier: 'pro' }
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log usage events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logUsageEvent('api_call', {
        user_id: 'user123',
        endpoint: '/api/agents',
        tokens_used: 100
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log performance metrics', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logPerformanceMetric('response_time', 250, {
        endpoint: '/api/agents',
        method: 'GET'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log database operations', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logDatabaseOperation('query_executed', {
        operation: 'SELECT',
        table: 'users',
        duration_ms: 50
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log service calls', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logServiceCall('groq', {
        user_id: 'user123',
        tokens_used: 150,
        cost: 0.001
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log rate limiting events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logRateLimitEvent('limit_exceeded', {
        user_id: 'user123',
        ip_address: '127.0.0.1',
        endpoint: '/api/agents'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log health events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.logHealthEvent('database', 'healthy', {
        response_time: 50,
        connection_count: 5
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Error Log Creation', () => {
    it('should create structured error log', () => {
      const testError = new Error('Test error message');
      testError.code = 'TEST_ERROR';
      
      const errorLog = LoggingService.createErrorLog(testError, {
        user_id: 'user123',
        endpoint: '/api/test'
      });
      
      expect(errorLog).toHaveProperty('type', 'error');
      expect(errorLog).toHaveProperty('error');
      expect(errorLog.error).toHaveProperty('name', 'Error');
      expect(errorLog.error).toHaveProperty('message', 'Test error message');
      expect(errorLog.error).toHaveProperty('code', 'TEST_ERROR');
      expect(errorLog).toHaveProperty('context');
      expect(errorLog.context).toHaveProperty('user_id', 'user123');
      expect(errorLog).toHaveProperty('timestamp');
    });
  });

  describe('CSV Conversion', () => {
    it('should convert logs to CSV format', () => {
      const logs = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: 'info',
          message: 'Test message 1',
          type: 'api_request',
          user_id: 'user123',
          ip_address: '127.0.0.1'
        },
        {
          timestamp: '2024-01-01T00:01:00.000Z',
          level: 'error',
          message: 'Test error message',
          type: 'error',
          user_id: 'user456',
          ip_address: '192.168.1.1'
        }
      ];
      
      const csv = LoggingService.convertLogsToCSV(logs);
      
      expect(csv).toContain('timestamp,level,message,type,user_id,ip_address');
      expect(csv).toContain('2024-01-01T00:00:00.000Z,info,Test message 1,api_request,user123,127.0.0.1');
      expect(csv).toContain('2024-01-01T00:01:00.000Z,error,Test error message,error,user456,192.168.1.1');
    });

    it('should handle empty logs array', () => {
      const csv = LoggingService.convertLogsToCSV([]);
      
      expect(csv).toBe('timestamp,level,message,type,user_id,ip_address\n');
    });

    it('should escape CSV values with commas and quotes', () => {
      const logs = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: 'info',
          message: 'Message with, comma and "quotes"',
          type: 'test',
          user_id: 'user123',
          ip_address: '127.0.0.1'
        }
      ];
      
      const csv = LoggingService.convertLogsToCSV(logs);
      
      expect(csv).toContain('\"Message with, comma and \"\"quotes\"\"\"');
    });
  });

  describe('Logger Configuration', () => {
    it('should get Winston logger instance', () => {
      const logger = LoggingService.getLogger();
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should set log level dynamically', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      LoggingService.setLogLevel('debug');
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Async Methods', () => {
    it('should get log statistics', async () => {
      const stats = await LoggingService.getLogStatistics('24h');
      
      expect(stats).toHaveProperty('timeframe', '24h');
      expect(stats).toHaveProperty('total_logs');
      expect(stats).toHaveProperty('error_count');
      expect(stats).toHaveProperty('warning_count');
      expect(stats).toHaveProperty('info_count');
      expect(stats).toHaveProperty('debug_count');
      expect(stats).toHaveProperty('timestamp');
    });

    it('should search logs', async () => {
      const results = await LoggingService.searchLogs({
        query: 'test',
        level: 'info'
      });
      
      expect(results).toHaveProperty('logs');
      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('criteria');
      expect(results).toHaveProperty('timestamp');
      expect(Array.isArray(results.logs)).toBe(true);
    });

    it('should export logs in JSON format', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      const exportData = await LoggingService.exportLogs(startDate, endDate, 'json');
      
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(parsed).toHaveProperty('start_date');
      expect(parsed).toHaveProperty('end_date');
      expect(parsed).toHaveProperty('format', 'json');
      expect(parsed).toHaveProperty('logs');
      expect(parsed).toHaveProperty('exported_at');
    });

    it('should export logs in CSV format', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      const exportData = await LoggingService.exportLogs(startDate, endDate, 'csv');
      
      expect(typeof exportData).toBe('string');
      expect(exportData).toContain('timestamp,level,message,type,user_id,ip_address');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in getLogStatistics gracefully', async () => {
      // Mock an error in the method
      const originalMethod = LoggingService.getLogStatistics;
      LoggingService.getLogStatistics = vi.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(LoggingService.getLogStatistics()).rejects.toThrow('Test error');
      
      // Restore original method
      LoggingService.getLogStatistics = originalMethod;
    });

    it('should handle errors in searchLogs gracefully', async () => {
      // Mock an error in the method
      const originalMethod = LoggingService.searchLogs;
      LoggingService.searchLogs = vi.fn().mockRejectedValue(new Error('Search error'));
      
      await expect(LoggingService.searchLogs()).rejects.toThrow('Search error');
      
      // Restore original method
      LoggingService.searchLogs = originalMethod;
    });

    it('should handle errors in exportLogs gracefully', async () => {
      // Mock an error in the method
      const originalMethod = LoggingService.exportLogs;
      LoggingService.exportLogs = vi.fn().mockRejectedValue(new Error('Export error'));
      
      const startDate = new Date();
      const endDate = new Date();
      
      await expect(LoggingService.exportLogs(startDate, endDate)).rejects.toThrow('Export error');
      
      // Restore original method
      LoggingService.exportLogs = originalMethod;
    });
  });
});