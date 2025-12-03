/**
 * Migration: Add Score Tracking to Recommendations
 *
 * This migration adds fields to track score changes when recommendations
 * are implemented, enabling "This rec improved your score by X points" insights.
 *
 * Run: node backend/db/migrate-score-tracking.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting score tracking migration...\n');

    await client.query('BEGIN');

    // ============================================
    // 1. Add score tracking fields to scan_recommendations
    // ============================================
    console.log('1️⃣  Adding score tracking fields to scan_recommendations...');

    // Score at creation - captured when recommendation is generated
    await client.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS score_at_creation INTEGER
    `);

    // Score at implementation - captured when user marks as implemented
    await client.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS score_at_implementation INTEGER
    `);

    // Score improvement - calculated delta (can be null until next scan)
    await client.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS score_improvement INTEGER
    `);

    // Source scan ID - the scan that originally created this recommendation
    await client.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS source_scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL
    `);

    // Context ID - links to the 5-day recommendation context
    await client.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS context_id INTEGER
    `);

    console.log('   ✅ Score tracking fields added\n');

    // ============================================
    // 2. Add score tracking to recommendation_contexts
    // ============================================
    console.log('2️⃣  Adding score tracking to recommendation_contexts...');

    await client.query(`
      ALTER TABLE recommendation_contexts
      ADD COLUMN IF NOT EXISTS initial_score INTEGER
    `);

    await client.query(`
      ALTER TABLE recommendation_contexts
      ADD COLUMN IF NOT EXISTS latest_score INTEGER
    `);

    await client.query(`
      ALTER TABLE recommendation_contexts
      ADD COLUMN IF NOT EXISTS score_change INTEGER
    `);

    console.log('   ✅ Context score tracking fields added\n');

    // ============================================
    // 3. Create score history table for detailed tracking
    // ============================================
    console.log('3️⃣  Creating recommendation_score_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendation_score_history (
        id SERIAL PRIMARY KEY,
        recommendation_id INTEGER NOT NULL REFERENCES scan_recommendations(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        context_id INTEGER,
        event_type VARCHAR(50) NOT NULL, -- 'created', 'implemented', 'verified', 'score_update'
        score_before INTEGER,
        score_after INTEGER,
        score_delta INTEGER,
        category_scores JSONB, -- Store category breakdown for detailed analysis
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // Index for quick lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rec_score_history_rec
      ON recommendation_score_history(recommendation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rec_score_history_context
      ON recommendation_score_history(context_id)
    `);

    console.log('   ✅ Score history table created\n');

    // ============================================
    // 4. Add context_id foreign key constraint (if table exists)
    // ============================================
    console.log('4️⃣  Adding context_id foreign key...');

    // Check if recommendation_contexts exists before adding FK
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'recommendation_contexts'
      )
    `);

    if (tableExists.rows[0].exists) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_scan_rec_context'
          ) THEN
            ALTER TABLE scan_recommendations
            ADD CONSTRAINT fk_scan_rec_context
            FOREIGN KEY (context_id)
            REFERENCES recommendation_contexts(id) ON DELETE SET NULL;
          END IF;
        END $$
      `);
      console.log('   ✅ Foreign key added\n');
    } else {
      console.log('   ⚠️  recommendation_contexts table not found, skipping FK\n');
    }

    // ============================================
    // 5. Backfill source_scan_id for existing recommendations
    // ============================================
    console.log('5️⃣  Backfilling source_scan_id for existing recommendations...');

    await client.query(`
      UPDATE scan_recommendations
      SET source_scan_id = scan_id
      WHERE source_scan_id IS NULL
    `);

    console.log('   ✅ Backfill complete\n');

    await client.query('COMMIT');

    console.log('═'.repeat(50));
    console.log('✅ MIGRATION COMPLETE');
    console.log('═'.repeat(50));
    console.log(`
New fields added to scan_recommendations:
  - score_at_creation: Score when rec was generated
  - score_at_implementation: Score when user marked implemented
  - score_improvement: Delta between scores
  - source_scan_id: Original scan that created this rec
  - context_id: Links to 5-day recommendation context

New table: recommendation_score_history
  - Tracks all score events for recommendations
  - Enables "This rec improved your score by X" insights
`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
