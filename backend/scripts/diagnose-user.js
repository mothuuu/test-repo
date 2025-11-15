require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

async function diagnoseUser() {
  try {
    // Get your email from command line argument
    const userEmail = process.argv[2];

    if (!userEmail) {
      console.log('❌ Please provide your email address:');
      console.log('   node backend/scripts/diagnose-user.js your-email@example.com');
      process.exit(1);
    }

    console.log(`🔍 Diagnosing account for: ${userEmail}\n`);

    // Get user info
    const userResult = await pool.query(
      `SELECT
        id, email, name, plan,
        primary_domain,
        scans_used_this_month,
        competitor_scans_used_this_month,
        stripe_customer_id,
        stripe_subscription_id,
        email_verified,
        created_at
       FROM users
       WHERE email = $1`,
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found with that email address');
      process.exit(1);
    }

    const user = userResult.rows[0];

    console.log('👤 USER ACCOUNT INFO:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Plan: ${user.plan.toUpperCase()}`);
    console.log(`   Primary Domain: ${user.primary_domain || 'NOT SET'}`);
    console.log(`   Email Verified: ${user.email_verified ? '✅' : '❌'}`);
    console.log(`   Stripe Customer ID: ${user.stripe_customer_id || 'NOT SET'}`);
    console.log(`   Stripe Subscription ID: ${user.stripe_subscription_id || 'NOT SET'}`);
    console.log('');

    console.log('📊 QUOTA USAGE:');
    console.log(`   Primary Scans: ${user.scans_used_this_month} used`);
    console.log(`   Competitor Scans: ${user.competitor_scans_used_this_month || 0} used`);
    console.log('');

    // Get recent scans
    const scansResult = await pool.query(
      `SELECT
        id, url, status, domain_type, extracted_domain, domain,
        created_at, completed_at
       FROM scans
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );

    console.log('📋 RECENT SCANS:');
    if (scansResult.rows.length === 0) {
      console.log('   No scans found');
    } else {
      scansResult.rows.forEach((scan, index) => {
        console.log(`\n   ${index + 1}. Scan ID: ${scan.id}`);
        console.log(`      URL: ${scan.url}`);
        console.log(`      Status: ${scan.status}`);
        console.log(`      Type: ${scan.domain_type || 'N/A'}`);
        console.log(`      Extracted Domain: ${scan.extracted_domain || 'N/A'}`);
        console.log(`      Domain Field: ${scan.domain || 'N/A'}`);
        console.log(`      Created: ${scan.created_at}`);
        if (scan.status === 'failed') {
          console.log(`      ❌ FAILED SCAN`);
        }
      });
    }

    console.log('\n');
    console.log('💡 DIAGNOSTICS:');

    // Check for plan issues
    if (user.plan === 'pro' && !user.stripe_subscription_id) {
      console.log('   ⚠️  WARNING: Pro plan but no Stripe subscription ID!');
      console.log('       This suggests the webhook hasn\'t processed yet.');
      console.log('       Wait a few minutes and check again.');
    }

    // Check for primary domain issues
    if (!user.primary_domain) {
      console.log('   ℹ️  No primary domain set yet.');
      console.log('       Your first scan will set this automatically.');
    }

    // Check for failed scans
    const failedScans = scansResult.rows.filter(s => s.status === 'failed');
    if (failedScans.length > 0) {
      console.log(`   ⚠️  Found ${failedScans.length} failed scan(s)`);
      console.log('       Failed scans suggest a technical issue with the scan process.');
    }

    // Check domain consistency
    const scansWithDomains = scansResult.rows.filter(s => s.extracted_domain);
    if (scansWithDomains.length > 0 && user.primary_domain) {
      const primaryDomainScans = scansWithDomains.filter(s =>
        s.extracted_domain === user.primary_domain
      );
      const competitorScans = scansWithDomains.filter(s =>
        s.extracted_domain !== user.primary_domain
      );

      console.log(`\n   📊 Domain breakdown:`);
      console.log(`       Primary domain scans: ${primaryDomainScans.length}`);
      console.log(`       Competitor scans: ${competitorScans.length}`);

      if (competitorScans.length > 0 && primaryDomainScans.filter(s => s.status === 'failed').length > 0) {
        console.log(`\n   🔍 POTENTIAL ISSUE DETECTED:`);
        console.log(`       Your primary domain scans are failing but competitor scans work.`);
        console.log(`       This suggests an issue specific to your primary website.`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.error(error);
    process.exit(1);
  }
}

diagnoseUser();
