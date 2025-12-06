# Quick Fix for Vercel Deployment Errors

## Issues Found
1. ❌ Missing `MASTER_ENCRYPTION_KEY` environment variable
2. ❌ Upload directories trying to use read-only filesystem
3. ❌ Server.js not exporting app for serverless functions

## Solutions Applied

### 1. Fixed Upload Middleware ✅
Updated `backend/src/middleware/upload.middleware.js` to use `/tmp` directory on Vercel (serverless environments).

### 2. Fixed Server Export ✅
Updated `backend/server.js` to:
- Export the Express app as default export for Vercel
- Only initialize Socket.io and HTTP server in non-serverless environments
- Detect serverless environment automatically

### 3. Add Missing Environment Variable

Go to your Vercel project dashboard:
1. Navigate to: **Settings → Environment Variables**
2. Add this variable:

```
MASTER_ENCRYPTION_KEY=<generate-this-key>
```

**Generate the key** (run locally):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as the value for `MASTER_ENCRYPTION_KEY`.

### 3. Verify Other Required Variables

Make sure these are also set in Vercel:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_KEY`
- ✅ `JWT_SECRET`
- ✅ `MASTER_ENCRYPTION_KEY` (NEW - add this!)
- ✅ `CLIENT_URL` (your frontend URL)
- ✅ `NODE_ENV=production`

## Deploy the Fix

After adding the environment variable:

```bash
cd VoxFlow.ai/backend
git add .
git commit -m "Fix: Use /tmp for uploads on Vercel"
git push
```

Vercel will automatically redeploy. Or manually trigger a redeploy from the Vercel dashboard.

## Verify Fix

After redeployment, check:
1. No more "ENOENT: no such file or directory" errors
2. No more "MASTER_ENCRYPTION_KEY not set" warnings
3. App loads successfully

## Notes

- The upload middleware now automatically detects serverless environments
- Files are stored in `/tmp` on Vercel (temporary, cleared after function execution)
- For persistent file storage, consider using S3, Cloudinary, or Supabase Storage
