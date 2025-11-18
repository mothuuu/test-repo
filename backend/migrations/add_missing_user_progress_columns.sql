-- Add missing columns to user_progress table
-- These columns are referenced in hybrid-recommendation-helper.js but missing from schema

ALTER TABLE user_progress
-- Hybrid recommendation system columns
ADD COLUMN IF NOT EXISTS site_wide_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_wide_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_wide_active INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS page_specific_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS page_specific_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_wide_complete BOOLEAN DEFAULT false,

-- Batch unlock date tracking
ADD COLUMN IF NOT EXISTS batch_1_unlock_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS batch_2_unlock_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS batch_3_unlock_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS batch_4_unlock_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 1,

-- Refresh/replacement tracking
ADD COLUMN IF NOT EXISTS next_replacement_date DATE;

-- Display success message
SELECT 'Migration completed: Added missing columns to user_progress table' AS status;
