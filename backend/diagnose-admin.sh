#!/bin/bash

# Admin Console Diagnostic Script
# Run this in Render Shell to diagnose admin console issues

echo "🔍 AI Visibility Admin Console Diagnostics"
echo "==========================================="
echo ""

cd backend

# 1. Check admin user role
echo "1️⃣  Checking admin user role..."
node -e "
const db = require('./db/database');
(async () => {
  try {
    const result = await db.query(
      \"SELECT id, email, name, role, plan, created_at FROM users WHERE email = 'monali.s@xeo.marketing'\"
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ User found:');
    console.log('   Email:', user.email);
    console.log('   Role:', user.role || '(none - will default to user)');
    console.log('   Plan:', user.plan);
    console.log('   Created:', user.created_at);

    if (!user.role || user.role === 'user') {
      console.log('');
      console.log('⚠️  Setting role to super_admin...');
      await db.query(
        \"UPDATE users SET role = 'super_admin' WHERE email = 'monali.s@xeo.marketing'\"
      );
      console.log('✅ Role updated to super_admin');
    } else {
      console.log('✅ User already has admin role');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "2️⃣  Checking database data..."
node -e "
const db = require('./db/database');
(async () => {
  try {
    const users = await db.query('SELECT COUNT(*)::int as count FROM users');
    console.log('   Total users:', users.rows[0].count);

    const scans = await db.query('SELECT COUNT(*)::int as count FROM scans');
    console.log('   Total scans:', scans.rows[0].count);

    const recentScans = await db.query(\"
      SELECT COUNT(*)::int as count
      FROM scans
      WHERE created_at >= NOW() - INTERVAL '7 days'
    \");
    console.log('   Scans (last 7 days):', recentScans.rows[0].count);

    const guestScans = await db.query(\"
      SELECT COUNT(*)::int as count
      FROM scans
      WHERE user_id IS NULL
    \");
    console.log('   Guest scans:', guestScans.rows[0].count);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "3️⃣  Testing overview endpoint query..."
node -e "
const db = require('./db/database');
(async () => {
  try {
    const result = await db.query(\`
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as new_this_month,
        COUNT(*) FILTER (WHERE plan = 'free')::int as free_users,
        COUNT(*) FILTER (WHERE plan = 'diy')::int as diy_users,
        COUNT(*) FILTER (WHERE plan = 'pro')::int as pro_users
      FROM users
    \`);

    const scans = await db.query(\`
      SELECT
        COUNT(*)::int as total_scans,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as scans_this_month
      FROM scans
    \`);

    console.log('✅ Overview metrics:');
    console.log('   Total Users:', result.rows[0].total_users);
    console.log('   New This Month:', result.rows[0].new_this_month);
    console.log('   Free/DIY/Pro:', \`\${result.rows[0].free_users}/\${result.rows[0].diy_users}/\${result.rows[0].pro_users}\`);
    console.log('   Scans This Month:', scans.rows[0].scans_this_month);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "4️⃣  Checking recent user activity..."
node -e "
const db = require('./db/database');
(async () => {
  try {
    const result = await db.query(\`
      SELECT email, last_login, plan
      FROM users
      WHERE last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 5
    \`);

    if (result.rows.length === 0) {
      console.log('⚠️  No users with login history found');
    } else {
      console.log('✅ Recent logins:');
      result.rows.forEach(u => {
        const date = new Date(u.last_login);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo;
        if (diffHours < 24) {
          timeAgo = \`\${diffHours} hours ago\`;
        } else {
          timeAgo = \`\${diffDays} days ago\`;
        }

        console.log(\`   - \${u.email} (\${u.plan}): \${timeAgo}\`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "5️⃣  Checking CMS table..."
node -e "
const db = require('./db/database');
(async () => {
  try {
    const count = await db.query('SELECT COUNT(*)::int as count FROM landing_page_content');
    console.log('✅ CMS table exists');
    console.log('   Sections:', count.rows[0].count);

    const sections = await db.query('SELECT section_key FROM landing_page_content ORDER BY section_key');
    console.log('   Keys:', sections.rows.map(r => r.section_key).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ CMS table not found:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "✅ Diagnostics complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Redeploy backend on Render (if not already done)"
echo "   2. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "   3. Open browser console (F12) and check for errors"
echo "   4. Check Network tab for /api/admin/overview request status"
echo ""
