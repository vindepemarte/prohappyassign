-- Migration: User Hierarchy System Setup
-- Description: Add new user roles, reference codes, hierarchy relationships, and agent pricing
-- Date: 2025-01-08

BEGIN;

-- 1. The user_role enum and users table are already created in 000_base_schema.sql
-- This migration now focuses on additional hierarchy-specific tables and relationships

-- 2. Verify that the base tables exist (this will fail gracefully if they don't)
DO $$ 
BEGIN
    -- Check if users table exists with role column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        RAISE EXCEPTION 'Base schema not found. Please run 000_base_schema.sql first.';
    END IF;
END $$;

-- 3. The reference_codes table is already created in 000_base_schema.sql

-- 4. The user_hierarchy table is already created in 000_base_schema.sql

-- 5. The agent_pricing table is already created in 000_base_schema.sql

-- 6. The user_sessions table is already created in 000_base_schema.sql

-- 7. Add new columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS sub_worker_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS sub_agent_id UUID REFERENCES users(id);

-- 8. The assignments table is already created in 000_base_schema.sql

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reference_codes_owner_id ON reference_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_reference_codes_code ON reference_codes(code);
CREATE INDEX IF NOT EXISTS idx_reference_codes_active ON reference_codes(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_hierarchy_user_id ON user_hierarchy(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_parent_id ON user_hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_super_agent_id ON user_hierarchy(super_agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_id ON agent_pricing(agent_id);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_recruited_by ON users(recruited_by);
CREATE INDEX IF NOT EXISTS idx_users_super_agent_id ON users(super_agent_id);

CREATE INDEX IF NOT EXISTS idx_projects_sub_worker_id ON projects(sub_worker_id);
CREATE INDEX IF NOT EXISTS idx_projects_sub_agent_id ON projects(sub_agent_id);

CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 10. Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables that need updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reference_codes_updated_at ON reference_codes;
CREATE TRIGGER update_reference_codes_updated_at 
    BEFORE UPDATE ON reference_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_hierarchy_updated_at ON user_hierarchy;
CREATE TRIGGER update_user_hierarchy_updated_at 
    BEFORE UPDATE ON user_hierarchy 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_pricing_updated_at ON agent_pricing;
CREATE TRIGGER update_agent_pricing_updated_at 
    BEFORE UPDATE ON agent_pricing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at 
    BEFORE UPDATE ON assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Add constraints for data integrity
ALTER TABLE user_hierarchy 
ADD CONSTRAINT check_hierarchy_level 
CHECK (hierarchy_level >= 1 AND hierarchy_level <= 5);

ALTER TABLE user_hierarchy 
ADD CONSTRAINT check_no_self_parent 
CHECK (user_id != parent_id);

ALTER TABLE agent_pricing 
ADD CONSTRAINT check_word_count_range 
CHECK (min_word_count <= max_word_count AND min_word_count > 0);

ALTER TABLE agent_pricing 
ADD CONSTRAINT check_positive_rates 
CHECK (base_rate_per_500_words > 0 AND agent_fee_percentage >= 0);

COMMIT;