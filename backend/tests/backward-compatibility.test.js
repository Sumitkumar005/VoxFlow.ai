const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Backward Compatibility Tests', () => {
  let supabase;
  let adminToken;
  let adminUser;
  let testAgent;
  let testCampaign;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Create admin user if not exists
    await setupAdminUser();
    
    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@voxflow.com',
        password: 'admin123'
      });

    if (loginResponse.status === 200) {
      adminToken = loginResponse.body.token;
      adminUser = loginResponse.body.user;
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  async function setupAdminUser() {
    try {
      // Check if admin user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'admin@voxflow.com')
        .single();

      if (!existingUser) {
        // Create admin user
        await supabase
          .from('users')
          .insert({
            email: 'admin@voxflow.com',
            password_hash: '$2a$10$rZ5qN8vH0YhX.xQX0yqQ7.wK6p7lK9xYvZ5QXqY7.wK6p7lK9xYvZ', // admin123
            role: 'admin',
            subscription_tier: 'enterprise',
            organization_name: 'VoxFlow Administration',
            max_agents: 1000,
            monthly_token_quota: 10000000,
            is_active: true
          });
      }
    } catch (error) {
      // Ignore setup errors
    }
  }

  async function cleanupTestData() {
    try {
      if (testCampaign) {
        await supabase.from('campaigns').delete().eq('id', testCampaign.id);
        testCampaign = null;
      }
      if (testAgent) {
        await supabase.from('agents').delete().eq('id', testAgent.id);
        testAgent = null;
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('Authentication Endpoints', () => {
    it('should maintain login functionality with new schema', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@voxflow.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@voxflow.com');
      
      // Verify new fields are included in response
      expect(response.body.user).toHaveProperty('role');
      expect(response.body.user).toHaveProperty('subscription_tier');
    });

    it('should return user profile with new fields', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('subscription_tier');
      expect(response.body).toHaveProperty('max_agents');
      expect(response.body).toHaveProperty('monthly_token_quota');
    });

    it('should handle registration with new fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          organization_name: 'Test Organization'
        });

      // Clean up test user
      if (response.status === 201) {
        await supabase
          .from('users')
          .delete()
          .eq('email', 'test@example.com');
      }

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('user');
      expect(response.body.user.subscription_tier).toBe('free');
    });
  });

  describe('Agent Management Endpoints', () => {
    it('should create agents with user ownership', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Customer Support',
          description: 'Test agent for backward compatibility'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.user_id).toBe(adminUser.id);
      
      testAgent = response.body;
    });

    it('should list only user-owned agents', async () => {
      // Create test agent first
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: adminUser.id,
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Test agent'
        })
        .select()
        .single();

      testAgent = agent;

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // All agents should belong to the authenticated user
      response.body.forEach(agent => {
        expect(agent.user_id).toBe(adminUser.id);
      });
    });

    it('should get agent by ID with ownership check', async () => {
      // Create test agent first
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: adminUser.id,
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Sales',
          description: 'Test agent for ID retrieval'
        })
        .select()
        .single();

      testAgent = agent;

      const response = await request(app)
        .get(`/api/agents/${agent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(agent.id);
      expect(response.body.user_id).toBe(adminUser.id);
    });

    it('should update agent with ownership validation', async () => {
      // Create test agent first
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: adminUser.id,
          name: 'Original Agent',
          type: 'INBOUND',
          use_case: 'Support',
          description: 'Original description'
        })
        .select()
        .single();

      testAgent = agent;

      const response = await request(app)
        .put(`/api/agents/${agent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Agent',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Agent');
      expect(response.body.description).toBe('Updated description');
    });

    it('should delete agent with ownership validation', async () => {
      // Create test agent first
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: adminUser.id,
          name: 'Agent to Delete',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Agent for deletion test'
        })
        .select()
        .single();

      const response = await request(app)
        .delete(`/api/agents/${agent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('Campaign Management Endpoints', () => {
    beforeEach(async () => {
      // Create test agent for campaigns
      if (!testAgent) {
        const { data: agent } = await supabase
          .from('agents')
          .insert({
            user_id: adminUser.id,
            name: 'Campaign Test Agent',
            type: 'OUTBOUND',
            use_case: 'Sales',
            description: 'Agent for campaign testing'
          })
          .select()
          .single();

        testAgent = agent;
      }
    });

    it('should create campaigns with user ownership', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Campaign')
        .field('agent_id', testAgent.id)
        .attach('csv_file', Buffer.from('phone_number,first_name,last_name\n+1234567890,John,Doe'), 'test.csv');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.user_id).toBe(adminUser.id);
      expect(response.body.agent_id).toBe(testAgent.id);
      
      testCampaign = response.body;
    });

    it('should list only user-owned campaigns', async () => {
      // Create test campaign first
      const { data: campaign } = await supabase
        .from('campaigns')
        .insert({
          user_id: adminUser.id,
          name: 'Test Campaign',
          agent_id: testAgent.id,
          source_type: 'csv'
        })
        .select()
        .single();

      testCampaign = campaign;

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // All campaigns should belong to the authenticated user
      response.body.forEach(campaign => {
        expect(campaign.user_id).toBe(adminUser.id);
      });
    });

    it('should get campaign by ID with ownership check', async () => {
      // Create test campaign first
      const { data: campaign } = await supabase
        .from('campaigns')
        .insert({
          user_id: adminUser.id,
          name: 'Test Campaign',
          agent_id: testAgent.id,
          source_type: 'csv'
        })
        .select()
        .single();

      testCampaign = campaign;

      const response = await request(app)
        .get(`/api/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(campaign.id);
      expect(response.body.user_id).toBe(adminUser.id);
    });
  });

  describe('Call Management Endpoints', () => {
    beforeEach(async () => {
      // Create test agent for calls
      if (!testAgent) {
        const { data: agent } = await supabase
          .from('agents')
          .insert({
            user_id: adminUser.id,
            name: 'Call Test Agent',
            type: 'INBOUND',
            use_case: 'Support',
            description: 'Agent for call testing'
          })
          .select()
          .single();

        testAgent = agent;
      }
    });

    it('should start web call with user context', async () => {
      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          agent_id: testAgent.id
        });

      // Note: This might fail due to missing API keys, but should not fail due to schema issues
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 400 || response.status === 500) {
        // Should be API key related errors, not schema errors
        expect(response.body.message).toMatch(/(API key|configuration|provider)/i);
      }
    });

    it('should handle phone call initiation with user context', async () => {
      const response = await request(app)
        .post('/api/calls/phone/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          agent_id: testAgent.id,
          phone_number: '+1234567890'
        });

      // Note: This might fail due to missing API keys, but should not fail due to schema issues
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 400 || response.status === 500) {
        // Should be API key related errors, not schema errors
        expect(response.body.message).toMatch(/(API key|configuration|provider|phone)/i);
      }
    });
  });

  describe('Configuration Endpoints', () => {
    it('should get service config with user context', async () => {
      const response = await request(app)
        .get('/api/config/service')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('llm_provider');
      expect(response.body).toHaveProperty('tts_provider');
      expect(response.body).toHaveProperty('stt_provider');
    });

    it('should save service config with user association', async () => {
      const response = await request(app)
        .post('/api/config/service')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          llm_provider: 'groq',
          llm_model: 'llama-3.3-70b-versatile',
          tts_provider: 'deepgram',
          tts_voice: 'aura-2-helena-en',
          stt_provider: 'deepgram',
          stt_model: 'nova-3-general'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('saved');
    });

    it('should get telephony config with user context', async () => {
      const response = await request(app)
        .get('/api/config/telephony')
        .set('Authorization', `Bearer ${adminToken}`);

      // May return 404 if no config exists, which is acceptable
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('API Key Management Endpoints', () => {
    it('should get API key providers list', async () => {
      const response = await request(app)
        .get('/api/api-keys/providers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain('groq');
      expect(response.body).toContain('deepgram');
      expect(response.body).toContain('twilio');
    });

    it('should get API key status for user', async () => {
      const response = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('groq');
      expect(response.body).toHaveProperty('deepgram');
      expect(response.body).toHaveProperty('twilio');
    });

    it('should save API key for user', async () => {
      const response = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'test-groq-key-12345'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('saved');

      // Clean up
      await request(app)
        .delete('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should delete API key for user', async () => {
      // First save a key
      await request(app)
        .post('/api/api-keys/deepgram')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'test-deepgram-key-12345'
        });

      // Then delete it
      const response = await request(app)
        .delete('/api/api-keys/deepgram')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('Usage Tracking Endpoints', () => {
    it('should get usage dashboard for user', async () => {
      const response = await request(app)
        .get('/api/usage/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('current_month');
      expect(response.body).toHaveProperty('limits');
      expect(response.body).toHaveProperty('usage_summary');
    });

    it('should get usage history for user', async () => {
      const response = await request(app)
        .get('/api/usage/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Admin Panel Endpoints', () => {
    it('should get all users (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should get user details (admin only)', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('usage_stats');
    });

    it('should get all agents (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.agents)).toBe(true);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle missing API keys gracefully', async () => {
      // Try to start a call without API keys configured
      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          agent_id: testAgent?.id || 'non-existent-id'
        });

      // Should return a meaningful error, not a server crash
      expect([400, 404, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle non-existent agent access gracefully', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle unauthorized access to other users data', async () => {
      // Create a regular user
      const { data: regularUser } = await supabase
        .from('users')
        .insert({
          email: 'regular@example.com',
          password_hash: '$2a$10$test',
          role: 'user',
          subscription_tier: 'free'
        })
        .select()
        .single();

      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular@example.com',
          password: 'test123'
        });

      let regularToken = null;
      if (loginResponse.status === 200) {
        regularToken = loginResponse.body.token;
      }

      // Try to access admin's agent with regular user token
      if (regularToken && testAgent) {
        const response = await request(app)
          .get(`/api/agents/${testAgent.id}`)
          .set('Authorization', `Bearer ${regularToken}`);

        expect(response.status).toBe(404); // Should not find agent owned by different user
      }

      // Clean up regular user
      await supabase
        .from('users')
        .delete()
        .eq('id', regularUser.id);
    });
  });

  describe('Database Schema Compatibility', () => {
    it('should handle existing data with null user_id fields', async () => {
      // Create an agent with null user_id (simulating legacy data)
      const { data: legacyAgent } = await supabase
        .from('agents')
        .insert({
          user_id: null,
          name: 'Legacy Agent',
          type: 'INBOUND',
          use_case: 'Legacy',
          description: 'Legacy agent without user ownership'
        })
        .select()
        .single();

      // The system should handle this gracefully
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Legacy agent should not appear in user's agent list
      const userAgents = response.body.filter(agent => agent.id === legacyAgent.id);
      expect(userAgents).toHaveLength(0);

      // Clean up
      await supabase
        .from('agents')
        .delete()
        .eq('id', legacyAgent.id);
    });

    it('should handle users without new multi-tenant fields', async () => {
      // Create a user without new fields (simulating pre-migration data)
      const { data: legacyUser } = await supabase
        .from('users')
        .insert({
          email: 'legacy@example.com',
          password_hash: '$2a$10$test'
          // No role, subscription_tier, etc.
        })
        .select()
        .single();

      // System should handle login gracefully
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'legacy@example.com',
          password: 'test123'
        });

      // Should either work with defaults or provide meaningful error
      expect([200, 400, 401]).toContain(response.status);

      // Clean up
      await supabase
        .from('users')
        .delete()
        .eq('id', legacyUser.id);
    });
  });
});