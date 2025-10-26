/**
 * Reset Monthly Scan Quota
 * Run this script to reset all users' monthly scan counts to 0
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function resetQuota() {
  try {
    console.log('🔄 Resetting monthly scan quota...\n');

    // Show current quota
    const before = await pool.query(
      'SELECT id, email, plan, scans_used_this_month FROM users ORDER BY id'
    );

    console.log('📊 Current quota usage:');
    before.rows.forEach(user => {
      console.log(`   ${user.email} (${user.plan}): ${user.scans_used_this_month} scans used`);
    });

    // Reset quota
    await pool.query('UPDATE users SET scans_used_this_month = 0');

    // Show updated quota
    const after = await pool.query(
      'SELECT id, email, plan, scans_used_this_month FROM users ORDER BY id'
    );

    console.log('\n✅ Quota reset successful!\n');
    console.log('📊 Updated quota usage:');
    after.rows.forEach(user => {
      console.log(`   ${user.email} (${user.plan}): ${user.scans_used_this_month} scans used`);
    });

    console.log('\n🎉 All users now have fresh monthly scan quota!');

  } catch (error) {
    console.error('❌ Error resetting quota:', error.message);
  } finally {
    await pool.end();
  }
}

resetQuota();
