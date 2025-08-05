-- Database Migration Verification Script
-- Run this AFTER running database_migration.sql to verify everything was created correctly

-- 1. Check if new enum types were created
SELECT typname FROM pg_type WHERE typname IN ('urgency_level', 'extension_status', 'delivery_status');

-- 2. Check if new project statuses were added
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status') ORDER BY enumlabel;

-- 3. Check if new columns were added to projects table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('order_reference', 'deadline_charge', 'urgency_level');

-- 4. Check if new tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('deadline_extension_requests', 'notification_history') 
AND table_schema = 'public';

-- 5. Check if indexes were created
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('projects', 'deadline_extension_requests', 'notification_history')
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Check if RLS policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('deadline_extension_requests', 'notification_history')
ORDER BY tablename, policyname;

-- 7. Check if any existing projects got order references
SELECT COUNT(*) as total_projects, 
       COUNT(order_reference) as projects_with_order_ref,
       COUNT(*) - COUNT(order_reference) as projects_without_order_ref
FROM projects;

-- 8. Sample of generated order references (if any)
SELECT id, title, order_reference, created_at 
FROM projects 
WHERE order_reference IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;

-- Expected Results:
-- 1. Should return 3 rows: urgency_level, extension_status, delivery_status
-- 2. Should include 'refund' and 'cancelled' in the list
-- 3. Should return 3 rows with the new columns
-- 4. Should return 2 rows: deadline_extension_requests, notification_history
-- 5. Should show multiple indexes for performance
-- 6. Should show RLS policies for the new tables
-- 7. Should show that all projects have order references
-- 8. Should show sample order references in ORD-YYYY-MM-XXXXXX format