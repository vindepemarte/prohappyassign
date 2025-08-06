-- Fix Notifications and Projects Issues
-- Run this in Supabase SQL Editor

-- 1. Add missing is_read column to notification_history table
DO $$
BEGIN
    -- Check if is_read column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_history' 
        AND column_name = 'is_read'
    ) THEN
        ALTER TABLE notification_history ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_read column to notification_history table';
    ELSE
        RAISE NOTICE 'is_read column already exists in notification_history table';
    END IF;
END $$;

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

-- 5. Add unique constraint to push_subscriptions if it doesn't exist
DO $$
BEGIN
    -- Check if the unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'push_subscriptions' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'push_subscriptions_user_endpoint_unique'
    ) THEN
        -- Create a unique index instead of constraint due to JSON expression
        CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_unique 
        ON push_subscriptions (user_id, (subscription->>'endpoint'));
        RAISE NOTICE 'Added unique index on push_subscriptions (user_id, endpoint)';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on push_subscriptions';
    END IF;
END $$;

-- 6. Create indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- 7. Enable RLS (Row Level Security) for notification_history if not already enabled
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS for notification_history';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'RLS already enabled for notification_history or error: %', SQLERRM;
END $$;

-- 8. Create RLS policies for notification_history
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notification_history;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON notification_history;
    DROP POLICY IF EXISTS "Service role can insert notifications" ON notification_history;
    
    -- Create new policies
    CREATE POLICY "Users can view their own notifications" ON notification_history
        FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own notifications" ON notification_history
        FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Service role can insert notifications" ON notification_history
        FOR INSERT WITH CHECK (true);
    
    RAISE NOTICE 'Created RLS policies for notification_history';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating RLS policies for notification_history: %', SQLERRM;
END $$;

-- 9. Enable RLS for push_subscriptions if not already enabled
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS for push_subscriptions';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'RLS already enabled for push_subscriptions or error: %', SQLERRM;
END $$;

-- 10. Create RLS policies for push_subscriptions
DO $$
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
    
    -- Create new policy
    CREATE POLICY "Users can manage their own subscriptions" ON push_subscriptions
        FOR ALL USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created RLS policies for push_subscriptions';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating RLS policies for push_subscriptions: %', SQLERRM;
END $$;

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