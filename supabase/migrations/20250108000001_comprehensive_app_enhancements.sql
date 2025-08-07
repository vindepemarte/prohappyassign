-- Comprehensive App Enhancement Database Schema Updates
-- This migration adds new project statuses, order reference system, deadline charges, and notification tracking

-- 1. Update project_status enum to include new statuses
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add new columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS order_reference VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS deadline_charge DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'normal';

-- 3. Create deadline_extension_requests table
CREATE TABLE IF NOT EXISTS deadline_extension_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create notification_history table for tracking notification delivery
CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    is_read BOOLEAN DEFAULT FALSE
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_order_reference ON projects(order_reference);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_project_id ON deadline_extension_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_worker_id ON deadline_extension_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_project_id ON notification_history(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON notification_history(delivery_status);

-- 6. Add updated_at trigger for deadline_extension_requests
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deadline_extension_requests_updated_at 
    BEFORE UPDATE ON deadline_extension_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Add constraint to ensure urgency_level has valid values (only if it doesn't exist)
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

-- 8. Update existing projects to have order references (will be handled by the utility function)
-- This will be populated by the OrderReferenceGenerator utility when the application starts

-- 9. Add comments for documentation
COMMENT ON COLUMN projects.order_reference IS 'Unique order reference number in format ORD-YYYY-MM-XXXXXX';
COMMENT ON COLUMN projects.deadline_charge IS 'Additional charge based on deadline urgency in GBP';
COMMENT ON COLUMN projects.urgency_level IS 'Urgency level based on deadline: normal, moderate, urgent, rush';
COMMENT ON TABLE deadline_extension_requests IS 'Worker requests for deadline extensions';
COMMENT ON TABLE notification_history IS 'Tracking table for notification delivery and retry attempts';

-- 10. Create SQL function for incrementing notification retry count
CREATE OR REPLACE FUNCTION increment_notification_retry(notification_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE notification_history 
    SET retry_count = retry_count + 1 
    WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Add adjustment_type column to projects table for tracking adjustment types
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(20) CHECK (adjustment_type IN ('word_count', 'deadline'));

-- 12. Create project_notes table for additional project information
CREATE TABLE IF NOT EXISTS project_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_author_id ON project_notes(author_id);

COMMENT ON TABLE project_notes IS 'Additional notes and comments for projects';