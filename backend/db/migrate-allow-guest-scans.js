require('dotenv').config();
const db = require('./database');

/**
 * Migration: Allow guest scans (user_id can be NULL)
 *
 * Problem: The scans table was created with user_id INTEGER NOT NULL,
 * which prevents saving anonymous/guest scans with user_id = NULL.
 *
 * Fix: Remove the NOT NULL constraint on user_id column to allow guest scans.
 * The foreign key relationship is maintained, it just becomes optional.
 */
async function allowGuestScans() {
  console.log('🔄 Starting guest scans migration...\n');

  try {
    // Check if user_id column currently has NOT NULL constraint
    const checkConstraint = await db.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'scans'
      AND column_name = 'user_id'
    `);

    if (checkConstraint.rows.length === 0) {
      console.error('❌ Error: scans table or user_id column not found');
      process.exit(1);
    }

    const isNullable = checkConstraint.rows[0].is_nullable;
    console.log(`   Current state: user_id is_nullable = "${isNullable}"`);

    if (isNullable === 'YES') {
      console.log('✅ user_id already allows NULL - migration not needed');
      console.log('   Guest scans should already work!\n');
      process.exit(0);
    }

    console.log('   Removing NOT NULL constraint from user_id...');

    // Remove NOT NULL constraint
    // This allows user_id to be NULL for guest scans
    // Foreign key relationship is maintained for non-NULL values
    await db.query(`
      ALTER TABLE scans
      ALTER COLUMN user_id DROP NOT NULL
    `);

    console.log('✅ NOT NULL constraint removed from user_id');

    // Verify the change
    const verifyChange = await db.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'scans'
      AND column_name = 'user_id'
    `);

    const newNullable = verifyChange.rows[0].is_nullable;
    console.log(`   Verified: user_id is_nullable = "${newNullable}"`);

    if (newNullable === 'YES') {
      console.log('\n🎉 Migration complete! Guest scans are now enabled.\n');
      console.log('📝 What changed:');
      console.log('   - user_id can now be NULL (for anonymous/guest scans)');
      console.log('   - Foreign key relationship still enforced when user_id is set');
      console.log('   - Guest scans will be saved to database for analytics\n');
      console.log('✅ You can now perform guest scans and they will appear in admin console!');
    } else {
      console.error('⚠️  Migration ran but verification failed');
      console.error('   Expected is_nullable = YES, got:', newNullable);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  }
}

// Run migration
allowGuestScans();
