-- Migration: Hierarchical Notification System
-- Description: Create notification tables and hierarchy-aware notification system
-- Date: 2025-12-08

BEGIN;

-- 1. Add missing columns to existing notification_history table
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER,
ADD COLUMN IF NOT EXISTS target_roles TEXT[],
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Add check constraints for new columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_history_notification_type_check') THEN
        ALTER TABLE notification_history 
        ADD CONSTRAINT notification_history_notification_type_check 
        CHECK (notification_type IN ('general', 'project_assignment', 'project_status_change', 'broadcast', 'hierarchy_notification', 'payment_notification', 'system_alert'));
    END IF;
END $$;

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    delivery_method VARCHAR(20) DEFAULT 'database' CHECK (delivery_method IN ('database', 'email', 'push')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, notification_type, delivery_method)
);

-- 3. Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) UNIQUE NOT NULL,
    title_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    target_roles TEXT[] NOT NULL,
    variables JSONB, -- Template variables and their descriptions
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sender_id ON notification_history(sender_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_project_id ON notification_history(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON notification_history(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notification_history_notification_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_hierarchy_level ON notification_history(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_notification_history_is_read ON notification_history(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON notification_preferences(notification_type);

CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(template_name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(notification_type);

-- 5. Add triggers for updated_at timestamps
DROP TRIGGER IF EXISTS update_notification_history_updated_at ON notification_history;
CREATE TRIGGER update_notification_history_updated_at 
    BEFORE UPDATE ON notification_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Insert default notification templates (with conflict handling)
INSERT INTO notification_templates (template_name, title_template, body_template, notification_type, target_roles, variables) VALUES
('super_agent_broadcast', 'System Announcement: {{title}}', '{{message}}', 'broadcast', ARRAY['client', 'worker', 'agent', 'super_worker'], '{"title": "Announcement title", "message": "Broadcast message"}'),
('project_assignment', 'New Project Assignment', 'You have been assigned to project: {{project_name}}. Please review the details and begin work.', 'project_assignment', ARRAY['worker', 'super_worker'], '{"project_name": "Name of the project"}'),
('project_status_change', 'Project Status Update', 'Project {{project_name}} status has been changed to {{new_status}}.', 'project_status_change', ARRAY['client', 'agent', 'super_agent'], '{"project_name": "Name of the project", "new_status": "New project status"}'),
('super_worker_assignment', 'Worker Assignment Notification', 'You have been assigned to work on project {{project_name}} by {{assigner_name}}.', 'hierarchy_notification', ARRAY['worker'], '{"project_name": "Name of the project", "assigner_name": "Name of the person who assigned"}'),
('payment_notification', 'Payment Update', 'Payment information has been updated for project {{project_name}}. Amount: {{amount}}.', 'payment_notification', ARRAY['agent', 'super_worker', 'worker'], '{"project_name": "Name of the project", "amount": "Payment amount"}'),
('hierarchy_welcome', 'Welcome to the Team', 'Welcome to the team! You have been added to the hierarchy under {{parent_name}}. Your role is {{role}}.', 'hierarchy_notification', ARRAY['client', 'worker', 'agent', 'super_worker'], '{"parent_name": "Name of the parent in hierarchy", "role": "User role"}')
ON CONFLICT (template_name) DO NOTHING;

-- 7. Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id, notification_type, enabled, delivery_method)
SELECT 
    u.id,
    nt.notification_type,
    true,
    'database'
FROM users u
CROSS JOIN (
    SELECT DISTINCT notification_type FROM notification_templates
) nt
ON CONFLICT (user_id, notification_type, delivery_method) DO NOTHING;

-- 8. Create function to get user's subordinates in hierarchy
CREATE OR REPLACE FUNCTION get_user_subordinates(user_uuid UUID)
RETURNS TABLE(subordinate_id UUID, subordinate_role user_role, hierarchy_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE subordinate_tree AS (
        -- Base case: direct subordinates
        SELECT 
            uh.user_id as subordinate_id,
            u.role as subordinate_role,
            uh.hierarchy_level
        FROM user_hierarchy uh
        JOIN users u ON uh.user_id = u.id
        WHERE uh.parent_id = user_uuid
        
        UNION ALL
        
        -- Recursive case: subordinates of subordinates
        SELECT 
            uh.user_id as subordinate_id,
            u.role as subordinate_role,
            uh.hierarchy_level
        FROM user_hierarchy uh
        JOIN users u ON uh.user_id = u.id
        JOIN subordinate_tree st ON uh.parent_id = st.subordinate_id
    )
    SELECT * FROM subordinate_tree;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to check if user can send notification to target
CREATE OR REPLACE FUNCTION can_send_notification(sender_uuid UUID, target_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    sender_role user_role;
    target_role user_role;
    is_subordinate BOOLEAN := false;
BEGIN
    -- Get sender and target roles
    SELECT role INTO sender_role FROM users WHERE id = sender_uuid;
    SELECT role INTO target_role FROM users WHERE id = target_uuid;
    
    -- Super agents can send to anyone
    IF sender_role = 'super_agent' THEN
        RETURN true;
    END IF;
    
    -- Check if target is a subordinate of sender
    SELECT EXISTS(
        SELECT 1 FROM get_user_subordinates(sender_uuid) 
        WHERE subordinate_id = target_uuid
    ) INTO is_subordinate;
    
    -- Super workers can send to their subordinates
    IF sender_role = 'super_worker' AND is_subordinate THEN
        RETURN true;
    END IF;
    
    -- Agents can send to their clients
    IF sender_role = 'agent' AND target_role = 'client' AND is_subordinate THEN
        RETURN true;
    END IF;
    
    -- Users can send to themselves (for system notifications)
    IF sender_uuid = target_uuid THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to send hierarchy-aware notification
CREATE OR REPLACE FUNCTION send_hierarchy_notification(
    sender_uuid UUID,
    target_uuids UUID[],
    notification_title VARCHAR(255),
    notification_body TEXT,
    notification_type VARCHAR(50) DEFAULT 'general',
    project_id_param INTEGER DEFAULT NULL
)
RETURNS TABLE(sent_to UUID, success BOOLEAN, error_message TEXT) AS $$
DECLARE
    target_uuid UUID;
    can_send BOOLEAN;
    sender_hierarchy_level INTEGER;
BEGIN
    -- Get sender's hierarchy level
    SELECT hierarchy_level INTO sender_hierarchy_level 
    FROM user_hierarchy 
    WHERE user_id = sender_uuid;
    
    -- Loop through each target
    FOREACH target_uuid IN ARRAY target_uuids
    LOOP
        -- Check if sender can send to this target
        SELECT can_send_notification(sender_uuid, target_uuid) INTO can_send;
        
        IF can_send THEN
            -- Insert notification
            INSERT INTO notification_history (
                user_id, sender_id, title, body, notification_type, 
                project_id, hierarchy_level, delivery_status
            ) VALUES (
                target_uuid, sender_uuid, notification_title, notification_body, 
                notification_type, project_id_param, sender_hierarchy_level, 'delivered'
            );
            
            RETURN QUERY SELECT target_uuid, true, NULL::TEXT;
        ELSE
            RETURN QUERY SELECT target_uuid, false, 'Permission denied: Cannot send notification to this user'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;