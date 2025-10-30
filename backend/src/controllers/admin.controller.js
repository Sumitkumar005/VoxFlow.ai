import { query } from '../utils/supabase.js';
import { body, param, validationResult } from 'express-validator';
import { 
  getMultiUserUsageStats, 
  getUserLimitsAndUsage 
} from '../services/usage-tracking.service.js';
import { 
  updateUserSubscriptionTier, 
  getSubscriptionTiers 
} from '../services/limit-enforcement.service.js';

/**
 * Get all users with pagination and filtering
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search, 
      subscription_tier, 
      role, 
      is_active,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (subscription_tier && ['free', 'pro', 'enterprise'].includes(subscription_tier)) {
      filter.subscription_tier = subscription_tier;
    }
    
    if (role && ['admin', 'user', 'enterprise'].includes(role)) {
      filter.role = role;
    }
    
    if (is_active !== undefined) {
      filter.is_active = is_active === 'true';
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query options
    let queryOptions = {
      filter,
      order: { 
        column: sort_by, 
        ascending: sort_order === 'asc' 
      },
      limit: parseInt(limit),
      offset: offset,
      columns: 'id, email, role, subscription_tier, organization_name, max_agents, monthly_token_quota, is_active, last_login, created_at',
    };

    // Add search if provided
    if (search && search.trim()) {
      queryOptions.filter = {
        ...filter,
        or: `email.ilike.%${search.trim()}%,organization_name.ilike.%${search.trim()}%`,
      };
    }

    const { data: users, error } = await query('users', 'select', queryOptions);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get total count for pagination
    const { data: countData } = await query('users', 'select', {
      filter: search ? { ...filter, or: `email.ilike.%${search.trim()}%,organization_name.ilike.%${search.trim()}%` } : filter,
      columns: 'id',
    });

    const totalCount = countData?.length || 0;

    // Get usage statistics for each user (limited to avoid performance issues)
    const usersWithStats = await Promise.all(
      (users || []).map(async (user) => {
        try {
          const limitsAndUsage = await getUserLimitsAndUsage(user.id);
          return {
            ...user,
            current_usage: limitsAndUsage.current_usage,
            usage_percentage: limitsAndUsage.usage_percentage,
          };
        } catch (error) {
          // If usage stats fail, return user without stats
          return {
            ...user,
            current_usage: { agents: 0, tokens_this_month: 0, calls_this_month: 0 },
            usage_percentage: { agents: 0, tokens: 0 },
          };
        }
      })
    );

    res.json({
      success: true,
      data: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
      filters: {
        search,
        subscription_tier,
        role,
        is_active,
        sort_by,
        sort_order,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed user information by ID
 */
