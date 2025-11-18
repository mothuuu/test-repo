const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateRecommendationStrategyV2() {
  console.log('🔄 Starting Recommendation Strategy V2 migration...\n');

  try {
    // ============================================
    // STEP 1: Update scan_recommendations table
    // ============================================
    console.log('📝 Step 1: Updating scan_recommendations table...');

    // Add new columns
    await pool.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS previous_recommendation_id INTEGER,
      ADD COLUMN IF NOT EXISTS original_finding TEXT,
      ADD COLUMN IF NOT EXISTS validation_details JSONB,
      ADD COLUMN IF NOT EXISTS partial_completion_detected BOOLEAN DEFAULT false;
    `);

    console.log('   ✅ Added: progress_percentage, validation_status, previous_recommendation_id');
    console.log('   ✅ Added: original_finding, validation_details, partial_completion_detected');

    // Update unlock_state to support 'in_progress'
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'unlock_state_enum'
        ) THEN
          -- If enum doesn't exist, create it
          CREATE TYPE unlock_state_enum AS ENUM ('locked', 'active', 'completed', 'verified', 'in_progress', 'skipped');
          ALTER TABLE scan_recommendations ALTER COLUMN unlock_state TYPE unlock_state_enum USING unlock_state::unlock_state_enum;
        ELSE
          -- If enum exists, add 'in_progress' if not already there
          BEGIN
            ALTER TYPE unlock_state_enum ADD VALUE IF NOT EXISTS 'in_progress';
          EXCEPTION
            WHEN duplicate_object THEN null;
          END;
        END IF;
      END $$;
    `);

    console.log('   ✅ Updated unlock_state enum to include "in_progress"');

    // Add foreign key constraint
    await pool.query(`
      ALTER TABLE scan_recommendations
      ADD CONSTRAINT fk_previous_recommendation
      FOREIGN KEY (previous_recommendation_id)
      REFERENCES scan_recommendations(id)
      ON DELETE SET NULL;
    `);

    console.log('   ✅ Added foreign key for previous_recommendation_id');
    console.log('✅ Step 1 Complete!\n');

    // ============================================
    // STEP 2: Create recommendation_validation_history table
    // ============================================
    console.log('📝 Step 2: Creating recommendation_validation_history table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendation_validation_history (
        id SERIAL PRIMARY KEY,
        recommendation_id INTEGER NOT NULL REFERENCES scan_recommendations(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Validation results
        validation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        was_implemented BOOLEAN DEFAULT false,
        is_partial BOOLEAN DEFAULT false,
        completion_percentage INTEGER DEFAULT 0,

        -- What was checked
        checked_elements JSONB,
        found_elements JSONB,
        missing_elements JSONB,

        -- Recommendation outcome
        outcome VARCHAR(50), -- 'verified_complete', 'partial_progress', 'not_implemented', 'regressed'
        notes TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('   ✅ Table created with validation tracking columns');

    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_validation_history_recommendation
        ON recommendation_validation_history(recommendation_id);
      CREATE INDEX IF NOT EXISTS idx_validation_history_scan
        ON recommendation_validation_history(scan_id);
      CREATE INDEX IF NOT EXISTS idx_validation_history_user
        ON recommendation_validation_history(user_id);
    `);

    console.log('   ✅ Indexes created');
    console.log('✅ Step 2 Complete!\n');

    // ============================================
    // STEP 3: Create user_recommendation_mode table
    // ============================================
    console.log('📝 Step 3: Creating user_recommendation_mode table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_recommendation_mode (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,

        -- Current mode
        current_mode VARCHAR(20) DEFAULT 'optimization', -- 'optimization' or 'elite'
        current_score INTEGER,

        -- Mode transition tracking
        previous_mode VARCHAR(20),
        transitioned_at TIMESTAMP,
        transition_reason TEXT,

        -- Elite mode settings
        elite_activated_at TIMESTAMP,
        elite_features_enabled JSONB DEFAULT '{"competitive_tracking": true, "citation_tracking": true, "trend_alerts": true}'::jsonb,

        -- Tracking
        mode_changes_count INTEGER DEFAULT 0,
        last_mode_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id)
      )
    `);

    console.log('   ✅ Table created for mode tracking');
    console.log('   ✅ Supports: optimization mode, elite mode, transitions');

    // Add index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mode_user_id
        ON user_recommendation_mode(user_id);
    `);

    console.log('   ✅ Index created');
    console.log('✅ Step 3 Complete!\n');

    // ============================================
    // STEP 4: Create competitive_tracking table (for Elite mode)
    // ============================================
    console.log('📝 Step 4: Creating competitive_tracking table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitive_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        competitor_url VARCHAR(500) NOT NULL,
        competitor_domain VARCHAR(200),

        -- Tracking settings
        is_active BOOLEAN DEFAULT true,
        tracking_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_scanned_at TIMESTAMP,

        -- Latest scores
        latest_total_score INTEGER,
        latest_scan_date TIMESTAMP,

        -- Score history (stored as JSONB for efficient querying)
        score_history JSONB DEFAULT '[]'::jsonb,
        -- Format: [{"date": "2025-01-15", "score": 720, "categories": {...}}, ...]

        -- Alerts
        significant_change_threshold INTEGER DEFAULT 20,
        last_alert_sent_at TIMESTAMP,

        -- Metadata
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id, competitor_url)
      )
    `);

    console.log('   ✅ Table created for competitive tracking');
    console.log('   ✅ Supports: score history, alerts, multi-competitor tracking');

    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_competitive_tracking_user
        ON competitive_tracking(user_id);
      CREATE INDEX IF NOT EXISTS idx_competitive_tracking_active
        ON competitive_tracking(user_id, is_active);
    `);

    console.log('   ✅ Indexes created');
    console.log('✅ Step 4 Complete!\n');

    // ============================================
    // STEP 5: Add columns to user_progress for replacement tracking
    // ============================================
    console.log('📝 Step 5: Updating user_progress table...');

    await pool.query(`
      ALTER TABLE user_progress
      ADD COLUMN IF NOT EXISTS last_replacement_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS next_replacement_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS recommendations_replaced_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS target_active_count INTEGER DEFAULT 5;
    `);

    console.log('   ✅ Added: last_replacement_date, next_replacement_date');
    console.log('   ✅ Added: recommendations_replaced_count, target_active_count');
    console.log('✅ Step 5 Complete!\n');

    // ============================================
    // STEP 6: Update existing data
    // ============================================
    console.log('📝 Step 6: Updating existing data...');

    // Set next_replacement_date for existing user_progress records
    await pool.query(`
      UPDATE user_progress
      SET next_replacement_date =
        CASE
          WHEN batch_2_unlock_date IS NOT NULL THEN batch_2_unlock_date
          ELSE CURRENT_TIMESTAMP + INTERVAL '5 days'
        END
      WHERE next_replacement_date IS NULL;
    `);

    console.log('   ✅ Set next_replacement_date for existing records');

    // Initialize validation_status for existing recommendations
    await pool.query(`
      UPDATE scan_recommendations
      SET validation_status =
        CASE
          WHEN unlock_state = 'completed' THEN 'pending_validation'
          WHEN unlock_state = 'verified' THEN 'verified_complete'
          ELSE NULL
        END
      WHERE validation_status IS NULL;
    `);

    console.log('   ✅ Initialized validation_status for existing recommendations');
    console.log('✅ Step 6 Complete!\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✅ scan_recommendations: Added 6 columns, updated enum');
    console.log('   ✅ recommendation_validation_history: New table created');
    console.log('   ✅ user_recommendation_mode: New table created');
    console.log('   ✅ competitive_tracking: New table created');
    console.log('   ✅ user_progress: Added 4 columns');
    console.log('   ✅ Existing data: Updated with defaults');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrateRecommendationStrategyV2()
    .then(() => {
      console.log('\n✅ Migration script finished');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateRecommendationStrategyV2 };
