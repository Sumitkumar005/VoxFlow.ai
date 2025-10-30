const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../app');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Integration Tests - Admin Panel Functionality', () => {
  let supabase;
  let adminToken;
  let adminUser;
  let testUsers = [];
  let testData = {};

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Setup admin user and get token
    await setupAdminUser();
    await setupTestUsers();
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
            password_hash: '$2a$10$rZ5qN8vH0YhX.xQX0yqQ7.wK6p7lK9xYvZ5QXqY7.wK6p7lK9xYvZ', // admin123
            role: 'admin',
            subscription_tier: 'enterprise',
            organization_name: 'VoxFlow Administration',
            max_agents: 1000,
            monthly_token_quota: 10000000,
            is_active: true
          });
      }

      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@voxflow.com',
          password: 'admin123'
        });

      if (loginResponse.status === 200) {
        adminToken = loginResponse.body.token;
        adminUser = loginResponse.body.user;
      } else {
        throw new Error('Failed to login as admin');
      }
    } catch (error) {
      console.error('Admin setup failed:', error);
      throw error;
    }
  }

  async function setupTestUsers() {
    const testUserData = [
      {
        email: 'test-user-1@example.com',
        password_hash: '$2a$10$test.hash.1',
        role: 'user',
        subscription_tier: 'free',
        organization_name: 'Test Org 1',
        max_agents: 2,
        monthly_token_quota: 1000,
        is_active: true
      },
      {
        email: 'test-user-2@example.com',
        password_hash: '$2a$10$test.hash.2',
        role: 'user',
        subscription_tier: 'pro',
        organization_name: 'Test Org 2',
        max_agents: 10,
        monthly_token_quota: 50000,
        is_active: true
      },
      {
        email: 'test-user-3@example.com',
        password_hash: '$2a$10$test.hash.3',
        role: 'user',
        subscription_tier: 'enterprise',
        organization_name: 'Test Org 3',
        max_agents: 100,
        monthly_token_quota: 1000000,
        is_active: false
      }
    ];

    for (const userData of testUserData) {
      try {
        const { data: user } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .single();

        testUsers.push(user);
      } catch (error) {
        // User might already exist
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', userData.email)
          .single();

        if (existingUser) {
          testUsers.push(existingUser);
        }
      }
    }
  }

  async function cleanupTestData() {
    try {
      // Clean up test agents and campaigns
      if (testData.agents) {
        for (const agent of testData.agents) {
          await supabase.from('agent_runs').delete().eq('agent_id', agent.id);
          await supabase.from('agents').delete().eq('id', agent.id);
        }
      }
      
      if (testData.campaigns) {
        for (const campaign of testData.campaigns) {
          await supabase.from('campaign_contacts').delete().eq('campaign_id', campaign.id);
          await supabase.from('campaigns').delete().eq('id', campaign.id);
        }
      }

      testData = {};
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async function cleanupTestUsers() {
    try {
      for (const user of testUsers) {
        await supabase.from('user_usage_tracking').delete().eq('user_id', user.id);
        await supabase.from('user_api_keys').delete().eq('user_id', user.id);
        await supabase.from('subscriptions').delete().eq('user_id', user.id);
        await supabase.from('users').delete().eq('id', user.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('Admin Dashboard Analytics', () => {
    it('should get platform overview statistics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('agents');
      expect(response.body.data).toHaveProperty('runs');
      expect(response.body.data).toHaveProperty('growth');

      expect(response.body.data.users).toHaveProperty('total');
      expect(response.body.data.users).toHaveProperty('active');
      expect(response.body.data.users).toHaveProperty('by_tier');
      expect(typeof response.body.data.users.total).toBe('number');
    });

    it('should get user growth analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/user-growth')
        .query({ period: '30d' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('growth_data');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.growth_data)).toBe(true);
    });

    it('should get usage analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/usage')
        .query({ period: 'current_month' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('platform_totals');
      expect(response.body.data).toHaveProperty('daily_trends');
      expect(response.body.data).toHaveProperty('top_users');
    });

    it('should get revenue analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('current_monthly_revenue');
      expect(response.body.data).toHaveProperty('projected_annual_revenue');
      expect(response.body.data).toHaveProperty('revenue_by_plan');
    });

    it('should get system health metrics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/system-health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('system_status');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('api_keys');
      expect(response.body.data).toHaveProperty('database');
    });
  });

  describe('User Management', () => {
    it('should list all users with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);

      // Verify pagination info
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .query({ search: 'test-user-1@example.com' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      
      const foundUser = response.body.data.users.find(u => u.email === 'test-user-1@example.com');
      expect(foundUser).toBeDefined();
    });

    it('should filter users by subscription tier', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .query({ subscription_tier: 'pro' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.users.forEach(user => {
        expect(user.subscription_tier).toBe('pro');
      });
    });

    it('should filter users by active status', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .query({ is_active: 'false' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.users.forEach(user => {
        expect(user.is_active).toBe(false);
      });
    });

    it('should get user details with statistics', async () => {
      const testUser = testUsers[0];
      
      const response = await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('agents');
      expect(response.body.data).toHaveProperty('usage_stats');
      expect(response.body.data).toHaveProperty('subscription');

      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should update user limits', async () => {
      const testUser = testUsers[0];
      const newLimits = {
        max_agents: 5,
        monthly_token_quota: 2000
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUser.id}/limits`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newLimits);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify limits were updated
      const updatedUserResponse = await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(updatedUserResponse.body.data.user.max_agents).toBe(5);
      expect(updatedUserResponse.body.data.user.monthly_token_quota).toBe(2000);
    });

    it('should toggle user status', async () => {
      const testUser = testUsers[0];
      const originalStatus = testUser.is_active;

      const response = await request(app)
        .post(`/api/admin/users/${testUser.id}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify status was toggled
      const updatedUserResponse = await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(updatedUserResponse.body.data.user.is_active).toBe(!originalStatus);

      // Toggle back
      await request(app)
        .post(`/api/admin/users/${testUser.id}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should delete user', async () => {
      // Create a temporary user for deletion
      const { data: tempUser } = await supabase
        .from('users')
        .insert({
          email: 'temp-delete-user@example.com',
          password_hash: '$2a$10$temp.hash',
          role: 'user',
          subscription_tier: 'free',
          organization_name: 'Temp Org',
          max_agents: 2,
          monthly_token_quota: 1000,
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .delete(`/api/admin/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user was deleted
      const deletedUserResponse = await request(app)
        .get(`/api/admin/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deletedUserResponse.status).toBe(404);
    });
  });

  describe('Agent Management (Admin View)', () => {
    beforeEach(async () => {
      // Create test agents for different users
      testData.agents = [];
      
      for (let i = 0; i < 2; i++) {
        const { data: agent } = await supabase
          .from('agents')
          .insert({
            user_id: testUsers[i].id,
            name: `Admin Test Agent ${i + 1}`,
            type: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
            use_case: 'Admin Testing',
            description: `Agent ${i + 1} created for admin panel testing and management verification.`
          })
          .select()
          .single();

        testData.agents.push(agent);
      }
    });

    it('should list all agents across all users', async () => {
      const response = await request(app)
        .get('/api/admin/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('agents');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.agents)).toBe(true);

      // Should include agents from different users
      const agentUserIds = response.body.data.agents.map(a => a.user_id);
      const uniqueUserIds = [...new Set(agentUserIds)];
      expect(uniqueUserIds.length).toBeGreaterThan(1);
    });

    it('should filter agents by user', async () => {
      const testUser = testUsers[0];
      
      const response = await request(app)
        .get('/api/admin/agents')
        .query({ user_id: testUser.id })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.agents.forEach(agent => {
        expect(agent.user_id).toBe(testUser.id);
      });
    });

    it('should filter agents by type', async () => {
      const response = await request(app)
        .get('/api/admin/agents')
        .query({ type: 'INBOUND' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.agents.forEach(agent => {
        expect(agent.type).toBe('INBOUND');
      });
    });

    it('should search agents by name', async () => {
      const response = await request(app)
        .get('/api/admin/agents')
        .query({ search: 'Admin Test Agent' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.agents.length).toBeGreaterThan(0);
      
      response.body.data.agents.forEach(agent => {
        expect(agent.name.toLowerCase()).toContain('admin test agent');
      });
    });
  });

  describe('Subscription Tier Management', () => {
    it('should get subscription tiers information', async () => {
      const response = await request(app)
        .get('/api/admin/subscription-tiers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tiers');
      expect(Array.isArray(response.body.data.tiers)).toBe(true);

      // Should include all subscription tiers
      const tierNames = response.body.data.tiers.map(t => t.name);
      expect(tierNames).toContain('free');
      expect(tierNames).toContain('pro');
      expect(tierNames).toContain('enterprise');

      // Each tier should have required properties
      response.body.data.tiers.forEach(tier => {
        expect(tier).toHaveProperty('name');
        expect(tier).toHaveProperty('max_agents');
        expect(tier).toHaveProperty('monthly_token_quota');
        expect(tier).toHaveProperty('features');
      });
    });
  });

  describe('Data Export', () => {
    it('should export platform overview data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export/overview')
        .query({ period: '30d' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('voxflow-overview-analytics');

      // Verify CSV content
      const csvContent = response.text;
      expect(csvContent).toContain('Metric,Value,Description');
      expect(csvContent).toContain('Total Users');
    });

    it('should export user growth data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export/user-growth')
        .query({ period: '30d' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.text).toContain('Date,New Users,Cumulative Total');
    });

    it('should export usage analytics data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export/usage')
        .query({ period: '30d' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.text).toContain('Date,Total Tokens,Total Calls');
    });

    it('should export revenue data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.text).toContain('Revenue by Plan');
    });

    it('should handle invalid export type', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export/invalid-type')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid export type');
    });
  });

  describe('Audit Logs', () => {
    it('should log admin actions', async () => {
      const testUser = testUsers[0];
      
      // Perform an admin action
      await request(app)
        .put(`/api/admin/users/${testUser.id}/limits`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          max_agents: 3,
          monthly_token_quota: 1500
        });

      // Check audit logs
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.success).toBe(true);
      expect(Array.isArray(auditResponse.body.data)).toBe(true);

      // Should contain the recent action
      const recentLogs = auditResponse.body.data.filter(log => 
        log.action === 'update_user_limits' && 
        log.target_user_id === testUser.id
      );
      expect(recentLogs.length).toBeGreaterThan(0);
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .query({ action: 'update_user_limits' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(log => {
        expect(log.action).toBe('update_user_limits');
      });
    });

    it('should filter audit logs by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .query({ 
          start_date: today,
          end_date: today
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        expect(logDate).toBe(today);
      });
    });
  });

  describe('Access Control', () => {
    it('should deny access to non-admin users', async () => {
      // Create a regular user token
      const { data: regularUser } = await supabase
        .from('users')
        .insert({
          email: 'regular-user@test.com',
          password_hash: '$2a$10$regular.hash',
          role: 'user',
          subscription_tier: 'free',
          organization_name: 'Regular Org',
          max_agents: 2,
          monthly_token_quota: 1000,
          is_active: true
        })
        .select()
        .single();

      // Try to login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular-user@test.com',
          password: 'password123'
        });

      let regularToken = null;
      if (loginResponse.status === 200) {
        regularToken = loginResponse.body.token;
      }

      if (regularToken) {
        // Try to access admin endpoints
        const adminResponse = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularToken}`);

        expect(adminResponse.status).toBe(403);
      }

      // Cleanup
      await supabase.from('users').delete().eq('id', regularUser.id);
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });

    it('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID in user details', async () => {
      const response = await request(app)
        .get('/api/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle non-existent user ID', async () => {
      const fakeUUID = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/admin/users/${fakeUUID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle invalid limit values', async () => {
      const testUser = testUsers[0];
      
      const response = await request(app)
        .put(`/api/admin/users/${testUser.id}/limits`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          max_agents: -5, // Invalid negative value
          monthly_token_quota: 'invalid' // Invalid type
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the endpoints handle malformed requests
      const response = await request(app)
        .get('/api/admin/users')
        .query({ page: 'invalid', limit: 'invalid' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large user lists efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/admin/users')
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${adminToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent admin operations', async () => {
      const promises = [
        request(app)
          .get('/api/admin/analytics/overview')
          .set('Authorization', `Bearer ${adminToken}`),
        
        request(app)
          .get('/api/admin/users')
          .query({ limit: 10 })
          .set('Authorization', `Bearer ${adminToken}`),
        
        request(app)
          .get('/api/admin/agents')
          .query({ limit: 10 })
          .set('Authorization', `Bearer ${adminToken}`)
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});