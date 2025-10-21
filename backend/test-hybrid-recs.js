const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testHybridRecommendations() {
  try {
    console.log('🧪 Testing Hybrid Recommendation System\n');
    
    // Get scan 19
    const scan = await pool.query(`
      SELECT id, url, total_score 
      FROM scans 
      WHERE id = 19
    `);
    
    if (scan.rows.length === 0) {
      console.log('❌ Scan 19 not found');
      await pool.end();
      return;
    }
    
    console.log(`📊 Scan 19: ${scan.rows[0].url}`);
    console.log(`   Score: ${scan.rows[0].total_score}\n`);
    
    // Get all recommendations
    const recs = await pool.query(`
      SELECT 
        id, 
        recommendation_text,
        recommendation_type,
        page_url,
        unlock_state,
        batch_number,
        unlocked_at
      FROM scan_recommendations 
      WHERE scan_id = 19
      ORDER BY recommendation_type, unlock_state DESC, id
    `);
    
    console.log(`📝 Total Recommendations: ${recs.rows.length}\n`);
    
    // Group by type
    const siteWide = recs.rows.filter(r => r.recommendation_type === 'site-wide');
    const pageSpecific = recs.rows.filter(r => r.recommendation_type === 'page-specific');
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🌐 SITE-WIDE RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════\n');
    
    siteWide.forEach((rec, i) => {
      const status = rec.unlock_state === 'active' ? '✅ ACTIVE' : '🔒 LOCKED';
      console.log(`${i + 1}. ${status} [Batch ${rec.batch_number}]`);
      console.log(`   ${rec.recommendation_text.substring(0, 60)}...`);
      console.log(`   Unlocked: ${rec.unlocked_at ? '✓' : '✗'}\n`);
    });
    
    console.log('═══════════════════════════════════════════════════');
    console.log('📄 PAGE-SPECIFIC RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════\n');
    
    pageSpecific.forEach((rec, i) => {
      const status = rec.unlock_state === 'active' ? '✅ ACTIVE' : '🔒 LOCKED';
      console.log(`${i + 1}. ${status}`);
      console.log(`   Page: ${rec.page_url || 'N/A'}`);
      console.log(`   ${rec.recommendation_text.substring(0, 60)}...`);
      console.log(`   Unlocked: ${rec.unlocked_at ? '✓' : '✗'}\n`);
    });
    
    // Check user_progress
    const progress = await pool.query(`
      SELECT * FROM user_progress WHERE scan_id = 19
    `);
    
    if (progress.rows.length > 0) {
      const p = progress.rows[0];
      console.log('═══════════════════════════════════════════════════');
      console.log('📊 USER PROGRESS');
      console.log('═══════════════════════════════════════════════════\n');
      console.log(`Total: ${p.total_recommendations}`);
      console.log(`Active: ${p.active_recommendations}`);
      console.log(`Completed: ${p.completed_recommendations}`);
      console.log(`\nSite-wide: ${p.site_wide_total} total, ${p.site_wide_active} active`);
      console.log(`Page-specific: ${p.page_specific_total} total`);
      console.log(`Site-wide complete: ${p.site_wide_complete ? '✓' : '✗'}`);
    }
    
    // Check page_priorities
    const pages = await pool.query(`
      SELECT * FROM page_priorities WHERE scan_id = 19
    `);
    
    if (pages.rows.length > 0) {
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📄 PAGE PRIORITIES');
      console.log('═══════════════════════════════════════════════════\n');
      pages.rows.forEach(page => {
        console.log(`Priority ${page.priority_rank}: ${page.page_url}`);
        console.log(`   Recommendations: ${page.total_recommendations}`);
        console.log(`   Unlocked: ${page.unlocked ? '✓' : '✗'}\n`);
      });
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ HYBRID SYSTEM TEST COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await pool.end();
  }
}

testHybridRecommendations();