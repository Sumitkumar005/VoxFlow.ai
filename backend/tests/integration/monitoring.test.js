import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

// Mock services
const mockLoggingService = {
  getLogStatistics: vi.fn(),
  searchLogs: vi.fn(),
  exportLogs: vi.fn()
};

const mockErrorTrackingService = {
  getErrorStatistics: vi.fn(),
  getErrorTrends: vi.fn(),
  searchErrors: vi.fn(),
  getErrorDetails: vi.fn(),
  resolveError: vi.fn(),
  exportErrors: vi.fn(),
  trackError: vi.fn()
};

const mockPerformanceService = {
  getDatabaseMetrics: vi.fn(),
  getRealTimeMetrics: vi.fn(),
  getPerformanceRecommendations: vi.fn(),
  refreshMaterializedViews: vi.fn(),
  updateTableStatistics: vi.fn()
};

vi.mock('../../src/services/logging.service.js', () => ({
  LoggingService: mockLoggingService
}));

vi.mock('../../src/services/error-tracking.service.js', () => ({
  ErrorTrackingService: mockErrorTrackingService
}));

vi.mock('../../src/services/performance-monitoring.service.js', () => ({
  PerformanceMonitoringService: mockPerformanceService
}));

// Mock JWT verification
vi.mock('jsonwebtoken', () => ({
  verify: vi.fn((token, secret, callback) => {
    if (token === 'valid-admin-token') {
      callback(null, { 
        id: 'admin123', 
        email: 'admin@voxflow.com', 
        role: 'admin' 
      });
    } else if (token === 'valid-user-token') {
      callback(null, { 
        id: 'user123', 
        email: 'user@example.com', 
        role: 'user' 
      });
    } else {
      callback(new Error('Invalid token'), null);
    }
  })
}));

