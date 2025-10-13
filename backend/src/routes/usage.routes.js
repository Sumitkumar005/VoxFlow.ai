import express from 'express';
import {
  getUsageDashboard,
  getUsageHistory,
} from '../controllers/usage.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All usage routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/usage/dashboard
 * @desc    Get usage dashboard data
 * @access  Private
 */
router.get('/dashboard', getUsageDashboard);

/**
 * @route   GET /api/usage/history
 * @desc    Get usage history with filters
 * @access  Private
 */
router.get('/history', getUsageHistory);

export default router;