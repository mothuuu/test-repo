require('dotenv').config();
const db = require('./database');

async function migrateScanTables() {
  console.log('🔄 Creating scan-related tables...\n');
  
  try {
    // Create scans table
    await db.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        
        -- Scores
        total_score INTEGER,
        rubric_version VARCHAR(10) DEFAULT 'V5',
        
        -- Category scores (0-100 each)
        ai_readability_score INTEGER,
        ai_search_readiness_score INTEGER,
        content_freshness_score INTEGER,
        content_structure_score INTEGER,
        speed_ux_score INTEGER,
        technical_setup_score INTEGER,
        trust_authority_score INTEGER,
        voice_optimization_score INTEGER,
        
        -- Metadata
        industry VARCHAR(100),
        page_count INTEGER DEFAULT 1,
        pages_analyzed JSONB,
        
        -- Analysis results
        detailed_analysis JSONB,
        recommendations JSONB,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Scans table created');
    
    // Create scan_recommendations table (for tracking recommendation actions)
    await db.query(`
      CREATE TABLE IF NOT EXISTS scan_recommendations (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        recommendation_text TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        estimated_impact INTEGER,
        estimated_effort VARCHAR(20),
        
        -- User actions
        status VARCHAR(50) DEFAULT 'pending',
        implemented_at TIMESTAMP,
        user_feedback TEXT,
        user_rating INTEGER,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Scan recommendations table created');
    
    // Create scan_pages table (for multi-page scans)
    await db.query(`
      CREATE TABLE IF NOT EXISTS scan_pages (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        page_type VARCHAR(50),
        
        -- Page-specific scores
        total_score INTEGER,
        category_scores JSONB,
        
        -- Analysis data
        content_length INTEGER,
        word_count INTEGER,
        html_content TEXT,
        extracted_content TEXT,
        metadata JSONB,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        analyzed_at TIMESTAMP
      )
    `);
    console.log('✅ Scan pages table created');
    
    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
      CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
      CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_scan_id ON scan_recommendations(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_pages_scan_id ON scan_pages(scan_id);
    `);
    console.log('✅ Indexes created');
    
    // Add trigger to update updated_at timestamp
    await db.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_scans_updated_at ON scans;
      CREATE TRIGGER update_scans_updated_at
        BEFORE UPDATE ON scans
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_scan_recommendations_updated_at ON scan_recommendations;
      CREATE TRIGGER update_scan_recommendations_updated_at
        BEFORE UPDATE ON scan_recommendations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers created');
    
    console.log('\n🎉 Scan migration complete!\n');
    console.log('📝 Tables created:');
    console.log('   - scans: Store all scan results');
    console.log('   - scan_recommendations: Track recommendations and user actions');
    console.log('   - scan_pages: Store multi-page scan data\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateScanTables();