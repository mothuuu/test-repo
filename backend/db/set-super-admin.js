const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function setSuperAdmin() {
  try {
    const SUPER_ADMIN_EMAIL = 'monali.s@xeo.marketing';

    console.log(`🔄 Setting ${SUPER_ADMIN_EMAIL} as Super Admin...`);

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );

    if (userCheck.rows.length === 0) {
      console.log(`\n⚠️  User ${SUPER_ADMIN_EMAIL} does not exist yet.`);
      console.log('This user will be set as Super Admin when they sign up.');
      console.log('\nFor now, creating a placeholder record...');

      // You can create the user here if needed, or just exit
      console.log('\n❌ Please have the user sign up first, then run this script again.');
      process.exit(1);
    }

    const user = userCheck.rows[0];

    // Update user to super_admin role
    await pool.query(
      `UPDATE users
       SET role = 'super_admin',
           updated_at = NOW()
       WHERE email = $1`,
      [SUPER_ADMIN_EMAIL]
    );

    console.log(`\n✅ Successfully set ${SUPER_ADMIN_EMAIL} as Super Admin!`);
    console.log(`\nUser Details:`);
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Previous Role: ${user.role || 'user'}`);
    console.log(`  - New Role: super_admin`);

    // Log this action in audit_log
    await pool.query(
      `INSERT INTO audit_log
       (admin_id, admin_email, admin_role, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        SUPER_ADMIN_EMAIL,
        'super_admin',
        'SET_SUPER_ADMIN',
        'users',
        user.id,
        `Set ${SUPER_ADMIN_EMAIL} as initial Super Admin`,
        JSON.stringify({
          automated: true,
          migration: true,
          timestamp: new Date().toISOString()
        })
      ]
    );

    console.log(`\n✅ Audit log entry created`);
    console.log(`\n🎉 Setup complete! ${SUPER_ADMIN_EMAIL} now has full admin access.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to set super admin:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
setSuperAdmin();
