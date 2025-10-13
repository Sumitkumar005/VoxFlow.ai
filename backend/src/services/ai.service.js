import { generateResponse } from './groq.service.js';
import { speechToText, textToSpeech } from './deepgram.service.js';
import { query } from '../utils/supabase.js';

/**
 * Main AI orchestrator service
 * Coordinates LLM, TTS, and STT services based on user configuration
 */

/**
 * Process a complete conversation turn
 * @param {String} agentId - Agent ID
 * @param {String} userId - User ID
 * @param {String} userMessage - User's message or audio
 * @param {Array} conversationHistory - Previous conversation
 * @param {String} messageType - 'text' or 'audio'
 */
export const processConversationTurn = async (
  agentId,
  userId,
  userMessage,
  conversationHistory = [],
  messageType = 'text'
) => {
  try {
    // Get agent details
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agentId },
    });

    if (!agents || agents.length === 0) {
      throw new Error('Agent not found');
    }

    const agent = agents[0];

    // Get user's service configuration
    const { data: configs } = await query('service_configs', 'select', {
      filter: { user_id: userId },
    });

    const config = configs?.[0] || {
      llm_provider: 'groq',
      llm_model: 'llama-3.3-70b-versatile',
      tts_provider: 'deepgram',
      tts_voice: 'aura-2-helena-en',
      stt_provider: 'deepgram',
      stt_model: 'nova-3-general',
    };

    let transcript = userMessage;

    // If audio, convert to text first
    if (messageType === 'audio') {
      const sttResult = await speechToText(userMessage, config.stt_model);
      if (!sttResult.success) {
        throw new Error('Failed to transcribe audio');
      }
      transcript = sttResult.transcript;
    }

    // Generate AI response using configured LLM
    const aiResponse = await generateResponse(
      agent.description,
      conversationHistory,
      transcript,
      config.llm_model
    );

    if (!aiResponse.success) {
      throw new Error('Failed to generate AI response');
    }

    // Generate audio response if needed
    let audioResponse = null;
    if (messageType === 'audio') {
      const ttsResult = await textToSpeech(aiResponse.message, config.tts_voice);
      if (ttsResult.success) {
        audioResponse = ttsResult.audio;
      }
    }

    return {
      success: true,
      userMessage: transcript,
      aiMessage: aiResponse.message,
      audio: audioResponse,
      config: {
        llm: `${config.llm_provider}/${config.llm_model}`,
        tts: `${config.tts_provider}/${config.tts_voice}`,
        stt: `${config.stt_provider}/${config.stt_model}`,
      },
    };
  } catch (error) {
    console.error('Process conversation turn error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate initial call greeting
 */
export const generateCallGreeting = async (agentId, userId) => {
  try {
    const { data: agents } = await query('agents', 'select', {
      filter: { id: agentId },
    });

    if (!agents || agents.length === 0) {
      throw new Error('Agent not found');
    }

    const agent = agents[0];

    // Get user's service configuration
    const { data: configs } = await query('service_configs', 'select', {
      filter: { user_id: userId },
    });

    const config = configs?.[0] || {
      llm_model: 'llama-3.3-70b-versatile',
      tts_voice: 'aura-2-helena-en',
    };

    // Generate greeting
    const systemPrompt = `${agent.description}\n\nGenerate a brief, professional greeting for this ${agent.type} call. Introduce yourself and state the purpose. Keep it under 3 sentences.`;

    const response = await generateResponse(
      systemPrompt,
      [],
      'Generate greeting',
      config.llm_model
    );

    if (!response.success) {
      // Fallback greeting
      return {
        success: true,
        greeting: `Hi, this call may be recorded for quality and training purposes. My name is Sam, and I'm calling from ${agent.use_case}. How can I assist you today?`,
        audio: null,
      };
    }

    // Generate audio for greeting
    const ttsResult = await textToSpeech(response.message, config.tts_voice);

    return {
      success: true,
      greeting: response.message,
      audio: ttsResult.success ? ttsResult.audio : null,
    };
  } catch (error) {
    console.error('Generate greeting error:', error);
    return {
      success: false,
      error: error.message,
      greeting: 'Hello, how can I help you today?',
    };
  }
};

/**
 * Detect call intent/disposition
 */
export const detectCallDisposition = (conversationHistory) => {
  if (!conversationHistory || conversationHistory.length === 0) {
    return 'no_response';
  }

  const lastMessages = conversationHistory.slice(-3);
  const userMessages = lastMessages.filter(m => m.role === 'user');

  // Check for common dispositions
  if (userMessages.length === 0) {
    return 'user_idle_max_duration_exceeded';
  }

  const lastUserMessage = userMessages[userMessages.length - 1]?.content?.toLowerCase() || '';

  if (lastUserMessage.includes('bye') || lastUserMessage.includes('goodbye')) {
    return 'user_hangup';
  }

  if (lastUserMessage.includes('transfer') || lastUserMessage.includes('speak to someone')) {
    return 'transfer_requested';
  }

  if (lastUserMessage.includes('not interested') || lastUserMessage.includes('no thanks')) {
    return 'not_interested';
  }

  if (lastUserMessage.includes('call back') || lastUserMessage.includes('later')) {
    return 'callback_requested';
  }

  return 'completed';
};

/**
 * Validate AI service configuration
 */
export const validateServiceConfig = (config) => {
  const validProviders = {
    llm: ['groq', 'openai', 'google', 'azure', 'dograh'],
    tts: ['deepgram', 'elevenlabs', 'openai', 'dograh'],
    stt: ['deepgram', 'cartesia', 'openai', 'dograh'],
  };

  const errors = [];

  if (config.llm_provider && !validProviders.llm.includes(config.llm_provider)) {
    errors.push(`Invalid LLM provider: ${config.llm_provider}`);
  }

  if (config.tts_provider && !validProviders.tts.includes(config.tts_provider)) {
    errors.push(`Invalid TTS provider: ${config.tts_provider}`);
  }

  if (config.stt_provider && !validProviders.stt.includes(config.stt_provider)) {
    errors.push(`Invalid STT provider: ${config.stt_provider}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
