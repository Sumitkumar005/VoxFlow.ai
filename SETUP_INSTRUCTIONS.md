# VoxFlow.ai Setup Instructions

## ✅ Completed Steps

1. ✅ Backend dependencies installed
2. ✅ Frontend dependencies installed
3. ✅ Environment files created
4. ✅ Upload directories created
5. ✅ Frontend server running on http://localhost:5173/

## 🔧 Required Configuration

### Backend Server Status
⚠️ Backend requires valid API credentials to start

### Environment Variables to Configure

Edit `VoxFlow.ai/backend/.env` with your actual credentials:

#### 1. Supabase (Required)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

Get these from:
- Go to https://supabase.com
- Create a new project (or use existing)
- Go to Settings > API
- Copy the Project URL and anon/public key

#### 2. Groq AI (Required for AI features)
```
GROQ_API_KEY=your-groq-api-key
```

Get from:
- Go to https://console.groq.com
- Sign up/login
- Create an API key

#### 3. Deepgram (Required for voice transcription)
```
DEEPGRAM_API_KEY=your-deepgram-api-key
```

Get from:
- Go to https://console.deepgram.com
- Sign up/login
- Create an API key

#### 4. Twilio (Optional - for phone calling features)
```
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

Get from:
- Go to https://www.twilio.com/console
- Sign up/login
- Copy Account SID and Auth Token

## 🚀 Running the Application

### Current Status:
- **Frontend**: ✅ Running on http://localhost:5173/
- **Backend**: ⚠️ Waiting for configuration

### After configuring .env file:

The backend will automatically restart (nodemon is watching for changes).

Or manually restart:
```bash
# Stop and restart backend
cd VoxFlow.ai/backend
npm run dev
```

## 📝 Optional: Redis for Campaign Queue

If you want to use campaign features, install Docker and run:
```bash
cd VoxFlow.ai
docker-compose up -d
```

Then start the campaign worker:
```bash
cd backend
npm run worker
```

## 🧪 Testing the Setup

Once backend starts successfully, test with:
```bash
curl http://localhost:5000
```

Expected response:
```json
{
  "success": true,
  "message": "VoxFlow API is running 🎙️",
  "version": "1.0.0"
}
```

## 📚 Next Steps

1. Configure your API keys in `.env` files
2. Wait for backend to start automatically
3. Open http://localhost:5173/ in your browser
4. Create an account or login
5. Start building voice agents!

## 🆘 Need Help?

- Check `VoxFlow.ai/backend/readme.md` for detailed API documentation
- Check `VoxFlow.ai/docs/` for user guides and troubleshooting
