-- Fix Notifications and Projects Issues
-- Run this in Supabase SQL Editor

-- 1. Ensure notification_history table has proper structure
CREATE TABLE IF NOT EXISTS notification_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    delivery_status TEXT DEFAULT 'sent',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_is_read ON notification_history(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at DESC);

-- 3. Ensure projects table has proper order_reference constraint
-- First, let's check if there are any duplicate order references
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT order_reference, COUNT(*) as cnt
        FROM projects 
        WHERE order_reference IS NOT NULL
        GROUP BY order_reference
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate order references. Fixing...', duplicate_count;
        
        -- Update duplicate order references with unique values
        UPDATE projects 
        SET order_reference = 'ORD-' || EXTRACT(YEAR FROM created_at) || '-' || 
                             LPAD(EXTRACT(MONTH FROM created_at)::TEXT, 2, '0') || '-' || 
                             LPAD((EXTRACT(EPOCH FROM created_at)::BIGINT % 1000000)::TEXT, 6, '0')
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY order_reference ORDER BY created_at) as rn
                FROM projects 
                WHERE order_reference IS NOT NULL
            ) ranked
            WHERE rn > 1
        );
        
        RAISE NOTICE 'Fixed duplicate order references';
    ELSE
        RAISE NOTICE 'No duplicate order references found';
    END IF;
END $$;

-- 4. Ensure unique constraint exists on order_reference
DO $$
BEGIN
    -- Try to add the unique constraint
    ALTER TABLE projects ADD CONSTRAINT projects_order_reference_key UNIQUE (order_reference);
    RAISE NOTICE 'Added unique constraint on order_reference';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint on order_reference already exists';
    WHEN others THEN
        RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
END $$;

-- 5. Ensure push_subscriptions table exists
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, (subscription->>'endpoint'))
);

-- 6. Create indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- 7. Enable RLS (Row Level Security) for notification_history
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for notification_history
DROP POLICY IF EXISTS "Users can view their own notifications" ON notification_history;
CREATE POLICY "Users can view their own notifications" ON notification_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notification_history;
CREATE POLICY "Users can update their own notifications" ON notification_history
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert notifications" ON notification_history;
CREATE POLICY "Service role can insert notifications" ON notification_history
    FOR INSERT WITH CHECK (true);

-- 9. Enable RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- 11. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON notification_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT USAGE ON SEQUENCE notification_history_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE push_subscriptions_id_seq TO authenticated;

-- 12. Create a function to clean up old notifications (optional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notification_history 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND is_read = true;
END;
$$ LANGUAGE plpgsql;

-- 13. Verify the setup
DO $$
DECLARE
    notification_count INTEGER;
    subscription_count INTEGER;
    project_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO notification_count FROM notification_history;
    SELECT COUNT(*) INTO subscription_count FROM push_subscriptions;
    SELECT COUNT(*) INTO project_count FROM projects WHERE order_reference IS NOT NULL;
    
    RAISE NOTICE 'Setup verification:';
    RAISE NOTICE '- Notifications in history: %', notification_count;
    RAISE NOTICE '- Push subscriptions: %', subscription_count;
    RAISE NOTICE '- Projects with order references: %', project_count;
    RAISE NOTICE 'Database setup completed successfully!';
END $$;