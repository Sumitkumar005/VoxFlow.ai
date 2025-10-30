const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Integration Tests - Complete User Workflows', () => {
  let supabase;
  let testUsers = {};
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
    await cleanupTestUsers();
  });

  async function setupTestEnvironment() {
    // Create test users with different subscription tiers
    const testUserData = [
      {
        email: 'free-user@test.com',
        password: 'TestPassword123!',
        organization_name: 'Free Test Org',
        subscription_tier: 'free',
        max_agents: 2,
        monthly_token_quota: 1000
      },
      {
        email: 'pro-user@test.com',
        password: 'TestPassword123!',
        organization_name: 'Pro Test Org',
        subscription_tier: 'pro',
        max_agents: 10,
        monthly_token_quota: 50000
      },
      {
        email: 'enterprise-user@test.com',
        password: 'TestPassword123!',
        organization_name: 'Enterprise Test Org',
        subscription_tier: 'enterprise',
        max_agents: 100,
        monthly_token_quota: 1000000
      }
    ];

    for (const userData of testUserData) {
      try {
        // Create user in database
        const { data: user } = await supabase
          .from('users')
          .insert({
            email: userData.email,
            password_hash: '$2a$10$test.hash.for.integration.testing',
            role: 'user',
            subscription_tier: userData.subscription_tier,
            organization_name: userData.organization_name,
            max_agents: userData.max_agents,
            monthly_token_quota: userData.monthly_token_quota,
            is_active: true
          })
          .select()
          .single();

        testUsers[userData.subscription_tier] = {
          ...userData,
          id: user.id
        };
      } catch (error) {
        // User might already exist, try to get existing user
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', userData.email)
          .single();

        if (existingUser) {
          testUsers[userData.subscription_tier] = {
            ...userData,
            id: existingUser.id
          };
        }
      }
    }
  }

  async function cleanupTestData() {
    try {
      // Clean up in reverse dependency order
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
      
      if (testData.apiKeys) {
        for (const userId of Object.keys(testData.apiKeys)) {
          await supabase.from('user_api_keys').delete().eq('user_id', userId);
        }
      }
      
      if (testData.usage) {
        for (const userId of Object.keys(testData.usage)) {
          await supabase.from('user_usage_tracking').delete().eq('user_id', userId);
        }
      }

      testData = {};
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async function cleanupTestUsers() {
    try {
      for (const tier of Object.keys(testUsers)) {
        await supabase.from('users').delete().eq('id', testUsers[tier].id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async function loginUser(tier) {
    const user = testUsers[tier];
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: user.password
      });

    if (response.status === 200) {
      return {
        token: response.body.token,
        user: response.body.user
      };
    }
    throw new Error(`Failed to login ${tier} user: ${response.body.message}`);
  }

  describe('Complete User Registration and Setup Workflow', () => {
    it('should complete full user registration and initial setup', async () => {
      const newUserData = {
        email: 'new-user@test.com',
        password: 'NewUserPassword123!',
        organization_name: 'New User Organization'
      };

      // 1. Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(newUserData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe(newUserData.email);
      expect(registerResponse.body.user.subscription_tier).toBe('free');

      const newUserId = registerResponse.body.user.id;
      testData.newUser = { id: newUserId };

      // 2. Login with new user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: newUserData.email,
          password: newUserData.password
        });

      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.token;

      // 3. Get user profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.email).toBe(newUserData.email);
      expect(profileResponse.body.max_agents).toBe(2); // Free tier default

      // 4. Check initial API key status
      const apiKeyStatusResponse = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${token}`);

      expect(apiKeyStatusResponse.status).toBe(200);
      expect(apiKeyStatusResponse.body.groq.configured).toBe(false);
      expect(apiKeyStatusResponse.body.deepgram.configured).toBe(false);
      expect(apiKeyStatusResponse.body.twilio.configured).toBe(false);

      // 5. Configure API keys
      const apiKeyResponse = await request(app)
        .post('/api/api-keys/groq')
        .set('Authorization', `Bearer ${token}`)
        .send({
          api_key: 'gsk_test-integration-key-12345'
        });

      expect(apiKeyResponse.status).toBe(200);

      // 6. Verify API key was saved
      const updatedStatusResponse = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${token}`);

      expect(updatedStatusResponse.status).toBe(200);
      expect(updatedStatusResponse.body.groq.configured).toBe(true);

      // 7. Check initial usage dashboard
      const usageResponse = await request(app)
        .get('/api/usage/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.current_month.tokens_used).toBe(0);
      expect(usageResponse.body.limits.max_agents).toBe(2);

      // Cleanup
      await supabase.from('user_api_keys').delete().eq('user_id', newUserId);
      await supabase.from('users').delete().eq('id', newUserId);
    });
  });

  describe('Agent Management Workflow', () => {
    it('should complete full agent lifecycle for pro user', async () => {
      const { token, user } = await loginUser('pro');
      testData.agents = [];

      // 1. Create first agent
      const agent1Response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Customer Support Agent',
          type: 'INBOUND',
          use_case: 'Customer Support',
          description: 'This agent handles customer support inquiries with professional and helpful responses.'
        });

      expect(agent1Response.status).toBe(201);
      expect(agent1Response.body.user_id).toBe(user.id);
      testData.agents.push(agent1Response.body);

      // 2. Create second agent
      const agent2Response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sales Agent',
          type: 'OUTBOUND',
          use_case: 'Sales',
          description: 'This agent conducts sales calls and lead qualification with persuasive communication.'
        });

      expect(agent2Response.status).toBe(201);
      testData.agents.push(agent2Response.body);

      // 3. List all agents
      const listResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.length).toBeGreaterThanOrEqual(2);
      
      const agentIds = listResponse.body.map(a => a.id);
      expect(agentIds).toContain(agent1Response.body.id);
      expect(agentIds).toContain(agent2Response.body.id);

      // 4. Get specific agent
      const getAgentResponse = await request(app)
        .get(`/api/agents/${agent1Response.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getAgentResponse.status).toBe(200);
      expect(getAgentResponse.body.name).toBe('Customer Support Agent');

      // 5. Update agent
      const updateResponse = await request(app)
        .put(`/api/agents/${agent1Response.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Customer Support Agent',
          description: 'Updated description for the customer support agent with enhanced capabilities.'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated Customer Support Agent');

      // 6. Get agent run history (should be empty)
      const runsResponse = await request(app)
        .get(`/api/agents/${agent1Response.body.id}/runs`)
        .set('Authorization', `Bearer ${token}`);

      expect(runsResponse.status).toBe(200);
      expect(Array.isArray(runsResponse.body)).toBe(true);

      // 7. Delete one agent
      const deleteResponse = await request(app)
        .delete(`/api/agents/${agent2Response.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteResponse.status).toBe(200);

      // 8. Verify agent was deleted
      const finalListResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${token}`);

      expect(finalListResponse.status).toBe(200);
      const finalAgentIds = finalListResponse.body.map(a => a.id);
      expect(finalAgentIds).not.toContain(agent2Response.body.id);
      expect(finalAgentIds).toContain(agent1Response.body.id);

      // Update testData to reflect deletion
      testData.agents = testData.agents.filter(a => a.id !== agent2Response.body.id);
    });

    it('should enforce agent limits for free user', async () => {
      const { token } = await loginUser('free');
      testData.agents = [];

      // Create agents up to the limit (2 for free tier)
      for (let i = 1; i <= 2; i++) {
        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: `Free User Agent ${i}`,
            type: 'INBOUND',
            use_case: 'Testing',
            description: `Test agent ${i} for free user limit testing with sufficient description length.`
          });

        expect(response.status).toBe(201);
        testData.agents.push(response.body);
      }

      // Try to create one more agent (should fail)
      const limitResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Limit Exceeded Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'This agent should not be created due to limit restrictions.'
        });

      expect(limitResponse.status).toBe(400);
      expect(limitResponse.body.message).toMatch(/limit/i);
    });
  });

  describe('Campaign Management Workflow', () => {
    it('should complete full campaign lifecycle', async () => {
      const { token, user } = await loginUser('pro');
      testData.agents = [];
      testData.campaigns = [];

      // 1. Create agent for campaign
      const agentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Campaign Test Agent',
          type: 'OUTBOUND',
          use_case: 'Sales Campaign',
          description: 'Agent specifically created for testing campaign functionality with outbound calls.'
        });

      expect(agentResponse.status).toBe(201);
      testData.agents.push(agentResponse.body);

      // 2. Create campaign with CSV upload
      const csvContent = 'phone_number,first_name,last_name\n+1234567890,John,Doe\n+0987654321,Jane,Smith\n+1122334455,Bob,Johnson';
      
      const campaignResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Integration Test Campaign')
        .field('agent_id', agentResponse.body.id)
        .attach('csv_file', Buffer.from(csvContent), 'test-contacts.csv');

      expect(campaignResponse.status).toBe(201);
      expect(campaignResponse.body.user_id).toBe(user.id);
      expect(campaignResponse.body.agent_id).toBe(agentResponse.body.id);
      testData.campaigns.push(campaignResponse.body);

      // 3. List campaigns
      const listResponse = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body)).toBe(true);
      const campaignIds = listResponse.body.map(c => c.id);
      expect(campaignIds).toContain(campaignResponse.body.id);

      // 4. Get specific campaign
      const getCampaignResponse = await request(app)
        .get(`/api/campaigns/${campaignResponse.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getCampaignResponse.status).toBe(200);
      expect(getCampaignResponse.body.name).toBe('Integration Test Campaign');

      // 5. Start campaign
      const startResponse = await request(app)
        .post(`/api/campaigns/${campaignResponse.body.id}/start`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 400]).toContain(startResponse.status);
      // May fail due to missing API keys, but should not fail due to authorization

      // 6. Pause campaign
      const pauseResponse = await request(app)
        .post(`/api/campaigns/${campaignResponse.body.id}/pause`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 400]).toContain(pauseResponse.status);

      // 7. Stop campaign
      const stopResponse = await request(app)
        .post(`/api/campaigns/${campaignResponse.body.id}/stop`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 400]).toContain(stopResponse.status);
    });
  });

  describe('Multi-User Concurrent Operations', () => {
    it('should handle concurrent operations from different users', async () => {
      const freeUser = await loginUser('free');
      const proUser = await loginUser('pro');
      const enterpriseUser = await loginUser('enterprise');

      testData.agents = [];

      // Create agents concurrently from different users
      const agentPromises = [
        request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${freeUser.token}`)
          .send({
            name: 'Free User Concurrent Agent',
            type: 'INBOUND',
            use_case: 'Concurrent Testing',
            description: 'Agent created during concurrent testing for free user isolation verification.'
          }),
        
        request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({
            name: 'Pro User Concurrent Agent',
            type: 'OUTBOUND',
            use_case: 'Concurrent Testing',
            description: 'Agent created during concurrent testing for pro user isolation verification.'
          }),
        
        request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${enterpriseUser.token}`)
          .send({
            name: 'Enterprise User Concurrent Agent',
            type: 'INBOUND',
            use_case: 'Concurrent Testing',
            description: 'Agent created during concurrent testing for enterprise user isolation verification.'
          })
      ];

      const responses = await Promise.all(agentPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        testData.agents.push(response.body);
      });

      // Verify user isolation - each user should only see their own agents
      const freeUserAgents = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${freeUser.token}`);

      const proUserAgents = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${proUser.token}`);

      const enterpriseUserAgents = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${enterpriseUser.token}`);

      expect(freeUserAgents.status).toBe(200);
      expect(proUserAgents.status).toBe(200);
      expect(enterpriseUserAgents.status).toBe(200);

      // Each user should only see their own agents
      const freeAgentIds = freeUserAgents.body.map(a => a.id);
      const proAgentIds = proUserAgents.body.map(a => a.id);
      const enterpriseAgentIds = enterpriseUserAgents.body.map(a => a.id);

      expect(freeAgentIds).toContain(responses[0].body.id);
      expect(freeAgentIds).not.toContain(responses[1].body.id);
      expect(freeAgentIds).not.toContain(responses[2].body.id);

      expect(proAgentIds).toContain(responses[1].body.id);
      expect(proAgentIds).not.toContain(responses[0].body.id);
      expect(proAgentIds).not.toContain(responses[2].body.id);

      expect(enterpriseAgentIds).toContain(responses[2].body.id);
      expect(enterpriseAgentIds).not.toContain(responses[0].body.id);
      expect(enterpriseAgentIds).not.toContain(responses[1].body.id);
    });

    it('should handle concurrent API key operations', async () => {
      const proUser = await loginUser('pro');
      testData.apiKeys = {};
      testData.apiKeys[proUser.user.id] = true;

      // Configure multiple API keys concurrently
      const apiKeyPromises = [
        request(app)
          .post('/api/api-keys/groq')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({ api_key: 'gsk_concurrent-test-groq-key-12345' }),
        
        request(app)
          .post('/api/api-keys/deepgram')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({ api_key: 'concurrent-test-deepgram-key-67890' }),
        
        request(app)
          .post('/api/api-keys/twilio')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({ api_key: 'concurrent-test-twilio-key-abcdef' })
      ];

      const responses = await Promise.all(apiKeyPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify all keys were saved
      const statusResponse = await request(app)
        .get('/api/api-keys/status')
        .set('Authorization', `Bearer ${proUser.token}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.groq.configured).toBe(true);
      expect(statusResponse.body.deepgram.configured).toBe(true);
      expect(statusResponse.body.twilio.configured).toBe(true);
    });
  });

  describe('Usage Tracking Integration', () => {
    it('should track usage across multiple operations', async () => {
      const proUser = await loginUser('pro');
      testData.usage = {};
      testData.usage[proUser.user.id] = true;

      // Get initial usage
      const initialUsageResponse = await request(app)
        .get('/api/usage/dashboard')
        .set('Authorization', `Bearer ${proUser.token}`);

      expect(initialUsageResponse.status).toBe(200);
      const initialTokens = initialUsageResponse.body.current_month.tokens_used;

      // Simulate some usage by creating agents (which might trigger usage tracking)
      testData.agents = [];
      for (let i = 1; i <= 3; i++) {
        const agentResponse = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({
            name: `Usage Tracking Agent ${i}`,
            type: 'INBOUND',
            use_case: 'Usage Testing',
            description: `Agent ${i} created for usage tracking integration testing with comprehensive description.`
          });

        expect(agentResponse.status).toBe(201);
        testData.agents.push(agentResponse.body);
      }

      // Check usage history
      const historyResponse = await request(app)
        .get('/api/usage/history')
        .set('Authorization', `Bearer ${proUser.token}`);

      expect(historyResponse.status).toBe(200);
      expect(Array.isArray(historyResponse.body)).toBe(true);

      // Get updated usage dashboard
      const updatedUsageResponse = await request(app)
        .get('/api/usage/dashboard')
        .set('Authorization', `Bearer ${proUser.token}`);

      expect(updatedUsageResponse.status).toBe(200);
      expect(updatedUsageResponse.body.limits.max_agents).toBe(10); // Pro tier
      expect(updatedUsageResponse.body.current_month.agents_created).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid authentication gracefully', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBeDefined();
    });

    it('should handle cross-user access attempts', async () => {
      const freeUser = await loginUser('free');
      const proUser = await loginUser('pro');

      // Create agent as pro user
      const agentResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${proUser.token}`)
        .send({
          name: 'Pro User Private Agent',
          type: 'INBOUND',
          use_case: 'Privacy Testing',
          description: 'Agent that should not be accessible by other users for security testing.'
        });

      expect(agentResponse.status).toBe(201);
      testData.agents = [agentResponse.body];

      // Try to access as free user
      const accessResponse = await request(app)
        .get(`/api/agents/${agentResponse.body.id}`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(accessResponse.status).toBe(404); // Should not find agent
    });

    it('should handle malformed requests gracefully', async () => {
      const proUser = await loginUser('pro');

      // Malformed agent creation
      const malformedResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${proUser.token}`)
        .send({
          name: '', // Invalid empty name
          type: 'INVALID_TYPE', // Invalid type
          description: 'short' // Too short description
        });

      expect(malformedResponse.status).toBe(400);
      expect(malformedResponse.body.message).toBe('Validation failed');
    });

    it('should handle database constraint violations', async () => {
      const freeUser = await loginUser('free');

      // Try to create more agents than allowed
      testData.agents = [];
      
      // Create up to limit
      for (let i = 1; i <= 2; i++) {
        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${freeUser.token}`)
          .send({
            name: `Limit Test Agent ${i}`,
            type: 'INBOUND',
            use_case: 'Limit Testing',
            description: `Agent ${i} for testing user limits and constraint enforcement mechanisms.`
          });

        expect(response.status).toBe(201);
        testData.agents.push(response.body);
      }

      // Try to exceed limit
      const exceedResponse = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({
          name: 'Exceeding Limit Agent',
          type: 'INBOUND',
          use_case: 'Limit Testing',
          description: 'This agent creation should fail due to user limit constraints.'
        });

      expect(exceedResponse.status).toBe(400);
      expect(exceedResponse.body.message).toMatch(/limit/i);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle reasonable load efficiently', async () => {
      const proUser = await loginUser('pro');
      testData.agents = [];

      const startTime = Date.now();
      
      // Create multiple agents concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${proUser.token}`)
          .send({
            name: `Performance Test Agent ${i + 1}`,
            type: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
            use_case: 'Performance Testing',
            description: `Agent ${i + 1} created for performance testing to verify system scalability under load.`
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        testData.agents.push(response.body);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify all agents were created
      const listResponse = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${proUser.token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.length).toBeGreaterThanOrEqual(5);
    });
  });
});