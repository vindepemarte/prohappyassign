-- Create Dummy Data for Testing
-- This script creates users, projects, and related data for testing purposes

-- 1. Create dummy users with authentication
-- Note: This assumes you're using Supabase Auth. You'll need to create these users in the Auth panel first,
-- then this script will create the corresponding profile records.

-- Insert dummy users (clients)
INSERT INTO users (id, full_name, role) VALUES
-- Clients
(gen_random_uuid(), 'Client User 1', 'client'),
(gen_random_uuid(), 'Client User 2', 'client'),
(gen_random_uuid(), 'Client User 3', 'client'),
(gen_random_uuid(), 'Client User 4', 'client'),
(gen_random_uuid(), 'Client User 5', 'client'),

-- Workers  
(gen_random_uuid(), 'Worker User 1', 'worker'),
(gen_random_uuid(), 'Worker User 2', 'worker'),
(gen_random_uuid(), 'Worker User 3', 'worker'),
(gen_random_uuid(), 'Worker User 4', 'worker'),
(gen_random_uuid(), 'Worker User 5', 'worker'),

-- Agents
(gen_random_uuid(), 'Agent User 1', 'agent'),
(gen_random_uuid(), 'Agent User 2', 'agent'),
(gen_random_uuid(), 'Agent User 3', 'agent')

ON CONFLICT (id) DO NOTHING;

-- 2. Create dummy projects with various statuses
WITH user_data AS (
  SELECT 
    id,
    full_name,
    role,
    ROW_NUMBER() OVER (PARTITION BY role ORDER BY full_name) as rn
  FROM users
),
clients AS (SELECT id, rn FROM user_data WHERE role = 'client'),
workers AS (SELECT id, rn FROM user_data WHERE role = 'worker'),
agents AS (SELECT id, rn FROM user_data WHERE role = 'agent')

INSERT INTO projects (
  client_id, 
  worker_id, 
  agent_id, 
  title, 
  description, 
  status, 
  initial_word_count, 
  adjusted_word_count,
  cost_gbp, 
  deadline, 
  order_reference,
  deadline_charge,
  urgency_level,
  adjustment_type
) 
SELECT 
  c.id as client_id,
  CASE 
    WHEN p.status IN ('in_progress', 'pending_final_approval', 'needs_changes', 'completed') 
    THEN w.id 
    ELSE NULL 
  END as worker_id,
  a.id as agent_id,
  p.title,
  p.description,
  p.status::project_status,
  p.initial_word_count,
  p.adjusted_word_count,
  p.cost_gbp,
  p.deadline,
  p.order_reference,
  p.deadline_charge,
  p.urgency_level::urgency_level,
  p.adjustment_type
FROM (
  VALUES 
    -- Projects with different statuses
    ('pending_payment_approval', 'SEO Article Writing', 'Write a comprehensive SEO article about digital marketing trends', 1000, NULL, 150.00, DATE '2025-01-15', 'ORD-2025-01-000001', 0.00, 'normal', NULL),
    ('awaiting_worker_assignment', 'Blog Post Series', 'Create a 5-part blog series on sustainable living', 2500, NULL, 375.00, DATE '2025-01-20', 'ORD-2025-01-000002', 25.00, 'moderate', NULL),
    ('in_progress', 'Product Description', 'Write compelling product descriptions for e-commerce site', 800, NULL, 120.00, DATE '2025-01-12', 'ORD-2025-01-000003', 50.00, 'urgent', NULL),
    ('pending_quote_approval', 'Technical Documentation', 'Create user manual for software application', 1500, 2000, 225.00, DATE '2025-01-25', 'ORD-2025-01-000004', 0.00, 'normal', 'word_count'),
    ('needs_changes', 'Website Content', 'Write content for company website pages', 1200, NULL, 180.00, DATE '2025-01-18', 'ORD-2025-01-000005', 15.00, 'moderate', NULL),
    ('pending_final_approval', 'Press Release', 'Draft press release for product launch', 600, NULL, 90.00, DATE '2025-01-10', 'ORD-2025-01-000006', 75.00, 'rush', NULL),
    ('completed', 'Social Media Content', 'Create social media posts for marketing campaign', 500, NULL, 75.00, DATE '2025-01-08', 'ORD-2025-01-000007', 100.00, 'rush', NULL),
    ('pending_quote_approval', 'Research Article', 'Write research-based article on climate change', 3000, 2500, 450.00, DATE '2025-01-30', 'ORD-2025-01-000008', 0.00, 'normal', 'deadline'),
    ('refund', 'Newsletter Content', 'Write monthly newsletter content', 800, NULL, 120.00, DATE '2025-01-14', 'ORD-2025-01-000009', 30.00, 'moderate', NULL),
    ('cancelled', 'Case Study', 'Write detailed case study for client success story', 1800, NULL, 270.00, DATE '2025-01-22', 'ORD-2025-01-000010', 10.00, 'normal', NULL),
    ('in_progress', 'Email Campaign', 'Create email marketing campaign content', 1000, 1200, 150.00, DATE '2025-01-16', 'ORD-2025-01-000011', 20.00, 'moderate', 'word_count'),
    ('pending_payment_approval', 'Landing Page Copy', 'Write conversion-focused landing page copy', 700, NULL, 105.00, DATE '2025-01-13', 'ORD-2025-01-000012', 40.00, 'urgent', NULL)
) AS p(status, title, description, initial_word_count, adjusted_word_count, cost_gbp, deadline, order_reference, deadline_charge, urgency_level, adjustment_type)
CROSS JOIN (SELECT id FROM clients WHERE rn = 1) c
CROSS JOIN (SELECT id FROM workers WHERE rn = 1) w  
CROSS JOIN (SELECT id FROM agents WHERE rn = 1) a;

