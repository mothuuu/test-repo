const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addStructuredColumns() {
  try {
    console.log('📝 Adding structured recommendation columns to scan_recommendations table...');

    await pool.query(`
      ALTER TABLE scan_recommendations
      ADD COLUMN IF NOT EXISTS customized_implementation TEXT,
      ADD COLUMN IF NOT EXISTS ready_to_use_content TEXT,
      ADD COLUMN IF NOT EXISTS implementation_notes JSONB,
      ADD COLUMN IF NOT EXISTS quick_wins JSONB,
      ADD COLUMN IF NOT EXISTS validation_checklist JSONB;
    `);

    console.log('✅ Structured columns added successfully!');
    console.log('  - customized_implementation: TEXT (before/after HTML, specific changes)');
    console.log('  - ready_to_use_content: TEXT (FAQ copy, alt text examples, etc.)');
    console.log('  - implementation_notes: JSONB array (bullet points)');
    console.log('  - quick_wins: JSONB array (3-5 quick actions)');
    console.log('  - validation_checklist: JSONB array (checkboxes)');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

addStructuredColumns();
