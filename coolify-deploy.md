# Coolify Deployment Guide for ProHappyAssignments

## Prerequisites
1. Push your code to a GitHub repository
2. Have a Coolify instance running
3. Have your Supabase project set up

## Deployment Steps

### 1. Create New Application in Coolify
1. Go to your Coolify dashboard
2. Click "New Resource" → "Application"
3. Select "Public Repository" and enter your GitHub repo URL
4. Choose "Docker" as the build pack

### 2. Environment Variables
Add these environment variables in Coolify:

```
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
```

### 3. Build Configuration
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `3000`
- **Dockerfile**: Use the provided Dockerfile

### 4. Supabase Edge Functions Setup
Before deployment, you need to deploy your Supabase edge functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy edge functions
supabase functions deploy send-push-notification
```

### 5. Environment Variables for Edge Functions
In your Supabase project dashboard, go to Settings → Edge Functions and add:

```
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

Generate VAPID keys using:
```bash
npx web-push generate-vapid-keys
```

### 6. Database Setup
Make sure your Supabase database has all the required tables. You can find the schema in your project.

### 7. Deploy
1. Push your code to GitHub
2. In Coolify, click "Deploy"
3. Monitor the build logs
4. Once deployed, test the application

## Troubleshooting

### Service Worker Issues
- Make sure your domain supports HTTPS (required for service workers)
- Check that the service worker is being served correctly

### Push Notifications
- Ensure VAPID keys are properly configured
- Check that the edge function is deployed and accessible
- Verify push notification permissions in the browser

### Build Issues
- Make sure Node.js version is 20+ (required for @google/genai)
- Check that all environment variables are set correctly

## Post-Deployment Checklist
- [ ] Application loads correctly
- [ ] Authentication works
- [ ] Database connections are working
- [ ] Push notifications are functional (if configured)
- [ ] Service worker registers successfully
- [ ] All API endpoints respond correctly