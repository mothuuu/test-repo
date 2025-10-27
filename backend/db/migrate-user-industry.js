const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function migrateUserIndustry() {
  try {
    console.log('🔄 Adding industry column to users table...');

    // Add industry column
    await pool.query(`
      DO $$
      BEGIN
        -- Add industry column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='industry'
        ) THEN
          ALTER TABLE users ADD COLUMN industry VARCHAR(100);
          RAISE NOTICE 'Added industry column';
        ELSE
          RAISE NOTICE 'Industry column already exists';
        END IF;

        -- Add industry_custom column for free-form input if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='industry_custom'
        ) THEN
          ALTER TABLE users ADD COLUMN industry_custom TEXT;
          RAISE NOTICE 'Added industry_custom column';
        ELSE
          RAISE NOTICE 'Industry_custom column already exists';
        END IF;
      END $$;
    `);

    console.log('✅ User industry migration completed successfully!');

    // Show sample of users table structure
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Users table structure:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateUserIndustry();
