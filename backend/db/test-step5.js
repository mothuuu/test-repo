const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testProgressiveUnlock() {
  try {
    console.log('🧪 Testing Progressive Unlock System...\n');
    
    // Get the most recent scan
    const scanResult = await pool.query(`
      SELECT id, url, total_score, created_at 
      FROM scans 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (scanResult.rows.length === 0) {
      console.log('❌ No scans found. Please run a scan first!');
      await pool.end();
      return;
    }
    
    const scan = scanResult.rows[0];
    console.log(`📊 Latest Scan: ${scan.url}`);
    console.log(`   ID: ${scan.id}`);
    console.log(`   Score: ${scan.total_score}`);
    console.log(`   Created: ${scan.created_at}\n`);
    
    // Check recommendations
    const recsResult = await pool.query(`
      SELECT 
        id, 
        category, 
        recommendation_text,
        unlock_state, 
        batch_number, 
        unlocked_at
      FROM scan_recommendations 
      WHERE scan_id = $1 
      ORDER BY batch_number, id
    `, [scan.id]);
    
    console.log(`📝 Recommendations (${recsResult.rows.length} total):\n`);
    
    let activeCount = 0;
    let lockedCount = 0;
    
    recsResult.rows.forEach((rec, index) => {
      const status = rec.unlock_state === 'active' ? '✅ ACTIVE' : '🔒 LOCKED';
      console.log(`   ${index + 1}. ${status} [Batch ${rec.batch_number}] - ${rec.category}`);
      console.log(`      ${rec.recommendation_text.substring(0, 60)}...`);
      console.log(`      Unlocked: ${rec.unlocked_at ? '✓' : '✗'}\n`);
      
      if (rec.unlock_state === 'active') activeCount++;
      if (rec.unlock_state === 'locked') lockedCount++;
    });
    
    console.log('═══════════════════════════════════════════════════');
    console.log(`Summary: ${activeCount} active, ${lockedCount} locked`);
    console.log('═══════════════════════════════════════════════════\n');
    
    // Check user_progress
    const progressResult = await pool.query(`
      SELECT 
        total_recommendations, 
        active_recommendations, 
        completed_recommendations,
        verified_recommendations,
        current_batch,
        unlocks_today
      FROM user_progress 
      WHERE scan_id = $1
    `, [scan.id]);
    
    if (progressResult.rows.length === 0) {
      console.log('❌ No user_progress record found!');
      console.log('   This should have been created automatically.\n');
    } else {
      const progress = progressResult.rows[0];
      console.log('📊 User Progress Record:');
      console.log(`   Total Recommendations: ${progress.total_recommendations}`);
      console.log(`   Active: ${progress.active_recommendations}`);
      console.log(`   Completed: ${progress.completed_recommendations}`);
      console.log(`   Verified: ${progress.verified_recommendations}`);
      console.log(`   Current Batch: ${progress.current_batch}`);
      console.log(`   Unlocks Today: ${progress.unlocks_today}\n`);
    }
    
    // Final verdict
    console.log('═══════════════════════════════════════════════════');
    if (activeCount === 5 && lockedCount > 0 && progressResult.rows.length > 0) {
      console.log('✅ SUCCESS! Progressive unlock is working correctly!');
      console.log('   - First 5 recommendations are active');
      console.log('   - Remaining recommendations are locked');
      console.log('   - Progress tracking is initialized');
    } else if (activeCount > 0 && progressResult.rows.length > 0) {
      console.log('⚠️  PARTIAL SUCCESS');
      console.log(`   - ${activeCount} active recommendations (expected 5 for DIY)`);
      console.log(`   - ${lockedCount} locked recommendations`);
      console.log('   - Progress tracking exists');
    } else {
      console.log('❌ ISSUE DETECTED');
      console.log('   Check the code - recommendations may not be using new columns');
    }
    console.log('═══════════════════════════════════════════════════');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await pool.end();
  }
}

testProgressiveUnlock();