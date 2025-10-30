import { query } from '../utils/supabase.js';

/**
 * API provider cost rates (per unit)
 */
export const COST_RATES = {
  groq: {
    per_token: 0.0000001, // $0.10 per 1M tokens
    name: 'Groq AI',
  },
  deepgram: {
    per_second: 0.0025, // $0.0025 per second
    name: 'Deepgram STT/TTS',
  },
  twilio: {
    per_minute: 0.0140, // $0.0140 per minute
    name: 'Twilio Voice',
  },
};

/**
 * Track API usage for a user
 * @param {string} userId - User ID
 * @param {Object} usage - Usage data
 * @param {string} usage.provider - API provider (groq, deepgram, twilio)
 * @param {number} usage.tokens - Number of tokens used (for groq)
 * @param {number} usage.duration - Duration in seconds (for deepgram/twilio)
 * @param {number} usage.calls - Number of API calls (optional, defaults to 1)
 * @returns {Promise<Object>} Tracking result
 */
export const trackUsage = async (userId, usage) => {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!usage || typeof usage !== 'object') {
      throw new Error('Invalid usage data');
    }

    const { provider, tokens = 0, duration = 0, calls = 1 } = usage;

    if (!provider || !COST_RATES[provider]) {
      throw new Error(`Invalid or unsupported provider: ${provider}`);
    }

    // Calculate cost based on provider
    let cost = 0;
    switch (provider) {
      case 'groq':
        cost = tokens * COST_RATES.groq.per_token;
        break;
      case 'deepgram':
        cost = duration * COST_RATES.deepgram.per_second;
        break;
      case 'twilio':
        cost = (duration / 60) * COST_RATES.twilio.per_minute; // Convert seconds to minutes
        break;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Upsert usage data (insert or update existing record for today)
    const { data, error } = await query('user_usage_tracking', 'upsert', {
      data: {
        user_id: userId,
        date: today,
        total_tokens: tokens,
        total_calls: calls,
        total_duration_seconds: duration,
        api_costs: cost,
        updated_at: new Date().toISOString(),
      },
      onConflict: 'user_id,date',
      // For upsert, we need to handle the increment logic
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // If record exists, we need to increment the values
    // Let's use a more robust approach with a separate update
    const { data: existingData } = await query('user_usage_tracking', 'select', {
      filter: { user_id: userId, date: today },
      columns: 'total_tokens, total_calls, total_duration_seconds, api_costs',
    });

    if (existingData && existingData.length > 0) {
      // Update existing record by adding new usage
      const existing = existingData[0];
      const { error: updateError } = await query('user_usage_tracking', 'update', {
        filter: { user_id: userId, date: today },
        data: {
          total_tokens: (parseFloat(existing.total_tokens) || 0) + tokens,
          total_calls: (existing.total_calls || 0) + calls,
          total_duration_seconds: (existing.total_duration_seconds || 0) + duration,
          api_costs: (parseFloat(existing.api_costs) || 0) + cost,
          updated_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        throw new Error(`Update error: ${updateError.message}`);
      }
    }

    console.log(`Usage tracked for user ${userId}: ${provider} - tokens: ${tokens}, duration: ${duration}s, cost: $${cost.toFixed(6)}`);

    return {
      success: true,
      provider,
      usage: {
        tokens,
        duration,
        calls,
        cost: parseFloat(cost.toFixed(6)),
      },
      date: today,
    };
  } catch (error) {
    console.error(`Error tracking usage for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get current month usage for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Current month usage summary
 */
export const getCurrentMonthUsage = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const startDate = `${currentMonth}-01`;

    const { data, error } = await query('user_usage_tracking', 'select', {
      filter: { 
        user_id: userId,
        date: `gte.${startDate}`,
      },
      columns: 'date, total_tokens, total_calls, total_duration_seconds, api_costs',
      orderBy: 'date ASC',
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate totals
    const totals = data?.reduce((acc, day) => ({
      total_tokens: acc.total_tokens + (parseFloat(day.total_tokens) || 0),
      total_calls: acc.total_calls + (day.total_calls || 0),
      total_duration_seconds: acc.total_duration_seconds + (day.total_duration_seconds || 0),
      total_costs: acc.total_costs + (parseFloat(day.api_costs) || 0),
    }), { total_tokens: 0, total_calls: 0, total_duration_seconds: 0, total_costs: 0 }) || 
    { total_tokens: 0, total_calls: 0, total_duration_seconds: 0, total_costs: 0 };

    return {
      month: currentMonth,
      daily_usage: data || [],
      summary: {
        ...totals,
        total_costs: parseFloat(totals.total_costs.toFixed(6)),
        average_cost_per_call: totals.total_calls > 0 
          ? parseFloat((totals.total_costs / totals.total_calls).toFixed(6))
          : 0,
        days_active: data?.length || 0,
      },
    };
  } catch (error) {
    console.error(`Error getting current month usage for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get usage history for a user with date range
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {number} options.limit - Limit number of records
 * @returns {Promise<Array>} Usage history
 */
export const getUsageHistory = async (userId, options = {}) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    const { startDate, endDate, limit = 30 } = options;

    let filter = { user_id: userId };

    // Add date filters if provided
    if (startDate) {
      filter.date = `gte.${startDate}`;
    }
    if (endDate) {
      if (filter.date) {
        // If we already have a gte filter, we need to use a different approach
        // For now, we'll handle this in the application logic
      } else {
        filter.date = `lte.${endDate}`;
      }
    }

    const { data, error } = await query('user_usage_tracking', 'select', {
      filter,
      columns: 'date, total_tokens, total_calls, total_duration_seconds, api_costs, updated_at',
      orderBy: 'date DESC',
      limit,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Filter by end date if both start and end dates are provided
    let filteredData = data || [];
    if (startDate && endDate) {
      filteredData = filteredData.filter(record => 
        record.date >= startDate && record.date <= endDate
      );
    }

    return filteredData.map(record => ({
      ...record,
      api_costs: parseFloat(record.api_costs || 0),
      total_tokens: parseFloat(record.total_tokens || 0),
    }));
  } catch (error) {
    console.error(`Error getting usage history for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get user limits and current usage
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User limits and usage
 */
export const getUserLimitsAndUsage = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    // Get user limits
    const { data: userData, error: userError } = await query('users', 'select', {
      filter: { id: userId },
      columns: 'max_agents, monthly_token_quota, subscription_tier, role',
    });

    if (userError) {
      throw new Error(`Database error: ${userError.message}`);
    }

    if (!userData || userData.length === 0) {
      throw new Error('User not found');
    }

    const user = userData[0];

    // Get current agent count
    const { data: agentData, error: agentError } = await query('agents', 'select', {
      filter: { user_id: userId },
      columns: 'id',
    });

    if (agentError) {
      throw new Error(`Database error: ${agentError.message}`);
    }

    const currentAgentCount = agentData?.length || 0;

    // Get current month usage
    const currentUsage = await getCurrentMonthUsage(userId);

    return {
      limits: {
        max_agents: user.max_agents,
        monthly_token_quota: user.monthly_token_quota,
        subscription_tier: user.subscription_tier,
        role: user.role,
      },
      current_usage: {
        agents: currentAgentCount,
        tokens_this_month: currentUsage.summary.total_tokens,
        calls_this_month: currentUsage.summary.total_calls,
        costs_this_month: currentUsage.summary.total_costs,
      },
      remaining: {
        agents: Math.max(0, user.max_agents - currentAgentCount),
        tokens: Math.max(0, user.monthly_token_quota - currentUsage.summary.total_tokens),
      },
      usage_percentage: {
        agents: user.max_agents > 0 ? (currentAgentCount / user.max_agents) * 100 : 0,
        tokens: user.monthly_token_quota > 0 
          ? (currentUsage.summary.total_tokens / user.monthly_token_quota) * 100 
          : 0,
      },
    };
  } catch (error) {
    console.error(`Error getting user limits and usage for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Check if user can make an API call based on their limits
 * @param {string} userId - User ID
 * @param {Object} estimatedUsage - Estimated usage for the call
 * @param {number} estimatedUsage.tokens - Estimated tokens
 * @returns {Promise<Object>} Limit check result
 */
export const checkUsageLimits = async (userId, estimatedUsage = {}) => {
  try {
    const limitsAndUsage = await getUserLimitsAndUsage(userId);
    const { limits, current_usage, remaining } = limitsAndUsage;

    // Admins have no limits
    if (limits.role === 'admin') {
      return {
        allowed: true,
        reason: 'Admin users have unlimited access',
        limits_info: limitsAndUsage,
      };
    }

    const { tokens = 0 } = estimatedUsage;

    // Check token quota
    if (tokens > remaining.tokens) {
      return {
        allowed: false,
        reason: 'Monthly token quota exceeded',
        details: {
          requested_tokens: tokens,
          remaining_tokens: remaining.tokens,
          monthly_quota: limits.monthly_token_quota,
          used_this_month: current_usage.tokens_this_month,
        },
        limits_info: limitsAndUsage,
      };
    }

    return {
      allowed: true,
      reason: 'Within usage limits',
      limits_info: limitsAndUsage,
    };
  } catch (error) {
    console.error(`Error checking usage limits for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get usage statistics for multiple users (admin only)
 * @param {Object} options - Query options
 * @param {number} options.limit - Limit number of users
 * @param {string} options.sortBy - Sort field (total_costs, total_calls, etc.)
 * @param {string} options.period - Period (current_month, last_30_days)
 * @returns {Promise<Array>} Usage statistics for multiple users
 */
export const getMultiUserUsageStats = async (options = {}) => {
  try {
    const { limit = 50, sortBy = 'total_costs', period = 'current_month' } = options;

    let dateFilter;
    if (period === 'current_month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      dateFilter = `gte.${currentMonth}-01`;
    } else if (period === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = `gte.${thirtyDaysAgo.toISOString().split('T')[0]}`;
    }

    // Get usage data
    const { data: usageData, error: usageError } = await query('user_usage_tracking', 'select', {
      filter: dateFilter ? { date: dateFilter } : {},
      columns: 'user_id, date, total_tokens, total_calls, total_duration_seconds, api_costs',
    });

    if (usageError) {
      throw new Error(`Database error: ${usageError.message}`);
    }

    // Get user information
    const { data: userData, error: userError } = await query('users', 'select', {
      columns: 'id, email, subscription_tier, organization_name, created_at',
    });

    if (userError) {
      throw new Error(`Database error: ${userError.message}`);
    }

    // Aggregate usage by user
    const userUsageMap = {};
    
    (usageData || []).forEach(record => {
      const userId = record.user_id;
      if (!userUsageMap[userId]) {
        userUsageMap[userId] = {
          total_tokens: 0,
          total_calls: 0,
          total_duration_seconds: 0,
          total_costs: 0,
          days_active: 0,
        };
      }

      userUsageMap[userId].total_tokens += parseFloat(record.total_tokens) || 0;
      userUsageMap[userId].total_calls += record.total_calls || 0;
      userUsageMap[userId].total_duration_seconds += record.total_duration_seconds || 0;
      userUsageMap[userId].total_costs += parseFloat(record.api_costs) || 0;
      userUsageMap[userId].days_active += 1;
    });

    // Combine with user data
    const result = (userData || []).map(user => ({
      user_id: user.id,
      email: user.email,
      subscription_tier: user.subscription_tier,
      organization_name: user.organization_name,
      created_at: user.created_at,
      usage: userUsageMap[user.id] || {
        total_tokens: 0,
        total_calls: 0,
        total_duration_seconds: 0,
        total_costs: 0,
        days_active: 0,
      },
    }));

    // Sort by specified field
    result.sort((a, b) => {
      const aValue = a.usage[sortBy] || 0;
      const bValue = b.usage[sortBy] || 0;
      return bValue - aValue; // Descending order
    });

    return result.slice(0, limit);
  } catch (error) {
    console.error('Error getting multi-user usage stats:', error.message);
    throw error;
  }
};

/**
 * Calculate estimated cost for an API call
 * @param {string} provider - API provider
 * @param {Object} usage - Usage parameters
 * @returns {number} Estimated cost
 */
export const calculateEstimatedCost = (provider, usage) => {
  if (!COST_RATES[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const { tokens = 0, duration = 0 } = usage;

  switch (provider) {
    case 'groq':
      return tokens * COST_RATES.groq.per_token;
    case 'deepgram':
      return duration * COST_RATES.deepgram.per_second;
    case 'twilio':
      return (duration / 60) * COST_RATES.twilio.per_minute;
    default:
      return 0;
  }
};