-- 3. Create some project files
INSERT INTO project_files (project_id, uploader_id, file_name, file_path, purpose)
SELECT 
  p.id,
  p.client_id,
  'brief_' || p.id || '.pdf',
  'uploads/' || p.client_id || '/' || p.id || '/brief_' || p.id || '.pdf',
  'initial_brief'
FROM projects p
WHERE p.id <= 5;

-- 4. Create some change requests
INSERT INTO project_change_requests (project_id, instructions)
SELECT 
  p.id,
  'Please revise the tone to be more professional and add more technical details. Also, include more recent statistics and data points.'
FROM projects p
WHERE p.status = 'needs_changes';

-- 5. Create some deadline extension requests
INSERT INTO deadline_extension_requests (project_id, worker_id, requested_deadline, reason, status)
SELECT 
  p.id,
  p.worker_id,
  (p.deadline + INTERVAL '3 days')::timestamp with time zone,
  'Need additional time for research and fact-checking to ensure quality delivery.',
  'pending'
FROM projects p
WHERE p.worker_id IS NOT NULL AND p.status = 'in_progress'
LIMIT 2;

-- 6. Create some notification history
INSERT INTO notification_history (user_id, project_id, title, body, delivery_status, is_read)
SELECT 
  p.client_id,
  p.id,
  'Project Status Update',
  'Your project "' || p.title || '" status has been updated to ' || p.status,
  'delivered',
  CASE WHEN random() > 0.5 THEN true ELSE false END
FROM projects p
LIMIT 10;

-- 7. Create some project notes
INSERT INTO project_notes (project_id, author_id, note)
SELECT 
  p.id,
  (SELECT id FROM users WHERE role = 'agent' LIMIT 1),
  'Initial review completed. Project looks good and is ready for assignment to worker.'
FROM projects p
WHERE p.status IN ('awaiting_worker_assignment', 'in_progress')
LIMIT 3;

-- 8. Display summary of created data
DO $$
DECLARE
    user_count INTEGER;
    project_count INTEGER;
    file_count INTEGER;
    notification_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO project_count FROM projects;
    SELECT COUNT(*) INTO file_count FROM project_files;
    SELECT COUNT(*) INTO notification_count FROM notification_history;
    
    RAISE NOTICE '=== DUMMY DATA CREATION SUMMARY ===';
    RAISE NOTICE 'Users created: %', user_count;
    RAISE NOTICE 'Projects created: %', project_count;
    RAISE NOTICE 'Project files created: %', file_count;
    RAISE NOTICE 'Notifications created: %', notification_count;
    RAISE NOTICE '=== CREATION COMPLETED ===';
END $$;

-- 9. Show sample data for verification
SELECT 
    'USERS' as table_name,
    role,
    COUNT(*) as count
FROM users 
GROUP BY role
UNION ALL
SELECT 
    'PROJECTS' as table_name,
    status::text as role,
    COUNT(*) as count
FROM projects 
GROUP BY status
ORDER BY table_name, role;