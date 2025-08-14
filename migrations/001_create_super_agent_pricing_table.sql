-- Create Super Agent pricing table with fixed rates
-- This table stores the fixed pricing tiers for Super Agent clients

CREATE TABLE IF NOT EXISTS super_agent_pricing (
    id SERIAL PRIMARY KEY,
    word_range_start INTEGER NOT NULL,
    word_range_end INTEGER NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index to prevent overlapping ranges
CREATE UNIQUE INDEX IF NOT EXISTS idx_super_agent_pricing_range 
ON super_agent_pricing (word_range_start, word_range_end);

-- Insert Super Agent pricing tiers
INSERT INTO super_agent_pricing (word_range_start, word_range_end, price_gbp) VALUES
(1, 500, 45.00),
(501, 1000, 55.00),
(1001, 1500, 65.00),
(1501, 2000, 70.00),
(2001, 2500, 85.00),
(2501, 3000, 100.00),
(3001, 3500, 110.00),
(3501, 4000, 120.00),
(4001, 4500, 130.00),
(4501, 5000, 140.00),
(5001, 5500, 150.00),
(5501, 6000, 160.00),
(6001, 6500, 170.00),
(6501, 7000, 180.00),
(7001, 7500, 190.00),
(7501, 8000, 200.00),
(8001, 8500, 210.00),
(8501, 9000, 220.00),
(9001, 9500, 230.00),
(9501, 10000, 240.00),
(10001, 10500, 250.00),
(10501, 11000, 260.00),
(11001, 11500, 270.00),
(11501, 12000, 280.00),
(12001, 12500, 290.00),
(12501, 13000, 300.00),
(13001, 13500, 310.00),
(13501, 14000, 320.00),
(14001, 14500, 330.00),
(14501, 15000, 340.00),
(15001, 15500, 350.00),
(15501, 16000, 360.00),
(16001, 16500, 370.00),
(16501, 17000, 380.00),
(17001, 17500, 390.00),
(17501, 18000, 400.00),
(18001, 18500, 410.00),
(18501, 19000, 420.00),
(19001, 19500, 430.00),
(19501, 20000, 440.00)
ON CONFLICT (word_range_start, word_range_end) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE super_agent_pricing IS 'Fixed pricing tiers for Super Agent clients based on word count ranges';
COMMENT ON COLUMN super_agent_pricing.word_range_start IS 'Minimum word count for this pricing tier (inclusive)';
COMMENT ON COLUMN super_agent_pricing.word_range_end IS 'Maximum word count for this pricing tier (inclusive)';
COMMENT ON COLUMN super_agent_pricing.price_gbp IS 'Price in British Pounds for this word count range';