const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateProgressiveUnlock() {
  console.log('🔄 Starting progressive unlock migration...\n');
  
  try {
    // ============================================
    // STEP 1: Update scan_recommendations table
    // ============================================
    console.log('📝 Step 1: Adding state columns to scan_recommendations...');
    
    await pool.query(`
      ALTER TABLE scan_recommendations 
      ADD COLUMN IF NOT EXISTS unlock_state VARCHAR(20) DEFAULT 'locked',
      ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS marked_complete_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS skip_verification BOOLEAN DEFAULT false;
    `);
    
    console.log('   ✅ Added: unlock_state, batch_number, unlocked_at, marked_complete_at, verified_at, skip_verification');
    
    // Add comment explaining states
    await pool.query(`
      COMMENT ON COLUMN scan_recommendations.unlock_state IS 
      'States: locked, active, completed, verified';
    `);
    
    console.log('✅ Step 1 Complete!\n');
    
    // ============================================
    // STEP 2: Create ai_testing_results table
    // ============================================
    console.log('📝 Step 2: Creating ai_testing_results table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_testing_results (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Test configuration
        ai_assistant VARCHAR(50) NOT NULL,
        query_text TEXT NOT NULL,
        query_category VARCHAR(100),
        
        -- Results
        was_mentioned BOOLEAN DEFAULT false,
        was_recommended BOOLEAN DEFAULT false,
        was_cited BOOLEAN DEFAULT false,
        mention_context TEXT,
        recommendation_rank INTEGER,
        citation_url TEXT,
        
        -- Full response (for debugging)
        full_response TEXT,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('   ✅ Table created with columns:');
    console.log('      - ai_assistant (chatgpt, claude, perplexity)');
    console.log('      - query_text (the question asked)');
    console.log('      - was_mentioned, was_recommended, was_cited (boolean flags)');
    console.log('      - mention_context, recommendation_rank, citation_url');
    
    // Add indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_testing_scan_id 
        ON ai_testing_results(scan_id);
      CREATE INDEX IF NOT EXISTS idx_ai_testing_user_id 
        ON ai_testing_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_testing_created_at 
        ON ai_testing_results(created_at DESC);
    `);
    
    console.log('   ✅ Indexes created for fast queries');
    console.log('✅ Step 2 Complete!\n');
    
    // ============================================
    // STEP 3: Create user_progress table
    // ============================================
    console.log('📝 Step 3: Creating user_progress table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        
        -- Progress tracking
        total_recommendations INTEGER DEFAULT 0,
        active_recommendations INTEGER DEFAULT 0,
        completed_recommendations INTEGER DEFAULT 0,
        verified_recommendations INTEGER DEFAULT 0,
        current_batch INTEGER DEFAULT 1,
        
        -- Unlock tracking
        last_unlock_date DATE,
        unlocks_today INTEGER DEFAULT 0,
        next_unlock_available_at TIMESTAMP,
        
        -- Gamification
        completion_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Ensure one progress record per user per scan
        UNIQUE(user_id, scan_id)
      )
    `);
    
    console.log('   ✅ Table created with columns:');
    console.log('      - total_recommendations, active_recommendations, completed_recommendations');
    console.log('      - current_batch, last_unlock_date, unlocks_today');
    console.log('      - completion_streak, last_activity_date');
    
    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_progress_user_id 
        ON user_progress(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_progress_scan_id 
        ON user_progress(scan_id);
    `);
    
    console.log('   ✅ Indexes created');
    
    // Add trigger to update updated_at
    await pool.query(`
      DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
      CREATE TRIGGER update_user_progress_updated_at
        BEFORE UPDATE ON user_progress
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('   ✅ Auto-update trigger added');
    console.log('✅ Step 3 Complete!\n');
    
    // ============================================
    // STEP 4: Update scans table (AI testing columns)
    // ============================================
    console.log('📝 Step 4: Adding AI testing columns to scans table...');
    
    await pool.query(`
      ALTER TABLE scans
      ADD COLUMN IF NOT EXISTS ai_mention_rate DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_recommendation_rate DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_citation_rate DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_tests_run INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_testing_completed BOOLEAN DEFAULT false;
    `);
    
    console.log('   ✅ Added columns:');
    console.log('      - ai_mention_rate (percentage)');
    console.log('      - ai_recommendation_rate (percentage)');
    console.log('      - ai_citation_rate (percentage)');
    console.log('      - ai_tests_run (count)');
    console.log('      - ai_testing_completed (boolean)');
    
    console.log('✅ Step 4 Complete!\n');
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 MIGRATION COMPLETE! 🎉');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('📊 Database Changes Summary:');
    console.log('   1. ✅ Updated scan_recommendations (6 new columns)');
    console.log('   2. ✅ Created ai_testing_results table');
    console.log('   3. ✅ Created user_progress table');
    console.log('   4. ✅ Updated scans table (5 new columns)\n');
    
    console.log('🎯 Ready for:');
    console.log('   - Progressive unlock system');
    console.log('   - ChatGPT testing integration');
    console.log('   - Progress tracking');
    console.log('   - Daily unlock limits\n');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    await pool.end();
    process.exit(1);
  }
}

migrateProgressiveUnlock();