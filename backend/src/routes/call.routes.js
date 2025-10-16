import express from 'express';
import {
  startWebCall,
  processWebCallMessage,
  endWebCall,
  startPhoneCall,
  getRunById,
  getTranscript,
  handleTwilioWebhook,
  handleTwilioGather,
  handleTwilioStatus,
  handleTwilioRecording,
  fixStuckCall,
} from '../controllers/call.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All call routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/calls/web/start
 * @desc    Start a web call session
 * @access  Private
 */
router.post('/web/start', startWebCall);

/**
 * @route   POST /api/calls/web/message
 * @desc    Process a message in web call (AI turn)
 * @access  Private
 */
router.post('/web/message', processWebCallMessage);

/**
 * @route   POST /api/calls/web/end
 * @desc    End web call and generate transcript
 * @access  Private
 */
router.post('/web/end', endWebCall);

/**
 * @route   POST /api/calls/phone/start
 * @desc    Start a phone call via Twilio
 * @access  Private
 */
router.post('/phone/start', startPhoneCall);

/**
 * @route   GET /api/calls/run/:id
 * @desc    Get run details by ID
 * @access  Private
 */
router.get('/run/:id', getRunById);

/**
 * @route   GET /api/calls/transcript/:id
 * @desc    Get transcript for a run
 * @access  Private
 */
router.get('/transcript/:id', getTranscript);

/**
 * @route   POST /api/calls/fix/:runId
 * @desc    Manually fix stuck call status
 * @access  Private
 */
router.post('/fix/:runId', fixStuckCall);

// Public webhook routes (no authentication required)
const webhookRouter = express.Router();

/**
 * @route   POST /api/calls/twilio/webhook/:runId
 * @desc    Handle Twilio webhook for call initiation
 * @access  Public (Twilio webhook)
 */
webhookRouter.post('/twilio/webhook/:runId', handleTwilioWebhook);

/**
 * @route   POST /api/calls/twilio/webhook/:runId/gather
 * @desc    Handle speech input gathering from Twilio
 * @access  Public (Twilio webhook)
 */
webhookRouter.post('/twilio/webhook/:runId/gather', handleTwilioGather);

/**
 * @route   POST /api/calls/twilio/webhook/:runId/status
 * @desc    Handle call status updates from Twilio
 * @access  Public (Twilio webhook)
 */
webhookRouter.post('/twilio/webhook/:runId/status', handleTwilioStatus);

/**
 * @route   POST /api/calls/twilio/webhook/:runId/recording
 * @desc    Handle recording status updates from Twilio
 * @access  Public (Twilio webhook)
 */
webhookRouter.post('/twilio/webhook/:runId/recording', handleTwilioRecording);

// Export both routers
export { webhookRouter };

export default router;
