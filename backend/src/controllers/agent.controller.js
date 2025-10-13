import { query } from '../utils/supabase.js';

/**
 * Create a new voice agent
 */
export const createAgent = async (req, res, next) => {
  try {
    const { name, type, use_case, description } = req.body;

    // Validation
    if (!name || !type || !use_case || !description) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, type, use_case, description',
      });
    }

    if (!['INBOUND', 'OUTBOUND'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either INBOUND or OUTBOUND',
      });
    }

    // Create agent
    const { data } = await query('agents', 'insert', {
      data: {
        user_id: req.user.id,
        name,
        type,
        use_case,
        description,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Voice Agent Created Successfully!',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all agents for current user
 */
export const getAgents = async (req, res, next) => {
  try {
    const { data } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
      order: { column: 'created_at', ascending: false },
    });

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single agent by ID
 */
export const getAgentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('agents', 'select', {
      filter: { id, user_id: req.user.id },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    res.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update agent
 */
export const updateAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, use_case, description } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (use_case) updateData.use_case = use_case;
    if (description) updateData.description = description;

    const { data } = await query('agents', 'update', {
      filter: { id, user_id: req.user.id },
      data: updateData,
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
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
 * Delete agent
 */
export const deleteAgent = async (req, res, next) => {
  try {
    const { id } = req.params;

    await query('agents', 'delete', {
      filter: { id, user_id: req.user.id },
    });

    res.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent run history with filters
 */
export const getAgentRunHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status, disposition, date_from, date_to } = req.query;

    // Build filter
    const filter = { agent_id: id };
    if (status) filter.status = status;
    if (disposition) filter.disposition = disposition;

    const offset = (page - 1) * limit;

    const { data } = await query('agent_runs', 'select', {
      filter,
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get total count for pagination
    const { count } = await query('agent_runs', 'select', {
      filter,
      columns: 'count',
    });

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: data?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};