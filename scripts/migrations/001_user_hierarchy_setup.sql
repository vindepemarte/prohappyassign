-- Migration: User Hierarchy System Setup
-- Description: Add new user roles, reference codes, hierarchy relationships, and agent pricing
-- Date: 2025-01-08

BEGIN;

-- 1. Update user_role enum to include new roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_agent';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_worker';

-- 2. Add new columns to users table for hierarchy
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS reference_code_used VARCHAR(20),
ADD COLUMN IF NOT EXISTS recruited_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS super_agent_id UUID REFERENCES users(id);

-- 3. Create reference_codes table
CREATE TABLE IF NOT EXISTS reference_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('agent_recruitment', 'client_recruitment', 'worker_recruitment')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create user_hierarchy table
CREATE TABLE IF NOT EXISTS user_hierarchy (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hierarchy_level INTEGER NOT NULL,
    super_agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 5. Create agent_pricing table
CREATE TABLE IF NOT EXISTS agent_pricing (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    min_word_count INTEGER DEFAULT 500,
    max_word_count INTEGER DEFAULT 20000,
    base_rate_per_500_words DECIMAL(10,2) NOT NULL DEFAULT 6.25,
    agent_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(agent_id)
);

-- 6. Create user_sessions table (if not exists)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address INET,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Add new columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS sub_worker_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS sub_agent_id UUID REFERENCES users(id);

-- 8. Create assignments table (if not exists)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID NOT NULL REFERENCES users(id),
    project_numbers TEXT,
    assignment_type VARCHAR(20) DEFAULT 'worker_assignment',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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