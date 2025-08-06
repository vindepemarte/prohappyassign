-- Add adjustment_type column to projects table
-- This helps differentiate between word count and deadline adjustments

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(20) CHECK (adjustment_type IN ('word_count', 'deadline'));

-- Add comment for documentation
COMMENT ON COLUMN projects.adjustment_type IS 'Type of adjustment requested: word_count or deadline';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_adjustment_type ON projects(adjustment_type) WHERE adjustment_type IS NOT NULL;