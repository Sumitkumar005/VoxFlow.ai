import { query } from '../utils/supabase.js';
import { generateRunNumber, calculateTokens } from '../utils/token-calculator.js';
import { generateResponse } from '../services/groq.service.js';
import { textToSpeech, speechToText } from '../services/deepgram.service.js';
import { makeCall, getCallDetails, getRecordingUrl } from '../services/twilio.service.js';
import { generateCallGreeting } from '../services/ai.service.js';
import fs from 'fs';
import path from 'path';

/**
 * Start a web call (simulated AI conversation)
 */
export const startWebCall = async (req, res, next) => {
  try {
    const { agent_id } = req.body;

    // Get agent details
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agent_id, user_id: req.user.id },
    });

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    const agent = agents[0];

    // Create agent run
    const { data: runs } = await query('agent_runs', 'insert', {
      data: {
        run_number: generateRunNumber(),
        agent_id,
        type: 'WEB_CALL',
        status: 'in_progress',
      },
    });

    const run = runs[0];

    // Get service config for user
    const { data: configs } = await query('service_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    const config = configs?.[0] || {
      llm_model: 'llama-3.3-70b-versatile',
      tts_voice: 'aura-2-helena-en',
    };

    res.json({
      success: true,
      message: 'Web call initiated',
      data: {
        run_id: run.id,
        run_number: run.run_number,
        agent,
        config,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process web call message (AI conversation turn)
 */
export const processWebCallMessage = async (req, res, next) => {
  try {
    const { run_id, message, conversation_history = [] } = req.body;

    // Get run details
    const { data: runs } = await query('agent_runs', 'select', {
      filter: { id: run_id },
    });

    if (!runs || runs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Run not found',
      });
    }

    const run = runs[0];

    // Get agent
    const { data: agents } = await query('agents', 'select', {
      filter: { id: run.agent_id },
    });

    const agent = agents[0];

    // Get user's LLM config
    const { data: configs } = await query('service_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    const llmModel = configs?.[0]?.llm_model || 'llama-3.3-70b-versatile';

    // Generate AI response using Groq
    const aiResponse = await generateResponse(
      agent.description,
      conversation_history,
      message,
      llmModel
    );

    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End web call and generate transcript/recording
 */
export const endWebCall = async (req, res, next) => {
  try {
    const { run_id, conversation_history, duration_seconds, disposition } = req.body;

    // Generate transcript from conversation history
    const transcript = conversation_history
      .map((msg, idx) => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${msg.role}: ${msg.content}`;
      })
      .join('\n\n');

    // Calculate tokens
    const tokens = calculateTokens(duration_seconds);

    // Update run
    const { data } = await query('agent_runs', 'update', {
      filter: { id: run_id },
      data: {
        status: 'completed',
        transcript_text: transcript,
        duration_seconds,
        dograh_tokens: tokens,
        disposition: disposition || 'user_hangup',
        completed_at: new Date().toISOString(),
      },
    });

    // Generate a dummy recording URL (in production, this would be actual audio)
    const recordingUrl = `/uploads/recordings/${run_id}.mp3`;

    res.json({
      success: true,
      message: 'Call ended successfully',
      data: {
        run: data[0],
        transcript,
        recording_url: recordingUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a phone call via Twilio
 */
export const startPhoneCall = async (req, res, next) => {
  try {
    const { agent_id, phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Get agent
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agent_id, user_id: req.user.id },
    });

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found',
      });
    }

    // Get telephony config
    const { data: configs } = await query('telephony_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    if (!configs || configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Telephony configuration not found. Please configure Twilio first.',
      });
    }

    const config = configs[0];

    // Create agent run
    const runNumber = generateRunNumber();
    const { data: runs } = await query('agent_runs', 'insert', {
      data: {
        run_number: runNumber,
        agent_id,
        type: 'PHONE_CALL',
        phone_number,
        status: 'in_progress',
      },
    });

    const run = runs[0];

    // Make Twilio call
    const webhookUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/calls/twilio/webhook/${run.id}`;
    
    const callResult = await makeCall({
      to: phone_number,
      from: config.from_phone_number,
      accountSid: config.account_sid,
      authToken: config.auth_token,
      webhookUrl,
    });

    if (!callResult.success) {
      // Update run as failed
      await query('agent_runs', 'update', {
        filter: { id: run.id },
        data: { status: 'failed' },
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to initiate call',
        error: callResult.error,
      });
    }

    res.json({
      success: true,
      message: `Call initiated successfully with run name ${runNumber}`,
      data: {
        run_id: run.id,
        run_number: runNumber,
        call_sid: callResult.callSid,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get run details by ID
 */
export const getRunById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('agent_runs', 'select', {
      filter: { id },
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Run not found',
      });
    }

    // Get agent details
    const { data: agents } = await query('agents', 'select', {
      filter: { id: data[0].agent_id },
    });

    res.json({
      success: true,
      data: {
        ...data[0],
        agent: agents?.[0],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transcript for a run
 */
export const getTranscript = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data } = await query('agent_runs', 'select', {
      filter: { id },
      columns: 'id, run_number, transcript_text, created_at',
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not found',
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
 * Handle Twilio webhook for call initiation (returns TwiML)
 */
export const handleTwilioWebhook = async (req, res, next) => {
  try {
    const { runId } = req.params;

    // Get run details
    const { data: runs } = await query('agent_runs', 'select', {
      filter: { id: runId },
    });

    if (!runs || runs.length === 0) {
      return res.status(404).send('Run not found');
    }

    const run = runs[0];

    // Get agent
    const { data: agents } = await query('agents', 'select', {
      filter: { id: run.agent_id },
    });

    const agent = agents[0];

    // Generate initial greeting
    const greetingResult = await generateCallGreeting(run.agent_id, agent.user_id);

    if (!greetingResult.success) {
      // Fallback greeting
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello, this call may be recorded for quality purposes. How can I help you today?</Say>
  <Gather input="speech" timeout="5" action="/api/calls/twilio/webhook/${runId}/gather">
    <Say voice="Polly.Joanna">Please say something after the beep.</Say>
  </Gather>
</Response>`;
      return res.type('text/xml').send(twiml);
    }

    // Generate TwiML with greeting and gather
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greetingResult.greeting}</Say>
  <Gather input="speech" timeout="5" action="/api/calls/twilio/webhook/${runId}/gather">
    <Say voice="Polly.Joanna">How can I assist you today?</Say>
  </Gather>
</Response>`;

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Twilio webhook error:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, there was an error. Please try again later.</Say>
  <Hangup/>
</Response>`;
    res.type('text/xml').send(twiml);
  }
};

/**
 * Handle speech input gathering from Twilio
 */
export const handleTwilioGather = async (req, res, next) => {
  try {
    const { runId } = req.params;
    const { SpeechResult, Confidence } = req.body;

    // Get run details
    const { data: runs } = await query('agent_runs', 'select', {
      filter: { id: runId },
    });

    if (!runs || runs.length === 0) {
      return res.status(404).send('Run not found');
    }

    const run = runs[0];

    // Get agent
    const { data: agents } = await query('agents', 'select', {
      filter: { id: run.agent_id },
    });

    const agent = agents[0];

    // Get conversation history
    let conversationHistory = [];
    if (run.transcript_text) {
      // Parse existing transcript into history format
      const lines = run.transcript_text.split('\n\n');
      conversationHistory = lines.map(line => {
        const match = line.match(/\[.*?\] (.*?): (.*)/);
        if (match) {
          return {
            role: match[1].toLowerCase() === 'ai' ? 'assistant' : 'user',
            content: match[2]
          };
        }
        return null;
      }).filter(Boolean);
    }

    // Add user's speech to history
    if (SpeechResult) {
      conversationHistory.push({
        role: 'user',
        content: SpeechResult
      });
    }

    // Generate AI response
    const { data: configs } = await query('service_configs', 'select', {
      filter: { user_id: agent.user_id },
    });

    const llmModel = configs?.[0]?.llm_model || 'llama-3.3-70b-versatile';

    const aiResponse = await generateResponse(
      agent.description,
      conversationHistory,
      SpeechResult || 'Hello',
      llmModel
    );

    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse.message
    });

    // Update transcript
    const updatedTranscript = conversationHistory
      .map((msg, idx) => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${msg.role === 'assistant' ? 'AI' : 'User'}: ${msg.content}`;
      })
      .join('\n\n');

    await query('agent_runs', 'update', {
      filter: { id: runId },
      data: { transcript_text: updatedTranscript },
    });

    // Generate TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${aiResponse.message}</Say>
  <Gather input="speech" timeout="5" action="/api/calls/twilio/webhook/${runId}/gather">
    <Say voice="Polly.Joanna">What else can I help you with?</Say>
  </Gather>
</Response>`;

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Twilio gather error:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, I didn't catch that. Could you please repeat?</Say>
  <Gather input="speech" timeout="5" action="/api/calls/twilio/webhook/${req.params.runId}/gather">
    <Say voice="Polly.Joanna">Please try again.</Say>
  </Gather>
</Response>`;
    res.type('text/xml').send(twiml);
  }
};

/**
 * Handle call status updates from Twilio
 */
export const handleTwilioStatus = async (req, res, next) => {
  try {
    const { runId } = req.params;
    const { CallStatus, CallDuration } = req.body;

    console.log(`Call status update for run ${runId}: ${CallStatus}`);

    // Update run status based on Twilio status
    let status = 'in_progress';
    let completedAt = null;

    switch (CallStatus) {
      case 'completed':
        status = 'completed';
        completedAt = new Date().toISOString();
        break;
      case 'busy':
      case 'failed':
      case 'no-answer':
        status = 'failed';
        completedAt = new Date().toISOString();
        break;
      case 'in-progress':
        status = 'in_progress';
        break;
      default:
        status = 'in_progress';
    }

    await query('agent_runs', 'update', {
      filter: { id: runId },
      data: {
        status,
        duration_seconds: CallDuration ? parseInt(CallDuration) : null,
        completed_at: completedAt,
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Twilio status update error:', error);
    res.sendStatus(500);
  }
};

/**
 * Handle recording status updates from Twilio
 */
export const handleTwilioRecording = async (req, res, next) => {
  try {
    const { runId } = req.params;
    const { RecordingUrl, RecordingDuration } = req.body;

    console.log(`Recording completed for run ${runId}: ${RecordingUrl}`);

    // Update run with recording URL
    await query('agent_runs', 'update', {
      filter: { id: runId },
      data: {
        recording_url: RecordingUrl,
        recording_duration: RecordingDuration ? parseInt(RecordingDuration) : null,
      },
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Twilio recording update error:', error);
    res.sendStatus(500);
  }
};
