-- Enhance projects table to track pricing information
-- Add columns for pricing tracking and fee calculations

-- Add pricing tracking columns to projects table (ignore errors if they exist)
DO $$ 
BEGIN
    -- Add columns one by one with error handling
    BEGIN
        ALTER TABLE projects ADD COLUMN pricing_type VARCHAR(20) DEFAULT 'agent';
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN base_price_gbp DECIMAL(10,2);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN urgency_charge_gbp DECIMAL(10,2) DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN super_worker_fee_gbp DECIMAL(10,2);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN agent_fee_gbp DECIMAL(10,2) DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'normal';
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE projects ADD COLUMN super_worker_id UUID;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Create indexes (ignore errors if they exist)
CREATE INDEX IF NOT EXISTS idx_projects_pricing_type ON projects(pricing_type);
CREATE INDEX IF NOT EXISTS idx_projects_super_worker_id ON projects(super_worker_id);
CREATE INDEX IF NOT EXISTS idx_projects_agent_id ON projects(agent_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_completed_at ON projects(completed_at);