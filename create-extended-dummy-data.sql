-- Extended Dummy Data for Testing
-- This script creates comprehensive test data with users, projects across multiple months, and related data

-- 1. Create dummy users with authentication
-- Note: This assumes you're using Supabase Auth. You'll need to create these users in the Auth panel first,
-- then this script will create the corresponding profile records.

-- Insert dummy users (more comprehensive set)
INSERT INTO users (id, full_name, role) VALUES
-- Clients (15 clients)
(gen_random_uuid(), 'Alice Johnson', 'client'),
(gen_random_uuid(), 'Bob Smith', 'client'),
(gen_random_uuid(), 'Carol Davis', 'client'),
(gen_random_uuid(), 'David Wilson', 'client'),
(gen_random_uuid(), 'Emma Brown', 'client'),
(gen_random_uuid(), 'Frank Miller', 'client'),
(gen_random_uuid(), 'Grace Taylor', 'client'),
(gen_random_uuid(), 'Henry Anderson', 'client'),
(gen_random_uuid(), 'Ivy Martinez', 'client'),
(gen_random_uuid(), 'Jack Thompson', 'client'),
(gen_random_uuid(), 'Kate Garcia', 'client'),
(gen_random_uuid(), 'Liam Rodriguez', 'client'),
(gen_random_uuid(), 'Maya Patel', 'client'),
(gen_random_uuid(), 'Noah Williams', 'client'),
(gen_random_uuid(), 'Olivia Chen', 'client'),

-- Workers (10 workers)
(gen_random_uuid(), 'Alex Writer', 'worker'),
(gen_random_uuid(), 'Beth Content', 'worker'),
(gen_random_uuid(), 'Chris Editor', 'worker'),
(gen_random_uuid(), 'Dana Blogger', 'worker'),
(gen_random_uuid(), 'Ethan Copywriter', 'worker'),
(gen_random_uuid(), 'Fiona Journalist', 'worker'),
(gen_random_uuid(), 'George Scribe', 'worker'),
(gen_random_uuid(), 'Hannah Author', 'worker'),
(gen_random_uuid(), 'Ian Wordsmith', 'worker'),
(gen_random_uuid(), 'Julia Penman', 'worker'),

-- Agents (5 agents)
(gen_random_uuid(), 'Manager Alpha', 'agent'),
(gen_random_uuid(), 'Supervisor Beta', 'agent'),
(gen_random_uuid(), 'Director Gamma', 'agent'),
(gen_random_uuid(), 'Coordinator Delta', 'agent'),
(gen_random_uuid(), 'Administrator Epsilon', 'agent')

ON CONFLICT (id) DO NOTHING;

