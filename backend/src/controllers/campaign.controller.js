import { query } from '../utils/supabase.js';
import { processCampaignContacts } from '../services/campaign.service.js';
import { campaignQueue } from '../jobs/queue.js';

/**
 * Create a new campaign
 */
export const createCampaign = async (req, res, next) => {
  try {
    const { name, agent_id } = req.body;

    if (!name || !agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name and agent_id are required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    // Verify agent exists and belongs to user
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agent_id, user_id: req.user.id },
    });

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    // Create campaign
    const { data } = await query('campaigns', 'insert', {
      data: {
        user_id: req.user.id,
        name,
        agent_id,
        source_type: 'csv',
        source_file_path: req.file.path,
        state: 'created',
      },
    });

    const campaign = data[0];

    // Process CSV and create contacts (async)
    try {
      await processCampaignContacts(campaign.id);
    } catch (error) {
      console.error('Error processing contacts:', error);
    }

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all campaigns for user
 */
export const getCampaigns = async (req, res, next) => {
  try {
    const { data } = await query('campaigns', 'select', {
      filter: { user_id: req.user.id },
      order: { column: 'created_at', ascending: false },
    });

    // Get agent names for each campaign
    const campaignsWithAgents = await Promise.all(
      (data || []).map(async (campaign) => {
        const { data: agents } = await query('agents', 'select', {
          filter: { id: campaign.agent_id },
          columns: 'name, type',
        });
        return {
          ...campaign,
          agent: agents?.[0],
        };
      })
    );

    res.json({
      success: true,
      data: campaignsWithAgents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign by ID
 */
export const getCampaignById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('campaigns', 'select', {
      filter: { id, user_id: req.user.id },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const campaign = data[0];

    // Get agent details
    const { data: agents } = await query('agents', 'select', {
      filter: { id: campaign.agent_id },
    });

    // Get campaign runs
    const { data: runs } = await query('agent_runs', 'select', {
      filter: { campaign_id: id },
      order: { column: 'created_at', ascending: false },
    });

    res.json({
      success: true,
      data: {
        ...campaign,
        agent: agents?.[0],
        runs: runs || [],
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

    // Get campaign
    const { data: campaigns } = await query('campaigns', 'select', {
      filter: { id, user_id: req.user.id },
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

    // Get telephony config
    const { data: configs } = await query('telephony_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    if (!configs || configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Telephony configuration required',
      });
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

    // Add contacts to queue
    const telephonyConfig = configs[0];
    for (const contact of contacts || []) {
      await campaignQueue.add('execute-call', {
        contactId: contact.id,
        telephonyConfig,
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

    const { data } = await query('campaigns', 'update', {
      filter: { id, user_id: req.user.id },
      data: { state: 'stopped' },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    // Clear pending jobs from queue
    await campaignQueue.clean(0, 'wait');

    res.json({
      success: true,
      message: 'Campaign stopped successfully',
      data: data[0],
    });
  } catch (error) {
    next(error);
  }
};