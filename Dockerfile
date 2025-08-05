# Simple Node.js Dockerfile for Coolify
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Coolify will map this)
EXPOSE 3000

# Start the application using serve
CMD ["npm", "start"]