-- Simple Database Fix for Notifications and Projects
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

-- 3. Fix any duplicate order references in projects table
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
                             LPAD((EXTRACT(EPOCH FROM created_at)::BIGINT % 1000000)::TEXT, 6, '0') || '-' || id
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

-- 4. Create indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- 5. Add unique index for push subscriptions to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_unique 
ON push_subscriptions (user_id, (subscription->>'endpoint'));

-- 6. Update all existing notifications to be unread by default
UPDATE notification_history 
SET is_read = FALSE 
WHERE is_read IS NULL;

-- 7. Verify the setup
DO $$
DECLARE
    notification_count INTEGER;
    subscription_count INTEGER;
    project_count INTEGER;
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO notification_count FROM notification_history;
    SELECT COUNT(*) INTO subscription_count FROM push_subscriptions;
    SELECT COUNT(*) INTO project_count FROM projects WHERE order_reference IS NOT NULL;
    SELECT COUNT(*) INTO unread_count FROM notification_history WHERE is_read = FALSE;
    
    RAISE NOTICE 'Setup verification:';
    RAISE NOTICE '- Total notifications: %', notification_count;
    RAISE NOTICE '- Unread notifications: %', unread_count;
    RAISE NOTICE '- Push subscriptions: %', subscription_count;
    RAISE NOTICE '- Projects with order references: %', project_count;
    RAISE NOTICE 'Database setup completed successfully!';
END $$;