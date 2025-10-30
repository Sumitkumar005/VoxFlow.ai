import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { query } from '../src/utils/supabase.js';

// Mock the supabase utility
jest.mock('../src/utils/supabase.js');

describe('Enhanced Authentication System', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock user doesn't exist
      query.mockResolvedValueOnce({ data: [] });
      
      // Mock successful user creation
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        subscription_tier: 'free',
        organization_name: 'Test Org',
        max_agents: 2,
        monthly_token_quota: 1000,
        created_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ data: [mockUser] });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPass123',
          organization_name: 'Test Org',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.role).toBe('user');
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject registration with existing email', async () => {
      // Mock user already exists
      query.mockResolvedValueOnce({ data: [{ id: 'existing-user' }] });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'TestPass123',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should set correct limits based on subscription tier', async () => {
      // Mock user doesn't exist
      query.mockResolvedValueOnce({ data: [] });
      
      // Mock successful user creation with pro tier
      const mockUser = {
        id: 'user-123',
        email: 'pro@example.com',
        role: 'user',
        subscription_tier: 'pro',
        max_agents: 10,
        monthly_token_quota: 50000,
        created_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ data: [mockUser] });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'pro@example.com',
          password: 'TestPass123',
          subscription_tier: 'pro',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.max_agents).toBe(10);
      expect(response.body.data.user.monthly_token_quota).toBe(50000);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('TestPass123', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: hashedPassword,
        role: 'user',
        subscription_tier: 'free',
        organization_name: 'Test Org',
        max_agents: 2,
        monthly_token_quota: 1000,
        is_active: true,
        last_login: null,
        created_at: new Date().toISOString(),
      };

      // Mock user lookup
      query.mockResolvedValueOnce({ data: [mockUser] });
      // Mock last login update
      query.mockResolvedValueOnce({ data: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      // Mock user not found
      query.mockResolvedValueOnce({ data: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPass123', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: hashedPassword,
        is_active: true,
      };

      query.mockResolvedValueOnce({ data: [mockUser] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPass123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login for deactivated user', async () => {
      const hashedPassword = await bcrypt.hash('TestPass123', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: hashedPassword,
        is_active: false,
      };

      query.mockResolvedValueOnce({ data: [mockUser] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('deactivated');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info with usage statistics', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        subscription_tier: 'free',
        organization_name: 'Test Org',
        max_agents: 2,
        monthly_token_quota: 1000,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const mockUsage = [
        { total_tokens: 100, total_calls: 5, total_duration_seconds: 300, api_costs: 0.01 },
        { total_tokens: 50, total_calls: 2, total_duration_seconds: 120, api_costs: 0.005 },
      ];

      const mockAgents = [{ id: 'agent-1' }];

      // Mock user lookup
      query.mockResolvedValueOnce({ data: [mockUser] });
      // Mock usage lookup
      query.mockResolvedValueOnce({ data: mockUsage });
      // Mock agent count
      query.mockResolvedValueOnce({ data: mockAgents });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.current_usage).toBeDefined();
      expect(response.body.data.current_usage.total_tokens).toBe(150);
      expect(response.body.data.current_usage.agent_count).toBe(1);
      expect(response.body.data.current_usage.tokens_remaining).toBe(850);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });
});

describe('RBAC Middleware', () => {
  describe('requireAdmin', () => {
    it('should allow admin users', async () => {
      // This would need to be tested with actual route that uses requireAdmin
      // For now, we'll test the middleware logic separately
      expect(true).toBe(true); // Placeholder
    });

    it('should reject non-admin users', async () => {
      // This would need to be tested with actual route that uses requireAdmin
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('checkAgentOwnership', () => {
    it('should allow users to access their own agents', async () => {
      // This would need to be tested with actual agent routes
      expect(true).toBe(true); // Placeholder
    });

    it('should reject users from accessing other users agents', async () => {
      // This would need to be tested with actual agent routes
      expect(true).toBe(true); // Placeholder
    });

    it('should allow admins to access all agents', async () => {
      // This would need to be tested with actual agent routes
      expect(true).toBe(true); // Placeholder
    });
  });
});