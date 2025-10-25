-- Migration: Add impact_description column to scan_recommendations table
-- Date: 2025-01-XX
-- Description: Adds a new column to store business impact explanation separately from finding

-- Add impact_description column (allows NULL for existing rows)
ALTER TABLE scan_recommendations
ADD COLUMN IF NOT EXISTS impact_description TEXT;

-- Create index for potential future queries
CREATE INDEX IF NOT EXISTS idx_scan_recommendations_impact
ON scan_recommendations(impact_description);

-- Comment for documentation
COMMENT ON COLUMN scan_recommendations.impact_description IS
'Business impact explanation (e.g., "Search engines and AI cannot understand product specifications"). Displayed separately from the finding.';
