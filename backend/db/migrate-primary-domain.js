const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function migratePrimaryDomain() {
  try {
    console.log('🔄 Adding primary domain tracking to users and scans tables...');

    // Add columns to users table
    await pool.query(`
      DO $$
      BEGIN
        -- Add primary_domain column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='primary_domain'
        ) THEN
          ALTER TABLE users ADD COLUMN primary_domain VARCHAR(255);
          RAISE NOTICE 'Added primary_domain column to users';
        ELSE
          RAISE NOTICE 'primary_domain column already exists';
        END IF;

        -- Add competitor_scans_used_this_month column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='competitor_scans_used_this_month'
        ) THEN
          ALTER TABLE users ADD COLUMN competitor_scans_used_this_month INTEGER DEFAULT 0;
          RAISE NOTICE 'Added competitor_scans_used_this_month column to users';
        ELSE
          RAISE NOTICE 'competitor_scans_used_this_month column already exists';
        END IF;

        -- Add primary_domain_changed_at column (to enforce once per month limit)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='primary_domain_changed_at'
        ) THEN
          ALTER TABLE users ADD COLUMN primary_domain_changed_at TIMESTAMP;
          RAISE NOTICE 'Added primary_domain_changed_at column to users';
        ELSE
          RAISE NOTICE 'primary_domain_changed_at column already exists';
        END IF;
      END $$;
    `);

    // Add columns to scans table
    await pool.query(`
      DO $$
      BEGIN
        -- Add domain_type column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='domain_type'
        ) THEN
          ALTER TABLE scans ADD COLUMN domain_type VARCHAR(50);
          RAISE NOTICE 'Added domain_type column to scans';
        ELSE
          RAISE NOTICE 'domain_type column already exists';
        END IF;

        -- Add extracted_domain column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='extracted_domain'
        ) THEN
          ALTER TABLE scans ADD COLUMN extracted_domain VARCHAR(255);
          RAISE NOTICE 'Added extracted_domain column to scans';
        ELSE
          RAISE NOTICE 'extracted_domain column already exists';
        END IF;
      END $$;
    `);

    console.log('✅ Primary domain migration completed successfully!');

    // Show updated users table structure
    const usersResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('primary_domain', 'competitor_scans_used_this_month', 'primary_domain_changed_at')
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Users table - New columns:');
    usersResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    });

    // Show updated scans table structure
    const scansResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'scans'
      AND column_name IN ('domain_type', 'extracted_domain')
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Scans table - New columns:');
    scansResult.rows.forEach(col => {
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
migratePrimaryDomain();
