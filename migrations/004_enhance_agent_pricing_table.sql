-- Enhance agent pricing table for better integration
-- Add missing columns and constraints for the pricing system

-- Add missing columns to agent_pricing table if they don't exist
ALTER TABLE agent_pricing 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS effective_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add check constraints
ALTER TABLE agent_pricing 
ADD CONSTRAINT IF NOT EXISTS chk_agent_pricing_word_count_range 
CHECK (min_word_count > 0 AND max_word_count > min_word_count AND max_word_count <= 20000);

ALTER TABLE agent_pricing 
ADD CONSTRAINT IF NOT EXISTS chk_agent_pricing_rates 
CHECK (base_rate_per_500_words > 0 AND agent_fee_percentage >= 0 AND agent_fee_percentage <= 100);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_id ON agent_pricing(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_active ON agent_pricing(agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_effective ON agent_pricing(agent_id, effective_from, effective_until);

-- Add trigger to automatically set effective_until when a new pricing is created
CREATE OR REPLACE FUNCTION update_agent_pricing_effective_until()
RETURNS TRIGGER AS $$
BEGIN
    -- Set effective_until for previous active pricing
    UPDATE agent_pricing 
    SET effective_until = NOW(), is_active = false
    WHERE agent_id = NEW.agent_id 
    AND id != NEW.id 
    AND is_active = true 
    AND effective_until IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_pricing_effective_until ON agent_pricing;
CREATE TRIGGER trigger_agent_pricing_effective_until
    AFTER INSERT ON agent_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_pricing_effective_until();

-- Add comments to new columns
COMMENT ON COLUMN agent_pricing.is_active IS 'Whether this pricing configuration is currently active';
COMMENT ON COLUMN agent_pricing.effective_from IS 'Date when this pricing configuration becomes effective';
COMMENT ON COLUMN agent_pricing.effective_until IS 'Date when this pricing configuration expires';
COMMENT ON COLUMN agent_pricing.created_by IS 'User who created this pricing configuration';
COMMENT ON COLUMN agent_pricing.updated_by IS 'User who last updated this pricing configuration';