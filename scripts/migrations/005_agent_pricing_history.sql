-- Migration: Add Agent Pricing History Tracking
-- This migration adds a pricing history table to track all pricing changes

-- Create agent_pricing_history table
CREATE TABLE IF NOT EXISTS agent_pricing_history (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pricing_id INTEGER NOT NULL REFERENCES agent_pricing(id) ON DELETE CASCADE,
    
    -- Pricing details at time of change
    min_word_count INTEGER NOT NULL,
    max_word_count INTEGER NOT NULL,
    base_rate_per_500_words DECIMAL(10,2) NOT NULL,
    agent_fee_percentage DECIMAL(5,2) NOT NULL,
    
    -- Change tracking
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_pricing_history_agent_id ON agent_pricing_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_history_pricing_id ON agent_pricing_history(pricing_id);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_history_effective_dates ON agent_pricing_history(effective_from, effective_until);
CREATE INDEX IF NOT EXISTS idx_agent_pricing_history_change_type ON agent_pricing_history(change_type);

-- Add trigger to automatically create history records when agent_pricing is modified
CREATE OR REPLACE FUNCTION create_agent_pricing_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark previous history record as ended
    UPDATE agent_pricing_history 
    SET effective_until = CURRENT_TIMESTAMP
    WHERE agent_id = COALESCE(NEW.agent_id, OLD.agent_id) 
      AND effective_until IS NULL;
    
    -- Create new history record for INSERT or UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO agent_pricing_history (
            agent_id, pricing_id, min_word_count, max_word_count, 
            base_rate_per_500_words, agent_fee_percentage, 
            change_type, changed_by, change_reason
        ) VALUES (
            NEW.agent_id, NEW.id, NEW.min_word_count, NEW.max_word_count,
            NEW.base_rate_per_500_words, NEW.agent_fee_percentage,
            CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
            NEW.updated_by, -- This field needs to be added to agent_pricing table
            'Automatic history tracking'
        );
        RETURN NEW;
    END IF;
    
    -- Create history record for DELETE
    IF TG_OP = 'DELETE' THEN
        INSERT INTO agent_pricing_history (
            agent_id, pricing_id, min_word_count, max_word_count, 
            base_rate_per_500_words, agent_fee_percentage, 
            change_type, changed_by, change_reason
        ) VALUES (
            OLD.agent_id, OLD.id, OLD.min_word_count, OLD.max_word_count,
            OLD.base_rate_per_500_words, OLD.agent_fee_percentage,
            'deleted',
            NULL, -- Will be set by application
            'Pricing configuration deleted'
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS agent_pricing_history_trigger ON agent_pricing;
CREATE TRIGGER agent_pricing_history_trigger
    AFTER INSERT OR UPDATE OR DELETE ON agent_pricing
    FOR EACH ROW EXECUTE FUNCTION create_agent_pricing_history();

-- Add updated_by field to agent_pricing table for tracking who made changes
ALTER TABLE agent_pricing 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add comment for documentation
COMMENT ON TABLE agent_pricing_history IS 'Tracks all changes to agent pricing configurations for audit and history purposes';
COMMENT ON COLUMN agent_pricing_history.change_type IS 'Type of change: created, updated, or deleted';
COMMENT ON COLUMN agent_pricing_history.effective_from IS 'When this pricing configuration became effective';
COMMENT ON COLUMN agent_pricing_history.effective_until IS 'When this pricing configuration stopped being effective (NULL for current)';