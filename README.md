# 🎙️ VoxFlow.ai

An open-source AI-powered voice calling platform for automated customer interactions. Build, deploy, and manage AI voice agents that can make and receive phone calls at scale.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

## ✨ Features

- 🤖 **AI Voice Agents** - Create custom AI agents with specific personalities and use cases
- 📞 **Web & Phone Calls** - Test in browser or make real phone calls via Twilio
- 📊 **Campaign Management** - Bulk calling with CSV upload and progress tracking
- 🎯 **Real-time Monitoring** - Live call status and transcription
- 📈 **Analytics & Reports** - Detailed call history, usage tracking, and cost analysis
- 🔐 **Multi-tenant Support** - User accounts with subscription tiers and usage limits
- 🔑 **API Key Management** - Secure encrypted storage of user API keys
- 🌐 **WebRTC Integration** - Browser-based voice calling for testing

## 🏗️ Tech Stack

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Socket.io Client
- WebRTC

**Backend:**
- Node.js + Express
- Bull (Redis queue for campaigns)
- JWT Authentication
- Multer (file uploads)

**Database:**
- Supabase (PostgreSQL)

**AI Services:**
- **Groq** - Fast LLM inference (Llama 3.3 70B)
- **Deepgram** - Speech-to-text & text-to-speech
- **Twilio** - Phone calling infrastructure

## 🚀 Deployment Models

VoxFlow.ai supports **two deployment models**:

### 1. 🏠 Self-Hosted (Open Source)
- Clone and run on your own server
- Use your own API keys in `.env`
- Full control and customization
- [Setup Guide](#quick-start)

### 2. ☁️ SaaS Platform (Hosted Service)
- Deploy once, serve many users
- Users add their own API keys via UI
- No API costs for you
- [SaaS Deployment Guide](SAAS_DEPLOYMENT.md)

---

## 🚀 Quick Start (Self-Hosted)

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- Supabase account (free tier works)
- API keys for: Groq, Deepgram, Twilio

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Sumitkumar005/VoxFlow.ai.git
cd VoxFlow.ai
```

2. **Set up the database**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run all migrations from `supabase/migrations/` folder
   - Or run the combined file: `supabase/ALL_MIGRATIONS_COMBINED.sql`
   - Get your Project URL and anon key from Settings > API

3. **Configure Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see below)
```

4. **Configure Frontend**
```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env with backend URL
```

5. **Generate Security Keys**
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate MASTER_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

6. **Start the servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

7. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - Default admin login: `admin@voxflow.com` / `admin123`

## 🔑 Getting API Keys

### Supabase (Required)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Settings > API > Copy URL and anon key

### Groq (Required for AI)
1. Go to [console.groq.com](https://console.groq.com)
2. Create API key
3. Free tier: 30 requests/minute

### Deepgram (Required for Voice)
1. Go to [console.deepgram.com](https://console.deepgram.com)
2. Create API key
3. Free tier: $200 credit

### Twilio (Optional - for phone calls)
1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Get Account SID and Auth Token
3. Buy a phone number ($1-2/month)

## 📁 Project Structure

```
VoxFlow.ai/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, etc.
│   │   ├── utils/          # Helper functions
│   │   └── jobs/           # Campaign workers
│   ├── uploads/            # CSV and recordings
│   └── .env.example        # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── context/        # State management
│   │   └── utils/          # Helper functions
│   └── .env.example        # Environment template
├── supabase/
│   └── migrations/         # Database schema
└── docs/                   # Documentation
```

## 🎯 Use Cases

- **Sales Outreach** - AI calls leads and qualifies them
- **Customer Support** - Handle common questions automatically
- **Appointment Reminders** - Confirm bookings via phone
- **Surveys** - Conduct phone surveys at scale
- **Lead Qualification** - Screen leads before sales team
- **Event Invitations** - Call attendees to invite them

## 💼 SaaS Model (Bring Your Own Keys)

VoxFlow.ai is designed for **multi-tenant SaaS deployment**:

### How It Works:
1. **You deploy once** - Host the platform on your server
2. **Users sign up** - Free accounts with limitations
3. **Users add API keys** - Each user brings their own:
   - Groq API key (AI conversations)
   - Deepgram API key (voice processing)
   - Twilio credentials (phone calls)
4. **Zero API costs for you** - Users pay their own providers
5. **Monetize with tiers** - Free, Pro, Enterprise plans

### Built-in Features:
✅ **User API Key Management** - Secure encrypted storage  
✅ **Per-user isolation** - Each user's keys separate  
✅ **Usage tracking** - Monitor tokens and costs per user  
✅ **Subscription tiers** - Free (2 agents), Pro (10 agents), Enterprise (unlimited)  
✅ **Admin dashboard** - Manage users and monitor platform  

### For SaaS Deployment:
See [SaaS Deployment Guide](SAAS_DEPLOYMENT.md) for complete instructions.

## 📖 Documentation

- [Database Setup Guide](VoxFlow.ai/DATABASE_SETUP_GUIDE.md)
- [Backend API Documentation](VoxFlow.ai/backend/readme.md)
- [User Guide](VoxFlow.ai/docs/user-guide.md)
- [Admin Manual](VoxFlow.ai/docs/admin-manual.md)
- [Troubleshooting](VoxFlow.ai/docs/troubleshooting-guide.md)

## Project Structure

```
VoxFlow.ai/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── uploads/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── utils/
│   └── package.json
├── supabase/
│   └── migrations/
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation if needed

## 🐛 Bug Reports & Feature Requests

- Use [GitHub Issues](https://github.com/Sumitkumar005/VoxFlow.ai/issues)
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs
- Explain use cases for feature requests

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Groq](https://groq.com) - Fast LLM inference
- [Deepgram](https://deepgram.com) - Voice AI
- [Twilio](https://twilio.com) - Telephony infrastructure
- [Supabase](https://supabase.com) - Backend as a service

## 💬 Community & Support

- **GitHub Issues** - Bug reports and feature requests
- **Discussions** - Questions and community chat
- **Twitter** - [@YourTwitterHandle](https://twitter.com/yourhandle)

## 🚧 Roadmap

- [ ] ElevenLabs integration for better voice quality
- [ ] Support for multiple languages
- [ ] Advanced analytics dashboard
- [ ] Webhook integrations (Zapier, Make.com)
- [ ] Voice cloning for custom agent voices
- [ ] Call recording playback in UI
- [ ] A/B testing for agent prompts
- [ ] CRM integrations (Salesforce, HubSpot)

## ⚠️ Important Notes

- **Security**: Never commit `.env` files with real credentials
- **Costs**: Be aware of API usage costs (Groq, Deepgram, Twilio)
- **Rate Limits**: Free tiers have usage limits
- **Production**: Use proper encryption keys in production
- **Phone Numbers**: Verify phone numbers comply with local regulations

## 📊 Stats

- **Backend**: 100% complete
- **Frontend**: 100% complete
- **Database**: Multi-tenant ready
- **Documentation**: Comprehensive guides included

---

**Made with ❤️ by the VoxFlow community**

⭐ Star this repo if you find it useful!
