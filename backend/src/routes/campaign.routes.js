import express from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  createCampaignValidation,
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadCSV, handleUploadError } from '../middleware/upload.middleware.js';
import { 
  checkCampaignOwnership, 
  checkAgentOwnership, 
  logAdminAction 
} from '../middleware/rbac.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = express.Router();

// All campaign routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/campaigns
 * @desc    Create new campaign with CSV upload (with validation and agent ownership verification)
 * @access  Private
 */
router.post('/', uploadRateLimiter, uploadCSV, handleUploadError, createCampaignValidation, logAdminAction('create_campaign'), createCampaign);

/**
 * @route   GET /api/campaigns
 * @desc    Get all campaigns for user (filtered by ownership)
 * @access  Private
 */
router.get('/', getCampaigns);

/**
 * @route   GET /api/campaigns/:id
 * @desc    Get campaign by ID with runs (ownership protected)
 * @access  Private
 */
router.get('/:id', checkCampaignOwnership, getCampaignById);

/**
 * @route   POST /api/campaigns/:id/start
 * @desc    Start campaign execution (ownership protected)
 * @access  Private
 */
router.post('/:id/start', checkCampaignOwnership, logAdminAction('start_campaign'), startCampaign);

/**
 * @route   POST /api/campaigns/:id/pause
 * @desc    Pause campaign (ownership protected)
 * @access  Private
 */
router.post('/:id/pause', checkCampaignOwnership, logAdminAction('pause_campaign'), pauseCampaign);

/**
 * @route   POST /api/campaigns/:id/resume
 * @desc    Resume paused campaign (ownership protected)
 * @access  Private
 */
router.post('/:id/resume', checkCampaignOwnership, logAdminAction('resume_campaign'), resumeCampaign);

/**
 * @route   POST /api/campaigns/:id/stop
 * @desc    Stop campaign (ownership protected)
 * @access  Private
 */
router.post('/:id/stop', checkCampaignOwnership, logAdminAction('stop_campaign'), stopCampaign);

export default router;