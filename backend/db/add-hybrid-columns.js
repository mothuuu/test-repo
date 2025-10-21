const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addHybridColumns() {
  try {
    console.log('📝 Adding hybrid recommendation columns...\n');
    
    // Add columns to scan_recommendations table
    await pool.query(`
      ALTER TABLE scan_recommendations 
      ADD COLUMN IF NOT EXISTS recommendation_type VARCHAR(20) DEFAULT 'site-wide',
      ADD COLUMN IF NOT EXISTS page_url TEXT,
      ADD COLUMN IF NOT EXISTS page_priority INTEGER,
      ADD COLUMN IF NOT EXISTS skip_enabled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS state VARCHAR(20) DEFAULT 'locked';
    `);
    
    console.log('✅ Added columns to scan_recommendations:');
    console.log('   - recommendation_type (site-wide or page-specific)');
    console.log('   - page_url (NULL for site-wide, URL for page-specific)');
    console.log('   - page_priority (1-5 for page ordering)');
    console.log('   - skip_enabled_at (when skip unlocks)');
    console.log('   - state (locked/active/implemented/verified)');
    
    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendations_type 
        ON scan_recommendations(recommendation_type);
      
      CREATE INDEX IF NOT EXISTS idx_recommendations_state 
        ON scan_recommendations(state);
    `);
    
    console.log('✅ Created performance indexes');
    
    console.log('\n🎉 Hybrid columns migration complete!\n');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

addHybridColumns();