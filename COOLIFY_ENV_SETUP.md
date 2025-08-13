# Coolify Environment Variables Setup

## Required Environment Variables for Production

Set these environment variables in your Coolify application settings:

### 🔧 **Core Application Settings**
```env
NODE_ENV=production
PORT=3000
```

### 🗄️ **Database Configuration**
```env
DATABASE_URL=postgresql://username:password@host:port/database_name
```
*Replace with your actual PostgreSQL connection string from Coolify*

### 🔐 **Security Settings**
```env
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters_long
BCRYPT_ROUNDS=12
```
*Generate a strong JWT secret - use a random 32+ character string*

### 🌐 **Frontend Configuration**
```env
FRONTEND_URL=https://prohappya.uk
```
*Use your actual domain*

### 📧 **Email Configuration (Optional)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 🔒 **Additional Security (Optional)**
```env
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
SECURE_COOKIES=true
FORCE_HTTPS=true
```

## 🚀 **Coolify Deployment Steps**

### 1. **Set Environment Variables**
In Coolify dashboard:
1. Go to your application
2. Click "Environment Variables"
3. Add all the variables above
4. Save changes

### 2. **Database Setup**
Make sure your PostgreSQL database is:
- ✅ Created and accessible
- ✅ Connection string added to `DATABASE_URL`
- ✅ User has full permissions

### 3. **Deploy Application**
1. Push your code changes to Git
2. Coolify will automatically deploy
3. The production startup script will:
   - Run database migrations
   - Create initial test users
   - Start the server

### 4. **Verify Deployment**
After deployment, check:
- ✅ Health check: `https://prohappya.uk/api/docs/health`
- ✅ API docs: `https://prohappya.uk/api/docs`
- ✅ Login page: `https://prohappya.uk`

## 🧪 **Test Accounts (Password: 123456)**

After deployment, you can login with:

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| **Super Agent** | `admin@prohappya.uk` | `123456` | Full system access |
| **Agent** | `agent@prohappya.uk` | `123456` | Manage clients & workers |
| **Super Worker** | `superworker@prohappya.uk` | `123456` | Assign projects |
| **Worker** | `worker@prohappya.uk` | `123456` | Execute projects |
| **Client** | `client@prohappya.uk` | `123456` | Submit projects |

## 🔗 **Reference Codes for Testing**

| Code | Owner | Purpose |
|------|-------|---------|
| **ADMIN** | Super Agent | Recruit new agents |
| **AGENT** | Agent | Recruit new clients |
| **SUPER** | Agent | Recruit super workers |
| **WORK1** | Super Worker | Recruit workers |

## 🔧 **Troubleshooting**

### If deployment fails:

1. **Check Logs**: Look at Coolify deployment logs
2. **Environment Variables**: Verify all required vars are set
3. **Database**: Ensure PostgreSQL is accessible
4. **Health Check**: Test `/api/docs/health` endpoint

### Common Issues:

#### Database Connection
```
Error: connect ECONNREFUSED
```
**Fix**: Check `DATABASE_URL` is correct

#### JWT Secret Missing
```
Error: JWT_SECRET environment variable is not set
```
**Fix**: Add `JWT_SECRET` environment variable

#### Permission Errors
```
Error: 403 Forbidden
```
**Fix**: Database migrations might not have run properly

## 🔄 **Reset Database (if needed)**

If you need to reset the database:

1. **Connect to your database**
2. **Run**: `TRUNCATE TABLE users, projects, reference_codes, user_hierarchy CASCADE;`
3. **Redeploy**: Trigger new deployment in Coolify

## 📞 **Support**

If you encounter issues:
1. Check Coolify logs
2. Verify environment variables
3. Test database connection
4. Check health endpoints

---

**🎯 The system will automatically set up everything needed for production testing!**