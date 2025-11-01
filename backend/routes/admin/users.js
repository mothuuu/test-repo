const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const { authenticateAdmin, requirePermission, createAuditLog } = require('../../middleware/adminAuth');

/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
 */
router.get('/', authenticateAdmin, requirePermission('view_all_users'), async (req, res) => {
  try {
    const {
      search = '',
      plan = 'all',
      status = 'all',
      sortBy = 'recent',
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Search filter
    if (search) {
      queryParams.push(`%${search}%`);
      whereConditions.push(`(
        u.email ILIKE $${paramCount} OR
        u.name ILIKE $${paramCount} OR
        u.primary_domain ILIKE $${paramCount}
      )`);
      paramCount++;
    }

    // Plan filter
    if (plan !== 'all') {
      queryParams.push(plan);
      whereConditions.push(`u.plan = $${paramCount}`);
      paramCount++;
    }

    // Status filter
    if (status === 'active') {
      whereConditions.push(`u.last_login >= NOW() - INTERVAL '7 days'`);
    } else if (status === 'inactive') {
      whereConditions.push(`u.last_login < NOW() - INTERVAL '7 days' AND u.last_login >= NOW() - INTERVAL '30 days'`);
    } else if (status === 'at_risk') {
      whereConditions.push(`u.last_login < NOW() - INTERVAL '30 days'`);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Build ORDER BY clause
    let orderByClause = '';
    switch (sortBy) {
      case 'name':
        orderByClause = 'ORDER BY u.name ASC';
        break;
      case 'plan':
        orderByClause = 'ORDER BY u.plan DESC, u.created_at DESC';
        break;
      case 'last_activity':
        orderByClause = 'ORDER BY u.last_login DESC NULLS LAST';
        break;
      case 'recent':
      default:
        orderByClause = 'ORDER BY u.created_at DESC';
        break;
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*)::int as total
      FROM users u
      ${whereClause}
    `, queryParams);

    const totalUsers = countResult.rows[0].total;

    // Get users
    queryParams.push(parseInt(limit), offset);
    const usersResult = await db.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.plan,
        u.scans_used_this_month,
        u.competitor_scans_used_this_month,
        u.primary_domain,
        u.industry,
        u.stripe_customer_id,
        u.stripe_subscription_id,
        u.email_verified,
        u.created_at,
        u.last_login,
        u.role,
        CASE
          WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN 'active'
          WHEN u.last_login >= NOW() - INTERVAL '30 days' THEN 'inactive'
          ELSE 'at_risk'
        END as status,
        COUNT(s.id)::int as total_scans
      FROM users u
      LEFT JOIN scans s ON s.user_id = u.id
      ${whereClause}
      GROUP BY u.id
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, queryParams);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('[Admin Users List] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load users',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/users/stats
 * Get user statistics for the stats bar
 */
router.get('/stats', authenticateAdmin, requirePermission('view_all_users'), async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE plan = 'free')::int as free_users,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paying_users,
        COUNT(*) FILTER (WHERE last_login < NOW() - INTERVAL '30 days')::int as at_risk_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as new_this_month,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '2 months' AND created_at < NOW() - INTERVAL '1 month')::int as new_last_month
      FROM users
    `);

    const stats = statsResult.rows[0];

    // Calculate growth rate
    const growthRate = stats.new_last_month > 0
      ? ((stats.new_this_month - stats.new_last_month) / stats.new_last_month * 100).toFixed(1)
      : '0.0';

    // Calculate conversion rate
    const conversionRate = stats.total_users > 0
      ? (stats.paying_users / stats.total_users * 100).toFixed(1)
      : '0.0';

    res.json({
      success: true,
      data: {
        totalUsers: stats.total_users,
        freeUsers: stats.free_users,
        payingUsers: stats.paying_users,
        atRiskUsers: stats.at_risk_users,
        growthRate: parseFloat(growthRate),
        conversionRate: parseFloat(conversionRate)
      }
    });
  } catch (error) {
    console.error('[Admin User Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user stats',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 */
router.get('/:id', authenticateAdmin, requirePermission('view_all_users'), async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await db.query(`
      SELECT
        u.*,
        COUNT(s.id)::int as total_scans,
        MAX(s.created_at) as last_scan_date
      FROM users u
      LEFT JOIN scans s ON s.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get recent scans
    const scansResult = await db.query(`
      SELECT id, url, score, created_at
      FROM scans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        user,
        recentScans: scansResult.rows
      }
    });
  } catch (error) {
    console.error('[Admin User Detail] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user details',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/users/:id/plan
 * Upgrade or downgrade user plan
 */
router.put('/:id/plan', authenticateAdmin, requirePermission('upgrade_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPlan } = req.body;

    if (!['free', 'diy', 'pro'].includes(newPlan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type'
      });
    }

    // Get current user data
    const currentUser = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (currentUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const oldPlan = currentUser.rows[0].plan;

    // Update plan
    await db.query(`
      UPDATE users
      SET plan = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPlan, id]);

    // Create audit log
    await createAuditLog(
      req.user,
      'UPDATE_USER_PLAN',
      'users',
      parseInt(id),
      `Changed user plan from ${oldPlan} to ${newPlan}`,
      {
        oldPlan,
        newPlan,
        userId: parseInt(id),
        userEmail: currentUser.rows[0].email
      }
    );

    res.json({
      success: true,
      message: `User plan updated to ${newPlan}`,
      data: {
        oldPlan,
        newPlan
      }
    });
  } catch (error) {
    console.error('[Admin Update Plan] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user plan',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password (send reset email)
 */
router.post('/:id/reset-password', authenticateAdmin, requirePermission('edit_users'), async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(`
      UPDATE users
      SET reset_token = $1,
          reset_token_expires = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [resetToken, resetTokenExpires, id]);

    // TODO: Send reset email
    // For now, just return the reset link

    // Create audit log
    await createAuditLog(
      req.user,
      'RESET_USER_PASSWORD',
      'users',
      parseInt(id),
      `Initiated password reset for user ${user.email}`,
      { userEmail: user.email }
    );

    res.json({
      success: true,
      message: 'Password reset email sent',
      // Remove this in production - only for testing
      resetLink: `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`
    });
  } catch (error) {
    console.error('[Admin Reset Password] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (Super Admin only)
 */
router.delete('/:id', authenticateAdmin, requirePermission('delete_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get user data before deletion
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent deleting admins (unless you're a super admin)
    if (user.role && user.role !== 'user' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    // Delete user (CASCADE will delete related scans, feedback, etc.)
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    // Create audit log
    await createAuditLog(
      req.user,
      'DELETE_USER',
      'users',
      parseInt(id),
      `Deleted user ${user.email} (${user.plan} plan)`,
      {
        deletedUser: {
          email: user.email,
          plan: user.plan,
          createdAt: user.created_at
        }
      }
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('[Admin Delete User] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/users/export
 * Export users to CSV
 */
router.post('/export', authenticateAdmin, requirePermission('export_data'), async (req, res) => {
  try {
    const { filters } = req.body;

    // Build WHERE clause from filters
    let whereConditions = [];
    let queryParams = [];

    // Add filter logic here similar to GET /users

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const usersResult = await db.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.plan,
        u.primary_domain,
        u.industry,
        u.scans_used_this_month,
        u.email_verified,
        u.created_at,
        u.last_login
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
    `, queryParams);

    // Convert to CSV
    const users = usersResult.rows;
    const csvHeader = 'ID,Email,Name,Plan,Domain,Industry,Scans This Month,Email Verified,Created At,Last Login\n';
    const csvRows = users.map(u =>
      `${u.id},${u.email},"${u.name || ''}",${u.plan},"${u.primary_domain || ''}","${u.industry || ''}",${u.scans_used_this_month},${u.email_verified},${u.created_at},${u.last_login || ''}`
    ).join('\n');

    const csv = csvHeader + csvRows;

    // Create audit log
    await createAuditLog(
      req.user,
      'EXPORT_USERS',
      'users',
      null,
      `Exported ${users.length} users to CSV`,
      { count: users.length }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[Admin Export Users] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export users',
      message: error.message
    });
  }
});

module.exports = router;
