const db = require('./db/database');

async function testAdminEndpoint() {
  console.log('🔍 Testing Admin Overview Endpoint Data...\n');

  try {
    // Test 1: Check admin user exists and has role
    console.log('1️⃣  Checking admin user...');
    const userCheck = await db.query(
      "SELECT id, email, role, plan FROM users WHERE email = 'monali.s@xeo.marketing'"
    );

    if (userCheck.rows.length === 0) {
      console.log('❌ Admin user not found!\n');
      console.log('Available users:');
      const allUsers = await db.query('SELECT email FROM users LIMIT 5');
      allUsers.rows.forEach(u => console.log('  -', u.email));
      process.exit(1);
    }

    const adminUser = userCheck.rows[0];
    console.log('✅ Admin user found:');
    console.log('   Email:', adminUser.email);
    console.log('   Role:', adminUser.role || '⚠️  NULL (needs to be super_admin)');
    console.log('   Plan:', adminUser.plan);

    if (!adminUser.role || adminUser.role === 'user') {
      console.log('\n⚠️  Setting admin role...');
      await db.query(
        "UPDATE users SET role = 'super_admin' WHERE email = 'monali.s@xeo.marketing'"
      );
      console.log('✅ Role updated to super_admin\n');
    } else {
      console.log('');
    }

    // Test 2: Get the EXACT data that overview endpoint would return
    console.log('2️⃣  Testing Overview Metrics Query...');

    const usersResult = await db.query(`
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as new_this_month,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month' AND created_at < NOW() - INTERVAL '2 months')::int as new_last_month,
        COUNT(*) FILTER (WHERE plan = 'free')::int as free_users,
        COUNT(*) FILTER (WHERE plan = 'diy')::int as diy_users,
        COUNT(*) FILTER (WHERE plan = 'pro')::int as pro_users
      FROM users
    `);

    const userData = usersResult.rows[0];
    console.log('✅ User Metrics:');
    console.log('   Total Users:', userData.total_users);
    console.log('   New This Month:', userData.new_this_month);
    console.log('   New Last Month:', userData.new_last_month);
    console.log('   Free/DIY/Pro:', `${userData.free_users}/${userData.diy_users}/${userData.pro_users}`);

    // Test 3: Scans data
    console.log('\n3️⃣  Testing Scans Query...');
    const scansResult = await db.query(`
      SELECT
        COUNT(*)::int as total_scans,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as scans_this_month,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 week')::int as scans_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as scans_today,
        COUNT(DISTINCT user_id)::int as unique_users,
        COUNT(*) FILTER (WHERE user_id IS NULL)::int as guest_scans
      FROM scans
    `);

    const scansData = scansResult.rows[0];
    console.log('✅ Scan Metrics:');
    console.log('   Total Scans:', scansData.total_scans);
    console.log('   Scans This Month:', scansData.scans_this_month);
    console.log('   Scans This Week:', scansData.scans_this_week);
    console.log('   Scans Today:', scansData.scans_today);
    console.log('   Guest Scans:', scansData.guest_scans);
    console.log('   Unique Users:', scansData.unique_users);

    // Test 4: Recent Activity
    console.log('\n4️⃣  Testing Recent Activity Query...');
    const recentActivity = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.plan,
        u.scans_used_this_month,
        u.last_login,
        u.created_at,
        CASE
          WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN 'active'
          WHEN u.last_login >= NOW() - INTERVAL '30 days' THEN 'inactive'
          ELSE 'at_risk'
        END as status
      FROM users u
      ORDER BY COALESCE(u.last_login, u.created_at) DESC
      LIMIT 5
    `);

    console.log('✅ Recent Users:');
    if (recentActivity.rows.length === 0) {
      console.log('   ⚠️  No users found!');
    } else {
      recentActivity.rows.forEach((u, i) => {
        const lastActivity = u.last_login || u.created_at;
        const date = new Date(lastActivity);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo;
        if (diffMins < 60) {
          timeAgo = `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours} hours ago`;
        } else {
          timeAgo = `${diffDays} days ago`;
        }

        console.log(`   ${i + 1}. ${u.email} (${u.plan})`);
        console.log(`      Status: ${u.status} | Last seen: ${timeAgo}`);
        console.log(`      Scans used: ${u.scans_used_this_month || 0}`);
      });
    }

    // Test 5: Check if overview endpoint is accessible
    console.log('\n5️⃣  Simulating API Response...');
    const userGrowthRate = userData.new_last_month > 0
      ? ((userData.new_this_month - userData.new_last_month) / userData.new_last_month * 100).toFixed(1)
      : '0.0';

    const apiResponse = {
      success: true,
      data: {
        metrics: {
          totalUsers: {
            value: userData.total_users,
            trend: userGrowthRate,
            trendDirection: parseFloat(userGrowthRate) >= 0 ? 'up' : 'down'
          },
          scansThisMonth: {
            value: scansData.scans_this_month,
            trend: '0.0',
            trendDirection: 'up'
          }
        }
      }
    };

    console.log('✅ API Response Preview:');
    console.log(JSON.stringify(apiResponse, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Backend Data Check Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (userData.total_users === 0) {
      console.log('⚠️  WARNING: No users in database!');
      console.log('   This is why admin console shows no data.\n');
    } else if (scansData.total_scans === 0) {
      console.log('⚠️  WARNING: No scans in database!');
      console.log('   Users exist but no scans have been performed.\n');
    } else {
      console.log('✅ Database has data! If admin console still shows');
      console.log('   no data, the issue is on the FRONTEND side.\n');
    }

    console.log('📋 Next Steps:');
    console.log('   1. Note the numbers above');
    console.log('   2. Compare with what you see in admin console');
    console.log('   3. Open browser console (F12) on admin page');
    console.log('   4. Go to Network tab');
    console.log('   5. Look for /api/admin/overview request');
    console.log('   6. Check if it returns 200 OK or an error\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testAdminEndpoint();
