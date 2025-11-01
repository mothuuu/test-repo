const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function migrateCompetitiveAnalysis() {
  try {
    console.log('🔄 Setting up competitive analysis tables...\n');

    // 1. Competitor Comparisons Table - Store comparison reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitor_comparisons (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Scans being compared
        primary_scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        competitor_scan_ids INTEGER[] NOT NULL,

        -- Comparison metadata
        comparison_name VARCHAR(255),
        primary_domain VARCHAR(255) NOT NULL,
        competitor_domains TEXT[] NOT NULL,

        -- Analysis results (JSONB for flexibility)
        executive_summary TEXT,
        gap_analysis JSONB,
        competitive_recommendations JSONB,
        roadmap JSONB,
        benchmark_data JSONB,

        -- Overall metrics
        overall_rank INTEGER,
        categories_leading INTEGER DEFAULT 0,
        categories_trailing INTEGER DEFAULT 0,
        total_score_gap INTEGER,

        -- Status & metadata
        status VARCHAR(50) DEFAULT 'completed',
        pdf_url VARCHAR(500),

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ competitor_comparisons table created');

    // 2. Competitive Insights Table - Granular insights for each comparison
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitive_insights (
        id SERIAL PRIMARY KEY,
        comparison_id INTEGER NOT NULL REFERENCES competitor_comparisons(id) ON DELETE CASCADE,

        -- Insight classification
        insight_type VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,

        -- Competitor reference
        competitor_scan_id INTEGER REFERENCES scans(id),
        competitor_domain VARCHAR(255),

        -- Insight details
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        score_gap INTEGER,

        -- Actionability
        impact_score INTEGER,
        priority VARCHAR(20) DEFAULT 'medium',
        estimated_effort VARCHAR(20),
        quick_win BOOLEAN DEFAULT false,

        -- Specific actions
        action_items JSONB,
        code_examples JSONB,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ competitive_insights table created');

    // 3. Comparison History Table - Track competitive position over time
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comparison_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Domains being tracked
        primary_domain VARCHAR(255) NOT NULL,
        competitor_domain VARCHAR(255) NOT NULL,

        -- Score tracking
        primary_scan_id INTEGER REFERENCES scans(id),
        competitor_scan_id INTEGER REFERENCES scans(id),
        primary_total_score INTEGER NOT NULL,
        competitor_total_score INTEGER NOT NULL,
        score_delta INTEGER NOT NULL,

        -- Category-level tracking
        category_deltas JSONB NOT NULL,

        -- Trend analysis
        trend VARCHAR(20),
        rank_position INTEGER,
        categories_ahead INTEGER DEFAULT 0,
        categories_behind INTEGER DEFAULT 0,

        -- Measurement metadata
        measurement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        comparison_id INTEGER REFERENCES competitor_comparisons(id)
      );
    `);
    console.log('✅ comparison_history table created');

    // 4. Benchmark Data Table - Industry benchmarks (when user provides them)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS benchmark_data (
        id SERIAL PRIMARY KEY,

        -- Industry classification
        industry VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,

        -- Benchmark scores
        avg_score INTEGER NOT NULL,
        percentile_25 INTEGER,
        percentile_50 INTEGER,
        percentile_75 INTEGER,
        percentile_90 INTEGER,
        percentile_95 INTEGER,

        -- Data quality
        sample_size INTEGER DEFAULT 0,
        confidence_level VARCHAR(20),

        -- Source & freshness
        source VARCHAR(100) DEFAULT 'manual',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Additional context
        notes TEXT,
        metadata JSONB,

        UNIQUE(industry, category)
      );
    `);
    console.log('✅ benchmark_data table created');

    // 5. Competitive Recommendations Tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitive_recommendations (
        id SERIAL PRIMARY KEY,
        comparison_id INTEGER NOT NULL REFERENCES competitor_comparisons(id) ON DELETE CASCADE,
        insight_id INTEGER REFERENCES competitive_insights(id),

        -- Recommendation details
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        rationale TEXT,

        -- Competitive context
        competitor_domain VARCHAR(255),
        what_competitor_does_better TEXT,

        -- Implementation
        priority INTEGER DEFAULT 3,
        estimated_impact VARCHAR(20),
        estimated_effort VARCHAR(20),
        implementation_steps JSONB,
        code_snippets JSONB,
        resources JSONB,

        -- User tracking
        status VARCHAR(50) DEFAULT 'pending',
        implemented_at TIMESTAMP,
        user_notes TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ competitive_recommendations table created');

    // Create indexes for performance
    await pool.query(`
      -- Comparison indexes
      CREATE INDEX IF NOT EXISTS idx_competitor_comparisons_user_id
        ON competitor_comparisons(user_id);
      CREATE INDEX IF NOT EXISTS idx_competitor_comparisons_created_at
        ON competitor_comparisons(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_competitor_comparisons_primary_scan
        ON competitor_comparisons(primary_scan_id);

      -- Insights indexes
      CREATE INDEX IF NOT EXISTS idx_competitive_insights_comparison_id
        ON competitive_insights(comparison_id);
      CREATE INDEX IF NOT EXISTS idx_competitive_insights_type
        ON competitive_insights(insight_type);
      CREATE INDEX IF NOT EXISTS idx_competitive_insights_priority
        ON competitive_insights(priority);

      -- History indexes
      CREATE INDEX IF NOT EXISTS idx_comparison_history_user_domain
        ON comparison_history(user_id, primary_domain, competitor_domain);
      CREATE INDEX IF NOT EXISTS idx_comparison_history_measurement_date
        ON comparison_history(measurement_date DESC);
      CREATE INDEX IF NOT EXISTS idx_comparison_history_primary_domain
        ON comparison_history(primary_domain);

      -- Benchmark indexes
      CREATE INDEX IF NOT EXISTS idx_benchmark_data_industry
        ON benchmark_data(industry);
      CREATE INDEX IF NOT EXISTS idx_benchmark_data_category
        ON benchmark_data(category);

      -- Recommendations indexes
      CREATE INDEX IF NOT EXISTS idx_competitive_recommendations_comparison_id
        ON competitive_recommendations(comparison_id);
      CREATE INDEX IF NOT EXISTS idx_competitive_recommendations_status
        ON competitive_recommendations(status);
    `);
    console.log('✅ Indexes created');

    // Add trigger to update updated_at timestamp
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_competitor_comparisons_updated_at ON competitor_comparisons;
      CREATE TRIGGER update_competitor_comparisons_updated_at
        BEFORE UPDATE ON competitor_comparisons
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_competitive_recommendations_updated_at ON competitive_recommendations;
      CREATE TRIGGER update_competitive_recommendations_updated_at
        BEFORE UPDATE ON competitive_recommendations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers created');

    // Show table summaries
    console.log('\n📊 Competitive Analysis Schema Summary:\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Table: competitor_comparisons                               │');
    console.log('│ Purpose: Store complete comparison reports                  │');
    console.log('│ Key fields: primary_scan_id, competitor_scan_ids,           │');
    console.log('│             executive_summary, gap_analysis, roadmap        │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Table: competitive_insights                                 │');
    console.log('│ Purpose: Granular insights (gaps, opportunities, strengths) │');
    console.log('│ Key fields: insight_type, category, score_gap, priority     │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Table: comparison_history                                   │');
    console.log('│ Purpose: Track competitive position over time               │');
    console.log('│ Key fields: score_delta, category_deltas, trend             │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Table: benchmark_data                                       │');
    console.log('│ Purpose: Store industry benchmark scores                    │');
    console.log('│ Key fields: industry, category, percentile scores           │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Table: competitive_recommendations                          │');
    console.log('│ Purpose: Actionable recommendations to beat competitors     │');
    console.log('│ Key fields: title, what_competitor_does_better, priority    │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    console.log('\n✅ Competitive analysis migration completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateCompetitiveAnalysis();
