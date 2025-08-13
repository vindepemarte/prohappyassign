-- Migration: Fix Financial Summary Function
-- Description: Update financial summary function to use correct column names
-- Date: 2025-12-08

BEGIN;

-- Drop and recreate the financial summary function with correct column names
DROP FUNCTION IF EXISTS get_user_financial_summary(UUID, user_role);

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
                COALESCE(SUM(p.cost_gbp), 0),
                COALESCE(SUM(p.cost_gbp * 0.15), 0), -- Estimated agent fees at 15%
                COALESCE(SUM(p.cost_gbp * 0.6), 0),  -- Estimated worker payments at 60%
                COALESCE(SUM(p.cost_gbp * 0.25), 0), -- Estimated profit at 25%
                'full_access'::TEXT
            FROM projects p
            WHERE p.status != 'cancelled';
            
        WHEN 'agent' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                COALESCE(SUM(p.cost_gbp), 0),
                COALESCE(SUM(p.cost_gbp * 0.15), 0), -- Their estimated fees
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
                COALESCE(SUM(p.cost_gbp * 0.6), 0), -- Estimated worker payments
                0::NUMERIC,
                'worker_payments_only'::TEXT
            FROM projects p
            WHERE p.sub_worker_id = user_id_param AND p.status != 'cancelled';
            
        WHEN 'client' THEN
            RETURN QUERY
            SELECT 
                COUNT(*)::BIGINT,
                COALESCE(SUM(p.cost_gbp), 0),
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

-- Update the project data filtering function to use correct column names
DROP FUNCTION IF EXISTS filter_project_financial_data(JSONB, user_role, UUID);

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
            filtered_data := filtered_data - 'cost_gbp' - 'base_price' - 'deadline_charge'
                           - 'profit_margin' - 'pricing_breakdown' - 'payment_status' 
                           - 'amount_paid' - 'amount_due';
        WHEN 'agent' THEN
            -- Remove system-level profit data for agents
            filtered_data := filtered_data - 'system_profit' - 'super_agent_share';
            -- If not their project, remove all financial data
            IF (filtered_data->>'agent_id')::UUID != user_id_param 
               AND (filtered_data->>'sub_agent_id')::UUID != user_id_param THEN
                filtered_data := filtered_data - 'cost_gbp' - 'base_price' - 'deadline_charge'
                               - 'profit_margin' - 'pricing_breakdown';
            END IF;
        WHEN 'super_worker' THEN
            -- Remove profit margins and agent fees for super workers
            filtered_data := filtered_data - 'agent_fee' - 'profit_margin' 
                           - 'system_profit' - 'super_agent_share';
        WHEN 'client' THEN
            -- If not their project, remove all financial data
            IF (filtered_data->>'client_id')::UUID != user_id_param THEN
                filtered_data := filtered_data - 'cost_gbp' - 'base_price' - 'deadline_charge'
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

-- Add comment for documentation
COMMENT ON FUNCTION get_user_financial_summary IS 'Returns financial summary data filtered by user role and permissions';
COMMENT ON FUNCTION filter_project_financial_data IS 'Filters project financial data based on user role and access permissions';

COMMIT;