-- Enhance projects table to track pricing information
-- Add columns for pricing tracking and fee calculations

-- Add pricing tracking columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS base_price_gbp DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS urgency_charge_gbp DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS super_worker_fee_gbp DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS agent_fee_gbp DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS super_worker_id UUID REFERENCES users(id);

-- Add check constraints
ALTER TABLE projects 
ADD CONSTRAINT IF NOT EXISTS chk_pricing_type 
CHECK (pricing_type IN ('super_agent', 'agent'));

ALTER TABLE projects 
ADD CONSTRAINT IF NOT EXISTS chk_urgency_level 
CHECK (urgency_level IN ('normal', 'moderate', 'urgent', 'rush'));

ALTER TABLE projects 
ADD CONSTRAINT IF NOT EXISTS chk_positive_prices 
CHECK (
    base_price_gbp >= 0 AND 
    urgency_charge_gbp >= 0 AND 
    super_worker_fee_gbp >= 0 AND 
    agent_fee_gbp >= 0
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_pricing_type ON projects(pricing_type);
CREATE INDEX IF NOT EXISTS idx_projects_super_worker_id ON projects(super_worker_id);
CREATE INDEX IF NOT EXISTS idx_projects_agent_id ON projects(agent_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_completed_at ON projects(completed_at);

-- Add comments to new columns
COMMENT ON COLUMN projects.pricing_type IS 'Type of pricing used: super_agent (fixed rates) or agent (custom rates)';
COMMENT ON COLUMN projects.base_price_gbp IS 'Base price before urgency charges in GBP';
COMMENT ON COLUMN projects.urgency_charge_gbp IS 'Additional charge for urgent delivery in GBP';
COMMENT ON COLUMN projects.super_worker_fee_gbp IS 'Fee paid to Super Worker (£6.25 per 500 words)';
COMMENT ON COLUMN projects.agent_fee_gbp IS 'Commission fee paid to Agent in GBP';
COMMENT ON COLUMN projects.urgency_level IS 'Urgency level: normal, moderate, urgent, rush';
COMMENT ON COLUMN projects.super_worker_id IS 'ID of the Super Worker assigned to this project';