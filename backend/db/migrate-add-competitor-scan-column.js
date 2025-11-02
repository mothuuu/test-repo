/**
 * Migration: Add is_competitor_scan column to scans table
 * Run this in Render Shell: node db/migrate-add-competitor-scan-column.js
 */

const db = require('./database');

async function runMigration() {
  console.log('🚀 Starting migration: Add is_competitor_scan column to scans table...\n');

  try {
    // Add is_competitor_scan column to scans table
    console.log('1️⃣  Adding is_competitor_scan column to scans table...');
    await db.query(`
      ALTER TABLE scans
      ADD COLUMN IF NOT EXISTS is_competitor_scan BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ is_competitor_scan column added\n');

    // Add index for performance (optional but recommended)
    console.log('2️⃣  Creating index on is_competitor_scan column...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_scans_is_competitor ON scans(is_competitor_scan);
    `);
    console.log('✅ Index created\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('📊 New feature enabled:');
    console.log('   ✓ Track competitor scans separately from own site scans\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
