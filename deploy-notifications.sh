#!/bin/bash

# Deploy notification system
echo "🚀 Deploying notification system..."

# 1. Deploy the edge function
echo "📡 Deploying edge function..."
supabase functions deploy send-push-notification

# 2. Set environment variables (you need to set these in Supabase dashboard)
echo "⚙️  Environment variables needed in Supabase dashboard:"
echo "   - VAPID_PUBLIC_KEY: Your VAPID public key"
echo "   - VAPID_PRIVATE_KEY: Your VAPID private key"
echo "   - SUPABASE_URL: Your Supabase URL"
echo "   - SUPABASE_ANON_KEY: Your Supabase anon key"

# 3. Run the SQL to create tables
echo "🗄️  Run the fix-notification-table.sql in your Supabase SQL editor"

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Run fix-notification-table.sql in Supabase SQL editor"
echo "2. Set environment variables in Supabase dashboard"
echo "3. Test notifications in your app"