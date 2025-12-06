import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler, notFound } from './src/middleware/error.middleware.js';

// Import security middleware
import {
  securityHeaders,
  additionalSecurityHeaders,
  sanitizeInput,
  preventSQLInjection,
  xssProtection,
  requestSizeLimit,
  ipSecurityCheck,
  securityAuditLog
} from './src/middleware/security.middleware.js';

// Import monitoring middleware
import {
  requestMonitoring,
  errorMonitoring,
  healthMonitoring,
  securityMonitoring,
  usageMonitoring,
  metricsCollection
} from './src/middleware/monitoring.middleware.js';

// Import rate limiting middleware (temporarily disabled for development)
// import { 
//   apiRateLimiter, 
//   authRateLimiter, 
//   agentOperationsRateLimiter,
//   campaignOperationsRateLimiter,
//   uploadRateLimiter
// } from './src/middleware/rateLimiting.middleware.js';

// Import routes (we'll create these next)
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import campaignRoutes from './src/routes/campaign.routes.js';
import callRoutes, { webhookRouter } from './src/routes/call.routes.js';
import configRoutes from './src/routes/config.routes.js';
import usageRoutes from './src/routes/usage.routes.js';
import reportRoutes from './src/routes/report.routes.js';
import apiKeysRoutes from './src/routes/api-keys.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import rateLimitRoutes from './src/routes/rateLimit.routes.js';
import performanceRoutes from './src/routes/performance.routes.js';
import monitoringRoutes from './src/routes/monitoring.routes.js';
import healthRoutes from './src/routes/health.routes.js';

dotenv.config();

const app = express();

// =====================================================
// SECURITY MIDDLEWARE (Applied First)
// =====================================================
app.use(securityHeaders);
app.use(additionalSecurityHeaders);
app.use(requestSizeLimit);
app.use(ipSecurityCheck);
app.use(securityAuditLog);

// =====================================================
// MONITORING MIDDLEWARE
// =====================================================
app.use(requestMonitoring);
app.use(securityMonitoring);
app.use(metricsCollection);
app.use(usageMonitoring);

// =====================================================
// CORS AND PARSING MIDDLEWARE
// =====================================================
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://vox-flow-ai.vercel.app',
    'https://vox-flow-ai-6icv.vercel.app'
  ],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// =====================================================
// INPUT SANITIZATION AND VALIDATION
// =====================================================
app.use(sanitizeInput);
app.use(preventSQLInjection);
app.use(xssProtection);

// Static files (for uploads)
app.use('/uploads', express.static('uploads'));

// Middleware to handle Twilio webhooks (bypass auth issues)
app.use('/api/calls/twilio/webhook', (req, res, next) => {
  // Set headers to bypass ngrok warning
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// =====================================================
// ROUTES
// =====================================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'VoxFlow API is running 🎙️',
    version: '1.0.0',
  });
});

// API Routes (rate limiting temporarily disabled for development)
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/calls', webhookRouter); // Public webhook routes (no auth, no rate limiting)
app.use('/api/config', configRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/admin', adminRoutes); // Admin routes have bypass logic in middleware
app.use('/api/rate-limits', rateLimitRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check routes (public, no rate limiting for monitoring tools)
app.use('/health', healthRoutes);

// =====================================================
// ERROR HANDLING
// =====================================================
app.use(notFound);
app.use(errorMonitoring); // Custom error monitoring before general error handler
app.use(errorHandler);

export default app;