/**
 * Migration: Add Batch Unlock System
 *
 * Enables automatic batch unlock every 5 days
 * - Batch 1 unlocks immediately on scan
 * - Batch 2 unlocks after 5 days
 * - Batch 3 unlocks after 10 days
 * - Batch 4 unlocks after 15 days
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateBatchUnlock() {
  try {
    console.log('🔄 Adding batch unlock system columns...\n');

    // Add batch unlock dates to user_progress table
    await pool.query(`
      ALTER TABLE user_progress
      ADD COLUMN IF NOT EXISTS batch_1_unlock_date TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS batch_2_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_3_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_4_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 0;
    `);

    console.log('✅ Added columns to user_progress:');
    console.log('   - batch_1_unlock_date (unlocks immediately)');
    console.log('   - batch_2_unlock_date (unlocks after 5 days)');
    console.log('   - batch_3_unlock_date (unlocks after 10 days)');
    console.log('   - batch_4_unlock_date (unlocks after 15 days)');
    console.log('   - total_batches (how many batches available)\n');

    // Add skip tracking columns to scan_recommendations
    await pool.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1;
    `);

    console.log('✅ Added columns to scan_recommendations:');
    console.log('   - skipped_at (when user skipped this recommendation)');
    console.log('   - batch_number (which batch this recommendation belongs to)\n');

    // Create index for batch queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendations_batch
        ON scan_recommendations(scan_id, batch_number);
    `);

    console.log('✅ Created performance index for batch queries\n');

    console.log('🎉 Batch unlock system migration complete!');
    console.log('\nBatch unlock logic:');
    console.log('  - Users get 5 recommendations per batch');
    console.log('  - New batch unlocks automatically every 5 days');
    console.log('  - Users can skip recommendations (moved to "Skipped" tab)');
    console.log('  - Skipped recommendations count toward progress\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

migrateBatchUnlock();
