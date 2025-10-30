import twilio from 'twilio';
import dotenv from 'dotenv';
import { getUserAPIKey } from './user-keys.service.js';
import { trackUsage } from './usage-tracking.service.js';
import { checkAPICallLimit } from './limit-enforcement.service.js';
import { APIKeyFallbackService } from './api-key-fallback.service.js';

dotenv.config();

/**
 * Initialize Twilio client with user's API keys
 * @param {String} userId - User ID for API key retrieval
 * @returns {Object} Twilio client and phone number
 */
const getTwilioClient = async (userId) => {
  try {
    // Get user's Twilio credentials with fallback support
    const credentials = await APIKeyFallbackService.getTwilioCredentialsWithFallback(userId);
    const usingFallback = !(await APIKeyFallbackService.hasUserAPIKey(userId, 'twilio'));
    
    // Log fallback usage for migration tracking
    await APIKeyFallbackService.logAPIKeyUsage(userId, 'twilio', usingFallback);

    const { accountSid, authToken, phoneNumber } = credentials;

    if (!accountSid || !authToken) {
      throw new Error('Twilio Account SID and Auth Token are required');
    }

    const client = twilio(accountSid, authToken);
    
    return {
      client,
      phoneNumber: phoneNumber || process.env.TWILIO_PHONE_NUMBER,
      accountSid,
      authToken,
    };
  } catch (error) {
    // Fallback to environment variables if user hasn't configured Twilio
    if (error.message.includes('No twilio API key configured')) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured. Please add your Twilio credentials in Settings.');
      }

      return {
        client: twilio(accountSid, authToken),
        phoneNumber,
        accountSid,
        authToken,
      };
    }
    
    throw error;
  }
};

/**
 * Make an outbound phone call with user-specific API keys
 * @param {String} userId - User ID for API key and usage tracking
 * @param {Object} config - Call configuration
 */
export const makeCall = async (userId, {
  to,
  webhookUrl,
  estimatedDuration = 60, // Default 1 minute estimation
}) => {
  try {
    // Check if user can make this call
    const limitCheck = await checkAPICallLimit(userId, { 
      provider: 'twilio',
      duration: estimatedDuration 
    });

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: 'Usage limit exceeded',
        message: `Call unavailable. ${limitCheck.reason}`,
        limit_info: limitCheck.details,
      };
    }

    // Get user's Twilio client and credentials
    const { client, phoneNumber, accountSid } = await getTwilioClient(userId);

    const call = await client.calls.create({
      to,
      from: phoneNumber,
      url: webhookUrl, // TwiML webhook for call flow
      statusCallback: `${webhookUrl}/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true, // Enable call recording
      recordingStatusCallback: `${webhookUrl}/recording`,
    });

    // Track initial call creation (duration will be updated when call completes)
    setImmediate(async () => {
      try {
        await trackUsage(userId, {
          provider: 'twilio',
          duration: 0, // Will be updated when call completes
          calls: 1,
        });
      } catch (trackingError) {
        console.error('Failed to track Twilio call creation:', trackingError.message);
      }
    });

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
      accountSid,
    };
  } catch (error) {
    console.error('Twilio call error:', error);
    
    // Handle specific API errors
    if (error.message?.includes('authenticate') || error.code === 20003) {
      return {
        success: false,
        error: 'Invalid Twilio credentials',
        message: 'Please check your Twilio credentials in Settings.',
        setup_required: true,
      };
    }

    if (error.code === 21211) {
      return {
        success: false,
        error: 'Invalid phone number',
        message: 'The phone number format is invalid.',
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get call details with user-specific API keys
 * @param {String} userId - User ID for API key
 * @param {String} callSid - Twilio call SID
 */
export const getCallDetails = async (userId, callSid) => {
  try {
    const { client } = await getTwilioClient(userId);
    const call = await client.calls(callSid).fetch();

    return {
      success: true,
      call: {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime,
      },
    };
  } catch (error) {
    console.error('Twilio get call error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get call recording URL with user-specific API keys
 * @param {String} userId - User ID for API key
 * @param {String} callSid - Twilio call SID
 */
export const getRecordingUrl = async (userId, callSid) => {
  try {
    const { client } = await getTwilioClient(userId);
    const recordings = await client.recordings.list({ callSid, limit: 1 });

    if (recordings.length === 0) {
      return { success: false, error: 'No recording found' };
    }

    const recordingUrl = `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;

    return {
      success: true,
      recordingUrl,
      duration: recordings[0].duration,
    };
  } catch (error) {
    console.error('Twilio recording error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Update call usage tracking when call completes
 * @param {String} userId - User ID
 * @param {String} callSid - Twilio call SID
 * @param {Number} duration - Call duration in seconds
 */
export const updateCallUsage = async (userId, callSid, duration) => {
  try {
    await trackUsage(userId, {
      provider: 'twilio',
      duration: duration,
      calls: 0, // Don't increment call count again, just update duration
    });
  } catch (error) {
    console.error('Failed to update Twilio call usage:', error.message);
  }
};

/**
 * Generate TwiML for voice response
 */
export const generateTwiML = (text, nextUrl) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${text}</Say>
  ${nextUrl ? `<Redirect>${nextUrl}</Redirect>` : ''}
</Response>`;
};

/**
 * Generate TwiML for gathering user input
 */
export const generateGatherTwiML = (text, actionUrl, timeout = 5) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="${timeout}" action="${actionUrl}">
    <Say voice="Polly.Joanna">${text}</Say>
  </Gather>
</Response>`;
};