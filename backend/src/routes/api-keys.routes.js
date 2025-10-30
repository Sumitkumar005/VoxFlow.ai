import express from 'express';
import {
  getAPIKeyStatus,
  saveAPIKey,
  saveAPIKeysBulk,
  deleteAPIKey,
  testAPIKeyEndpoint,
  validateAPIKeys,
  getUsageStats,
  getProviders,
} from '../controllers/api-keys.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { logAdminAction } from '../middleware/rbac.middleware.js';
import { 
  validateAPIKey,
  securityAuditLog
} from '../middleware/security.middleware.js';

const router = express.Router();

// All API key routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/api-keys/providers
 * @desc    Get supported providers and their information
 * @access  Private
 */
router.get('/providers', getProviders);

/**
 * @route   GET /api/api-keys/status
 * @desc    Get API key configuration status for current user
 * @access  Private
 */
router.get('/status', getAPIKeyStatus);

/**
 * @route   GET /api/api-keys/validate
 * @desc    Validate user's API keys configuration
 * @access  Private
 * @query   providers - Comma-separated list of providers to validate (optional)
 */
router.get('/validate', validateAPIKeys);

/**
 * @route   GET /api/api-keys/usage
 * @desc    Get API key usage statistics
 * @access  Private
 */
router.get('/usage', getUsageStats);

/**
 * @route   POST /api/api-keys/test
 * @desc    Test API key without saving it
 * @access  Private
 */
router.post('/test', validateAPIKey, securityAuditLog, testAPIKeyEndpoint);

/**
 * @route   POST /api/api-keys/bulk
 * @desc    Save multiple API keys at once
 * @access  Private
 */
router.post('/bulk', logAdminAction('bulk_save_api_keys'), securityAuditLog, saveAPIKeysBulk);

/**
 * @route   POST /api/api-keys/:provider
 * @desc    Save or update API key for specific provider
 * @access  Private
 */
router.post('/:provider', validateAPIKey, logAdminAction('save_api_key'), securityAuditLog, saveAPIKey);

/**
 * @route   DELETE /api/api-keys/:provider
 * @desc    Delete API key for specific provider
 * @access  Private
 */
router.delete('/:provider', validateAPIKey, logAdminAction('delete_api_key'), securityAuditLog, deleteAPIKey);

export default router;