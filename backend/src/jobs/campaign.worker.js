import { campaignQueue } from './queue.js';
import { executeCampaignCall } from '../services/campaign.service.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Process campaign calls sequentially
 */
campaignQueue.process('execute-call', async (job) => {
  const { contactId, telephonyConfig } = job.data;

  console.log(`Processing call for contact ${contactId}`);

  try {
    const result = await executeCampaignCall(contactId, telephonyConfig);

    if (result.success) {
      console.log(`Call initiated successfully: ${result.run_number}`);
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error(`Failed to execute call for contact ${contactId}:`, error);
    throw error;
  }
});

console.log('Campaign worker started and listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing queue...');
  await campaignQueue.close();
  process.exit(0);
});