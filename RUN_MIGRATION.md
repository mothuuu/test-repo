# Run Database Migration for Historic Comparison Feature

## Problem
Scans are failing with 500 error because the `domain` column doesn't exist in the production database.

## Solution
Run the migration script to add the required columns.

## Steps to Run Migration

### Option 1: Using Render Shell (Recommended)
1. Go to your Render Dashboard
2. Click on your web service
3. Go to "Shell" tab
4. Run:
   ```bash
   cd backend/db
   node migrate-historic-comparison.js
   ```

### Option 2: Using PostgreSQL Client Locally
1. Make sure you have PostgreSQL client installed
2. Run:
   ```bash
   cd backend/db
   DATABASE_URL="postgresql://ai_visibility_et3s_user:qFGk5hj5rdWU7fA5ZFVoEqOLHHmJWl0u@dpg-d3g5ath5pdvs73e7k4mg-a.oregon-postgres.render.com/ai_visibility_et3s" node migrate-historic-comparison.js
   ```

### Option 3: Manual SQL (if above don't work)
Connect to your database and run:
```sql
-- Add domain column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='scans' AND column_name='domain'
  ) THEN
    ALTER TABLE scans ADD COLUMN domain VARCHAR(255);
    CREATE INDEX idx_scans_domain ON scans(user_id, domain, created_at DESC);
  END IF;
END $$;

-- Add previous_scan_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='scans' AND column_name='previous_scan_id'
  ) THEN
    ALTER TABLE scans ADD COLUMN previous_scan_id INTEGER REFERENCES scans(id);
    CREATE INDEX idx_scans_previous ON scans(previous_scan_id);
  END IF;
END $$;

-- Add comparison_data column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='scans' AND column_name='comparison_data'
  ) THEN
    ALTER TABLE scans ADD COLUMN comparison_data JSONB;
  END IF;
END $$;

-- Backfill domain for existing scans
UPDATE scans
SET domain = CASE
  WHEN url ~ '^https?://([^/]+)' THEN
    regexp_replace(
      regexp_replace(
        substring(url from '^https?://([^/]+)'),
        '^www\.', ''
      ),
      ':\d+$', ''
    )
  ELSE NULL
END
WHERE domain IS NULL AND url IS NOT NULL;
```

## Expected Output
```
🔄 Starting historic comparison migration...
  📝 Adding domain column to scans table...
  🔗 Adding previous_scan_id column to scans table...
  📊 Adding comparison_data column to scans table...
  🔄 Backfilling domain for existing scans...
  ✅ Backfilled domain for X scans
✅ Historic comparison migration completed successfully!
🎉 Migration complete!
```

## What This Migration Does
1. Adds `domain` column to store extracted root domain (e.g., "visible2ai.com")
2. Adds `previous_scan_id` column to link scans together
3. Adds `comparison_data` column to store comparison results
4. Backfills `domain` for all existing scans by extracting from URLs
5. Creates indexes for performance

## After Migration
Once the migration completes, your scans should work immediately without any code changes.
