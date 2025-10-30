import { query } from '../utils/supabase.js';
import { checkAgentCreationLimit } from '../services/limit-enforcement.service.js';
import { body, validationResult } from 'express-validator';

/**
 * Create a new voice agent with ownership validation and limit enforcement
 */
export const createAgent = async (req, res, next) => {
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

    const { name, type, use_case, description } = req.body;
    const userId = req.user.id;

    // Check if user can create more agents
    const limitCheck = await checkAgentCreationLimit(userId);
    
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: limitCheck.reason,
        details: limitCheck.details,
        current_usage: limitCheck.limits_info?.current_usage,
        upgrade_suggestion: limitCheck.details?.upgrade_suggestion,
      });
    }

    // Create agent with user ownership
    const { data, error } = await query('agents', 'insert', {
      data: {
        user_id: userId,
        name: name.trim(),
        type,
        use_case: use_case.trim(),
        description: description.trim(),
      },
    });

    if (error) {
      // Handle database constraint errors (like agent limit trigger)
      if (error.message?.includes('Agent limit reached')) {
        return res.status(403).json({
          success: false,
          message: 'Agent limit reached',
          details: {
            message: error.message,
            upgrade_suggestion: limitCheck.details?.upgrade_suggestion,
          },
        });
      }
      
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to create agent');
    }

    const createdAgent = data[0];

    res.status(201).json({
      success: true,
      message: 'Voice Agent Created Successfully!',
      data: {
        ...createdAgent,
        limits_info: {
          agents_used: limitCheck.limits_info.current_usage.agents + 1,
          agents_limit: limitCheck.limits_info.limits.max_agents,
          agents_remaining: limitCheck.limits_info.remaining.agents - 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all agents for current user with usage statistics
 */
export const getAgents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, search, type } = req.query;

    // Build filter for user's agents only
    const filter = { user_id: userId };
    
    // Add optional filters
    if (type && ['INBOUND', 'OUTBOUND'].includes(type)) {
      filter.type = type;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get agents with pagination
    let queryOptions = {
      filter,
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: offset,
    };

    // Add search if provided
    if (search && search.trim()) {
      // For search, we'll need to use a more complex query
      // This is a simplified version - in production you might want full-text search
      queryOptions.filter = {
        ...filter,
        name: `ilike.%${search.trim()}%`,
      };
    }

    const { data, error } = await query('agents', 'select', queryOptions);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get total count for pagination
    const { data: countData } = await query('agents', 'select', {
      filter: search ? { ...filter, name: `ilike.%${search.trim()}%` } : filter,
      columns: 'id',
    });

    const totalCount = countData?.length || 0;

    // Get user's current limits for context
    const { data: userData } = await query('users', 'select', {
      filter: { id: userId },
      columns: 'max_agents, subscription_tier',
    });

    const userLimits = userData?.[0] || { max_agents: 2, subscription_tier: 'free' };

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
      summary: {
        total_agents: totalCount,
        max_agents: userLimits.max_agents,
        agents_remaining: Math.max(0, userLimits.max_agents - totalCount),
        subscription_tier: userLimits.subscription_tier,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single agent by ID with ownership validation and usage statistics
 */
export const getAgentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get agent with ownership validation
    const { data: agentData, error } = await query('agents', 'select', {
      filter: { id, user_id: userId },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!agentData || agentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or access denied',
      });
    }

    const agent = agentData[0];

    // Get agent run statistics
    const { data: runStats } = await query('agent_runs', 'select', {
      filter: { agent_id: id },
      columns: 'status, duration_seconds, groq_tokens, created_at',
    });

    // Calculate statistics
    const stats = {
      total_runs: runStats?.length || 0,
      completed_runs: runStats?.filter(run => run.status === 'completed').length || 0,
      failed_runs: runStats?.filter(run => run.status === 'failed').length || 0,
      in_progress_runs: runStats?.filter(run => run.status === 'in_progress').length || 0,
      total_duration: runStats?.reduce((sum, run) => sum + (run.duration_seconds || 0), 0) || 0,
      total_tokens: runStats?.reduce((sum, run) => sum + (parseFloat(run.groq_tokens) || 0), 0) || 0,
      last_run_at: runStats?.length > 0 
        ? runStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
        : null,
    };

    res.json({
      success: true,
      data: {
        ...agent,
        statistics: stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update agent with ownership validation
 */
export const updateAgent = async (req, res, next) => {
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
    const { name, use_case, description } = req.body;
    const userId = req.user.id;

    // Build update data with trimmed values
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (use_case !== undefined) updateData.use_case = use_case.trim();
    if (description !== undefined) updateData.description = description.trim();

    // Ensure there's something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }

    // Update agent with ownership validation
    const { data, error } = await query('agents', 'update', {
      filter: { id, user_id: userId },
      data: updateData,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete agent with ownership validation and cleanup
 */
export const deleteAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First, verify the agent exists and belongs to the user
    const { data: agentData } = await query('agents', 'select', {
      filter: { id, user_id: userId },
      columns: 'id, name',
    });

    if (!agentData || agentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or access denied',
      });
    }

    const agent = agentData[0];

    // Check if agent has any active runs
    const { data: activeRuns } = await query('agent_runs', 'select', {
      filter: { agent_id: id, status: 'in_progress' },
      columns: 'id',
    });

    if (activeRuns && activeRuns.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete agent with active runs. Please wait for all runs to complete.',
        active_runs: activeRuns.length,
      });
    }

    // Delete the agent (CASCADE will handle related records)
    const { error } = await query('agents', 'delete', {
      filter: { id, user_id: userId },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json({
      success: true,
      message: `Agent "${agent.name}" deleted successfully`,
      deleted_agent: {
        id: agent.id,
        name: agent.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent run history with filters and ownership validation
 */
export const getAgentRunHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      disposition, 
      date_from, 
      date_to,
      type 
    } = req.query;

    // First verify agent ownership
    const { data: agentData } = await query('agents', 'select', {
      filter: { id, user_id: userId },
      columns: 'id, name',
    });

    if (!agentData || agentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or access denied',
      });
    }

    // Build filter for agent runs
    const filter = { agent_id: id };
    
    // Add optional filters
    if (status && ['in_progress', 'completed', 'failed'].includes(status)) {
      filter.status = status;
    }
    if (disposition) {
      filter.disposition = disposition;
    }
    if (type && ['WEB_CALL', 'PHONE_CALL'].includes(type)) {
      filter.type = type;
    }

    // Date range filtering (if provided)
    if (date_from) {
      filter.created_at = `gte.${date_from}`;
    }
    if (date_to) {
      // If we already have a date filter, we need to combine them
      if (filter.created_at) {
        // This is a limitation of simple filtering - in production you'd use more complex queries
        filter.created_at = `gte.${date_from}`;
      } else {
        filter.created_at = `lte.${date_to}`;
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get agent runs with pagination
    const { data: runsData, error } = await query('agent_runs', 'select', {
      filter,
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: offset,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get total count for pagination
    const { data: countData } = await query('agent_runs', 'select', {
      filter,
      columns: 'id',
    });

    const totalCount = countData?.length || 0;

    // Calculate summary statistics
    const { data: allRuns } = await query('agent_runs', 'select', {
      filter: { agent_id: id },
      columns: 'status, duration_seconds, groq_tokens, type',
    });

    const summary = {
      total_runs: allRuns?.length || 0,
      completed_runs: allRuns?.filter(run => run.status === 'completed').length || 0,
      failed_runs: allRuns?.filter(run => run.status === 'failed').length || 0,
      web_calls: allRuns?.filter(run => run.type === 'WEB_CALL').length || 0,
      phone_calls: allRuns?.filter(run => run.type === 'PHONE_CALL').length || 0,
      total_duration: allRuns?.reduce((sum, run) => sum + (run.duration_seconds || 0), 0) || 0,
      total_tokens: allRuns?.reduce((sum, run) => sum + (parseFloat(run.groq_tokens) || 0), 0) || 0,
    };

    res.json({
      success: true,
      data: runsData || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
      summary,
      agent: {
        id: agentData[0].id,
        name: agentData[0].name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for agent creation
 */
export const createAgentValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Agent name must be between 2 and 100 characters'),
  body('type')
    .isIn(['INBOUND', 'OUTBOUND'])
    .withMessage('Type must be either INBOUND or OUTBOUND'),
  body('use_case')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Use case must be between 5 and 255 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
];

/**
 * Validation rules for agent updates
 */
export const updateAgentValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Agent name must be between 2 and 100 characters'),
  body('use_case')
    .optional()
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Use case must be between 5 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
];