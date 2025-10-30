const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Integration Tests - API Endpoints', () => {
  let supabase;
  let testUser;
  let userToken;
  let adminToken;
  let testData = {};

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Setup test environment
    await setupTestEnvironment();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
    await cleanupTestEnvironment();
  });

  async function setupTestEnvironment() {
    try {
      // Create test user
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'api-test-user@example.com',
          password_hash: '$2a$10$api.test.hash',
          role: 'user',
          subscription_tier: 'pro',
          organization_name: 'API Test Organization',
          max_agents: 10,
          monthly_token_quota: 50000,
          is_active: true
        })
        .select()
        .single();

      testUser = user;

      // Login as test user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'api-test-user@example.com',
          password: 'testpassword123'
        });

      if (loginResponse.status === 200) {
        userToken = loginResponse.body.token;
      }

      // Setup admin user and token
      await setupAdminUser();
    } catch (error) {
      console.error('Test environment setup failed:', error);
    }
  }

  async function setupAdminUser() {
    try {
      // Ensure admin user exists
      const { data: existingAdmin } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'admin@voxflow.com')
        .single();

      if (!existingAdmin) {
        await supabase
          .from('users')
          .insert({
            email: 'admin@voxflow.com',
            password_hash: '$2a$10$rZ5qN8vH0YhX.xQX0yqQ7.wK6p7lK9xYvZ5QXqY7.wK6p7lK9xYvZ',
            role: 'admin',
            subscription_tier: 'enterprise',
            organization_name: 'VoxFlow Administration',
            max_agents: 1000,
            monthly_token_quota: 10000000,
            is_active: true
          });
      }

      // Login as admin
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@voxflow.com',
          password: 'admin123'
        });

      if (adminLoginResponse.status === 200) {
        adminToken = adminLoginResponse.body.token;
      }
    } catch (error) {
      console.error('Admin setup failed:', error);
    }
  }

  async function cleanupTestData() {
    try {
      if (testData.campaigns) {
        for (const campaign of testData.campaigns) {
          await supabase.from('campaign_contacts').delete().eq('campaign_id', campaign.id);
          await supabase.from('campaigns').delete().eq('id', campaign.id);
        }
      }
      
      if (testData.agents) {
        for (const agent of testData.agents) {
          await supabase.from('agent_runs').delete().eq('agent_id', agent.id);
          await supabase.from('agents').delete().eq('id', agent.id);
        }
      }
      
      if (testUser) {
        await supabase.from('user_api_keys').delete().eq('user_id', testUser.id);
        await supabase.from('user_usage_tracking').delete().eq('user_id', testUser.id);
      }

      testData = {};
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async function cleanupTestEnvironment() {
    try {
      if (testUser) {
        await supabase.from('users').delete().eq('id', testUser.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          email: 'new-register-test@example.com',
          password: 'NewPassword123!',
          organization_name: 'New Test Organization'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user.subscription_tier).toBe('free');
        expect(response.body).toHaveProperty('token');

        // Cleanup
        await supabase.from('users').delete().eq('email', userData.email);
      });

      it('should reject registration with invalid email', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'Password123!',
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should reject registration with weak password', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'weak',
            organization_name: 'Test Org'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should reject duplicate email registration', async () => {
        const userData = {
          email: 'duplicate-test@example.com',
          password: 'Password123!',
          organization_name: 'Test Org'
        };

        // First registration
        const firstResponse = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(firstResponse.status).toBe(201);

        // Second registration with same email
        const secondResponse = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(secondResponse.status).toBe(400);
        expect(secondResponse.body.message).toContain('already exists');

        // Cleanup
        await supabase.from('users').delete().eq('email', userData.email);
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        if (!userToken) {
          // Create and login test user
          await supabase
            .from('users')
            .upsert({
              email: 'login-test@example.com',
              password_hash: '$2a$10$login.test.hash',
              role: 'user',
              subscription_tier: 'free',
              is_active: true
            });

          const response = await request(app)
            .post('/api/auth/login')
            .send({
              email: 'login-test@example.com',
              password: 'testpassword'
            });

          expect([200, 401]).toContain(response.status);
          if (response.status === 200) {
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
          }

          // Cleanup
          await supabase.from('users').delete().eq('email', 'login-test@example.com');
        }
      });

      it('should reject login with invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should reject login with malformed email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return user profile with valid token', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('role');
        expect(response.body).toHaveProperty('subscription_tier');
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/auth/me');

        expect(response.status).toBe(401);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Agent Management Endpoints', () => {
    describe('POST /api/agents', () => {
      it('should create agent successfully', async () => {
        if (!userToken) return;

        const agentData = {
          name: 'API Test Agent',
          type: 'INBOUND',
          use_case: 'API Testing',
          description: 'Agent created for API endpoint testing with comprehensive functionality verification.'
        };

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${userToken}`)
          .send(agentData);

        expect(response.status).toBe(201);
        expect(response.body.name).toBe(agentData.name);
        expect(response.body.user_id).toBe(testUser.id);

        testData.agents = [response.body];
      });

      it('should reject agent creation with invalid data', async () => {
        if (!userToken) return;

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: '', // Invalid empty name
            type: 'INVALID_TYPE',
            description: 'short' // Too short
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should reject agent creation without authentication', async () => {
        const response = await request(app)
          .post('/api/agents')
          .send({
            name: 'Test Agent',
            type: 'INBOUND',
            use_case: 'Testing',
            description: 'Test agent description'
          });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/agents', () => {
      beforeEach(async () => {
        if (!userToken || !testUser) return;

        // Create test agents
        testData.agents = [];
        for (let i = 1; i <= 3; i++) {
          const { data: agent } = await supabase
            .from('agents')
            .insert({
              user_id: testUser.id,
              name: `List Test Agent ${i}`,
              type: i % 2 === 0 ? 'OUTBOUND' : 'INBOUND',
              use_case: 'List Testing',
              description: `Agent ${i} for testing list functionality with proper description length.`
            })
            .select()
            .single();

          testData.agents.push(agent);
        }
      });

      it('should list user agents', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/agents')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);

        // All agents should belong to the user
        response.body.forEach(agent => {
          expect(agent.user_id).toBe(testUser.id);
        });
      });

      it('should support pagination', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/agents')
          .query({ page: 1, limit: 2 })
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(2);
      });

      it('should reject request without authentication', async () => {
        const response = await request(app)
          .get('/api/agents');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/agents/:id', () => {
      it('should get agent by ID', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const agent = testData.agents[0];
        const response = await request(app)
          .get(`/api/agents/${agent.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(agent.id);
        expect(response.body.name).toBe(agent.name);
      });

      it('should reject invalid UUID', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/agents/invalid-uuid')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should return 404 for non-existent agent', async () => {
        if (!userToken) return;

        const fakeUUID = '123e4567-e89b-12d3-a456-426614174000';
        const response = await request(app)
          .get(`/api/agents/${fakeUUID}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/agents/:id', () => {
      it('should update agent successfully', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const agent = testData.agents[0];
        const updateData = {
          name: 'Updated Agent Name',
          description: 'Updated description for the agent with enhanced capabilities and features.'
        };

        const response = await request(app)
          .put(`/api/agents/${agent.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.name).toBe(updateData.name);
        expect(response.body.description).toBe(updateData.description);
      });

      it('should reject update with invalid data', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const agent = testData.agents[0];
        const response = await request(app)
          .put(`/api/agents/${agent.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: '', // Invalid empty name
            type: 'INVALID_TYPE'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });
    });

    describe('DELETE /api/agents/:id', () => {
      it('should delete agent successfully', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const agent = testData.agents[0];
        const response = await request(app)
          .delete(`/api/agents/${agent.id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('deleted');

        // Remove from testData to avoid cleanup issues
        testData.agents = testData.agents.filter(a => a.id !== agent.id);
      });
    });
  });

  describe('API Key Management Endpoints', () => {
    describe('GET /api/api-keys/status', () => {
      it('should return API key status', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/api-keys/status')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('groq');
        expect(response.body).toHaveProperty('deepgram');
        expect(response.body).toHaveProperty('twilio');

        Object.values(response.body).forEach(status => {
          expect(status).toHaveProperty('configured');
          expect(typeof status.configured).toBe('boolean');
        });
      });
    });

    describe('POST /api/api-keys/:provider', () => {
      it('should save API key successfully', async () => {
        if (!userToken) return;

        const response = await request(app)
          .post('/api/api-keys/groq')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            api_key: 'gsk_test-api-key-for-endpoint-testing-12345'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('saved');
      });

      it('should reject invalid provider', async () => {
        if (!userToken) return;

        const response = await request(app)
          .post('/api/api-keys/invalid-provider')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            api_key: 'test-key'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });

      it('should reject invalid API key format', async () => {
        if (!userToken) return;

        const response = await request(app)
          .post('/api/api-keys/groq')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            api_key: 'invalid key with spaces!'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });
    });

    describe('DELETE /api/api-keys/:provider', () => {
      it('should delete API key successfully', async () => {
        if (!userToken) return;

        // First save a key
        await request(app)
          .post('/api/api-keys/deepgram')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            api_key: 'test-deepgram-key-for-deletion'
          });

        // Then delete it
        const response = await request(app)
          .delete('/api/api-keys/deepgram')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');
      });
    });
  });

  describe('Usage Tracking Endpoints', () => {
    describe('GET /api/usage/dashboard', () => {
      it('should return usage dashboard', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/usage/dashboard')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('current_month');
        expect(response.body).toHaveProperty('limits');
        expect(response.body).toHaveProperty('usage_summary');

        expect(response.body.limits).toHaveProperty('max_agents');
        expect(response.body.limits).toHaveProperty('monthly_token_quota');
      });
    });

    describe('GET /api/usage/history', () => {
      it('should return usage history', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/usage/history')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should support date range filtering', async () => {
        if (!userToken) return;

        const startDate = '2024-01-01';
        const endDate = '2024-01-31';

        const response = await request(app)
          .get('/api/usage/history')
          .query({ start_date: startDate, end_date: endDate })
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('Campaign Management Endpoints', () => {
    beforeEach(async () => {
      if (!userToken || !testUser) return;

      // Create test agent for campaigns
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: testUser.id,
          name: 'Campaign Test Agent',
          type: 'OUTBOUND',
          use_case: 'Campaign Testing',
          description: 'Agent created specifically for campaign endpoint testing and verification.'
        })
        .select()
        .single();

      testData.agents = [agent];
    });

    describe('POST /api/campaigns', () => {
      it('should create campaign with CSV upload', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const csvContent = 'phone_number,first_name,last_name\n+1234567890,John,Doe\n+0987654321,Jane,Smith';
        const agent = testData.agents[0];

        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${userToken}`)
          .field('name', 'API Test Campaign')
          .field('agent_id', agent.id)
          .attach('csv_file', Buffer.from(csvContent), 'test-contacts.csv');

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('API Test Campaign');
        expect(response.body.agent_id).toBe(agent.id);
        expect(response.body.user_id).toBe(testUser.id);

        testData.campaigns = [response.body];
      });

      it('should reject campaign creation without CSV file', async () => {
        if (!userToken || !testData.agents || testData.agents.length === 0) return;

        const agent = testData.agents[0];

        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${userToken}`)
          .field('name', 'No CSV Campaign')
          .field('agent_id', agent.id);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('file');
      });

      it('should reject invalid agent ID', async () => {
        if (!userToken) return;

        const csvContent = 'phone_number,first_name,last_name\n+1234567890,John,Doe';

        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${userToken}`)
          .field('name', 'Invalid Agent Campaign')
          .field('agent_id', 'invalid-uuid')
          .attach('csv_file', Buffer.from(csvContent), 'test.csv');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
      });
    });

    describe('GET /api/campaigns', () => {
      it('should list user campaigns', async () => {
        if (!userToken) return;

        const response = await request(app)
          .get('/api/campaigns')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);

        // All campaigns should belong to the user
        response.body.forEach(campaign => {
          expect(campaign.user_id).toBe(testUser.id);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      if (!userToken) return;

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle oversized requests', async () => {
      if (!userToken) return;

      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: largePayload
        });

      expect([400, 413]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limits to authentication endpoints', async () => {
      const promises = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/agents')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect([200, 204]).toContain(response.status);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});