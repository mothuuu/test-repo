require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

async function migrateHistoricComparison() {
  let client;

  try {
    client = await pool.connect();
    console.log('🔄 Starting historic comparison migration...');

    // Start transaction
    await client.query('BEGIN');

    // 1. Add domain column to scans table (extracted root domain)
    console.log('  📝 Adding domain column to scans table...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='domain'
        ) THEN
          ALTER TABLE scans ADD COLUMN domain VARCHAR(255);
          CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(user_id, domain, created_at DESC);
          RAISE NOTICE 'Added domain column and index';
        ELSE
          RAISE NOTICE 'domain column already exists';
        END IF;
      END $$;
    `);

    // 2. Add previous_scan_id column to scans table (links to previous scan)
    console.log('  🔗 Adding previous_scan_id column to scans table...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='previous_scan_id'
        ) THEN
          ALTER TABLE scans ADD COLUMN previous_scan_id INTEGER REFERENCES scans(id);
          CREATE INDEX IF NOT EXISTS idx_scans_previous ON scans(previous_scan_id);
          RAISE NOTICE 'Added previous_scan_id column and index';
        ELSE
          RAISE NOTICE 'previous_scan_id column already exists';
        END IF;
      END $$;
    `);

    // 3. Add comparison_data column to scans table (stores comparison results as JSON)
    console.log('  📊 Adding comparison_data column to scans table...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='comparison_data'
        ) THEN
          ALTER TABLE scans ADD COLUMN comparison_data JSONB;
          RAISE NOTICE 'Added comparison_data column';
        ELSE
          RAISE NOTICE 'comparison_data column already exists';
        END IF;
      END $$;
    `);

    // 4. Backfill domain for existing scans (extract from URL)
    console.log('  🔄 Backfilling domain for existing scans...');
    const backfillResult = await client.query(`
      UPDATE scans
      SET domain = CASE
        WHEN url ~ '^https?://([^/]+)' THEN
          regexp_replace(
            regexp_replace(
              substring(url from '^https?://([^/]+)'),
              '^www\\.', ''
            ),
            ':\\d+$', ''
          )
        ELSE NULL
      END
      WHERE domain IS NULL AND url IS NOT NULL
    `);
    console.log(`  ✅ Backfilled domain for ${backfillResult.rowCount} scans`);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Historic comparison migration completed successfully!');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
migrateHistoricComparison()
  .then(() => {
    console.log('🎉 Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
