import { query } from '../utils/supabase.js';
import { processCampaignContacts } from '../services/campaign.service.js';
import { campaignQueue } from '../jobs/queue.js';
import { validateBulkOperation } from '../services/limit-enforcement.service.js';
import { body, validationResult } from 'express-validator';

/**
 * Create a new campaign with agent ownership validation and bulk operation limits
 */
export const createCampaign = async (req, res, next) => {
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

    const { name, agent_id, estimated_contacts } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    // Verify agent exists and belongs to user (strict ownership validation)
    const { data: agents, error: agentError } = await query('agents', 'select', {
      filter: { id: agent_id, user_id: userId },
      columns: 'id, name, type, use_case',
    });

    if (agentError) {
      throw new Error(`Database error: ${agentError.message}`);
    }

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or access denied. You can only use your own agents for campaigns.',
      });
    }

    const agent = agents[0];

    // Validate bulk operation limits (if estimated contacts provided)
    if (estimated_contacts && estimated_contacts > 0) {
      const bulkValidation = await validateBulkOperation(userId, {
        type: 'campaign',
        estimated_calls: estimated_contacts,
        estimated_tokens: 100, // Rough estimate per call
      });

      if (!bulkValidation.allowed) {
        return res.status(403).json({
          success: false,
          message: bulkValidation.reason,
          details: bulkValidation.details,
          upgrade_suggestion: bulkValidation.details?.upgrade_suggestion,
        });
      }
    }

    // Create campaign with user ownership
    const { data, error } = await query('campaigns', 'insert', {
      data: {
        user_id: userId,
        name: name.trim(),
        agent_id,
        source_type: 'csv',
        source_file_path: req.file.path,
        state: 'created',
      },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to create campaign');
    }

    const campaign = data[0];

    // Process CSV and create contacts (async)
    try {
      const contactsProcessed = await processCampaignContacts(campaign.id);
      
      // If we have actual contact count, validate again
      if (contactsProcessed > 0) {
        const finalValidation = await validateBulkOperation(userId, {
          type: 'campaign',
          estimated_calls: contactsProcessed,
          estimated_tokens: 100,
        });

        if (!finalValidation.allowed) {
          // Delete the campaign if it exceeds limits
          await query('campaigns', 'delete', {
            filter: { id: campaign.id },
          });

          return res.status(403).json({
            success: false,
            message: `Campaign exceeds limits: ${finalValidation.reason}`,
            details: {
              ...finalValidation.details,
              contacts_found: contactsProcessed,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error processing contacts:', error);
      // Don't fail the campaign creation, but log the error
    }

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: {
        ...campaign,
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all campaigns for user with enhanced filtering and statistics
 */
export const getCampaigns = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, state, agent_id } = req.query;

    // Build filter for user's campaigns only
    const filter = { user_id: userId };
    
    // Add optional filters
    if (state && ['created', 'running', 'paused', 'completed', 'stopped'].includes(state)) {
      filter.state = state;
    }
    if (agent_id) {
      // Verify the agent belongs to the user before filtering
      const { data: agentCheck } = await query('agents', 'select', {
        filter: { id: agent_id, user_id: userId },
        columns: 'id',
      });
      
      if (agentCheck && agentCheck.length > 0) {
        filter.agent_id = agent_id;
      } else {
        // If agent doesn't belong to user, return empty results
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 },
          summary: { total_campaigns: 0, active_campaigns: 0 },
        });
      }
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get campaigns with pagination
    const { data: campaignsData, error } = await query('campaigns', 'select', {
      filter,
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: offset,
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Get total count for pagination
    const { data: countData } = await query('campaigns', 'select', {
      filter,
      columns: 'id',
    });

    const totalCount = countData?.length || 0;

    // Get agent details and run statistics for each campaign
    const campaignsWithDetails = await Promise.all(
      (campaignsData || []).map(async (campaign) => {
        // Get agent details (with ownership validation)
        const { data: agents } = await query('agents', 'select', {
          filter: { id: campaign.agent_id, user_id: userId },
          columns: 'name, type, use_case',
        });

        // Get campaign statistics
        const { data: runs } = await query('agent_runs', 'select', {
          filter: { campaign_id: campaign.id },
          columns: 'status, duration_seconds, groq_tokens',
        });

        const { data: contacts } = await query('campaign_contacts', 'select', {
          filter: { campaign_id: campaign.id },
          columns: 'status',
        });

        const stats = {
          total_contacts: contacts?.length || 0,
          pending_contacts: contacts?.filter(c => c.status === 'pending').length || 0,
          called_contacts: contacts?.filter(c => c.status === 'called').length || 0,
          failed_contacts: contacts?.filter(c => c.status === 'failed').length || 0,
          total_runs: runs?.length || 0,
          completed_runs: runs?.filter(r => r.status === 'completed').length || 0,
          total_duration: runs?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) || 0,
          total_tokens: runs?.reduce((sum, r) => sum + (parseFloat(r.groq_tokens) || 0), 0) || 0,
        };

        return {
          ...campaign,
          agent: agents?.[0] || null,
          statistics: stats,
        };
      })
    );

    // Calculate summary statistics
    const { data: allCampaigns } = await query('campaigns', 'select', {
      filter: { user_id: userId },
      columns: 'state',
    });

    const summary = {
      total_campaigns: allCampaigns?.length || 0,
      active_campaigns: allCampaigns?.filter(c => ['running', 'paused'].includes(c.state)).length || 0,
      completed_campaigns: allCampaigns?.filter(c => c.state === 'completed').length || 0,
    };

    res.json({
      success: true,
      data: campaignsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
      summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign by ID with ownership validation and detailed statistics
 */
export const getCampaignById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get campaign with ownership validation
    const { data: campaignData, error } = await query('campaigns', 'select', {
      filter: { id, user_id: userId },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!campaignData || campaignData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or access denied',
      });
    }

    const campaign = campaignData[0];

    // Get agent details with ownership validation
    const { data: agents } = await query('agents', 'select', {
      filter: { id: campaign.agent_id, user_id: userId },
      columns: 'id, name, type, use_case, description',
    });

    if (!agents || agents.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Associated agent not found or access denied',
      });
    }

    // Get campaign runs with pagination
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: runs } = await query('agent_runs', 'select', {
      filter: { campaign_id: id },
      order: { column: 'created_at', ascending: false },
      limit: parseInt(limit),
      offset: offset,
    });

    // Get total run count
    const { data: allRuns } = await query('agent_runs', 'select', {
      filter: { campaign_id: id },
      columns: 'status, duration_seconds, groq_tokens, type',
    });

    // Get campaign contacts
    const { data: contacts } = await query('campaign_contacts', 'select', {
      filter: { campaign_id: id },
      columns: 'status, phone_number, first_name, last_name',
    });

    // Calculate detailed statistics
    const statistics = {
      contacts: {
        total: contacts?.length || 0,
        pending: contacts?.filter(c => c.status === 'pending').length || 0,
        called: contacts?.filter(c => c.status === 'called').length || 0,
        failed: contacts?.filter(c => c.status === 'failed').length || 0,
      },
      runs: {
        total: allRuns?.length || 0,
        completed: allRuns?.filter(r => r.status === 'completed').length || 0,
        failed: allRuns?.filter(r => r.status === 'failed').length || 0,
        in_progress: allRuns?.filter(r => r.status === 'in_progress').length || 0,
        web_calls: allRuns?.filter(r => r.type === 'WEB_CALL').length || 0,
        phone_calls: allRuns?.filter(r => r.type === 'PHONE_CALL').length || 0,
      },
      performance: {
        total_duration: allRuns?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) || 0,
        total_tokens: allRuns?.reduce((sum, r) => sum + (parseFloat(r.groq_tokens) || 0), 0) || 0,
        average_duration: allRuns?.length > 0 
          ? (allRuns.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / allRuns.length)
          : 0,
        success_rate: contacts?.length > 0 
          ? ((contacts.filter(c => c.status === 'called').length / contacts.length) * 100)
          : 0,
      },
    };

    res.json({
      success: true,
      data: {
        ...campaign,
        agent: agents[0],
        runs: runs || [],
        contacts: contacts || [],
        statistics,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_runs: allRuns?.length || 0,
          pages: Math.ceil((allRuns?.length || 0) / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start campaign execution
 */
export const startCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get campaign
    const { data: campaigns } = await query('campaigns', 'select', {
      filter: { id, user_id: userId },
    });

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const campaign = campaigns[0];

    if (campaign.state === 'running') {
      return res.status(400).json({
        success: false,
        message: 'Campaign is already running',
      });
    }

    // Check if user has Twilio API keys configured (new system)
    const { data: apiKeys } = await query('user_api_keys', 'select', {
      filter: { user_id: userId, provider: 'twilio', is_active: true },
    });

    // Fallback: Check old telephony_configs table for backward compatibility
    if (!apiKeys || apiKeys.length === 0) {
      const { data: configs } = await query('telephony_configs', 'select', {
        filter: { user_id: userId },
      });

      if (!configs || configs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Twilio not configured. Please add your Twilio credentials in API Key Settings.',
          setup_required: true,
        });
      }
    }

    // Update campaign state
    await query('campaigns', 'update', {
      filter: { id },
      data: { state: 'running' },
    });

    // Get pending contacts
    const { data: contacts } = await query('campaign_contacts', 'select', {
      filter: { campaign_id: id, status: 'pending' },
    });

    // Add contacts to queue with userId instead of telephony config
    for (const contact of contacts || []) {
      await campaignQueue.add('execute-call', {
        contactId: contact.id,
        userId: userId, // Pass userId instead of config
      });
    }

    res.json({
      success: true,
      message: 'Campaign started successfully',
      data: {
        campaign_id: id,
        contacts_queued: contacts?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause campaign
 */
export const pauseCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('campaigns', 'update', {
      filter: { id, user_id: req.user.id },
      data: { state: 'paused' },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    // Pause the queue jobs for this campaign
    await campaignQueue.pause();

    res.json({
      success: true,
      message: 'Campaign paused successfully',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume campaign
 */
export const resumeCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('campaigns', 'update', {
      filter: { id, user_id: req.user.id },
      data: { state: 'running' },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    // Resume queue
    await campaignQueue.resume();

    res.json({
      success: true,
      message: 'Campaign resumed successfully',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stop campaign
 */
export const stopCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify campaign ownership before stopping
    const { data: campaignCheck } = await query('campaigns', 'select', {
      filter: { id, user_id: userId },
      columns: 'id, name, state',
    });

    if (!campaignCheck || campaignCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or access denied',
      });
    }

    const campaign = campaignCheck[0];

    if (campaign.state === 'stopped' || campaign.state === 'completed') {
      return res.status(400).json({
        success: false,
        message: `Campaign is already ${campaign.state}`,
      });
    }

    // Update campaign state
    const { data, error } = await query('campaigns', 'update', {
      filter: { id, user_id: userId },
      data: { state: 'stopped' },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Clear pending jobs from queue
    try {
      await campaignQueue.clean(0, 'wait');
    } catch (queueError) {
      console.error('Error cleaning queue:', queueError);
      // Don't fail the request if queue cleanup fails
    }

    res.json({
      success: true,
      message: `Campaign "${campaign.name}" stopped successfully`,
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for campaign creation
 */
export const createCampaignValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Campaign name must be between 2 and 100 characters'),
  body('agent_id')
    .isUUID()
    .withMessage('Valid agent ID is required'),
  body('estimated_contacts')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Estimated contacts must be between 1 and 10,000'),
];