# Database Migration Guide - Fix user_progress Table

## Problem
The scan is failing with the error:
```
❌ Authenticated scan error: error: column "next_replacement_date" of relation "user_progress" does not exist
```

This is caused by missing columns in the `user_progress` table that the code expects but weren't created in previous migrations.

## Solution
Run the migration script `/backend/db/fix-user-progress-columns.js` against your production database.

## Option 1: Run Migration Directly on Render (Recommended)

### Step 1: Get your DATABASE_URL from Render
1. Go to your Render dashboard
2. Navigate to your PostgreSQL database
3. Copy the **External Database URL** (not Internal)

### Step 2: Set the DATABASE_URL locally
```bash
export DATABASE_URL="your-database-url-from-render"
```

### Step 3: Run the migration
```bash
cd backend
node db/fix-user-progress-columns.js
```

### Expected Output:
```
🔧 Fixing user_progress table - Adding missing columns...

📝 Adding missing columns to user_progress table...
✅ Added columns:
   - site_wide_total (INTEGER)
   - site_wide_completed (INTEGER)
   - site_wide_active (INTEGER)
   - page_specific_total (INTEGER)
   - page_specific_completed (INTEGER)
   - site_wide_complete (BOOLEAN)
   - batch_1_unlock_date (TIMESTAMP)
   - batch_2_unlock_date (TIMESTAMP)
   - batch_3_unlock_date (TIMESTAMP)
   - batch_4_unlock_date (TIMESTAMP)
   - total_batches (INTEGER)
   - next_replacement_date (DATE)

═══════════════════════════════════════════════════
🎉 MIGRATION COMPLETE! 🎉
═══════════════════════════════════════════════════

✅ user_progress table is now compatible with hybrid recommendation system
```

## Option 2: Deploy Migration via Render Shell

### Step 1: Access Render Shell
1. Go to your backend service on Render
2. Click on "Shell" tab
3. Wait for the shell to connect

### Step 2: Run the migration in the shell
```bash
node db/fix-user-progress-columns.js
```

## Option 3: Run SQL Directly

If you prefer to run the SQL directly, you can connect to your database and run:

```sql
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

  -- Refresh/replacement tracking (if referenced anywhere)
  ADD COLUMN IF NOT EXISTS next_replacement_date DATE;
```

## Verification

After running the migration, test the scan again:
1. Try running a scan from the dashboard
2. Check Render logs for errors
3. The scan should complete successfully without the "column does not exist" error

## What This Migration Fixes

This migration adds columns that are required by the hybrid recommendation system but were missing from previous migrations:

- **Hybrid System Tracking**: `site_wide_total`, `site_wide_completed`, `site_wide_active`, `page_specific_total`, `page_specific_completed`, `site_wide_complete`
- **Batch Unlock System**: `batch_1_unlock_date`, `batch_2_unlock_date`, `batch_3_unlock_date`, `batch_4_unlock_date`, `total_batches`
- **Refresh Tracking**: `next_replacement_date`

These columns are referenced in `/backend/utils/hybrid-recommendation-helper.js` when saving recommendations.
