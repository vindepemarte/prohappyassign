# Database Migration Guide

This directory contains database migration scripts for implementing the user hierarchy system.

## Overview

The migration adds support for a 5-tier user hierarchy system:
- **Super Agent** (Level 1): Top-level administrator
- **Agent** (Level 2): Sub-agent under Super Agent
- **Client** (Level 3): End users who submit projects
- **Super Worker** (Level 2): Top-level worker/freelancer
- **Worker** (Level 4): Sub-worker under Super Worker

## Migration Files

### 001_user_hierarchy_setup.sql
- Creates new database tables and columns
- Adds new user roles (super_agent, super_worker)
- Sets up indexes and constraints
- Creates triggers for timestamp management

### 002_migrate_existing_data.sql
- Migrates existing users to the new hierarchy structure
- Generates initial reference codes for existing users
- Sets up default agent pricing
- Maintains existing project assignments

### rollback_user_hierarchy.sql
- Rollback script to undo all hierarchy changes
- **WARNING**: This will delete all hierarchy data

## Running Migrations

### Prerequisites
1. Ensure `DATABASE_URL` environment variable is set
2. Database should be accessible and have proper permissions
3. Backup your database before running migrations

### Run Migrations
```bash
# Run all pending migrations
npm run migrate

# Or run directly with Node.js
node scripts/run-migrations.js
```

### Rollback (if needed)
```bash
# Rollback all hierarchy changes
npm run migrate:rollback

# Or run directly with psql
psql $DATABASE_URL -f scripts/migrations/rollback_user_hierarchy.sql
```

## What the Migration Does

### New Tables Created
- `reference_codes`: Stores recruitment reference codes
- `user_hierarchy`: Tracks user relationships and hierarchy levels
- `agent_pricing`: Stores agent-specific pricing configuration
- `user_sessions`: JWT session management
- `assignments`: Project assignment tracking

### Existing Tables Modified
- `users`: Added hierarchy-related columns
- `projects`: Added sub_worker_id and sub_agent_id columns

### Data Migration
1. **User Role Assignment**: 
   - First existing agent is promoted to super_agent
   - All users are assigned to hierarchy under the super_agent
   
2. **Reference Code Generation**:
   - Super agents get 2 codes (agent + client recruitment)
   - Agents get 1 code (client recruitment)
   - Super workers get 1 code (worker recruitment)

3. **Default Pricing**:
   - All agents get default pricing configuration
   - Base rate: £6.25 per 500 words
   - Agent fee: 15%

## Verification

After running migrations, verify the setup:

```sql
-- Check new tables exist
\dt reference_codes user_hierarchy agent_pricing assignments

-- Check user roles
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Check reference codes generated
SELECT code_type, COUNT(*) FROM reference_codes GROUP BY code_type;

-- Check hierarchy setup
SELECT hierarchy_level, COUNT(*) FROM user_hierarchy GROUP BY hierarchy_level;
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure database user has CREATE, ALTER, and INSERT permissions
2. **Connection Issues**: Verify DATABASE_URL is correct and database is accessible
3. **Existing Data Conflicts**: Check for any data that might conflict with new constraints

### Recovery

If migration fails:
1. Check the error message in the console
2. Fix any data issues manually
3. Run the rollback script if needed
4. Re-run migrations after fixing issues

### Support

For migration issues:
1. Check database logs for detailed error messages
2. Verify all prerequisites are met
3. Test on a development database first
4. Contact system administrator if needed

## Post-Migration Steps

After successful migration:
1. Update application code to use new user roles
2. Test user registration with reference codes
3. Verify dashboard access for different roles
4. Test project assignment workflows
5. Validate financial data access controls

## Security Notes

- Reference codes are generated with cryptographic randomness
- All sensitive operations are wrapped in database transactions
- Foreign key constraints ensure data integrity
- Indexes are created for optimal query performance