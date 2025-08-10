# Production Environment Variables Setup

This document outlines the required environment variables for deploying the application on Coolify VPS.

## Required Environment Variables

### Database Configuration
```bash
DATABASE_URL=postgresql://username:password@host:port/database_name
# Example: postgresql://prohappya_user:password@31.97.115.227:5828/postgres
```

### Authentication
```bash
JWT_SECRET=your_secure_jwt_secret_key_here
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
BCRYPT_ROUNDS=12
```

### Application Configuration
```bash
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
# Replace with your actual Coolify domain
```

### Optional Configuration
```bash
DATABASE_SSL=false
# Set to true if your PostgreSQL requires SSL
```

## Coolify Configuration Steps

1. **In your Coolify dashboard:**
   - Go to your application settings
   - Navigate to Environment Variables section
   - Add each variable listed above

2. **Database URL Format:**
   - Ensure your PostgreSQL service is running in Coolify
   - Use the internal network address if database is in same Coolify instance
   - Format: `postgresql://username:password@host:port/database`

3. **Domain Configuration:**
   - Set `FRONTEND_URL` to your actual domain (e.g., https://prohappya.uk)
   - Ensure CORS is configured for your domain

4. **Security:**
   - Generate a strong JWT_SECRET (64+ characters)
   - Keep all credentials secure and never commit to version control

## Verification

After setting environment variables, check the application logs for:
- ✅ Database connection successful
- ✅ JWT_SECRET is set
- ✅ All required environment variables loaded

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL format
- Check if PostgreSQL service is running
- Ensure network connectivity between app and database

### Authentication Issues
- Verify JWT_SECRET is set and consistent
- Check CORS configuration for your domain
- Ensure FRONTEND_URL matches your actual domain

### 405 Method Not Allowed Errors
- Check CORS configuration
- Verify API endpoints are properly defined
- Ensure preflight requests are handled