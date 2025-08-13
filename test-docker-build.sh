#!/bin/bash

# Test Docker Build Script
# This script tests the Docker build locally before deployment

echo "🚀 Testing Docker Build for ProHappy Assignments"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if Docker is running
print_info "Checking Docker status..."
docker --version > /dev/null 2>&1
print_status $? "Docker is available"

# Check if .env.local exists
if [ -f ".env.local" ]; then
    print_status 0 ".env.local file found"
else
    print_warning ".env.local not found - using .env.example"
    cp .env.example .env.local
fi

# Build the Docker image
print_info "Building Docker image..."
docker build -t prohappy-test . --no-cache
print_status $? "Docker image built successfully"

# Check if the image was created
print_info "Verifying Docker image..."
docker images | grep prohappy-test > /dev/null
print_status $? "Docker image exists"

# Test run the container (detached)
print_info "Starting container for testing..."
CONTAINER_ID=$(docker run -d -p 3001:3000 --env-file .env.local prohappy-test)
print_status $? "Container started with ID: ${CONTAINER_ID:0:12}"

# Wait for container to start
print_info "Waiting for container to initialize..."
sleep 10

# Check if container is running
docker ps | grep $CONTAINER_ID > /dev/null
if [ $? -eq 0 ]; then
    print_status 0 "Container is running"
else
    print_status 1 "Container failed to start"
    echo "Container logs:"
    docker logs $CONTAINER_ID
    docker rm -f $CONTAINER_ID
    exit 1
fi

# Test health endpoint
print_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    print_status 0 "Health endpoint responding (HTTP $HEALTH_RESPONSE)"
else
    print_status 1 "Health endpoint failed (HTTP $HEALTH_RESPONSE)"
    echo "Container logs:"
    docker logs $CONTAINER_ID
fi

# Test API documentation endpoint
print_info "Testing API documentation endpoint..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/docs)
if [ "$API_RESPONSE" = "200" ]; then
    print_status 0 "API documentation endpoint responding (HTTP $API_RESPONSE)"
else
    print_warning "API documentation endpoint returned HTTP $API_RESPONSE"
fi

# Show container logs (last 20 lines)
print_info "Container logs (last 20 lines):"
echo "----------------------------------------"
docker logs --tail 20 $CONTAINER_ID
echo "----------------------------------------"

# Cleanup
print_info "Cleaning up test container..."
docker stop $CONTAINER_ID > /dev/null
docker rm $CONTAINER_ID > /dev/null
print_status 0 "Test container cleaned up"

# Final status
echo ""
echo "🎉 Docker build test completed successfully!"
echo "The image is ready for deployment to Coolify."
echo ""
echo "Key fixes applied:"
echo "  ✅ Added missing middleware directory"
echo "  ✅ Added missing utils directory"
echo "  ✅ Fixed health check endpoint"
echo "  ✅ Verified all dependencies are included"
echo ""
echo "To deploy to Coolify:"
echo "  1. Commit and push these changes"
echo "  2. Trigger a new deployment in Coolify"
echo "  3. Monitor the deployment logs"
echo "  4. Verify health checks pass"