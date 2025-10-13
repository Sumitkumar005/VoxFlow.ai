# 🧪 VoxFlow Backend - Complete Testing Guide

## ✅ ALL FILES CREATED - FINAL CHECKLIST

### Missing Files Now Added:
- ✅ `src/services/webrtc.service.js` - WebRTC call sessions
- ✅ `src/services/recording.service.js` - Recording generation
- ✅ `src/services/ai.service.js` - AI orchestrator

### Total Files: **29 Complete Files** 🎉

---

## 📋 Pre-Testing Setup

### 1. Verify All Files Are Created

```bash
cd backend

# Check directory structure
tree src

# Should see:
# src/
# ├── controllers/ (7 files)
# ├── routes/ (7 files)
# ├── services/ (7 files) ← Now complete with webrtc, recording, ai
# ├── middleware/ (3 files)
# ├── utils/ (4 files)
# ├── jobs/ (2 files)
# ├── app.js
# └── server.js
```

### 2. Install All Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create `.env` file:
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# JWT
JWT_SECRET=voxflow_super_secret_key_2025

# Groq
GROQ_API_KEY=gsk_your_groq_api_key

# Deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key

# Twilio (Optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server URL (for webhooks)
SERVER_URL=http://localhost:5000
```

### 4. Start Redis

```bash
docker-compose up -d

# Verify Redis is running
docker ps
```

### 5. Create Upload Directories

```bash
mkdir -p uploads/csv uploads/recordings
```

---

## 🚀 Start Backend Services

### Terminal 1: Start Backend Server
```bash
npm run dev
```

Expected output:
```
╔════════════════════════════════════════╗
║  🎙️  VoxFlow API Server Running     ║
╠════════════════════════════════════════╣
║  Port: 5000                           ║
║  Environment: development             ║
║  URL: http://localhost:5000          ║
╚════════════════════════════════════════╝
```

### Terminal 2: Start Campaign Worker
```bash
npm run worker
```

Expected output:
```
Campaign worker started and listening for jobs...
```

---

## 🧪 Testing Methods

### Option 1: Using cURL (Quick Tests)

#### 1. Test Server Health
```bash
curl http://localhost:5000
```

Expected:
```json
{
  "success": true,
  "message": "VoxFlow API is running 🎙️",
  "version": "1.0.0"
}
```

#### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voxflow.com","password":"admin123"}'
```

Save the token from response!

#### 3. Create Agent
```bash
curl -X POST http://localhost:5000/api/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Sales Agent",
    "type": "OUTBOUND",
    "use_case": "Lead Qualification",
    "description": "You are a friendly sales agent."
  }'
```

---

### Option 2: Using Postman/Insomnia

#### Import Postman Collection

1. Open Postman
2. Click **Import**
3. Copy the JSON from the "VoxFlow API - Postman Collection" artifact above
4. Paste and import

#### Testing Flow:

1. **Login** (saves token automatically)
2. **Create Agent** (saves agent_id automatically)
3. **Start Web Call** (saves run_id automatically)
4. **Process Message** (test AI conversation)
5. **End Web Call** (get transcript & recording)
6. **View Run Details**

---

## 📝 Sample Test CSV for Campaigns

Create `contacts.csv`:

```csv
phone_number,first_name,last_name
+15551234567,John,Doe
+15559876543,Jane,Smith
+15555555555,Bob,Johnson
```

Upload this via Postman in **Create Campaign** request.

---

## 🌐 Do You Need ngrok?

### ✅ **YES, you need ngrok** for:

1. **Phone Calls (Twilio Webhooks)**
   - Twilio needs to send call status to your server
   - Requires public URL for webhooks

2. **Campaign Phone Calls**
   - Same reason - Twilio webhooks

### ❌ **NO ngrok needed** for:

1. **Web Calls** (browser-based)
2. **Agent Management**
3. **Usage & Reports**
4. **Configuration**
5. **Testing all API endpoints**

---

## 🔗 ngrok Setup (For Phone Calls Only)

### 1. Install ngrok
```bash
# Mac
brew install ngrok

# Or download from https://ngrok.com/download
```

### 2. Start ngrok
```bash
ngrok http 5000
```

Output:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5000
```

### 3. Update .env
```bash
SERVER_URL=https://abc123.ngrok.io
```

### 4. Restart Backend
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 5. Configure Twilio Webhook

In Twilio Console:
- Voice Configuration → Webhook URL:
  - `https://abc123.ngrok.io/api/calls/twilio/webhook/{run_id}`

---

## 🧪 Complete Testing Sequence

### Phase 1: Basic API Tests (No ngrok needed)

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voxflow.com","password":"admin123"}'

# Save token as: TOKEN=eyJhbGc...

# 2. Get current user
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Create agent
curl -X POST http://localhost:5000/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Agent",
    "type":"OUTBOUND",
    "use_case":"Testing",
    "description":"You are a test agent"
  }'

