# Multi-stage build for Coolify
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# Install ALL dependencies (including dev deps) for build
RUN npm ci

COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]