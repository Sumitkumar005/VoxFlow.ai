import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';
import { generateToken } from '../src/utils/jwt.js';

// Mock the supabase utility and services
jest.mock('../src/utils/supabase.js');
jest.mock('../src/services/limit-enforcement.service.js');

import { checkAgentCreationLimit } from '../src/services/limit-enforcement.service.js';

describe('Agent Ownership and Access Control', () => {
  let user1Token, user2Token, adminToken;
  let user1, user2, adminUser;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create test users
    user1 = {
      id: 'user-1',
      email: 'user1@example.com',
      role: 'user',
      subscription_tier: 'free',
      max_agents: 2,
    };

    user2 = {
      id: 'user-2',
      email: 'user2@example.com',
      role: 'user',
      subscription_tier: 'pro',
      max_agents: 10,
    };

    adminUser = {
      id: 'admin-1',
      email: 'admin@voxflow.com',
      role: 'admin',
      subscription_tier: 'enterprise',
      max_agents: 100,
    };

    // Generate tokens
    user1Token = generateToken(user1);
    user2Token = generateToken(user2);
    adminToken = generateToken(adminUser);

    // Mock successful limit checks by default
    checkAgentCreationLimit.mockResolvedValue({
      allowed: true,
      reason: 'Within agent limits',
      limits_info: {
        current_usage: { agents: 1 },
        limits: { max_agents: 2 },
        remaining: { agents: 1 },
      },
    });
  });

  describe('Agent Creation Ownership', () => {
    it('should create agent with correct user ownership', async () => {
      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Test Agent',
        type: 'OUTBOUND',
        use_case: 'Testing',
        description: 'Test agent description',
        created_at: new Date().toISOString(),
      };

      query.mockResolvedValueOnce({
        data: [mockAgent],
        error: null,
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          description: 'Test agent description for ownership testing',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(user1.id);
      
      // Verify the database call included the correct user_id
      expect(query).toHaveBeenCalledWith('agents', 'insert', {
        data: expect.objectContaining({
          user_id: user1.id,
          name: 'Test Agent',
          type: 'OUTBOUND',
        }),
      });
    });

    it('should enforce agent creation limits', async () => {
      checkAgentCreationLimit.mockResolvedValueOnce({
        allowed: false,
        reason: 'Agent limit reached',
        details: {
          current_agents: 2,
          max_agents: 2,
          upgrade_suggestion: {
            suggested_tier: 'pro',
            tier_name: 'Pro',
            price: 29,
          },
        },
        limits_info: {
          current_usage: { agents: 2 },
          limits: { max_agents: 2 },
        },
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Exceeding Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          description: 'This should fail due to limits',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent limit reached');
      expect(response.body.upgrade_suggestion).toBeDefined();
    });

    it('should require authentication for agent creation', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          description: 'Test agent description',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Agent Listing Ownership', () => {
    it('should only return agents owned by the user', async () => {
      const user1Agents = [
        {
          id: 'agent-1',
          user_id: user1.id,
          name: 'User 1 Agent 1',
          type: 'OUTBOUND',
          created_at: new Date().toISOString(),
        },
        {
          id: 'agent-2',
          user_id: user1.id,
          name: 'User 1 Agent 2',
          type: 'INBOUND',
          created_at: new Date().toISOString(),
        },
      ];

      const mockUserLimits = {
        max_agents: 2,
        subscription_tier: 'free',
      };

      // Mock agents query
      query.mockResolvedValueOnce({
        data: user1Agents,
        error: null,
      });
      // Mock count query
      query.mockResolvedValueOnce({
        data: user1Agents,
        error: null,
      });
      // Mock user limits query
      query.mockResolvedValueOnce({
        data: [mockUserLimits],
        error: null,
      });

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every(agent => agent.user_id === user1.id)).toBe(true);
      
      // Verify the query included user_id filter
      expect(query).toHaveBeenCalledWith('agents', 'select', expect.objectContaining({
        filter: expect.objectContaining({
          user_id: user1.id,
        }),
      }));
    });

    it('should support pagination and filtering', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          user_id: user1.id,
          name: 'Test Agent',
          type: 'OUTBOUND',
        },
      ];

      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      query.mockResolvedValueOnce({ data: [{ max_agents: 2, subscription_tier: 'free' }], error: null });

      const response = await request(app)
        .get('/api/agents?page=1&limit=5&type=OUTBOUND&search=Test')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      
      // Verify filters were applied with user ownership
      expect(query).toHaveBeenCalledWith('agents', 'select', expect.objectContaining({
        filter: expect.objectContaining({
          user_id: user1.id,
          type: 'OUTBOUND',
          name: 'ilike.%Test%',
        }),
      }));
    });
  });

  describe('Agent Access Control', () => {
    it('should allow user to access their own agent', async () => {
      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'User 1 Agent',
        type: 'OUTBOUND',
        use_case: 'Testing',
        description: 'Test description',
      };

      const mockRunStats = [
        {
          status: 'completed',
          duration_seconds: 120,
          dograh_tokens: 15.6,
          created_at: new Date().toISOString(),
        },
        {
          status: 'failed',
          duration_seconds: 0,
          dograh_tokens: 0,
          created_at: new Date().toISOString(),
        },
      ];

      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      query.mockResolvedValueOnce({ data: mockRunStats, error: null });

      const response = await request(app)
        .get('/api/agents/agent-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('agent-1');
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.total_runs).toBe(2);
      expect(response.body.data.statistics.completed_runs).toBe(1);
      
      // Verify ownership filter was applied
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
      });
    });

    it('should deny access to other users agents', async () => {
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/agents/agent-belonging-to-user2')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
      
      // Verify ownership filter was applied
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-belonging-to-user2', user_id: user1.id },
      });
    });

    it('should allow admin to access any agent', async () => {
      // For admin access, we would need to modify the middleware
      // This test assumes the RBAC middleware allows admin bypass
      const mockAgent = {
        id: 'any-agent',
        user_id: user1.id,
        name: 'Any User Agent',
      };

      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/agents/any-agent')
        .set('Authorization', `Bearer ${adminToken}`);

      // This would pass if admin bypass is implemented in middleware
      expect(response.status).toBe(200);
    });
  });

  describe('Agent Updates Ownership', () => {
    it('should allow user to update their own agent', async () => {
      const mockUpdatedAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Updated Agent Name',
        use_case: 'Updated use case',
        description: 'Updated description',
      };

      query.mockResolvedValueOnce({
        data: [mockUpdatedAgent],
        error: null,
      });

      const response = await request(app)
        .put('/api/agents/agent-1')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Updated Agent Name',
          use_case: 'Updated use case',
          description: 'Updated description for testing',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Agent Name');
      
      // Verify ownership filter was applied in update
      expect(query).toHaveBeenCalledWith('agents', 'update', {
        filter: { id: 'agent-1', user_id: user1.id },
        data: expect.objectContaining({
          name: 'Updated Agent Name',
        }),
      });
    });

    it('should deny update to other users agents', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .put('/api/agents/other-user-agent')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Trying to update',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
    });
  });

  describe('Agent Deletion Ownership', () => {
    it('should allow user to delete their own agent', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent to Delete',
      };

      // Mock agent existence check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock active runs check
      query.mockResolvedValueOnce({ data: [], error: null });
      // Mock deletion
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .delete('/api/agents/agent-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Agent "Agent to Delete" deleted successfully');
      
      // Verify ownership checks
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
        columns: 'id, name',
      });
      
      expect(query).toHaveBeenCalledWith('agents', 'delete', {
        filter: { id: 'agent-1', user_id: user1.id },
      });
    });

    it('should deny deletion of other users agents', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .delete('/api/agents/other-user-agent')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
    });

    it('should prevent deletion of agent with active runs', async () => {
      const mockAgent = { id: 'agent-1', name: 'Active Agent' };
      const mockActiveRuns = [{ id: 'run-1' }];

      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      query.mockResolvedValueOnce({ data: mockActiveRuns, error: null });

      const response = await request(app)
        .delete('/api/agents/agent-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete agent with active runs');
      expect(response.body.active_runs).toBe(1);
    });
  });

  describe('Agent Run History Ownership', () => {
    it('should allow user to view their agents run history', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      const mockRuns = [
        {
          id: 'run-1',
          agent_id: 'agent-1',
          status: 'completed',
          type: 'WEB_CALL',
          duration_seconds: 120,
          created_at: new Date().toISOString(),
        },
      ];

      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock runs query
      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      // Mock count query
      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      // Mock all runs for summary
      query.mockResolvedValueOnce({ data: mockRuns, error: null });

      const response = await request(app)
        .get('/api/agents/agent-1/runs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.summary).toBeDefined();
      
      // Verify agent ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
        columns: 'id, name',
      });
    });

    it('should deny access to other users agent run history', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/agents/other-user-agent/runs')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
    });

    it('should support filtering and pagination for run history', async () => {
      const mockAgent = { id: 'agent-1', name: 'Test Agent' };
      const mockRuns = [
        {
          id: 'run-1',
          status: 'completed',
          type: 'PHONE_CALL',
          disposition: 'user_hangup',
        },
      ];

      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      query.mockResolvedValueOnce({ data: mockRuns, error: null });
      query.mockResolvedValueOnce({ data: mockRuns, error: null });

      const response = await request(app)
        .get('/api/agents/agent-1/runs?status=completed&type=PHONE_CALL&page=1&limit=5')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      
      // Verify filters were applied
      expect(query).toHaveBeenCalledWith('agent_runs', 'select', expect.objectContaining({
        filter: expect.objectContaining({
          agent_id: 'agent-1',
          status: 'completed',
          type: 'PHONE_CALL',
        }),
      }));
    });
  });

  describe('Cross-User Isolation', () => {
    it('should ensure complete data isolation between users', async () => {
      // User 1 creates an agent
      const user1Agent = {
        id: 'user1-agent',
        user_id: user1.id,
        name: 'User 1 Agent',
      };

      query.mockResolvedValueOnce({ data: [user1Agent], error: null });

      await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'User 1 Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          description: 'User 1 agent description',
        });

      // User 2 should not see User 1's agent in their list
      query.mockResolvedValueOnce({ data: [], error: null }); // No agents for user 2
      query.mockResolvedValueOnce({ data: [], error: null }); // Count query
      query.mockResolvedValueOnce({ data: [{ max_agents: 10, subscription_tier: 'pro' }], error: null });

      const user2Response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(user2Response.status).toBe(200);
      expect(user2Response.body.data).toHaveLength(0);
      
      // Verify User 2's query only included their user_id
      expect(query).toHaveBeenCalledWith('agents', 'select', expect.objectContaining({
        filter: expect.objectContaining({
          user_id: user2.id,
        }),
      }));
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate agent creation input', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'A', // Too short
          type: 'INVALID', // Invalid type
          use_case: 'X', // Too short
          description: 'Short', // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      query.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
          description: 'Test agent description',
        });

      expect(response.status).toBe(500);
    });
  });
});