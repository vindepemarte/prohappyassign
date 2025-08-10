# Design Document

## Overview

This design addresses the complete migration from Supabase to PostgreSQL for a React-based web application deployed on Coolify VPS. The application currently works locally with PostgreSQL but fails in production with 405 errors and authentication issues. The migration involves removing all Supabase dependencies, ensuring proper PostgreSQL integration, and fixing deployment configuration issues.

## Architecture

### Current State Analysis
- **Frontend**: React with TypeScript, Vite build system
- **Backend**: Express.js server with PostgreSQL database
- **Authentication**: Custom JWT-based authentication using PostgreSQL
- **Database**: PostgreSQL with connection pooling via `pg` library
- **Deployment**: Coolify VPS with Docker containers

### Issues Identified
1. **Supabase References**: Multiple files still contain Supabase imports and references
2. **405 Errors**: Likely caused by incorrect API routing or CORS configuration
3. **Authentication Failures**: Frontend authentication flow may still reference Supabase patterns
4. **Environment Configuration**: Production environment variables may not be properly configured

## Components and Interfaces

### 1. Database Layer
**Current Implementation**: PostgreSQL with connection pooling
- **Service**: `services/database.ts` - Handles connection pooling and query execution
- **Connection**: Uses `DATABASE_URL` environment variable
- **Features**: Transaction support, connection pooling, error handling

**Required Changes**:
- Ensure all database queries use PostgreSQL-compatible syntax
- Verify connection string format for Coolify deployment
- Add proper SSL configuration for production

### 2. Authentication System
**Current Implementation**: Custom JWT-based authentication
- **Service**: `services/auth.ts` - Handles user registration, login, session management
- **Routes**: `routes/auth.js` - Express routes for authentication endpoints
- **Features**: Password hashing, JWT tokens, session management

**Required Changes**:
- Remove any remaining Supabase auth references
- Ensure proper CORS configuration for authentication endpoints
- Verify JWT secret configuration in production

### 3. API Layer
**Current Implementation**: Express.js REST API
- **Service**: `services/apiService.ts` - Frontend API client
- **Routes**: Multiple route files for different resources
- **Features**: Token-based authentication, error handling

**Required Changes**:
- Remove Supabase client references
- Ensure all API endpoints return proper HTTP status codes
- Fix CORS configuration for production domain

### 4. Frontend Components
**Current Implementation**: React components with custom hooks
- **Auth Context**: `contexts/AuthContext.tsx` - Manages authentication state
- **API Service**: Frontend service layer for API communication

**Required Changes**:
- Remove Supabase imports and references
- Update authentication flow to use PostgreSQL API
- Fix any hardcoded Supabase URLs or configurations

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'worker' | 'agent';
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}
```

### Authentication Response
```typescript
interface AuthResult {
  user: User;
  token: string;
  expires_at: string;
}
```

## Error Handling

### 405 Method Not Allowed Errors
**Root Cause**: Likely caused by:
1. Incorrect API endpoint routing
2. CORS preflight request failures
3. Missing HTTP method handlers

**Solution**:
1. Verify all API routes are properly defined
2. Ensure CORS is configured for production domain
3. Add proper HTTP method handlers for all endpoints

### Authentication Errors
**Root Cause**: 
1. Frontend still attempting to use Supabase authentication
2. JWT token format incompatibility
3. Environment variable configuration issues

**Solution**:
1. Update frontend authentication flow
2. Ensure consistent JWT token handling
3. Verify production environment variables

### Database Connection Issues
**Root Cause**:
1. Incorrect PostgreSQL connection string format
2. SSL configuration issues in production
3. Connection pool configuration problems

**Solution**:
1. Verify DATABASE_URL format for Coolify PostgreSQL
2. Configure SSL settings appropriately
3. Optimize connection pool settings

## Testing Strategy

### Unit Tests
- Test authentication functions with PostgreSQL
- Test database connection and query functions
- Test API endpoint responses

### Integration Tests
- Test complete authentication flow
- Test API endpoints with database operations
- Test file upload and download functionality

### Production Verification
- Test deployment on Coolify VPS
- Verify all environment variables are set correctly
- Test authentication flow in production environment
- Verify database connectivity and operations

## Deployment Configuration

### Environment Variables
Required for production:
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=secure-random-string
BCRYPT_ROUNDS=12
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
```

### Coolify Configuration
- Ensure PostgreSQL service is properly configured
- Verify network connectivity between app and database
- Configure proper health checks
- Set up proper logging for debugging

### CORS Configuration
- Configure CORS for production domain
- Ensure preflight requests are handled correctly
- Set proper credentials handling

## Migration Steps

### Phase 1: Code Cleanup
1. Remove all Supabase imports and references
2. Update package.json to remove Supabase dependencies
3. Clean up environment variables

### Phase 2: API Fixes
1. Fix CORS configuration for production
2. Ensure all API endpoints return proper status codes
3. Verify authentication middleware

### Phase 3: Frontend Updates
1. Update authentication context
2. Remove Supabase client references
3. Update API service calls

### Phase 4: Deployment Fixes
1. Configure production environment variables
2. Test database connectivity
3. Verify SSL configuration
4. Test complete application flow

## Security Considerations

### Authentication Security
- Use secure JWT secrets
- Implement proper password hashing
- Secure session management

### Database Security
- Use connection pooling
- Implement proper SQL injection prevention
- Configure SSL for database connections

### API Security
- Implement proper CORS configuration
- Use helmet for security headers
- Validate all input data

## Performance Optimization

### Database Performance
- Use connection pooling
- Optimize query performance
- Implement proper indexing

### API Performance
- Implement response caching where appropriate
- Optimize payload sizes
- Use compression middleware

### Frontend Performance
- Optimize bundle size
- Implement proper error boundaries
- Use efficient state management