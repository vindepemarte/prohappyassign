-- Migration: Add Hierarchy Change Log Table
-- Description: Create table to track hierarchy changes for audit purposes
-- Date: 2025-12-08

BEGIN;

-- Create hierarchy_change_log table
CREATE TABLE IF NOT EXISTS hierarchy_change_log (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hierarchy_change_log_user_id ON hierarchy_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_change_log_changed_by ON hierarchy_change_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_hierarchy_change_log_created_at ON hierarchy_change_log(created_at);

-- Add trigger to automatically populate hierarchy levels
CREATE OR REPLACE FUNCTION populate_hierarchy_change_levels()
RETURNS TRIGGER AS $$
BEGIN
    -- Get old hierarchy level
    IF NEW.old_parent_id IS NOT NULL THEN
        SELECT hierarchy_level INTO NEW.old_hierarchy_level
        FROM user_hierarchy 
        WHERE user_id = NEW.user_id;
    END IF;
    
    -- Get new hierarchy level (parent level + 1)
    IF NEW.new_parent_id IS NOT NULL THEN
        SELECT hierarchy_level + 1 INTO NEW.new_hierarchy_level
        FROM user_hierarchy 
        WHERE user_id = NEW.new_parent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS populate_hierarchy_change_levels_trigger ON hierarchy_change_log;
CREATE TRIGGER populate_hierarchy_change_levels_trigger
    BEFORE INSERT ON hierarchy_change_log
    FOR EACH ROW EXECUTE FUNCTION populate_hierarchy_change_levels();

-- Add comment for documentation
COMMENT ON TABLE hierarchy_change_log IS 'Tracks all hierarchy changes for audit and compliance purposes';

COMMIT;