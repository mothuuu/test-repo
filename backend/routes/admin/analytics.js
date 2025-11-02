/**
 * Admin Analytics Routes
 * Source tracking, affiliate performance, conversion analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const { authenticateAdmin, requirePermission } = require('../../middleware/adminAuth');

/**
 * GET /api/admin/analytics/sources
 * Get signup source analytics
 */
router.get('/sources', authenticateAdmin, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let dateFilter = '';
    let queryParams = [];

    if (date_from && date_to) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
      queryParams = [date_from, date_to];
    } else {
      // Default to last 30 days
      dateFilter = 'WHERE created_at >= NOW() - INTERVAL \'30 days\'';
    }

    // Get source breakdown
    const sourcesResult = await db.query(`
      SELECT
        COALESCE(signup_source, 'organic') as source,
        COALESCE(signup_medium, 'none') as medium,
        COUNT(*)::int as total_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paid_conversions,
        ROUND(
          COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::numeric /
          NULLIF(COUNT(*), 0) * 100,
          1
        ) as conversion_rate,
        COUNT(DISTINCT DATE(created_at))::int as active_days,
        MIN(created_at) as first_signup,
        MAX(created_at) as last_signup
      FROM users
      ${dateFilter}
      GROUP BY signup_source, signup_medium
      ORDER BY total_signups DESC
    `, queryParams);

    // Get affiliate breakdown
    const affiliatesResult = await db.query(`
      SELECT
        affiliate_id,
        COUNT(*)::int as total_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paid_conversions,
        ROUND(
          COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::numeric /
          NULLIF(COUNT(*), 0) * 100,
          1
        ) as conversion_rate,
        MIN(created_at) as first_signup,
        MAX(created_at) as last_signup
      FROM users
      ${dateFilter}
      AND affiliate_id IS NOT NULL
      GROUP BY affiliate_id
      ORDER BY total_signups DESC
    `, queryParams);

    // Get campaign breakdown
    const campaignsResult = await db.query(`
      SELECT
        signup_campaign as campaign,
        signup_source as source,
        COUNT(*)::int as total_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paid_conversions,
        ROUND(
          COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::numeric /
          NULLIF(COUNT(*), 0) * 100,
          1
        ) as conversion_rate
      FROM users
      ${dateFilter}
      AND signup_campaign IS NOT NULL
      GROUP BY signup_campaign, signup_source
      ORDER BY total_signups DESC
    `, queryParams);

    // Get overall stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*)::int as total_signups,
        COUNT(*) FILTER (WHERE signup_source IS NOT NULL)::int as tracked_signups,
        COUNT(*) FILTER (WHERE affiliate_id IS NOT NULL)::int as affiliate_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as paid_conversions,
        COUNT(DISTINCT affiliate_id) FILTER (WHERE affiliate_id IS NOT NULL)::int as unique_affiliates,
        COUNT(DISTINCT signup_source) FILTER (WHERE signup_source IS NOT NULL)::int as unique_sources
      FROM users
      ${dateFilter}
    `, queryParams);

    res.json({
      success: true,
      data: {
        stats: statsResult.rows[0],
        sources: sourcesResult.rows,
        affiliates: affiliatesResult.rows,
        campaigns: campaignsResult.rows
      }
    });

  } catch (error) {
    console.error('[Admin Analytics Sources] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/analytics/sources/chart
 * Get source analytics over time for charts
 */
router.get('/sources/chart', authenticateAdmin, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { date_from, date_to, granularity = 'day' } = req.query;

    let dateFilter = 'WHERE created_at >= NOW() - INTERVAL \'30 days\'';
    let queryParams = [];

    if (date_from && date_to) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
      queryParams = [date_from, date_to];
    }

    // Determine date truncation based on granularity
    const dateTrunc = granularity === 'month' ? 'month' :
                      granularity === 'week' ? 'week' : 'day';

    const chartData = await db.query(`
      SELECT
        DATE_TRUNC('${dateTrunc}', created_at) as period,
        COALESCE(signup_source, 'organic') as source,
        COUNT(*)::int as signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::int as conversions
      FROM users
      ${dateFilter}
      GROUP BY DATE_TRUNC('${dateTrunc}', created_at), signup_source
      ORDER BY period, source
    `, queryParams);

    res.json({
      success: true,
      data: chartData.rows
    });

  } catch (error) {
    console.error('[Admin Analytics Chart] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load chart data',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/analytics/scans
 * Get scan analytics
 */
router.get('/scans', authenticateAdmin, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', sort_by = 'recent' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (search) {
      queryParams.push(`%${search}%`);
      // Include guest scans (where u.email IS NULL) in search results
      whereConditions.push(`(s.url ILIKE $${paramCount} OR (u.email IS NOT NULL AND u.email ILIKE $${paramCount}))`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Build ORDER BY clause
    let orderByClause = '';
    switch (sort_by) {
      case 'score_high':
        orderByClause = 'ORDER BY s.total_score DESC NULLS LAST, s.created_at DESC';
        break;
      case 'score_low':
        orderByClause = 'ORDER BY s.total_score ASC NULLS LAST, s.created_at DESC';
        break;
      case 'user':
        orderByClause = 'ORDER BY u.email ASC NULLS LAST, s.created_at DESC';
        break;
      case 'recent':
      default:
        orderByClause = 'ORDER BY s.created_at DESC';
        break;
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*)::int as total
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
    `, queryParams);

    const totalScans = countResult.rows[0].total;

    // Get scans - include guest scans (user_id IS NULL)
    queryParams.push(parseInt(limit), offset);

    // Check if is_competitor_scan column exists
    const columnCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'scans' AND column_name = 'is_competitor_scan'
    `);
    const hasCompetitorColumn = columnCheck.rows.length > 0;

    const scansResult = await db.query(`
      SELECT
        s.id,
        s.url,
        s.total_score as score,
        s.created_at,
        s.completed_at,
        s.status,
        ${hasCompetitorColumn ? 's.is_competitor_scan' : 'FALSE as is_competitor_scan'},
        u.id as user_id,
        u.email as user_email,
        u.name as user_name,
        u.plan as user_plan,
        CASE WHEN u.id IS NOT NULL THEN
          (SELECT signup_source FROM users WHERE id = u.id)
        ELSE NULL END as signup_source,
        CASE WHEN u.id IS NOT NULL THEN
          (SELECT affiliate_id FROM users WHERE id = u.id)
        ELSE NULL END as affiliate_id,
        (SELECT COUNT(*) FROM scans WHERE user_id = s.user_id)::int as user_total_scans
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, queryParams);

    // Get scan stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*)::int as total_scans,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as scans_last_30_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as scans_last_7_days,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as scans_today,
        ROUND(AVG(total_score), 1) as avg_score,
        COUNT(DISTINCT user_id)::int as unique_users,
        COUNT(*) FILTER (WHERE user_id IS NULL)::int as guest_scans,
        ${hasCompetitorColumn ? "COUNT(*) FILTER (WHERE is_competitor_scan = true)::int" : "0::int"} as competitor_scans
      FROM scans
    `);

    res.json({
      success: true,
      data: {
        scans: scansResult.rows,
        stats: statsResult.rows[0],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalScans,
          totalPages: Math.ceil(totalScans / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('[Admin Analytics Scans] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load scans',
      message: error.message
    });
  }
});

module.exports = router;