-- 2. Create dummy projects with various statuses across different months
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
  (SELECT id FROM clients WHERE rn = ((p.project_num - 1) % 15) + 1) as client_id,
  CASE 
    WHEN p.status IN ('in_progress', 'pending_final_approval', 'needs_changes', 'completed') 
    THEN (SELECT id FROM workers WHERE rn = ((p.project_num - 1) % 10) + 1)
    ELSE NULL 
  END as worker_id,
  (SELECT id FROM agents WHERE rn = ((p.project_num - 1) % 5) + 1) as agent_id,
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
    -- December 2024 Projects
    (1, 'pending_payment_approval', 'Holiday Marketing Campaign', 'Create festive marketing content for holiday season', 1200, NULL, 180.00, DATE '2024-12-15', 'ORD-2024-12-000001', 0.00, 'normal', NULL),
    (2, 'completed', 'Year-End Report', 'Comprehensive annual business report', 3500, NULL, 525.00, DATE '2024-12-20', 'ORD-2024-12-000002', 0.00, 'normal', NULL),
    (3, 'completed', 'Christmas Newsletter', 'Seasonal newsletter for customers', 800, NULL, 120.00, DATE '2024-12-22', 'ORD-2024-12-000003', 25.00, 'moderate', NULL),
    (4, 'cancelled', 'Product Launch Delay', 'Content for delayed product launch', 1500, NULL, 225.00, DATE '2024-12-28', 'ORD-2024-12-000004', 0.00, 'normal', NULL),
    (5, 'completed', 'Social Media Strategy', 'Q4 social media content strategy', 2000, NULL, 300.00, DATE '2024-12-30', 'ORD-2024-12-000005', 10.00, 'normal', NULL),

    -- January 2025 Projects
    (6, 'pending_payment_approval', 'SEO Article Writing', 'Write comprehensive SEO article about digital marketing trends', 1000, NULL, 150.00, DATE '2025-01-15', 'ORD-2025-01-000001', 0.00, 'normal', NULL),
    (7, 'awaiting_worker_assignment', 'Blog Post Series', 'Create 5-part blog series on sustainable living', 2500, NULL, 375.00, DATE '2025-01-20', 'ORD-2025-01-000002', 25.00, 'moderate', NULL),
    (8, 'in_progress', 'Product Description', 'Write compelling product descriptions for e-commerce site', 800, NULL, 120.00, DATE '2025-01-12', 'ORD-2025-01-000003', 50.00, 'urgent', NULL),
    (9, 'pending_quote_approval', 'Technical Documentation', 'Create user manual for software application', 1500, 2000, 300.00, DATE '2025-01-25', 'ORD-2025-01-000004', 0.00, 'normal', 'word_count'),
    (10, 'needs_changes', 'Website Content', 'Write content for company website pages', 1200, NULL, 180.00, DATE '2025-01-18', 'ORD-2025-01-000005', 15.00, 'moderate', NULL),
    (11, 'pending_final_approval', 'Press Release', 'Draft press release for product launch', 600, NULL, 90.00, DATE '2025-01-10', 'ORD-2025-01-000006', 75.00, 'rush', NULL),
    (12, 'completed', 'Social Media Content', 'Create social media posts for marketing campaign', 500, NULL, 75.00, DATE '2025-01-08', 'ORD-2025-01-000007', 100.00, 'rush', NULL),
    (13, 'pending_quote_approval', 'Research Article', 'Write research-based article on climate change', 3000, 2500, 375.00, DATE '2025-01-30', 'ORD-2025-01-000008', 0.00, 'normal', 'deadline'),
    (14, 'refund', 'Newsletter Content', 'Write monthly newsletter content', 800, NULL, 120.00, DATE '2025-01-14', 'ORD-2025-01-000009', 30.00, 'moderate', NULL),
    (15, 'cancelled', 'Case Study', 'Write detailed case study for client success story', 1800, NULL, 270.00, DATE '2025-01-22', 'ORD-2025-01-000010', 10.00, 'normal', NULL),

    -- February 2025 Projects
    (16, 'pending_payment_approval', 'Valentine Marketing', 'Romantic themed marketing content', 900, NULL, 135.00, DATE '2025-02-14', 'ORD-2025-02-000001', 50.00, 'urgent', NULL),
    (17, 'in_progress', 'Email Campaign', 'Create email marketing campaign content', 1000, 1200, 180.00, DATE '2025-02-16', 'ORD-2025-02-000002', 20.00, 'moderate', 'word_count'),
    (18, 'awaiting_worker_assignment', 'Landing Page Copy', 'Write conversion-focused landing page copy', 700, NULL, 105.00, DATE '2025-02-13', 'ORD-2025-02-000003', 40.00, 'urgent', NULL),
    (19, 'pending_final_approval', 'White Paper', 'Industry analysis white paper', 4000, NULL, 600.00, DATE '2025-02-28', 'ORD-2025-02-000004', 0.00, 'normal', NULL),
    (20, 'in_progress', 'Blog Content', 'Weekly blog posts for February', 1500, NULL, 225.00, DATE '2025-02-25', 'ORD-2025-02-000005', 15.00, 'moderate', NULL),
    (21, 'needs_changes', 'Product Reviews', 'Write detailed product review articles', 2200, NULL, 330.00, DATE '2025-02-20', 'ORD-2025-02-000006', 25.00, 'moderate', NULL),
    (22, 'pending_quote_approval', 'Training Manual', 'Employee training documentation', 2800, 3200, 480.00, DATE '2025-02-22', 'ORD-2025-02-000007', 0.00, 'normal', 'word_count'),

    -- March 2025 Projects
    (23, 'pending_payment_approval', 'Spring Campaign', 'Spring season marketing materials', 1100, NULL, 165.00, DATE '2025-03-15', 'ORD-2025-03-000001', 0.00, 'normal', NULL),
    (24, 'awaiting_worker_assignment', 'SEO Optimization', 'Website content optimization for SEO', 1800, NULL, 270.00, DATE '2025-03-20', 'ORD-2025-03-000002', 20.00, 'moderate', NULL),
    (25, 'in_progress', 'Case Studies', 'Multiple client success case studies', 2500, NULL, 375.00, DATE '2025-03-25', 'ORD-2025-03-000003', 0.00, 'normal', NULL),
    (26, 'pending_final_approval', 'Annual Report', 'Company annual report content', 5000, NULL, 750.00, DATE '2025-03-31', 'ORD-2025-03-000004', 0.00, 'normal', NULL),
    (27, 'needs_changes', 'Web Copy', 'Homepage and landing page copy', 1300, NULL, 195.00, DATE '2025-03-18', 'ORD-2025-03-000005', 30.00, 'moderate', NULL),
    (28, 'completed', 'Press Kit', 'Media press kit materials', 900, NULL, 135.00, DATE '2025-03-10', 'ORD-2025-03-000006', 60.00, 'urgent', NULL),

    -- April 2025 Projects
    (29, 'pending_payment_approval', 'Easter Promotion', 'Easter holiday promotional content', 750, NULL, 112.50, DATE '2025-04-15', 'ORD-2025-04-000001', 40.00, 'urgent', NULL),
    (30, 'awaiting_worker_assignment', 'Q2 Strategy', 'Second quarter business strategy document', 3200, NULL, 480.00, DATE '2025-04-30', 'ORD-2025-04-000002', 0.00, 'normal', NULL),
    (31, 'in_progress', 'Tutorial Series', 'How-to tutorial content series', 2000, NULL, 300.00, DATE '2025-04-25', 'ORD-2025-04-000003', 15.00, 'moderate', NULL),
    (32, 'pending_quote_approval', 'Market Research', 'Industry market research report', 4500, 5000, 750.00, DATE '2025-04-28', 'ORD-2025-04-000004', 0.00, 'normal', 'word_count'),
    (33, 'needs_changes', 'Product Descriptions', 'E-commerce product descriptions', 1600, NULL, 240.00, DATE '2025-04-20', 'ORD-2025-04-000005', 25.00, 'moderate', NULL),

    -- May 2025 Projects
    (34, 'pending_payment_approval', 'Mother Day Campaign', 'Mothers Day marketing content', 850, NULL, 127.50, DATE '2025-05-10', 'ORD-2025-05-000001', 45.00, 'urgent', NULL),
    (35, 'awaiting_worker_assignment', 'Summer Preview', 'Summer season content preview', 1400, NULL, 210.00, DATE '2025-05-25', 'ORD-2025-05-000002', 20.00, 'moderate', NULL),
    (36, 'in_progress', 'Newsletter Series', 'Monthly newsletter content', 1000, NULL, 150.00, DATE '2025-05-30', 'ORD-2025-05-000003', 0.00, 'normal', NULL),
    (37, 'pending_final_approval', 'Brand Guidelines', 'Company brand guideline document', 2800, NULL, 420.00, DATE '2025-05-28', 'ORD-2025-05-000004', 0.00, 'normal', NULL),
    (38, 'completed', 'Social Posts', 'May social media content calendar', 600, NULL, 90.00, DATE '2025-05-15', 'ORD-2025-05-000005', 35.00, 'moderate', NULL),

    -- June 2025 Projects
    (39, 'pending_payment_approval', 'Summer Launch', 'Summer product launch materials', 1900, NULL, 285.00, DATE '2025-06-15', 'ORD-2025-06-000001', 0.00, 'normal', NULL),
    (40, 'awaiting_worker_assignment', 'Mid-Year Review', 'Mid-year business review content', 2700, NULL, 405.00, DATE '2025-06-30', 'ORD-2025-06-000002', 0.00, 'normal', NULL),
    (41, 'in_progress', 'FAQ Content', 'Comprehensive FAQ section content', 1200, NULL, 180.00, DATE '2025-06-20', 'ORD-2025-06-000003', 25.00, 'moderate', NULL),
    (42, 'pending_quote_approval', 'User Manual', 'Product user manual and guides', 3500, 4000, 600.00, DATE '2025-06-25', 'ORD-2025-06-000004', 0.00, 'normal', 'word_count'),
    (43, 'needs_changes', 'Blog Redesign', 'Blog content for website redesign', 2100, NULL, 315.00, DATE '2025-06-22', 'ORD-2025-06-000005', 30.00, 'moderate', NULL),
    (44, 'refund', 'Cancelled Project', 'Project cancelled due to budget cuts', 1500, NULL, 225.00, DATE '2025-06-18', 'ORD-2025-06-000006', 20.00, 'moderate', NULL)

) AS p(project_num, status, title, description, initial_word_count, adjusted_word_count, cost_gbp, deadline, order_reference, deadline_charge, urgency_level, adjustment_type);

