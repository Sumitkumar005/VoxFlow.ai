import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  trackUsage,
  getCurrentMonthUsage,
  getUsageHistory,
  getUserLimitsAndUsage,
  checkUsageLimits,
  getMultiUserUsageStats,
  calculateEstimatedCost,
  COST_RATES,
} from '../src/services/usage-tracking.service.js';
import { query } from '../src/utils/supabase.js';

// Mock the supabase utility
jest.mock('../src/utils/supabase.js');

describe('Usage Tracking Service', () => {
  const testUserId = 'user-123';
  const testDate = '2024-01-15';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock Date to return consistent date
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(`${testDate}T10:00:00.000Z`);
  });

  afterEach(() => {
    // Restore Date mock
    jest.restoreAllMocks();
  });

  describe('trackUsage', () => {
    it('should track Groq usage successfully', async () => {
      const usage = {
        provider: 'groq',
        tokens: 1000,
        calls: 1,
      };

      // Mock no existing record
      query.mockResolvedValueOnce({ data: [], error: null });
      // Mock successful insert
      query.mockResolvedValueOnce({ data: [{ id: 'usage-1' }], error: null });

      const result = await trackUsage(testUserId, usage);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('groq');
      expect(result.usage.tokens).toBe(1000);
      expect(result.usage.cost).toBe(0.0001); // 1000 * 0.0000001
      expect(result.date).toBe(testDate);
    });

    it('should track Deepgram usage successfully', async () => {
      const usage = {
        provider: 'deepgram',
        duration: 60, // 60 seconds
        calls: 1,
      };

      query.mockResolvedValueOnce({ data: [], error: null });
      query.mockResolvedValueOnce({ data: [{ id: 'usage-1' }], error: null });

      const result = await trackUsage(testUserId, usage);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('deepgram');
      expect(result.usage.duration).toBe(60);
      expect(result.usage.cost).toBe(0.15); // 60 * 0.0025
    });

    it('should track Twilio usage successfully', async () => {
      const usage = {
        provider: 'twilio',
        duration: 120, // 2 minutes
        calls: 1,
      };

      query.mockResolvedValueOnce({ data: [], error: null });
      query.mockResolvedValueOnce({ data: [{ id: 'usage-1' }], error: null });

      const result = await trackUsage(testUserId, usage);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');
      expect(result.usage.duration).toBe(120);
      expect(result.usage.cost).toBe(0.028); // (120/60) * 0.0140
    });

    it('should update existing usage record', async () => {
      const usage = {
        provider: 'groq',
        tokens: 500,
        calls: 1,
      };

      const existingRecord = {
        total_tokens: 1000,
        total_calls: 2,
        total_duration_seconds: 0,
        api_costs: 0.0001,
      };

      // Mock existing record found
      query.mockResolvedValueOnce({ data: [existingRecord], error: null });
      // Mock successful update
      query.mockResolvedValueOnce({ data: [], error: null });

      const result = await trackUsage(testUserId, usage);

      expect(result.success).toBe(true);
      expect(query).toHaveBeenCalledWith('user_usage_tracking', 'update', expect.objectContaining({
        filter: { user_id: testUserId, date: testDate },
        data: expect.objectContaining({
          total_tokens: 1500, // 1000 + 500
          total_calls: 3, // 2 + 1
          api_costs: 0.00015, // 0.0001 + 0.00005
        }),
      }));
    });

    it('should throw error for invalid user ID', async () => {
      await expect(trackUsage('', { provider: 'groq', tokens: 100 }))
        .rejects.toThrow('Invalid user ID');
      
      await expect(trackUsage(null, { provider: 'groq', tokens: 100 }))
        .rejects.toThrow('Invalid user ID');
    });

    it('should throw error for invalid provider', async () => {
      await expect(trackUsage(testUserId, { provider: 'invalid', tokens: 100 }))
        .rejects.toThrow('Invalid or unsupported provider');
    });

    it('should handle database errors', async () => {
      query.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(trackUsage(testUserId, { provider: 'groq', tokens: 100 }))
        .rejects.toThrow('Database error');
    });
  });

  describe('getCurrentMonthUsage', () => {
    it('should return current month usage summary', async () => {
      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 1000,
          total_calls: 5,
          total_duration_seconds: 300,
          api_costs: 0.001,
        },
        {
          date: '2024-01-02',
          total_tokens: 500,
          total_calls: 2,
          total_duration_seconds: 120,
          api_costs: 0.0005,
        },
      ];

      query.mockResolvedValueOnce({
        data: mockUsageData,
        error: null,
      });

      const result = await getCurrentMonthUsage(testUserId);

      expect(result.month).toBe('2024-01');
      expect(result.daily_usage).toEqual(mockUsageData);
      expect(result.summary.total_tokens).toBe(1500);
      expect(result.summary.total_calls).toBe(7);
      expect(result.summary.total_duration_seconds).toBe(420);
      expect(result.summary.total_costs).toBe(0.0015);
      expect(result.summary.days_active).toBe(2);
      expect(result.summary.average_cost_per_call).toBe(0.000214); // 0.0015 / 7
    });

    it('should handle no usage data', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await getCurrentMonthUsage(testUserId);

      expect(result.summary.total_tokens).toBe(0);
      expect(result.summary.total_calls).toBe(0);
      expect(result.summary.total_costs).toBe(0);
      expect(result.summary.days_active).toBe(0);
      expect(result.summary.average_cost_per_call).toBe(0);
    });
  });

  describe('getUsageHistory', () => {
    it('should return usage history with default options', async () => {
      const mockData = [
        {
          date: '2024-01-15',
          total_tokens: 1000,
          total_calls: 5,
          total_duration_seconds: 300,
          api_costs: '0.001',
          updated_at: '2024-01-15T10:00:00Z',
        },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await getUsageHistory(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].api_costs).toBe(0.001); // Converted to number
      expect(result[0].total_tokens).toBe(1000);
    });

    it('should filter by date range', async () => {
      const mockData = [
        { date: '2024-01-10', total_tokens: 100, api_costs: '0.0001' },
        { date: '2024-01-15', total_tokens: 200, api_costs: '0.0002' },
        { date: '2024-01-20', total_tokens: 300, api_costs: '0.0003' },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await getUsageHistory(testUserId, {
        startDate: '2024-01-12',
        endDate: '2024-01-18',
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
    });
  });

  describe('getUserLimitsAndUsage', () => {
    it('should return user limits and current usage', async () => {
      const mockUser = {
        max_agents: 5,
        monthly_token_quota: 10000,
        subscription_tier: 'pro',
        role: 'user',
      };

      const mockAgents = [
        { id: 'agent-1' },
        { id: 'agent-2' },
      ];

      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 2000,
          total_calls: 10,
          api_costs: 0.002,
        },
      ];

      // Mock user data
      query.mockResolvedValueOnce({ data: [mockUser], error: null });
      // Mock agent count
      query.mockResolvedValueOnce({ data: mockAgents, error: null });
      // Mock usage data
      query.mockResolvedValueOnce({ data: mockUsageData, error: null });

      const result = await getUserLimitsAndUsage(testUserId);

      expect(result.limits.max_agents).toBe(5);
      expect(result.limits.monthly_token_quota).toBe(10000);
      expect(result.current_usage.agents).toBe(2);
      expect(result.current_usage.tokens_this_month).toBe(2000);
      expect(result.remaining.agents).toBe(3);
      expect(result.remaining.tokens).toBe(8000);
      expect(result.usage_percentage.agents).toBe(40); // 2/5 * 100
      expect(result.usage_percentage.tokens).toBe(20); // 2000/10000 * 100
    });

    it('should handle user not found', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      await expect(getUserLimitsAndUsage(testUserId))
        .rejects.toThrow('User not found');
    });
  });

  describe('checkUsageLimits', () => {
    it('should allow usage within limits', async () => {
      const mockUser = {
        max_agents: 5,
        monthly_token_quota: 10000,
        subscription_tier: 'pro',
        role: 'user',
      };

      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 2000,
          total_calls: 10,
          api_costs: 0.002,
        },
      ];

      query.mockResolvedValueOnce({ data: [mockUser], error: null });
      query.mockResolvedValueOnce({ data: [], error: null }); // No agents
      query.mockResolvedValueOnce({ data: mockUsageData, error: null });

      const result = await checkUsageLimits(testUserId, { tokens: 1000 });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within usage limits');
    });

    it('should reject usage exceeding token quota', async () => {
      const mockUser = {
        max_agents: 5,
        monthly_token_quota: 10000,
        subscription_tier: 'pro',
        role: 'user',
      };

      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 9500,
          total_calls: 10,
          api_costs: 0.002,
        },
      ];

      query.mockResolvedValueOnce({ data: [mockUser], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });
      query.mockResolvedValueOnce({ data: mockUsageData, error: null });

      const result = await checkUsageLimits(testUserId, { tokens: 1000 });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Monthly token quota exceeded');
      expect(result.details.requested_tokens).toBe(1000);
      expect(result.details.remaining_tokens).toBe(500);
    });

    it('should allow unlimited access for admin users', async () => {
      const mockAdmin = {
        max_agents: 100,
        monthly_token_quota: 1000000,
        subscription_tier: 'enterprise',
        role: 'admin',
      };

      query.mockResolvedValueOnce({ data: [mockAdmin], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const result = await checkUsageLimits(testUserId, { tokens: 999999 });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin users have unlimited access');
    });
  });

  describe('getMultiUserUsageStats', () => {
    it('should return usage statistics for multiple users', async () => {
      const mockUsageData = [
        {
          user_id: 'user-1',
          date: '2024-01-01',
          total_tokens: 1000,
          total_calls: 5,
          total_duration_seconds: 300,
          api_costs: 0.001,
        },
        {
          user_id: 'user-2',
          date: '2024-01-01',
          total_tokens: 2000,
          total_calls: 10,
          total_duration_seconds: 600,
          api_costs: 0.002,
        },
      ];

      const mockUserData = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          subscription_tier: 'free',
          organization_name: 'Org 1',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          subscription_tier: 'pro',
          organization_name: 'Org 2',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      query
        .mockResolvedValueOnce({ data: mockUsageData, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      const result = await getMultiUserUsageStats();

      expect(result).toHaveLength(2);
      expect(result[0].usage.total_costs).toBe(0.002); // user-2 (higher cost)
      expect(result[1].usage.total_costs).toBe(0.001); // user-1 (lower cost)
    });
  });

  describe('calculateEstimatedCost', () => {
    it('should calculate Groq cost correctly', () => {
      const cost = calculateEstimatedCost('groq', { tokens: 1000000 });
      expect(cost).toBe(0.1); // 1M tokens * $0.10 per 1M tokens
    });

    it('should calculate Deepgram cost correctly', () => {
      const cost = calculateEstimatedCost('deepgram', { duration: 60 });
      expect(cost).toBe(0.15); // 60 seconds * $0.0025 per second
    });

    it('should calculate Twilio cost correctly', () => {
      const cost = calculateEstimatedCost('twilio', { duration: 120 });
      expect(cost).toBe(0.028); // 2 minutes * $0.0140 per minute
    });

    it('should throw error for unsupported provider', () => {
      expect(() => calculateEstimatedCost('unsupported', { tokens: 100 }))
        .toThrow('Unsupported provider');
    });
  });

  describe('COST_RATES', () => {
    it('should export correct cost rates', () => {
      expect(COST_RATES.groq.per_token).toBe(0.0000001);
      expect(COST_RATES.deepgram.per_second).toBe(0.0025);
      expect(COST_RATES.twilio.per_minute).toBe(0.0140);
    });
  });
});