const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function migrateAdminSystem() {
  try {
    console.log('🔄 Creating admin system tables...');

    // 1. Add role column to users table
    await pool.query(`
      DO $$
      BEGIN
        -- Add role column (super_admin, content_manager, system_admin, support_agent, analyst, user)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
          RAISE NOTICE 'Added role column to users';
        ELSE
          RAISE NOTICE 'Role column already exists';
        END IF;

        -- Add last_ip column for security tracking
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='last_ip'
        ) THEN
          ALTER TABLE users ADD COLUMN last_ip VARCHAR(45);
          RAISE NOTICE 'Added last_ip column to users';
        ELSE
          RAISE NOTICE 'last_ip column already exists';
        END IF;

        -- Add last_login_location column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='last_login_location'
        ) THEN
          ALTER TABLE users ADD COLUMN last_login_location TEXT;
          RAISE NOTICE 'Added last_login_location column to users';
        ELSE
          RAISE NOTICE 'last_login_location column already exists';
        END IF;
      END $$;
    `);
    console.log('✅ Users table updated with admin fields');

    // 2. Create admin_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,

        -- Session metadata
        ip_address VARCHAR(45),
        user_agent TEXT,
        location TEXT,

        -- Session timing
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW(),

        -- Session status
        is_active BOOLEAN DEFAULT TRUE,
        logout_at TIMESTAMP
      );
    `);
    console.log('✅ admin_sessions table created');

    // 3. Create audit_log table (immutable record of all admin actions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,

        -- Who did it
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        admin_email VARCHAR(255),
        admin_role VARCHAR(50),

        -- What they did
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,

        -- Details
        description TEXT,
        changes JSONB,
        metadata JSONB,

        -- When and where
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ audit_log table created');

    // 4. Create recommendation_curation table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendation_curation (
        id SERIAL PRIMARY KEY,
        recommendation_id TEXT NOT NULL,
        scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
        subfactor VARCHAR(100),

        -- Original AI output
        original_title TEXT,
        original_content TEXT,
        original_priority VARCHAR(50),
        original_effort VARCHAR(100),
        original_impact INTEGER,

        -- Admin edits
        edited_title TEXT,
        edited_content TEXT,
        edited_priority VARCHAR(50),
        edited_effort VARCHAR(100),
        edited_impact INTEGER,
        curator_id INTEGER REFERENCES users(id),
        curator_notes TEXT,

        -- Quality scores (0-100)
        quality_score INTEGER,
        clarity_score INTEGER,
        actionability_score INTEGER,
        specificity_score INTEGER,
        relevance_score INTEGER,

        -- Auto-flagging
        is_flagged BOOLEAN DEFAULT FALSE,
        flag_reason TEXT,
        quality_issues TEXT[],

        -- Status workflow
        status VARCHAR(50) DEFAULT 'pending',

        -- User feedback aggregates (from recommendation_feedback table)
        avg_rating DECIMAL(3,2),
        helpful_count INTEGER DEFAULT 0,
        not_helpful_count INTEGER DEFAULT 0,
        implementation_count INTEGER DEFAULT 0,
        feedback_count INTEGER DEFAULT 0,

        -- User interaction aggregates (from recommendation_interactions table)
        view_count INTEGER DEFAULT 0,
        expand_count INTEGER DEFAULT 0,
        copy_count INTEGER DEFAULT 0,
        avg_time_spent DECIMAL(8,2),

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ recommendation_curation table created');

    // 5. Create training_examples table (approved recommendations for AI training)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_examples (
        id SERIAL PRIMARY KEY,
        curation_id INTEGER REFERENCES recommendation_curation(id),
        subfactor VARCHAR(100) NOT NULL,
        industry VARCHAR(100),

        -- The "good" example
        example_title TEXT NOT NULL,
        example_content TEXT NOT NULL,
        example_priority VARCHAR(50),
        example_effort VARCHAR(100),
        example_impact INTEGER,

        -- Why it's good
        quality_score INTEGER,
        approval_reason TEXT,
        user_feedback_summary TEXT,

        -- What makes it work (boolean flags for training)
        has_numbered_steps BOOLEAN DEFAULT FALSE,
        mentions_ai_engines BOOLEAN DEFAULT FALSE,
        includes_code_examples BOOLEAN DEFAULT FALSE,
        has_time_estimate BOOLEAN DEFAULT FALSE,
        has_expected_impact BOOLEAN DEFAULT FALSE,
        avoids_generic_phrases BOOLEAN DEFAULT FALSE,
        industry_specific BOOLEAN DEFAULT FALSE,

        -- Training metadata
        used_for_training BOOLEAN DEFAULT FALSE,
        times_used_as_template INTEGER DEFAULT 0,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ training_examples table created');

    // 6. Create training_negative_examples table (rejected recommendations)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_negative_examples (
        id SERIAL PRIMARY KEY,
        curation_id INTEGER REFERENCES recommendation_curation(id),
        subfactor VARCHAR(100),

        -- The "bad" example
        bad_example_title TEXT,
        bad_example_content TEXT NOT NULL,

        -- Why it was rejected
        rejection_reason TEXT NOT NULL,
        quality_issues TEXT[],

        -- Quality scores that failed
        clarity_score INTEGER,
        actionability_score INTEGER,
        specificity_score INTEGER,
        relevance_score INTEGER,

        -- What was wrong (for AI to learn)
        is_too_generic BOOLEAN DEFAULT FALSE,
        lacks_action_steps BOOLEAN DEFAULT FALSE,
        no_ai_focus BOOLEAN DEFAULT FALSE,
        not_industry_relevant BOOLEAN DEFAULT FALSE,
        unclear_impact BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ training_negative_examples table created');

    // 7. Create IP whitelist table (for security)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ip_whitelist (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL UNIQUE,
        description TEXT,
        admin_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ ip_whitelist table created');

    // 8. Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);

      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

      CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

      CREATE INDEX IF NOT EXISTS idx_curation_status ON recommendation_curation(status);
      CREATE INDEX IF NOT EXISTS idx_curation_flagged ON recommendation_curation(is_flagged);
      CREATE INDEX IF NOT EXISTS idx_curation_subfactor ON recommendation_curation(subfactor);
      CREATE INDEX IF NOT EXISTS idx_curation_quality ON recommendation_curation(quality_score);
      CREATE INDEX IF NOT EXISTS idx_curation_curator ON recommendation_curation(curator_id);

      CREATE INDEX IF NOT EXISTS idx_training_subfactor ON training_examples(subfactor);
      CREATE INDEX IF NOT EXISTS idx_training_industry ON training_examples(industry);
      CREATE INDEX IF NOT EXISTS idx_training_quality ON training_examples(quality_score);

      CREATE INDEX IF NOT EXISTS idx_negative_subfactor ON training_negative_examples(subfactor);
    `);
    console.log('✅ Indexes created');

    // 9. Create function and triggers for updated_at
    // First create the function if it doesn't exist
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ update_updated_at_column function created');

    await pool.query(`
      DROP TRIGGER IF EXISTS update_admin_sessions_last_activity ON admin_sessions;
      CREATE TRIGGER update_admin_sessions_last_activity
        BEFORE UPDATE ON admin_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_recommendation_curation_updated_at ON recommendation_curation;
      CREATE TRIGGER update_recommendation_curation_updated_at
        BEFORE UPDATE ON recommendation_curation
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_training_examples_updated_at ON training_examples;
      CREATE TRIGGER update_training_examples_updated_at
        BEFORE UPDATE ON training_examples
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_ip_whitelist_updated_at ON ip_whitelist;
      CREATE TRIGGER update_ip_whitelist_updated_at
        BEFORE UPDATE ON ip_whitelist
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers created');

    console.log('\n🎉 Admin system migration completed successfully!');
    console.log('\n📋 Tables created:');
    console.log('  ✅ users (updated with role column)');
    console.log('  ✅ admin_sessions');
    console.log('  ✅ audit_log');
    console.log('  ✅ recommendation_curation');
    console.log('  ✅ training_examples');
    console.log('  ✅ training_negative_examples');
    console.log('  ✅ ip_whitelist');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateAdminSystem();
