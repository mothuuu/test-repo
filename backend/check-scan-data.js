require('dotenv').config();
const db = require('./database');

/**
 * Diagnostic: Check scan data for specific scan ID
 *
 * This script checks what data is stored for a specific scan
 * to diagnose why category scores and recommendations aren't showing.
 */

async function checkScanData() {
  const scanId = process.argv[2] || '154';

  console.log(`🔍 Checking data for scan ID: ${scanId}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get scan data
    const scanResult = await db.query(`
      SELECT
        id, user_id, url, status, total_score, rubric_version,
        ai_readability_score, ai_search_readiness_score,
        content_freshness_score, content_structure_score,
        speed_ux_score, technical_setup_score,
        trust_authority_score, voice_optimization_score,
        industry, page_count, created_at, completed_at
      FROM scans
      WHERE id = $1
    `, [scanId]);

    if (scanResult.rows.length === 0) {
      console.error(`❌ Scan ID ${scanId} not found in database\n`);
      process.exit(1);
    }

    const scan = scanResult.rows[0];

    console.log('1️⃣  SCAN BASIC INFO:');
    console.log(`   ID: ${scan.id}`);
    console.log(`   User ID: ${scan.user_id}`);
    console.log(`   URL: ${scan.url}`);
    console.log(`   Status: ${scan.status}`);
    console.log(`   Total Score: ${scan.total_score}`);
    console.log(`   Rubric Version: ${scan.rubric_version}`);
    console.log(`   Created: ${scan.created_at}`);
    console.log(`   Completed: ${scan.completed_at}\n`);

    // Check user info
    if (scan.user_id) {
      const userResult = await db.query(`
        SELECT id, email, name, plan
        FROM users
        WHERE id = $1
      `, [scan.user_id]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        console.log('2️⃣  USER INFO:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name || 'Not set'}`);
        console.log(`   Plan: ${user.plan}\n`);
      }
    }

    // Check category scores
    console.log('3️⃣  CATEGORY SCORES:');
    const categories = [
      { key: 'ai_readability_score', label: 'AI Readability' },
      { key: 'ai_search_readiness_score', label: 'AI Search Readiness' },
      { key: 'content_freshness_score', label: 'Content Freshness' },
      { key: 'content_structure_score', label: 'Content Structure' },
      { key: 'speed_ux_score', label: 'Speed & UX' },
      { key: 'technical_setup_score', label: 'Technical Setup' },
      { key: 'trust_authority_score', label: 'Trust & Authority' },
      { key: 'voice_optimization_score', label: 'Voice Optimization' }
    ];

    let allScoresValid = true;
    let nullCount = 0;
    let invalidCount = 0;

    categories.forEach(cat => {
      const score = scan[cat.key];
      const type = typeof score;
      const isValid = typeof score === 'number' && !isNaN(score);

      let status = '✅';
      if (score === null || score === undefined) {
        status = '❌ NULL';
        nullCount++;
        allScoresValid = false;
      } else if (!isValid) {
        status = `⚠️  INVALID (type: ${type})`;
        invalidCount++;
        allScoresValid = false;
      }

      console.log(`   ${status} ${cat.label.padEnd(25)} = ${score} ${isValid ? `(${Math.round(score * 10)}/1000)` : ''}`);
    });

    console.log();

    if (allScoresValid) {
      console.log('✅ All category scores are valid numbers\n');
    } else {
      console.error(`❌ PROBLEM FOUND: ${nullCount} NULL scores, ${invalidCount} invalid scores\n`);
      console.log('💡 This is why categories aren\'t showing on results page!\n');
    }

    // Check recommendations
    const recResult = await db.query(`
      SELECT
        id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, status,
        unlock_state, batch_number
      FROM scan_recommendations
      WHERE scan_id = $1
      ORDER BY batch_number, priority DESC
    `, [scanId]);

    console.log('4️⃣  RECOMMENDATIONS:');
    console.log(`   Total recommendations: ${recResult.rows.length}`);

    if (recResult.rows.length === 0) {
      console.error('   ❌ No recommendations found for this scan!\n');
      console.log('   💡 This is why recommendations aren\'t showing!\n');
    } else {
      // Group by batch
      const batches = {};
      recResult.rows.forEach(rec => {
        const batch = rec.batch_number || 'unbatched';
        if (!batches[batch]) batches[batch] = [];
        batches[batch].push(rec);
      });

      Object.keys(batches).sort().forEach(batchNum => {
        const recs = batches[batchNum];
        console.log(`\n   Batch ${batchNum}: ${recs.length} recommendations`);
        recs.forEach((rec, i) => {
          const status = rec.unlock_state || 'unknown';
          console.log(`      ${i + 1}. [${status.toUpperCase()}] ${rec.category} - ${rec.priority}`);
          console.log(`         Impact: ${rec.estimated_impact}, Effort: ${rec.estimated_effort}`);
          console.log(`         "${rec.recommendation_text.substring(0, 60)}..."`);
        });
      });

      console.log();
    }

    // Check user progress (for DIY tier)
    const progressResult = await db.query(`
      SELECT
        total_recommendations, active_recommendations,
        completed_recommendations, current_batch,
        last_unlock_date, total_batches,
        batch_1_unlock_date, batch_2_unlock_date,
        batch_3_unlock_date, batch_4_unlock_date
      FROM user_progress
      WHERE scan_id = $1
    `, [scanId]);

    if (progressResult.rows.length > 0) {
      const progress = progressResult.rows[0];
      console.log('5️⃣  USER PROGRESS (DIY Tier):');
      console.log(`   Total recommendations: ${progress.total_recommendations}`);
      console.log(`   Active recommendations: ${progress.active_recommendations}`);
      console.log(`   Completed recommendations: ${progress.completed_recommendations}`);
      console.log(`   Current batch: ${progress.current_batch} / ${progress.total_batches}`);
      console.log(`   Last unlock: ${progress.last_unlock_date || 'Never'}`);
      console.log(`   Batch unlock dates:`);
      console.log(`      Batch 1: ${progress.batch_1_unlock_date || 'Not set'}`);
      console.log(`      Batch 2: ${progress.batch_2_unlock_date || 'Not set'}`);
      console.log(`      Batch 3: ${progress.batch_3_unlock_date || 'Not set'}`);
      console.log(`      Batch 4: ${progress.batch_4_unlock_date || 'Not set'}`);
      console.log();
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 SUMMARY:\n');

    if (!allScoresValid) {
      console.error('❌ Category scores are NULL or invalid');
      console.log('   → This prevents "Performance by Category" from showing');
      console.log('   → This prevents dashboard category breakdown from showing\n');
    }

    if (recResult.rows.length === 0) {
      console.error('❌ No recommendations in database');
      console.log('   → This prevents "Detailed Recommendations" from showing\n');
    }

    if (allScoresValid && recResult.rows.length > 0) {
      console.log('✅ All data looks good!');
      console.log('   If still not showing, it\'s a frontend rendering issue.\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkScanData();
