# Frontend Deployment to Vercel

## Backend URL
✅ Backend is live at: `https://vox-flow-ai.vercel.app`

## Changes Made
1. ✅ Updated `frontend/.env.production` with backend URL
2. ✅ Added backend URL to CORS whitelist in `backend/app.js`

## Deploy Frontend to Vercel

### Option 1: Using Vercel CLI (Quick)

```bash
cd VoxFlow.ai/frontend
vercel --prod
```

### Option 2: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. **Project Settings:**
   - **Root Directory:** `VoxFlow.ai/frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. **Environment Variables:**
   Add this variable:
   ```
   VITE_API_URL=https://vox-flow-ai.vercel.app
   ```

5. Click **Deploy**

## After Frontend Deploys

Once your frontend is deployed (e.g., `https://your-frontend.vercel.app`), you need to:

### 1. Update Backend CORS
Add your frontend URL to Vercel environment variables:

**In Vercel Backend Project → Settings → Environment Variables:**
```
CLIENT_URL=https://your-frontend.vercel.app
```

Then redeploy the backend.

### 2. Update Backend Code (Already Done)
The backend `app.js` already includes the backend URL in CORS, but you should add your actual frontend URL once you know it.

## Verification

After deployment:
1. Visit your frontend URL
2. Open browser console (F12)
3. Try to login/register
4. Check that API calls go to `https://vox-flow-ai.vercel.app`
5. Verify no CORS errors

## Troubleshooting

**CORS Error:**
- Make sure `CLIENT_URL` is set in backend Vercel environment variables
- Redeploy backend after adding the variable

**API calls failing:**
- Check browser console for the API URL being used
- Verify `VITE_API_URL` is set correctly in frontend Vercel environment variables

**Build fails:**
- Check build logs in Vercel dashboard
- Make sure all dependencies are in `package.json`
