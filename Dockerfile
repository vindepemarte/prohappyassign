# Use Node.js 20 (required for @google/genai)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install serve globally for production static file serving
RUN npm install -g serve

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application with serve
CMD ["serve", "-s", "dist", "-l", "3000"]