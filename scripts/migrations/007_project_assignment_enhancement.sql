-- Migration: Project Assignment Enhancement
-- Description: Add project assignment tracking, history, and multiple project references
-- Date: 2025-12-08

BEGIN;

-- 1. Add project_numbers field to support multiple project references
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_numbers TEXT[], -- Array of project reference numbers
ADD COLUMN IF NOT EXISTS assignment_notes TEXT,   -- Notes about the assignment
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);

-- 2. Create project_assignment_history table
CREATE TABLE IF NOT EXISTS project_assignment_history (
    id SERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Assignment details
    assigned_to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to_role user_role NOT NULL,
    assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_role user_role NOT NULL,
    
    -- Assignment type (worker, sub_worker, agent, sub_agent)
    assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('worker', 'sub_worker', 'agent', 'sub_agent')),
    
    -- Previous assignment (for tracking changes)
    previous_assigned_to_id UUID REFERENCES users(id),
    previous_assignment_type VARCHAR(20),
    
    -- Assignment metadata
    assignment_reason TEXT,
    assignment_notes TEXT,
    hierarchy_level INTEGER,
    
    -- Timestamps
    assigned_at TIMESTAMP DEFAULT NOW(),
    effective_until TIMESTAMP, -- NULL for current assignment
    
    -- Validation status
    is_valid_hierarchy BOOLEAN DEFAULT true,
    validation_notes TEXT
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_project_numbers ON projects USING GIN(project_numbers);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_by ON projects(assigned_by);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_at ON projects(assigned_at);

