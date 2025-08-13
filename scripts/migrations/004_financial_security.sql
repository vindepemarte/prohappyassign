-- Migration: Financial Data Security and Audit System
-- Description: Create audit logging for financial data access and security controls
-- Date: 2025-12-08

BEGIN;

-- 1. Create financial_access_audit table
CREATE TABLE IF NOT EXISTS financial_access_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role user_role NOT NULL,
    access_type VARCHAR(50) NOT NULL, -- Type of financial data accessed
    resource_id VARCHAR(50), -- ID of the specific resource accessed
    resource_type VARCHAR(50), -- Type of resource (project, user, summary, etc.)
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_access_audit_user_id ON financial_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_access_audit_user_role ON financial_access_audit(user_role);
CREATE INDEX IF NOT EXISTS idx_financial_access_audit_access_type ON financial_access_audit(access_type);
CREATE INDEX IF NOT EXISTS idx_financial_access_audit_success ON financial_access_audit(success);
CREATE INDEX IF NOT EXISTS idx_financial_access_audit_created_at ON financial_access_audit(created_at);

-- 3. Create function to check financial data access permissions
CREATE OR REPLACE FUNCTION has_financial_permission(user_role_param user_role, permission_type VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
    CASE user_role_param
        WHEN 'super_agent' THEN
            RETURN true; -- Super agents have all financial permissions
        WHEN 'agent' THEN
            RETURN permission_type IN ('canViewAgentFees', 'canViewClientPricing', 'canModifyPricing');
        WHEN 'super_worker' THEN
            RETURN permission_type IN ('canViewPaymentDistribution', 'canViewWorkerPayments');
        WHEN 'client' THEN
            RETURN permission_type = 'canViewClientPricing';
        WHEN 'worker' THEN
            RETURN false; -- Workers have no financial permissions
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to filter project financial data based on user role
CREATE OR REPLACE FUNCTION filter_project_financial_data(
    project_data JSONB,
    user_role_param user_role,
    user_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    filtered_data JSONB := project_data;
BEGIN
    CASE user_role_param
        WHEN 'worker' THEN
            -- Remove all financial data for workers
            filtered_data := filtered_data - 'total_cost' - 'agent_fee' - 'worker_payment' 
                           - 'profit_margin' - 'pricing_breakdown' - 'payment_status' 
                           - 'amount_paid' - 'amount_due';
        WHEN 'agent' THEN
            -- Remove system-level profit data for agents
            filtered_data := filtered_data - 'system_profit' - 'super_agent_share';
            -- If not their project, remove all financial data
            IF (filtered_data->>'agent_id')::UUID != user_id_param 
               AND (filtered_data->>'sub_agent_id')::UUID != user_id_param THEN
                filtered_data := filtered_data - 'total_cost' - 'agent_fee' - 'worker_payment' 
                               - 'profit_margin' - 'pricing_breakdown';
            END IF;
        WHEN 'super_worker' THEN
            -- Remove profit margins and agent fees for super workers
            filtered_data := filtered_data - 'agent_fee' - 'profit_margin' 
                           - 'system_profit' - 'super_agent_share';
        WHEN 'client' THEN
            -- If not their project, remove all financial data
            IF (filtered_data->>'client_id')::UUID != user_id_param THEN
                filtered_data := filtered_data - 'total_cost' - 'agent_fee' - 'worker_payment' 
                               - 'profit_margin' - 'pricing_breakdown';
            ELSE
                -- Their project - keep pricing info but remove internal costs
                filtered_data := filtered_data - 'agent_fee' - 'worker_payment' 
                               - 'profit_margin' - 'system_profit' - 'super_agent_share';
            END IF;
        -- 'super_agent' sees everything (no filtering)
        ELSE
            NULL; -- No change for super_agent or unknown roles
    END CASE;
    
    RETURN filtered_data;
END;
$$ LANGUAGE plpgsql;

-- 5. Create view for financial data access with role-based filtering
CREATE OR REPLACE VIEW user_financial_access AS
SELECT 
    u.id,
    u.role,
    CASE 
        WHEN u.role = 'super_agent' THEN 'full_access'
        WHEN u.role = 'agent' THEN 'agent_limited'
        WHEN u.role = 'super_worker' THEN 'worker_payments_only'
        WHEN u.role = 'client' THEN 'own_projects_only'
        WHEN u.role = 'worker' THEN 'no_access'
        ELSE 'no_access'
    END as financial_access_level,
    CASE 
        WHEN u.role = 'super_agent' THEN ARRAY['all']
        WHEN u.role = 'agent' THEN ARRAY['own_fees', 'client_pricing', 'modify_own_rates']
        WHEN u.role = 'super_worker' THEN ARRAY['worker_payments', 'assignment_costs']
        WHEN u.role = 'client' THEN ARRAY['own_project_pricing']
        ELSE ARRAY[]::TEXT[]
    END as allowed_financial_operations
FROM users u;

-- 6. Create trigger to automatically log financial data access
CREATE OR REPLACE FUNCTION log_financial_access_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- This trigger can be attached to tables containing financial data
    -- to automatically log access attempts
    INSERT INTO financial_access_audit (
        user_id, user_role, access_type, resource_id, resource_type, success
    ) VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'),
        COALESCE(current_setting('app.current_user_role', true)::user_role, 'worker'),
        TG_OP,
        NEW.id::TEXT,
        TG_TABLE_NAME,
        true
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get financial summary with role-based filtering
CREATE OR REPLACE FUNCTION get_user_financial_summary(user_id_param UUID, user_role_param user_role)
RETURNS TABLE(
    total_projects BIGINT,
    total_revenue NUMERIC,
    accessible_fees NUMERIC,
    accessible_payments NUMERIC,
    accessible_profit NUMERIC,
    access_level TEXT
) AS $$
BEGIN
    CASE user_role_param
        WHEN 'super_agent' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                COALESCE(SUM(p.total_cost), 0),
                COALESCE(SUM(p.agent_fee), 0),
                COALESCE(SUM(p.worker_payment), 0),
                COALESCE(SUM(p.total_cost - p.agent_fee - p.worker_payment), 0),
                'full_access'::TEXT
            FROM projects p
            WHERE p.status != 'cancelled';
            
        WHEN 'agent' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                COALESCE(SUM(p.total_cost), 0),
                COALESCE(SUM(p.agent_fee), 0),
                0::NUMERIC,
                0::NUMERIC,
                'agent_limited'::TEXT
            FROM projects p
            WHERE (p.agent_id = user_id_param OR p.sub_agent_id = user_id_param) 
              AND p.status != 'cancelled';
              
        WHEN 'super_worker' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                0::NUMERIC,
                0::NUMERIC,
                COALESCE(SUM(p.worker_payment), 0),
                0::NUMERIC,
                'worker_payments_only'::TEXT
            FROM projects p
            WHERE p.sub_worker_id = user_id_param AND p.status != 'cancelled';
            
        WHEN 'client' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                COALESCE(SUM(p.total_cost), 0),
                0::NUMERIC,
                0::NUMERIC,
                0::NUMERIC,
                'own_projects_only'::TEXT
            FROM projects p
            WHERE p.client_id = user_id_param AND p.status != 'cancelled';
            
        ELSE -- 'worker' and others
            RETURN QUERY
            SELECT 
                0::BIGINT,
                0::NUMERIC,
                0::NUMERIC,
                0::NUMERIC,
                0::NUMERIC,
                'no_access'::TEXT;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to validate and log financial data access
CREATE OR REPLACE FUNCTION validate_financial_access(
    user_id_param UUID,
    user_role_param user_role,
    access_type_param VARCHAR(50),
    resource_id_param VARCHAR(50) DEFAULT NULL,
    resource_type_param VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
    error_msg TEXT := NULL;
BEGIN
    -- Check permission based on role and access type
    SELECT has_financial_permission(user_role_param, access_type_param) INTO has_permission;
    
    -- Set error message if no permission
    IF NOT has_permission THEN
        error_msg := 'Access denied - insufficient financial permissions for role: ' || user_role_param;
    END IF;
    
    -- Log the access attempt
    INSERT INTO financial_access_audit (
        user_id, user_role, access_type, resource_id, resource_type, 
        success, error_message
    ) VALUES (
        user_id_param, user_role_param, access_type_param, 
        resource_id_param, resource_type_param, has_permission, error_msg
    );
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- 9. Insert some initial audit log entries for testing
INSERT INTO financial_access_audit (user_id, user_role, access_type, resource_type, success, error_message)
SELECT 
    u.id,
    u.role,
    'system_initialization',
    'financial_security_setup',
    true,
    'Financial security system initialized'
FROM users u
WHERE u.role IN ('super_agent', 'agent', 'super_worker')
LIMIT 5;

COMMIT;