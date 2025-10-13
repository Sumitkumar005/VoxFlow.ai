# VoxFlow Backend - Complete Setup Guide

## 🎉 Backend is 100% Complete!

All routes, controllers, services, and utilities are implemented.

---

## 📁 Final File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js ✅
│   │   ├── agent.controller.js ✅
│   │   ├── call.controller.js ✅
│   │   ├── campaign.controller.js ✅
│   │   ├── config.controller.js ✅
│   │   ├── usage.controller.js ✅
│   │   └── report.controller.js ✅
│   ├── routes/
│   │   ├── auth.routes.js ✅
│   │   ├── agent.routes.js ✅
│   │   ├── call.routes.js ✅
│   │   ├── campaign.routes.js ✅
│   │   ├── config.routes.js ✅
│   │   ├── usage.routes.js ✅
│   │   └── report.routes.js ✅
│   ├── services/
│   │   ├── groq.service.js ✅
│   │   ├── deepgram.service.js ✅
│   │   ├── twilio.service.js ✅
│   │   └── campaign.service.js ✅
│   ├── middleware/
│   │   ├── auth.middleware.js ✅
│   │   ├── error.middleware.js ✅
│   │   └── upload.middleware.js ✅
│   ├── utils/
│   │   ├── supabase.js ✅
│   │   ├── jwt.js ✅
│   │   ├── token-calculator.js ✅
│   │   └── csv-parser.js ✅
│   ├── jobs/
│   │   ├── queue.js ✅
│   │   └── campaign.worker.js ✅
│   ├── app.js ✅
│   └── server.js ✅
├── uploads/
│   ├── csv/
│   └── recordings/
├── .env ✅
├── package.json ✅
└── docker-compose.yml ✅
```

---

## 🚀 Installation Steps

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Edit `.env` file with your credentials:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# JWT
JWT_SECRET=your-super-secret-key-here

# Groq
GROQ_API_KEY=your-groq-api-key

# Deepgram
DEEPGRAM_API_KEY=your-deepgram-api-key

# Twilio (Optional - users can configure their own)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Start Redis (Required for Campaigns)
```bash
docker-compose up -d
```

Verify Redis is running:
```bash
docker ps
```

### 4. Create Upload Directories
```bash
mkdir -p uploads/csv uploads/recordings
```

### 5. Start Backend Server
```bash
npm run dev
```

You should see:
```
╔════════════════════════════════════════╗
║  🎙️  VoxFlow API Server Running     ║
╠════════════════════════════════════════╣
║  Port: 5000                           ║
║  Environment: development             ║
║  URL: http://localhost:5000          ║
╚════════════════════════════════════════╝
```

### 6. Start Campaign Worker (In separate terminal)
```bash
npm run worker
```

You should see:
```
Campaign worker started and listening for jobs...
```

---

## 🧪 Testing the API

### 1. Test Server Health
```bash
curl http://localhost:5000
```

Response:
```json
{
  "success": true,
  "message": "VoxFlow API is running 🎙️",
  "version": "1.0.0"
}
```

### 2. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@voxflow.com",
    "password": "admin123"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "email": "admin@voxflow.com",
      "created_at": "2025-10-12T..."
    }
  }
}
```

### 3. Test Create Agent (Use token from login)
```bash
curl -X POST http://localhost:5000/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Sales Agent",
    "type": "OUTBOUND",
    "use_case": "Lead Qualification",
    "description": "You are a friendly sales agent calling to qualify leads."
  }'
```

---

## 📡 Available API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Agents
- `POST /api/agents` - Create agent
- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get agent by ID
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `GET /api/agents/:id/runs` - Get agent run history

### Calls
- `POST /api/calls/web/start` - Start web call
- `POST /api/calls/web/message` - Process web call message
- `POST /api/calls/web/end` - End web call
- `POST /api/calls/phone/start` - Start phone call
- `GET /api/calls/run/:id` - Get run details
- `GET /api/calls/transcript/:id` - Get transcript

### Campaigns
- `POST /api/campaigns` - Create campaign (with CSV upload)
- `GET /api/campaigns` - Get all campaigns
- `GET /api/campaigns/:id` - Get campaign by ID
- `POST /api/campaigns/:id/start` - Start campaign