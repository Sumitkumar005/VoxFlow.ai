/**
 * Rate Limit Routes
 * 
 * Routes for managing and monitoring rate limits
 */

import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import {
  getUserRateLimitStatus,
  getAdminUserRateLimitStatus,
  resetAdminUserRateLimits,
  getPlatformRateLimitStats,
  getRateLimitConfiguration
} from '../controllers/rateLimit.controller.js';

const router = express.Router();

/**
 * @route   GET /api/rate-limits/status
 * @desc    Get current user's rate limit status
 * @access  Private
 */
router.get('/status', authenticate, getUserRateLimitStatus);

/**
 * @route   GET /api/rate-limits/config
 * @desc    Get rate limit configuration for all tiers
 * @access  Private
 */
router.get('/config', authenticate, getRateLimitConfiguration);

/**
 * @route   GET /api/rate-limits/admin/users/:userId/status
 * @desc    Get rate limit status for specific user
 * @access  Admin only
 */
router.get('/admin/users/:userId/status', authenticate, requireRole('admin'), getAdminUserRateLimitStatus);

/**
 * @route   POST /api/rate-limits/admin/users/:userId/reset
 * @desc    Reset rate limits for specific user
 * @access  Admin only
 */
router.post('/admin/users/:userId/reset', authenticate, requireRole('admin'), resetAdminUserRateLimits);

/**
 * @route   GET /api/rate-limits/admin/stats
 * @desc    Get platform-wide rate limiting statistics
 * @access  Admin only
 */
router.get('/admin/stats', authenticate, requireRole('admin'), getPlatformRateLimitStats);

export default router;