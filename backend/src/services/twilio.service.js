import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initialize Twilio client with user's config or default
 */
const getTwilioClient = (accountSid, authToken) => {
  const sid = accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(sid, token);
};

/**
 * Make an outbound phone call
 * @param {Object} config - Call configuration
 */
export const makeCall = async ({
  to,
  from,
  accountSid,
  authToken,
  webhookUrl,
}) => {
  try {
    const client = getTwilioClient(accountSid, authToken);

    const call = await client.calls.create({
      to,
      from,
      url: webhookUrl, // TwiML webhook for call flow
      statusCallback: `${webhookUrl}/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true, // Enable call recording
      recordingStatusCallback: `${webhookUrl}/recording`,
    });

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
    };
  } catch (error) {
    console.error('Twilio call error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get call details
 */
export const getCallDetails = async (callSid, accountSid, authToken) => {
  try {
    const client = getTwilioClient(accountSid, authToken);
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
 * Get call recording URL
 */
export const getRecordingUrl = async (callSid, accountSid, authToken) => {
  try {
    const client = getTwilioClient(accountSid, authToken);
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