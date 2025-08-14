-- Create user earnings tracking table
-- This table tracks earnings, fees, and profits for analytics

CREATE TABLE IF NOT EXISTS user_earnings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    project_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    earnings_gbp DECIMAL(10,2) NOT NULL DEFAULT 0,
    earnings_inr DECIMAL(10,2),
    fees_paid_gbp DECIMAL(10,2) DEFAULT 0,
    net_profit_gbp DECIMAL(10,2),
    calculation_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_id ON user_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_project_id ON user_earnings(project_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_role ON user_earnings(role);
CREATE INDEX IF NOT EXISTS idx_user_earnings_calculation_date ON user_earnings(calculation_date);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_role ON user_earnings(user_id, role);

-- Create composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_earnings_analytics 
ON user_earnings(user_id, role, calculation_date DESC);