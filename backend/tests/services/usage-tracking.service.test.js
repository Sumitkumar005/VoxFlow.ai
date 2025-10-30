const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { createClient } = require('@supabase/supabase-js');
const {
  trackUsage,
  checkAPICallLimit,
  getUserUsageStats,
  getDailyUsage,
  getMonthlyUsage,
  calculateCosts
} = require('../../src/services/usage-tracking.service.js');

// Mock Supabase
jest.mock('@supabase/supabase-js');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  single: jest.fn(),
  upsert: jest.fn(() => mockSupabase)
};

describe('Usage Tracking Service', () => {
  const testUserId = 'test-user-123';
  const testDate = '2024-01-15';
  const testUsageData = {
    provider: 'groq',
    tokens: 1000,
    calls: 5,
    duration: 300,
    costs: 2.50
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockReturnValue(mockSupabase);
    
    // Mock current date
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  describe('trackUsage', () => {
    it('should track usage successfully for new date', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, testUsageData);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: testUserId,
        date: testDate,
        total_tokens: testUsageData.tokens,
        total_calls: testUsageData.calls,
        total_duration_seconds: testUsageData.duration,
        api_costs: testUsageData.costs,
        updated_at: expect.any(String)
      });
    });

    it('should update existing usage record', async () => {
      const existingUsage = {
        total_tokens: 500,
        total_calls: 3,
        total_duration_seconds: 150,
        api_costs: 1.25
      };
      
      mockSupabase.single.mockResolvedValue({ data: existingUsage, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, testUsageData);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: testUserId,
        date: testDate,
        total_tokens: existingUsage.total_tokens + testUsageData.tokens,
        total_calls: existingUsage.total_calls + testUsageData.calls,
        total_duration_seconds: existingUsage.total_duration_seconds + testUsageData.duration,
        api_costs: existingUsage.api_costs + testUsageData.costs,
        updated_at: expect.any(String)
      });
    });

    it('should validate user ID', async () => {
      await expect(trackUsage('', testUsageData))
        .rejects.toThrow('User ID is required');
      
      await expect(trackUsage(null, testUsageData))
        .rejects.toThrow('User ID is required');
    });

    it('should validate usage data', async () => {
      await expect(trackUsage(testUserId, null))
        .rejects.toThrow('Usage data is required');
      
      await expect(trackUsage(testUserId, {}))
        .rejects.toThrow('Usage data is required');
    });

    it('should handle partial usage data', async () => {
      const partialData = { tokens: 100 };
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, partialData);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: testUserId,
        date: testDate,
        total_tokens: 100,
        total_calls: 0,
        total_duration_seconds: 0,
        api_costs: 0,
        updated_at: expect.any(String)
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(trackUsage(testUserId, testUsageData))
        .rejects.toThrow('Database error');
    });

    it('should handle negative values', async () => {
      const negativeData = { tokens: -100, calls: -1 };
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, negativeData);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: testUserId,
        date: testDate,
        total_tokens: 0, // Should be clamped to 0
        total_calls: 0,  // Should be clamped to 0
        total_duration_seconds: 0,
        api_costs: 0,
        updated_at: expect.any(String)
      });
    });
  });

  describe('checkAPICallLimit', () => {
    const mockUser = {
      monthly_token_quota: 10000,
      subscription_tier: 'pro'
    };

    it('should allow API call within limits', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 5000 }, 
        error: null 
      });

      const result = await checkAPICallLimit(testUserId, { tokens: 100 });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.details).toEqual({
        current_usage: 5000,
        limit: 10000,
        remaining: 5000,
        percentage_used: 50
      });
    });

    it('should deny API call when limit exceeded', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 9950 }, 
        error: null 
      });

      const result = await checkAPICallLimit(testUserId, { tokens: 100 });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('quota exceeded');
      expect(result.details.current_usage).toBe(9950);
      expect(result.details.limit).toBe(10000);
    });

    it('should handle user not found', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await expect(checkAPICallLimit(testUserId, { tokens: 100 }))
        .rejects.toThrow('User not found');
    });

    it('should handle missing usage data', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await checkAPICallLimit(testUserId, { tokens: 100 });

      expect(result.allowed).toBe(true);
      expect(result.details.current_usage).toBe(0);
    });

    it('should validate user ID', async () => {
      await expect(checkAPICallLimit('', { tokens: 100 }))
        .rejects.toThrow('User ID is required');
    });

    it('should validate usage data', async () => {
      await expect(checkAPICallLimit(testUserId, null))
        .rejects.toThrow('Usage data is required');
    });

    it('should handle unlimited quota', async () => {
      const unlimitedUser = { ...mockUser, monthly_token_quota: -1 };
      mockSupabase.single.mockResolvedValueOnce({ data: unlimitedUser, error: null });

      const result = await checkAPICallLimit(testUserId, { tokens: 100000 });

      expect(result.allowed).toBe(true);
      expect(result.details.limit).toBe(-1);
    });

    it('should apply different limits for subscription tiers', async () => {
      const freeUser = { ...mockUser, subscription_tier: 'free', monthly_token_quota: 1000 };
      mockSupabase.single.mockResolvedValueOnce({ data: freeUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 950 }, 
        error: null 
      });

      const result = await checkAPICallLimit(testUserId, { tokens: 100 });

      expect(result.allowed).toBe(false);
      expect(result.details.limit).toBe(1000);
    });
  });

  describe('getUserUsageStats', () => {
    it('should return user usage statistics', async () => {
      const mockUsageData = [
        { date: '2024-01-01', total_tokens: 1000, total_calls: 10, api_costs: 5.0 },
        { date: '2024-01-02', total_tokens: 1500, total_calls: 15, api_costs: 7.5 }
      ];
      
      mockSupabase.select.mockResolvedValue({ data: mockUsageData, error: null });

      const result = await getUserUsageStats(testUserId, '2024-01-01', '2024-01-31');

      expect(result).toEqual({
        total_tokens: 2500,
        total_calls: 25,
        total_costs: 12.5,
        daily_breakdown: mockUsageData
      });
    });

    it('should validate user ID', async () => {
      await expect(getUserUsageStats('', '2024-01-01', '2024-01-31'))
        .rejects.toThrow('User ID is required');
    });

    it('should validate date range', async () => {
      await expect(getUserUsageStats(testUserId, '', '2024-01-31'))
        .rejects.toThrow('Start date is required');
      
      await expect(getUserUsageStats(testUserId, '2024-01-01', ''))
        .rejects.toThrow('End date is required');
    });

    it('should handle empty results', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await getUserUsageStats(testUserId, '2024-01-01', '2024-01-31');

      expect(result).toEqual({
        total_tokens: 0,
        total_calls: 0,
        total_costs: 0,
        daily_breakdown: []
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(getUserUsageStats(testUserId, '2024-01-01', '2024-01-31'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getDailyUsage', () => {
    it('should return daily usage for specific date', async () => {
      const mockDailyUsage = {
        total_tokens: 1000,
        total_calls: 10,
        total_duration_seconds: 300,
        api_costs: 5.0
      };
      
      mockSupabase.single.mockResolvedValue({ data: mockDailyUsage, error: null });

      const result = await getDailyUsage(testUserId, testDate);

      expect(result).toEqual(mockDailyUsage);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', testUserId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('date', testDate);
    });

    it('should return zero usage for date with no data', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const result = await getDailyUsage(testUserId, testDate);

      expect(result).toEqual({
        total_tokens: 0,
        total_calls: 0,
        total_duration_seconds: 0,
        api_costs: 0
      });
    });

    it('should validate inputs', async () => {
      await expect(getDailyUsage('', testDate))
        .rejects.toThrow('User ID is required');
      
      await expect(getDailyUsage(testUserId, ''))
        .rejects.toThrow('Date is required');
    });
  });

  describe('getMonthlyUsage', () => {
    it('should return monthly usage aggregation', async () => {
      const mockMonthlyData = [
        { total_tokens: 1000, total_calls: 10, api_costs: 5.0 },
        { total_tokens: 1500, total_calls: 15, api_costs: 7.5 }
      ];
      
      mockSupabase.select.mockResolvedValue({ data: mockMonthlyData, error: null });

      const result = await getMonthlyUsage(testUserId, 2024, 1);

      expect(result).toEqual({
        total_tokens: 2500,
        total_calls: 25,
        total_costs: 12.5,
        month: 1,
        year: 2024
      });
    });

    it('should validate inputs', async () => {
      await expect(getMonthlyUsage('', 2024, 1))
        .rejects.toThrow('User ID is required');
      
      await expect(getMonthlyUsage(testUserId, 0, 1))
        .rejects.toThrow('Invalid year');
      
      await expect(getMonthlyUsage(testUserId, 2024, 0))
        .rejects.toThrow('Invalid month');
      
      await expect(getMonthlyUsage(testUserId, 2024, 13))
        .rejects.toThrow('Invalid month');
    });

    it('should handle empty monthly data', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await getMonthlyUsage(testUserId, 2024, 1);

      expect(result).toEqual({
        total_tokens: 0,
        total_calls: 0,
        total_costs: 0,
        month: 1,
        year: 2024
      });
    });
  });

  describe('calculateCosts', () => {
    it('should calculate costs for groq provider', () => {
      const usage = { provider: 'groq', tokens: 1000, duration: 0 };
      const cost = calculateCosts(usage);
      
      // Groq: $0.0000001 per token
      expect(cost).toBe(0.0001);
    });

    it('should calculate costs for deepgram provider', () => {
      const usage = { provider: 'deepgram', tokens: 0, duration: 60 };
      const cost = calculateCosts(usage);
      
      // Deepgram: $0.0025 per second
      expect(cost).toBe(0.15);
    });

    it('should calculate costs for twilio provider', () => {
      const usage = { provider: 'twilio', tokens: 0, duration: 60, calls: 1 };
      const cost = calculateCosts(usage);
      
      // Twilio: $0.0085 per minute + $0.0075 per call
      expect(cost).toBe(0.016);
    });

    it('should handle unknown provider', () => {
      const usage = { provider: 'unknown', tokens: 1000, duration: 60 };
      const cost = calculateCosts(usage);
      
      expect(cost).toBe(0);
    });

    it('should handle missing usage data', () => {
      const usage = { provider: 'groq' };
      const cost = calculateCosts(usage);
      
      expect(cost).toBe(0);
    });

    it('should handle negative values', () => {
      const usage = { provider: 'groq', tokens: -1000 };
      const cost = calculateCosts(usage);
      
      expect(cost).toBe(0);
    });

    it('should calculate combined costs', () => {
      const usage = { 
        provider: 'groq', 
        tokens: 1000, 
        duration: 60, 
        calls: 1 
      };
      const cost = calculateCosts(usage);
      
      // Should only use groq pricing (tokens)
      expect(cost).toBe(0.0001);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large numbers', async () => {
      const largeUsage = {
        tokens: Number.MAX_SAFE_INTEGER,
        calls: 1000000,
        duration: 86400,
        costs: 999999.99
      };
      
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, largeUsage);

      expect(result).toBe(true);
    });

    it('should handle concurrent usage tracking', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const promises = Array.from({ length: 5 }, (_, i) => 
        trackUsage(testUserId, { tokens: 100 * (i + 1) })
      );

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true, true, true]);
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(5);
    });

    it('should handle malformed dates', async () => {
      await expect(getDailyUsage(testUserId, 'invalid-date'))
        .rejects.toThrow();
    });

    it('should handle timezone considerations', async () => {
      // Test with different timezone
      jest.setSystemTime(new Date('2024-01-15T23:59:59Z'));
      
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await trackUsage(testUserId, testUsageData);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2024-01-15' // Should still be same date
        })
      );
    });

    it('should handle database connection issues', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Connection failed'));

      await expect(trackUsage(testUserId, testUsageData))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('Performance Tests', () => {
    it('should complete usage tracking within reasonable time', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const startTime = Date.now();
      await trackUsage(testUserId, testUsageData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle batch usage tracking efficiently', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const batchSize = 10;
      const promises = Array.from({ length: batchSize }, (_, i) => 
        trackUsage(`user-${i}`, { tokens: 100 })
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(batchSize);
      expect(results.every(r => r === true)).toBe(true);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });
});