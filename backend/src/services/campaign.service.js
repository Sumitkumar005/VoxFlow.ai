import { query } from '../utils/supabase.js';
import { parseContactsCSV } from '../utils/csv-parser.js';
import { makeCall } from './twilio.service.js';
import { generateRunNumber } from '../utils/token-calculator.js';

/**
 * Process campaign contacts and create agent runs
 */
export const processCampaignContacts = async (campaignId) => {
  try {
    // Get campaign details
    const { data: campaigns } = await query('campaigns', 'select', {
      filter: { id: campaignId },
    });

    if (!campaigns || campaigns.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaigns[0];

    // Get agent details
    const { data: agents } = await query('agents', 'select', {
      filter: { id: campaign.agent_id },
    });

    const agent = agents[0];

    // Parse CSV and get contacts
    const { contacts } = await parseContactsCSV(campaign.source_file_path);

    // Insert contacts into campaign_contacts table
    const contactsData = contacts.map(contact => ({
      campaign_id: campaignId,
      phone_number: contact.phone_number,
      first_name: contact.first_name,
      last_name: contact.last_name,
      status: 'pending',
    }));

    await query('campaign_contacts', 'insert', {
      data: contactsData,
    });

    return {
      success: true,
      contactCount: contacts.length,
    };
  } catch (error) {
    console.error('Process campaign contacts error:', error);
    throw error;
  }
};

/**
 * Execute a single campaign call
 */
export const executeCampaignCall = async (contactId, telephonyConfig) => {
  try {
    // Get contact details
    const { data: contacts } = await query('campaign_contacts', 'select', {
      filter: { id: contactId },
    });

    if (!contacts || contacts.length === 0) {
      throw new Error('Contact not found');
    }

    const contact = contacts[0];

    // Get campaign and agent
    const { data: campaigns } = await query('campaigns', 'select', {
      filter: { id: contact.campaign_id },
    });

    const campaign = campaigns[0];

    // Create agent run
    const runNumber = generateRunNumber();
    const { data: runs } = await query('agent_runs', 'insert', {
      data: {
        run_number: runNumber,
        agent_id: campaign.agent_id,
        campaign_id: campaign.id,
        type: 'PHONE_CALL',
        phone_number: contact.phone_number,
        status: 'in_progress',
      },
    });

    const run = runs[0];

    // Make Twilio call
    const webhookUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/calls/twilio/webhook/${run.id}`;
    
    const callResult = await makeCall({
      to: contact.phone_number,
      from: telephonyConfig.from_phone_number,
      accountSid: telephonyConfig.account_sid,
      authToken: telephonyConfig.auth_token,
      webhookUrl,
    });

    if (callResult.success) {
      // Update contact status
      await query('campaign_contacts', 'update', {
        filter: { id: contactId },
        data: {
          status: 'called',
          agent_run_id: run.id,
        },
      });

      return {
        success: true,
        run_id: run.id,
        run_number: runNumber,
      };
    } else {
      // Mark as failed
      await query('campaign_contacts', 'update', {
        filter: { id: contactId },
        data: { status: 'failed' },
      });

      await query('agent_runs', 'update', {
        filter: { id: run.id },
        data: { status: 'failed' },
      });

      return {
        success: false,
        error: callResult.error,
      };
    }
  } catch (error) {
    console.error('Execute campaign call error:', error);
    throw error;
  }
};