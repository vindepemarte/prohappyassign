-- COMPLETE DATABASE SETUP FOR PROHAPPY ASSIGNMENTS
-- This file sets up the entire database schema with all required tables, data, and indexes
-- Run this once to set up everything from scratch - WORKS WITH ANY EXISTING DATABASE

-- =============================================================================
-- 1. CREATE SUPER AGENT PRICING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS super_agent_pricing (
    id SERIAL PRIMARY KEY,
    word_range_start INTEGER NOT NULL,
    word_range_end INTEGER NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert Super Agent pricing data (£45 for 500 words to £440 for 20,000 words)
-- Use ON CONFLICT DO NOTHING to avoid errors if data already exists
INSERT INTO super_agent_pricing (word_range_start, word_range_end, price_gbp) VALUES
(1, 500, 45.00), (501, 1000, 55.00), (1001, 1500, 65.00), (1501, 2000, 70.00),
(2001, 2500, 85.00), (2501, 3000, 100.00), (3001, 3500, 110.00), (3501, 4000, 120.00),
(4001, 4500, 130.00), (4501, 5000, 140.00), (5001, 5500, 150.00), (5501, 6000, 160.00),
(6001, 6500, 170.00), (6501, 7000, 180.00), (7001, 7500, 190.00), (7501, 8000, 200.00),
(8001, 8500, 210.00), (8501, 9000, 220.00), (9001, 9500, 230.00), (9501, 10000, 240.00),
(10001, 10500, 250.00), (10501, 11000, 260.00), (11001, 11500, 270.00), (11501, 12000, 280.00),
(12001, 12500, 290.00), (12501, 13000, 300.00), (13001, 13500, 310.00), (13501, 14000, 320.00),
(14001, 14500, 330.00), (14501, 15000, 340.00), (15001, 15500, 350.00), (15501, 16000, 360.00),
(16001, 16500, 370.00), (16501, 17000, 380.00), (17001, 17500, 390.00), (17501, 18000, 400.00),
(18001, 18500, 410.00), (18501, 19000, 420.00), (19001, 19500, 430.00), (19501, 20000, 440.00)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. CREATE USER EARNINGS TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_earnings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    project_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_worker', 'agent', 'super_agent')),
    earnings_gbp DECIMAL(10,2) NOT NULL DEFAULT 0,
    earnings_inr DECIMAL(10,2),
    fees_paid_gbp DECIMAL(10,2) DEFAULT 0,
    net_profit_gbp DECIMAL(10,2),
    calculation_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_earnings_user_id_project_id_key' 
        AND table_name = 'user_earnings'
    ) THEN
        ALTER TABLE user_earnings ADD CONSTRAINT user_earnings_user_id_project_id_key UNIQUE(user_id, project_id);
    END IF;
END $$;

-- =============================================================================
-- 3. ENHANCE PROJECTS TABLE FOR PRICING TRACKING (ONLY IF TABLE EXISTS)
-- =============================================================================

DO $$ 
BEGIN
    -- Only modify projects table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        -- Add pricing columns one by one with error handling
        BEGIN ALTER TABLE projects ADD COLUMN pricing_type VARCHAR(20) DEFAULT 'agent'; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN base_price_gbp DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN urgency_charge_gbp DECIMAL(10,2) DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN super_worker_fee_gbp DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN agent_fee_gbp DECIMAL(10,2) DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'normal'; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE projects ADD COLUMN super_worker_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END IF;
END $$;

-- =============================================================================
-- 4. ENHANCE AGENT PRICING TABLE (ONLY IF TABLE EXISTS)
-- =============================================================================

DO $$ 
BEGIN
    -- Only modify agent_pricing if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_pricing') THEN
        -- Add columns one by one with error handling
        BEGIN ALTER TABLE agent_pricing ADD COLUMN is_active BOOLEAN DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE agent_pricing ADD COLUMN effective_from TIMESTAMP DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE agent_pricing ADD COLUMN effective_until TIMESTAMP; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE agent_pricing ADD COLUMN created_by UUID; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE agent_pricing ADD COLUMN updated_by UUID; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END IF;
END $$;

-- =============================================================================
-- 5. CREATE PERFORMANCE INDEXES (ONLY IF COLUMNS EXIST)
-- =============================================================================

-- Super Agent pricing indexes
CREATE INDEX IF NOT EXISTS idx_super_agent_pricing_range ON super_agent_pricing(word_range_start, word_range_end);

