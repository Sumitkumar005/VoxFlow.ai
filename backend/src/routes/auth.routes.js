import express from 'express';
import { register, login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { 
  validateUserRegistration, 
  validateUserLogin,
  securityAuditLog
} from '../middleware/security.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user account
 * @access  Public
 */
router.post('/register', validateUserRegistration, securityAuditLog, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', validateUserLogin, securityAuditLog, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info with usage statistics
 * @access  Private
 */
router.get('/me', authenticate, me);

export default router;