-- 3. Create project files for various projects
INSERT INTO project_files (project_id, uploader_id, file_name, file_path, purpose)
SELECT 
  p.id,
  p.client_id,
  CASE 
    WHEN p.id % 3 = 0 THEN 'requirements_' || p.id || '.docx'
    WHEN p.id % 3 = 1 THEN 'brief_' || p.id || '.pdf'
    ELSE 'guidelines_' || p.id || '.txt'
  END as file_name,
  'uploads/' || p.client_id || '/' || p.id || '/' || 
  CASE 
    WHEN p.id % 3 = 0 THEN 'requirements_' || p.id || '.docx'
    WHEN p.id % 3 = 1 THEN 'brief_' || p.id || '.pdf'
    ELSE 'guidelines_' || p.id || '.txt'
  END as file_path,
  'initial_brief'
FROM projects p
WHERE p.id <= 25;

-- 4. Create change requests for projects that need changes
INSERT INTO project_change_requests (project_id, instructions)
SELECT 
  p.id,
  CASE 
    WHEN p.id % 4 = 0 THEN 'Please revise the tone to be more professional and add more technical details. Also, include more recent statistics and data points.'
    WHEN p.id % 4 = 1 THEN 'The content needs to be more engaging and include more examples. Please also check for grammar and spelling errors.'
    WHEN p.id % 4 = 2 THEN 'Add more visual descriptions and make the content more accessible to a general audience. Include call-to-action elements.'
    ELSE 'Restructure the content with better headings and subheadings. Add more industry-specific terminology and references.'
  END as instructions
