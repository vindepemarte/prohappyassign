-- Migration: Fix Project Hierarchy Function Timestamp Types
-- Description: Fix timestamp type mismatches in get_projects_with_hierarchy function
-- Date: 2025-12-08

BEGIN;

-- Drop and recreate the function with correct timestamp types
DROP FUNCTION IF EXISTS get_projects_with_hierarchy(UUID, user_role, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_projects_with_hierarchy(
    user_id_param UUID DEFAULT NULL,
    user_role_param user_role DEFAULT NULL,
    limit_param INTEGER DEFAULT 50,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE(
    project_id BIGINT,
    title TEXT,
    description TEXT,
    status project_status,
    cost_gbp NUMERIC,
    project_numbers TEXT[],
    
    -- Client information
    client_id UUID,
    client_name TEXT,
    client_hierarchy_level INTEGER,
    
    -- Agent information
    agent_id UUID,
    agent_name TEXT,
    agent_hierarchy_level INTEGER,
    sub_agent_id UUID,
    sub_agent_name TEXT,
    sub_agent_hierarchy_level INTEGER,
    
    -- Worker information
    worker_id UUID,
    worker_name TEXT,
    worker_hierarchy_level INTEGER,
    sub_worker_id UUID,
    sub_worker_name TEXT,
    sub_worker_hierarchy_level INTEGER,
    
    -- Assignment information
    assigned_by UUID,
    assigned_by_name TEXT,
    assigned_at TIMESTAMP WITHOUT TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    where_clause TEXT := '';
    query_text TEXT;
BEGIN
    -- Build WHERE clause based on user role and permissions
    IF user_role_param IS NOT NULL AND user_id_param IS NOT NULL THEN
        CASE user_role_param
            WHEN 'super_agent' THEN
                where_clause := ''; -- Super agents see all projects
            WHEN 'agent' THEN
                where_clause := 'WHERE (p.agent_id = ''' || user_id_param || ''' OR p.sub_agent_id = ''' || user_id_param || ''')';
            WHEN 'super_worker' THEN
                where_clause := 'WHERE p.sub_worker_id = ''' || user_id_param || '''';
            WHEN 'worker' THEN
                where_clause := 'WHERE (p.worker_id = ''' || user_id_param || ''' OR p.sub_worker_id = ''' || user_id_param || ''')';
            WHEN 'client' THEN
                where_clause := 'WHERE p.client_id = ''' || user_id_param || '''';
        END CASE;
    END IF;
    
    query_text := '
    SELECT 
        p.id,
        p.title,
        p.description,
        p.status,
        p.cost_gbp,
        p.project_numbers,
        
        -- Client information
        p.client_id,
        client.full_name,
        client_h.hierarchy_level,
        
        -- Agent information
        p.agent_id,
        agent.full_name,
        agent_h.hierarchy_level,
        p.sub_agent_id,
        sub_agent.full_name,
        sub_agent_h.hierarchy_level,
        
        -- Worker information
        p.worker_id,
        worker.full_name,
        worker_h.hierarchy_level,
        p.sub_worker_id,
        sub_worker.full_name,
        sub_worker_h.hierarchy_level,
        
        -- Assignment information
        p.assigned_by,
        assigned_by.full_name,
        p.assigned_at::TIMESTAMP WITHOUT TIME ZONE,
        
        -- Timestamps
        p.created_at,
        p.updated_at
    FROM projects p
    LEFT JOIN users client ON p.client_id = client.id
    LEFT JOIN user_hierarchy client_h ON p.client_id = client_h.user_id
    LEFT JOIN users agent ON p.agent_id = agent.id
    LEFT JOIN user_hierarchy agent_h ON p.agent_id = agent_h.user_id
    LEFT JOIN users sub_agent ON p.sub_agent_id = sub_agent.id
    LEFT JOIN user_hierarchy sub_agent_h ON p.sub_agent_id = sub_agent_h.user_id
    LEFT JOIN users worker ON p.worker_id = worker.id
    LEFT JOIN user_hierarchy worker_h ON p.worker_id = worker_h.user_id
    LEFT JOIN users sub_worker ON p.sub_worker_id = sub_worker.id
    LEFT JOIN user_hierarchy sub_worker_h ON p.sub_worker_id = sub_worker_h.user_id
    LEFT JOIN users assigned_by ON p.assigned_by = assigned_by.id
    ' || where_clause || '
    ORDER BY p.created_at DESC
    LIMIT ' || limit_param || ' OFFSET ' || offset_param;
    
    RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_projects_with_hierarchy IS 'Returns projects with complete hierarchy information, filtered by user role and permissions';

COMMIT;