describe('Monitoring API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return basic health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('environment');
        expect(response.body).toHaveProperty('version');
      });
    });

    describe('GET /health/detailed', () => {
      it('should return detailed health status', async () => {
        mockPerformanceService.getDatabaseSize.mockResolvedValue({
          database_size: '10MB',
          database_size_bytes: 10485760
        });

        const response = await request(app)
          .get('/health/detailed')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('checks');
        expect(response.body.checks).toHaveProperty('database');
        expect(response.body.checks).toHaveProperty('memory');
        expect(response.body.checks).toHaveProperty('disk');
        expect(response.body).toHaveProperty('response_time');
      });

      it('should handle database connection failures', async () => {
        mockPerformanceService.getDatabaseSize.mockRejectedValue(
          new Error('Database connection failed')
        );

        const response = await request(app)
          .get('/health/detailed')
          .expect(200);

        expect(response.body.status).toBe('unhealthy');
        expect(response.body.checks.database.status).toBe('unhealthy');
      });
    });

    describe('GET /health/readiness', () => {
      it('should return ready status when all checks pass', async () => {
        mockPerformanceService.getDatabaseSize.mockResolvedValue({});

        const response = await request(app)
          .get('/health/readiness')
          .expect(200);

        expect(response.body).toHaveProperty('status', 'ready');
        expect(response.body).toHaveProperty('checks');
      });

      it('should return not ready when database is unavailable', async () => {
        mockPerformanceService.getDatabaseSize.mockRejectedValue(
          new Error('Database unavailable')
        );

        const response = await request(app)
          .get('/health/readiness')
          .expect(503);

        expect(response.body).toHaveProperty('status', 'not_ready');
      });
    });

    describe('GET /health/liveness', () => {
      it('should return alive status', async () => {
        const response = await request(app)
          .get('/health/liveness')
          .expect(200);

        expect(response.body).toHaveProperty('status', 'alive');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('pid');
      });
    });

    describe('GET /health/metrics', () => {
      it('should return Prometheus-style metrics', async () => {
        mockErrorTrackingService.getErrorStatistics.mockResolvedValue({
          by_severity: { critical: 1, high: 2, medium: 3, low: 4 }
        });

        const response = await request(app)
          .get('/health/metrics')
          .expect(200);

        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.text).toContain('voxflow_uptime_seconds');
        expect(response.text).toContain('voxflow_memory_usage_bytes');
        expect(response.text).toContain('voxflow_errors_total');
      });
    });
  });

  describe('Monitoring Endpoints (Admin Only)', () => {
    describe('GET /api/monitoring/health', () => {
      it('should return system health for admin users', async () => {
        const response = await request(app)
          .get('/api/monitoring/health')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('uptime');
        expect(response.body.data).toHaveProperty('memory');
      });

      it('should reject non-admin users', async () => {
        const response = await request(app)
          .get('/api/monitoring/health')
          .set('Authorization', 'Bearer valid-user-token')
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Admin access required');
      });

      it('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/monitoring/health')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/monitoring/logs/statistics', () => {
      it('should return log statistics for admin users', async () => {
        const mockStats = {
          timeframe: '24h',
          total_logs: 1000,
          error_count: 50,
          warning_count: 100,
          info_count: 800,
          debug_count: 50
        };

        mockLoggingService.getLogStatistics.mockResolvedValue(mockStats);

        const response = await request(app)
          .get('/api/monitoring/logs/statistics')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({ timeframe: '24h' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data', mockStats);
        expect(mockLoggingService.getLogStatistics).toHaveBeenCalledWith('24h');
      });
    });

    describe('GET /api/monitoring/logs/search', () => {
      it('should search logs with pagination', async () => {
        const mockResults = {
          logs: [
            { id: 1, message: 'Test log 1', level: 'info' },
            { id: 2, message: 'Test log 2', level: 'error' }
          ],
          total: 2
        };

        mockLoggingService.searchLogs.mockResolvedValue(mockResults);

        const response = await request(app)
          .get('/api/monitoring/logs/search')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({ 
            query: 'test',
            level: 'info',
            page: 1,
            limit: 10
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('logs', mockResults.logs);
        expect(response.body.data).toHaveProperty('pagination');
        expect(response.body.data.pagination).toHaveProperty('page', 1);
        expect(response.body.data.pagination).toHaveProperty('limit', 10);
      });
    });

    describe('GET /api/monitoring/logs/export', () => {
      it('should export logs as JSON', async () => {
        const mockExportData = JSON.stringify({
          start_date: '2024-01-01',
          end_date: '2024-01-02',
          logs: []
        });

        mockLoggingService.exportLogs.mockResolvedValue(mockExportData);

        const response = await request(app)
          .get('/api/monitoring/logs/export')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({
            start_date: '2024-01-01',
            end_date: '2024-01-02',
            format: 'json'
          })
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toContain('attachment');
      });

      it('should export logs as CSV', async () => {
        const mockCsvData = 'timestamp,level,message\n2024-01-01,info,test';

        mockLoggingService.exportLogs.mockResolvedValue(mockCsvData);

        const response = await request(app)
          .get('/api/monitoring/logs/export')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({
            start_date: '2024-01-01',
            end_date: '2024-01-02',
            format: 'csv'
          })
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
      });

      it('should require start_date and end_date', async () => {
        const response = await request(app)
          .get('/api/monitoring/logs/export')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('start_date and end_date are required');
      });
    });

    describe('GET /api/monitoring/errors/statistics', () => {
      it('should return error statistics', async () => {
        const mockStats = {
          total_errors: 100,
          by_severity: { critical: 5, high: 15, medium: 30, low: 50 },
          resolved_count: 80,
          unresolved_count: 20
        };

        mockErrorTrackingService.getErrorStatistics.mockResolvedValue(mockStats);

        const response = await request(app)
          .get('/api/monitoring/errors/statistics')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({ timeframe: '7d' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data', mockStats);
      });
    });

    describe('GET /api/monitoring/errors/trends', () => {
      it('should return error trends', async () => {
        const mockTrends = [
          { date: '2024-01-01', total_errors: 10, critical_errors: 1 },
          { date: '2024-01-02', total_errors: 15, critical_errors: 2 }
        ];

        mockErrorTrackingService.getErrorTrends.mockResolvedValue(mockTrends);

        const response = await request(app)
          .get('/api/monitoring/errors/trends')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data', mockTrends);
      });
    });

    describe('GET /api/monitoring/errors/search', () => {
      it('should search errors with filters', async () => {
        const mockResults = {
          errors: [
            { error_id: 'err_1', name: 'TestError', severity: 'high' }
          ],
          total: 1,
          has_more: false
        };

        mockErrorTrackingService.searchErrors.mockResolvedValue(mockResults);

        const response = await request(app)
          .get('/api/monitoring/errors/search')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({
            query: 'test',
            severity: 'high',
            resolved: 'false'
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('errors', mockResults.errors);
        expect(response.body.data).toHaveProperty('pagination');
      });
    });

    describe('GET /api/monitoring/errors/:errorId', () => {
      it('should return error details', async () => {
        const mockError = {
          error_id: 'err_123',
          name: 'TestError',
          message: 'Test error message',
          severity: 'high'
        };

        mockErrorTrackingService.getErrorDetails.mockResolvedValue(mockError);

        const response = await request(app)
          .get('/api/monitoring/errors/err_123')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data', mockError);
      });

      it('should return 404 for non-existent errors', async () => {
        mockErrorTrackingService.getErrorDetails.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/monitoring/errors/nonexistent')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Error not found');
      });
    });

    describe('PUT /api/monitoring/errors/:errorId/resolve', () => {
      it('should resolve error', async () => {
        const mockResolvedError = {
          error_id: 'err_123',
          resolved: true,
          resolved_by: 'admin@voxflow.com'
        };

        mockErrorTrackingService.resolveError.mockResolvedValue(mockResolvedError);

        const response = await request(app)
          .put('/api/monitoring/errors/err_123/resolve')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Error marked as resolved');
        expect(response.body).toHaveProperty('data', mockResolvedError);
        expect(mockErrorTrackingService.resolveError).toHaveBeenCalledWith(
          'err_123',
          'admin@voxflow.com'
        );
      });
    });

    describe('POST /api/monitoring/errors/track', () => {
      it('should manually track an error', async () => {
        mockErrorTrackingService.trackError.mockResolvedValue('err_456');

        const response = await request(app)
          .post('/api/monitoring/errors/track')
          .set('Authorization', 'Bearer valid-admin-token')
          .send({
            name: 'TestError',
            message: 'Manually tracked error',
            context: { test: true }
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Error tracked successfully');
        expect(response.body.data).toHaveProperty('error_id', 'err_456');
      });

      it('should require name and message', async () => {
        const response = await request(app)
          .post('/api/monitoring/errors/track')
          .set('Authorization', 'Bearer valid-admin-token')
          .send({
            name: 'TestError'
            // Missing message
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('name and message are required');
      });
    });

    describe('GET /api/monitoring/metrics/system', () => {
      it('should return system metrics', async () => {
        const response = await request(app)
          .get('/api/monitoring/metrics/system')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('timestamp');
        expect(response.body.data).toHaveProperty('process');
        expect(response.body.data).toHaveProperty('system');
        expect(response.body.data).toHaveProperty('environment');
        expect(response.body.data.process).toHaveProperty('uptime');
        expect(response.body.data.process).toHaveProperty('memory');
        expect(response.body.data.system).toHaveProperty('total_memory');
        expect(response.body.data.system).toHaveProperty('free_memory');
      });
    });

    describe('GET /api/monitoring/alerts', () => {
      it('should return system alerts', async () => {
        const response = await request(app)
          .get('/api/monitoring/alerts')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('alerts');
        expect(response.body.data).toHaveProperty('pagination');
        expect(Array.isArray(response.body.data.alerts)).toBe(true);
      });

      it('should filter alerts by severity', async () => {
        const response = await request(app)
          .get('/api/monitoring/alerts')
          .set('Authorization', 'Bearer valid-admin-token')
          .query({ severity: 'critical' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('alerts');
      });
    });
  });

  describe('Performance Endpoints (Admin Only)', () => {
    describe('GET /api/performance/metrics', () => {
      it('should return database performance metrics', async () => {
        const mockMetrics = {
          data: {
            connection_stats: { active_connections: 5 },
            table_stats: [],
            index_usage: [],
            query_performance: { available: true, queries: [] },
            cache_hit_ratio: { cache_hit_ratio: 95 }
          },
          timestamp: new Date().toISOString()
        };

        mockPerformanceService.getDatabaseMetrics.mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/api/performance/metrics')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data', mockMetrics.data);
        expect(response.body).toHaveProperty('timestamp', mockMetrics.timestamp);
      });
    });

    describe('GET /api/performance/health', () => {
      it('should return database health status', async () => {
        const mockMetrics = {
          data: {
            connection_stats: { active_connections: 10 },
            cache_hit_ratio: { cache_hit_ratio: 96 }
          }
        };

        const mockRealtimeMetrics = {
          data: {
            lock_waits: [],
            database_size: { database_size: '100MB' }
          }
        };

        mockPerformanceService.getDatabaseMetrics.mockResolvedValue(mockMetrics);
        mockPerformanceService.getRealTimeMetrics.mockResolvedValue(mockRealtimeMetrics);

        const response = await request(app)
          .get('/api/performance/health')
          .set('Authorization', 'Bearer valid-admin-token')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('health_score');
        expect(response.body.data).toHaveProperty('health_status');
        expect(response.body.data).toHaveProperty('issues');
        expect(response.body.data).toHaveProperty('metrics_summary');
      });
    });
  });
});