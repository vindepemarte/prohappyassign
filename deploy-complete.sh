#!/bin/bash

# Complete deployment script for ProHappyAssignments
# This handles the main app deployment via Coolify

set -e  # Exit on any error

echo "🚀 Starting deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v git &> /dev/null; then
        print_error "Git not found. Please install Git."
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Run database migrations/setup
setup_database() {
    print_status "Database setup..."
    
    if [ -f "fix-notification-table.sql" ]; then
        print_status "Found notification table setup script"
        print_warning "Please run fix-notification-table.sql in your PostgreSQL database manually"
        print_status "SQL file location: $(pwd)/fix-notification-table.sql"
    fi
}

# Build and test the application locally
build_and_test() {
    print_status "Building application..."
    
    if npm run build; then
        print_success "Application built successfully"
    else
        print_error "Build failed"
        return 1
    fi
    
    # Optional: Run tests if they exist
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        print_status "Running tests..."
        npm test || print_warning "Tests failed or not configured"
    fi
}

# Push to Git (triggers Coolify deployment)
deploy_to_coolify() {
    print_status "Preparing Git deployment..."
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes. Committing them..."
        git add .
        git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    # Push to main branch (triggers Coolify)
    if git push origin main; then
        print_success "Code pushed to Git. Coolify deployment should start automatically."
    else
        print_error "Failed to push to Git"
        return 1
    fi
}

# Display post-deployment checklist
show_checklist() {
    print_status "Deployment complete! Please verify the following:"
    echo ""
    echo "📋 Post-Deployment Checklist:"
    echo "  □ Run fix-notification-table.sql in your PostgreSQL database"
    echo "  □ Set environment variables in Coolify:"
    echo "    - DATABASE_URL"
    echo "    - JWT_SECRET"
    echo "    - VAPID_PUBLIC_KEY"
    echo "    - VAPID_PRIVATE_KEY"
    echo "  □ Verify Coolify deployment completed successfully"
    echo "  □ Test application functionality"
    echo "  □ Test authentication system"
    echo ""
    echo "🔧 Generate VAPID keys with:"
    echo "  npx web-push generate-vapid-keys"
    echo ""
    echo "🌐 Check your Coolify dashboard for deployment status"
}

# Main deployment process
main() {
    echo "🎯 ProHappyAssignments Deployment"
    echo "================================"
    
    check_dependencies
    
    # Build and test locally first
    build_and_test || {
        print_error "Build failed. Aborting deployment."
        exit 1
    }
    
    # Setup database
    setup_database
    
    # Deploy main application via Git push (Coolify)
    deploy_to_coolify || {
        print_error "Git deployment failed"
        exit 1
    }
    
    show_checklist
    
    print_success "🎉 Deployment process completed!"
}

# Run main function
main "$@"