-- Rollback Migration: User Hierarchy System
-- Description: Rollback user hierarchy changes if needed
-- Date: 2025-01-08
-- WARNING: This will remove all hierarchy data and reference codes

BEGIN;

-- 1. Drop new tables (in reverse dependency order)
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS agent_pricing CASCADE;
DROP TABLE IF EXISTS user_hierarchy CASCADE;
DROP TABLE IF EXISTS reference_codes CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;

-- 2. Remove new columns from existing tables
ALTER TABLE projects 
DROP COLUMN IF EXISTS sub_worker_id,
DROP COLUMN IF EXISTS sub_agent_id;

ALTER TABLE users 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS password_hash,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS updated_at,
DROP COLUMN IF EXISTS reference_code_used,
DROP COLUMN IF EXISTS recruited_by,
DROP COLUMN IF EXISTS super_agent_id;

-- 3. Remove new enum values (Note: PostgreSQL doesn't support removing enum values easily)
-- You would need to recreate the enum type if you want to remove the new values
-- For now, we'll leave them as they don't hurt anything

-- 4. Drop triggers and functions
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_reference_codes_updated_at ON reference_codes;
DROP TRIGGER IF EXISTS update_user_hierarchy_updated_at ON user_hierarchy;
DROP TRIGGER IF EXISTS update_agent_pricing_updated_at ON agent_pricing;
DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;

DROP FUNCTION IF EXISTS update_updated_at_column();

-- 5. Drop indexes
DROP INDEX IF EXISTS idx_reference_codes_owner_id;
DROP INDEX IF EXISTS idx_reference_codes_code;
DROP INDEX IF EXISTS idx_reference_codes_active;
DROP INDEX IF EXISTS idx_user_hierarchy_user_id;
DROP INDEX IF EXISTS idx_user_hierarchy_parent_id;
DROP INDEX IF EXISTS idx_user_hierarchy_super_agent_id;
DROP INDEX IF EXISTS idx_agent_pricing_agent_id;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_recruited_by;
DROP INDEX IF EXISTS idx_users_super_agent_id;
DROP INDEX IF EXISTS idx_projects_sub_worker_id;
DROP INDEX IF EXISTS idx_projects_sub_agent_id;
DROP INDEX IF EXISTS idx_assignments_project_id;
DROP INDEX IF EXISTS idx_assignments_assigned_by;
DROP INDEX IF EXISTS idx_assignments_assigned_to;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_token_hash;
DROP INDEX IF EXISTS idx_user_sessions_expires_at;

-- 6. Reset any users that were changed to super_agent back to agent
UPDATE users SET role = 'agent' WHERE role = 'super_agent';
UPDATE users SET role = 'worker' WHERE role = 'super_worker';

-- 7. Remove migration records
DELETE FROM schema_migrations WHERE filename IN (
    '001_user_hierarchy_setup.sql',
    '002_migrate_existing_data.sql'
);

COMMIT;

-- Note: After running this rollback, you may need to restart your application
-- as the enum types will still contain the new values even though they're not used