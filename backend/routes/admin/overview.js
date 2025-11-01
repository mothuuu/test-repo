const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const { authenticateAdmin } = require('../../middleware/adminAuth');

/**
 * GET /api/admin/overview
 * Get overview dashboard metrics
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '30' } = req.query; // days
    const days = parseInt(timeframe);

    // 1. Total Users Count & Growth
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
    const userGrowthRate = userData.new_last_month > 0
      ? ((userData.new_this_month - userData.new_last_month) / userData.new_last_month * 100).toFixed(1)
      : '0.0';

    // 2. Revenue Metrics
    const revenueResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paying_users,
        SUM(CASE
          WHEN plan = 'diy' THEN 29
          WHEN plan = 'pro' THEN 99
          ELSE 0
        END)::int as monthly_revenue
      FROM users
      WHERE stripe_subscription_id IS NOT NULL
    `);

    const revenueData = revenueResult.rows[0];

    // Calculate revenue trend (comparing to last month)
    const revenueTrendResult = await db.query(`
      SELECT
        SUM(CASE
          WHEN plan = 'diy' THEN 29
          WHEN plan = 'pro' THEN 99
          ELSE 0
        END)::int as last_month_revenue
      FROM users
      WHERE stripe_subscription_id IS NOT NULL
      AND updated_at < NOW() - INTERVAL '1 month'
    `);

    const lastMonthRevenue = revenueTrendResult.rows[0].last_month_revenue || 0;
    const revenueGrowthRate = lastMonthRevenue > 0
      ? ((revenueData.monthly_revenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : '100.0';

    // 3. Scans Metrics
    const scansResult = await db.query(`
      SELECT
        COUNT(*)::int as total_scans,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as scans_this_month,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month' AND created_at < NOW() - INTERVAL '2 months')::int as scans_last_month,
        COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month')::int as active_users_this_month
      FROM scans
    `);

    const scansData = scansResult.rows[0];
    const scansGrowthRate = scansData.scans_last_month > 0
      ? ((scansData.scans_this_month - scansData.scans_last_month) / scansData.scans_last_month * 100).toFixed(1)
      : '0.0';

    // 4. Churn Risk Users (inactive for 30+ days)
    const churnResult = await db.query(`
      SELECT COUNT(*)::int as at_risk_users
      FROM users
      WHERE plan IN ('diy', 'pro')
      AND last_login < NOW() - INTERVAL '30 days'
      AND stripe_subscription_id IS NOT NULL
    `);

    const churnData = churnResult.rows[0];

    // Calculate churn rate
    const churnRate = revenueData.paying_users > 0
      ? (churnData.at_risk_users / revenueData.paying_users * 100).toFixed(1)
      : '0.0';

    // 5. User Growth Chart Data (last 10 months)
    const userGrowthChart = await db.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        COUNT(*)::int as signups
      FROM users
      WHERE created_at >= NOW() - INTERVAL '10 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // 6. Revenue Growth Chart Data (last 10 months)
    const revenueGrowthChart = await db.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        SUM(CASE
          WHEN plan = 'diy' THEN 29
          WHEN plan = 'pro' THEN 99
          ELSE 0
        END)::int as revenue
      FROM users
      WHERE created_at >= NOW() - INTERVAL '10 months'
      AND stripe_subscription_id IS NOT NULL
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);

    // 7. Plan Distribution
    const planDistribution = {
      free: userData.free_users,
      diy: userData.diy_users,
      pro: userData.pro_users
    };

    // 8. Recent User Activity
    const recentActivity = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.plan,
        u.scans_used_this_month,
        u.last_login,
        CASE
          WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN 'active'
          WHEN u.last_login >= NOW() - INTERVAL '30 days' THEN 'inactive'
          ELSE 'at_risk'
        END as status
      FROM users u
      WHERE u.last_login IS NOT NULL
      ORDER BY u.last_login DESC
      LIMIT 5
    `);

    // 9. Conversion Funnel Data
    const funnelData = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE plan = 'free')::int as free_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paid_conversions,
        COUNT(*) FILTER (WHERE plan = 'diy')::int as diy_conversions,
        COUNT(*) FILTER (WHERE plan = 'pro')::int as pro_conversions
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const funnel = funnelData.rows[0];
    const conversionRate = funnel.free_signups > 0
      ? ((funnel.paid_conversions / (funnel.free_signups + funnel.paid_conversions)) * 100).toFixed(1)
      : '0.0';

    // Return overview data
    res.json({
      success: true,
      data: {
        // Hero Metrics
        metrics: {
          totalUsers: {
            value: userData.total_users,
            trend: userGrowthRate,
            trendDirection: parseFloat(userGrowthRate) >= 0 ? 'up' : 'down'
          },
          monthlyRevenue: {
            value: revenueData.monthly_revenue || 0,
            formatted: `$${((revenueData.monthly_revenue || 0) / 1000).toFixed(1)}K`,
            trend: revenueGrowthRate,
            trendDirection: parseFloat(revenueGrowthRate) >= 0 ? 'up' : 'down'
          },
          scansThisMonth: {
            value: scansData.scans_this_month,
            trend: scansGrowthRate,
            trendDirection: parseFloat(scansGrowthRate) >= 0 ? 'up' : 'down'
          },
          churnRate: {
            value: parseFloat(churnRate),
            formatted: `${churnRate}%`,
            trend: '2.1', // TODO: Calculate actual trend
            trendDirection: 'down' // Lower churn is better
          }
        },

        // Plan Distribution
        planDistribution,

        // Charts
        charts: {
          userGrowth: userGrowthChart.rows,
          revenueGrowth: revenueGrowthChart.rows,
          conversionFunnel: {
            anonymous: 2450, // TODO: Track anonymous scans
            freeSignup: funnel.free_signups,
            diyPlan: funnel.diy_conversions,
            proPlan: funnel.pro_conversions,
            conversionRate: parseFloat(conversionRate)
          }
        },

        // Recent Activity
        recentUsers: recentActivity.rows.map(user => ({
          id: user.id,
          name: user.name || 'Unknown',
          email: user.email,
          plan: user.plan,
          scansUsed: user.scans_used_this_month,
          lastActivity: user.last_login,
          status: user.status
        })),

        // Breakdown
        breakdown: {
          freeUsers: userData.free_users,
          payingUsers: revenueData.paying_users,
          atRiskUsers: churnData.at_risk_users,
          activeUsersThisMonth: scansData.active_users_this_month
        }
      }
    });
  } catch (error) {
    console.error('[Admin Overview] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load overview data',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/overview/alerts
 * Get critical alerts for the dashboard
 */
