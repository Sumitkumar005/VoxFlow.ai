import { EventEmitter } from 'events';
import { speechToText, textToSpeech } from './deepgram.service.js';
import { generateResponse } from './groq.service.js';

/**
 * WebRTC Call Session Manager
 * Handles real-time audio streaming for web calls
 */
export class WebRTCCallSession extends EventEmitter {
  constructor(runId, agentConfig, serviceConfig) {
    super();
    this.runId = runId;
    this.agentConfig = agentConfig;
    this.serviceConfig = serviceConfig;
    this.conversationHistory = [];
    this.isActive = false;
    this.audioChunks = [];
  }

  /**
   * Start the call session
   */
  async start() {
    this.isActive = true;
    this.emit('started', { runId: this.runId });

    // Send initial greeting
    const greeting = await this.generateGreeting();
    this.emit('message', {
      role: 'assistant',
      content: greeting.message,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      greeting: greeting.message,
    };
  }

  /**
   * Process incoming audio from user
   * @param {Buffer} audioBuffer - Audio data from microphone
   */
  async processAudio(audioBuffer) {
    if (!this.isActive) {
      throw new Error('Call session is not active');
    }

    try {
      // Store audio chunk for recording
      this.audioChunks.push(audioBuffer);

      // Convert speech to text
      const sttResult = await speechToText(audioBuffer, this.serviceConfig.stt_model);

      if (!sttResult.success || !sttResult.transcript) {
        return {
          success: false,
          error: 'Failed to transcribe audio',
        };
      }

      const userMessage = sttResult.transcript;

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      this.emit('message', {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      });

      // Generate AI response
      const aiResponse = await generateResponse(
        this.agentConfig.description,
        this.conversationHistory,
        userMessage,
        this.serviceConfig.llm_model
      );

      if (aiResponse.success) {
        this.conversationHistory.push({
          role: 'assistant',
          content: aiResponse.message,
        });

        this.emit('message', {
          role: 'assistant',
          content: aiResponse.message,
          timestamp: new Date().toISOString(),
        });

        // Convert response to speech
        const ttsResult = await textToSpeech(
          aiResponse.message,
          this.serviceConfig.tts_voice
        );

        return {
          success: true,
          transcript: userMessage,
          response: aiResponse.message,
          audio: ttsResult.success ? ttsResult.audio : null,
        };
      } else {
        throw new Error('Failed to generate AI response');
      }
    } catch (error) {
      console.error('WebRTC audio processing error:', error);
      this.emit('error', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process text message (for text-based web calling)
   */
  async processMessage(message) {
    if (!this.isActive) {
      throw new Error('Call session is not active');
    }

    try {
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: message,
      });

      this.emit('message', {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Generate AI response
      const aiResponse = await generateResponse(
        this.agentConfig.description,
        this.conversationHistory,
        message,
        this.serviceConfig.llm_model
      );

      if (aiResponse.success) {
        this.conversationHistory.push({
          role: 'assistant',
          content: aiResponse.message,
        });

        this.emit('message', {
          role: 'assistant',
          content: aiResponse.message,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: aiResponse.message,
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error('Failed to generate AI response');
      }
    } catch (error) {
      console.error('WebRTC message processing error:', error);
      this.emit('error', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate initial greeting
   */
  async generateGreeting() {
    const greetingPrompt = `Generate a brief, friendly greeting for this ${this.agentConfig.type} call. Keep it under 2 sentences.`;
    
    const response = await generateResponse(
      this.agentConfig.description,
      [],
      greetingPrompt,
      this.serviceConfig.llm_model
    );

    return response;
  }

  /**
   * End the call session
   */
  async end(disposition = 'user_hangup') {
    this.isActive = false;

    const transcript = this.conversationHistory
      .map((msg, idx) => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${msg.role}: ${msg.content}`;
      })
      .join('\n\n');

    this.emit('ended', {
      runId: this.runId,
      transcript,
      conversationHistory: this.conversationHistory,
      disposition,
    });

    return {
      success: true,
      transcript,
      conversationHistory: this.conversationHistory,
      audioChunks: this.audioChunks,
    };
  }

  /**
   * Get current conversation history
   */
  getConversationHistory() {
    return this.conversationHistory;
  }

  /**
   * Check if session is active
   */
  isSessionActive() {
    return this.isActive;
  }
}

/**
 * Create a new WebRTC call session
 */
export const createCallSession = (runId, agentConfig, serviceConfig) => {
  return new WebRTCCallSession(runId, agentConfig, serviceConfig);
};

/**
 * Active sessions store
 */
const activeSessions = new Map();

/**
 * Store active session
 */
export const storeSession = (runId, session) => {
  activeSessions.set(runId, session);
};

/**
 * Get active session
 */
export const getSession = (runId) => {
  return activeSessions.get(runId);
};

/**
 * Remove session
 */
export const removeSession = (runId) => {
  activeSessions.delete(runId);
};