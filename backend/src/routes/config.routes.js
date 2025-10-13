import express from 'express';
import {
  getServiceConfig,
  saveServiceConfig,
  getTelephonyConfig,
  saveTelephonyConfig,
} from '../controllers/config.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All config routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/config/service
 * @desc    Get service configuration (LLM, TTS, STT)
 * @access  Private
 */
router.get('/service', getServiceConfig);

/**
 * @route   POST /api/config/service
 * @desc    Save service configuration
 * @access  Private
 */
router.post('/service', saveServiceConfig);

/**
 * @route   GET /api/config/telephony
 * @desc    Get telephony configuration (Twilio)
 * @access  Private
 */
router.get('/telephony', getTelephonyConfig);

/**
 * @route   POST /api/config/telephony
 * @desc    Save telephony configuration
 * @access  Private
 */
router.post('/telephony', saveTelephonyConfig);

export default router;