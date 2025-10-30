import bcrypt from 'bcryptjs';
import { query } from '../utils/supabase.js';
import { generateToken } from '../utils/jwt.js';
import { body, validationResult } from 'express-validator';

/**
 * User registration controller
 * Creates new user account with role-based permissions
 */
export const register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password, organization_name, subscription_tier = 'free' } = req.body;

    // Check if user already exists
    const { data: existingUsers } = await query('users', 'select', {
      filter: { email },
      columns: 'id',
    });

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Set user limits based on subscription tier
    const tierLimits = {
      free: { max_agents: 2, monthly_token_quota: 1000 },
      pro: { max_agents: 10, monthly_token_quota: 50000 },
      enterprise: { max_agents: 100, monthly_token_quota: 1000000 },
    };

    const limits = tierLimits[subscription_tier] || tierLimits.free;

    // Create new user
    const { data: newUser } = await query('users', 'insert', {
      data: {
        email,
        password_hash,
        role: 'user', // Default role for new registrations
        subscription_tier,
        organization_name,
        max_agents: limits.max_agents,
        monthly_token_quota: limits.monthly_token_quota,
        is_active: true,
      },
    });

    if (!newUser || newUser.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account',
      });
    }

    const user = newUser[0];

    // Generate JWT token with enhanced payload
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_tier: user.subscription_tier,
      max_agents: user.max_agents,
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          subscription_tier: user.subscription_tier,
          organization_name: user.organization_name,
          max_agents: user.max_agents,
          monthly_token_quota: user.monthly_token_quota,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enhanced login controller
 * Supports multi-tenant authentication with role-based tokens
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email with all necessary fields
    const { data: users } = await query('users', 'select', {
      filter: { email },
      columns: 'id, email, password_hash, role, subscription_tier, organization_name, max_agents, monthly_token_quota, is_active, last_login',
    });

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Check if user account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login timestamp
    await query('users', 'update', {
      filter: { id: user.id },
      data: { last_login: new Date().toISOString() },
    });

    // Generate JWT token with enhanced payload
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_tier: user.subscription_tier,
      max_agents: user.max_agents,
    });

    // Return success with enhanced user data
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          subscription_tier: user.subscription_tier,
          organization_name: user.organization_name,
          max_agents: user.max_agents,
          monthly_token_quota: user.monthly_token_quota,
          last_login: user.last_login,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user info with enhanced multi-tenant data
 */
export const me = async (req, res, next) => {
  try {
    const { data: users } = await query('users', 'select', {
      filter: { id: req.user.id },
      columns: 'id, email, role, subscription_tier, organization_name, max_agents, monthly_token_quota, is_active, last_login, created_at',
    });

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = users[0];

    // Get current usage statistics
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const { data: usage } = await query('user_usage_tracking', 'select', {
      filter: {
        user_id: user.id,
        date: `gte.${currentMonth}-01`,
      },
      columns: 'total_tokens, total_calls, total_duration_seconds, api_costs',
    });

    // Calculate current month totals
    const currentUsage = usage?.reduce((acc, day) => ({
      total_tokens: acc.total_tokens + (parseFloat(day.total_tokens) || 0),
      total_calls: acc.total_calls + (day.total_calls || 0),
      total_duration_seconds: acc.total_duration_seconds + (day.total_duration_seconds || 0),
      api_costs: acc.api_costs + (parseFloat(day.api_costs) || 0),
    }), { total_tokens: 0, total_calls: 0, total_duration_seconds: 0, api_costs: 0 }) ||
      { total_tokens: 0, total_calls: 0, total_duration_seconds: 0, api_costs: 0 };

    // Get agent count
    const { data: agents } = await query('agents', 'select', {
      filter: { user_id: user.id },
      columns: 'id',
    });

    const agentCount = agents?.length || 0;

    res.json({
      success: true,
      data: {
        ...user,
        current_usage: {
          ...currentUsage,
          agent_count: agentCount,
          tokens_remaining: user.monthly_token_quota - currentUsage.total_tokens,
          agents_remaining: user.max_agents - agentCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validation rules for user registration
 */
export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('organization_name')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Organization name must be between 2 and 255 characters'),
  body('subscription_tier')
    .optional()
    .isIn(['free', 'pro', 'enterprise'])
    .withMessage('Invalid subscription tier'),
];