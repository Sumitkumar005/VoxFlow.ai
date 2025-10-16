import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler, notFound } from './src/middleware/error.middleware.js';

// Import routes (we'll create these next)
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import campaignRoutes from './src/routes/campaign.routes.js';
import callRoutes, { webhookRouter } from './src/routes/call.routes.js';
import configRoutes from './src/routes/config.routes.js';
import usageRoutes from './src/routes/usage.routes.js';
import reportRoutes from './src/routes/report.routes.js';

dotenv.config();

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/calls', webhookRouter); // Public webhook routes (no auth)
app.use('/api/config', configRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/reports', reportRoutes);

// =====================================================
// ERROR HANDLING
// =====================================================
app.use(notFound);
app.use(errorHandler);

export default app;