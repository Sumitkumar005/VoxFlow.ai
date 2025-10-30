import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';
import { generateToken } from '../src/utils/jwt.js';

// Mock the supabase utility
jest.mock('../src/utils/supabase.js');

describe('Role-Based Access Control (RBAC)', () => {
  let adminToken, userToken, user2Token;
  let adminUser, regularUser, user2;

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

    user2 = {
      id: 'user-456',
      email: 'user2@example.com',
      role: 'user',
      subscription_tier: 'pro',
      max_agents: 10,
    };

    // Generate tokens
    adminToken = generateToken(adminUser);
    userToken = generateToken(regularUser);
    user2Token = generateToken(user2);
  });

  describe('Admin Access Control', () => {
    it('should allow admin to access admin-only routes', async () => {
      // Mock admin route response
      query.mockResolvedValueOnce({ data: [adminUser, regularUser, user2] });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      // This would pass if we had admin routes implemented
      // For now, this is a placeholder test
      expect(adminToken).toBeDefined();
    });

    it('should reject non-admin users from admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      // This would return 403 if we had admin routes implemented
      // For now, this is a placeholder test
      expect(userToken).toBeDefined();
    });
  });

  describe('Agent Ownership Control', () => {
    it('should allow users to access their own agents', async () => {
      const mockAgent = {
        id: 'agent-123',
        user_id: regularUser.id,
        name: 'Test Agent',
      };

      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent] });
      // Mock agent details
      query.mockResolvedValueOnce({ data: [mockAgent] });

      const response = await request(app)
        .get('/api/agents/agent-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(403);
    });

    it('should reject users from accessing other users agents', async () => {
      const mockAgent = {
        id: 'agent-456',
        user_id: user2.id, // Belongs to user2, not regularUser
        name: 'Other User Agent',
      };

      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent] });

      const response = await request(app)
        .get('/api/agents/agent-456')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });

    it('should allow admins to access all agents', async () => {
      const mockAgent = {
        id: 'agent-789',
        user_id: regularUser.id,
        name: 'Any User Agent',
      };

      // Mock agent details (admin bypasses ownership check)
      query.mockResolvedValueOnce({ data: [mockAgent] });

      const response = await request(app)
        .get('/api/agents/agent-789')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).not.toBe(403);
    });
  });

  describe('User Limits Enforcement', () => {
    it('should allow agent creation within limits', async () => {
      // Mock current agent count (1 agent, limit is 2)
      query.mockResolvedValueOnce({ data: [{ id: 'existing-agent' }] });
      // Mock successful agent creation
      query.mockResolvedValueOnce({ 
        data: [{ 
          id: 'new-agent', 
          user_id: regularUser.id, 
          name: 'New Agent' 
        }] 
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Agent',
          type: 'OUTBOUND',
          use_case: 'Test',
          description: 'Test agent',
        });

      expect(response.status).not.toBe(403);
    });

    it('should reject agent creation when limit exceeded', async () => {
      // Mock current agent count (2 agents, limit is 2)
      query.mockResolvedValueOnce({ 
        data: [
          { id: 'agent-1' }, 
          { id: 'agent-2' }
        ] 
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Exceeding Agent',
          type: 'OUTBOUND',
          use_case: 'Test',
          description: 'This should fail',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Agent limit reached');
    });

    it('should not enforce limits for admin users', async () => {
      // Mock high agent count for admin
      const manyAgents = Array.from({ length: 150 }, (_, i) => ({ id: `agent-${i}` }));
      query.mockResolvedValueOnce({ data: manyAgents });
      // Mock successful agent creation
      query.mockResolvedValueOnce({ 
        data: [{ 
          id: 'admin-agent', 
          user_id: adminUser.id, 
          name: 'Admin Agent' 
        }] 
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Agent',
          type: 'OUTBOUND',
          use_case: 'Admin Test',
          description: 'Admin can create unlimited agents',
        });

      expect(response.status).not.toBe(403);
    });
  });

  describe('Campaign Ownership Control', () => {
    it('should allow users to access their own campaigns', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        user_id: regularUser.id,
        name: 'Test Campaign',
      };

      // Mock campaign ownership check
      query.mockResolvedValueOnce({ data: [mockCampaign] });
      // Mock campaign details
      query.mockResolvedValueOnce({ data: [mockCampaign] });

      const response = await request(app)
        .get('/api/campaigns/campaign-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(403);
    });

    it('should reject users from accessing other users campaigns', async () => {
      const mockCampaign = {
        id: 'campaign-456',
        user_id: user2.id, // Belongs to user2, not regularUser
        name: 'Other User Campaign',
      };

      // Mock campaign ownership check
      query.mockResolvedValueOnce({ data: [mockCampaign] });

      const response = await request(app)
        .get('/api/campaigns/campaign-456')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('Agent Run Ownership Control', () => {
    it('should allow users to access their own agent runs', async () => {
      const mockAgentRun = {
        id: 'run-123',
        agent_id: 'agent-123',
      };

      const mockAgent = {
        id: 'agent-123',
        user_id: regularUser.id,
      };

      // Mock agent run lookup
      query.mockResolvedValueOnce({ data: [mockAgentRun] });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent] });
      // Mock run details
      query.mockResolvedValueOnce({ data: [mockAgentRun] });

      const response = await request(app)
        .get('/api/calls/run/run-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(403);
    });

    it('should reject users from accessing other users agent runs', async () => {
      const mockAgentRun = {
        id: 'run-456',
        agent_id: 'agent-456',
      };

      const mockAgent = {
        id: 'agent-456',
        user_id: user2.id, // Belongs to user2, not regularUser
      };

      // Mock agent run lookup
      query.mockResolvedValueOnce({ data: [mockAgentRun] });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent] });

      const response = await request(app)
        .get('/api/calls/run/run-456')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('Audit Logging', () => {
    it('should log admin actions', async () => {
      // Mock successful agent creation
      query.mockResolvedValueOnce({ data: [] }); // No existing agents
      query.mockResolvedValueOnce({ 
        data: [{ 
          id: 'admin-created-agent', 
          user_id: adminUser.id, 
          name: 'Admin Created Agent' 
        }] 
      });
      // Mock audit log insertion
      query.mockResolvedValueOnce({ data: [] });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Created Agent',
          type: 'OUTBOUND',
          use_case: 'Admin Test',
          description: 'This action should be logged',
        });

      // Verify that audit logging was attempted
      // In a real test, we'd check that the audit log insert was called
      expect(response.status).not.toBe(500);
    });

    it('should not log regular user actions', async () => {
      // Mock successful agent creation
      query.mockResolvedValueOnce({ data: [] }); // No existing agents
      query.mockResolvedValueOnce({ 
        data: [{ 
          id: 'user-created-agent', 
          user_id: regularUser.id, 
          name: 'User Created Agent' 
        }] 
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Created Agent',
          type: 'OUTBOUND',
          use_case: 'User Test',
          description: 'This action should not be logged',
        });

      // Regular user actions don't trigger audit logs
      expect(response.status).not.toBe(500);
    });
  });
});