# Deploy VoxFlow to Vercel

## Overview
- **Frontend**: React app → Deploy to Vercel
- **Backend**: Node.js API → Deploy to Vercel (Serverless Functions)

## Prerequisites
1. Vercel account (sign up at vercel.com)
2. GitHub account
3. Supabase project running
4. API keys ready (Groq, Deepgram, Twilio)

---

## Part 1: Prepare Backend for Vercel

### 1. Create `vercel.json` in backend folder

Create `VoxFlow.ai/backend/vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2. Update backend package.json

Make sure these scripts exist in `backend/package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## Part 2: Prepare Frontend for Vercel

### 1. Create `vercel.json` in frontend folder

Create `VoxFlow.ai/frontend/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Update frontend environment

Create `VoxFlow.ai/frontend/.env.production`:
```
VITE_API_URL=https://your-backend.vercel.app
```

---

## Part 3: Deploy Backend to Vercel

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy Backend**:
```bash
cd VoxFlow.ai/backend
vercel
```

4. **Set Environment Variables** (during deployment or after):
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add JWT_SECRET
vercel env add GROQ_API_KEY
vercel env add DEEPGRAM_API_KEY
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_PHONE_NUMBER
```

5. **Deploy to Production**:
```bash
vercel --prod
```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Select the `backend` folder as root directory
4. Add environment variables in Settings → Environment Variables
5. Deploy

---

## Part 4: Deploy Frontend to Vercel

### 1. Update API URL

After backend is deployed, update `frontend/.env.production`:
```
VITE_API_URL=https://voxflow-backend.vercel.app
```

### 2. Deploy Frontend

```bash
cd VoxFlow.ai/frontend
vercel --prod
```

Or use Vercel Dashboard:
1. Import repository
2. Select `frontend` folder as root directory
3. Framework Preset: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variable: `VITE_API_URL`
7. Deploy

---

## Part 5: Configure Environment Variables

### Backend Environment Variables (Vercel Dashboard)

Go to your backend project → Settings → Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-secret-key-min-32-chars
GROQ_API_KEY=gsk_...
DEEPGRAM_API_KEY=your-deepgram-key
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
NODE_ENV=production
PORT=5000
```

### Frontend Environment Variables

```
VITE_API_URL=https://your-backend.vercel.app
```

---

## Part 6: Update CORS Settings

After deployment, update backend CORS to allow your frontend domain.

In `backend/app.js`, update:
```javascript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://your-frontend.vercel.app'
  ],
  credentials: true,
};
```

Redeploy backend after this change.

---

## Part 7: Test Deployment

1. Visit your frontend URL: `https://your-frontend.vercel.app`
2. Try to login
3. Create an agent
4. Test web call
5. Check backend logs in Vercel dashboard

---

## Troubleshooting

### Backend Issues

**Error: Module not found**
- Make sure all dependencies are in `package.json`
- Run `npm install` locally first

**Error: Function timeout**
- Vercel free tier has 10s timeout
- Upgrade to Pro for 60s timeout

**Error: CORS**
- Add your frontend domain to CORS whitelist
- Redeploy backend

### Frontend Issues

**Error: API calls failing**
- Check `VITE_API_URL` is correct
- Make sure it starts with `https://`
- Check browser console for errors

**Error: 404 on refresh**
- Make sure `vercel.json` rewrites are configured
- Redeploy frontend

---

## Quick Deploy Commands

```bash
# Deploy Backend
cd VoxFlow.ai/backend
vercel --prod

# Deploy Frontend (after backend URL is ready)
cd VoxFlow.ai/frontend
vercel --prod
```

---

## Post-Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] All environment variables set
- [ ] CORS configured correctly
- [ ] Database migrations run in Supabase
- [ ] API keys configured in app
- [ ] Test login/register
- [ ] Test agent creation
- [ ] Test web call
- [ ] Test phone call (if Twilio configured)

---

## Custom Domains (Optional)

1. Go to Vercel project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update CORS settings with new domain
