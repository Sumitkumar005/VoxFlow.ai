import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

// Create campaign queue
export const campaignQueue = new Queue('campaign-calls', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry failed calls up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds delay
    },
    removeOnComplete: false, // Keep completed jobs for history
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

// Queue event handlers
campaignQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully:`, result);
});

campaignQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

campaignQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} has stalled`);
});

export default campaignQueue;