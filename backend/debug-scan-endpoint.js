const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:3001/api';
const TEST_EMAIL = 'rueben@rogers.com';
const TEST_PASSWORD = '12345678'; // Update if different

async function debugScanEndpoint() {
  try {
    console.log('🔍 Debugging Scan List Endpoint\n');
    
    // Step 1: Login
    console.log('1️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    console.log('   ✅ Logged in successfully');
    console.log('   📦 Login Response:', JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.token || loginResponse.data.accessToken;
    
    if (!token) {
      console.log('   ❌ No token found in response!');
      return;
    }
    
    console.log(`   🔑 Token: ${token.substring(0, 20)}...\n`);
    
    // Step 2: Call the scan list endpoint
    console.log('2️⃣  Calling /api/scan/list/recent...');
    const scanResponse = await axios.get(`${API_BASE}/scan/list/recent?limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('   📦 Raw Response:');
    console.log(JSON.stringify(scanResponse.data, null, 2));
    console.log('');
    
    if (scanResponse.data.success) {
      console.log(`   ✅ Success: ${scanResponse.data.success}`);
      console.log(`   📊 Scans returned: ${scanResponse.data.scans ? scanResponse.data.scans.length : 0}`);
      
      if (scanResponse.data.scans && scanResponse.data.scans.length > 0) {
        console.log('\n   First scan:');
        console.log(`   - ID: ${scanResponse.data.scans[0].id}`);
        console.log(`   - URL: ${scanResponse.data.scans[0].url}`);
        console.log(`   - Score: ${scanResponse.data.scans[0].total_score}`);
      } else {
        console.log('\n   ⚠️  Scans array is empty!');
      }
    } else {
      console.log('   ❌ Success flag is false or missing');
    }
    
  } catch (error) {
    console.error('❌ Error occurred:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Message:', error.message);
    }
  }
}

debugScanEndpoint();