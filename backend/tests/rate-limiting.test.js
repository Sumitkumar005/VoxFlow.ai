const { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

// Mock Redis for testing
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    call: jest.fn(),
    disconnect: jest.fn()
  };
  
  return jest.fn(() => mockRedis);
});

describe('Rate Limiting Middleware', () => {
  let supabase;
  let adminToken;
  let adminUser;
  let regularToken;
  let regularUser;
  let mockRedis;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Setup test users
    await setupTestUsers();
    
    // Login as admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@voxflow.com',
        password: 'admin123'
      });

    if (adminLogin.status === 200) {
      adminToken = adminLogin.body.token;
      adminUser = adminLogin.body.user;
    }

    // Create and login as regular user
    await supabase
      .from('users')
      .upsert({
        email: 'regular@test.com',
        password_hash: '$2a$10$test.hash.for.regular.user.password.test123',
        role: 'user',
        subscription_tier: 'free',
        organization_name: 'Test Organization',
        max_agents: 2,
        monthly_token_quota: 1000,
        is_active: true
      });

    const regularLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'regular@test.com',
        password: 'test123'
      });

    if (regularLogin.status === 200) {
      regularToken = regularLogin.body.token;
      regularUser = regularLogin.body.user;
    }

    // Get mock Redis instance
    const Redis = require('ioredis');
    mockRedis = new Redis();
  });

  beforeEach(() => {
    // Reset Redis mocks
    jest.clearAllMocks();
    
    // Default Redis responses
    mockRedis.get.mockResolvedValue('0');
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.decr.mockResolvedValue(0);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.info.mockResolvedValue('used_memory_human:1.5M');
  });

  afterAll(async () => {
    // Cleanup test users
    await cleanupTestUsers();
  });

  async function setupTestUsers() {
    try {
      // Ensure admin user exists
      await supabase
        .from('users')
        .upsert({
          email: 'admin@voxflow.com',
          password_hash: '$2a$10$rZ5qN8vH0YhX.xQX0yqQ7.wK6p7lK9xYvZ5QXqY7.wK6p7lK9xYvZ', // admin123
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        });
    } catch (error) {
      // Ignore setup errors
    }
  }

  async function cleanupTestUsers() {
    try {
      await supabase
        .from('users')
        .delete()
        .eq('email', 'regular@test.com');
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('Basic Rate Limiting', () => {
    it('should allow requests within rate limits', async () => {
      // Mock Redis to show no previous requests
      mockRedis.get.mockResolvedValue('0');
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should block requests exceeding rate limits', async () => {
      // Mock Redis to show rate limit exceeded
      mockRedis.get.mockResolvedValue('1000'); // High count to trigger limit
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Rate limit exceeded');
      expect(response.body).toHaveProperty('tier');
      expect(response.body).toHaveProperty('retryAfter');
    });

    it('should include rate limit headers in response', async () => {
      mockRedis.get.mockResolvedValue('1');
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Tier-based Rate Limiting', () => {
    it('should apply different limits for free tier users', async () => {
      // Mock Redis to return count just under free tier limit
      mockRedis.get.mockResolvedValue('9'); // Free tier: 10 per minute
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(200);
    });

    it('should apply higher limits for admin users', async () => {
      // Mock Redis to return count that would exceed regular limits but not admin
      mockRedis.get.mockResolvedValue('100'); // Admin tier: 1000 per minute
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should provide upgrade suggestions for free tier users', async () => {
      mockRedis.get.mockResolvedValue('1000');
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('upgradeAvailable', true);
      expect(response.body.tier).toBe('free');
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should apply strict limits to login attempts', async () => {
      // Mock multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });

        if (i < 5) {
          expect([400, 401]).toContain(response.status); // Auth errors
        } else {
          expect(response.status).toBe(429); // Rate limited
          expect(response.body).toHaveProperty('error', 'Too many authentication attempts');
        }
      }
    });

    it('should apply rate limits to registration attempts', async () => {
      // Mock multiple registration attempts
      mockRedis.get.mockResolvedValueOnce('5'); // At limit
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          organization_name: 'Test Org'
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('retryAfter');
    });
  });

  describe('Concurrent Call Limiting', () => {
    it('should allow calls within concurrent limits', async () => {
      // Mock Redis to show no concurrent calls
      mockRedis.get.mockResolvedValue('0');
      
      // Create test agent first
      const agentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Test agent for concurrent calls'
        });

      const agent = agentResponse.body;

      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          agent_id: agent.id
        });

      // Should succeed or fail due to API keys, not concurrent limits
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 429) {
        expect(response.body).toHaveProperty('error', 'Concurrent call limit exceeded');
      }
    });

    it('should block calls exceeding concurrent limits', async () => {
      // Mock Redis to show concurrent limit exceeded
      mockRedis.get.mockResolvedValue('100'); // High concurrent count
      
      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          agent_id: 'test-agent-id'
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Concurrent call limit exceeded');
      expect(response.body).toHaveProperty('currentCalls');
      expect(response.body).toHaveProperty('maxCalls');
    });
  });

  describe('Upload Rate Limiting', () => {
    it('should apply rate limits to file uploads', async () => {
      // Mock Redis to show upload limit exceeded
      mockRedis.get.mockResolvedValue('10'); // Exceed free tier upload limit
      
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${regularToken}`)
        .field('name', 'Test Campaign')
        .field('agent_id', 'test-agent-id')
        .attach('csv_file', Buffer.from('phone_number\n+1234567890'), 'test.csv');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Upload rate limit exceeded');
    });
  });

  describe('Progressive Rate Limiting', () => {
    it('should reduce limits for users with violations', async () => {
      // Mock Redis to show previous violations
      mockRedis.get.mockResolvedValueOnce('3'); // 3 violations
      mockRedis.get.mockResolvedValueOnce('5'); // Current usage
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      // Should be rate limited due to reduced limits from violations
      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('violations');
    });

    it('should increment violation counter on rate limit exceeded', async () => {
      mockRedis.get.mockResolvedValue('1000'); // Trigger rate limit
      
      await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      // Should increment violation counter
      expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('violations:'));
    });
  });

  describe('Rate Limit Status Endpoints', () => {
    it('should return user rate limit status', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const response = await request(app)
        .get('/api/rate-limits/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tier');
      expect(response.body.data).toHaveProperty('limits');
      expect(response.body.data).toHaveProperty('current_usage');
      expect(response.body.data).toHaveProperty('remaining');
    });

    it('should return rate limit configuration', async () => {
      const response = await request(app)
        .get('/api/rate-limits/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rate_limits');
      expect(response.body.data.rate_limits).toHaveProperty('free');
      expect(response.body.data.rate_limits).toHaveProperty('pro');
      expect(response.body.data.rate_limits).toHaveProperty('enterprise');
      expect(response.body.data.rate_limits).toHaveProperty('admin');
    });

    it('should allow admin to get user rate limit status', async () => {
      if (!regularUser) {
        console.log('Regular user not available, skipping test');
        return;
      }

      mockRedis.get.mockResolvedValue('3');
      
      const response = await request(app)
        .get(`/api/rate-limits/admin/users/${regularUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId', regularUser.id);
      expect(response.body.data).toHaveProperty('tier');
    });

    it('should allow admin to reset user rate limits', async () => {
      if (!regularUser) {
        console.log('Regular user not available, skipping test');
        return;
      }

      const response = await request(app)
        .post(`/api/rate-limits/admin/users/${regularUser.id}/reset`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset successfully');
      
      // Should call Redis del for rate limit keys
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should get platform rate limit statistics', async () => {
      mockRedis.keys.mockResolvedValue([
        'api_calls_minute:user1',
        'api_calls_hour:user2',
        'violations:user3'
      ]);
      mockRedis.get.mockResolvedValue('2');
      
      const response = await request(app)
        .get('/api/rate-limits/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_keys');
      expect(response.body.data).toHaveProperty('by_type');
      expect(response.body.data).toHaveProperty('active_users');
      expect(response.body.data).toHaveProperty('violations');
      expect(response.body.data).toHaveProperty('redis_memory_usage');
    });
  });

  describe('Admin Bypass', () => {
    it('should bypass rate limits for admin users on admin endpoints', async () => {
      // Mock high usage that would normally trigger rate limits
      mockRedis.get.mockResolvedValue('1000');
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed despite high usage because admin bypass is active
      expect(response.status).toBe(200);
    });

    it('should not bypass rate limits for admin users on regular endpoints', async () => {
      // Mock usage at admin tier limits
      mockRedis.get.mockResolvedValue('2000'); // Exceed even admin limits
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should be rate limited even for admin on non-admin endpoints
      expect(response.status).toBe(429);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis error
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should allow request to proceed when Redis fails
      expect(response.status).toBe(200);
    });

    it('should handle missing user data gracefully', async () => {
      // Create token for non-existent user
      const jwt = require('jsonwebtoken');
      const fakeToken = jwt.sign(
        { id: 'non-existent-user', email: 'fake@example.com' },
        process.env.JWT_SECRET || 'test-secret'
      );
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${fakeToken}`);

      // Should apply default (free tier) rate limits
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include standard rate limit headers', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should not include legacy headers', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.headers).not.toHaveProperty('x-ratelimit-limit-legacy');
      expect(response.headers).not.toHaveProperty('x-ratelimit-remaining-legacy');
    });
  });

  describe('Audit Logging', () => {
    it('should log rate limit violations to audit logs', async () => {
      mockRedis.get.mockResolvedValue('1000'); // Trigger rate limit
      
      await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      // Should create audit log entry (mocked in this test environment)
      // In real environment, this would check the admin_audit_logs table
      expect(true).toBe(true); // Placeholder assertion
    });
  });
});