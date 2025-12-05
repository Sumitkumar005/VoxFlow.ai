# 🚀 SaaS Deployment Guide

This guide explains how to deploy VoxFlow.ai as a **hosted SaaS platform** where users bring their own API keys.

## 🎯 SaaS Model Overview

### How It Works:

1. **You host one instance** of VoxFlow.ai
2. **Users sign up** for free accounts
3. **Users add their own API keys** (Groq, Deepgram, Twilio)
4. **Each user's calls** use their own credentials
5. **You don't pay** for their API usage
6. **Users control** their own costs and limits

### Benefits:

✅ **No API costs for you** - Users pay their own providers  
✅ **Scalable** - No limit on users  
✅ **Privacy** - Users control their data  
✅ **Flexible** - Users choose their own providers  
✅ **Transparent** - Users see their own usage/costs  

## 📋 Prerequisites

- Server with Node.js 18+ (VPS, AWS, Railway, Render, etc.)
- Domain name (optional but recommended)
- Supabase account (free tier works)
- SSL certificate (Let's Encrypt is free)

## 🔧 Configuration

### 1. Environment Variables

Your `.env` should contain **ONLY infrastructure keys**:

```env
# Server Configuration
PORT=5000
NODE_ENV=production
SERVER_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
APP_VERSION=1.0.0

# Supabase Configuration (YOUR database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# JWT Configuration (Generate secure keys)
JWT_SECRET=<generate-with-crypto>
JWT_EXPIRES_IN=7d

# Encryption Key (Generate secure key)
MASTER_ENCRYPTION_KEY=<generate-with-crypto>

# API Keys - LEAVE EMPTY for SaaS
GROQ_API_KEY=
DEEPGRAM_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Redis Configuration (for campaigns)
REDIS_HOST=localhost
REDIS_PORT=6379

# Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
```

### 2. Generate Secure Keys

```bash
# JWT Secret (512-bit)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Setup

1. Create Supabase project
2. Run all migrations from `supabase/migrations/`
3. Update subscription tiers in `users` table if needed

## 🎨 User Flow

### New User Registration:

1. User signs up → Gets free account
2. User goes to **Settings → API Keys**
3. User adds their own:
   - Groq API key (for AI)
   - Deepgram API key (for voice)
   - Twilio credentials (for phone calls)
4. System validates and encrypts keys
5. User can now create agents and make calls

### How Keys Are Used:

```
User makes call
    ↓
Backend checks: Does user have API keys?
    ↓
YES → Use user's keys (encrypted in DB)
    ↓
NO → Show error: "Please add API keys in Settings"
```

## 🔒 Security Features

### Already Implemented:

✅ **Encryption** - API keys encrypted with AES-256-GCM  
✅ **Per-user storage** - Each user's keys isolated  
✅ **JWT auth** - Secure authentication  
✅ **Rate limiting** - Prevent abuse  
✅ **Input validation** - Prevent injection attacks  
✅ **Audit logs** - Track all actions  

### API Key Storage:

- Keys stored in `user_api_keys` table
- Encrypted before storage
- Decrypted only when needed
- Never logged or exposed

## 📊 Subscription Tiers

Configure in database (`users` table):

### Free Tier (Default):
```sql
max_agents: 2
monthly_token_quota: 1000
subscription_tier: 'free'
```

### Pro Tier:
```sql
max_agents: 10
monthly_token_quota: 10000
subscription_tier: 'pro'
```

### Enterprise Tier:
```sql
max_agents: 100
monthly_token_quota: 100000
subscription_tier: 'enterprise'
```

## 🚀 Deployment Options

### Option 1: Railway (Easiest)

1. Connect GitHub repo
2. Add environment variables
3. Deploy backend + frontend
4. Add Redis service
5. Done!

### Option 2: Render

1. Create Web Service (backend)
2. Create Static Site (frontend)
3. Add Redis instance
4. Configure environment variables

### Option 3: AWS/DigitalOcean

1. Set up Ubuntu server
2. Install Node.js, Redis, Nginx
3. Clone repo and configure
4. Set up PM2 for process management
5. Configure SSL with Let's Encrypt

### Option 4: Docker

```bash
# Use the provided docker-compose.yml
docker-compose up -d
```

## 💰 Monetization Options

### Free + Paid Tiers:

- **Free**: 2 agents, 1000 tokens/month
- **Pro ($29/mo)**: 10 agents, 10K tokens/month
- **Enterprise ($299/mo)**: Unlimited

### Add-ons:

- Extra agents: $5/agent/month
- Extra tokens: $10/10K tokens
- Priority support: $50/month
- White-label: $500/month

### Implementation:

Integrate Stripe:
```javascript
// Already has subscription table
// Add Stripe webhook handlers
// Update subscription_tier on payment
```

## 📈 Monitoring

### Track:

- Active users
- API key usage per user
- Call volume
- Error rates
- Costs (if you provide fallback keys)

### Tools:

- Supabase Dashboard (database metrics)
- Built-in monitoring routes (`/api/monitoring`)
- External: Sentry, LogRocket, etc.

## 🎯 User Onboarding

### Welcome Flow:

1. **Sign up** → Email verification
2. **Welcome page** → "Add your API keys to get started"
3. **API Keys page** → Step-by-step guide:
   - Get Groq key (link + instructions)
   - Get Deepgram key (link + instructions)
   - Get Twilio credentials (link + instructions)
4. **Test connection** → Validate keys work
5. **Create first agent** → Guided tutorial
6. **Make test call** → Success!

### Help Resources:

- Video tutorials
- Documentation links
- Live chat support
- Community forum

## 🔄 Updates & Maintenance

### Zero-Downtime Deployment:

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Restart with PM2
pm2 reload all
```

### Database Migrations:

```bash
# Run new migrations
psql -h db.supabase.co -U postgres -d postgres -f new_migration.sql
```

## ⚠️ Important Notes

### DO:
✅ Keep infrastructure keys secure  
✅ Monitor for abuse  
✅ Set up backups  
✅ Use HTTPS everywhere  
✅ Rate limit API endpoints  
✅ Log errors and monitor  

### DON'T:
❌ Share your MASTER_ENCRYPTION_KEY  
❌ Commit .env files  
❌ Use weak JWT secrets  
❌ Skip SSL in production  
❌ Ignore security updates  

## 🆘 Troubleshooting

### Users can't add API keys:
- Check MASTER_ENCRYPTION_KEY is set
- Verify database connection
- Check user_api_keys table exists

### Calls failing:
- Verify user has added API keys
- Check API key validation
- Review error logs

### High costs:
- You shouldn't have costs (users pay)
- Unless you set fallback keys
- Monitor usage tracking

## 📞 Support

For deployment help:
- GitHub Issues
- Documentation
- Community Discord

---

**Ready to launch your SaaS!** 🚀

Users bring their own keys → You provide the platform → Everyone wins!