FROM projects p
WHERE p.status = 'needs_changes';

-- 5. Create deadline extension requests
INSERT INTO deadline_extension_requests (project_id, worker_id, requested_deadline, reason, status)
SELECT 
  p.id,
  p.worker_id,
  p.deadline + INTERVAL '5 days',
  CASE 
    WHEN p.id % 3 = 0 THEN 'Need additional time for research and fact-checking to ensure quality delivery.'
    WHEN p.id % 3 = 1 THEN 'Unexpected complexity in the project requires more time for proper completion.'
    ELSE 'Client provided additional requirements that need extra time to implement properly.'
  END as reason,
  CASE 
    WHEN p.id % 2 = 0 THEN 'pending'
    ELSE 'approved'
  END as status
FROM projects p
WHERE p.worker_id IS NOT NULL AND p.status IN ('in_progress', 'needs_changes')
LIMIT 8;

-- 6. Create comprehensive notification history
INSERT INTO notification_history (user_id, project_id, title, body, delivery_status, is_read)
SELECT 
  p.client_id,
  p.id,
  CASE 
    WHEN p.status = 'completed' THEN 'Project Completed'
    WHEN p.status = 'in_progress' THEN 'Work Started'
    WHEN p.status = 'needs_changes' THEN 'Changes Requested'
    WHEN p.status = 'pending_final_approval' THEN 'Ready for Review'
    ELSE 'Project Status Update'
  END as title,
  'Your project "' || p.title || '" status has been updated to ' || p.status || '. ' ||
  CASE 
    WHEN p.status = 'completed' THEN 'Thank you for choosing our services!'
    WHEN p.status = 'in_progress' THEN 'Our team is now working on your project.'
    WHEN p.status = 'needs_changes' THEN 'Please review the feedback and let us know if you have questions.'
    WHEN p.status = 'pending_final_approval' THEN 'Please review the completed work and provide your approval.'
    ELSE 'We will keep you updated on any further progress.'
  END as body,
  CASE 
    WHEN p.id % 4 = 0 THEN 'delivered'
    WHEN p.id % 4 = 1 THEN 'sent'
    WHEN p.id % 4 = 2 THEN 'pending'
    ELSE 'delivered'
  END as delivery_status,
  CASE WHEN random() > 0.3 THEN true ELSE false END as is_read
