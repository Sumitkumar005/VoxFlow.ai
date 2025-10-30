import { query } from '../utils/supabase.js';
import { getUserLimitsAndUsage, checkUsageLimits } from './usage-tracking.service.js';

/**
 * Subscription tier configurations
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    max_agents: 2,
    monthly_token_quota: 1000,
    price: 0,
    features: ['Basic AI agents', 'Web calls only', 'Community support'],
  },
  pro: {
    name: 'Pro',
    max_agents: 10,
    monthly_token_quota: 50000,
    price: 29,
    features: ['Advanced AI agents', 'Phone calls', 'Priority support', 'Usage analytics'],
  },
  enterprise: {
    name: 'Enterprise',
    max_agents: 100,
    monthly_token_quota: 1000000,
    price: 299,
    features: ['Unlimited features', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
  },
};

/**
 * Check if user can create a new agent
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Agent creation check result
 */
export const checkAgentCreationLimit = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    const limitsAndUsage = await getUserLimitsAndUsage(userId);
    const { limits, current_usage, remaining } = limitsAndUsage;

    // Admins have no limits
    if (limits.role === 'admin') {
      return {
        allowed: true,
        reason: 'Admin users have unlimited agent creation',
        limits_info: limitsAndUsage,
      };
    }

    // Check agent limit
    if (remaining.agents <= 0) {
      return {
        allowed: false,
        reason: 'Agent limit reached',
        details: {
          current_agents: current_usage.agents,
          max_agents: limits.max_agents,
          subscription_tier: limits.subscription_tier,
          upgrade_suggestion: getUpgradeSuggestion(limits.subscription_tier, 'agents'),
        },
        limits_info: limitsAndUsage,
      };
    }

    return {
      allowed: true,
      reason: 'Within agent limits',
      details: {
        current_agents: current_usage.agents,
        max_agents: limits.max_agents,
        remaining_agents: remaining.agents,
      },
      limits_info: limitsAndUsage,
    };
  } catch (error) {
    console.error(`Error checking agent creation limit for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Check if user can make an API call
 * @param {string} userId - User ID
 * @param {Object} estimatedUsage - Estimated usage for the call
 * @param {string} estimatedUsage.provider - API provider
 * @param {number} estimatedUsage.tokens - Estimated tokens
 * @param {number} estimatedUsage.duration - Estimated duration in seconds
 * @returns {Promise<Object>} API call check result
 */
export const checkAPICallLimit = async (userId, estimatedUsage) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!estimatedUsage || typeof estimatedUsage !== 'object') {
      throw new Error('Invalid estimated usage data');
    }

    const result = await checkUsageLimits(userId, estimatedUsage);

    if (!result.allowed) {
      // Add upgrade suggestion to the result
      const { limits } = result.limits_info;
      result.details.upgrade_suggestion = getUpgradeSuggestion(limits.subscription_tier, 'tokens');
    }

    return result;
  } catch (error) {
    console.error(`Error checking API call limit for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get upgrade suggestion based on current tier and limit type
 * @param {string} currentTier - Current subscription tier
 * @param {string} limitType - Type of limit ('agents' or 'tokens')
 * @returns {Object} Upgrade suggestion
 */
export const getUpgradeSuggestion = (currentTier, limitType) => {
  const tiers = Object.keys(SUBSCRIPTION_TIERS);
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
    return {
      suggested_tier: null,
      message: 'You are already on the highest tier',
    };
  }

  const nextTier = tiers[currentIndex + 1];
  const nextTierConfig = SUBSCRIPTION_TIERS[nextTier];

  const limitField = limitType === 'agents' ? 'max_agents' : 'monthly_token_quota';
  const limitName = limitType === 'agents' ? 'agents' : 'tokens';

  return {
    suggested_tier: nextTier,
    tier_name: nextTierConfig.name,
    price: nextTierConfig.price,
    new_limit: nextTierConfig[limitField],
    message: `Upgrade to ${nextTierConfig.name} for ${nextTierConfig[limitField]} ${limitName} per month`,
    features: nextTierConfig.features,
  };
};

/**
 * Enforce rate limiting for API calls
 * @param {string} userId - User ID
 * @param {string} endpoint - API endpoint being called
 * @returns {Promise<Object>} Rate limit check result
 */
export const checkRateLimit = async (userId, endpoint) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    // Get user's subscription tier for rate limit configuration
    const { data: userData, error } = await query('users', 'select', {
      filter: { id: userId },
      columns: 'subscription_tier, role',
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!userData || userData.length === 0) {
      throw new Error('User not found');
    }

    const { subscription_tier, role } = userData[0];

    // Admins have no rate limits
    if (role === 'admin') {
      return {
        allowed: true,
        reason: 'Admin users have no rate limits',
      };
    }

    // Define rate limits per tier (requests per minute)
    const rateLimits = {
      free: 10,
      pro: 60,
      enterprise: 300,
    };

    const userRateLimit = rateLimits[subscription_tier] || rateLimits.free;

    // For now, we'll implement a simple in-memory rate limiter
    // In production, you'd use Redis or a proper rate limiting service
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window

    // This is a simplified implementation
    // In production, you'd track requests in Redis with sliding windows
    return {
      allowed: true,
      reason: 'Within rate limits',
      rate_limit: userRateLimit,
      window_seconds: 60,
    };
  } catch (error) {
    console.error(`Error checking rate limit for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get user's current limits and usage with warnings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Limits, usage, and warnings
 */
export const getUserLimitsWithWarnings = async (userId) => {
  try {
    const limitsAndUsage = await getUserLimitsAndUsage(userId);
    const warnings = [];
    const { usage_percentage, remaining, limits } = limitsAndUsage;

    // Check for approaching limits (80% threshold)
    if (usage_percentage.agents >= 80) {
      warnings.push({
        type: 'agent_limit_warning',
        message: `You're using ${usage_percentage.agents.toFixed(1)}% of your agent limit`,
        current: limitsAndUsage.current_usage.agents,
        limit: limits.max_agents,
        suggestion: remaining.agents <= 1 
          ? getUpgradeSuggestion(limits.subscription_tier, 'agents')
          : null,
      });
    }

    if (usage_percentage.tokens >= 80) {
      warnings.push({
        type: 'token_limit_warning',
        message: `You're using ${usage_percentage.tokens.toFixed(1)}% of your monthly token quota`,
        current: limitsAndUsage.current_usage.tokens_this_month,
        limit: limits.monthly_token_quota,
        suggestion: remaining.tokens <= (limits.monthly_token_quota * 0.1) 
          ? getUpgradeSuggestion(limits.subscription_tier, 'tokens')
          : null,
      });
    }

    // Check for exceeded limits
    if (remaining.agents <= 0) {
      warnings.push({
        type: 'agent_limit_exceeded',
        message: 'Agent limit reached. Upgrade to create more agents.',
        current: limitsAndUsage.current_usage.agents,
        limit: limits.max_agents,
        suggestion: getUpgradeSuggestion(limits.subscription_tier, 'agents'),
      });
    }

    if (remaining.tokens <= 0) {
      warnings.push({
        type: 'token_limit_exceeded',
        message: 'Monthly token quota exceeded. Upgrade for more tokens.',
        current: limitsAndUsage.current_usage.tokens_this_month,
        limit: limits.monthly_token_quota,
        suggestion: getUpgradeSuggestion(limits.subscription_tier, 'tokens'),
      });
    }

    return {
      ...limitsAndUsage,
      warnings,
      has_warnings: warnings.length > 0,
    };
  } catch (error) {
    console.error(`Error getting user limits with warnings for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Update user's subscription tier and limits
 * @param {string} userId - User ID
 * @param {string} newTier - New subscription tier
 * @param {string} adminUserId - Admin user ID (for audit logging)
 * @returns {Promise<Object>} Update result
 */
export const updateUserSubscriptionTier = async (userId, newTier, adminUserId = null) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!SUBSCRIPTION_TIERS[newTier]) {
      throw new Error(`Invalid subscription tier: ${newTier}`);
    }

    const tierConfig = SUBSCRIPTION_TIERS[newTier];

    // Update user's subscription tier and limits
    const { data, error } = await query('users', 'update', {
      filter: { id: userId },
      data: {
        subscription_tier: newTier,
        max_agents: tierConfig.max_agents,
        monthly_token_quota: tierConfig.monthly_token_quota,
      },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('User not found');
    }

    // Update subscription record
    const { error: subscriptionError } = await query('subscriptions', 'upsert', {
      data: {
        user_id: userId,
        plan: newTier,
        status: 'active',
        monthly_price: tierConfig.price,
        started_at: new Date().toISOString(),
      },
      onConflict: 'user_id',
    });

    if (subscriptionError) {
      console.error('Failed to update subscription record:', subscriptionError.message);
    }

    // Log admin action if performed by admin
    if (adminUserId) {
      try {
        await query('admin_audit_logs', 'insert', {
          data: {
            admin_user_id: adminUserId,
            action: 'update_user_subscription',
            target_user_id: userId,
            details: {
              old_tier: data[0].subscription_tier,
              new_tier: newTier,
              new_limits: {
                max_agents: tierConfig.max_agents,
                monthly_token_quota: tierConfig.monthly_token_quota,
              },
            },
            created_at: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log admin action:', auditError.message);
      }
    }

    return {
      success: true,
      message: `Subscription updated to ${tierConfig.name}`,
      new_tier: newTier,
      new_limits: {
        max_agents: tierConfig.max_agents,
        monthly_token_quota: tierConfig.monthly_token_quota,
      },
      updated_user: data[0],
    };
  } catch (error) {
    console.error(`Error updating subscription tier for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get subscription tier information
 * @returns {Object} All subscription tiers with their configurations
 */
export const getSubscriptionTiers = () => {
  return {
    tiers: SUBSCRIPTION_TIERS,
    comparison: Object.entries(SUBSCRIPTION_TIERS).map(([key, config]) => ({
      tier: key,
      ...config,
    })),
  };
};

/**
 * Validate if a user can perform a bulk operation
 * @param {string} userId - User ID
 * @param {Object} operation - Operation details
 * @param {string} operation.type - Operation type ('bulk_call', 'campaign')
 * @param {number} operation.estimated_calls - Estimated number of calls
 * @param {number} operation.estimated_tokens - Estimated tokens per call
 * @returns {Promise<Object>} Bulk operation validation result
 */
export const validateBulkOperation = async (userId, operation) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!operation || typeof operation !== 'object') {
      throw new Error('Invalid operation data');
    }

    const { type, estimated_calls = 1, estimated_tokens = 0 } = operation;
    const totalEstimatedTokens = estimated_calls * estimated_tokens;

    const limitsAndUsage = await getUserLimitsAndUsage(userId);
    const { limits, remaining } = limitsAndUsage;

    // Admins have no limits
    if (limits.role === 'admin') {
      return {
        allowed: true,
        reason: 'Admin users have unlimited access',
        operation_details: {
          estimated_calls,
          estimated_tokens: totalEstimatedTokens,
        },
      };
    }

    // Check if bulk operation would exceed token quota
    if (totalEstimatedTokens > remaining.tokens) {
      return {
        allowed: false,
        reason: 'Bulk operation would exceed monthly token quota',
        details: {
          estimated_calls,
          estimated_tokens_per_call: estimated_tokens,
          total_estimated_tokens: totalEstimatedTokens,
          remaining_tokens: remaining.tokens,
          upgrade_suggestion: getUpgradeSuggestion(limits.subscription_tier, 'tokens'),
        },
        limits_info: limitsAndUsage,
      };
    }

    // Check if operation is reasonable for subscription tier
    const maxCallsPerTier = {
      free: 10,
      pro: 100,
      enterprise: 1000,
    };

    const maxCalls = maxCallsPerTier[limits.subscription_tier] || maxCallsPerTier.free;

    if (estimated_calls > maxCalls) {
      return {
        allowed: false,
        reason: `Bulk operation exceeds recommended limit for ${limits.subscription_tier} tier`,
        details: {
          estimated_calls,
          max_recommended_calls: maxCalls,
          upgrade_suggestion: getUpgradeSuggestion(limits.subscription_tier, 'tokens'),
        },
        limits_info: limitsAndUsage,
      };
    }

    return {
      allowed: true,
      reason: 'Bulk operation within limits',
      operation_details: {
        estimated_calls,
        estimated_tokens: totalEstimatedTokens,
        remaining_tokens_after: remaining.tokens - totalEstimatedTokens,
      },
      limits_info: limitsAndUsage,
    };
  } catch (error) {
    console.error(`Error validating bulk operation for user ${userId}:`, error.message);
    throw error;
  }
};