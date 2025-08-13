# Production Deployment Guide

## Overview

This guide covers deploying the User Hierarchy and Reference Code System to production environments. The system supports multiple deployment strategies including traditional server deployment, containerized deployment with Docker, and cloud platform deployment.

## Prerequisites

### System Requirements

- **Server**: Linux (Ubuntu 20.04+ recommended) or Windows Server 2019+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 20GB SSD, Recommended 50GB+ SSD
- **Network**: Stable internet connection, SSL certificate for HTTPS

### Software Requirements

- **Node.js**: Version 18.0 or higher
- **PostgreSQL**: Version 14.0 or higher
- **Nginx**: For reverse proxy (recommended)
- **PM2**: For process management (recommended)
- **Docker**: If using containerized deployment

## Deployment Methods

### Method 1: Traditional Server Deployment

#### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 globally
sudo npm install -g pm2
```

#### 2. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create production database and user
CREATE DATABASE user_hierarchy_system_prod;
CREATE USER app_user_prod WITH PASSWORD 'your_secure_production_password';
GRANT ALL PRIVILEGES ON DATABASE user_hierarchy_system_prod TO app_user_prod;
ALTER USER app_user_prod CREATEDB;
\\q

# Configure PostgreSQL for production
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**PostgreSQL Configuration:**
```conf
# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings
max_connections = 100
listen_addresses = 'localhost'

# Logging
log_statement = 'all'
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

#### 3. Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/user-hierarchy-system
sudo chown $USER:$USER /var/www/user-hierarchy-system

# Clone and setup application
cd /var/www/user-hierarchy-system
git clone <your-repository-url> .

# Install dependencies
npm ci --production

# Build frontend
npm run build

# Create production environment file
cp .env.example .env.production
```

**Production Environment Configuration (.env.production):**
```env
# Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://app_user_prod:your_secure_production_password@localhost:5432/user_hierarchy_system_prod

# Security
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
BCRYPT_ROUNDS=12

# File uploads
UPLOAD_DIR=/var/www/user-hierarchy-system/uploads
MAX_FILE_SIZE=10485760

# Email (if configured)
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Rate limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# SSL/Security
FORCE_HTTPS=true
SECURE_COOKIES=true
```

#### 4. Database Migration

```bash
# Run database migrations
NODE_ENV=production node scripts/run-migrations.js

# Create initial super agent
NODE_ENV=production node scripts/create-super-agent.js
```

#### 5. PM2 Process Management

Create PM2 ecosystem file:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'user-hierarchy-system',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    error_file: '/var/log/user-hierarchy-system/error.log',
    out_file: '/var/log/user-hierarchy-system/out.log',
    log_file: '/var/log/user-hierarchy-system/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

```bash
# Create log directory
sudo mkdir -p /var/log/user-hierarchy-system
sudo chown $USER:$USER /var/log/user-hierarchy-system

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

#### 6. Nginx Configuration

```nginx
# /etc/nginx/sites-available/user-hierarchy-system
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header Referrer-Policy \"no-referrer-when-downgrade\" always;
    add_header Content-Security-Policy \"default-src 'self' http: https: data: blob: 'unsafe-inline'\" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Static files
    location /static/ {
        alias /var/www/user-hierarchy-system/dist/;
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Frontend routes
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File upload size
    client_max_body_size 10M;
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/user-hierarchy-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Method 2: Docker Deployment

#### 1. Docker Configuration

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./
COPY --from=builder --chown=nextjs:nodejs /app/routes ./routes
COPY --from=builder --chown=nextjs:nodejs /app/services ./services
COPY --from=builder --chown=nextjs:nodejs /app/middleware ./middleware
COPY --from=builder --chown=nextjs:nodejs /app/utils ./utils
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production

CMD [\"node\", \"server.js\"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - \"3000:3000\"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://app_user:password@db:5432/user_hierarchy_system
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=https://yourdomain.com
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:3000/api/docs/health\"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=user_hierarchy_system
      - POSTGRES_USER=app_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: [\"CMD-SHELL\", \"pg_isready -U app_user -d user_hierarchy_system\"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: [\"CMD\", \"redis-cli\", \"ping\"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### 2. Docker Deployment Commands

```bash
# Create environment file
cp .env.example .env.production

# Build and start services
docker-compose up -d

# Run database migrations
docker-compose exec app node scripts/run-migrations.js

# Create initial super agent
docker-compose exec app node scripts/create-super-agent.js

