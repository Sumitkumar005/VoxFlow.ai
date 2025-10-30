const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { createClient } = require('@supabase/supabase-js');
const {
  checkAgentLimit,
  checkTokenLimit,
  checkCallLimit,
  enforceUserLimits,
  getUserLimits,
  updateUserLimits,
  getUsagePercentage
} = require('../../src/services/limit-enforcement.service.js');

// Mock Supabase
jest.mock('@supabase/supabase-js');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  count: jest.fn(() => mockSupabase),
  single: jest.fn(),
  head: jest.fn(() => mockSupabase)
};

describe('Limit Enforcement Service', () => {
  const testUserId = 'test-user-123';
  const mockUser = {
    id: testUserId,
    max_agents: 5,
    monthly_token_quota: 10000,
    subscription_tier: 'pro',
    is_active: true
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

  describe('checkAgentLimit', () => {
    it('should allow agent creation within limit', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValueOnce({ count: 3, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.current_count).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(2);
    });

    it('should deny agent creation when limit reached', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValueOnce({ count: 5, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.current_count).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('agent limit');
    });

    it('should deny agent creation when limit exceeded', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValueOnce({ count: 6, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.current_count).toBe(6);
      expect(result.remaining).toBe(-1);
    });

    it('should handle unlimited agents for admin users', async () => {
      const adminUser = { ...mockUser, max_agents: -1, subscription_tier: 'enterprise' };
      mockSupabase.single.mockResolvedValueOnce({ data: adminUser, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it('should handle user not found', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await expect(checkAgentLimit(testUserId))
        .rejects.toThrow('User not found');
    });

    it('should handle inactive users', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      mockSupabase.single.mockResolvedValueOnce({ data: inactiveUser, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('should validate user ID', async () => {
      await expect(checkAgentLimit(''))
        .rejects.toThrow('User ID is required');
      
      await expect(checkAgentLimit(null))
        .rejects.toThrow('User ID is required');
    });

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(checkAgentLimit(testUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('checkTokenLimit', () => {
    it('should allow token usage within limit', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 5000 }, 
        error: null 
      });

      const result = await checkTokenLimit(testUserId, 1000);

      expect(result.allowed).toBe(true);
      expect(result.current_usage).toBe(5000);
      expect(result.limit).toBe(10000);
      expect(result.remaining).toBe(5000);
      expect(result.would_exceed).toBe(false);
    });

    it('should deny token usage when would exceed limit', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 9500 }, 
        error: null 
      });

      const result = await checkTokenLimit(testUserId, 1000);

      expect(result.allowed).toBe(false);
      expect(result.current_usage).toBe(9500);
      expect(result.would_exceed).toBe(true);
      expect(result.reason).toContain('token quota');
    });

    it('should handle unlimited tokens', async () => {
      const unlimitedUser = { ...mockUser, monthly_token_quota: -1 };
      mockSupabase.single.mockResolvedValueOnce({ data: unlimitedUser, error: null });

      const result = await checkTokenLimit(testUserId, 100000);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it('should handle zero token request', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 5000 }, 
        error: null 
      });

      const result = await checkTokenLimit(testUserId, 0);

      expect(result.allowed).toBe(true);
      expect(result.would_exceed).toBe(false);
    });

    it('should handle missing usage data', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await checkTokenLimit(testUserId, 1000);

      expect(result.allowed).toBe(true);
      expect(result.current_usage).toBe(0);
    });

    it('should validate inputs', async () => {
      await expect(checkTokenLimit('', 1000))
        .rejects.toThrow('User ID is required');
      
      await expect(checkTokenLimit(testUserId, -100))
        .rejects.toThrow('Token count must be non-negative');
    });
  });

  describe('checkCallLimit', () => {
    it('should allow calls within reasonable limits', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_calls: 50 }, 
        error: null 
      });

      const result = await checkCallLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.current_calls).toBe(50);
      expect(result.daily_limit).toBeDefined();
    });

    it('should deny calls when daily limit exceeded', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_calls: 1000 }, 
        error: null 
      });

      const result = await checkCallLimit(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.current_calls).toBe(1000);
      expect(result.reason).toContain('daily call limit');
    });

    it('should apply different limits based on subscription tier', async () => {
      const freeUser = { ...mockUser, subscription_tier: 'free' };
      mockSupabase.single.mockResolvedValueOnce({ data: freeUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_calls: 50 }, 
        error: null 
      });

      const result = await checkCallLimit(testUserId);

      expect(result.allowed).toBe(false); // Free tier has lower limit
      expect(result.daily_limit).toBeLessThan(100);
    });

    it('should handle enterprise unlimited calls', async () => {
      const enterpriseUser = { ...mockUser, subscription_tier: 'enterprise' };
      mockSupabase.single.mockResolvedValueOnce({ data: enterpriseUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_calls: 5000 }, 
        error: null 
      });

      const result = await checkCallLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.daily_limit).toBe(-1);
    });

    it('should validate user ID', async () => {
      await expect(checkCallLimit(''))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('enforceUserLimits', () => {
    it('should enforce all limits successfully', async () => {
      // Mock agent limit check
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValueOnce({ count: 3, error: null });
      
      // Mock token limit check
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 5000 }, 
        error: null 
      });
      
      // Mock call limit check
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_calls: 50 }, 
        error: null 
      });

      const result = await enforceUserLimits(testUserId, {
        check_agents: true,
        check_tokens: 1000,
        check_calls: true
      });

      expect(result.allowed).toBe(true);
      expect(result.limits_checked).toEqual(['agents', 'tokens', 'calls']);
      expect(result.violations).toEqual([]);
    });

    it('should detect limit violations', async () => {
      // Mock agent limit exceeded
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValueOnce({ count: 6, error: null });

      const result = await enforceUserLimits(testUserId, {
        check_agents: true
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('agents');
      expect(result.violations[0].exceeded).toBe(true);
    });

    it('should handle partial limit checks', async () => {
      // Only check tokens
      mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { total_tokens: 5000 }, 
        error: null 
      });

      const result = await enforceUserLimits(testUserId, {
        check_tokens: 1000
      });

      expect(result.allowed).toBe(true);
      expect(result.limits_checked).toEqual(['tokens']);
    });

    it('should validate inputs', async () => {
      await expect(enforceUserLimits('', {}))
        .rejects.toThrow('User ID is required');
      
      await expect(enforceUserLimits(testUserId, null))
        .rejects.toThrow('Limits configuration is required');
    });
  });

  describe('getUserLimits', () => {
    it('should return user limits', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });

      const result = await getUserLimits(testUserId);

      expect(result).toEqual({
        max_agents: 5,
        monthly_token_quota: 10000,
        subscription_tier: 'pro',
        is_active: true,
        daily_call_limit: expect.any(Number)
      });
    });

    it('should handle user not found', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await expect(getUserLimits(testUserId))
        .rejects.toThrow('User not found');
    });

    it('should validate user ID', async () => {
      await expect(getUserLimits(''))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('updateUserLimits', () => {
    it('should update user limits successfully', async () => {
      const newLimits = {
        max_agents: 10,
        monthly_token_quota: 20000
      };
      
      mockSupabase.update.mockResolvedValue({ 
        data: { ...mockUser, ...newLimits }, 
        error: null 
      });

      const result = await updateUserLimits(testUserId, newLimits);

      expect(result).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(newLimits);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', testUserId);
    });

    it('should validate limit values', async () => {
      await expect(updateUserLimits(testUserId, { max_agents: -5 }))
        .rejects.toThrow('Invalid limit value');
      
      await expect(updateUserLimits(testUserId, { monthly_token_quota: -100 }))
        .rejects.toThrow('Invalid limit value');
    });

    it('should handle database errors', async () => {
      mockSupabase.update.mockResolvedValue({ 
        data: null, 
        error: { message: 'Update failed' } 
      });

      await expect(updateUserLimits(testUserId, { max_agents: 10 }))
        .rejects.toThrow('Update failed');
    });

    it('should validate inputs', async () => {
      await expect(updateUserLimits('', { max_agents: 10 }))
        .rejects.toThrow('User ID is required');
      
      await expect(updateUserLimits(testUserId, null))
        .rejects.toThrow('Limits data is required');
      
      await expect(updateUserLimits(testUserId, {}))
        .rejects.toThrow('No limits to update');
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate usage percentage correctly', () => {
      expect(getUsagePercentage(500, 1000)).toBe(50);
      expect(getUsagePercentage(750, 1000)).toBe(75);
      expect(getUsagePercentage(1000, 1000)).toBe(100);
      expect(getUsagePercentage(1200, 1000)).toBe(120);
    });

    it('should handle unlimited quotas', () => {
      expect(getUsagePercentage(1000, -1)).toBe(0);
      expect(getUsagePercentage(0, -1)).toBe(0);
    });

    it('should handle zero limits', () => {
      expect(getUsagePercentage(100, 0)).toBe(Infinity);
      expect(getUsagePercentage(0, 0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(getUsagePercentage(-100, 1000)).toBe(0);
      expect(getUsagePercentage(100, -100)).toBe(0);
    });

    it('should round to appropriate precision', () => {
      expect(getUsagePercentage(333, 1000)).toBe(33.3);
      expect(getUsagePercentage(666, 1000)).toBe(66.6);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent limit checks', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValue({ count: 3, error: null });

      const promises = Array.from({ length: 5 }, () => checkAgentLimit(testUserId));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.allowed).toBe(true);
        expect(result.current_count).toBe(3);
      });
    });

    it('should handle very large numbers', async () => {
      const largeUser = { 
        ...mockUser, 
        max_agents: Number.MAX_SAFE_INTEGER,
        monthly_token_quota: Number.MAX_SAFE_INTEGER
      };
      
      mockSupabase.single.mockResolvedValue({ data: largeUser, error: null });
      mockSupabase.head.mockResolvedValue({ count: 1000000, error: null });

      const result = await checkAgentLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle malformed user data', async () => {
      const malformedUser = { 
        id: testUserId,
        max_agents: 'invalid',
        monthly_token_quota: null
      };
      
      mockSupabase.single.mockResolvedValue({ data: malformedUser, error: null });

      await expect(checkAgentLimit(testUserId))
        .rejects.toThrow();
    });

    it('should handle database connection timeouts', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Connection timeout'));

      await expect(checkAgentLimit(testUserId))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle subscription tier edge cases', async () => {
      const unknownTierUser = { ...mockUser, subscription_tier: 'unknown' };
      mockSupabase.single.mockResolvedValue({ data: unknownTierUser, error: null });
      mockSupabase.single.mockResolvedValue({ data: { total_calls: 50 }, error: null });

      const result = await checkCallLimit(testUserId);

      // Should default to most restrictive limits
      expect(result.daily_limit).toBeDefined();
      expect(typeof result.daily_limit).toBe('number');
    });
  });

  describe('Performance Tests', () => {
    it('should complete limit checks within reasonable time', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValue({ count: 3, error: null });

      const startTime = Date.now();
      await checkAgentLimit(testUserId);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle batch limit checks efficiently', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
      mockSupabase.head.mockResolvedValue({ count: 3, error: null });

      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
      const promises = userIds.map(id => checkAgentLimit(id));

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});