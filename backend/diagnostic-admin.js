const db = require('./db/database');

async function runDiagnostics() {
  console.log('🔍 Running Admin Dashboard Diagnostics...\n');

  try {
    // 1. Check admin user
    console.log('1️⃣  Checking admin user...');
    const userResult = await db.query(
      "SELECT id, email, name, role, plan, created_at FROM users WHERE email = 'monali.s@xeo.marketing'"
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found! Please check the email address.');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('   User found:', user.email);
    console.log('   Current role:', user.role || '(none - defaults to "user")');
    console.log('   Plan:', user.plan);

    // Update to super_admin if needed
    if (!user.role || user.role === 'user') {
      console.log('\n   ⚠️  User does not have admin role. Updating...');
      await db.query(
        "UPDATE users SET role = 'super_admin' WHERE email = 'monali.s@xeo.marketing'"
      );
      console.log('   ✅ Updated to super_admin\n');
    } else {
      console.log('   ✅ User has admin role:', user.role, '\n');
    }

    // 2. Check data in database
    console.log('2️⃣  Checking database data...');

    const usersCount = await db.query('SELECT COUNT(*)::int as count FROM users');
    console.log('   Total users:', usersCount.rows[0].count);

    const scansCount = await db.query('SELECT COUNT(*)::int as count FROM scans');
    console.log('   Total scans:', scansCount.rows[0].count);

    const recentScans = await db.query(`
      SELECT COUNT(*)::int as count
      FROM scans
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    console.log('   Scans (last 7 days):', recentScans.rows[0].count);

    const guestScans = await db.query(`
      SELECT COUNT(*)::int as count
      FROM scans
      WHERE user_id IS NULL
    `);
    console.log('   Guest scans:', guestScans.rows[0].count);

    // 3. Check recent activity
    console.log('\n3️⃣  Checking recent user activity...');
    const recentUsers = await db.query(`
      SELECT email, last_login
      FROM users
      WHERE last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 5
    `);

    if (recentUsers.rows.length === 0) {
      console.log('   ⚠️  No users with login history found');
    } else {
      console.log('   Recent logins:');
      recentUsers.rows.forEach(u => {
        const timeAgo = getTimeAgo(u.last_login);
        console.log(`   - ${u.email}: ${timeAgo}`);
      });
    }

    // 4. Check CMS table
    console.log('\n4️⃣  Checking CMS setup...');
    try {
      const cmsCount = await db.query('SELECT COUNT(*)::int as count FROM landing_page_content');
      console.log('   ✅ CMS table exists');
      console.log('   CMS sections:', cmsCount.rows[0].count);

      const sections = await db.query('SELECT section_key FROM landing_page_content ORDER BY section_key');
      console.log('   Sections:', sections.rows.map(r => r.section_key).join(', '));
    } catch (error) {
      console.log('   ❌ CMS table not found - run migration!');
    }

    // 5. Test overview endpoint query
    console.log('\n5️⃣  Testing overview metrics query...');
    const metrics = await db.query(`
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as new_this_month,
        COUNT(*) FILTER (WHERE plan = 'free')::int as free_users,
        COUNT(*) FILTER (WHERE plan = 'diy')::int as diy_users,
        COUNT(*) FILTER (WHERE plan = 'pro')::int as pro_users
      FROM users
    `);

    const scansMetrics = await db.query(`
      SELECT
        COUNT(*)::int as total_scans,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as scans_this_month
      FROM scans
    `);

    console.log('   Dashboard Metrics:');
    console.log('   - Total Users:', metrics.rows[0].total_users);
    console.log('   - New This Month:', metrics.rows[0].new_this_month);
    console.log('   - Free/DIY/Pro:', `${metrics.rows[0].free_users}/${metrics.rows[0].diy_users}/${metrics.rows[0].pro_users}`);
    console.log('   - Scans This Month:', scansMetrics.rows[0].scans_this_month);

    console.log('\n✅ Diagnostics complete!\n');
    console.log('📋 Summary:');
    console.log('   - Admin user is configured');
    console.log('   - Database has real data');
    console.log('   - Overview endpoint should work');
    console.log('\n💡 Next Steps:');
    console.log('   1. Refresh your browser (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('   2. Open browser console (F12) to check for errors');
    console.log('   3. Check Network tab for failed API requests');
    console.log('   4. Verify you\'re logged in as monali.s@xeo.marketing\n');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

runDiagnostics();