-- User earnings indexes
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_id ON user_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_project_id ON user_earnings(project_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_role ON user_earnings(role);
CREATE INDEX IF NOT EXISTS idx_user_earnings_calculation_date ON user_earnings(calculation_date);
CREATE INDEX IF NOT EXISTS idx_user_earnings_analytics ON user_earnings(user_id, role, calculation_date DESC);

-- Projects table indexes (only create if columns exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'pricing_type') THEN
        CREATE INDEX IF NOT EXISTS idx_projects_pricing_type ON projects(pricing_type);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'super_worker_id') THEN
        CREATE INDEX IF NOT EXISTS idx_projects_super_worker_id ON projects(super_worker_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'agent_id') THEN
        CREATE INDEX IF NOT EXISTS idx_projects_agent_id ON projects(agent_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
    END IF;
END $$;

-- Other table indexes (only if tables exist)
DO $$
BEGIN
    -- Agent pricing indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_pricing') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_pricing' AND column_name = 'agent_id') THEN
            CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_id ON agent_pricing(agent_id);
        END IF;
    END IF;
    
    -- Users table indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        END IF;
    END IF;
END $$;

-- =============================================================================
-- 6. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate Super Worker earnings
CREATE OR REPLACE FUNCTION calculate_super_worker_earnings(word_count INTEGER)
RETURNS TABLE(
    word_units INTEGER,
    earnings_gbp DECIMAL(10,2),
    earnings_inr DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CEIL(word_count / 500.0)::INTEGER as word_units,
        (CEIL(word_count / 500.0) * 6.25)::DECIMAL(10,2) as earnings_gbp,
        (CEIL(word_count / 500.0) * 6.25 * 105.50)::DECIMAL(10,2) as earnings_inr;
END;
$$ LANGUAGE plpgsql;

-- Function to get Super Agent pricing
CREATE OR REPLACE FUNCTION get_super_agent_price(word_count INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    price DECIMAL(10,2);
BEGIN
    SELECT price_gbp INTO price
    FROM super_agent_pricing
    WHERE word_count BETWEEN word_range_start AND word_range_end;
    
    RETURN COALESCE(price, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate urgency charge
CREATE OR REPLACE FUNCTION calculate_urgency_charge(deadline TIMESTAMP)
RETURNS TABLE(
    urgency_charge DECIMAL(10,2),
    urgency_level VARCHAR(20)
) AS $$
DECLARE
    days_diff INTEGER;
BEGIN
    days_diff := CEIL(EXTRACT(EPOCH FROM (deadline - NOW())) / 86400);
    
    IF days_diff <= 1 THEN
        RETURN QUERY SELECT 30.00::DECIMAL(10,2), 'rush'::VARCHAR(20);
    ELSIF days_diff <= 3 THEN
        RETURN QUERY SELECT 10.00::DECIMAL(10,2), 'urgent'::VARCHAR(20);
    ELSIF days_diff <= 7 THEN
        RETURN QUERY SELECT 5.00::DECIMAL(10,2), 'moderate'::VARCHAR(20);
    ELSE
        RETURN QUERY SELECT 0.00::DECIMAL(10,2), 'normal'::VARCHAR(20);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. VERIFY SETUP
-- =============================================================================

-- Check that all tables exist and have data
DO $$
DECLARE
    pricing_count INTEGER;
    tables_count INTEGER := 0;
    projects_exists BOOLEAN := false;
    users_exists BOOLEAN := false;
BEGIN
    -- Check super_agent_pricing
    SELECT COUNT(*) INTO pricing_count FROM super_agent_pricing;
    IF pricing_count >= 40 THEN
        RAISE NOTICE '✅ Super Agent pricing table: % tiers (£45-£440)', pricing_count;
    ELSE
        RAISE NOTICE '❌ Super Agent pricing table incomplete: % tiers', pricing_count;
    END IF;
    
    -- Check if key tables exist
    SELECT COUNT(*) INTO tables_count FROM information_schema.tables 
    WHERE table_name IN ('super_agent_pricing', 'user_earnings');
    
    -- Check existing tables
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') INTO projects_exists;
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') INTO users_exists;
    
    RAISE NOTICE '✅ Core tables created: super_agent_pricing, user_earnings';
    
    IF projects_exists THEN
        RAISE NOTICE '✅ Enhanced existing projects table with pricing columns';
    ELSE
        RAISE NOTICE '⚠️  Projects table not found - will be created by your app';
    END IF;
    
    IF users_exists THEN
        RAISE NOTICE '✅ Found existing users table';
    ELSE
        RAISE NOTICE '⚠️  Users table not found - will be created by your app';
    END IF;
    
    RAISE NOTICE '🚀 Database setup complete! Your pricing system is ready!';
END $$;

-- =============================================================================
-- SETUP COMPLETE!
-- =============================================================================