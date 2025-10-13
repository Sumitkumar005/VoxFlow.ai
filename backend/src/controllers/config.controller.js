import { query } from '../utils/supabase.js';

/**
 * Get service configuration (LLM, TTS, STT)
 */
export const getServiceConfig = async (req, res, next) => {
  try {
    const { data } = await query('service_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    // Return default config if not found
    const config = data?.[0] || {
      llm_provider: 'groq',
      llm_model: 'llama-3.3-70b-versatile',
      tts_provider: 'deepgram',
      tts_voice: 'aura-2-helena-en',
      stt_provider: 'deepgram',
      stt_model: 'nova-3-general',
    };

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save or update service configuration
 */
export const saveServiceConfig = async (req, res, next) => {
  try {
    const {
      llm_provider,
      llm_model,
      tts_provider,
      tts_voice,
      stt_provider,
      stt_model,
    } = req.body;

    // Check if config exists
    const { data: existing } = await query('service_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    let result;

    if (existing && existing.length > 0) {
      // Update existing config
      const updateData = {};
      if (llm_provider) updateData.llm_provider = llm_provider;
      if (llm_model) updateData.llm_model = llm_model;
      if (tts_provider) updateData.tts_provider = tts_provider;
      if (tts_voice) updateData.tts_voice = tts_voice;
      if (stt_provider) updateData.stt_provider = stt_provider;
      if (stt_model) updateData.stt_model = stt_model;
      updateData.updated_at = new Date().toISOString();

      const { data } = await query('service_configs', 'update', {
        filter: { user_id: req.user.id },
        data: updateData,
      });
      result = data[0];
    } else {
      // Create new config
      const { data } = await query('service_configs', 'insert', {
        data: {
          user_id: req.user.id,
          llm_provider: llm_provider || 'groq',
          llm_model: llm_model || 'llama-3.3-70b-versatile',
          tts_provider: tts_provider || 'deepgram',
          tts_voice: tts_voice || 'aura-2-helena-en',
          stt_provider: stt_provider || 'deepgram',
          stt_model: stt_model || 'nova-3-general',
        },
      });
      result = data[0];
    }

    res.json({
      success: true,
      message: 'Configuration saved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get telephony configuration (Twilio)
 */
export const getTelephonyConfig = async (req, res, next) => {
  try {
    const { data } = await query('telephony_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No telephony configuration found',
      });
    }

    // Don't send auth_token to client
    const { auth_token, ...config } = data[0];

    res.json({
      success: true,
      data: {
        ...config,
        is_configured: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save or update telephony configuration
 */
export const saveTelephonyConfig = async (req, res, next) => {
  try {
    const { provider, account_sid, auth_token, from_phone_number } = req.body;

    // Validation
    if (!account_sid || !auth_token || !from_phone_number) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: account_sid, auth_token, from_phone_number',
      });
    }

    // Check if config exists
    const { data: existing } = await query('telephony_configs', 'select', {
      filter: { user_id: req.user.id },
    });

    let result;

    if (existing && existing.length > 0) {
      // Update existing config
      const { data } = await query('telephony_configs', 'update', {
        filter: { user_id: req.user.id },
        data: {
          provider: provider || 'twilio',
          account_sid,
          auth_token,
          from_phone_number,
        },
      });
      result = data[0];
    } else {
      // Create new config
      const { data } = await query('telephony_configs', 'insert', {
        data: {
          user_id: req.user.id,
          provider: provider || 'twilio',
          account_sid,
          auth_token,
          from_phone_number,
        },
      });
      result = data[0];
    }

    // Don't send auth_token back
    const { auth_token: _, ...safeResult } = result;

    res.json({
      success: true,
      message: 'Telephony configuration saved successfully',
      data: safeResult,
    });
  } catch (error) {
    next(error);
  }
};