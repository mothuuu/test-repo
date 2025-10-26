/**
 * Manually reset password for a specific user
 * Usage: node scripts/manual-password-reset.js <email> <new-password>
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function resetPassword(email, newPassword) {
  try {
    console.log(`🔑 Resetting password for: ${email}`);

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      console.log('Available users:');
      const allUsers = await pool.query('SELECT id, email FROM users ORDER BY id');
      allUsers.rows.forEach(u => console.log(`   - ${u.email}`));
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear any reset tokens
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    console.log('✅ Password updated successfully!');
    console.log('');
    console.log('You can now log in with:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/manual-password-reset.js <email> <password>');
  console.log('Example: node scripts/manual-password-reset.js user@example.com MyNewPass123');
  process.exit(1);
}

if (password.length < 8) {
  console.log('❌ Password must be at least 8 characters');
  process.exit(1);
}

resetPassword(email, password);
