# Fix recommendation_feedback Table Migration

## Problem
The application is showing validation errors:
```
⚠️ Validation failed (non-critical): column "subfactor" does not exist
```

This error occurs when the `recommendation_feedback` table doesn't exist or is missing required columns.

## Solution
Run the migration script to create the `recommendation_feedback` table with all required columns.

## Option 1: Run Migration on Render (Recommended)

### Step 1: Access Render Shell
1. Go to your backend service on Render
2. Click on "Shell" tab
3. Wait for the shell to connect

### Step 2: Run the migration
```bash
node db/migrate-recommendation-feedback.js
```

### Expected Output:
```
🔄 Creating recommendation feedback tables...
✅ recommendation_feedback table created
✅ recommendation_interactions table created
✅ recommendation_quality_metrics table created
✅ Indexes created
✅ Triggers created
✅ Recommendation feedback migration completed successfully!
```

## Option 2: Run Locally with Production Database

### Step 1: Get your DATABASE_URL from Render
1. Go to your Render dashboard
2. Navigate to your PostgreSQL database
3. Copy the **External Database URL**

### Step 2: Set the DATABASE_URL locally
```bash
export DATABASE_URL="your-database-url-from-render"
```

### Step 3: Run the migration
```bash
cd backend
node db/migrate-recommendation-feedback.js
```

## Option 3: Run SQL Directly

Connect to your database and run the SQL from `/backend/db/migrate-recommendation-feedback.js`:

```sql
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  subfactor TEXT NOT NULL,

  -- Feedback data
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  helpful BOOLEAN,
  implemented BOOLEAN DEFAULT FALSE,
  comment TEXT,

  -- Context
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  industry TEXT,
  page_url TEXT,
  recommendation_variant TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_interactions (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,

  -- Interaction events
  viewed BOOLEAN DEFAULT TRUE,
  expanded BOOLEAN DEFAULT FALSE,
  copied_code BOOLEAN DEFAULT FALSE,
  downloaded BOOLEAN DEFAULT FALSE,
  time_spent_seconds INTEGER,

  -- Metadata
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint to prevent duplicate tracking
  UNIQUE(scan_id, recommendation_id, user_id)
);

CREATE TABLE IF NOT EXISTS recommendation_quality_metrics (
  id SERIAL PRIMARY KEY,
  subfactor TEXT NOT NULL,
  variant TEXT,

  -- Aggregated metrics
  total_shown INTEGER DEFAULT 0,
  total_helpful INTEGER DEFAULT 0,
  total_not_helpful INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  implementation_rate DECIMAL(5,2),
  avg_time_spent DECIMAL(8,2),

  -- Industry breakdown
  industry TEXT,

  -- Time period
  period_start DATE,
  period_end DATE,

  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint for aggregation keys
  UNIQUE(subfactor, variant, industry, period_start, period_end)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_subfactor ON recommendation_feedback(subfactor);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON recommendation_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON recommendation_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON recommendation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_scan ON recommendation_interactions(scan_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON recommendation_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_quality_subfactor ON recommendation_quality_metrics(subfactor);
CREATE INDEX IF NOT EXISTS idx_quality_period ON recommendation_quality_metrics(period_start, period_end);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recommendation_feedback_updated_at ON recommendation_feedback;

CREATE TRIGGER update_recommendation_feedback_updated_at
  BEFORE UPDATE ON recommendation_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Verification

After running the migration:
1. Check Render logs for the validation error
2. The error should no longer appear
3. Feedback functionality should work properly

## What This Migration Creates

This migration creates three tables for the feedback/learning loop system:

1. **recommendation_feedback**: Stores explicit user feedback (ratings, helpfulness, implementation status)
2. **recommendation_interactions**: Tracks implicit user interactions (views, expansions, code copies)
3. **recommendation_quality_metrics**: Aggregated metrics for recommendation performance analysis

These tables enable the continuous learning and improvement of recommendation quality based on user feedback.
