/**
 * Database Migration: Recommendation Delivery System
 *
 * Implements the comprehensive recommendation delivery strategy including:
 * - 5-day refresh cycles
 * - Mark as Implemented/Skip actions
 * - Auto-detection of implementations
 * - Optimization vs Elite Maintenance modes
 * - Impact scoring and prioritization
 * - Edge case handling
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting Recommendation Delivery System migration...\n');

    // =============================================
    // 1. UPDATE scan_recommendations TABLE
    // =============================================
    console.log('1. Updating scan_recommendations table...');

    // Add new columns for recommendation delivery system
    await client.query(`
      ALTER TABLE scan_recommendations

      -- Status tracking (active, implemented, skipped, auto_detected, archived)
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS auto_detected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS archived_reason TEXT,

      -- Mode and categorization
      ADD COLUMN IF NOT EXISTS recommendation_mode VARCHAR(50) DEFAULT 'optimization',
      ADD COLUMN IF NOT EXISTS elite_category VARCHAR(100),

      -- Impact scoring and prioritization
      ADD COLUMN IF NOT EXISTS impact_score DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS implementation_difficulty VARCHAR(20) DEFAULT 'moderate',
      ADD COLUMN IF NOT EXISTS compounding_effect_score DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS industry_relevance_score DECIMAL(10, 2) DEFAULT 0,

      -- Refresh cycle tracking
      ADD COLUMN IF NOT EXISTS last_refresh_date DATE,
      ADD COLUMN IF NOT EXISTS next_refresh_date DATE,
      ADD COLUMN IF NOT EXISTS refresh_cycle_number INTEGER DEFAULT 1,

      -- Partial implementation tracking
      ADD COLUMN IF NOT EXISTS implementation_progress DECIMAL(5, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS previous_findings TEXT,
      ADD COLUMN IF NOT EXISTS is_partial_implementation BOOLEAN DEFAULT false,

      -- Validation tracking
      ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS validation_errors JSONB,
      ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMP,

      -- Multi-page context
      ADD COLUMN IF NOT EXISTS affected_pages JSONB,
      ADD COLUMN IF NOT EXISTS pages_implemented JSONB DEFAULT '[]'::jsonb
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendations_status
        ON scan_recommendations(status);

      CREATE INDEX IF NOT EXISTS idx_recommendations_mode
        ON scan_recommendations(recommendation_mode);

      CREATE INDEX IF NOT EXISTS idx_recommendations_next_refresh
        ON scan_recommendations(next_refresh_date);

      CREATE INDEX IF NOT EXISTS idx_recommendations_impact_score
        ON scan_recommendations(impact_score DESC);
    `);

    console.log('✓ scan_recommendations table updated\n');

    // =============================================
    // 2. CREATE recommendation_refresh_cycles TABLE
    // =============================================
    console.log('2. Creating recommendation_refresh_cycles table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendation_refresh_cycles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,

        -- Cycle tracking
        cycle_number INTEGER NOT NULL,
        cycle_start_date DATE NOT NULL,
        cycle_end_date DATE NOT NULL,
        next_cycle_date DATE NOT NULL,

        -- Recommendations in this cycle
        active_recommendation_ids JSONB DEFAULT '[]'::jsonb,
        implemented_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        auto_detected_count INTEGER DEFAULT 0,
        replaced_count INTEGER DEFAULT 0,

        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_user_scan_cycle UNIQUE(user_id, scan_id, cycle_number)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_cycles_user_id
        ON recommendation_refresh_cycles(user_id);

      CREATE INDEX IF NOT EXISTS idx_refresh_cycles_next_date
        ON recommendation_refresh_cycles(next_cycle_date);
    `);

    console.log('✓ recommendation_refresh_cycles table created\n');

    // =============================================
    // 3. CREATE implementation_detections TABLE
    // =============================================
    console.log('3. Creating implementation_detections table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS implementation_detections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recommendation_id INTEGER NOT NULL REFERENCES scan_recommendations(id) ON DELETE CASCADE,

        -- Detection details
        detection_type VARCHAR(50) NOT NULL, -- 'auto_complete', 'auto_partial', 'validation_failed'
        detection_method VARCHAR(50) NOT NULL, -- 'score_improvement', 'schema_validation', 'content_analysis'
        confidence_score DECIMAL(5, 2), -- 0-100

        -- Scan comparison
        previous_scan_id INTEGER REFERENCES scans(id),
        current_scan_id INTEGER NOT NULL REFERENCES scans(id),

        -- Score changes
        pillar_affected VARCHAR(100),
        score_before INTEGER,
        score_after INTEGER,
        score_delta INTEGER,

        -- Detected changes
        detected_changes JSONB, -- Array of what changed
        evidence JSONB, -- Evidence supporting detection

        -- User notification
        user_notified BOOLEAN DEFAULT false,
        notification_sent_at TIMESTAMP,
        user_confirmed BOOLEAN,
        user_feedback TEXT,

        -- Metadata
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_detections_user_id
        ON implementation_detections(user_id);

      CREATE INDEX IF NOT EXISTS idx_detections_recommendation_id
        ON implementation_detections(recommendation_id);

      CREATE INDEX IF NOT EXISTS idx_detections_type
        ON implementation_detections(detection_type);
    `);

    console.log('✓ implementation_detections table created\n');

    // =============================================
    // 4. CREATE user_modes TABLE
    // =============================================
    console.log('4. Creating user_modes table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_modes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Current mode
        current_mode VARCHAR(50) NOT NULL DEFAULT 'optimization',
        mode_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Score tracking for mode transitions
        current_score INTEGER,
        score_at_mode_entry INTEGER,
        highest_score_achieved INTEGER DEFAULT 0,

        -- Hysteresis tracking (prevent ping-ponging)
        elite_entry_threshold INTEGER DEFAULT 850,
        elite_exit_threshold INTEGER DEFAULT 800,
        in_buffer_zone BOOLEAN DEFAULT false,

        -- Mode history
        total_elite_entries INTEGER DEFAULT 0,
        total_optimization_entries INTEGER DEFAULT 1,
        last_mode_transition TIMESTAMP,

        -- Elite mode features
        elite_features_enabled JSONB DEFAULT '{
          "competitive_dashboard": false,
          "ai_citation_tracking": false,
          "trend_alerts": false,
          "score_protection_alerts": true
        }'::jsonb,

        -- Tracked competitors (Elite mode)
        tracked_competitors JSONB DEFAULT '[]'::jsonb,
        competitor_limit INTEGER DEFAULT 3,

        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_user_mode UNIQUE(user_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_modes_user_id
        ON user_modes(user_id);

      CREATE INDEX IF NOT EXISTS idx_user_modes_current_mode
        ON user_modes(current_mode);
    `);

    console.log('✓ user_modes table created\n');

    // =============================================
    // 5. CREATE mode_transition_history TABLE
    // =============================================
    console.log('5. Creating mode_transition_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mode_transition_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Transition details
        from_mode VARCHAR(50),
        to_mode VARCHAR(50) NOT NULL,
        transition_reason VARCHAR(100), -- 'score_threshold', 'manual', 'first_scan'

        -- Score at transition
        score_at_transition INTEGER,
        scan_id INTEGER REFERENCES scans(id),

        -- Notification
        user_notified BOOLEAN DEFAULT false,
        notification_type VARCHAR(50), -- 'improvement_to_elite', 'initial_elite', 'return_to_optimization'
        notification_sent_at TIMESTAMP,

        -- Metadata
        transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mode_transitions_user_id
        ON mode_transition_history(user_id);

      CREATE INDEX IF NOT EXISTS idx_mode_transitions_date
        ON mode_transition_history(transitioned_at DESC);
    `);

    console.log('✓ mode_transition_history table created\n');

    // =============================================
    // 6. CREATE score_history TABLE
    // =============================================
    console.log('6. Creating score_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS score_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,

        -- Overall score
        total_score INTEGER NOT NULL,

        -- Pillar scores
        ai_readability_score INTEGER,
        ai_search_readiness_score INTEGER,
        content_freshness_score INTEGER,
        content_structure_score INTEGER,
        speed_ux_score INTEGER,
        technical_setup_score INTEGER,
        trust_authority_score INTEGER,
        voice_optimization_score INTEGER,

        -- Deltas from previous scan
        score_delta INTEGER,
        recommendations_implemented_count INTEGER DEFAULT 0,
        recommendations_skipped_count INTEGER DEFAULT 0,

        -- Plateau detection
        scans_since_last_significant_improvement INTEGER DEFAULT 0,
        plateau_detected BOOLEAN DEFAULT false,
        plateau_intervention_triggered BOOLEAN DEFAULT false,

        -- Metadata
        scan_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_score_history_user_id
        ON score_history(user_id);

      CREATE INDEX IF NOT EXISTS idx_score_history_scan_date
        ON score_history(scan_date DESC);

      CREATE INDEX IF NOT EXISTS idx_score_history_plateau
        ON score_history(plateau_detected) WHERE plateau_detected = true;
    `);

    console.log('✓ score_history table created\n');

    // =============================================
    // 7. CREATE competitive_tracking TABLE
    // =============================================
    console.log('7. Creating competitive_tracking table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS competitive_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Competitor details
        competitor_name VARCHAR(255) NOT NULL,
        competitor_domain VARCHAR(255) NOT NULL,
        competitor_scan_id INTEGER REFERENCES scans(id),

        -- Tracking status
        is_active BOOLEAN DEFAULT true,
        tracking_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Latest scores
        latest_score INTEGER,
        latest_scan_date TIMESTAMP,

        -- Score tracking
        score_trend VARCHAR(20), -- 'improving', 'declining', 'stable'
        score_change_30d INTEGER DEFAULT 0,
        highest_score_seen INTEGER DEFAULT 0,

        -- Alert settings
        alert_on_improvement BOOLEAN DEFAULT true,
        alert_threshold INTEGER DEFAULT 20,
        last_alert_sent_at TIMESTAMP,

        -- Competitive insights
        areas_they_excel JSONB DEFAULT '[]'::jsonb,
        recent_improvements JSONB DEFAULT '[]'::jsonb,

        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_user_competitor UNIQUE(user_id, competitor_domain)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_competitive_tracking_user_id
        ON competitive_tracking(user_id);

      CREATE INDEX IF NOT EXISTS idx_competitive_tracking_active
        ON competitive_tracking(is_active) WHERE is_active = true;
    `);

    console.log('✓ competitive_tracking table created\n');

    // =============================================
    // 8. CREATE competitive_alerts TABLE
    // =============================================
    console.log('8. Creating competitive_alerts table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS competitive_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        competitive_tracking_id INTEGER NOT NULL REFERENCES competitive_tracking(id) ON DELETE CASCADE,

        -- Alert details
        alert_type VARCHAR(50) NOT NULL, -- 'score_improvement', 'new_schema', 'ranking_change'
        severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

        -- Alert content
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        recommendation TEXT,

        -- Competitive data
        competitor_score_before INTEGER,
        competitor_score_after INTEGER,
        competitor_change_detected JSONB,

        -- User interaction
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        is_dismissed BOOLEAN DEFAULT false,
        dismissed_at TIMESTAMP,

        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_competitive_alerts_user_id
        ON competitive_alerts(user_id);

      CREATE INDEX IF NOT EXISTS idx_competitive_alerts_unread
        ON competitive_alerts(is_read) WHERE is_read = false;
    `);

    console.log('✓ competitive_alerts table created\n');

    // =============================================
    // 9. CREATE recommendation_replacements TABLE
    // =============================================
    console.log('9. Creating recommendation_replacements table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendation_replacements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        refresh_cycle_id INTEGER REFERENCES recommendation_refresh_cycles(id),

        -- Replacement details
        old_recommendation_id INTEGER REFERENCES scan_recommendations(id),
        new_recommendation_id INTEGER REFERENCES scan_recommendations(id),
        replacement_reason VARCHAR(100), -- 'implemented', 'skipped', 'refresh_cycle'

        -- Impact comparison
        old_impact_score DECIMAL(10, 2),
        new_impact_score DECIMAL(10, 2),

        -- Metadata
        replaced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_replacements_user_id
        ON recommendation_replacements(user_id);

      CREATE INDEX IF NOT EXISTS idx_replacements_scan_id
        ON recommendation_replacements(scan_id);
    `);

    console.log('✓ recommendation_replacements table created\n');

    // =============================================
    // 10. CREATE page_selection_history TABLE
    // =============================================
    console.log('10. Creating page_selection_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_selection_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER REFERENCES scans(id),

        -- Page selection changes
        previous_pages JSONB,
        new_pages JSONB,
        pages_added JSONB,
        pages_removed JSONB,

        -- Impact on recommendations
        recommendations_archived INTEGER DEFAULT 0,
        recommendations_kept INTEGER DEFAULT 0,

        -- Grace period (48 hours to revert)
        can_revert_until TIMESTAMP,
        reverted BOOLEAN DEFAULT false,
        reverted_at TIMESTAMP,

        -- Metadata
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_selection_user_id
        ON page_selection_history(user_id);
    `);

    console.log('✓ page_selection_history table created\n');

    // =============================================
    // 11. CREATE user_notifications TABLE
    // =============================================
    console.log('11. Creating user_notifications table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Notification details
        notification_type VARCHAR(50) NOT NULL,
        category VARCHAR(50), -- 'mode_transition', 'detection', 'competitive', 'plateau', 'validation'
        priority VARCHAR(20) DEFAULT 'medium',

        -- Content
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        action_label VARCHAR(100),
        action_url VARCHAR(255),

        -- Related entities
        scan_id INTEGER REFERENCES scans(id),
        recommendation_id INTEGER REFERENCES scan_recommendations(id),

        -- User interaction
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        is_dismissed BOOLEAN DEFAULT false,
        dismissed_at TIMESTAMP,

        -- Delivery
        delivery_method VARCHAR(50) DEFAULT 'in_app', -- 'in_app', 'email', 'both'
        email_sent BOOLEAN DEFAULT false,
        email_sent_at TIMESTAMP,

        -- Metadata
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id
        ON user_notifications(user_id);

      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON user_notifications(is_read) WHERE is_read = false;

      CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON user_notifications(created_at DESC);
    `);

    console.log('✓ user_notifications table created\n');

    // =============================================
    // 12. UPDATE user_progress TABLE
    // =============================================
    console.log('12. Updating user_progress table...');

    await client.query(`
      ALTER TABLE user_progress
      ADD COLUMN IF NOT EXISTS current_mode VARCHAR(50) DEFAULT 'optimization',
      ADD COLUMN IF NOT EXISTS recommendations_implemented INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recommendations_skipped INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recommendations_auto_detected INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_refresh_cycle_date DATE,
      ADD COLUMN IF NOT EXISTS next_refresh_cycle_date DATE,
      ADD COLUMN IF NOT EXISTS plateau_detected BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS plateau_intervention_shown BOOLEAN DEFAULT false
    `);

    console.log('✓ user_progress table updated\n');

    // =============================================
    // 13. CREATE FUNCTIONS AND TRIGGERS
    // =============================================
    console.log('13. Creating helper functions and triggers...');

    // Function to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Add triggers for updated_at
    const tablesWithUpdatedAt = [
      'scan_recommendations',
      'recommendation_refresh_cycles',
      'user_modes',
      'competitive_tracking'
    ];

    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
      `);
    }

    console.log('✓ Functions and triggers created\n');

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
