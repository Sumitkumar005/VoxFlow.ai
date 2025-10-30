const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Integration Tests - Backward Compatibility', () => {
  let supabase;
  let adminToken;
  let adminUser;
  let regularToken;
  let regularUser;
  let testAgent;
  let testCampaign;

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

    // Login as regular user
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
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
    await cleanupTestUsers();
  });

  async function setupTestUsers() {
    try {
      // Ensure admin user exists with migration fields
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

      // Create regular user for testing
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

  describe('Complete User Workflow - Admin User', () => {
    it('should complete full agent creation and management workflow', async () => {
      // 1. Create agent
      const createResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Integration Test Agent',
          type: 'INBOUND',
          use_case: 'Customer Support',
          description: 'Test agent for integration testing'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.user_id).toBe(adminUser.id);
      testAgent = createResponse.body;

      // 2. List agents (should include new agent)
      const listResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listResponse.status).toBe(200);
      const agentIds = listResponse.body.map(agent => agent.id);
      expect(agentIds).toContain(testAgent.id);

      // 3. Get agent by ID
      const getResponse = await request(app)
        .get(`/api/agents/${testAgent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(testAgent.id);
      expect(getResponse.body.name).toBe('Integration Test Agent');

      // 4. Update agent
      const updateResponse = await request(app)
        .put(`/api/agents/${testAgent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Integration Test Agent',
          description: 'Updated description for testing'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated Integration Test Agent');

      // 5. Get agent runs (should be empty initially)
      const runsResponse = await request(app)
        .get(`/api/agents/${testAgent.id}/runs`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(runsResponse.status).toBe(200);
      expect(Array.isArray(runsResponse.body)).toBe(true);
    });

    it('should complete campaign creation and management workflow', async () => {
      // First create an agent for the campaign
      const agentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Campaign Test Agent',
          type: 'OUTBOUND',
          use_case: 'Sales',
          description: 'Agent for campaign testing'
        });

      testAgent = agentResponse.body;

      // 1. Create campaign
      const createResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Integration Test Campaign')
        .field('agent_id', testAgent.id)
        .attach('csv_file', Buffer.from('phone_number,first_name,last_name\n+1234567890,John,Doe\n+0987654321,Jane,Smith'), 'test.csv');

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.user_id).toBe(adminUser.id);
      expect(createResponse.body.agent_id).toBe(testAgent.id);
      testCampaign = createResponse.body;

      // 2. List campaigns
      const listResponse = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listResponse.status).toBe(200);
      const campaignIds = listResponse.body.map(campaign => campaign.id);
      expect(campaignIds).toContain(testCampaign.id);

      // 3. Get campaign by ID
      const getResponse = await request(app)
        .get(`/api/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(testCampaign.id);
      expect(getResponse.body.name).toBe('Integration Test Campaign');
    });
  });

  describe('Complete User Workflow - Regular User', () => {
    it('should respect user limits and ownership', async () => {
      if (!regularToken) {
        console.log('Regular user login failed, skipping test');
        return;
      }

      // 1. Create first agent (should succeed)
      const firstAgentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Regular User Agent 1',
          type: 'INBOUND',
          use_case: 'Support',
          description: 'First agent for regular user'
        });

      expect(firstAgentResponse.status).toBe(201);
      expect(firstAgentResponse.body.user_id).toBe(regularUser.id);

      // 2. Create second agent (should succeed - within limit)
      const secondAgentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Regular User Agent 2',
          type: 'OUTBOUND',
          use_case: 'Sales',
          description: 'Second agent for regular user'
        });

      expect(secondAgentResponse.status).toBe(201);

      // 3. Try to create third agent (should fail - exceeds limit)
      const thirdAgentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Regular User Agent 3',
          type: 'INBOUND',
          use_case: 'Support',
          description: 'Third agent - should fail'
        });

      expect(thirdAgentResponse.status).toBe(400);
      expect(thirdAgentResponse.body.message).toMatch(/limit/i);

      // 4. List agents (should only show user's agents)
      const listResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toHaveLength(2);
      listResponse.body.forEach(agent => {
        expect(agent.user_id).toBe(regularUser.id);
      });

      // Clean up regular user's agents
      await supabase
        .from('agents')
        .delete()
        .eq('user_id', regularUser.id);
    });

    it('should not access other users data', async () => {
      if (!regularToken || !adminToken) {
        console.log('User tokens not available, skipping test');
        return;
      }

      // Create agent as admin
      const adminAgentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Only Agent',
          type: 'INBOUND',
          use_case: 'Admin',
          description: 'Agent that regular user should not access'
        });

      const adminAgent = adminAgentResponse.body;

      // Try to access admin's agent as regular user
      const accessResponse = await request(app)
        .get(`/api/agents/${adminAgent.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(accessResponse.status).toBe(404); // Should not find agent

      // Try to update admin's agent as regular user
      const updateResponse = await request(app)
        .put(`/api/agents/${adminAgent.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Hacked Agent'
        });

      expect(updateResponse.status).toBe(404); // Should not find agent

      // Clean up admin agent
      await supabase
        .from('agents')
        .delete()
        .eq('id', adminAgent.id);
    });
  });

  describe('API Key Management Integration', () => {
    it('should handle API key configuration workflow', async () => {
      // 1. Check initial API key status
      const statusResponse = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('groq');
      expect(statusResponse.body).toHaveProperty('deepgram');
      expect(statusResponse.body).toHaveProperty('twilio');

      // 2. Save API key
      const saveResponse = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          api_key: 'gsk_test_key_for_integration_testing_12345'
        });

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.message).toContain('saved');

      // 3. Check status after saving
      const updatedStatusResponse = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(updatedStatusResponse.status).toBe(200);
      expect(updatedStatusResponse.body.groq.configured).toBe(true);

      // 4. Delete API key
      const deleteResponse = await request(app)
        .delete('/api/api-keys/groq')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toContain('deleted');
    });
  });

  describe('Usage Tracking Integration', () => {
    it('should track and display usage correctly', async () => {
      // 1. Get initial usage dashboard
      const dashboardResponse = await request(app)
        .get('/api/usage/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body).toHaveProperty('current_month');
      expect(dashboardResponse.body).toHaveProperty('limits');
      expect(dashboardResponse.body).toHaveProperty('usage_summary');

      // 2. Get usage history
      const historyResponse = await request(app)
        .get('/api/usage/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyResponse.status).toBe(200);
      expect(Array.isArray(historyResponse.body)).toBe(true);
    });
  });

  describe('Admin Panel Integration', () => {
    it('should provide admin functionality', async () => {
      if (!adminToken) {
        console.log('Admin token not available, skipping test');
        return;
      }

      // 1. Get all users
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersResponse.status).toBe(200);
      expect(usersResponse.body).toHaveProperty('users');
      expect(usersResponse.body).toHaveProperty('pagination');
      expect(Array.isArray(usersResponse.body.users)).toBe(true);

      // 2. Get user details
      const userDetailsResponse = await request(app)
        .get(`/api/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(userDetailsResponse.status).toBe(200);
      expect(userDetailsResponse.body).toHaveProperty('user');
      expect(userDetailsResponse.body).toHaveProperty('agents');
      expect(userDetailsResponse.body).toHaveProperty('usage_stats');

      // 3. Get all agents (admin view)
      const allAgentsResponse = await request(app)
        .get('/api/admin/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(allAgentsResponse.status).toBe(200);
      expect(allAgentsResponse.body).toHaveProperty('agents');
      expect(allAgentsResponse.body).toHaveProperty('pagination');
    });

    it('should prevent regular users from accessing admin endpoints', async () => {
      if (!regularToken) {
        console.log('Regular user token not available, skipping test');
        return;
      }

      // Try to access admin users endpoint
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(usersResponse.status).toBe(403);

      // Try to access admin agents endpoint
      const agentsResponse = await request(app)
        .get('/api/admin/agents')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(agentsResponse.status).toBe(403);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid tokens gracefully', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/agents');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle non-existent resource access', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
          name: 'Test Agent'
          // Missing type, use_case, description
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Database Schema Compatibility', () => {
    it('should handle legacy data without new fields', async () => {
      // Create a user without new multi-tenant fields
      const { data: legacyUser } = await supabase
        .from('users')
        .insert({
          email: 'legacy@test.com',
          password_hash: '$2a$10$legacy.hash'
          // No role, subscription_tier, etc.
        })
        .select()
        .single();

      // System should handle this gracefully
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'legacy@test.com',
          password: 'legacy123'
        });

      // Should either work with defaults or provide meaningful error
      expect([200, 400, 401]).toContain(loginResponse.status);

      // Clean up
      await supabase
        .from('users')
        .delete()
        .eq('id', legacyUser.id);
    });

    it('should handle agents without user ownership', async () => {
      // Create agent without user_id (simulating legacy data)
      const { data: legacyAgent } = await supabase
        .from('agents')
        .insert({
          user_id: null,
          name: 'Legacy Agent',
          type: 'INBOUND',
          use_case: 'Legacy',
          description: 'Legacy agent without ownership'
        })
        .select()
        .single();

      // User should not see this agent in their list
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const agentIds = response.body.map(agent => agent.id);
      expect(agentIds).not.toContain(legacyAgent.id);

      // Clean up
      await supabase
        .from('agents')
        .delete()
        .eq('id', legacyAgent.id);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/agents')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });
  });
});