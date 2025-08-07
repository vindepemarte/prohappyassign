-- Fix existing schema - only add missing elements
-- This migration works with the existing database structure

-- 1. Only add missing enum values if they don't exist
DO $$
BEGIN
    -- Check if 'refund' value exists in project_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'refund' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'refund';
    END IF;
    
    -- Check if 'cancelled' value exists in project_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'cancelled' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'cancelled';
    END IF;
END $$;

-- 2. Add missing columns to projects table if they don't exist
DO $$
BEGIN
    -- Check if order_reference column exists (it already does based on your schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'order_reference'
    ) THEN
        ALTER TABLE projects ADD COLUMN order_reference VARCHAR(20) UNIQUE;
    END IF;
    
    -- Check if deadline_charge column exists (it already does)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'deadline_charge'
    ) THEN
        ALTER TABLE projects ADD COLUMN deadline_charge DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    -- Check if urgency_level column exists (it already does)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'urgency_level'
    ) THEN
        ALTER TABLE projects ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'normal';
    END IF;
    
    -- Check if adjustment_type column exists (it already does)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'adjustment_type'
    ) THEN
        ALTER TABLE projects ADD COLUMN adjustment_type VARCHAR(20) CHECK (adjustment_type IN ('word_count', 'deadline'));
    END IF;
END $$;

-- 3. Create missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_projects_order_reference ON projects(order_reference);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_project_id ON deadline_extension_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_worker_id ON deadline_extension_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_project_id ON notification_history(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON notification_history(delivery_status);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_author_id ON project_notes(author_id);

-- 4. Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Create trigger for deadline_extension_requests if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_deadline_extension_requests_updated_at'
    ) THEN
        CREATE TRIGGER update_deadline_extension_requests_updated_at 
            BEFORE UPDATE ON deadline_extension_requests 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 6. Create or replace the notification retry function
CREATE OR REPLACE FUNCTION increment_notification_retry(notification_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE notification_history 
    SET retry_count = retry_count + 1 
    WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Add constraint for urgency_level if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_urgency_level' 
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE projects 
        ADD CONSTRAINT check_urgency_level 
        CHECK (urgency_level IN ('normal', 'moderate', 'urgent', 'rush'));
    END IF;
END $$;

-- 8. Add comments for documentation
COMMENT ON COLUMN projects.order_reference IS 'Unique order reference number in format ORD-YYYY-MM-XXXXXX';
COMMENT ON COLUMN projects.deadline_charge IS 'Additional charge based on deadline urgency in GBP';
COMMENT ON COLUMN projects.urgency_level IS 'Urgency level based on deadline: normal, moderate, urgent, rush';
COMMENT ON COLUMN projects.adjustment_type IS 'Type of adjustment requested: word_count or deadline';
COMMENT ON TABLE deadline_extension_requests IS 'Worker requests for deadline extensions';
COMMENT ON TABLE notification_history IS 'Tracking table for notification delivery and retry attempts';
COMMENT ON TABLE project_notes IS 'Additional notes and comments for projects';

-- 9. Ensure all tables have proper permissions (if needed)
-- This section can be customized based on your RLS policies