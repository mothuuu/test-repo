const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const { authenticateAdmin, authenticateContentManager, requirePermission, createAuditLog } = require('../../middleware/adminAuth');

/**
 * Quality Scoring Algorithm
 * Calculates quality scores for recommendations
 */
function calculateQualityScores(recommendation) {
  const content = recommendation.original_content || '';
  const title = recommendation.original_title || '';

  // 1. Clarity Score (0-100)
  let clarityScore = 0;
  if (content.includes('because') || content.includes('this will') || content.includes('allows you to')) clarityScore += 20;
  if (content.match(/\+\d+\s*points?/i)) clarityScore += 20; // Has expected impact
  if (title.length > 20 && title.length < 100) clarityScore += 20; // Good title length
  if (content.split('.').length >= 3) clarityScore += 20; // Multiple sentences
  if (!content.match(/\b(basically|simply|just|easy)\b/gi)) clarityScore += 20; // Avoids overly simplistic language

  // 2. Actionability Score (0-100)
  let actionabilityScore = 0;
  const hasNumberedSteps = content.match(/\n\s*\d+\./g);
  if (hasNumberedSteps && hasNumberedSteps.length >= 3) actionabilityScore += 30;
  const actionVerbs = ['install', 'add', 'configure', 'create', 'update', 'implement', 'set up', 'enable'];
  const actionVerbCount = actionVerbs.filter(verb => content.toLowerCase().includes(verb)).length;
  actionabilityScore += Math.min(actionVerbCount * 10, 25);
  if (content.match(/\b(plugin|tool|library|framework|API)\b/i)) actionabilityScore += 20; // Mentions specific tools
  if (content.match(/\b(\d+\s*hours?|\d+\s*days?|\d+\s*minutes?)\b/i)) actionabilityScore += 15; // Has time estimate
  if (content.includes('```') || content.includes('`')) actionabilityScore += 10; // Has code examples

  // 3. Specificity Score (0-100)
  let specificityScore = 0;
  const genericPhrases = ['improve seo', 'optimize content', 'better performance', 'increase rankings', 'boost visibility'];
  const hasGeneric = genericPhrases.some(phrase => content.toLowerCase().includes(phrase));
  if (!hasGeneric) specificityScore += 25;
  const aiEngines = ['chatgpt', 'perplexity', 'claude', 'gemini', 'ai search', 'ai engine', 'llm'];
  if (aiEngines.some(engine => content.toLowerCase().includes(engine))) specificityScore += 25;
  if (content.match(/\+\d+\s*points?|points?|improvement|increase/i)) specificityScore += 20; // Has specific metrics
  if (recommendation.subfactor) specificityScore += 15; // Contextual to subfactor
  if (title.split(' ').length >= 5) specificityScore += 15; // Specific title

  // 4. Relevance Score (0-100)
  let relevanceScore = 0;
  if (recommendation.scan_id) relevanceScore += 30; // Tied to actual scan
  if (recommendation.original_priority) relevanceScore += 25; // Has priority
  if (recommendation.subfactor) relevanceScore += 20; // Has subfactor
  if (recommendation.original_effort) relevanceScore += 15; // Has effort estimate
  if (recommendation.original_impact && recommendation.original_impact > 0) relevanceScore += 10; // Has impact

  // Overall Quality Score
  const qualityScore = Math.round((clarityScore + actionabilityScore + specificityScore + relevanceScore) / 4);

  return {
    quality_score: qualityScore,
    clarity_score: clarityScore,
    actionability_score: actionabilityScore,
    specificity_score: specificityScore,
    relevance_score: relevanceScore
  };
}

/**
 * Auto-flag low quality recommendations
 */
