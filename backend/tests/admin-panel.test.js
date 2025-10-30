import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';
import { generateToken } from '../src/utils/jwt.js';

// Mock the dependencies
jest.mock('../src/utils/supabase.js');
jest.mock('../src/services/usage-tracking.service.js');
jest.mock('../src/services/limit-enforcement.service.js');

import { getMultiUserUsageStats, getUserLimitsAndUsage } from '../src/services/usage-tracking.service.js';
import { updateUserSubscriptionTier, getSubscriptionTiers } from '../src/services/limit-enforcement.service.js';

describe('Admin Panel Backend', () => {
  let adminToken, userToken;
  let adminUser, regularUser;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create test users
    adminUser = {
      id: 'admin-123',
      email: 'admin@voxflow.com',
      role: 'admin',
      subscription_tier: 'enterprise',
      max_agents: 100,
    };

    regularUser = {
      id: 'user-123',
      email: 'user@example.com',
      role: 'user',
      subscription_tier: 'free',
      max_agents: 2,
    };

    // Generate tokens
    adminToken = generateToken(adminUser);
    userToken = generateToken(regularUser);

    // Mock service functions
    getUserLimitsAndUsage.mockResolvedValue({
      limits: { max_agents: 2, monthly_token_quota: 1000 },
      current_usage: { agents: 1, tokens_this_month: 500, calls_this_month: 10 },
      remaining: { agents: 1, tokens: 500 },
      usage_percentage: { agents: 50, tokens: 50 },
    });

    getSubscriptionTiers.mockReturnValue({
      tiers: {
        free: { name: 'Free', max_agents: 2, monthly_token_quota: 1000, price: 0 },
        pro: { name: 'Pro', max_agents: 10, monthly_token_quota: 50000, price: 29 },
        enterprise: { name: 'Enterprise', max_agents: 100, monthly_token_quota: 1000000, price: 299 },
      },
    });
  });

  describe('Admin Authentication and Authorization', () => {
    it('should require authentication for admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });

    it('should require admin role for admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('should allow admin users to access admin routes', async () => {
      query.mockResolvedValueOnce({
        data: [regularUser],
        error: null,
      });
      query.mockResolvedValueOnce({
        data: [regularUser],
        error: null,
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('User Management', () => {
    it('should get all users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          role: 'user',
          subscription_tier: 'free',
          organization_name: 'Org 1',
          max_agents: 2,
          monthly_token_quota: 1000,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          role: 'user',
          subscription_tier: 'pro',
          organization_name: 'Org 2',
          max_agents: 10,
          monthly_token_quota: 50000,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ];

      query.mockResolvedValueOnce({ data: mockUsers, error: null });
      query.mockResolvedValueOnce({ data: mockUsers, error: null });

      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.data[0].current_usage).toBeDefined();
    });

    it('should support user filtering and search', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'test@example.com',
          subscription_tier: 'pro',
          role: 'user',
        },
      ];

      query.mockResolvedValueOnce({ data: mockUsers, error: null });
      query.mockResolvedValueOnce({ data: mockUsers, error: null });

      const response = await request(app)
        .get('/api/admin/users?search=test&subscription_tier=pro&role=user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.filters.search).toBe('test');
      expect(response.body.filters.subscription_tier).toBe('pro');
    });

    it('should get detailed user information', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        subscription_tier: 'free',
        max_agents: 2,
        monthly_token_quota: 1000,
      };

      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          total_runs: 5,
          created_at: new Date().toISOString(),
        },
      ];

      const mockRuns = [
        {
          id: 'run-1',
          run_number: 'WR-TEL-001',
          agent_id: 'agent-1',
          type: 'WEB_CALL',
          status: 'completed',
          duration_seconds: 120,
          created_at: new Date().toISOString(),
        },
      ];

      const mockApiKeys = [
        {
          provider: 'groq',
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
      ];

      const mockSubscription = {
        plan: 'free',
        status: 'active',
        monthly_price: 0,
      };

      query.mockResolvedValueOnce({ data: [mockUser], error: null });
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      query.mockResolvedValueOnce({ data: mockApiKeys, error: null });
      query.mockResolvedValueOnce({ data: [mockSubscription], error: null });

      const response = await request(app)
        .get('/api/admin/users/user-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('user@example.com');
      expect(response.body.data.agents).toHaveLength(1);
      expect(response.body.data.recent_runs).toHaveLength(1);
      expect(response.body.data.api_keys).toHaveLength(1);
      expect(response.body.data.usage_statistics).toBeDefined();
    });

    it('should update user limits', async () => {
      const mockUpdatedUser = {
        id: 'user-1',
        email: 'user@example.com',
        max_agents: 5,
        monthly_token_quota: 25000,
        subscription_tier: 'pro',
      };

      query.mockResolvedValueOnce({ data: [mockUpdatedUser], error: null });
      updateUserSubscriptionTier.mockResolvedValueOnce({
        success: true,
        new_tier: 'pro',
      });

      const response = await request(app)
        .put('/api/admin/users/user-1/limits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          max_agents: 5,
          monthly_token_quota: 25000,
          subscription_tier: 'pro',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.max_agents).toBe(5);
      expect(response.body.data.subscription_tier).toBe('pro');

      // Verify audit logging was called
      expect(query).toHaveBeenCalledWith('users', 'update', expect.objectContaining({
        filter: { id: 'user-1' },
        data: expect.objectContaining({
          max_agents: 5,
          monthly_token_quota: 25000,
          subscription_tier: 'pro',
        }),
      }));
    });

    it('should toggle user status', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        is_active: false,
      };

      query.mockResolvedValueOnce({ data: [mockUser], error: null });

      const response = await request(app)
        .post('/api/admin/users/user-1/toggle-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          is_active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated');
      expect(response.body.data.is_active).toBe(false);
    });

    it('should delete user account', async () => {
      const mockUser = {
        email: 'user@example.com',
        role: 'user',
      };

      query.mockResolvedValueOnce({ data: [mockUser], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .delete('/api/admin/users/user-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should prevent admin from deleting themselves', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('You cannot delete your own account');
    });

    it('should prevent deletion of other admin users', async () => {
      const mockAdminUser = {
        email: 'other-admin@voxflow.com',
        role: 'admin',
      };

      query.mockResolvedValueOnce({ data: [mockAdminUser], error: null });

      const response = await request(app)
        .delete('/api/admin/users/other-admin-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Cannot delete admin users');
    });
  });

  describe('Agent Management', () => {
    it('should get all agents across all users', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          user_id: 'user-1',
          name: 'Agent 1',
          type: 'OUTBOUND',
          created_at: new Date().toISOString(),
        },
        {
          id: 'agent-2',
          user_id: 'user-2',
          name: 'Agent 2',
          type: 'INBOUND',
          created_at: new Date().toISOString(),
        },
      ];

      const mockUsers = [
        { email: 'user1@example.com', organization_name: 'Org 1', subscription_tier: 'free' },
        { email: 'user2@example.com', organization_name: 'Org 2', subscription_tier: 'pro' },
      ];

      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: [mockUsers[0]], error: null });
      query.mockResolvedValueOnce({ data: [mockUsers[1]], error: null });

      const response = await request(app)
        .get('/api/admin/agents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].user).toBeDefined();
      expect(response.body.data[0].user.email).toBe('user1@example.com');
    });

    it('should support agent filtering', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          user_id: 'user-1',
          name: 'Test Agent',
          type: 'OUTBOUND',
        },
      ];

      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: [{ email: 'user@example.com' }], error: null });

      const response = await request(app)
        .get('/api/admin/agents?type=OUTBOUND&search=Test&user_id=user-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('Analytics', () => {
    it('should get platform overview statistics', async () => {
      const mockUsers = [
        { id: 'user-1', subscription_tier: 'free', is_active: true, created_at: new Date().toISOString() },
        { id: 'user-2', subscription_tier: 'pro', is_active: true, created_at: new Date().toISOString() },
      ];

      const mockAgents = [
        { id: 'agent-1', created_at: new Date().toISOString() },
        { id: 'agent-2', created_at: new Date().toISOString() },
      ];

      const mockRuns = [
        { id: 'run-1', status: 'completed', created_at: new Date().toISOString(), duration_seconds: 120, dograh_tokens: 15.6 },
        { id: 'run-2', status: 'failed', created_at: new Date().toISOString(), duration_seconds: 0, dograh_tokens: 0 },
      ];

      query.mockResolvedValueOnce({ data: mockUsers, error: null });
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: mockRuns, error: null });

      const response = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.total).toBe(2);
      expect(response.body.data.users.by_tier.free).toBe(1);
      expect(response.body.data.users.by_tier.pro).toBe(1);
      expect(response.body.data.agents.total).toBe(2);
      expect(response.body.data.runs.total).toBe(2);
      expect(response.body.data.runs.completed).toBe(1);
      expect(response.body.data.runs.failed).toBe(1);
    });

    it('should get user growth analytics', async () => {
      const mockUsers = [
        { created_at: '2024-01-15T10:00:00Z', subscription_tier: 'free', is_active: true },
        { created_at: '2024-01-16T10:00:00Z', subscription_tier: 'pro', is_active: true },
      ];

      query.mockResolvedValueOnce({ data: mockUsers, error: null });

      const response = await request(app)
        .get('/api/admin/analytics/user-growth?period=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('30d');
      expect(response.body.data.growth_data).toBeDefined();
      expect(response.body.data.summary.total_new_users).toBe(2);
    });

    it('should get usage analytics', async () => {
      const mockUsageData = [
        {
          date: '2024-01-15',
          total_tokens: 1000,
          total_calls: 10,
          total_duration_seconds: 600,
          api_costs: 0.001,
        },
      ];

      getMultiUserUsageStats.mockResolvedValueOnce([
        {
          user_id: 'user-1',
          email: 'user@example.com',
          usage: { total_tokens: 1000, total_calls: 10, total_costs: 0.001 },
        },
      ]);

      query.mockResolvedValueOnce({ data: mockUsageData, error: null });

      const response = await request(app)
        .get('/api/admin/analytics/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform_totals).toBeDefined();
      expect(response.body.data.daily_trends).toBeDefined();
      expect(response.body.data.top_users).toBeDefined();
    });

    it('should get system health metrics', async () => {
      const mockRuns = [
        { status: 'completed', created_at: new Date().toISOString(), duration_seconds: 120 },
        { status: 'failed', created_at: new Date().toISOString(), duration_seconds: 0 },
        { status: 'in_progress', created_at: new Date().toISOString(), duration_seconds: 0 },
      ];

      const mockApiKeys = [
        { provider: 'groq', user_id: 'user-1' },
        { provider: 'deepgram', user_id: 'user-1' },
        { provider: 'twilio', user_id: 'user-2' },
      ];

      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      query.mockResolvedValueOnce({ data: mockApiKeys, error: null });
      query.mockResolvedValueOnce({ data: [{ id: 'test' }], error: null });

      const response = await request(app)
        .get('/api/admin/analytics/system-health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system_status).toBeDefined();
      expect(response.body.data.metrics.error_rate).toBeDefined();
      expect(response.body.data.metrics.success_rate).toBeDefined();
      expect(response.body.data.api_keys.total_configured).toBe(3);
      expect(response.body.data.database.status).toBe('connected');
    });
  });

  describe('Audit Logs', () => {
    it('should get audit logs with user details', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          admin_user_id: adminUser.id,
          action: 'update_user_limits',
          target_user_id: 'user-1',
          details: { old_tier: 'free', new_tier: 'pro' },
          created_at: new Date().toISOString(),
        },
      ];

      const mockAdminData = { data: [{ email: 'admin@voxflow.com' }] };
      const mockTargetData = { data: [{ email: 'user@example.com' }] };

      query.mockResolvedValueOnce({ data: mockLogs, error: null });
      query.mockResolvedValueOnce({ data: mockLogs, error: null });
      query.mockResolvedValueOnce(mockAdminData);
      query.mockResolvedValueOnce(mockTargetData);

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].admin_email).toBe('admin@voxflow.com');
      expect(response.body.data[0].target_email).toBe('user@example.com');
      expect(response.body.data[0].action).toBe('update_user_limits');
    });

    it('should support audit log filtering', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/admin/audit-logs?action=update_user_limits&admin_user_id=admin-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith('admin_audit_logs', 'select', expect.objectContaining({
        filter: expect.objectContaining({
          action: 'update_user_limits',
          admin_user_id: 'admin-123',
        }),
      }));
    });
  });

  describe('Subscription Management', () => {
    it('should get subscription tiers information', async () => {
      const mockUserCounts = [
        { subscription_tier: 'free' },
        { subscription_tier: 'free' },
        { subscription_tier: 'pro' },
        { subscription_tier: 'enterprise' },
      ];

      query.mockResolvedValueOnce({ data: mockUserCounts, error: null });

      const response = await request(app)
        .get('/api/admin/subscription-tiers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tiers).toBeDefined();
      expect(response.body.data.user_counts.free).toBe(2);
      expect(response.body.data.user_counts.pro).toBe(1);
      expect(response.body.data.user_counts.enterprise).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      query.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
    });

    it('should validate user ID format', async () => {
      const response = await request(app)
        .get('/api/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate update user limits input', async () => {
      const response = await request(app)
        .put('/api/admin/users/user-1/limits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          max_agents: -1, // Invalid
          subscription_tier: 'invalid', // Invalid
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });
});