# Quick Deploy to Vercel

## Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

## Step 2: Login
```bash
vercel login
```

## Step 3: Deploy Backend First
```bash
cd backend
vercel
```

When prompted:
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N**
- Project name? **voxflow-backend**
- Directory? **./backend**
- Override settings? **N**

After deployment, copy the URL (e.g., `https://voxflow-backend.vercel.app`)

## Step 4: Add Backend Environment Variables

Go to Vercel Dashboard → Your Backend Project → Settings → Environment Variables

Add these:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
JWT_SECRET=your-secret-min-32-chars
GROQ_API_KEY=gsk_...
DEEPGRAM_API_KEY=your-key
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
NODE_ENV=production
```

Then redeploy:
```bash
vercel --prod
```

## Step 5: Update Frontend Config

Edit `frontend/.env.production`:
```
VITE_API_URL=https://voxflow-backend.vercel.app
```

## Step 6: Deploy Frontend
```bash
cd ../frontend
vercel
```

When prompted:
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N**
- Project name? **voxflow-frontend**
- Directory? **./frontend**
- Override settings? **Y**
- Build Command? **npm run build**
- Output Directory? **dist**
- Development Command? **npm run dev**

Deploy to production:
```bash
vercel --prod
```

## Step 7: Update CORS

Edit `backend/app.js` and add your frontend URL to CORS:
```javascript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://your-frontend.vercel.app'  // Add this
  ],
  credentials: true,
};
```

Redeploy backend:
```bash
cd ../backend
vercel --prod
```

## Done! 🎉

Your app is now live:
- Frontend: https://voxflow-frontend.vercel.app
- Backend: https://voxflow-backend.vercel.app

Test it by visiting the frontend URL and logging in.
