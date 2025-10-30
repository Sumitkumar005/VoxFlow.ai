import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorTrackingService } from '../../src/services/error-tracking.service.js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockReturnThis()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock LoggingService
vi.mock('../../src/services/logging.service.js', () => ({
  LoggingService: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('ErrorTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackError', () => {
    it('should track error successfully', async () => {
      const mockError = new Error('Test error message');
      mockError.code = 'TEST_ERROR';
      
      const mockContext = {
        user_id: 'user123',
        endpoint: '/api/test',
        method: 'GET'
      };
      
      // Mock successful database insert
      mockSupabase.insert.mockResolvedValue({ error: null });
      
      const errorId = await ErrorTrackingService.trackError(mockError, mockContext);
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(mockSupabase.from).toHaveBeenCalledWith('error_tracking');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle database insert errors', async () => {
      const mockError = new Error('Test error message');
      const mockContext = { user_id: 'user123' };
      
      // Mock database error
      mockSupabase.insert.mockResolvedValue({ 
        error: { code: '42P01', message: 'Table does not exist' } 
      });
      
      // Mock table creation success
      mockSupabase.rpc.mockResolvedValue({ error: null });
      
      // Mock retry insert success
      mockSupabase.insert.mockResolvedValueOnce({ 
        error: { code: '42P01', message: 'Table does not exist' } 
      }).mockResolvedValueOnce({ error: null });
      
      const errorId = await ErrorTrackingService.trackError(mockError, mockContext);
      
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(mockSupabase.rpc).toHaveBeenCalled(); // Table creation
    });

    it('should send alert for critical errors', async () => {
      const mockError = new Error('Database connection failed');
      mockError.name = 'DatabaseConnectionError';
      
      const mockContext = { endpoint: '/api/critical' };
      
      mockSupabase.insert.mockResolvedValue({ error: null });
      
      const consoleSpy = vi.spyOn(console, 'error');
      
      await ErrorTrackingService.trackError(mockError, mockContext);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL ERROR ALERT 🚨'),
        expect.any(Object)
      );
    });
  });

  describe('determineSeverity', () => {
    it('should return critical for database connection errors', () => {
      const error = new Error('Connection refused');
      error.name = 'DatabaseConnectionError';
      
      const severity = ErrorTrackingService.determineSeverity(error, {});
      
      expect(severity).toBe('critical');
    });

    it('should return critical for timeout errors', () => {
      const error = new Error('Request timeout');
      
      const severity = ErrorTrackingService.determineSeverity(error, {});
      
      expect(severity).toBe('critical');
    });

    it('should return critical for auth endpoint errors', () => {
      const error = new Error('Server error');
      
      const severity = ErrorTrackingService.determineSeverity(error, {
        endpoint: '/auth/login'
      });
      
      expect(severity).toBe('critical');
    });

    it('should return high for validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      const severity = ErrorTrackingService.determineSeverity(error, {});
      
      expect(severity).toBe('high');
    });

    it('should return medium for not found errors', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';
      
      const severity = ErrorTrackingService.determineSeverity(error, {});
      
      expect(severity).toBe('medium');
    });

    it('should return low for unknown errors', () => {
      const error = new Error('Unknown error');
      
      const severity = ErrorTrackingService.determineSeverity(error, {});
      
      expect(severity).toBe('low');
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same error', () => {
      const error1 = new Error('Test error message');
      error1.stack = 'Error: Test error message\\n    at test.js:1:1';
      
      const error2 = new Error('Test error message');
      error2.stack = 'Error: Test error message\\n    at test.js:1:1';
      
      const fingerprint1 = ErrorTrackingService.generateFingerprint(error1);
      const fingerprint2 = ErrorTrackingService.generateFingerprint(error2);
      
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different errors', () => {
      const error1 = new Error('Test error message 1');
      const error2 = new Error('Test error message 2');
      
      const fingerprint1 = ErrorTrackingService.generateFingerprint(error1);
      const fingerprint2 = ErrorTrackingService.generateFingerprint(error2);
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should normalize numbers in error messages', () => {
      const error1 = new Error('Error at line 123');
      const error2 = new Error('Error at line 456');
      
      const fingerprint1 = ErrorTrackingService.generateFingerprint(error1);
      const fingerprint2 = ErrorTrackingService.generateFingerprint(error2);
      
      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('getErrorStatistics', () => {
    it('should return error statistics', async () => {
      const mockErrors = [
        { severity: 'critical', name: 'DatabaseError', resolved: false, created_at: '2024-01-01T00:00:00Z', fingerprint: 'fp1' },
        { severity: 'high', name: 'ValidationError', resolved: true, created_at: '2024-01-01T01:00:00Z', fingerprint: 'fp2' },
        { severity: 'medium', name: 'NotFoundError', resolved: false, created_at: '2024-01-01T02:00:00Z', fingerprint: 'fp3' }
      ];
      
      mockSupabase.select.mockResolvedValue({ data: mockErrors, error: null });
      
      const stats = await ErrorTrackingService.getErrorStatistics({
        timeframe: '24h',
        environment: 'test'
      });
      
      expect(stats).toHaveProperty('total_errors', 3);
      expect(stats).toHaveProperty('by_severity');
      expect(stats.by_severity.critical).toBe(1);
      expect(stats.by_severity.high).toBe(1);
      expect(stats.by_severity.medium).toBe(1);
      expect(stats).toHaveProperty('resolved_count', 1);
      expect(stats).toHaveProperty('unresolved_count', 2);
      expect(stats).toHaveProperty('top_errors');
      expect(Array.isArray(stats.top_errors)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });
      
      await expect(ErrorTrackingService.getErrorStatistics()).rejects.toThrow('Database error');
    });
  });

  describe('getErrorDetails', () => {
    it('should return error details by ID', async () => {
      const mockError = {
        error_id: 'err_123',
        name: 'TestError',
        message: 'Test error message',
        severity: 'high'
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockError, error: null });
      
      const result = await ErrorTrackingService.getErrorDetails('err_123');
      
      expect(result).toEqual(mockError);
      expect(mockSupabase.eq).toHaveBeenCalledWith('error_id', 'err_123');
    });

    it('should handle not found errors', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not found' } 
      });
      
      await expect(ErrorTrackingService.getErrorDetails('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('resolveError', () => {
    it('should mark error as resolved', async () => {
      const mockUpdatedError = {
        error_id: 'err_123',
        resolved: true,
        resolved_by: 'admin@example.com'
      };
      
      mockSupabase.select.mockResolvedValue({ data: [mockUpdatedError], error: null });
      
      const result = await ErrorTrackingService.resolveError('err_123', 'admin@example.com');
      
      expect(result).toEqual(mockUpdatedError);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          resolved: true,
          resolved_by: 'admin@example.com'
        })
      );
    });
  });

  describe('searchErrors', () => {
    it('should search errors with criteria', async () => {
      const mockErrors = [
        { error_id: 'err_1', name: 'TestError', message: 'Test message' },
        { error_id: 'err_2', name: 'ValidationError', message: 'Validation failed' }
      ];
      
      mockSupabase.range.mockResolvedValue({ 
        data: mockErrors, 
        error: null, 
        count: 2 
      });
      
      const result = await ErrorTrackingService.searchErrors({
        query: 'test',
        severity: 'high',
        limit: 10,
        offset: 0
      });
      
      expect(result).toHaveProperty('errors', mockErrors);
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('offset', 0);
      expect(result).toHaveProperty('has_more', false);
    });
  });

  describe('exportErrors', () => {
    it('should export errors as CSV', async () => {
      const mockErrors = [
        {
          error_id: 'err_1',
          name: 'TestError',
          message: 'Test message',
          severity: 'high',
          environment: 'test',
          resolved: false,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];
      
      // Mock the searchErrors method
      const originalSearchErrors = ErrorTrackingService.searchErrors;
      ErrorTrackingService.searchErrors = vi.fn().mockResolvedValue({
        errors: mockErrors,
        total: 1
      });
      
      const csv = await ErrorTrackingService.exportErrors({
        severity: 'high'
      });
      
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Error ID,Name,Message,Severity');
      expect(csv).toContain('err_1,TestError');
      
      // Restore original method
      ErrorTrackingService.searchErrors = originalSearchErrors;
    });
  });

  describe('getErrorTrends', () => {
    it('should return error trends', async () => {
      const trends = await ErrorTrackingService.getErrorTrends({
        timeframe: '7d',
        groupBy: 'day'
      });
      
      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBe(7);
      
      trends.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('total_errors');
        expect(trend).toHaveProperty('critical_errors');
        expect(trend).toHaveProperty('high_errors');
        expect(trend).toHaveProperty('medium_errors');
        expect(trend).toHaveProperty('low_errors');
      });
    });
  });
});