const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function migrateRecommendationFeedback() {
  try {
    console.log('🔄 Creating recommendation feedback tables...');

    // 1. Recommendation feedback table
    await pool.query(`
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
    `);
    console.log('✅ recommendation_feedback table created');

    // 2. Recommendation interactions table (implicit feedback)
    await pool.query(`
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
    `);
    console.log('✅ recommendation_interactions table created');

    // 3. Recommendation quality metrics (aggregated)
    await pool.query(`
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
    `);
    console.log('✅ recommendation_quality_metrics table created');

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_subfactor
        ON recommendation_feedback(subfactor);

      CREATE INDEX IF NOT EXISTS idx_feedback_rating
        ON recommendation_feedback(rating);

      CREATE INDEX IF NOT EXISTS idx_feedback_created
        ON recommendation_feedback(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_feedback_user
        ON recommendation_feedback(user_id);

      CREATE INDEX IF NOT EXISTS idx_interactions_scan
        ON recommendation_interactions(scan_id);

      CREATE INDEX IF NOT EXISTS idx_interactions_user
        ON recommendation_interactions(user_id);

      CREATE INDEX IF NOT EXISTS idx_quality_subfactor
        ON recommendation_quality_metrics(subfactor);

      CREATE INDEX IF NOT EXISTS idx_quality_period
        ON recommendation_quality_metrics(period_start, period_end);
    `);
    console.log('✅ Indexes created');

    // Create updated_at trigger for recommendation_feedback
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_recommendation_feedback_updated_at
        ON recommendation_feedback;

      CREATE TRIGGER update_recommendation_feedback_updated_at
        BEFORE UPDATE ON recommendation_feedback
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers created');

    console.log('✅ Recommendation feedback migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateRecommendationFeedback();
