/**
 * API Key Fallback Service
 * 
 * Provides fallback mechanisms for missing user API keys during the transition period.
 * This ensures backward compatibility while users migrate to the new multi-tenant system.
 */

import { getUserAPIKey } from './user-keys.service.js';

class APIKeyFallbackService {
  /**
   * Get API key with fallback to environment variables
   * @param {string} userId - User ID
   * @param {string} provider - API provider (groq, deepgram, twilio)
   * @returns {Promise<string>} API key
   */
  static async getAPIKeyWithFallback(userId, provider) {
    try {
      // First, try to get user's API key
      const userAPIKey = await getUserAPIKey(userId, provider);
      if (userAPIKey) {
        return userAPIKey;
      }
    } catch (error) {
      // User doesn't have API key configured, continue to fallback
      console.log(`No user API key found for ${provider}, using fallback`);
    }

    // Fallback to environment variables (legacy behavior)
    return this.getEnvironmentAPIKey(provider);
  }

  /**
   * Get API key from environment variables (legacy fallback)
   * @param {string} provider - API provider
   * @returns {string} API key from environment
   */
  static getEnvironmentAPIKey(provider) {
    const envKeys = {
      groq: process.env.GROQ_API_KEY,
      deepgram: process.env.DEEPGRAM_API_KEY,
      twilio: process.env.TWILIO_AUTH_TOKEN
    };

    const apiKey = envKeys[provider];
    
    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}. Please configure your API key in settings.`);
    }

    return apiKey;
  }

  /**
   * Get Twilio credentials with fallback
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Twilio credentials
   */
  static async getTwilioCredentialsWithFallback(userId) {
    try {
      // Try to get user's Twilio credentials
      const userTwilioKey = await getUserAPIKey(userId, 'twilio');
      
      if (userTwilioKey) {
        // Parse user's Twilio credentials (stored as JSON)
        const credentials = JSON.parse(userTwilioKey);
        return {
          accountSid: credentials.account_sid,
          authToken: credentials.auth_token,
          fromPhoneNumber: credentials.from_phone_number
        };
      }
    } catch (error) {
      // User doesn't have Twilio configured, use fallback
      console.log('No user Twilio credentials found, using environment fallback');
    }

    // Fallback to environment variables
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER
    };
  }

  /**
   * Check if user has API key configured
   * @param {string} userId - User ID
   * @param {string} provider - API provider
   * @returns {Promise<boolean>} True if user has API key
   */
  static async hasUserAPIKey(userId, provider) {
    try {
      await getUserAPIKey(userId, provider);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if environment fallback is available
   * @param {string} provider - API provider
   * @returns {boolean} True if environment key exists
   */
  static hasEnvironmentFallback(provider) {
    const envKeys = {
      groq: process.env.GROQ_API_KEY,
      deepgram: process.env.DEEPGRAM_API_KEY,
      twilio: process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID
    };

    return !!envKeys[provider];
  }

  /**
   * Get API key status with fallback information
   * @param {string} userId - User ID
   * @param {string} provider - API provider
   * @returns {Promise<Object>} Status information
   */
  static async getAPIKeyStatus(userId, provider) {
    const hasUserKey = await this.hasUserAPIKey(userId, provider);
    const hasEnvFallback = this.hasEnvironmentFallback(provider);

    return {
      provider,
      hasUserKey,
      hasEnvFallback,
      isConfigured: hasUserKey || hasEnvFallback,
      usingFallback: !hasUserKey && hasEnvFallback,
      status: hasUserKey ? 'user_configured' : 
              hasEnvFallback ? 'using_fallback' : 'not_configured'
    };
  }

  /**
   * Get comprehensive API key status for all providers
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Status for all providers
   */
  static async getAllAPIKeyStatus(userId) {
    const providers = ['groq', 'deepgram', 'twilio'];
    const status = {};

    for (const provider of providers) {
      status[provider] = await this.getAPIKeyStatus(userId, provider);
    }

    return status;
  }

  /**
   * Validate API key functionality
   * @param {string} userId - User ID
   * @param {string} provider - API provider
   * @returns {Promise<Object>} Validation result
   */
  static async validateAPIKey(userId, provider) {
    try {
      const apiKey = await this.getAPIKeyWithFallback(userId, provider);
      
      // Basic validation - check if key exists and has reasonable format
      if (!apiKey || apiKey.length < 10) {
        return {
          valid: false,
          error: 'API key appears to be invalid or too short'
        };
      }

      // Provider-specific validation
      switch (provider) {
        case 'groq':
          if (!apiKey.startsWith('gsk_')) {
            return {
              valid: false,
              error: 'Groq API key should start with "gsk_"'
            };
          }
          break;
        
        case 'deepgram':
          // Deepgram keys are typically UUIDs or long strings
          if (apiKey.length < 32) {
            return {
              valid: false,
              error: 'Deepgram API key appears to be too short'
            };
          }
          break;
        
        case 'twilio':
          // For Twilio, we expect JSON with credentials
          try {
            const credentials = JSON.parse(apiKey);
            if (!credentials.account_sid || !credentials.auth_token) {
              return {
                valid: false,
                error: 'Twilio credentials missing account_sid or auth_token'
              };
            }
          } catch (error) {
            // If not JSON, treat as auth_token directly
            if (apiKey.length < 32) {
              return {
                valid: false,
                error: 'Twilio auth token appears to be too short'
              };
            }
          }
          break;
      }

      return {
        valid: true,
        usingFallback: !(await this.hasUserAPIKey(userId, provider))
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get migration recommendations for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Migration recommendations
   */
  static async getMigrationRecommendations(userId) {
    const status = await this.getAllAPIKeyStatus(userId);
    const recommendations = [];

    for (const [provider, providerStatus] of Object.entries(status)) {
      if (providerStatus.usingFallback) {
        recommendations.push({
          provider,
          priority: 'high',
          action: 'configure_user_key',
          message: `Configure your own ${provider} API key for better security and usage tracking`,
          fallbackAvailable: true
        });
      } else if (!providerStatus.isConfigured) {
        recommendations.push({
          provider,
          priority: 'medium',
          action: 'configure_key',
          message: `Configure ${provider} API key to enable ${provider} services`,
          fallbackAvailable: false
        });
      }
    }

    return {
      needsMigration: recommendations.some(r => r.priority === 'high'),
      recommendations,
      summary: {
        total_providers: Object.keys(status).length,
        user_configured: Object.values(status).filter(s => s.hasUserKey).length,
        using_fallback: Object.values(status).filter(s => s.usingFallback).length,
        not_configured: Object.values(status).filter(s => !s.isConfigured).length
      }
    };
  }

  /**
   * Log API key usage for tracking migration progress
   * @param {string} userId - User ID
   * @param {string} provider - API provider
   * @param {boolean} usedFallback - Whether fallback was used
   */
  static async logAPIKeyUsage(userId, provider, usedFallback) {
    try {
      // This could be enhanced to store usage statistics
      // For now, just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`API Key Usage: User ${userId}, Provider ${provider}, Fallback: ${usedFallback}`);
      }
    } catch (error) {
      // Don't let logging errors affect the main functionality
      console.error('Error logging API key usage:', error.message);
    }
  }
}

export { APIKeyFallbackService };