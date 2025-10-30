import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import { getUserAPIKey } from './user-keys.service.js';
import { trackUsage } from './usage-tracking.service.js';
import { checkAPICallLimit } from './limit-enforcement.service.js';
import { APIKeyFallbackService } from './api-key-fallback.service.js';

dotenv.config();

// Remove global Deepgram instance - we'll create per-user instances

/**
 * Convert speech to text (STT) with user-specific API keys
 * @param {String} userId - User ID for API key and usage tracking
 * @param {Buffer|String} audioSource - Audio buffer or file path
 * @param {String} model - STT model to use
 */
export const speechToText = async (userId, audioSource, model = 'nova-3-general') => {
  try {
    // Estimate duration for limit checking (rough estimation)
    const estimatedDuration = estimateAudioDuration(audioSource);
    
    // Check if user can make this API call
    const limitCheck = await checkAPICallLimit(userId, { 
      provider: 'deepgram',
      duration: estimatedDuration 
    });

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: 'Usage limit exceeded',
        message: `Speech recognition unavailable. ${limitCheck.reason}`,
        limit_info: limitCheck.details,
      };
    }

    // Get user's Deepgram API key with fallback support
    let userDeepgramKey;
    let usingFallback = false;
    try {
      userDeepgramKey = await APIKeyFallbackService.getAPIKeyWithFallback(userId, 'deepgram');
      usingFallback = !(await APIKeyFallbackService.hasUserAPIKey(userId, 'deepgram'));
      
      // Log fallback usage for migration tracking
      await APIKeyFallbackService.logAPIKeyUsage(userId, 'deepgram', usingFallback);
    } catch (keyError) {
      return {
        success: false,
        error: 'API key not configured',
        message: 'Please configure your Deepgram API key in Settings.',
        setup_required: true,
        fallback_available: APIKeyFallbackService.hasEnvironmentFallback('deepgram'),
      };
    }

    // Create Deepgram client with user's API key
    const deepgram = createClient(userDeepgramKey);

    let source;

    if (typeof audioSource === 'string') {
      // File path provided
      const audioBuffer = fs.readFileSync(audioSource);
      source = { buffer: audioBuffer, mimetype: 'audio/wav' };
    } else {
      // Buffer provided
      source = { buffer: audioSource, mimetype: 'audio/wav' };
    }

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      source.buffer,
      {
        model,
        smart_format: true,
        punctuate: true,
      }
    );

    if (error) {
      throw error;
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;
    const actualDuration = result.metadata?.duration || estimatedDuration;

    // Track usage asynchronously
    setImmediate(async () => {
      try {
        await trackUsage(userId, {
          provider: 'deepgram',
          duration: actualDuration,
          calls: 1,
        });
      } catch (trackingError) {
        console.error('Failed to track Deepgram STT usage:', trackingError.message);
      }
    });

    return {
      success: true,
      transcript,
      confidence: result.results.channels[0].alternatives[0].confidence,
      duration: actualDuration,
      using_fallback: usingFallback,
    };
  } catch (error) {
    console.error('Deepgram STT error:', error);
    
    // Handle specific API errors
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      return {
        success: false,
        error: 'Invalid API key',
        message: 'Please check your Deepgram API key in Settings.',
        setup_required: true,
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Convert text to speech (TTS) with user-specific API keys
 * @param {String} userId - User ID for API key and usage tracking
 * @param {String} text - Text to convert
 * @param {String} voice - Voice model to use
 */
export const textToSpeech = async (userId, text, voice = 'aura-2-helena-en') => {
  try {
    // Estimate duration for limit checking (rough: ~150 words per minute)
    const estimatedDuration = estimateTextDuration(text);
    
    // Check if user can make this API call
    const limitCheck = await checkAPICallLimit(userId, { 
      provider: 'deepgram',
      duration: estimatedDuration 
    });

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: 'Usage limit exceeded',
        message: `Text-to-speech unavailable. ${limitCheck.reason}`,
        limit_info: limitCheck.details,
      };
    }

    // Get user's Deepgram API key with fallback support
    let userDeepgramKey;
    let usingFallback = false;
    try {
      userDeepgramKey = await APIKeyFallbackService.getAPIKeyWithFallback(userId, 'deepgram');
      usingFallback = !(await APIKeyFallbackService.hasUserAPIKey(userId, 'deepgram'));
      
      // Log fallback usage for migration tracking
      await APIKeyFallbackService.logAPIKeyUsage(userId, 'deepgram', usingFallback);
    } catch (keyError) {
      return {
        success: false,
        error: 'API key not configured',
        message: 'Please configure your Deepgram API key in Settings.',
        setup_required: true,
        fallback_available: APIKeyFallbackService.hasEnvironmentFallback('deepgram'),
      };
    }

    // Create Deepgram client with user's API key
    const deepgram = createClient(userDeepgramKey);

    const response = await deepgram.speak.request(
      { text },
      {
        model: voice,
        encoding: 'mp3',
        container: 'mp3',
      }
    );

    const stream = await response.getStream();
    const buffer = await getAudioBuffer(stream);

    // Track usage asynchronously
    setImmediate(async () => {
      try {
        await trackUsage(userId, {
          provider: 'deepgram',
          duration: estimatedDuration,
          calls: 1,
        });
      } catch (trackingError) {
        console.error('Failed to track Deepgram TTS usage:', trackingError.message);
      }
    });

    return {
      success: true,
      audio: buffer,
      duration: estimatedDuration,
      using_fallback: usingFallback,
    };
  } catch (error) {
    console.error('Deepgram TTS error:', error);
    
    // Handle specific API errors
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      return {
        success: false,
        error: 'Invalid API key',
        message: 'Please check your Deepgram API key in Settings.',
        setup_required: true,
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Helper to convert stream to buffer
 */
const getAudioBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Live transcription (for real-time calls) with user-specific API keys
 * @param {String} userId - User ID for API key
 */
export const startLiveTranscription = async (userId) => {
  try {
    // Get user's Deepgram API key with fallback support
    const userDeepgramKey = await APIKeyFallbackService.getAPIKeyWithFallback(userId, 'deepgram');

    // Create Deepgram client with user's API key
    const deepgram = createClient(userDeepgramKey);

    const connection = deepgram.listen.live({
      model: 'nova-3-general',
      language: 'en',
      smart_format: true,
      punctuate: true,
    });

    return connection;
  } catch (error) {
    console.error('Deepgram live transcription error:', error);
    throw error;
  }
};

/**
 * Estimate audio duration from buffer size (rough estimation)
 * @param {Buffer|String} audioSource - Audio buffer or file path
 * @returns {Number} Estimated duration in seconds
 */
const estimateAudioDuration = (audioSource) => {
  try {
    let bufferSize;
    
    if (typeof audioSource === 'string') {
      const stats = fs.statSync(audioSource);
      bufferSize = stats.size;
    } else {
      bufferSize = audioSource.length;
    }
    
    // Rough estimation: 16kHz, 16-bit, mono = ~32KB per second
    return Math.ceil(bufferSize / 32000);
  } catch (error) {
    // Default to 10 seconds if estimation fails
    return 10;
  }
};

/**
 * Estimate speech duration from text length
 * @param {String} text - Text to convert to speech
 * @returns {Number} Estimated duration in seconds
 */
const estimateTextDuration = (text) => {
  // Average speaking rate: ~150 words per minute
  const words = text.split(/\s+/).length;
  const minutes = words / 150;
  return Math.ceil(minutes * 60);
};