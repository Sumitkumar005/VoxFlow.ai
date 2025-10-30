import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  checkAgentCreationLimit,
  checkAPICallLimit,
  getUpgradeSuggestion,
  checkRateLimit,
  getUserLimitsWithWarnings,
  updateUserSubscriptionTier,
  getSubscriptionTiers,
  validateBulkOperation,
  SUBSCRIPTION_TIERS,
} from '../src/services/limit-enforcement.service.js';
import { query } from '../src/utils/supabase.js';

// Mock the supabase utility and usage tracking service
jest.mock('../src/utils/supabase.js');
jest.mock('../src/services/usage-tracking.service.js', () => ({
  getUserLimitsAndUsage: jest.fn(),
  checkUsageLimits: jest.fn(),
}));

import { getUserLimitsAndUsage, checkUsageLimits } from '../src/services/usage-tracking.service.js';

describe('Limit Enforcement Service', () => {
  const testUserId = 'user-123';
  const adminUserId = 'admin-123';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('checkAgentCreationLimit', () => {
    it('should allow agent creation within limits', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 5,
          monthly_token_quota: 10000,
          subscription_tier: 'pro',
          role: 'user',
        },
        current_usage: {
          agents: 2,
          tokens_this_month: 1000,
        },
        remaining: {
          agents: 3,
          tokens: 9000,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await checkAgentCreationLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within agent limits');
      expect(result.details.current_agents).toBe(2);
      expect(result.details.remaining_agents).toBe(3);
    });

    it('should reject agent creation when limit reached', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 2,
          monthly_token_quota: 1000,
          subscription_tier: 'free',
          role: 'user',
        },
        current_usage: {
          agents: 2,
          tokens_this_month: 500,
        },
        remaining: {
          agents: 0,
          tokens: 500,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await checkAgentCreationLimit(testUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Agent limit reached');
      expect(result.details.current_agents).toBe(2);
      expect(result.details.max_agents).toBe(2);
      expect(result.details.upgrade_suggestion).toBeDefined();
      expect(result.details.upgrade_suggestion.suggested_tier).toBe('pro');
    });

    it('should allow unlimited agent creation for admin users', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 100,
          monthly_token_quota: 1000000,
          subscription_tier: 'enterprise',
          role: 'admin',
        },
        current_usage: {
          agents: 150, // Exceeds normal limit
          tokens_this_month: 500000,
        },
        remaining: {
          agents: -50, // Negative remaining
          tokens: 500000,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await checkAgentCreationLimit(testUserId);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin users have unlimited agent creation');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(checkAgentCreationLimit(''))
        .rejects.toThrow('Invalid user ID');
      
      await expect(checkAgentCreationLimit(null))
        .rejects.toThrow('Invalid user ID');
    });
  });

  describe('checkAPICallLimit', () => {
    it('should allow API call within limits', async () => {
      const mockResult = {
        allowed: true,
        reason: 'Within usage limits',
        limits_info: {
          limits: { subscription_tier: 'pro' },
        },
      };

      checkUsageLimits.mockResolvedValueOnce(mockResult);

      const result = await checkAPICallLimit(testUserId, { tokens: 100 });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within usage limits');
    });

    it('should reject API call exceeding limits and add upgrade suggestion', async () => {
      const mockResult = {
        allowed: false,
        reason: 'Monthly token quota exceeded',
        details: {
          requested_tokens: 1000,
          remaining_tokens: 100,
        },
        limits_info: {
          limits: { subscription_tier: 'free' },
        },
      };

      checkUsageLimits.mockResolvedValueOnce(mockResult);

      const result = await checkAPICallLimit(testUserId, { tokens: 1000 });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Monthly token quota exceeded');
      expect(result.details.upgrade_suggestion).toBeDefined();
      expect(result.details.upgrade_suggestion.suggested_tier).toBe('pro');
    });

    it('should throw error for invalid inputs', async () => {
      await expect(checkAPICallLimit('', { tokens: 100 }))
        .rejects.toThrow('Invalid user ID');
      
      await expect(checkAPICallLimit(testUserId, null))
        .rejects.toThrow('Invalid estimated usage data');
    });
  });

  describe('getUpgradeSuggestion', () => {
    it('should suggest upgrade from free to pro', () => {
      const suggestion = getUpgradeSuggestion('free', 'agents');

      expect(suggestion.suggested_tier).toBe('pro');
      expect(suggestion.tier_name).toBe('Pro');
      expect(suggestion.price).toBe(29);
      expect(suggestion.new_limit).toBe(10);
      expect(suggestion.message).toContain('Upgrade to Pro for 10 agents');
    });

    it('should suggest upgrade from pro to enterprise', () => {
      const suggestion = getUpgradeSuggestion('pro', 'tokens');

      expect(suggestion.suggested_tier).toBe('enterprise');
      expect(suggestion.tier_name).toBe('Enterprise');
      expect(suggestion.price).toBe(299);
      expect(suggestion.new_limit).toBe(1000000);
    });

    it('should return no suggestion for highest tier', () => {
      const suggestion = getUpgradeSuggestion('enterprise', 'agents');

      expect(suggestion.suggested_tier).toBeNull();
      expect(suggestion.message).toBe('You are already on the highest tier');
    });

    it('should handle invalid tier', () => {
      const suggestion = getUpgradeSuggestion('invalid', 'agents');

      expect(suggestion.suggested_tier).toBeNull();
      expect(suggestion.message).toBe('You are already on the highest tier');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limits', async () => {
      const mockUser = {
        subscription_tier: 'pro',
        role: 'user',
      };

      query.mockResolvedValueOnce({
        data: [mockUser],
        error: null,
      });

      const result = await checkRateLimit(testUserId, '/api/agents');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within rate limits');
      expect(result.rate_limit).toBe(60); // Pro tier limit
    });

    it('should allow unlimited requests for admin users', async () => {
      const mockAdmin = {
        subscription_tier: 'enterprise',
        role: 'admin',
      };

      query.mockResolvedValueOnce({
        data: [mockAdmin],
        error: null,
      });

      const result = await checkRateLimit(testUserId, '/api/agents');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin users have no rate limits');
    });

    it('should handle user not found', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(checkRateLimit(testUserId, '/api/agents'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getUserLimitsWithWarnings', () => {
    it('should return warnings for approaching limits', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 5,
          monthly_token_quota: 1000,
          subscription_tier: 'free',
          role: 'user',
        },
        current_usage: {
          agents: 4, // 80% of limit
          tokens_this_month: 850, // 85% of limit
        },
        remaining: {
          agents: 1,
          tokens: 150,
        },
        usage_percentage: {
          agents: 80,
          tokens: 85,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await getUserLimitsWithWarnings(testUserId);

      expect(result.has_warnings).toBe(true);
      expect(result.warnings).toHaveLength(2);
      
      const agentWarning = result.warnings.find(w => w.type === 'agent_limit_warning');
      const tokenWarning = result.warnings.find(w => w.type === 'token_limit_warning');
      
      expect(agentWarning).toBeDefined();
      expect(agentWarning.message).toContain('80.0% of your agent limit');
      
      expect(tokenWarning).toBeDefined();
      expect(tokenWarning.message).toContain('85.0% of your monthly token quota');
    });

    it('should return exceeded limit warnings', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 2,
          monthly_token_quota: 1000,
          subscription_tier: 'free',
          role: 'user',
        },
        current_usage: {
          agents: 2,
          tokens_this_month: 1100, // Exceeded
        },
        remaining: {
          agents: 0, // Exceeded
          tokens: -100, // Exceeded
        },
        usage_percentage: {
          agents: 100,
          tokens: 110,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await getUserLimitsWithWarnings(testUserId);

      expect(result.has_warnings).toBe(true);
      
      const agentExceeded = result.warnings.find(w => w.type === 'agent_limit_exceeded');
      const tokenExceeded = result.warnings.find(w => w.type === 'token_limit_exceeded');
      
      expect(agentExceeded).toBeDefined();
      expect(agentExceeded.message).toContain('Agent limit reached');
      expect(agentExceeded.suggestion).toBeDefined();
      
      expect(tokenExceeded).toBeDefined();
      expect(tokenExceeded.message).toContain('Monthly token quota exceeded');
      expect(tokenExceeded.suggestion).toBeDefined();
    });

    it('should return no warnings when within limits', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 10,
          monthly_token_quota: 50000,
          subscription_tier: 'pro',
          role: 'user',
        },
        current_usage: {
          agents: 3, // 30% of limit
          tokens_this_month: 15000, // 30% of limit
        },
        remaining: {
          agents: 7,
          tokens: 35000,
        },
        usage_percentage: {
          agents: 30,
          tokens: 30,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const result = await getUserLimitsWithWarnings(testUserId);

      expect(result.has_warnings).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('updateUserSubscriptionTier', () => {
    it('should update user subscription tier successfully', async () => {
      const mockUpdatedUser = {
        id: testUserId,
        subscription_tier: 'pro',
        max_agents: 10,
        monthly_token_quota: 50000,
      };

      // Mock user update
      query.mockResolvedValueOnce({
        data: [mockUpdatedUser],
        error: null,
      });
      // Mock subscription upsert
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });
      // Mock audit log
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await updateUserSubscriptionTier(testUserId, 'pro', adminUserId);

      expect(result.success).toBe(true);
      expect(result.new_tier).toBe('pro');
      expect(result.new_limits.max_agents).toBe(10);
      expect(result.new_limits.monthly_token_quota).toBe(50000);
    });

    it('should throw error for invalid tier', async () => {
      await expect(updateUserSubscriptionTier(testUserId, 'invalid-tier'))
        .rejects.toThrow('Invalid subscription tier');
    });

    it('should handle user not found', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(updateUserSubscriptionTier(testUserId, 'pro'))
        .rejects.toThrow('User not found');
    });
  });

  describe('getSubscriptionTiers', () => {
    it('should return all subscription tiers', () => {
      const result = getSubscriptionTiers();

      expect(result.tiers).toEqual(SUBSCRIPTION_TIERS);
      expect(result.comparison).toHaveLength(3);
      expect(result.comparison[0].tier).toBe('free');
      expect(result.comparison[1].tier).toBe('pro');
      expect(result.comparison[2].tier).toBe('enterprise');
    });
  });

  describe('validateBulkOperation', () => {
    it('should allow bulk operation within limits', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 10,
          monthly_token_quota: 50000,
          subscription_tier: 'pro',
          role: 'user',
        },
        current_usage: {
          agents: 5,
          tokens_this_month: 10000,
        },
        remaining: {
          agents: 5,
          tokens: 40000,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const operation = {
        type: 'campaign',
        estimated_calls: 50,
        estimated_tokens: 100, // 50 * 100 = 5000 total tokens
      };

      const result = await validateBulkOperation(testUserId, operation);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Bulk operation within limits');
      expect(result.operation_details.estimated_tokens).toBe(5000);
      expect(result.operation_details.remaining_tokens_after).toBe(35000);
    });

    it('should reject bulk operation exceeding token quota', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 2,
          monthly_token_quota: 1000,
          subscription_tier: 'free',
          role: 'user',
        },
        current_usage: {
          agents: 1,
          tokens_this_month: 500,
        },
        remaining: {
          agents: 1,
          tokens: 500,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const operation = {
        type: 'campaign',
        estimated_calls: 100,
        estimated_tokens: 10, // 100 * 10 = 1000 total tokens (exceeds remaining 500)
      };

      const result = await validateBulkOperation(testUserId, operation);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Bulk operation would exceed monthly token quota');
      expect(result.details.total_estimated_tokens).toBe(1000);
      expect(result.details.remaining_tokens).toBe(500);
      expect(result.details.upgrade_suggestion).toBeDefined();
    });

    it('should reject bulk operation exceeding recommended calls for tier', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 2,
          monthly_token_quota: 1000,
          subscription_tier: 'free',
          role: 'user',
        },
        current_usage: {
          agents: 1,
          tokens_this_month: 100,
        },
        remaining: {
          agents: 1,
          tokens: 900,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const operation = {
        type: 'campaign',
        estimated_calls: 50, // Exceeds free tier recommendation of 10
        estimated_tokens: 1, // Total: 50 tokens (within quota)
      };

      const result = await validateBulkOperation(testUserId, operation);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds recommended limit for free tier');
      expect(result.details.estimated_calls).toBe(50);
      expect(result.details.max_recommended_calls).toBe(10);
    });

    it('should allow unlimited bulk operations for admin users', async () => {
      const mockLimitsAndUsage = {
        limits: {
          max_agents: 100,
          monthly_token_quota: 1000000,
          subscription_tier: 'enterprise',
          role: 'admin',
        },
        current_usage: {
          agents: 50,
          tokens_this_month: 500000,
        },
        remaining: {
          agents: 50,
          tokens: 500000,
        },
      };

      getUserLimitsAndUsage.mockResolvedValueOnce(mockLimitsAndUsage);

      const operation = {
        type: 'campaign',
        estimated_calls: 10000, // Very large operation
        estimated_tokens: 1000,
      };

      const result = await validateBulkOperation(testUserId, operation);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin users have unlimited access');
    });
  });

  describe('SUBSCRIPTION_TIERS', () => {
    it('should export correct subscription tiers', () => {
      expect(SUBSCRIPTION_TIERS.free.max_agents).toBe(2);
      expect(SUBSCRIPTION_TIERS.free.monthly_token_quota).toBe(1000);
      expect(SUBSCRIPTION_TIERS.free.price).toBe(0);

      expect(SUBSCRIPTION_TIERS.pro.max_agents).toBe(10);
      expect(SUBSCRIPTION_TIERS.pro.monthly_token_quota).toBe(50000);
      expect(SUBSCRIPTION_TIERS.pro.price).toBe(29);

      expect(SUBSCRIPTION_TIERS.enterprise.max_agents).toBe(100);
      expect(SUBSCRIPTION_TIERS.enterprise.monthly_token_quota).toBe(1000000);
      expect(SUBSCRIPTION_TIERS.enterprise.price).toBe(299);
    });
  });
});