import { body, param, validationResult } from 'express-validator';
import {
  saveUserAPIKey,
  getUserAPIKeyStatus,
  deleteUserAPIKey,
  validateUserAPIKeys,
  saveUserAPIKeys,
  testAPIKey,
  getAPIKeyUsageStats,
  SUPPORTED_PROVIDERS,
} from '../services/user-keys.service.js';

/**
 * Get API key status for current user
 * @route GET /api/api-keys/status
 */
export const getAPIKeyStatus = async (req, res, next) => {
  try {
    console.log('Getting API key status for user:', req.user.id);
    const userId = req.user.id;
    const status = await getUserAPIKeyStatus(userId);
    console.log('API key status retrieved:', status);

    res.json({
      success: true,
      data: status,
      supported_providers: SUPPORTED_PROVIDERS,
    });
  } catch (error) {
    console.error('Error in getAPIKeyStatus:', error);
    next(error);
  }
};

/**
 * Save or update API key for a specific provider
 * @route POST /api/api-keys/:provider
 */
export const saveAPIKey = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { provider } = req.params;
    
    // Handle different provider data structures
    let keyData;
    if (provider === 'twilio') {
      const { account_sid, auth_token, phone_number } = req.body;
      keyData = { account_sid, auth_token, phone_number };
    } else {
      const { api_key } = req.body;
      keyData = { api_key };
    }

    const result = await saveUserAPIKey(userId, provider, keyData);

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        provider: result.provider,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save multiple API keys at once
 * @route POST /api/api-keys/bulk
 */
export const saveAPIKeysBulk = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { api_keys } = req.body;

    const result = await saveUserAPIKeys(userId, api_keys);

    const statusCode = result.success ? 201 : 207; // 207 = Multi-Status for partial success

    res.status(statusCode).json({
      success: result.success,
      message: result.message,
      data: result.results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete API key for a specific provider
 * @route DELETE /api/api-keys/:provider
 */
export const deleteAPIKey = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { provider } = req.params;

    const result = await deleteUserAPIKey(userId, provider);

    res.json({
      success: true,
      message: result.message,
      data: {
        provider: result.provider,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test API key without saving it
 * @route POST /api/api-keys/test
 */
export const testAPIKeyEndpoint = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { provider, api_key } = req.body;

    const result = await testAPIKey(provider, api_key);

    res.json({
      success: result.valid,
      message: result.message,
      data: {
        provider: result.provider,
        valid: result.valid,
        tested_at: result.tested_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate user's API keys
 * @route GET /api/api-keys/validate
 */
export const validateAPIKeys = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { providers } = req.query;

    // Parse providers from query string
    const requiredProviders = providers 
      ? providers.split(',').filter(p => SUPPORTED_PROVIDERS.includes(p))
      : SUPPORTED_PROVIDERS;

    const result = await validateUserAPIKeys(userId, requiredProviders);

    res.json({
      success: result.valid,
      message: result.message,
      data: {
        valid: result.valid,
        configured: result.configured,
        missing: result.missing,
        required: requiredProviders,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get API key usage statistics
 * @route GET /api/api-keys/usage
 */
export const getUsageStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await getAPIKeyUsageStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get supported providers and their requirements
 * @route GET /api/api-keys/providers
 */
export const getProviders = async (req, res, next) => {
  try {
    const providers = {
      groq: {
        name: 'Groq',
        description: 'Fast AI inference for language models',
        website: 'https://groq.com',
        key_format: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required_for: ['AI responses', 'Text generation'],
      },
      deepgram: {
        name: 'Deepgram',
        description: 'Speech-to-text and text-to-speech services',
        website: 'https://deepgram.com',
        key_format: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (40 hex characters)',
        required_for: ['Speech recognition', 'Voice synthesis'],
      },
      twilio: {
        name: 'Twilio',
        description: 'Cloud communications platform',
        website: 'https://twilio.com',
        key_format: 'Account SID and Auth Token (32-34 characters each)',
        required_for: ['Phone calls', 'SMS messaging'],
      },
    };

    res.json({
      success: true,
      data: {
        providers,
        supported: SUPPORTED_PROVIDERS,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for saving API key
 */
export const saveAPIKeyValidation = [
  param('provider')
    .isIn(SUPPORTED_PROVIDERS)
    .withMessage(`Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`),
  body('api_key')
    .isString()
    .trim()
    .isLength({ min: 10 })
    .withMessage('API key must be at least 10 characters long'),
];

/**
 * Validation rules for bulk saving API keys
 */
export const saveAPIKeysBulkValidation = [
  body('api_keys')
    .isObject()
    .withMessage('api_keys must be an object')
    .custom((value) => {
      const keys = Object.keys(value);
      const invalidProviders = keys.filter(key => !SUPPORTED_PROVIDERS.includes(key));
      if (invalidProviders.length > 0) {
        throw new Error(`Invalid providers: ${invalidProviders.join(', ')}`);
      }
      return true;
    }),
];

/**
 * Validation rules for deleting API key
 */
export const deleteAPIKeyValidation = [
  param('provider')
    .isIn(SUPPORTED_PROVIDERS)
    .withMessage(`Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`),
];

/**
 * Validation rules for testing API key
 */
export const testAPIKeyValidation = [
  body('provider')
    .isIn(SUPPORTED_PROVIDERS)
    .withMessage(`Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`),
  body('api_key')
    .isString()
    .trim()
    .isLength({ min: 10 })
    .withMessage('API key must be at least 10 characters long'),
];