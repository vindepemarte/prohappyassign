-- Comprehensive App Enhancement Database Migration Script
-- Run this in your Supabase SQL Editor

-- 1. First, create the urgency_level enum type
CREATE TYPE urgency_level AS ENUM ('normal', 'moderate', 'urgent', 'rush');

-- 2. Create the extension_status enum type
CREATE TYPE extension_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. Create the delivery_status enum type
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- 4. Update project_status enum to include new statuses
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 5. Add new columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS order_reference VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS deadline_charge DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS urgency_level urgency_level DEFAULT 'normal';

-- 6. Create deadline_extension_requests table
CREATE TABLE IF NOT EXISTS deadline_extension_requests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_deadline DATE NOT NULL,
    reason TEXT NOT NULL,
    status extension_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create notification_history table
CREATE TABLE IF NOT EXISTS notification_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    delivery_status delivery_status DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_order_reference ON projects(order_reference);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_project_id ON deadline_extension_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_deadline_extension_requests_worker_id ON deadline_extension_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_project_id ON notification_history(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON notification_history(delivery_status);

-- 9. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_deadline_extension_requests_updated_at ON deadline_extension_requests;
CREATE TRIGGER update_deadline_extension_requests_updated_at
    BEFORE UPDATE ON deadline_extension_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 11. Create RPC function for incrementing notification retry count
CREATE OR REPLACE FUNCTION increment_notification_retry(notification_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE notification_history 
    SET retry_count = retry_count + 1 
    WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Generate order references for existing projects (if any)
-- This will create unique order references for projects that don't have them
DO $$
DECLARE
    project_record RECORD;
    new_order_ref VARCHAR(20);
    counter INTEGER := 1;
BEGIN
    FOR project_record IN 
        SELECT id, created_at 
        FROM projects 
        WHERE order_reference IS NULL 
        ORDER BY created_at ASC
    LOOP
        new_order_ref := 'ORD-' || 
                        EXTRACT(YEAR FROM project_record.created_at) || '-' ||
                        LPAD(EXTRACT(MONTH FROM project_record.created_at)::TEXT, 2, '0') || '-' ||
                        LPAD(counter::TEXT, 6, '0');
        
        UPDATE projects 
        SET order_reference = new_order_ref 
        WHERE id = project_record.id;
        
        counter := counter + 1;
    END LOOP;
END $$;

-- 13. Add Row Level Security (RLS) policies for new tables
ALTER TABLE deadline_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for deadline_extension_requests
CREATE POLICY "Users can view their own deadline extension requests" ON deadline_extension_requests
    FOR SELECT USING (
        worker_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = deadline_extension_requests.project_id 
            AND (p.client_id = auth.uid() OR p.agent_id = auth.uid())
        )
    );

CREATE POLICY "Workers can create deadline extension requests" ON deadline_extension_requests
    FOR INSERT WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Agents can update deadline extension requests" ON deadline_extension_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = deadline_extension_requests.project_id 
            AND p.agent_id = auth.uid()
        )
    );

-- RLS policies for notification_history
CREATE POLICY "Users can view their own notification history" ON notification_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert notification history" ON notification_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update notification history" ON notification_history
    FOR UPDATE USING (true);

-- 14. Grant necessary permissions
GRANT ALL ON deadline_extension_requests TO authenticated;
GRANT ALL ON notification_history TO authenticated;
GRANT USAGE ON SEQUENCE deadline_extension_requests_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE notification_history_id_seq TO authenticated;

-- 15. Create view for project analytics (optional but useful)
CREATE OR REPLACE VIEW project_analytics AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    status,
    COUNT(*) as project_count,
    SUM(cost_gbp) as total_revenue,
    AVG(cost_gbp) as avg_project_value,
    COUNT(DISTINCT client_id) as unique_clients
FROM projects
GROUP BY DATE_TRUNC('month', created_at), status
ORDER BY month DESC, status;

-- Grant access to the view
GRANT SELECT ON project_analytics TO authenticated;

-- Verification queries (run these to check if everything was created correctly)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('order_reference', 'deadline_charge', 'urgency_level');
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('deadline_extension_requests', 'notification_history');
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('projects', 'deadline_extension_requests', 'notification_history');