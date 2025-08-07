-- Database Status Check Script
-- Run this in Supabase SQL Editor to check what's missing

-- 1. Check project_status enum values
SELECT 
    'project_status enum values' as check_type,
    enumlabel as value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
ORDER BY enumlabel;

-- 2. Check if required columns exist in projects table
SELECT 
    'projects table columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('order_reference', 'deadline_charge', 'urgency_level', 'adjustment_type')
ORDER BY column_name;

-- 3. Check if required tables exist
SELECT 
    'required tables' as check_type,
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM (
    VALUES 
        ('projects'),
        ('users'),
        ('deadline_extension_requests'),
        ('notification_history'),
        ('project_notes'),
        ('project_change_requests'),
        ('project_files')
) AS required_tables(table_name);

-- 4. Check indexes
SELECT 
    'indexes' as check_type,
    indexname,
    tablename
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 5. Check functions
SELECT 
    'functions' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_updated_at_column', 'increment_notification_retry');

-- 6. Check triggers
SELECT 
    'triggers' as check_type,
    trigger_name,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public';