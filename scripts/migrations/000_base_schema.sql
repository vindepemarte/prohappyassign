-- Migration: Base Database Schema
-- Description: Create all base tables, types, and initial structure
-- Date: 2025-08-15

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('client', 'worker', 'agent', 'super_agent', 'super_worker');
CREATE TYPE project_status AS ENUM ('pending_payment_approval', 'in_progress', 'completed', 'cancelled', 'revision_requested');
CREATE TYPE urgency_level AS ENUM ('normal', 'urgent', 'super_urgent');
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed');
CREATE TYPE extension_status AS ENUM ('pending', 'approved', 'rejected');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'client',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    reference_code_used VARCHAR(20),
    recruited_by UUID REFERENCES users(id),
    super_agent_id UUID REFERENCES users(id)
);

-- Create projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES users(id),
    worker_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES users(id),
    super_worker_id UUID REFERENCES users(id),
    sub_worker_id UUID REFERENCES users(id),
    sub_agent_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(255),
    academic_level VARCHAR(100),
    paper_type VARCHAR(100),
    status project_status DEFAULT 'pending_payment_approval',
    initial_word_count INTEGER DEFAULT 0,
    adjusted_word_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    cost_gbp DECIMAL(10,2) DEFAULT 0,
    base_price DECIMAL(10,2) DEFAULT 0,
    base_price_gbp DECIMAL(10,2) DEFAULT 0,
    urgency_charge_gbp DECIMAL(10,2) DEFAULT 0,
    super_worker_fee_gbp DECIMAL(10,2) DEFAULT 0,
    agent_fee_gbp DECIMAL(10,2) DEFAULT 0,
    deadline TIMESTAMP,
    order_reference VARCHAR(255),
    deadline_charge DECIMAL(10,2) DEFAULT 0.00,
    urgency_level urgency_level DEFAULT 'normal',
    adjustment_type VARCHAR(100),
    project_numbers TEXT,
    assignment_notes TEXT,
    assigned_at TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    pricing_type VARCHAR(50) DEFAULT 'agent',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create project_files table
CREATE TABLE project_files (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    purpose VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create project_notes table
CREATE TABLE project_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create project_change_requests table
CREATE TABLE project_change_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    instructions TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create deadline_extension_requests table
CREATE TABLE deadline_extension_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id),
    requested_deadline TIMESTAMP NOT NULL,
    reason TEXT NOT NULL,
    status extension_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user_earnings table
CREATE TABLE user_earnings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    earnings_gbp DECIMAL(10,2) DEFAULT 0,
    earnings_inr DECIMAL(10,2) DEFAULT 0,
    fees_paid_gbp DECIMAL(10,2) DEFAULT 0,
    net_profit_gbp DECIMAL(10,2) DEFAULT 0,
    calculation_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create agent_pricing table
CREATE TABLE agent_pricing (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    min_word_count INTEGER DEFAULT 500,
    max_word_count INTEGER DEFAULT 20000,
    base_rate_per_500_words DECIMAL(10,2) NOT NULL DEFAULT 6.25,
    agent_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP DEFAULT NOW(),
    effective_until TIMESTAMP,
    created_by UUID REFERENCES users(id),
    UNIQUE(agent_id)
);

-- Create super_agent_pricing table
CREATE TABLE super_agent_pricing (
    id SERIAL PRIMARY KEY,
    word_range_start INTEGER NOT NULL,
    word_range_end INTEGER NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notification_history table
CREATE TABLE notification_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    delivery_status delivery_status DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    error_message TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create hierarchy_change_log table
CREATE TABLE hierarchy_change_log (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    new_parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_reason TEXT,
    old_hierarchy_level INTEGER,
    new_hierarchy_level INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create reference_codes table
CREATE TABLE reference_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('agent_recruitment', 'client_recruitment', 'worker_recruitment')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user_hierarchy table
CREATE TABLE user_hierarchy (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hierarchy_level INTEGER NOT NULL,
    super_agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_sessions table
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address INET,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create assignments table
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID NOT NULL REFERENCES users(id),
    project_numbers TEXT,
    assignment_type VARCHAR(20) DEFAULT 'worker_assignment',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create migration tracking table
CREATE TABLE migration_tracking (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_worker_id ON projects(worker_id);
CREATE INDEX idx_projects_agent_id ON projects(agent_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX idx_user_earnings_user_id ON user_earnings(user_id);
CREATE INDEX idx_user_earnings_project_id ON user_earnings(project_id);
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_project_id ON notification_history(project_id);
CREATE INDEX idx_notification_history_is_read ON notification_history(is_read);
CREATE INDEX idx_agent_pricing_agent_id ON agent_pricing(agent_id);
CREATE INDEX idx_hierarchy_change_log_user_id ON hierarchy_change_log(user_id);
CREATE INDEX idx_hierarchy_change_log_changed_by ON hierarchy_change_log(changed_by);
CREATE INDEX idx_reference_codes_owner_id ON reference_codes(owner_id);
CREATE INDEX idx_reference_codes_code ON reference_codes(code);
CREATE INDEX idx_reference_codes_active ON reference_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_user_hierarchy_user_id ON user_hierarchy(user_id);
CREATE INDEX idx_user_hierarchy_parent_id ON user_hierarchy(parent_id);
CREATE INDEX idx_user_hierarchy_super_agent_id ON user_hierarchy(super_agent_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_assignments_project_id ON assignments(project_id);
CREATE INDEX idx_assignments_assigned_by ON assignments(assigned_by);
CREATE INDEX idx_assignments_assigned_to ON assignments(assigned_to);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deadline_extension_requests_updated_at 
    BEFORE UPDATE ON deadline_extension_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_pricing_updated_at 
    BEFORE UPDATE ON agent_pricing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_super_agent_pricing_updated_at 
    BEFORE UPDATE ON super_agent_pricing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_history_updated_at 
    BEFORE UPDATE ON notification_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reference_codes_updated_at 
    BEFORE UPDATE ON reference_codes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_hierarchy_updated_at 
    BEFORE UPDATE ON user_hierarchy 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at 
    BEFORE UPDATE ON assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;