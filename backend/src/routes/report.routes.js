import express from 'express';
import {
  getDailyReports,
  downloadReportCSV,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All report routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/reports/daily
 * @desc    Get daily reports with metrics
 * @access  Private
 */
router.get('/daily', getDailyReports);

/**
 * @route   GET /api/reports/download
 * @desc    Download report as CSV
 * @access  Private
 */
router.get('/download', downloadReportCSV);

export default router;