FROM projects p
LIMIT 30;

-- 7. Create project notes from agents
INSERT INTO project_notes (project_id, author_id, note)
SELECT 
  p.id,
  (SELECT id FROM users WHERE role = 'agent' ORDER BY random() LIMIT 1),
  CASE 
    WHEN p.status = 'awaiting_worker_assignment' THEN 'Project approved and ready for worker assignment. Client requirements are clear.'
    WHEN p.status = 'in_progress' THEN 'Worker assigned successfully. Monitoring progress and timeline adherence.'
    WHEN p.status = 'pending_final_approval' THEN 'Work completed by worker. Awaiting client final approval before marking as complete.'
    WHEN p.status = 'needs_changes' THEN 'Client has requested revisions. Communicated feedback to worker for implementation.'
    WHEN p.status = 'completed' THEN 'Project completed successfully. Client satisfied with deliverables.'
    ELSE 'Initial project review completed. All documentation in order.'
  END as note
FROM projects p
WHERE p.id <= 20;

-- 8. Create additional project notes for some projects
INSERT INTO project_notes (project_id, author_id, note)
SELECT 
  p.id,
  (SELECT id FROM users WHERE role = 'agent' ORDER BY random() LIMIT 1),
  CASE 
    WHEN p.urgency_level = 'rush' THEN 'HIGH PRIORITY: Rush delivery requested. Monitoring closely for on-time completion.'
    WHEN p.urgency_level = 'urgent' THEN 'URGENT: Expedited timeline. Ensured worker availability and resources.'
    WHEN p.adjustment_type = 'word_count' THEN 'Word count adjustment approved by client. Updated pricing reflected in system.'
    WHEN p.adjustment_type = 'deadline' THEN 'Deadline adjustment requested by worker. Awaiting client approval for new timeline.'
    ELSE 'Standard project processing. No special requirements or concerns noted.'
  END as note
FROM projects p
WHERE p.urgency_level IN ('rush', 'urgent') OR p.adjustment_type IS NOT NULL;

-- 9. Display comprehensive summary of created data
DO $$
DECLARE
    user_count INTEGER;
    client_count INTEGER;
    worker_count INTEGER;
    agent_count INTEGER;
    project_count INTEGER;
    file_count INTEGER;
    notification_count INTEGER;
    note_count INTEGER;
    extension_count INTEGER;
    change_request_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO client_count FROM users WHERE role = 'client';
    SELECT COUNT(*) INTO worker_count FROM users WHERE role = 'worker';
    SELECT COUNT(*) INTO agent_count FROM users WHERE role = 'agent';
    SELECT COUNT(*) INTO project_count FROM projects;
    SELECT COUNT(*) INTO file_count FROM project_files;
    SELECT COUNT(*) INTO notification_count FROM notification_history;
    SELECT COUNT(*) INTO note_count FROM project_notes;
    SELECT COUNT(*) INTO extension_count FROM deadline_extension_requests;
    SELECT COUNT(*) INTO change_request_count FROM project_change_requests;
    
    RAISE NOTICE '=== EXTENDED DUMMY DATA CREATION SUMMARY ===';
    RAISE NOTICE 'Total Users: % (Clients: %, Workers: %, Agents: %)', user_count, client_count, worker_count, agent_count;
    RAISE NOTICE 'Projects created: %', project_count;
    RAISE NOTICE 'Project files: %', file_count;
    RAISE NOTICE 'Notifications: %', notification_count;
    RAISE NOTICE 'Project notes: %', note_count;
    RAISE NOTICE 'Deadline extensions: %', extension_count;
    RAISE NOTICE 'Change requests: %', change_request_count;
    RAISE NOTICE '=== CREATION COMPLETED ===';
END $$;

-- 10. Show detailed data verification by month and status
SELECT 
    'USERS' as table_name,
    role::text as category,
    COUNT(*) as count
FROM users 
GROUP BY role
UNION ALL
SELECT 
    'PROJECTS' as table_name,
    status::text as category,
    COUNT(*) as count
FROM projects 
GROUP BY status
UNION ALL
SELECT 
    'PROJECTS BY MONTH' as table_name,
    TO_CHAR(deadline, 'YYYY-MM') as category,
    COUNT(*) as count
FROM projects 
GROUP BY TO_CHAR(deadline, 'YYYY-MM')
ORDER BY table_name, category;