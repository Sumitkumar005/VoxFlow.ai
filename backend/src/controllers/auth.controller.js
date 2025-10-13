import bcrypt from 'bcryptjs';
import { query } from '../utils/supabase.js';
import { generateToken } from '../utils/jwt.js';

/**
 * Login controller
 * Hardcoded credentials: admin@voxflow.com / admin123
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

    // Find user by email
    const { data: users } = await query('users', 'select', {
      filter: { email },
    });

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
    });

    // Return success with token
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user info
 */
export const me = async (req, res, next) => {
  try {
    const { data: users } = await query('users', 'select', {
      filter: { id: req.user.id },
      columns: 'id, email, created_at',
    });

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    next(error);
  }
};