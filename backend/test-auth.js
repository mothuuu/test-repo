const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const TEST_EMAIL = 'test' + Date.now() + '@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Store tokens for testing
let accessToken = '';
let verificationToken = '';
let resetToken = '';

// Test 1: Signup
async function testSignup() {
  logInfo('\n=== Test 1: User Signup ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME
    });
    
    if (response.data.success) {
      accessToken = response.data.accessToken;
      logSuccess('Signup successful');
      logInfo(`User ID: ${response.data.user.id}`);
      logInfo(`Email: ${response.data.user.email}`);
      logInfo(`Name: ${response.data.user.name}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      logWarning('User already exists - this is OK for testing');
      return true;
    }
    logError(`Signup failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 2: Login
async function testLogin() {
  logInfo('\n=== Test 2: User Login ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (response.data.success && response.data.accessToken) {
      accessToken = response.data.accessToken;
      logSuccess('Login successful');
      logInfo(`Token: ${accessToken.substring(0, 30)}...`);
      return true;
    }
  } catch (error) {
    logError(`Login failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 3: Get Current User
async function testGetMe() {
  logInfo('\n=== Test 3: Get Current User ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.data.success) {
      logSuccess('Get user successful');
      logInfo(`User ID: ${response.data.user.id}`);
      logInfo(`Email: ${response.data.user.email}`);
      logInfo(`Name: ${response.data.user.name}`);
      logInfo(`Plan: ${response.data.user.plan}`);
      logInfo(`Email Verified: ${response.data.user.email_verified}`);
      return true;
    }
  } catch (error) {
    logError(`Get user failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 4: Verify Auth Status
async function testVerifyAuth() {
  logInfo('\n=== Test 4: Verify Auth Status ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (response.data.authenticated) {
      logSuccess('Auth verification successful');
      logInfo(`Authenticated: ${response.data.authenticated}`);
      logInfo(`User ID: ${response.data.userId}`);
      return true;
    }
  } catch (error) {
    logError(`Auth verification failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 5: Resend Verification Email
async function testResendVerification() {
  logInfo('\n=== Test 5: Resend Verification Email ===');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/resend-verification`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      logSuccess('Verification email sent');
      logInfo('Check your terminal for the verification email (console mode)');
      return true;
    }
  } catch (error) {
    logError(`Resend verification failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 6: Forgot Password
async function testForgotPassword() {
  logInfo('\n=== Test 6: Forgot Password ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
      email: TEST_EMAIL
    });
    
    if (response.data.success) {
      logSuccess('Password reset email sent');
      logInfo('Check your terminal for the reset email (console mode)');
      return true;
    }
  } catch (error) {
    logError(`Forgot password failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 7: Logout
async function testLogout() {
  logInfo('\n=== Test 7: User Logout ===');
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (response.data.success) {
      logSuccess('Logout successful');
      return true;
    }
  } catch (error) {
    logError(`Logout failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Test 8: Try to Access Protected Route After Logout
async function testProtectedAfterLogout() {
  logInfo('\n=== Test 8: Access Protected Route After Logout ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    logError('Should have failed but succeeded - token still valid');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      logSuccess('Correctly blocked access after logout');
      return true;
    }
    logError(`Unexpected error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.blue}
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         🧪 Authentication System Test Suite           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
${colors.reset}`);

  logInfo(`Testing API at: ${API_BASE_URL}`);
  logInfo(`Test Email: ${TEST_EMAIL}`);
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  const tests = [
    { name: 'Signup', fn: testSignup },
    { name: 'Login', fn: testLogin },
    { name: 'Get Current User', fn: testGetMe },
    { name: 'Verify Auth Status', fn: testVerifyAuth },
    { name: 'Resend Verification', fn: testResendVerification },
    { name: 'Forgot Password', fn: testForgotPassword },
    { name: 'Logout', fn: testLogout },
    { name: 'Protected After Logout', fn: testProtectedAfterLogout }
  ];

  for (const test of tests) {
    results.total++;
    const passed = await test.fn();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}
📊 Test Summary:
   Total Tests: ${results.total}
   ${colors.green}✅ Passed: ${results.passed}${colors.cyan}
   ${colors.red}❌ Failed: ${results.failed}${colors.cyan}
   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%
${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}\n`);

  if (results.failed === 0) {
    logSuccess('🎉 All tests passed! Your authentication system is working perfectly!');
  } else {
    logWarning(`⚠️  ${results.failed} test(s) failed. Check the errors above.`);
  }

  console.log(`\n${colors.cyan}💡 Next Steps:${colors.reset}`);
  console.log('   1. Check your server terminal for email outputs (console mode)');
  console.log('   2. Test the frontend at http://localhost:8000/auth.html');
  console.log('   3. Try creating a real account through the UI\n');
}

// Run the tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});