CREATE INDEX IF NOT EXISTS idx_project_assignment_history_project_id ON project_assignment_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignment_history_assigned_to ON project_assignment_history(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_project_assignment_history_assigned_by ON project_assignment_history(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_project_assignment_history_assignment_type ON project_assignment_history(assignment_type);
CREATE INDEX IF NOT EXISTS idx_project_assignment_history_assigned_at ON project_assignment_history(assigned_at);
CREATE INDEX IF NOT EXISTS idx_project_assignment_history_effective_until ON project_assignment_history(effective_until);

-- 4. Create function to validate hierarchy-based assignments
CREATE OR REPLACE FUNCTION validate_project_assignment(
    assigner_id UUID,
    assigner_role user_role,
    assignee_id UUID,
    assignee_role user_role,
    assignment_type VARCHAR(20)
)
RETURNS TABLE(
    is_valid BOOLEAN,
    validation_message TEXT,
    hierarchy_level_diff INTEGER
) AS $$
DECLARE
    assigner_hierarchy_level INTEGER;
    assignee_hierarchy_level INTEGER;
    is_subordinate BOOLEAN := false;
BEGIN
    -- Get hierarchy levels
    SELECT hierarchy_level INTO assigner_hierarchy_level 
    FROM user_hierarchy WHERE user_id = assigner_id;
    
    SELECT hierarchy_level INTO assignee_hierarchy_level 
    FROM user_hierarchy WHERE user_id = assignee_id;
    
    -- Check if assignee is a subordinate of assigner
    SELECT EXISTS(
        SELECT 1 FROM get_user_subordinates(assigner_id) 
        WHERE subordinate_id = assignee_id
    ) INTO is_subordinate;
    
    -- Validation rules based on roles and hierarchy
    CASE 
        -- Super Agents can assign to anyone
        WHEN assigner_role = 'super_agent' THEN
            RETURN QUERY SELECT true, 'Super Agent can assign to any user', 
                               COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
        
        -- Agents can assign to their clients and workers in their hierarchy
        WHEN assigner_role = 'agent' THEN
            IF assignee_role IN ('client', 'worker') AND is_subordinate THEN
                RETURN QUERY SELECT true, 'Agent can assign to subordinate ' || assignee_role, 
                                   COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
            ELSE
                RETURN QUERY SELECT false, 'Agent can only assign to subordinate clients and workers', 
                                   COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
            END IF;
        
        -- Super Workers can assign to workers in their hierarchy
        WHEN assigner_role = 'super_worker' THEN
            IF assignee_role = 'worker' AND is_subordinate THEN
                RETURN QUERY SELECT true, 'Super Worker can assign to subordinate worker', 
                                   COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
            ELSE
                RETURN QUERY SELECT false, 'Super Worker can only assign to subordinate workers', 
                                   COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
            END IF;
        
        -- Workers and Clients cannot assign projects
        ELSE
            RETURN QUERY SELECT false, 'Role ' || assigner_role || ' cannot assign projects', 
                               COALESCE(assigner_hierarchy_level - assignee_hierarchy_level, 0);
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to track project assignments
CREATE OR REPLACE FUNCTION track_project_assignment(
    project_id_param BIGINT,
    assigned_to_id_param UUID,
    assignment_type_param VARCHAR(20),
    assigned_by_id_param UUID,
    assignment_reason_param TEXT DEFAULT NULL,
    assignment_notes_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    assigned_to_role_val user_role;
    assigned_by_role_val user_role;
    validation_result RECORD;
    hierarchy_level_val INTEGER;
    previous_assignment RECORD;
BEGIN
    -- Get user roles
    SELECT role INTO assigned_to_role_val FROM users WHERE id = assigned_to_id_param;
    SELECT role INTO assigned_by_role_val FROM users WHERE id = assigned_by_id_param;
    
    -- Get hierarchy level
    SELECT hierarchy_level INTO hierarchy_level_val 
    FROM user_hierarchy WHERE user_id = assigned_to_id_param;
    
    -- Validate the assignment
    SELECT * INTO validation_result 
    FROM validate_project_assignment(
        assigned_by_id_param, assigned_by_role_val, 
        assigned_to_id_param, assigned_to_role_val, 
        assignment_type_param
    );
    
    -- Get previous assignment if exists
    SELECT * INTO previous_assignment
    FROM project_assignment_history 
    WHERE project_id = project_id_param 
      AND assignment_type = assignment_type_param 
      AND effective_until IS NULL
    ORDER BY assigned_at DESC 
    LIMIT 1;
    
    -- Mark previous assignment as ended
    IF previous_assignment.id IS NOT NULL THEN
        UPDATE project_assignment_history 
        SET effective_until = NOW()
        WHERE id = previous_assignment.id;
    END IF;
    
    -- Create new assignment history record
    INSERT INTO project_assignment_history (
        project_id, assigned_to_id, assigned_to_role, assigned_by_id, assigned_by_role,
        assignment_type, previous_assigned_to_id, previous_assignment_type,
        assignment_reason, assignment_notes, hierarchy_level,
        is_valid_hierarchy, validation_notes
    ) VALUES (
        project_id_param, assigned_to_id_param, assigned_to_role_val, 
        assigned_by_id_param, assigned_by_role_val, assignment_type_param,
        previous_assignment.assigned_to_id, previous_assignment.assignment_type,
        assignment_reason_param, assignment_notes_param, hierarchy_level_val,
        validation_result.is_valid, validation_result.validation_message
    );
    
    -- Update the projects table based on assignment type
    CASE assignment_type_param
        WHEN 'worker' THEN
            UPDATE projects SET worker_id = assigned_to_id_param, assigned_by = assigned_by_id_param, assigned_at = NOW() WHERE id = project_id_param;
        WHEN 'sub_worker' THEN
            UPDATE projects SET sub_worker_id = assigned_to_id_param, assigned_by = assigned_by_id_param, assigned_at = NOW() WHERE id = project_id_param;
        WHEN 'agent' THEN
            UPDATE projects SET agent_id = assigned_to_id_param, assigned_by = assigned_by_id_param, assigned_at = NOW() WHERE id = project_id_param;
        WHEN 'sub_agent' THEN
            UPDATE projects SET sub_agent_id = assigned_to_id_param, assigned_by = assigned_by_id_param, assigned_at = NOW() WHERE id = project_id_param;
    END CASE;
    
    RETURN validation_result.is_valid;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get project assignment history
CREATE OR REPLACE FUNCTION get_project_assignment_history(project_id_param BIGINT)
RETURNS TABLE(
    assignment_id INTEGER,
    assignment_type VARCHAR(20),
    assigned_to_name TEXT,
    assigned_to_role user_role,
    assigned_by_name TEXT,
    assigned_by_role user_role,
    assignment_reason TEXT,
    assignment_notes TEXT,
    assigned_at TIMESTAMP,
    effective_until TIMESTAMP,
    is_valid_hierarchy BOOLEAN,
    validation_notes TEXT,
    hierarchy_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pah.id,
        pah.assignment_type,
        u_to.full_name,
        pah.assigned_to_role,
        u_by.full_name,
        pah.assigned_by_role,
        pah.assignment_reason,
        pah.assignment_notes,
        pah.assigned_at,
        pah.effective_until,
        pah.is_valid_hierarchy,
        pah.validation_notes,
        pah.hierarchy_level
    FROM project_assignment_history pah
    JOIN users u_to ON pah.assigned_to_id = u_to.id
    JOIN users u_by ON pah.assigned_by_id = u_by.id
    WHERE pah.project_id = project_id_param
    ORDER BY pah.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get projects with hierarchy information
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
    assigned_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP,
    updated_at TIMESTAMP
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
        p.assigned_at,
        
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

-- 8. Create trigger to automatically track assignments when projects table is updated
CREATE OR REPLACE FUNCTION auto_track_project_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Track worker assignment changes
    IF OLD.worker_id IS DISTINCT FROM NEW.worker_id AND NEW.worker_id IS NOT NULL THEN
        PERFORM track_project_assignment(
            NEW.id, NEW.worker_id, 'worker', 
            COALESCE(NEW.assigned_by, NEW.client_id), -- Default to client if no assigner
            'Automatic tracking from project update',
            NULL
        );
    END IF;
    
    -- Track sub_worker assignment changes
    IF OLD.sub_worker_id IS DISTINCT FROM NEW.sub_worker_id AND NEW.sub_worker_id IS NOT NULL THEN
        PERFORM track_project_assignment(
            NEW.id, NEW.sub_worker_id, 'sub_worker', 
            COALESCE(NEW.assigned_by, NEW.client_id),
            'Automatic tracking from project update',
            NULL
        );
    END IF;
    
    -- Track agent assignment changes
    IF OLD.agent_id IS DISTINCT FROM NEW.agent_id AND NEW.agent_id IS NOT NULL THEN
        PERFORM track_project_assignment(
            NEW.id, NEW.agent_id, 'agent', 
            COALESCE(NEW.assigned_by, NEW.client_id),
            'Automatic tracking from project update',
            NULL
        );
    END IF;
    
    -- Track sub_agent assignment changes
    IF OLD.sub_agent_id IS DISTINCT FROM NEW.sub_agent_id AND NEW.sub_agent_id IS NOT NULL THEN
        PERFORM track_project_assignment(
            NEW.id, NEW.sub_agent_id, 'sub_agent', 
            COALESCE(NEW.assigned_by, NEW.client_id),
            'Automatic tracking from project update',
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_track_project_assignment_trigger ON projects;
CREATE TRIGGER auto_track_project_assignment_trigger
    AFTER UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION auto_track_project_assignment();

-- 9. Add comments for documentation
COMMENT ON TABLE project_assignment_history IS 'Tracks all project assignment changes with hierarchy validation';
COMMENT ON FUNCTION validate_project_assignment IS 'Validates project assignments based on user hierarchy and roles';
COMMENT ON FUNCTION track_project_assignment IS 'Creates assignment history record and updates project table';
COMMENT ON FUNCTION get_project_assignment_history IS 'Returns complete assignment history for a project';
COMMENT ON FUNCTION get_projects_with_hierarchy IS 'Returns projects with complete hierarchy information';

COMMIT;