function autoFlagRecommendation(scores, content, title) {
  const flags = [];
  const issues = [];

  // Flag if overall quality < 50
  if (scores.quality_score < 50) {
    flags.push('low_quality_score');
    issues.push('Overall quality score is too low');
  }

  // Flag if any metric < 40
  if (scores.clarity_score < 40) {
    flags.push('poor_clarity');
    issues.push('Recommendation is not clear enough');
  }
  if (scores.actionability_score < 40) {
    flags.push('not_actionable');
    issues.push('Lacks actionable steps');
  }
  if (scores.specificity_score < 40) {
    flags.push('too_generic');
    issues.push('Too generic - needs more specificity');
  }
  if (scores.relevance_score < 40) {
    flags.push('not_relevant');
    issues.push('Not relevant to user scan');
  }

  // Check for generic phrases
  const genericPhrases = ['improve seo', 'optimize content', 'better performance'];
  if (genericPhrases.some(phrase => content.toLowerCase().includes(phrase))) {
    flags.push('generic_content');
    issues.push('Contains generic SEO advice');
  }

  // Check for numbered steps
  if (!content.match(/\n\s*\d+\./g)) {
    flags.push('missing_steps');
    issues.push('Missing numbered action steps');
  }

  // Check for AI mention
  const aiEngines = ['chatgpt', 'perplexity', 'claude', 'gemini', 'ai search', 'ai engine'];
  if (!aiEngines.some(engine => content.toLowerCase().includes(engine))) {
    flags.push('no_ai_focus');
    issues.push('Does not mention AI engines or LLMs');
  }

  const isFlagged = flags.length > 0;
  const flagReason = issues.join('; ');

  return {
    is_flagged: isFlagged,
    flag_reason: flagReason,
    quality_issues: flags
  };
}

/**
 * GET /api/admin/curation/stats
 * Get curation statistics for the stats bar
 */
