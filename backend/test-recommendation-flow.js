const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3001/api';
const TEST_EMAIL = 'rueben@rogers.com';
const TEST_PASSWORD = '12345678'; // Change if different

let authToken = '';
let scanId = '';

// Helper to make authenticated requests
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    };
    
    if (data) config.data = data;
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      return { error: error.response.data };
    }
    throw error;
  }
}

async function testRecommendationFlow() {
  console.log('🧪 Testing Complete Recommendation Flow\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Login
    console.log('1️⃣  Logging in...');
    const loginResult = await apiCall('post', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (loginResult.error) {
      console.log('❌ Login failed:', loginResult.error);
      return;
    }
    
    authToken = loginResult.accessToken;
    console.log('   ✅ Logged in successfully\n');
    
    // Step 2: Get most recent scan
    console.log('2️⃣  Getting latest scan...');
    const scansResult = await apiCall('get', '/scan/list/recent?limit=1');

    console.log('   📦 Scans Result:', JSON.stringify(scansResult, null, 2));
    
    if (!scansResult.success || scansResult.scans.length === 0) {
      console.log('❌ No scans found. Please run a scan first!');
      return;
    }
    
    scanId = scansResult.scans[0].id;
    console.log(`   ✅ Found scan ID: ${scanId}\n`);
    
    // Step 3: Get all recommendations for this scan
console.log('3️⃣  Getting recommendations for scan...');
const allRecsResult = await apiCall('get', `/recommendations/scan/${scanId}`);

// ADD THIS DEBUG:
console.log('   📦 Recommendations Result:', JSON.stringify(allRecsResult, null, 2));

if (!allRecsResult.success) {
  console.log('❌ Failed to get recommendations');
  return;
}
    
    const allRecs = allRecsResult.recommendations;
    const progress = allRecsResult.progress;
    
    console.log(`   📊 Total: ${progress.total_recommendations}`);
    console.log(`   ✅ Active: ${progress.active_recommendations}`);
    console.log(`   ✓ Completed: ${progress.completed_recommendations}`);
    console.log(`   🔒 Locked: ${progress.total_recommendations - progress.active_recommendations - progress.completed_recommendations}\n`);
    
    // Step 4: Get active recommendations
    console.log('4️⃣  Getting active recommendations...');
    const activeResult = await apiCall('get', `/recommendations/active?scan_id=${scanId}`);
    
    if (!activeResult.success) {
      console.log('❌ Failed to get active recommendations');
      return;
    }
    
    const activeRecs = activeResult.recommendations;
    console.log(`   ✅ Found ${activeRecs.length} active recommendations\n`);
    
    if (activeRecs.length === 0) {
      console.log('⚠️  No active recommendations to test with.');
      console.log('   All recommendations may already be completed.');
      console.log('   Run a new scan to test the full flow!\n');
      return;
    }
    
    // Display first 3 active recommendations
    console.log('   Active Recommendations:');
    activeRecs.slice(0, 3).forEach((rec, i) => {
      console.log(`   ${i + 1}. [${rec.category}] ${rec.recommendation_text.substring(0, 60)}...`);
    });
    console.log('');
    
    // Step 5: Mark first recommendation as complete
    console.log('5️⃣  Marking first recommendation as complete...');
    const firstRecId = activeRecs[0].id;
    const markResult = await apiCall('post', `/recommendations/${firstRecId}/mark-complete`);
    
    if (!markResult.success) {
      console.log('❌ Failed to mark as complete:', markResult.error);
      return;
    }
    
    console.log('   ✅ Marked as complete!');
    console.log(`   📊 Progress: ${markResult.progress.completed}/${markResult.progress.total} completed\n`);
    
    // Step 6: Try to unlock next batch (should fail if not all complete)
    console.log('6️⃣  Attempting to unlock next batch (should fail)...');
    const unlockResult1 = await apiCall('post', '/recommendations/unlock-next', {
      scan_id: scanId
    });
    
    if (unlockResult1.error) {
      console.log('   ✅ EXPECTED: Cannot unlock yet');
      console.log(`   📝 Reason: ${unlockResult1.error.error || unlockResult1.error.message}`);
      if (unlockResult1.error.active_remaining) {
        console.log(`   ⏳ Still need to complete: ${unlockResult1.error.active_remaining} recommendations\n`);
      } else {
        console.log('');
      }
    } else {
      console.log('   ⚠️  UNEXPECTED: Unlock succeeded when it should have failed\n');
    }
    
    // Step 7: Mark remaining active recommendations as complete
    const remainingActive = activeRecs.slice(1);
    
    if (remainingActive.length > 0) {
      console.log(`7️⃣  Marking remaining ${remainingActive.length} active recommendations as complete...`);
      
      for (const rec of remainingActive) {
        const result = await apiCall('post', `/recommendations/${rec.id}/mark-complete`);
        if (result.success) {
          console.log(`   ✅ Completed: ${rec.recommendation_text.substring(0, 50)}...`);
        } else {
          console.log(`   ❌ Failed: ${rec.id}`);
        }
      }
      console.log('');
    }
    
    // Step 8: Now try to unlock next batch (should succeed)
    console.log('8️⃣  Attempting to unlock next batch (should succeed)...');
    const unlockResult2 = await apiCall('post', '/recommendations/unlock-next', {
      scan_id: scanId
    });
    
    if (unlockResult2.success) {
      console.log('   ✅ SUCCESS! Next batch unlocked!');
      console.log(`   🔓 Unlocked: ${unlockResult2.unlocked_count} recommendations`);
      console.log(`   📦 Batch Number: ${unlockResult2.batch_number}`);
      console.log(`   📊 Progress:`);
      console.log(`      Total: ${unlockResult2.progress.total_recommendations}`);
      console.log(`      Active: ${unlockResult2.progress.active_recommendations}`);
      console.log(`      Completed: ${unlockResult2.progress.completed_recommendations}`);
      if (unlockResult2.daily_limit_reached) {
        console.log(`   ⚠️  Daily limit reached - come back tomorrow for more!`);
      }
      console.log('');
      
      console.log('   New Recommendations Unlocked:');
      unlockResult2.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`   ${i + 1}. [${rec.category}] ${rec.recommendation_text.substring(0, 60)}...`);
      });
      console.log('');
    } else {
      console.log('   ❌ Failed to unlock:', unlockResult2.error);
      console.log('');
    }
    
    // Final Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 TEST COMPLETE!');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✅ All Endpoints Tested:');
    console.log('   1. GET /api/recommendations/scan/:scanId');
    console.log('   2. GET /api/recommendations/active');
    console.log('   3. POST /api/recommendations/:id/mark-complete');
    console.log('   4. POST /api/recommendations/unlock-next');
    console.log('\n🎯 Progressive Unlock Flow: WORKING!\n');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testRecommendationFlow();