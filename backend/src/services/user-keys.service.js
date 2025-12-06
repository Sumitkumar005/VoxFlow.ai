import { query } from '../utils/supabase.js';
import { 
  encryptAPIKey, 
  decryptAPIKey, 
  validateAPIKeyFormat, 
  hashAPIKeyForLogging 
} from '../utils/encryption.js';

/**
 * Supported API providers
 */
export const SUPPORTED_PROVIDERS = ['groq', 'deepgram', 'twilio'];

/**
 * Save or update a user's API key for a specific provider
 * @param {string} userId - User ID
 * @param {string} provider - API provider (groq, deepgram, twilio)
 * @param {string} apiKey - The API key to encrypt and store
 * @returns {Promise<Object>} Success response
 */
export const saveUserAPIKey = async (userId, provider, keyData) => {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
    }

    if (!keyData || typeof keyData !== 'object') {
      throw new Error('Invalid API key data');
    }

    // Validate required fields based on provider
    if (provider === 'twilio') {
      if (!keyData.account_sid || !keyData.auth_token) {
        throw new Error('Twilio requires account_sid and auth_token');
      }
    } else {
      if (!keyData.api_key) {
        throw new Error(`${provider} requires api_key`);
      }
    }

    // Encrypt the API key data
    const dataToEncrypt = JSON.stringify(keyData);
    const encrypted = encryptAPIKey(dataToEncrypt);

    // Save to database (upsert - insert or update)
    const { data, error } = await query('user_api_keys', 'upsert', {
      data: {
        user_id: userId,
        provider,
        api_key_encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        is_active: true,
        last_used_at: null, // Will be updated when key is used
      },
      onConflict: 'user_id,provider', // Update if user_id + provider combination exists
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Log the action (with hashed key for security)
    console.log(`API key saved for user ${userId}, provider ${provider}`);

    return {
      success: true,
      message: `${provider} API key saved successfully`,
      provider,
      created_at: data?.[0]?.created_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error saving API key for user ${userId}, provider ${provider}:`, error.message);
    throw error;
  }
};

/**
 * Retrieve and decrypt a user's API key for a specific provider
 * @param {string} userId - User ID
 * @param {string} provider - API provider (groq, deepgram, twilio)
 * @returns {Promise<string>} Decrypted API key
 */
export const getUserAPIKey = async (userId, provider) => {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Retrieve from database
    const { data, error } = await query('user_api_keys', 'select', {
      filter: { 
        user_id: userId, 
        provider, 
        is_active: true 
      },
      columns: 'api_key_encrypted, iv, auth_tag, created_at, last_used_at',
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`No ${provider} API key configured. Please add your API key in Settings.`);
    }

    const keyData = data[0];

    // Decrypt the API key data
    const decryptedData = decryptAPIKey({
      encrypted: keyData.api_key_encrypted,
      iv: keyData.iv,
      authTag: keyData.auth_tag,
    });

    // Parse the JSON data
    const parsedData = JSON.parse(decryptedData);

    // Update last_used_at timestamp asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        await query('user_api_keys', 'update', {
          filter: { user_id: userId, provider },
          data: { last_used_at: new Date().toISOString() },
        });
      } catch (updateError) {
        console.error(`Failed to update last_used_at for user ${userId}, provider ${provider}:`, updateError.message);
      }
    });

    // Return the appropriate field based on provider
    if (provider === 'groq' || provider === 'deepgram') {
      return parsedData.api_key;
    } else if (provider === 'twilio') {
      return parsedData; // Return full object for Twilio
    }

    return parsedData;
  } catch (error) {
    console.error(`Error retrieving API key for user ${userId}, provider ${provider}:`, error.message);
    throw error;
  }
};

/**
 * Get all configured API keys for a user (without decrypting them)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of configured providers with metadata
 */
export const getUserAPIKeyStatus = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    const { data, error } = await query('user_api_keys', 'select', {
      filter: { user_id: userId, is_active: true },
      columns: 'provider, api_key_encrypted, iv, auth_tag, created_at, last_used_at',
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Create status object for all supported providers with proper structure
    const status = {};
    
    // Initialize all providers with empty structure
    status.groq = { api_key: '', is_active: false };
    status.deepgram = { api_key: '', is_active: false };
    status.twilio = { 
      account_sid: '', 
      auth_token: '', 
      phone_number: '', 
      is_active: false 
    };

    // Update with actual data if available
    if (data && data.length > 0) {
      console.log(`Found ${data.length} API key records for user ${userId}`);
      data.forEach(keyData => {
        const provider = keyData.provider;
        const hasEncrypted = !!(keyData.api_key_encrypted && keyData.iv && keyData.auth_tag);
        console.log(`Provider ${provider}: has_encrypted=${hasEncrypted}, encrypted_length=${keyData.api_key_encrypted?.length || 0}`);
        
        // Only mark as active if we have encrypted data
        if (status[provider] && hasEncrypted) {
          status[provider].is_active = true;
          // Don't return the actual encrypted keys for security
          // Frontend will show masked values and allow editing
        }
      });
    } else {
      console.log(`No API key records found for user ${userId}`);
    }

    return status;
  } catch (error) {
    console.error(`Error getting API key status for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Delete a user's API key for a specific provider
 * @param {string} userId - User ID
 * @param {string} provider - API provider (groq, deepgram, twilio)
 * @returns {Promise<Object>} Success response
 */
export const deleteUserAPIKey = async (userId, provider) => {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Soft delete by setting is_active to false
    const { data, error } = await query('user_api_keys', 'update', {
      filter: { user_id: userId, provider },
      data: { is_active: false },
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`No ${provider} API key found for user`);
    }

    console.log(`API key deleted for user ${userId}, provider ${provider}`);

    return {
      success: true,
      message: `${provider} API key deleted successfully`,
      provider,
    };
  } catch (error) {
    console.error(`Error deleting API key for user ${userId}, provider ${provider}:`, error.message);
    throw error;
  }
};

/**
 * Validate that a user has all required API keys configured
 * @param {string} userId - User ID
 * @param {Array} requiredProviders - Array of required providers
 * @returns {Promise<Object>} Validation result
 */
export const validateUserAPIKeys = async (userId, requiredProviders = SUPPORTED_PROVIDERS) => {
  try {
    const status = await getUserAPIKeyStatus(userId);
    const missing = [];
    const configured = [];

    requiredProviders.forEach(provider => {
      if (status[provider]?.configured) {
        configured.push(provider);
      } else {
        missing.push(provider);
      }
    });

    return {
      valid: missing.length === 0,
      configured,
      missing,
      message: missing.length > 0 
        ? `Missing API keys for: ${missing.join(', ')}. Please configure them in Settings.`
        : 'All required API keys are configured',
    };
  } catch (error) {
    console.error(`Error validating API keys for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Bulk save multiple API keys for a user
 * @param {string} userId - User ID
 * @param {Object} apiKeys - Object with provider names as keys and API keys as values
 * @returns {Promise<Object>} Bulk save result
 */
export const saveUserAPIKeys = async (userId, apiKeys) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    if (!apiKeys || typeof apiKeys !== 'object') {
      throw new Error('Invalid API keys object');
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each API key
    for (const [provider, apiKey] of Object.entries(apiKeys)) {
      if (apiKey && apiKey.trim()) {
        try {
          await saveUserAPIKey(userId, provider, apiKey.trim());
          results.success.push(provider);
        } catch (error) {
          results.failed.push({
            provider,
            error: error.message,
          });
        }
      }
    }

    return {
      success: results.failed.length === 0,
      message: results.failed.length === 0 
        ? `Successfully saved ${results.success.length} API keys`
        : `Saved ${results.success.length} API keys, ${results.failed.length} failed`,
      results,
    };
  } catch (error) {
    console.error(`Error bulk saving API keys for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Test an API key by making a simple API call (without storing it)
 * @param {string} provider - API provider
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} Test result
 */
export const testAPIKey = async (provider, apiKey) => {
  try {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!validateAPIKeyFormat(provider, apiKey)) {
      throw new Error(`Invalid API key format for ${provider}`);
    }

    // For now, we'll just validate the format
    // In a full implementation, you might make actual API calls to test
    return {
      valid: true,
      provider,
      message: `${provider} API key format is valid`,
      tested_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      valid: false,
      provider,
      message: error.message,
      tested_at: new Date().toISOString(),
    };
  }
};

/**
 * Get usage statistics for API keys
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Usage statistics
 */
export const getAPIKeyUsageStats = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    // Get API key metadata
    const { data: keyData, error: keyError } = await query('user_api_keys', 'select', {
      filter: { user_id: userId, is_active: true },
      columns: 'provider, created_at, last_used_at',
    });

    if (keyError) {
      throw new Error(`Database error: ${keyError.message}`);
    }

    // Get usage data from user_usage_tracking
    const { data: usageData, error: usageError } = await query('user_usage_tracking', 'select', {
      filter: { user_id: userId },
      columns: 'date, total_tokens, total_calls, api_costs',
      orderBy: 'date DESC',
      limit: 30, // Last 30 days
    });

    if (usageError) {
      throw new Error(`Database error: ${usageError.message}`);
    }

    // Calculate totals
    const totals = usageData?.reduce((acc, day) => ({
      total_tokens: acc.total_tokens + (parseFloat(day.total_tokens) || 0),
      total_calls: acc.total_calls + (day.total_calls || 0),
      total_costs: acc.total_costs + (parseFloat(day.api_costs) || 0),
    }), { total_tokens: 0, total_calls: 0, total_costs: 0 }) || 
    { total_tokens: 0, total_calls: 0, total_costs: 0 };

    return {
      configured_keys: keyData?.length || 0,
      key_details: keyData || [],
      usage_summary: totals,
      daily_usage: usageData || [],
    };
  } catch (error) {
    console.error(`Error getting API key usage stats for user ${userId}:`, error.message);
    throw error;
  }
};