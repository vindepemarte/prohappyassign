-- Enhance agent pricing table for better integration
-- Add missing columns and constraints for the pricing system

-- Add missing columns to agent_pricing table if they don't exist
DO $$ 
BEGIN
    -- Add columns one by one with error handling
    BEGIN
        ALTER TABLE agent_pricing ADD COLUMN is_active BOOLEAN DEFAULT true;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE agent_pricing ADD COLUMN effective_from TIMESTAMP DEFAULT NOW();
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE agent_pricing ADD COLUMN effective_until TIMESTAMP;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE agent_pricing ADD COLUMN created_by UUID;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE agent_pricing ADD COLUMN updated_by UUID;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_id ON agent_pricing(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_active ON agent_pricing(agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_effective ON agent_pricing(agent_id, effective_from, effective_until);