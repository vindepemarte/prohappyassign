#!/bin/bash

# Deploy notification system only
echo "🚀 Deploying notification system..."

# Check if linked to Supabase
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Not linked to Supabase project."
    echo "Please run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

# 1. Deploy the edge function
echo "📡 Deploying edge function..."
if supabase functions deploy send-push-notification; then
    echo "✅ Edge function deployed successfully"
else
    echo "❌ Edge function deployment failed"
    exit 1
fi

# 2. Set environment variables (you need to set these in Supabase dashboard)
echo ""
echo "⚙️  Environment variables needed in Supabase dashboard:"
echo "   Go to: Project Settings → Edge Functions → Environment Variables"
echo "   - VAPID_PUBLIC_KEY: Your VAPID public key"
echo "   - VAPID_PRIVATE_KEY: Your VAPID private key"
echo ""
echo "💡 Generate VAPID keys with:"
echo "   npx web-push generate-vapid-keys"

# 3. Run the SQL to create tables
echo ""
echo "🗄️  Database setup required:"
echo "   Run fix-notification-table.sql in your Supabase SQL editor"
echo "   File location: $(pwd)/fix-notification-table.sql"

echo ""
echo "✅ Notification system deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run fix-notification-table.sql in Supabase SQL editor"
echo "2. Set VAPID environment variables in Supabase dashboard"
echo "3. Test notifications in your app"
echo ""
echo "🧪 Test with: node test-notifications.js"