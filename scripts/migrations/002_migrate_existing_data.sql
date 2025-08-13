-- Migration: Migrate Existing Data to Hierarchy System
-- Description: Migrate existing users to hierarchy structure and generate initial reference codes
-- Date: 2025-01-08

BEGIN;

-- 1. Function to generate unique reference codes
CREATE OR REPLACE FUNCTION generate_reference_code(code_prefix TEXT DEFAULT 'REF') 
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists INTEGER;
BEGIN
    LOOP
        -- Generate a random 8-character code with prefix
        new_code := code_prefix || '-' || UPPER(
            SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
        );
        
        -- Check if code already exists
        SELECT COUNT(*) INTO code_exists FROM reference_codes WHERE code = new_code;
        
        -- If code doesn't exist, return it
        IF code_exists = 0 THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Migrate existing users to hierarchy structure
-- First, identify existing agents and promote one to super_agent if none exists
DO $$
DECLARE
    super_agent_count INTEGER;
    first_agent_id UUID;
BEGIN
    -- Check if there are any super_agents
    SELECT COUNT(*) INTO super_agent_count FROM users WHERE role = 'super_agent';
    
    -- If no super_agent exists, promote the first agent to super_agent
    IF super_agent_count = 0 THEN
        SELECT id INTO first_agent_id FROM users WHERE role = 'agent' LIMIT 1;
        
        IF first_agent_id IS NOT NULL THEN
            UPDATE users SET role = 'super_agent' WHERE id = first_agent_id;
            
            -- Set this user as their own super_agent
            UPDATE users SET super_agent_id = first_agent_id WHERE id = first_agent_id;
            
            -- Insert hierarchy record for super_agent
            INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
            VALUES (first_agent_id, NULL, 1, first_agent_id)
            ON CONFLICT (user_id) DO NOTHING;
            
            RAISE NOTICE 'Promoted user % to super_agent', first_agent_id;
        END IF;
    END IF;
END $$;

-- 3. Set up hierarchy for existing users
DO $$
DECLARE
    super_agent_id UUID;
    user_record RECORD;
BEGIN
    -- Get the super_agent ID
    SELECT id INTO super_agent_id FROM users WHERE role = 'super_agent' LIMIT 1;
    
    IF super_agent_id IS NULL THEN
        RAISE EXCEPTION 'No super_agent found. Cannot proceed with migration.';
    END IF;
    
    -- Process all users and assign them to hierarchy
    FOR user_record IN SELECT id, role FROM users WHERE role != 'super_agent' LOOP
        -- Set super_agent_id for all users
        EXECUTE 'UPDATE users SET super_agent_id = $1 WHERE id = $2' USING super_agent_id, user_record.id;
        
        -- Insert hierarchy records
        CASE user_record.role
            WHEN 'agent' THEN
                INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
                VALUES (user_record.id, super_agent_id, 2, super_agent_id)
                ON CONFLICT (user_id) DO NOTHING;
                
            WHEN 'client' THEN
                INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
                VALUES (user_record.id, super_agent_id, 3, super_agent_id)
                ON CONFLICT (user_id) DO NOTHING;
                
            WHEN 'worker' THEN
                -- For now, assign workers directly to super_agent
                -- Later, they can be reassigned to super_workers
                INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
                VALUES (user_record.id, super_agent_id, 4, super_agent_id)
                ON CONFLICT (user_id) DO NOTHING;
                
            WHEN 'super_worker' THEN
                INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
                VALUES (user_record.id, super_agent_id, 2, super_agent_id)
                ON CONFLICT (user_id) DO NOTHING;
        END CASE;
    END LOOP;
    
    RAISE NOTICE 'Hierarchy setup completed for super_agent %', super_agent_id;
END $$;

-- 4. Generate reference codes for existing users
DO $$
DECLARE
    user_record RECORD;
    agent_code TEXT;
    client_code TEXT;
    worker_code TEXT;
BEGIN
    -- Generate reference codes for super_agents
    FOR user_record IN SELECT id FROM users WHERE role = 'super_agent' LOOP
        -- Generate agent recruitment code
        agent_code := generate_reference_code('SA-AGT');
        INSERT INTO reference_codes (code, owner_id, code_type, is_active)
        VALUES (agent_code, user_record.id, 'agent_recruitment', true);
        
        -- Generate client recruitment code
        client_code := generate_reference_code('SA-CLI');
        INSERT INTO reference_codes (code, owner_id, code_type, is_active)
        VALUES (client_code, user_record.id, 'client_recruitment', true);
        
        RAISE NOTICE 'Generated reference codes for super_agent %: % (agents), % (clients)', 
                     user_record.id, agent_code, client_code;
    END LOOP;
    
    -- Generate reference codes for agents
    FOR user_record IN SELECT id FROM users WHERE role = 'agent' LOOP
        client_code := generate_reference_code('AGT-CLI');
        INSERT INTO reference_codes (code, owner_id, code_type, is_active)
        VALUES (client_code, user_record.id, 'client_recruitment', true);
        
        RAISE NOTICE 'Generated client recruitment code for agent %: %', user_record.id, client_code;
    END LOOP;
    
    -- Generate reference codes for super_workers
    FOR user_record IN SELECT id FROM users WHERE role = 'super_worker' LOOP
        worker_code := generate_reference_code('SW-WRK');
        INSERT INTO reference_codes (code, owner_id, code_type, is_active)
        VALUES (worker_code, user_record.id, 'worker_recruitment', true);
        
        RAISE NOTICE 'Generated worker recruitment code for super_worker %: %', user_record.id, worker_code;
    END LOOP;
END $$;

-- 5. Set up default agent pricing for existing agents
DO $$
DECLARE
    agent_record RECORD;
BEGIN
    FOR agent_record IN SELECT id FROM users WHERE role IN ('agent', 'super_agent') LOOP
        INSERT INTO agent_pricing (
            agent_id, 
            min_word_count, 
            max_word_count, 
            base_rate_per_500_words, 
            agent_fee_percentage
        )
        VALUES (
            agent_record.id,
            500,
            20000,
            6.25,
            15.00
        )
        ON CONFLICT (agent_id) DO NOTHING;
        
        RAISE NOTICE 'Set up default pricing for agent %', agent_record.id;
    END LOOP;
END $$;

-- 6. Update existing projects to maintain current assignments
-- This ensures existing project assignments continue to work
UPDATE projects 
SET sub_agent_id = agent_id 
WHERE agent_id IS NOT NULL AND sub_agent_id IS NULL;

UPDATE projects 
SET sub_worker_id = worker_id 
WHERE worker_id IS NOT NULL AND sub_worker_id IS NULL;

-- 7. Create initial assignment records for existing projects
INSERT INTO assignments (project_id, assigned_by, assigned_to, assignment_type, project_numbers)
SELECT 
    p.id,
    COALESCE(p.agent_id, (SELECT id FROM users WHERE role = 'super_agent' LIMIT 1)),
    p.worker_id,
    'worker_assignment',
    p.order_reference
FROM projects p
WHERE p.worker_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 8. Clean up the temporary function
DROP FUNCTION IF EXISTS generate_reference_code(TEXT);

COMMIT;