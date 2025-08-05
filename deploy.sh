#!/bin/bash

# Deployment script for Coolify
echo "Starting deployment..."

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build the application
echo "Building application..."
npm run build

# Verify build
echo "Verifying build..."
if [ ! -d "dist" ]; then
    echo "ERROR: Build failed - dist directory not found"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "ERROR: Build failed - index.html not found"
    exit 1
fi

echo "Build verification passed"
echo "Dist contents:"
ls -la dist/
echo "Assets contents:"
ls -la dist/assets/

echo "Deployment preparation complete!"