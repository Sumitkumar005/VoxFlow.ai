import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';
import { generateToken } from '../src/utils/jwt.js';

// Mock the dependencies
jest.mock('../src/utils/supabase.js');
jest.mock('../src/services/groq.service.js');
jest.mock('../src/services/twilio.service.js');
jest.mock('../src/utils/token-calculator.js');

import { generateResponse } from '../src/services/groq.service.js';
import { makeCall } from '../src/services/twilio.service.js';
import { generateRunNumber, calculateTokens } from '../src/utils/token-calculator.js';

describe('Call Controller Ownership and Access Control', () => {
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

    // Mock utility functions
    generateRunNumber.mockReturnValue('WR-TEL-001');
    calculateTokens.mockReturnValue(15.6);
  });

  describe('Web Call Ownership', () => {
    it('should allow user to start web call with their own agent', async () => {
      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Test Agent',
        type: 'OUTBOUND',
        use_case: 'Testing',
        description: 'Test agent description',
      };

      const mockRun = {
        id: 'run-1',
        run_number: 'WR-TEL-001',
        agent_id: 'agent-1',
        type: 'WEB_CALL',
        status: 'in_progress',
      };

      const mockConfig = {
        llm_model: 'llama-3.3-70b-versatile',
        tts_voice: 'aura-2-helena-en',
      };

      // Mock agent lookup
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock run creation
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock config lookup
      query.mockResolvedValueOnce({ data: [mockConfig], error: null });

      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          agent_id: 'agent-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.run_id).toBe('run-1');
      expect(response.body.data.agent.id).toBe('agent-1');

      // Verify agent ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
      });
    });

    it('should deny web call start with other users agent', async () => {
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .post('/api/calls/web/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          agent_id: 'other-user-agent',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
    });

    it('should allow user to process message for their own run', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        status: 'in_progress',
      };

      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Test Agent',
        description: 'Test description',
        type: 'OUTBOUND',
        use_case: 'Testing',
      };

      const mockConfig = {
        llm_model: 'llama-3.3-70b-versatile',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock config lookup
      query.mockResolvedValueOnce({ data: [mockConfig], error: null });

      // Mock AI response
      generateResponse.mockResolvedValueOnce({
        success: true,
        message: 'Hello! How can I help you?',
      });

      const response = await request(app)
        .post('/api/calls/web/message')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          run_id: 'run-1',
          message: 'Hello',
          conversation_history: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Hello! How can I help you?');

      // Verify ownership checks
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
      });

      // Verify AI service was called with user ID
      expect(generateResponse).toHaveBeenCalledWith(
        user1.id,
        expect.any(String),
        expect.any(Array),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          name: 'Test Agent',
          type: 'OUTBOUND',
          use_case: 'Testing',
        }),
        expect.any(Object)
      );
    });

    it('should deny message processing for other users runs', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        status: 'in_progress',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .post('/api/calls/web/message')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          run_id: 'run-1',
          message: 'Hello',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. You can only access your own agent runs.');
    });

    it('should allow user to end their own web call', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        status: 'in_progress',
      };

      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
      };

      const mockUpdatedRun = {
        id: 'run-1',
        status: 'completed',
        transcript_text: 'Call transcript',
        duration_seconds: 120,
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock run update
      query.mockResolvedValueOnce({ data: [mockUpdatedRun], error: null });

      const response = await request(app)
        .post('/api/calls/web/end')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          run_id: 'run-1',
          conversation_history: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
          duration_seconds: 120,
          disposition: 'user_hangup',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.run.status).toBe('completed');

      // Verify ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
        columns: 'id',
      });
    });
  });

  describe('Phone Call Ownership', () => {
    it('should allow user to start phone call with their own agent', async () => {
      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Test Agent',
      };

      const mockConfig = {
        account_sid: 'AC123',
        auth_token: 'token123',
        from_phone_number: '+1234567890',
      };

      const mockRun = {
        id: 'run-1',
        run_number: 'WR-TEL-001',
        agent_id: 'agent-1',
        type: 'PHONE_CALL',
        status: 'in_progress',
      };

      // Mock agent lookup
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });
      // Mock config lookup
      query.mockResolvedValueOnce({ data: [mockConfig], error: null });
      // Mock run creation
      query.mockResolvedValueOnce({ data: [mockRun], error: null });

      // Mock Twilio call
      makeCall.mockResolvedValueOnce({
        success: true,
        callSid: 'CA123456789',
        status: 'queued',
      });

      const response = await request(app)
        .post('/api/calls/phone/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          agent_id: 'agent-1',
          phone_number: '+1987654321',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.call_sid).toBe('CA123456789');

      // Verify agent ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
      });

      // Verify Twilio service was called with user ID
      expect(makeCall).toHaveBeenCalledWith(user1.id, expect.objectContaining({
        to: '+1987654321',
        estimatedDuration: 120,
      }));
    });

    it('should deny phone call start with other users agent', async () => {
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .post('/api/calls/phone/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          agent_id: 'other-user-agent',
          phone_number: '+1987654321',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Agent not found or access denied');
    });
  });

  describe('Run Access Control', () => {
    it('should allow user to view their own run details', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        run_number: 'WR-TEL-001',
        status: 'completed',
        type: 'WEB_CALL',
      };

      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
        name: 'Test Agent',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });

      const response = await request(app)
        .get('/api/calls/run/run-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('run-1');
      expect(response.body.data.agent.name).toBe('Test Agent');

      // Verify ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
      });
    });

    it('should deny access to other users run details', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        run_number: 'WR-TEL-001',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/calls/run/run-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. You can only access your own agent runs.');
    });

    it('should allow user to view their own transcript', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        run_number: 'WR-TEL-001',
        transcript_text: 'Call transcript content',
        created_at: new Date().toISOString(),
      };

      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id,
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock agent ownership check
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });

      const response = await request(app)
        .get('/api/calls/transcript/run-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transcript_text).toBe('Call transcript content');

      // Verify ownership was checked
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user1.id },
        columns: 'id',
      });
    });

    it('should deny access to other users transcripts', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        run_number: 'WR-TEL-001',
        transcript_text: 'Private transcript',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock no agent found (due to ownership filter)
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/calls/transcript/run-1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. You can only access your own agent runs.');
    });
  });

  describe('Admin Access Override', () => {
    it('should allow admin to access any run (if middleware supports it)', async () => {
      const mockRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        run_number: 'WR-TEL-001',
      };

      const mockAgent = {
        id: 'agent-1',
        user_id: user1.id, // Belongs to user1, not admin
        name: 'User Agent',
      };

      // Mock run lookup
      query.mockResolvedValueOnce({ data: [mockRun], error: null });
      // Mock agent lookup (admin should bypass ownership check in middleware)
      query.mockResolvedValueOnce({ data: [mockAgent], error: null });

      const response = await request(app)
        .get('/api/calls/run/run-1')
        .set('Authorization', `Bearer ${adminToken}`);

      // This would pass if admin bypass is implemented in middleware
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing run gracefully', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const response = await request(app)
        .get('/api/calls/run/nonexistent-run')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Run not found');
    });

    it('should require authentication for all call endpoints', async () => {
      const response = await request(app)
        .post('/api/calls/web/start')
        .send({
          agent_id: 'agent-1',
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/calls/phone/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          agent_id: 'agent-1',
          // Missing phone_number
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Phone number is required');
    });
  });

  describe('Cross-User Data Isolation', () => {
    it('should ensure complete isolation between users', async () => {
      // User 1 creates a run
      const user1Agent = { id: 'agent-1', user_id: user1.id };
      const user1Run = { id: 'run-1', agent_id: 'agent-1' };

      // User 2 should not be able to access User 1's run
      query.mockResolvedValueOnce({ data: [user1Run], error: null });
      query.mockResolvedValueOnce({ data: [], error: null }); // No agent found for user2

      const response = await request(app)
        .get('/api/calls/run/run-1')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Access denied. You can only access your own agent runs.');

      // Verify the ownership check was performed
      expect(query).toHaveBeenCalledWith('agents', 'select', {
        filter: { id: 'agent-1', user_id: user2.id },
      });
    });
  });
});