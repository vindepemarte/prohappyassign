#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the frontend
echo "🏗️ Building frontend..."
npm run build

# Verify build
echo "✅ Verifying build..."
ls -la dist/

echo "🎉 Deployment complete!"