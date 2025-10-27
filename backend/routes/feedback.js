const express = require('express');
const router = express.Router();
const db = require('../db/database');

/**
 * POST /api/feedback/recommendation
 * Submit feedback for a specific recommendation
 */
router.post('/recommendation', async (req, res) => {
  try {
    const {
      scanId,
      recommendationId,
      subfactor,
      helpful,
      rating,
      implemented,
      comment,
      variant,
      industry,
      pageUrl
    } = req.body;

    // Validation
    if (!scanId || !recommendationId || !subfactor) {
      return res.status(400).json({
        error: 'Missing required fields: scanId, recommendationId, subfactor'
      });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    // Get user ID from session (if authenticated)
    const userId = req.user?.id || null;

    // Insert feedback
    const result = await db.query(`
      INSERT INTO recommendation_feedback (
        scan_id,
        recommendation_id,
        subfactor,
        rating,
        helpful,
        implemented,
        comment,
        user_id,
        industry,
        page_url,
        recommendation_variant
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      scanId,
      recommendationId,
      subfactor,
      rating || null,
      helpful,
      implemented || false,
      comment || null,
      userId,
      industry || null,
      pageUrl || null,
      variant || null
    ]);

    console.log(`✅ Feedback received for ${subfactor}: helpful=${helpful}, rating=${rating || 'N/A'}`);

    // Update aggregated metrics asynchronously (don't block response)
    updateQualityMetrics(subfactor, variant, industry).catch(err => {
      console.error('Failed to update quality metrics:', err);
    });

    res.json({
      success: true,
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({
      error: 'Failed to save feedback',
      message: error.message
    });
  }
});

/**
 * POST /api/feedback/interaction
 * Track implicit user interactions with recommendations
 */
router.post('/interaction', async (req, res) => {
  try {
    const {
      scanId,
      recommendationId,
      expanded,
      copiedCode,
      downloaded,
      timeSpent
    } = req.body;

    if (!scanId || !recommendationId) {
      return res.status(400).json({
        error: 'Missing required fields: scanId, recommendationId'
      });
    }

    const userId = req.user?.id || null;

    // Upsert interaction (update if exists, insert if not)
    await db.query(`
      INSERT INTO recommendation_interactions (
        scan_id,
        recommendation_id,
        expanded,
        copied_code,
        downloaded,
        time_spent_seconds,
        user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (scan_id, recommendation_id, user_id)
      DO UPDATE SET
        expanded = EXCLUDED.expanded OR recommendation_interactions.expanded,
        copied_code = EXCLUDED.copied_code OR recommendation_interactions.copied_code,
        downloaded = EXCLUDED.downloaded OR recommendation_interactions.downloaded,
        time_spent_seconds = COALESCE(
          GREATEST(EXCLUDED.time_spent_seconds, recommendation_interactions.time_spent_seconds),
          EXCLUDED.time_spent_seconds,
          recommendation_interactions.time_spent_seconds
        )
    `, [
      scanId,
      recommendationId,
      expanded || false,
      copiedCode || false,
      downloaded || false,
      timeSpent || null,
      userId
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/quality
 * Get aggregated quality metrics for recommendations
 */
router.get('/analytics/quality', async (req, res) => {
  try {
    const {
      subfactor,
      startDate,
      endDate,
      industry,
      minRatings = 5  // Minimum number of ratings to include
    } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    const metrics = await db.query(`
      SELECT
        subfactor,
        COUNT(*) as total_ratings,
        ROUND(AVG(rating)::numeric, 2) as avg_rating,
        SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as helpful_count,
        SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END) as not_helpful_count,
        ROUND(
          (SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END)::numeric /
           NULLIF(SUM(CASE WHEN helpful IS NOT NULL THEN 1 ELSE 0 END), 0) * 100),
          1
        ) as helpful_rate,
        SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END) as implemented_count,
        ROUND(
          (SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END)::numeric /
           COUNT(*)::numeric * 100),
          1
        ) as implementation_rate,
        array_agg(DISTINCT industry) FILTER (WHERE industry IS NOT NULL) as industries,
        MAX(created_at) as last_feedback_date
      FROM recommendation_feedback
      WHERE ($1::text IS NULL OR subfactor = $1)
        AND created_at BETWEEN $2 AND $3
        AND ($4::text IS NULL OR industry = $4)
      GROUP BY subfactor
      HAVING COUNT(*) >= $5
      ORDER BY avg_rating DESC NULLS LAST, total_ratings DESC
    `, [subfactor || null, start, end, industry || null, minRatings]);

    // Get interaction metrics
    const interactions = await db.query(`
      SELECT
        ri.recommendation_id,
        rf.subfactor,
        COUNT(DISTINCT ri.user_id) as unique_viewers,
        SUM(CASE WHEN ri.expanded THEN 1 ELSE 0 END) as expanded_count,
        SUM(CASE WHEN ri.copied_code THEN 1 ELSE 0 END) as copied_count,
        SUM(CASE WHEN ri.downloaded THEN 1 ELSE 0 END) as downloaded_count,
        ROUND(AVG(ri.time_spent_seconds)::numeric, 1) as avg_time_spent
      FROM recommendation_interactions ri
      LEFT JOIN recommendation_feedback rf
        ON ri.scan_id = rf.scan_id
        AND ri.recommendation_id = rf.recommendation_id
      WHERE ri.created_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR rf.subfactor = $3)
      GROUP BY ri.recommendation_id, rf.subfactor
    `, [start, end, subfactor || null]);

    // Get recent comments
    const comments = await db.query(`
      SELECT
        subfactor,
        rating,
        comment,
        helpful,
        created_at
      FROM recommendation_feedback
      WHERE comment IS NOT NULL
        AND comment != ''
        AND created_at BETWEEN $1 AND $2
        AND ($3::text IS NULL OR subfactor = $3)
        AND ($4::text IS NULL OR industry = $4)
      ORDER BY created_at DESC
      LIMIT 50
    `, [start, end, subfactor || null, industry || null]);

    res.json({
      success: true,
      metrics: metrics.rows,
      interactions: interactions.rows,
      recentComments: comments.rows,
      period: { start, end }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/summary
 * Get high-level summary of all recommendation performance
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const summary = await db.query(`
      SELECT
        COUNT(*) as total_feedback,
        COUNT(DISTINCT subfactor) as unique_recommendations,
        ROUND(AVG(rating)::numeric, 2) as overall_avg_rating,
        SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as total_helpful,
        SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END) as total_not_helpful,
        ROUND(
          (SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END)::numeric /
           NULLIF(SUM(CASE WHEN helpful IS NOT NULL THEN 1 ELSE 0 END), 0) * 100),
          1
        ) as overall_helpful_rate,
        SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END) as total_implemented,
        ROUND(
          (SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END)::numeric /
           COUNT(*)::numeric * 100),
          1
        ) as overall_implementation_rate,
        COUNT(DISTINCT user_id) as unique_users
      FROM recommendation_feedback
      WHERE created_at >= $1
    `, [startDate]);

    // Top performers
    const topPerformers = await db.query(`
      SELECT
        subfactor,
        COUNT(*) as rating_count,
        ROUND(AVG(rating)::numeric, 2) as avg_rating,
        ROUND(
          (SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END)::numeric /
           COUNT(*)::numeric * 100),
          1
        ) as implementation_rate
      FROM recommendation_feedback
      WHERE created_at >= $1
        AND rating IS NOT NULL
      GROUP BY subfactor
      HAVING COUNT(*) >= 5
      ORDER BY avg_rating DESC, implementation_rate DESC
      LIMIT 5
    `, [startDate]);

    // Need improvement
    const needsImprovement = await db.query(`
      SELECT
        subfactor,
        COUNT(*) as rating_count,
        ROUND(AVG(rating)::numeric, 2) as avg_rating,
        ROUND(
          (SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END)::numeric /
           NULLIF(SUM(CASE WHEN helpful IS NOT NULL THEN 1 ELSE 0 END), 0) * 100),
          1
        ) as not_helpful_rate,
        array_agg(comment) FILTER (WHERE comment IS NOT NULL) as sample_comments
      FROM recommendation_feedback
      WHERE created_at >= $1
      GROUP BY subfactor
      HAVING COUNT(*) >= 5
        AND AVG(rating) < 3.5
      ORDER BY avg_rating ASC, not_helpful_rate DESC
      LIMIT 5
    `, [startDate]);

    res.json({
      success: true,
      summary: summary.rows[0],
      topPerformers: topPerformers.rows,
      needsImprovement: needsImprovement.rows,
      period: { days, startDate }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

/**
 * Helper function to update aggregated quality metrics
 */
async function updateQualityMetrics(subfactor, variant, industry) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await db.query(`
      INSERT INTO recommendation_quality_metrics (
        subfactor,
        variant,
        industry,
        period_start,
        period_end,
        total_shown,
        total_helpful,
        total_not_helpful,
        avg_rating,
        implementation_rate,
        updated_at
      )
      SELECT
        $1,
        $2,
        $3,
        $4::date,
        $5::date,
        COUNT(*),
        SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END),
        SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END),
        AVG(rating),
        AVG(CASE WHEN implemented = true THEN 100 ELSE 0 END),
        NOW()
      FROM recommendation_feedback
      WHERE subfactor = $1
        AND ($2::text IS NULL OR recommendation_variant = $2)
        AND ($3::text IS NULL OR industry = $3)
        AND created_at::date BETWEEN $4::date AND $5::date
      ON CONFLICT (subfactor, variant, industry, period_start, period_end)
      DO UPDATE SET
        total_shown = EXCLUDED.total_shown,
        total_helpful = EXCLUDED.total_helpful,
        total_not_helpful = EXCLUDED.total_not_helpful,
        avg_rating = EXCLUDED.avg_rating,
        implementation_rate = EXCLUDED.implementation_rate,
        updated_at = NOW()
    `, [subfactor, variant || null, industry || null, weekAgo, today]);
  } catch (error) {
    console.error('Error updating quality metrics:', error);
    throw error;
  }
}

module.exports = router;
