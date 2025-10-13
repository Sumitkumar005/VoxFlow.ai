import express from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadCSV, handleUploadError } from '../middleware/upload.middleware.js';

const router = express.Router();

// All campaign routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/campaigns
 * @desc    Create new campaign with CSV upload
 * @access  Private
 */
router.post('/', uploadCSV, handleUploadError, createCampaign);

/**
 * @route   GET /api/campaigns
 * @desc    Get all campaigns for user
 * @access  Private
 */
router.get('/', getCampaigns);

/**
 * @route   GET /api/campaigns/:id
 * @desc    Get campaign by ID with runs
 * @access  Private
 */
router.get('/:id', getCampaignById);

/**
 * @route   POST /api/campaigns/:id/start
 * @desc    Start campaign execution
 * @access  Private
 */
router.post('/:id/start', startCampaign);

/**
 * @route   POST /api/campaigns/:id/pause
 * @desc    Pause campaign
 * @access  Private
 */
router.post('/:id/pause', pauseCampaign);

/**
 * @route   POST /api/campaigns/:id/resume
 * @desc    Resume paused campaign
 * @access  Private
 */
router.post('/:id/resume', resumeCampaign);

/**
 * @route   POST /api/campaigns/:id/stop
 * @desc    Stop campaign
 * @access  Private
 */
router.post('/:id/stop', stopCampaign);

export default router;