# View logs
docker-compose logs -f app
```

### Method 3: Cloud Platform Deployment

#### AWS Deployment with ECS

**Task Definition (task-definition.json):**
```json
{
  \"family\": \"user-hierarchy-system\",
  \"networkMode\": \"awsvpc\",
  \"requiresCompatibilities\": [\"FARGATE\"],
  \"cpu\": \"512\",
  \"memory\": \"1024\",
  \"executionRoleArn\": \"arn:aws:iam::account:role/ecsTaskExecutionRole\",
  \"taskRoleArn\": \"arn:aws:iam::account:role/ecsTaskRole\",
  \"containerDefinitions\": [
    {
      \"name\": \"user-hierarchy-system\",
      \"image\": \"your-account.dkr.ecr.region.amazonaws.com/user-hierarchy-system:latest\",
      \"portMappings\": [
        {
          \"containerPort\": 3000,
          \"protocol\": \"tcp\"
        }
      ],
      \"environment\": [
        {
          \"name\": \"NODE_ENV\",
          \"value\": \"production\"
        }
      ],
      \"secrets\": [
        {
          \"name\": \"DATABASE_URL\",
          \"valueFrom\": \"arn:aws:secretsmanager:region:account:secret:database-url\"
        },
        {
          \"name\": \"JWT_SECRET\",
          \"valueFrom\": \"arn:aws:secretsmanager:region:account:secret:jwt-secret\"
        }
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/user-hierarchy-system\",
          \"awslogs-region\": \"us-east-1\",
          \"awslogs-stream-prefix\": \"ecs\"
        }
      }
    }
  ]
}
```

## Security Considerations

### 1. Environment Variables

Never commit sensitive environment variables to version control:

```bash
# Use AWS Secrets Manager, Azure Key Vault, or similar
# Example for AWS:
aws secretsmanager create-secret --name \"user-hierarchy-system/database-url\" --secret-string \"postgresql://...\"
```

### 2. Database Security

```sql
-- Create read-only user for monitoring
CREATE USER monitoring_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE user_hierarchy_system_prod TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_user;

-- Revoke unnecessary permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user_prod;
```

### 3. Firewall Configuration

```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 4. SSL/TLS Configuration

```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### 1. Application Monitoring

```javascript
// Add to server.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

### 2. Log Management

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/user-hierarchy-system
```

```
/var/log/user-hierarchy-system/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reload user-hierarchy-system
    endscript
}
```

### 3. Health Checks

```javascript
// Add health check endpoint
app.get('/api/docs/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

## Backup and Recovery

### 1. Database Backups

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR=\"/var/backups/user-hierarchy-system\"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME=\"user_hierarchy_system_prod\"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U app_user_prod $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name \"backup_*.sql.gz\" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://your-backup-bucket/database/
```

```bash
# Add to crontab
0 2 * * * /path/to/backup-database.sh
```

### 2. Application Backups

```bash
#!/bin/bash
# backup-application.sh

BACKUP_DIR=\"/var/backups/user-hierarchy-system\"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR=\"/var/www/user-hierarchy-system\"

# Backup uploads and configuration
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR uploads .env.production

# Keep only last 7 days
find $BACKUP_DIR -name \"app_backup_*.tar.gz\" -mtime +7 -delete
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_users_role_active ON users(role, is_active);
CREATE INDEX CONCURRENTLY idx_projects_status_created ON projects(status, created_at);
CREATE INDEX CONCURRENTLY idx_user_hierarchy_parent_level ON user_hierarchy(parent_id, hierarchy_level);

-- Analyze tables
ANALYZE users;
ANALYZE projects;
ANALYZE user_hierarchy;
```

### 2. Application Optimization

```javascript
// Add Redis caching
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Cache frequently accessed data
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await client.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      client.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connections
   sudo -u postgres psql -c \"SELECT * FROM pg_stat_activity;\"
   ```

2. **Application Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs user-hierarchy-system
   
   # Check system resources
   htop
   df -h
   ```

3. **SSL Certificate Issues**
   ```bash
   # Test SSL configuration
   sudo nginx -t
   
   # Renew certificate
   sudo certbot renew --dry-run
   ```

## Rollback Procedures

### 1. Application Rollback

```bash
# Using PM2
pm2 stop user-hierarchy-system
git checkout previous-stable-tag
npm ci --production
npm run build
pm2 start user-hierarchy-system
```

### 2. Database Rollback

```bash
# Restore from backup
gunzip -c /var/backups/user-hierarchy-system/backup_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U app_user_prod user_hierarchy_system_prod
```

---

**Note**: Always test deployment procedures in a staging environment before applying to production.