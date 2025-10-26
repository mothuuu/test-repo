/**
 * Manually upgrade user to a specific plan
 * Usage: node scripts/upgrade-user-plan.js <email> <plan>
 * Plans: free, diy, pro, agency
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function upgradePlan(email, plan) {
  const validPlans = ['free', 'diy', 'pro', 'agency'];

  try {
    console.log(`🔄 Upgrading ${email} to ${plan} plan...`);

    // Validate plan
    if (!validPlans.includes(plan)) {
      console.log(`❌ Invalid plan: ${plan}`);
      console.log(`Valid plans: ${validPlans.join(', ')}`);
      process.exit(1);
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, plan FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      console.log('Available users:');
      const allUsers = await pool.query('SELECT id, email, plan FROM users ORDER BY id');
      allUsers.rows.forEach(u => console.log(`   - ${u.email} (${u.plan})`));
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email}`);
    console.log(`   Current plan: ${user.plan}`);

    // Update plan
    await pool.query(
      'UPDATE users SET plan = $1 WHERE id = $2',
      [plan, user.id]
    );

    console.log(`✅ Successfully upgraded to ${plan} plan!`);
    console.log('');
    console.log('User details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Plan: ${user.plan} → ${plan}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const plan = process.argv[3];

if (!email || !plan) {
  console.log('Usage: node scripts/upgrade-user-plan.js <email> <plan>');
  console.log('');
  console.log('Plans:');
  console.log('  free   - 2 scans/month, 1 page, top 3 recommendations');
  console.log('  diy    - 25 scans/month, 5 pages, progressive unlock');
  console.log('  pro    - 50 scans/month, 25 pages, all recommendations');
  console.log('  agency - Custom limits');
  console.log('');
  console.log('Example: node scripts/upgrade-user-plan.js user@example.com diy');
  process.exit(1);
}

upgradePlan(email, plan);
