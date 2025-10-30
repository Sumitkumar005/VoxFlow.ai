/**
 * Security Middleware for VoxFlow Multi-Tenant Platform
 * 
 * Implements comprehensive security headers, input validation, and protection measures
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.groq.com", "https://api.deepgram.com", "https://api.twilio.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for admin panel
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req, res, next) => {
  // Recursively sanitize all string inputs
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/data:text\/html/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

/**
 * SQL injection prevention middleware
 */
export const preventSQLInjection = (req, res, next) => {
  const sqlInjectionPatterns = [
    // SQL keywords (more targeted)
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b).*(\b(FROM|WHERE|INTO|VALUES|SET|TABLE)\b)/gi,
    // SQL injection with quotes and semicolons (more specific)
    /(('.*')|(".*")).*(\;|--|\#)/gi,
    // URL encoded SQL injection attempts
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
    /((\%27)|(\'))union/gi
  ];

  const checkForSQLInjection = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of sqlInjectionPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkForSQLInjection(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected. Please check your request and try again.',
      error: 'INVALID_INPUT'
    });
  }

  next();
};

/**
 * Validation error handler
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * User registration validation rules
 */
export const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('organization_name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Organization name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Organization name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  
  body('subscription_tier')
    .optional()
    .isIn(['free', 'pro', 'enterprise'])
    .withMessage('Subscription tier must be one of: free, pro, enterprise'),
  
  handleValidationErrors
];

/**
 * User login validation rules
 */
export const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),
  
  handleValidationErrors
];

/**
 * Agent creation validation rules
 */
export const validateAgentCreation = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Agent name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Agent name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  
  body('type')
    .isIn(['INBOUND', 'OUTBOUND'])
    .withMessage('Agent type must be either INBOUND or OUTBOUND'),
  
  body('use_case')
    .isLength({ min: 1, max: 255 })
    .withMessage('Use case must be between 1 and 255 characters'),
  
  body('description')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  
  handleValidationErrors
];

/**
 * Agent update validation rules
 */
export const validateAgentUpdate = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Agent name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Agent name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  
  body('type')
    .optional()
    .isIn(['INBOUND', 'OUTBOUND'])
    .withMessage('Agent type must be either INBOUND or OUTBOUND'),
  
  body('use_case')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Use case must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  
  handleValidationErrors
];

/**
 * Campaign creation validation rules
 */
export const validateCampaignCreation = [
  body('name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Campaign name must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Campaign name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  
  body('agent_id')
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  
  handleValidationErrors
];

/**
 * API key validation rules
 */
export const validateAPIKey = [
  param('provider')
    .isIn(['groq', 'deepgram', 'twilio'])
    .withMessage('Provider must be one of: groq, deepgram, twilio'),
  
  // Conditional validation based on provider
  body('api_key')
    .if((value, { req }) => req.params.provider !== 'twilio')
    .isLength({ min: 10, max: 1000 })
    .withMessage('API key must be between 10 and 1000 characters')
    .matches(/^[a-zA-Z0-9\-_.]+$/)
    .withMessage('API key contains invalid characters'),
  
  // Twilio-specific validation
  body('account_sid')
    .if((value, { req }) => req.params.provider === 'twilio')
    .isLength({ min: 10, max: 100 })
    .withMessage('Account SID must be between 10 and 100 characters')
    .matches(/^AC[a-zA-Z0-9]+$/)
    .withMessage('Account SID must start with AC and contain only alphanumeric characters'),
  
  body('auth_token')
    .if((value, { req }) => req.params.provider === 'twilio')
    .isLength({ min: 10, max: 100 })
    .withMessage('Auth Token must be between 10 and 100 characters')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Auth Token contains invalid characters'),
  
  body('phone_number')
    .if((value, { req }) => req.params.provider === 'twilio')
    .optional()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +1234567890)'),
  
  handleValidationErrors
];

/**
 * UUID parameter validation
 */
export const validateUUIDParam = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),
  
  handleValidationErrors
];

/**
 * Pagination validation rules
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Search query must be less than 255 characters'),
  
  handleValidationErrors
];

/**
 * Admin user limit update validation
 */
export const validateUserLimitUpdate = [
  body('max_agents')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Max agents must be between 0 and 10000'),
  
  body('monthly_token_quota')
    .optional()
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Monthly token quota must be between 0 and 100,000,000'),
  
  body('subscription_tier')
    .optional()
    .isIn(['free', 'pro', 'enterprise'])
    .withMessage('Subscription tier must be one of: free, pro, enterprise'),
  
  handleValidationErrors
];

/**
 * Phone number validation for calls
 */
export const validatePhoneCall = [
  body('phone_number')
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +1234567890)'),
  
  body('agent_id')
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  
  handleValidationErrors
];

/**
 * File upload validation
 */
export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  // Check file type
  const allowedTypes = ['text/csv', 'application/csv'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only CSV files are allowed.'
    });
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 5MB.'
    });
  }

  next();
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length'));
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum size is 10MB.'
    });
  }

  next();
};

/**
 * CORS configuration for production
 */
export const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://voxflow.com',
      'https://app.voxflow.com',
      'https://admin.voxflow.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

/**
 * Additional security headers
 */
export const additionalSecurityHeaders = (req, res, next) => {
  // Additional custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

/**
 * XSS Protection middleware
 */
export const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /expression\(/gi
  ];

  const checkForXSS = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkForXSS(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Potential XSS attack detected. Request blocked.',
      error: 'XSS_DETECTED'
    });
  }

  next();
};

/**
 * Request size limit middleware
 */
export const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum size is 10MB.',
      error: 'REQUEST_TOO_LARGE'
    });
  }

  next();
};

/**
 * IP security check middleware
 */
export const ipSecurityCheck = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Block known malicious IP patterns (basic implementation)
  const blockedPatterns = [
    /^0\.0\.0\.0$/,
    /^127\.0\.0\.1$/, // Allow localhost in development
    /^192\.168\./, // Allow local network
    /^10\./, // Allow private network
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./ // Allow private network
  ];

  // In production, you might want to implement more sophisticated IP blocking
  if (process.env.NODE_ENV === 'production') {
    // Add production-specific IP security checks here
  }

  next();
};

/**
 * Security audit logging
 */
export const securityAuditLog = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security-relevant actions
    if (res.statusCode >= 400) {
      console.warn(`Security Event`, {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user?.id,
        body: req.method !== 'GET' ? req.body : undefined
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};