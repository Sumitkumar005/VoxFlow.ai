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
import { 
  checkAgentOwnership, 
  logAdminAction 
} from '../middleware/rbac.middleware.js';
import { 
  validateAgentCreation,
  validateAgentUpdate,
  validateUUIDParam,
  validatePagination,
  securityAuditLog
} from '../middleware/security.middleware.js';

const router = express.Router();

// All agent routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/agents
 * @desc    Create new voice agent (with validation and limits check)
 * @access  Private
 */
router.post('/', validateAgentCreation, logAdminAction('create_agent'), securityAuditLog, createAgent);

/**
 * @route   GET /api/agents
 * @desc    Get all agents for current user (filtered by ownership)
 * @access  Private
 */
router.get('/', validatePagination, getAgents);

/**
 * @route   GET /api/agents/:id
 * @desc    Get single agent by ID (ownership protected)
 * @access  Private
 */
router.get('/:id', validateUUIDParam('id'), checkAgentOwnership, getAgentById);

/**
 * @route   PUT /api/agents/:id
 * @desc    Update agent (with validation and ownership protection)
 * @access  Private
 */
router.put('/:id', validateUUIDParam('id'), validateAgentUpdate, checkAgentOwnership, logAdminAction('update_agent'), securityAuditLog, updateAgent);

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete agent (ownership protected)
 * @access  Private
 */
router.delete('/:id', validateUUIDParam('id'), checkAgentOwnership, logAdminAction('delete_agent'), securityAuditLog, deleteAgent);

/**
 * @route   GET /api/agents/:id/runs
 * @desc    Get agent run history with filters (ownership protected)
 * @access  Private
 */
router.get('/:id/runs', validateUUIDParam('id'), checkAgentOwnership, getAgentRunHistory);

export default router;