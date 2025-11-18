/**
 * Fix user_progress table - Add missing columns
 *
 * This migration adds columns that are referenced in the code but missing from the schema
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixUserProgressColumns() {
  console.log('🔧 Fixing user_progress table - Adding missing columns...\n');

  try {
    // Add all missing columns that are referenced in hybrid-recommendation-helper.js
    console.log('📝 Adding missing columns to user_progress table...');

    await pool.query(`
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
    `);

    console.log('✅ Added columns:');
    console.log('   - site_wide_total (INTEGER)');
    console.log('   - site_wide_completed (INTEGER)');
    console.log('   - site_wide_active (INTEGER)');
    console.log('   - page_specific_total (INTEGER)');
    console.log('   - page_specific_completed (INTEGER)');
    console.log('   - site_wide_complete (BOOLEAN)');
    console.log('   - batch_1_unlock_date (TIMESTAMP)');
    console.log('   - batch_2_unlock_date (TIMESTAMP)');
    console.log('   - batch_3_unlock_date (TIMESTAMP)');
    console.log('   - batch_4_unlock_date (TIMESTAMP)');
    console.log('   - total_batches (INTEGER)');
    console.log('   - next_replacement_date (DATE)\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 MIGRATION COMPLETE! 🎉');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('✅ user_progress table is now compatible with hybrid recommendation system\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixUserProgressColumns();
