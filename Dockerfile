# Simple single-stage build for Coolify
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify build output
RUN echo "=== Build Verification ===" && \
    ls -la dist/ && \
    ls -la dist/assets/ && \
    echo "=== Checking dependencies ===" && \
    npm list express && \
    echo "=== All checks passed ==="

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Add healthcheck with longer timeout for startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application with startup script
CMD ["node", "start.js"]