-- Add missing enum values to project_status if they don't exist
-- This migration only adds what's actually missing from your existing schema

DO $$
BEGIN
    -- Check if 'refund' value exists in project_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'refund' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'refund';
        RAISE NOTICE 'Added "refund" value to project_status enum';
    ELSE
        RAISE NOTICE '"refund" value already exists in project_status enum';
    END IF;
    
    -- Check if 'cancelled' value exists in project_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'cancelled' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'cancelled';
        RAISE NOTICE 'Added "cancelled" value to project_status enum';
    ELSE
        RAISE NOTICE '"cancelled" value already exists in project_status enum';
    END IF;
END $$;

-- Create or replace utility functions that might be missing
CREATE OR REPLACE FUNCTION increment_notification_retry(notification_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE notification_history 
    SET retry_count = retry_count + 1 
    WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists for deadline_extension_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_deadline_extension_requests_updated_at'
        AND event_object_table = 'deadline_extension_requests'
    ) THEN
        CREATE TRIGGER update_deadline_extension_requests_updated_at 
            BEFORE UPDATE ON deadline_extension_requests 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger for deadline_extension_requests updated_at';
    ELSE
        RAISE NOTICE 'Trigger for deadline_extension_requests updated_at already exists';
    END IF;
END $$;

-- Add any missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_is_read ON notification_history(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at);

-- Add helpful comments
COMMENT ON COLUMN projects.adjustment_type IS 'Type of adjustment requested: word_count or deadline';
COMMENT ON COLUMN notification_history.is_read IS 'Whether the notification has been read by the user';
COMMENT ON FUNCTION increment_notification_retry(BIGINT) IS 'Utility function to increment notification retry count';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully. All missing enum values and utilities have been added.';
END $$;