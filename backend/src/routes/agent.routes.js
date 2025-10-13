import express from 'express';
import {
  createAgent,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  getAgentRunHistory,
} from '../controllers/agent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All agent routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/agents
 * @desc    Create new voice agent
 * @access  Private
 */
router.post('/', createAgent);

/**
 * @route   GET /api/agents
 * @desc    Get all agents for current user
 * @access  Private
 */
router.get('/', getAgents);

/**
 * @route   GET /api/agents/:id
 * @desc    Get single agent by ID
 * @access  Private
 */
router.get('/:id', getAgentById);

/**
 * @route   PUT /api/agents/:id
 * @desc    Update agent
 * @access  Private
 */
router.put('/:id', updateAgent);

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete agent
 * @access  Private
 */
router.delete('/:id', deleteAgent);

/**
 * @route   GET /api/agents/:id/runs
 * @desc    Get agent run history with filters
 * @access  Private
 */
router.get('/:id/runs', getAgentRunHistory);

export default router;