# Deployment Fix for 503 Errors

## Problem
Your app was showing 503 errors because of asset hash mismatches between the built files and what the browser was requesting. This typically happens due to caching issues during deployment.

## What I Fixed

### 1. Updated Dockerfile
- Added multi-stage build for cleaner production image
- Added build verification steps
- Improved security with non-root user
- Better healthcheck configuration

### 2. Enhanced Server Configuration
- Added proper cache-busting headers for HTML files
- Improved logging for debugging
- Better error handling and file verification
- Proper MIME type handling

### 3. Added Deployment Verification
- Created `verify-deployment.js` to check build integrity
- Added `npm run deploy` script that builds and verifies
- Ensures all referenced assets actually exist

### 4. Fixed ES Module Issues
- Updated all Node.js files to use ES module syntax
- Fixed import statements for compatibility

## Deployment Steps

### For Coolify:

1. **Push these changes to your GitHub repository**
2. **In Coolify, trigger a new deployment**
3. **Clear any cached builds** (if Coolify has this option)
4. **Monitor the build logs** to ensure the verification passes

### Build Commands in Coolify:
- **Build Command**: `npm run deploy` (this builds and verifies)
- **Start Command**: `npm start`
- **Port**: `3000`

### Environment Variables:
Make sure these are set in Coolify:
```
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key_here
```

## Verification

After deployment, check:
1. Visit your domain - should load without 503 errors
2. Check browser dev tools - no 503 errors for assets
3. Service worker should register properly
4. Health endpoint should work: `https://yourdomain.com/health`

## If Still Having Issues

1. **Check Coolify logs** for any build errors
2. **Verify the dist folder** is being created properly
3. **Clear browser cache** completely
4. **Check if HTTPS is properly configured** (required for service workers)

## Local Testing

You can test locally with:
```bash
npm run deploy  # Builds and verifies
npm start       # Starts the server
```

Then visit `http://localhost:3000` to test.

## Cache Busting

The server now properly handles cache busting:
- HTML files are never cached (`no-cache` headers)
- Static assets have proper cache headers
- Service worker has no-cache headers

This should prevent the hash mismatch issues you were experiencing.