router.get('/stats', authenticateContentManager, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_review,
        COUNT(*) FILTER (WHERE status = 'approved' AND approved_at >= NOW() - INTERVAL '7 days')::int as approved_this_week,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
        COUNT(*) FILTER (WHERE used_for_training = true)::int as in_training_queue
      FROM recommendation_curation rc
      LEFT JOIN training_examples te ON te.curation_id = rc.id
    `);

    res.json({
      success: true,
      data: statsResult.rows[0]
    });
  } catch (error) {
    console.error('[Curation Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load curation stats',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/curation/queue
 * Get recommendations pending review
 */
router.get('/queue', authenticateContentManager, async (req, res) => {
  try {
    const {
      status = 'pending',
      subfactor = 'all',
      qualityMin = 0,
      search = '',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 1;

    if (status !== 'all') {
      queryParams.push(status);
      whereConditions.push(`rc.status = $${paramCount}`);
      paramCount++;
    }

    if (subfactor !== 'all') {
      queryParams.push(subfactor);
      whereConditions.push(`rc.subfactor = $${paramCount}`);
      paramCount++;
    }

    if (parseInt(qualityMin) > 0) {
      queryParams.push(parseInt(qualityMin));
      whereConditions.push(`rc.quality_score >= $${paramCount}`);
      paramCount++;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      whereConditions.push(`(rc.original_title ILIKE $${paramCount} OR rc.original_content ILIKE $${paramCount})`);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*)::int as total
      FROM recommendation_curation rc
      WHERE ${whereClause}
    `, queryParams);

    // Get recommendations
    queryParams.push(parseInt(limit), offset);

    // Check if recommendation_feedback table exists first
    let feedbackTableExists = false;
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'recommendation_feedback'
        ) as table_exists
      `);
      feedbackTableExists = tableCheck.rows[0].table_exists;
    } catch (error) {
      console.log('⚠️  Feedback table check failed (non-critical):', error.message);
      feedbackTableExists = false;
    }

    // Build query with conditional feedback metrics
    const feedbackMetrics = feedbackTableExists ? `
        (
          SELECT AVG(rating)::decimal(3,2)
          FROM recommendation_feedback
          WHERE recommendation_id = rc.recommendation_id
        ) as avg_rating,
        (
          SELECT COUNT(*)::int
          FROM recommendation_feedback
          WHERE recommendation_id = rc.recommendation_id
          AND helpful = true
        ) as helpful_count,
        (
          SELECT COUNT(*)::int
          FROM recommendation_feedback
          WHERE recommendation_id = rc.recommendation_id
        ) as feedback_count
    ` : `
        NULL as avg_rating,
        0 as helpful_count,
        0 as feedback_count
    `;

    const recsResult = await db.query(`
      SELECT
        rc.*,
        u.email as curator_email,
        s.url as scan_url,
        ${feedbackMetrics}
      FROM recommendation_curation rc
      LEFT JOIN users u ON u.id = rc.curator_id
      LEFT JOIN scans s ON s.id = rc.scan_id
      WHERE ${whereClause}
      ORDER BY
        CASE WHEN rc.is_flagged THEN 0 ELSE 1 END,
        rc.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, queryParams);

    res.json({
      success: true,
      data: {
        recommendations: recsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.rows[0].total,
          totalPages: Math.ceil(countResult.rows[0].total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('[Curation Queue] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load curation queue',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/curation/score
 * Calculate quality score for a recommendation (for testing/preview)
 */
router.post('/score', authenticateContentManager, async (req, res) => {
  try {
    const { title, content, subfactor } = req.body;

    const scores = calculateQualityScores({
      original_title: title,
      original_content: content,
      subfactor
    });

    const flags = autoFlagRecommendation(scores, content, title);

    res.json({
      success: true,
      data: {
        ...scores,
        ...flags
      }
    });
  } catch (error) {
    console.error('[Score Calculation] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate scores',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/curation/:id
 * Update a recommendation (edit before approval)
 */
router.put('/:id', authenticateContentManager, requirePermission('edit_recommendations'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      edited_title,
      edited_content,
      edited_priority,
      edited_effort,
      edited_impact,
      curator_notes
    } = req.body;

    // Get current recommendation
    const currentRec = await db.query('SELECT * FROM recommendation_curation WHERE id = $1', [id]);
    if (currentRec.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    // Recalculate quality scores based on edited content
    const scores = calculateQualityScores({
      original_title: edited_title,
      original_content: edited_content,
      subfactor: currentRec.rows[0].subfactor
    });

    // Update recommendation
    await db.query(`
      UPDATE recommendation_curation
      SET edited_title = $1,
          edited_content = $2,
          edited_priority = $3,
          edited_effort = $4,
          edited_impact = $5,
          curator_notes = $6,
          curator_id = $7,
          quality_score = $8,
          clarity_score = $9,
          actionability_score = $10,
          specificity_score = $11,
          relevance_score = $12,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $13
    `, [
      edited_title,
      edited_content,
      edited_priority,
      edited_effort,
      edited_impact,
      curator_notes,
      req.user.id,
      scores.quality_score,
      scores.clarity_score,
      scores.actionability_score,
      scores.specificity_score,
      scores.relevance_score,
      id
    ]);

    // Create audit log
    await createAuditLog(
      req.user,
      'EDIT_RECOMMENDATION',
      'recommendation_curation',
      parseInt(id),
      `Edited recommendation #${id}`,
      {
        edited_title,
        quality_score: scores.quality_score
      }
    );

    res.json({
      success: true,
      message: 'Recommendation updated successfully',
      data: scores
    });
  } catch (error) {
    console.error('[Edit Recommendation] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recommendation',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/curation/:id/approve
 * Approve a recommendation and add to training examples
 */
router.post('/:id/approve', authenticateContentManager, requirePermission('curate_recommendations'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get recommendation
    const recResult = await db.query('SELECT * FROM recommendation_curation WHERE id = $1', [id]);
    if (recResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    const rec = recResult.rows[0];

    // Use edited version if exists, otherwise original
    const finalTitle = rec.edited_title || rec.original_title;
    const finalContent = rec.edited_content || rec.original_content;
    const finalPriority = rec.edited_priority || rec.original_priority;
    const finalEffort = rec.edited_effort || rec.original_effort;
    const finalImpact = rec.edited_impact || rec.original_impact;

    // Update status to approved
    await db.query(`
      UPDATE recommendation_curation
      SET status = 'approved',
          curator_id = $1,
          curator_notes = $2,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [req.user.id, notes, id]);

    // Add to training examples
    const content = finalContent || '';
    await db.query(`
      INSERT INTO training_examples (
        curation_id,
        subfactor,
        example_title,
        example_content,
        example_priority,
        example_effort,
        example_impact,
        quality_score,
        approval_reason,
        has_numbered_steps,
        mentions_ai_engines,
        includes_code_examples,
        has_time_estimate,
        has_expected_impact,
        avoids_generic_phrases
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      id,
      rec.subfactor,
      finalTitle,
      finalContent,
      finalPriority,
      finalEffort,
      finalImpact,
      rec.quality_score,
      notes || 'Approved for training',
      !!content.match(/\n\s*\d+\./g),
      !!(content.toLowerCase().match(/chatgpt|perplexity|claude|gemini|ai search/)),
      !!(content.includes('```') || content.includes('`')),
      !!content.match(/\d+\s*(hours?|days?|minutes?)/i),
      !!content.match(/\+\d+\s*points?/i),
      !content.toLowerCase().match(/improve seo|optimize content|better performance/)
    ]);

    // Create audit log
    await createAuditLog(
      req.user,
      'APPROVE_RECOMMENDATION',
      'recommendation_curation',
      parseInt(id),
      `Approved recommendation #${id} for training`,
      {
        subfactor: rec.subfactor,
        quality_score: rec.quality_score
      }
    );

    res.json({
      success: true,
      message: 'Recommendation approved and added to training data'
    });
  } catch (error) {
    console.error('[Approve Recommendation] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve recommendation',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/curation/:id/reject
 * Reject a recommendation and add to negative training examples
 */
router.post('/:id/reject', authenticateContentManager, requirePermission('curate_recommendations'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    // Get recommendation
    const recResult = await db.query('SELECT * FROM recommendation_curation WHERE id = $1', [id]);
    if (recResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    const rec = recResult.rows[0];

    // Update status to rejected
    await db.query(`
      UPDATE recommendation_curation
      SET status = 'rejected',
          curator_id = $1,
          curator_notes = $2,
          rejected_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [req.user.id, reason, id]);

    // Add to negative training examples
    const content = rec.original_content || '';
    await db.query(`
      INSERT INTO training_negative_examples (
        curation_id,
        subfactor,
        bad_example_title,
        bad_example_content,
        rejection_reason,
        quality_issues,
        clarity_score,
        actionability_score,
        specificity_score,
        relevance_score,
        is_too_generic,
        lacks_action_steps,
        no_ai_focus,
        unclear_impact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      id,
      rec.subfactor,
      rec.original_title,
      rec.original_content,
      reason,
      rec.quality_issues || [],
      rec.clarity_score,
      rec.actionability_score,
      rec.specificity_score,
      rec.relevance_score,
      rec.quality_issues && rec.quality_issues.includes('too_generic'),
      rec.quality_issues && rec.quality_issues.includes('missing_steps'),
      rec.quality_issues && rec.quality_issues.includes('no_ai_focus'),
      !content.match(/\+\d+\s*points?/i)
    ]);

    // Create audit log
    await createAuditLog(
      req.user,
      'REJECT_RECOMMENDATION',
      'recommendation_curation',
      parseInt(id),
      `Rejected recommendation #${id}: ${reason}`,
      {
        subfactor: rec.subfactor,
        quality_score: rec.quality_score,
        reason
      }
    );

    res.json({
      success: true,
      message: 'Recommendation rejected and added to negative training examples'
    });
  } catch (error) {
    console.error('[Reject Recommendation] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject recommendation',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/curation/insights
 * Get training insights for the dashboard
 */
router.get('/insights', authenticateContentManager, async (req, res) => {
  try {
    // 1. High approval rate categories
    const approvalByCategory = await db.query(`
      SELECT
        subfactor,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'approved') / COUNT(*), 1) as approval_rate
      FROM recommendation_curation
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY subfactor
      HAVING COUNT(*) >= 5
      ORDER BY approval_rate DESC
      LIMIT 3
    `);

    // 2. Common rejection reasons
    const rejectionReasons = await db.query(`
      SELECT
        rejection_reason,
        COUNT(*)::int as count
      FROM training_negative_examples
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY rejection_reason
      ORDER BY count DESC
      LIMIT 3
    `);

    // 3. Quality trend over time
    const qualityTrend = await db.query(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        AVG(quality_score)::int as avg_quality
      FROM recommendation_curation
      WHERE created_at >= NOW() - INTERVAL '90 days'
      GROUP BY week
      ORDER BY week ASC
    `);

    // 4. User feedback patterns
    // Only query feedback if recommendation_feedback table exists
    let feedbackPatterns = { rows: [] };
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'recommendation_feedback'
        ) as table_exists
      `);

      if (tableCheck.rows[0].table_exists) {
        feedbackPatterns = await db.query(`
          SELECT
            rf.subfactor,
            AVG(rf.rating)::decimal(3,2) as avg_rating,
            ROUND(100.0 * SUM(CASE WHEN rf.helpful = true THEN 1 ELSE 0 END) / COUNT(*), 1) as helpful_rate
          FROM recommendation_feedback rf
          GROUP BY rf.subfactor
          HAVING COUNT(*) >= 5
          ORDER BY helpful_rate DESC
        `);
      }
    } catch (error) {
      console.log('⚠️  Feedback patterns query failed (non-critical):', error.message);
    }

    res.json({
      success: true,
      data: {
        approvalByCategory: approvalByCategory.rows,
        rejectionReasons: rejectionReasons.rows,
        qualityTrend: qualityTrend.rows,
        feedbackPatterns: feedbackPatterns.rows
      }
    });
  } catch (error) {
    console.error('[Curation Insights] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load insights',
      message: error.message
    });
  }
});

module.exports = router;
