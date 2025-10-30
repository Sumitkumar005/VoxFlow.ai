import express from 'express';
import {
  getAllUsers,
  getUserDetails,
  updateUserLimits,
  toggleUserStatus,
  getAllAgents,
  deleteUser,
  getSubscriptionTiersInfo,
  updateUserLimitsValidation,
  userIdValidation,
} from '../controllers/admin.controller.js';
import {
  getPlatformOverview,
  getUserGrowthAnalytics,
  getUsageAnalytics,
  getRevenueAnalytics,
  getSystemHealth,
  getAuditLogs,
  exportAnalyticsData,
} from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin, logAdminAction } from '../middleware/rbac.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, subscription_tier, role, is_active, sort_by, sort_order
 */
router.get('/users', getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get detailed user information by ID
 * @access  Admin only
 */
router.get('/users/:id', userIdValidation, getUserDetails);

/**
 * @route   PUT /api/admin/users/:id/limits
 * @desc    Update user limits and subscription
 * @access  Admin only
 */
router.put('/users/:id/limits', 
  updateUserLimitsValidation, 
  logAdminAction('update_user_limits'), 
  updateUserLimits
);

/**
 * @route   POST /api/admin/users/:id/toggle-status
 * @desc    Activate or deactivate user account
 * @access  Admin only
 */
router.post('/users/:id/toggle-status', 
  userIdValidation, 
  logAdminAction('toggle_user_status'), 
  toggleUserStatus
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user account (admin only)
 * @access  Admin only
 */
router.delete('/users/:id', 
  userIdValidation, 
  logAdminAction('delete_user'), 
  deleteUser
);

/**
 * @route   GET /api/admin/agents
 * @desc    Get all agents across all users
 * @access  Admin only
 * @query   page, limit, search, type, user_id, sort_by, sort_order
 */
router.get('/agents', getAllAgents);

/**
 * @route   GET /api/admin/subscription-tiers
 * @desc    Get subscription tiers information with user counts
 * @access  Admin only
 */
router.get('/subscription-tiers', getSubscriptionTiersInfo);

// Analytics Routes

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Get platform overview statistics
 * @access  Admin only
 */
router.get('/analytics/overview', getPlatformOverview);

/**
 * @route   GET /api/admin/analytics/user-growth
 * @desc    Get user growth analytics
 * @access  Admin only
 * @query   period (7d, 30d, 90d, 1y)
 */
router.get('/analytics/user-growth', getUserGrowthAnalytics);

/**
 * @route   GET /api/admin/analytics/usage
 * @desc    Get usage analytics across the platform
 * @access  Admin only
 * @query   period, limit
 */
router.get('/analytics/usage', getUsageAnalytics);

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin only
 */
router.get('/analytics/revenue', getRevenueAnalytics);

/**
 * @route   GET /api/admin/analytics/system-health
 * @desc    Get system health metrics
 * @access  Admin only
 */
router.get('/analytics/system-health', getSystemHealth);

/**
 * @route   GET /api/admin/analytics/export/:type
 * @desc    Export analytics data as CSV
 * @access  Admin only
 */
router.get('/analytics/export/:type', exportAnalyticsData);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs with filtering
 * @access  Admin only
 * @query   page, limit, action, admin_user_id, target_user_id, date_from, date_to
 */
router.get('/audit-logs', getAuditLogs);

export default router;