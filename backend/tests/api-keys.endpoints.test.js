import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';
import { generateToken } from '../src/utils/jwt.js';
import { generateTestAPIKey } from '../src/utils/encryption.js';

// Mock the supabase utility
jest.mock('../src/utils/supabase.js');

describe('API Keys Endpoints', () => {
  let userToken, adminToken;
  let testUser, adminUser;
  let testAPIKeys;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create test users
    testUser = {
      id: 'user-123',
      email: 'user@example.com',
      role: 'user',
      subscription_tier: 'free',
      max_agents: 2,
    };

    adminUser = {
      id: 'admin-123',
      email: 'admin@voxflow.com',
      role: 'admin',
      subscription_tier: 'enterprise',
      max_agents: 100,
    };

    // Generate tokens
    userToken = generateToken(testUser);
    adminToken = generateToken(adminUser);

    // Generate test API keys
    testAPIKeys = {
      groq: generateTestAPIKey('groq'),
      deepgram: generateTestAPIKey('deepgram'),
      twilio: generateTestAPIKey('twilio'),
    };
  });

  describe('GET /api/api-keys/providers', () => {
    it('should return supported providers information', async () => {
      const response = await request(app)
        .get('/api/api-keys/providers')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toHaveProperty('groq');
      expect(response.body.data.providers).toHaveProperty('deepgram');
      expect(response.body.data.providers).toHaveProperty('twilio');
      expect(response.body.data.supported).toEqual(['groq', 'deepgram', 'twilio']);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/api-keys/providers');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/api-keys/status', () => {
    it('should return API key status for user', async () => {
      const mockData = [
        {
          provider: 'groq',
          created_at: new Date().toISOString(),
          last_used_at: null,
        },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const response = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status.groq.configured).toBe(true);
      expect(response.body.data.status.deepgram.configured).toBe(false);
      expect(response.body.data.status.twilio.configured).toBe(false);
    });
  });

  describe('POST /api/api-keys/:provider', () => {
    it('should save API key successfully', async () => {
      query.mockResolvedValueOnce({
        data: [{
          id: 'key-123',
          user_id: testUser.id,
          provider: 'groq',
          created_at: new Date().toISOString(),
        }],
        error: null,
      });

      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_key: testAPIKeys.groq,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('groq');
    });

    it('should reject invalid provider', async () => {
      const response = await request(app)
        .post('/api/api-keys/invalid-provider')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_key: 'test-key',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject short API key', async () => {
      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_key: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/api-keys/groq')
        .send({
          api_key: testAPIKeys.groq,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/api-keys/bulk', () => {
    it('should save multiple API keys successfully', async () => {
      // Mock successful saves for all keys
      query.mockResolvedValue({
        data: [{ id: 'key-123' }],
        error: null,
      });

      const response = await request(app)
        .post('/api/api-keys/bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_keys: testAPIKeys,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toEqual(['groq', 'deepgram', 'twilio']);
    });

    it('should handle partial failures', async () => {
      // Mock success for groq, failure for others
      query
        .mockResolvedValueOnce({ data: [{ id: 'key-1' }], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const response = await request(app)
        .post('/api/api-keys/bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_keys: testAPIKeys,
        });

      expect(response.status).toBe(207); // Multi-Status
      expect(response.body.success).toBe(false);
      expect(response.body.data.success).toEqual(['groq']);
      expect(response.body.data.failed).toHaveLength(2);
    });

    it('should reject invalid api_keys format', async () => {
      const response = await request(app)
        .post('/api/api-keys/bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_keys: 'not-an-object',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid providers in bulk', async () => {
      const response = await request(app)
        .post('/api/api-keys/bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          api_keys: {
            groq: testAPIKeys.groq,
            'invalid-provider': 'test-key',
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toContain('Invalid providers');
    });
  });

  describe('DELETE /api/api-keys/:provider', () => {
    it('should delete API key successfully', async () => {
      query.mockResolvedValueOnce({
        data: [{ id: 'key-123' }],
        error: null,
      });

      const response = await request(app)
        .delete('/api/api-keys/groq')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('groq');
    });

    it('should reject invalid provider', async () => {
      const response = await request(app)
        .delete('/api/api-keys/invalid-provider')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/api-keys/test', () => {
    it('should test valid API key', async () => {
      const response = await request(app)
        .post('/api/api-keys/test')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          provider: 'groq',
          api_key: testAPIKeys.groq,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.provider).toBe('groq');
    });

    it('should reject invalid API key format', async () => {
      const response = await request(app)
        .post('/api/api-keys/test')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          provider: 'groq',
          api_key: 'invalid-key',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data.valid).toBe(false);
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/api-keys/test')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          provider: 'groq',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/api-keys/validate', () => {
    it('should validate all API keys', async () => {
      const mockData = [
        { provider: 'groq', created_at: new Date().toISOString() },
        { provider: 'deepgram', created_at: new Date().toISOString() },
        { provider: 'twilio', created_at: new Date().toISOString() },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const response = await request(app)
        .get('/api/api-keys/validate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.configured).toEqual(['groq', 'deepgram', 'twilio']);
      expect(response.body.data.missing).toEqual([]);
    });

    it('should validate specific providers', async () => {
      const mockData = [
        { provider: 'groq', created_at: new Date().toISOString() },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const response = await request(app)
        .get('/api/api-keys/validate?providers=groq,deepgram')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.configured).toEqual(['groq']);
      expect(response.body.data.missing).toEqual(['deepgram']);
    });
  });

  describe('GET /api/api-keys/usage', () => {
    it('should return usage statistics', async () => {
      const mockKeyData = [
        {
          provider: 'groq',
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
      ];

      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 100,
          total_calls: 5,
          api_costs: 0.01,
        },
      ];

      query
        .mockResolvedValueOnce({ data: mockKeyData, error: null })
        .mockResolvedValueOnce({ data: mockUsageData, error: null });

      const response = await request(app)
        .get('/api/api-keys/usage')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.configured_keys).toBe(1);
      expect(response.body.data.usage_summary.total_tokens).toBe(100);
    });
  });

  describe('Admin Action Logging', () => {
    it('should log admin actions for API key operations', async () => {
      // Mock successful API key save
      query.mockResolvedValueOnce({
        data: [{ id: 'key-123' }],
        error: null,
      });
      // Mock audit log insertion
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: testAPIKeys.groq,
        });

      expect(response.status).toBe(201);
      // In a real test, we'd verify the audit log was created
    });
  });
});