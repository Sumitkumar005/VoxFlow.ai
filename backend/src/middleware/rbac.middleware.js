import { query } from '../utils/supabase.js';

/**
 * Middleware to require admin role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking admin permissions',
      error: error.message,
    });
  }
};

/**
 * Middleware to require specific roles
 * @param {Array} roles - Array of allowed roles
 */
export const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking role permissions',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check agent ownership
 * Ensures users can only access their own agents (unless admin)
 */
export const checkAgentOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins can access all agents
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if agent belongs to the user
    const { data: agents } = await query('agents', 'select', {
      filter: { id },
      columns: 'user_id',
    });

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    if (agents[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own agents.',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking agent ownership',
      error: error.message,
    });
  }
};

/**
 * Middleware to check campaign ownership
 * Ensures users can only access their own campaigns (unless admin)
 */
export const checkCampaignOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins can access all campaigns
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if campaign belongs to the user
    const { data: campaigns } = await query('campaigns', 'select', {
      filter: { id },
      columns: 'user_id',
    });

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    if (campaigns[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own campaigns.',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking campaign ownership',
      error: error.message,
    });
  }
};

/**
 * Middleware to check agent run ownership
 * Ensures users can only access their own agent runs (unless admin)
 */
export const checkAgentRunOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins can access all agent runs
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if agent run belongs to the user (through agent ownership)
    const { data: agentRuns } = await query('agent_runs', 'select', {
      filter: { id },
      columns: 'agent_id',
    });

    if (!agentRuns || agentRuns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent run not found',
      });
    }

    // Check if the agent belongs to the user
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agentRuns[0].agent_id },
      columns: 'user_id',
    });

    if (!agents || agents.length === 0 || agents[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own agent runs.',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking agent run ownership',
      error: error.message,
    });
  }
};

/**
 * Middleware to check user limits before creating resources
 */
export const checkUserLimits = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Admins have no limits
    if (req.user.role === 'admin') {
      return next();
    }

    // Get current agent count
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: req.user.id },
      columns: 'id',
    });

    const currentAgentCount = agents?.length || 0;

    // Check if user can create more agents
    if (currentAgentCount >= req.user.max_agents) {
      return res.status(403).json({
        success: false,
        message: `Agent limit reached (${req.user.max_agents}). Please upgrade your plan to create more agents.`,
        current_count: currentAgentCount,
        max_allowed: req.user.max_agents,
      });
    }

    // Attach current counts to request for use in controllers
    req.userLimits = {
      current_agents: currentAgentCount,
      max_agents: req.user.max_agents,
      agents_remaining: req.user.max_agents - currentAgentCount,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking user limits',
      error: error.message,
    });
  }
};

/**
 * Middleware to log admin actions for audit trail
 */
export const logAdminAction = (action) => {
  return async (req, res, next) => {
    try {
      // Store original res.json to intercept successful responses
      const originalJson = res.json;
      
      res.json = function(data) {
        // Only log if the action was successful (status < 400)
        if (res.statusCode < 400 && req.user && req.user.role === 'admin') {
          // Log admin action asynchronously (don't wait for it)
          setImmediate(async () => {
            try {
              await query('admin_audit_logs', 'insert', {
                data: {
                  admin_user_id: req.user.id,
                  action,
                  target_user_id: req.params.id || req.body.user_id || null,
                  target_resource_type: req.params.id ? 'unknown' : null,
                  target_resource_id: req.params.id || null,
                  details: {
                    method: req.method,
                    url: req.originalUrl,
                    body: req.body,
                    params: req.params,
                    query: req.query,
                  },
                  ip_address: req.ip || req.connection.remoteAddress,
                  user_agent: req.get('User-Agent'),
                },
              });
            } catch (logError) {
              console.error('Failed to log admin action:', logError);
            }
          });
        }
        
        // Call original res.json
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error setting up admin action logging',
        error: error.message,
      });
    }
  };
};