# Save agent_id as: AGENT_ID=uuid...

# 4. Get all agents
curl http://localhost:5000/api/agents \
  -H "Authorization: Bearer $TOKEN"

# 5. Start web call
curl -X POST http://localhost:5000/api/calls/web/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"'$AGENT_ID'"}'

# Save run_id as: RUN_ID=uuid...

# 6. Process message
curl -X POST http://localhost:5000/api/calls/web/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "run_id":"'$RUN_ID'",
    "message":"Hi, I am interested in your product",
    "conversation_history":[]
  }'

# 7. End web call
curl -X POST http://localhost:5000/api/calls/web/end \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "run_id":"'$RUN_ID'",
    "conversation_history":[
      {"role":"user","content":"Hi"},
      {"role":"assistant","content":"Hello!"}
    ],
    "duration_seconds":30,
    "disposition":"user_hangup"
  }'

# 8. Get usage dashboard
curl http://localhost:5000/api/usage/dashboard \
  -H "Authorization: Bearer $TOKEN"

# 9. Get daily reports
curl http://localhost:5000/api/reports/daily \
  -H "Authorization: Bearer $TOKEN"
```

### Phase 2: Configuration Tests

```bash
# Save service config
curl -X POST http://localhost:5000/api/config/service \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "llm_provider":"groq",
    "llm_model":"llama-3.3-70b-versatile",
    "tts_provider":"deepgram",
    "tts_voice":"aura-2-helena-en"
  }'

# Get service config
curl http://localhost:5000/api/config/service \
  -H "Authorization: Bearer $TOKEN"
```

### Phase 3: Campaign Tests

```bash
# Create contacts.csv first (see sample above)

# Upload campaign (use Postman for file upload)
# Or use this curl:
curl -X POST http://localhost:5000/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Campaign" \
  -F "agent_id=$AGENT_ID" \
  -F "file=@contacts.csv"

# Save campaign_id as: CAMPAIGN_ID=uuid...

# Get campaign details
curl http://localhost:5000/api/campaigns/$CAMPAIGN_ID \
  -H "Authorization: Bearer $TOKEN"

# Start campaign (requires Twilio config + ngrok)
curl -X POST http://localhost:5000/api/campaigns/$CAMPAIGN_ID/start \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ Expected Results

### Successful Login:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@voxflow.com"
    }
  }
}
```

### Successful Agent Creation:
```json
{
  "success": true,
  "message": "Voice Agent Created Successfully!",
  "data": {
    "id": "uuid",
    "name": "Sales Agent",
    "type": "OUTBOUND",
    "use_case": "Lead Qualification",
    "total_runs": 0
  }
}
```

### Successful Web Call Message:
```json
{
  "success": true,
  "data": {
    "message": "I'd be happy to help you learn about our product...",
    "timestamp": "2025-10-12T10:30:00.000Z"
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue: "Missing Supabase credentials"
```bash
# Check .env file
cat .env | grep SUPABASE

# Should show:
# SUPABASE_URL=https://...
# SUPABASE_KEY=eyJ...
```

### Issue: "ECONNREFUSED Redis"
```bash
# Check Redis is running
docker ps

# If not running:
docker-compose up -d
```

### Issue: "Invalid or expired token"
```bash
# Login again to get fresh token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voxflow.com","password":"admin123"}'
```

### Issue: "Agent not found"
```bash
# List all agents to get correct ID
curl http://localhost:5000/api/agents \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: "Campaign not processing"
```bash
# Check worker is running
# Terminal 2 should show: "Campaign worker started..."

# Check Redis queue
docker exec -it voxflow-redis redis-cli
> KEYS *
> LLEN bull:campaign-calls:wait
```

---

## 📊 Testing Checklist

- [ ] Server starts successfully
- [ ] Redis is running
- [ ] Login works
- [ ] Create agent works
- [ ] Web call start works
- [ ] AI message processing works (requires Groq API key)
- [ ] Web call end works
- [ ] Usage dashboard shows data
- [ ] Reports generate correctly
- [ ] Service config saves
- [ ] Campaign creates (with CSV upload)
- [ ] Phone call works (requires Twilio + ngrok)

---

## 🎯 Summary

### Without ngrok (Local Testing):
✅ All API endpoints work
✅ Web calls work
✅ AI conversations work
✅ Usage & reports work
✅ Configuration works
✅ Campaign creation works

### With ngrok (Full Phone Calling):
✅ Everything above +
✅ Phone calls via Twilio
✅ Campaign bulk calling
✅ Call recordings from Twilio
✅ Real phone number dialing

---

## 🚀 Next Steps After Testing

1. ✅ **Backend tested** → Move to Frontend
2. ✅ **All working** → Deploy to production
3. ✅ **Issues found** → Debug and fix

**Ready to start frontend development?** 🎨