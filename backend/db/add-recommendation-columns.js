const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addColumns() {
  try {
    console.log('📝 Adding new columns to scan_recommendations table...');
    
    await pool.query(`
      ALTER TABLE scan_recommendations 
      ADD COLUMN IF NOT EXISTS action_steps JSONB,
      ADD COLUMN IF NOT EXISTS findings TEXT,
      ADD COLUMN IF NOT EXISTS code_snippet TEXT;
    `);
    
    console.log('✅ Columns added successfully!');
    
    // Also add faq_schema column to scans table
    await pool.query(`
      ALTER TABLE scans
      ADD COLUMN IF NOT EXISTS faq_schema JSONB;
    `);
    
    console.log('✅ FAQ schema column added to scans table!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

addColumns();