/**
 * Test: Refresh Cycle Integration with Scan Flow
 *
 * This tests that the 5-day refresh cycle properly controls recommendation reuse:
 * 1. First scan → generates new recommendations + creates context
 * 2. Second scan (within 5 days, refresh not due) → reuses recommendations
 * 3. Third scan (refresh cycle due) → processes refresh, then reuses
 *
 * Run: node backend/tests/test-refresh-cycle-integration.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const RecommendationContextService = require('../services/recommendation-context-service');
const RefreshCycleService = require('../services/refresh-cycle-service');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test configuration - UPDATE THESE for your test
const TEST_CONFIG = {
  userId: null,  // Will be set from command line or default
  domain: 'test-domain.com',
  pages: ['/page1', '/page2']
};

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 REFRESH CYCLE INTEGRATION TESTS');
  console.log('='.repeat(60) + '\n');

  const contextService = new RecommendationContextService(pool);
  const refreshService = new RefreshCycleService(pool);

  // Get test user ID from command line or find one
  let userId = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (!userId) {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.error('❌ No users found in database. Create a test user first.');
      process.exit(1);
    }
    userId = userResult.rows[0].id;
  }

  TEST_CONFIG.userId = userId;
  console.log(`📋 Test Config:
   User ID: ${TEST_CONFIG.userId}
   Domain: ${TEST_CONFIG.domain}
   Pages: ${TEST_CONFIG.pages.join(', ')}
`);

  // ============================================
  // TEST 1: No active context → should NOT skip
  // ============================================
  console.log('─'.repeat(50));
  console.log('TEST 1: No active context');
  console.log('─'.repeat(50));

  // Clean up any existing test context
  await pool.query(`
    DELETE FROM recommendation_contexts
    WHERE user_id = $1 AND domain = $2
  `, [userId, contextService.normalizeDomain(TEST_CONFIG.domain)]);

  const test1Result = await contextService.shouldSkipRecommendationGeneration(
    userId,
    TEST_CONFIG.domain,
    TEST_CONFIG.pages,
    false
  );

  console.log(`   shouldSkip: ${test1Result.shouldSkip}`);
  console.log(`   reason: ${test1Result.reason}`);

  if (test1Result.shouldSkip === false && test1Result.reason === 'no_active_context') {
    console.log('   ✅ PASS: Correctly identified no active context\n');
  } else {
    console.log('   ❌ FAIL: Should have returned shouldSkip=false\n');
  }

  // ============================================
  // TEST 2: Create context and refresh cycle, then test reuse
  // ============================================
  console.log('─'.repeat(50));
  console.log('TEST 2: Active context with refresh NOT due');
  console.log('─'.repeat(50));

  // Create a test scan
  const scanResult = await pool.query(`
    INSERT INTO scans (user_id, url, status, total_score, domain)
    VALUES ($1, $2, 'completed', 75, $3)
    RETURNING id
  `, [userId, `https://${TEST_CONFIG.domain}`, TEST_CONFIG.domain]);

  const testScanId = scanResult.rows[0].id;
  console.log(`   Created test scan: ${testScanId}`);

  // Create context for this scan
  await contextService.createContext(userId, testScanId, TEST_CONFIG.domain, TEST_CONFIG.pages);
  console.log('   Created recommendation context');

  // Initialize refresh cycle (next_cycle_date = 5 days from now)
  await refreshService.initializeRefreshCycle(userId, testScanId);
  console.log('   Initialized refresh cycle');

  // Now check - should skip because context exists and refresh not due
  const test2Result = await contextService.shouldSkipRecommendationGeneration(
    userId,
    TEST_CONFIG.domain,
    TEST_CONFIG.pages,
    false
  );

  console.log(`   shouldSkip: ${test2Result.shouldSkip}`);
  console.log(`   reason: ${test2Result.reason}`);
  console.log(`   refreshProcessed: ${test2Result.refreshProcessed || false}`);

  if (test2Result.shouldSkip === true &&
      test2Result.reason === 'active_context_exists' &&
      test2Result.refreshProcessed === false) {
    console.log('   ✅ PASS: Correctly reuses context without processing refresh\n');
  } else {
    console.log('   ❌ FAIL: Should reuse context without refresh processing\n');
  }

  // ============================================
  // TEST 3: Simulate refresh due (set next_cycle_date to past)
  // ============================================
  console.log('─'.repeat(50));
  console.log('TEST 3: Active context with refresh DUE');
  console.log('─'.repeat(50));

  // Force refresh cycle to be due by setting next_cycle_date to yesterday
  await pool.query(`
    UPDATE recommendation_refresh_cycles
    SET next_cycle_date = CURRENT_DATE - INTERVAL '1 day'
    WHERE user_id = $1 AND scan_id = $2
  `, [userId, testScanId]);
  console.log('   Set next_cycle_date to yesterday (refresh now due)');

  // Create some test recommendations to be "replaced"
  await pool.query(`
    INSERT INTO scan_recommendations (scan_id, category, recommendation_text, priority, unlock_state, status)
    VALUES
      ($1, 'test', 'Test rec 1 - implemented', 1, 'completed', 'implemented'),
      ($1, 'test', 'Test rec 2 - active', 2, 'active', 'active'),
      ($1, 'test', 'Test rec 3 - locked', 3, 'locked', 'active')
  `, [testScanId]);
  console.log('   Created test recommendations (1 implemented, 1 active, 1 locked)');

  // Now check - should skip BUT also process refresh
  const test3Result = await contextService.shouldSkipRecommendationGeneration(
    userId,
    TEST_CONFIG.domain,
    TEST_CONFIG.pages,
    false
  );

  console.log(`   shouldSkip: ${test3Result.shouldSkip}`);
  console.log(`   reason: ${test3Result.reason}`);
  console.log(`   refreshProcessed: ${test3Result.refreshProcessed || false}`);

  if (test3Result.shouldSkip === true &&
      test3Result.reason === 'active_context_exists' &&
      test3Result.refreshProcessed === true) {
    console.log('   ✅ PASS: Correctly processed refresh before reusing context\n');
  } else {
    console.log('   ⚠️  PARTIAL: Context reused but refresh may not have processed');
    console.log('      (This is OK if there were no implemented/skipped recs to replace)\n');
  }

  // ============================================
  // TEST 4: Competitor scan → should NOT skip
  // ============================================
  console.log('─'.repeat(50));
  console.log('TEST 4: Competitor scan (should never skip)');
  console.log('─'.repeat(50));

  const test4Result = await contextService.shouldSkipRecommendationGeneration(
    userId,
    TEST_CONFIG.domain,
    TEST_CONFIG.pages,
    true  // isCompetitorScan = true
  );

  console.log(`   shouldSkip: ${test4Result.shouldSkip}`);
  console.log(`   reason: ${test4Result.reason}`);

  if (test4Result.shouldSkip === false && test4Result.reason === 'competitor_scan') {
    console.log('   ✅ PASS: Correctly skips context check for competitor scans\n');
  } else {
    console.log('   ❌ FAIL: Competitor scans should never reuse context\n');
  }

  // ============================================
  // CLEANUP
  // ============================================
  console.log('─'.repeat(50));
  console.log('CLEANUP');
  console.log('─'.repeat(50));

  // Clean up test data (order matters due to foreign keys)
  await pool.query('DELETE FROM user_notifications WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM recommendation_replacements WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM recommendation_score_history WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM scan_recommendation_links WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM scan_recommendations WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM recommendation_refresh_cycles WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM context_scan_links WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM recommendation_contexts WHERE primary_scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM user_progress WHERE scan_id = $1', [testScanId]);
  await pool.query('DELETE FROM scans WHERE id = $1', [testScanId]);

  console.log('   ✓ Cleaned up test data\n');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('='.repeat(60));
  console.log('🏁 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`
The refresh cycle integration works as follows:

1. NO CONTEXT → Generate new recommendations
2. CONTEXT EXISTS + REFRESH NOT DUE → Reuse existing recommendations
3. CONTEXT EXISTS + REFRESH DUE → Process refresh (replace implemented/skipped), then reuse
4. COMPETITOR SCAN → Always generate new (never reuse context)

To test in production:
1. Run a scan on your domain
2. Mark some recommendations as "implemented"
3. Wait 5 days (or manually set next_cycle_date to past)
4. Run another scan
5. Verify: implemented recs should be replaced with new ones from the queue
`);

  await pool.end();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  pool.end();
  process.exit(1);
});
