/**
 * Migration: Add paused column to users table
 * Run this in Render Shell: node backend/db/migrate-add-paused-column.js
 */

const db = require('./database');

async function runMigration() {
  console.log('🚀 Starting migration: Add paused column to users table...\n');

  try {
    // Add paused column to users table
    console.log('1️⃣  Adding paused column to users table...');
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Paused column added\n');

    // Add index for performance (optional but recommended)
    console.log('2️⃣  Creating index on paused column...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_paused ON users(paused);
    `);
    console.log('✅ Index created\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('📊 New feature enabled:');
    console.log('   ✓ Pause/Resume user accounts\n');

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