export const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get user details
    const { data: userData, error: userError } = await query('users', 'select', {
      filter: { id },
    });

    if (userError) {
      throw new Error(`Database error: ${userError.message}`);
    }

    if (!userData || userData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userData[0];

    // Get user's agents
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: id },
      columns: 'id, name, type, use_case, total_runs, created_at',
      order: { column: 'created_at', ascending: false },
    });

    // Get user's recent runs
    const { data: recentRuns } = await query('agent_runs', 'select', {
      filter: { 
        agent_id: `in.(${(agents || []).map(a => a.id).join(',') || 'null'})` 
      },
      columns: 'id, run_number, agent_id, type, status, duration_seconds, groq_tokens, created_at',
      order: { column: 'created_at', ascending: false },
      limit: 10,
    });

    // Get user's API key status
    const { data: apiKeys } = await query('user_api_keys', 'select', {
      filter: { user_id: id, is_active: true },
      columns: 'provider, created_at, last_used_at',
    });

    // Get user's subscription details
    const { data: subscription } = await query('subscriptions', 'select', {
      filter: { user_id: id },
    });

    // Get usage statistics
    let usageStats;
    try {
      usageStats = await getUserLimitsAndUsage(id);
    } catch (error) {
      usageStats = {
        limits: { max_agents: user.max_agents, monthly_token_quota: user.monthly_token_quota },
        current_usage: { agents: 0, tokens_this_month: 0, calls_this_month: 0 },
        remaining: { agents: user.max_agents, tokens: user.monthly_token_quota },
        usage_percentage: { agents: 0, tokens: 0 },
      };
    }

    res.json({
      success: true,
      data: {
        user,
        agents: agents || [],
        recent_runs: recentRuns || [],
        api_keys: (apiKeys || []).map(key => ({
          provider: key.provider,
          configured: true,
          created_at: key.created_at,
          last_used_at: key.last_used_at,
        })),
        subscription: subscription?.[0] || null,
        usage_statistics: usageStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user limits and subscription
 */
export const updateUserLimits = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { 
      max_agents, 
      monthly_token_quota, 
      subscription_tier,
      is_active 
    } = req.body;

    // Build update data
    const updateData = {};
    if (max_agents !== undefined) updateData.max_agents = parseInt(max_agents);
    if (monthly_token_quota !== undefined) updateData.monthly_token_quota = parseInt(monthly_token_quota);
    if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update user
    const { data, error } = await query('users', 'update', {
      filter: { id },
      data: updateData,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update subscription record if subscription_tier changed
    if (subscription_tier) {
      try {
        await updateUserSubscriptionTier(id, subscription_tier, req.user.id);
      } catch (subscriptionError) {
        console.error('Failed to update subscription record:', subscriptionError.message);
      }
    }

    res.json({
      success: true,
      message: 'User limits updated successfully',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate or deactivate user account
 */
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean value',
      });
    }

    // Update user status
    const { data, error } = await query('users', 'update', {
      filter: { id },
      data: { is_active },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const action = is_active ? 'activated' : 'deactivated';

    res.json({
      success: true,
      message: `User account ${action} successfully`,
      data: {
        id: data[0].id,
        email: data[0].email,
        is_active: data[0].is_active,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all agents across all users
 */
export const getAllAgents = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search, 
      type, 
      user_id,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (type && ['INBOUND', 'OUTBOUND'].includes(type)) {
      filter.type = type;
    }
    if (user_id) {
      filter.user_id = user_id;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query options
    let queryOptions = {
      filter,
      order: { column: sort_by, ascending: sort_order === 'asc' },
      limit: parseInt(limit),
      offset: offset,
    };

    // Add search if provided
    if (search && search.trim()) {
      queryOptions.filter = {
        ...filter,
        name: `ilike.%${search.trim()}%`,
      };
    }

    const { data: agents, error } = await query('agents', 'select', queryOptions);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get user information for each agent
    const agentsWithUsers = await Promise.all(
      (agents || []).map(async (agent) => {
        const { data: userData } = await query('users', 'select', {
          filter: { id: agent.user_id },
          columns: 'email, organization_name, subscription_tier',
        });

        return {
          ...agent,
          user: userData?.[0] || null,
        };
      })
    );

    // Get total count
    const { data: countData } = await query('agents', 'select', {
      filter: search ? { ...filter, name: `ilike.%${search.trim()}%` } : filter,
      columns: 'id',
    });

    const totalCount = countData?.length || 0;

    res.json({
      success: true,
      data: agentsWithUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account (admin only)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    // Get user details before deletion
    const { data: userData } = await query('users', 'select', {
      filter: { id },
      columns: 'email, role',
    });

    if (!userData || userData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userData[0];

    // Prevent deletion of other admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users',
      });
    }

    // Delete user (CASCADE will handle related records)
    const { error } = await query('users', 'delete', {
      filter: { id },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json({
      success: true,
      message: `User account ${user.email} deleted successfully`,
      deleted_user: {
        id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription tiers information
 */
export const getSubscriptionTiersInfo = async (req, res, next) => {
  try {
    const tiers = getSubscriptionTiers();

    // Get user counts per tier
    const { data: userCounts } = await query('users', 'select', {
      columns: 'subscription_tier',
    });

    const tierCounts = {
      free: 0,
      pro: 0,
      enterprise: 0,
    };

    (userCounts || []).forEach(user => {
      if (tierCounts.hasOwnProperty(user.subscription_tier)) {
        tierCounts[user.subscription_tier]++;
      }
    });

    res.json({
      success: true,
      data: {
        ...tiers,
        user_counts: tierCounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for updating user limits
 */
export const updateUserLimitsValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('max_agents')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Max agents must be between 0 and 1000'),
  body('monthly_token_quota')
    .optional()
    .isInt({ min: 0, max: 10000000 })
    .withMessage('Monthly token quota must be between 0 and 10,000,000'),
  body('subscription_tier')
    .optional()
    .isIn(['free', 'pro', 'enterprise'])
    .withMessage('Invalid subscription tier'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

/**
 * Validation rules for user ID parameter
 */
export const userIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid user ID format'),
];