router.get('/alerts', authenticateAdmin, async (req, res) => {
  try {
    const alerts = [];

    // 1. Payment Failures
    const paymentFailures = await db.query(`
      SELECT COUNT(*)::int as count
      FROM users
      WHERE plan IN ('diy', 'pro')
      AND stripe_subscription_id IS NULL
      AND updated_at >= NOW() - INTERVAL '7 days'
    `);

    if (paymentFailures.rows[0].count > 0) {
      alerts.push({
        type: 'critical',
        title: `${paymentFailures.rows[0].count} Payment Failures Pending Retry`,
        description: `Revenue at risk: $${paymentFailures.rows[0].count * 29}/month • Next retry in 2 hours`,
        action: 'Review',
        actionUrl: '/admin/users?filter=payment_failed'
      });
    }

    // 2. High-Value Upsell Opportunities
    const upsellOpportunities = await db.query(`
      SELECT COUNT(*)::int as count
      FROM users
      WHERE plan = 'diy'
      AND scans_used_this_month >= 20
    `);

    if (upsellOpportunities.rows[0].count > 0) {
      alerts.push({
        type: 'warning',
        title: `${upsellOpportunities.rows[0].count} DIY Users Hit 5-Page Limit Multiple Times`,
        description: `Upsell opportunity to Pro • Potential revenue: $${upsellOpportunities.rows[0].count * 70}/mo`,
        action: 'Send Email',
        actionUrl: '/admin/email-campaigns?template=upsell_pro'
      });
    }

    // 3. Inactive Users
    const inactiveUsers = await db.query(`
      SELECT COUNT(*)::int as count
      FROM users
      WHERE last_login < NOW() - INTERVAL '30 days'
      AND plan = 'free'
    `);

    if (inactiveUsers.rows[0].count > 0) {
      alerts.push({
        type: 'info',
        title: `${inactiveUsers.rows[0].count} Inactive Users (30+ Days)`,
        description: `Send re-engagement campaign • Expected reactivation: 12-15%`,
        action: 'Campaign',
        actionUrl: '/admin/email-campaigns?template=reactivation'
      });
    }

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('[Admin Alerts] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load alerts',
      message: error.message
    });
  }
});

module.exports = router;
