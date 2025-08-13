# Multi-stage build for ProHappyAssignments
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache curl git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the React frontend
RUN npm run build

# Verify build output
RUN echo "=== Build Verification ===" && \
    ls -la dist/ && \
    ls -la dist/assets/ && \
    echo "=== Checking server dependencies ===" && \
    npm list express pg jsonwebtoken bcryptjs && \
    echo "=== Build completed successfully ==="

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/constants.js ./
COPY --from=builder /app/types.ts ./

# Create uploads directory for file uploads
RUN mkdir -p uploads && chown -R appuser:appgroup uploads

# Change ownership of the app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/docs/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start with production setup script in production, regular server otherwise
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then node scripts/production-start.js; else node server.js; fi"]