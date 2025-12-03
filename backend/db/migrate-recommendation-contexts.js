/**
 * Migration: Recommendation Contexts
 *
 * Creates tables for managing recommendation persistence across scans
 * within a 5-day window.
 *
 * Tables created:
 * - recommendation_contexts: Stores context keys and primary scan references
 * - context_scan_links: Links multiple scans to the same context
 * - scan_recommendation_links: Links scans to shared recommendations
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  console.log('🔄 Running recommendation contexts migration...\n');

  try {
    // ============================================
    // STEP 1: Create recommendation_contexts table
    // ============================================
    console.log('📝 Step 1: Creating recommendation_contexts table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendation_contexts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        context_key VARCHAR(64) NOT NULL,
        primary_scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
        domain VARCHAR(255) NOT NULL,
        pages_hash VARCHAR(32),

        -- Lifecycle
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        expired_at TIMESTAMP,

        -- Unique constraint: one active context per user + key
        UNIQUE(user_id, context_key)
      )
    `);

    console.log('   ✅ recommendation_contexts table created');

    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rec_contexts_user_active
        ON recommendation_contexts(user_id, is_active, expires_at);
      CREATE INDEX IF NOT EXISTS idx_rec_contexts_key
        ON recommendation_contexts(context_key);
      CREATE INDEX IF NOT EXISTS idx_rec_contexts_primary_scan
        ON recommendation_contexts(primary_scan_id);
    `);

    console.log('   ✅ Indexes created\n');

    // ============================================
    // STEP 2: Create context_scan_links table
    // ============================================
    console.log('📝 Step 2: Creating context_scan_links table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS context_scan_links (
        id SERIAL PRIMARY KEY,
        context_id INTEGER NOT NULL REFERENCES recommendation_contexts(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Each scan can only be linked to one context
        UNIQUE(context_id, scan_id)
      )
    `);

    console.log('   ✅ context_scan_links table created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_context_scan_links_scan
        ON context_scan_links(scan_id);
      CREATE INDEX IF NOT EXISTS idx_context_scan_links_context
        ON context_scan_links(context_id);
    `);

    console.log('   ✅ Indexes created\n');

    // ============================================
    // STEP 3: Create scan_recommendation_links table
    // ============================================
    console.log('📝 Step 3: Creating scan_recommendation_links table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_recommendation_links (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        recommendation_id INTEGER NOT NULL REFERENCES scan_recommendations(id) ON DELETE CASCADE,
        source_scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Each scan-recommendation pair is unique
        UNIQUE(scan_id, recommendation_id)
      )
    `);

    console.log('   ✅ scan_recommendation_links table created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_rec_links_scan
        ON scan_recommendation_links(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_rec_links_rec
        ON scan_recommendation_links(recommendation_id);
    `);

    console.log('   ✅ Indexes created\n');

    // ============================================
    // STEP 4: Add trigger for updated_at
    // ============================================
    console.log('📝 Step 4: Adding update triggers...');

    // First ensure the trigger function exists
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_recommendation_contexts_updated_at ON recommendation_contexts;
      CREATE TRIGGER update_recommendation_contexts_updated_at
        BEFORE UPDATE ON recommendation_contexts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('   ✅ Update trigger added\n');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 RECOMMENDATION CONTEXTS MIGRATION COMPLETE! 🎉');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📊 Tables Created:');
    console.log('   1. recommendation_contexts');
    console.log('      - Stores context keys (user + domain + pages)');
    console.log('      - Links to primary scan that owns recommendations');
    console.log('      - 5-day expiration tracking');
    console.log('   2. context_scan_links');
    console.log('      - Links multiple scans to same context');
    console.log('   3. scan_recommendation_links');
    console.log('      - Links scans to shared recommendations\n');

    console.log('🎯 This enables:');
    console.log('   - Same recommendations for 5 days');
    console.log('   - Multiple scans sharing one recommendation set');
    console.log('   - Score updates without recommendation regeneration\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
