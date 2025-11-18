/**
 * Competitive Tracking API
 *
 * Endpoints for managing competitor tracking (Elite mode feature)
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');

/**
 * GET /api/competitors
 * Get all tracked competitors for user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is in Elite mode
    const modeResult = await db.query(
      `SELECT current_mode FROM user_recommendation_mode WHERE user_id = $1`,
      [userId]
    );

    const userMode = modeResult.rows.length > 0 ? modeResult.rows[0].current_mode : 'optimization';

    if (userMode !== 'elite') {
      return res.status(403).json({
        error: 'Elite mode required',
        message: 'Competitive tracking is an Elite mode feature. Reach a score of 850+ to unlock.',
        currentMode: userMode
      });
    }

    // Get all competitors for user
    const result = await db.query(
      `SELECT
        id, competitor_url, competitor_domain, is_active,
        tracking_started_at, last_scanned_at,
        latest_total_score, latest_scan_date,
        score_history, notes,
        created_at, updated_at
      FROM competitive_tracking
      WHERE user_id = $1
      ORDER BY is_active DESC, latest_total_score DESC, created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      competitors: result.rows,
      totalTracked: result.rows.length,
      activeTracked: result.rows.filter(c => c.is_active).length
    });

  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

/**
 * POST /api/competitors
 * Add a new competitor to track
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { url, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!url) {
      return res.status(400).json({ error: 'Competitor URL is required' });
    }

    // Check if user is in Elite mode
    const modeResult = await db.query(
      `SELECT current_mode FROM user_recommendation_mode WHERE user_id = $1`,
      [userId]
    );

    const userMode = modeResult.rows.length > 0 ? modeResult.rows[0].current_mode : 'optimization';

    if (userMode !== 'elite') {
      return res.status(403).json({
        error: 'Elite mode required',
        message: 'Competitive tracking is an Elite mode feature. Reach a score of 850+ to unlock.',
        currentMode: userMode
      });
    }

    // Check competitor count limit (max 3 for Elite)
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM competitive_tracking
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    const currentCount = parseInt(countResult.rows[0].count);
    if (currentCount >= 3) {
      return res.status(403).json({
        error: 'Competitor limit reached',
        message: 'You can track up to 3 competitors. Remove one to add another.',
        currentTracked: currentCount,
        limit: 3
      });
    }

    // Extract domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check if already tracking this competitor
    const existingResult = await db.query(
      `SELECT id FROM competitive_tracking
       WHERE user_id = $1 AND competitor_url = $2`,
      [userId, url]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Already tracking',
        message: 'You are already tracking this competitor',
        competitorId: existingResult.rows[0].id
      });
    }

    // Add competitor
    const insertResult = await db.query(
      `INSERT INTO competitive_tracking (
        user_id, competitor_url, competitor_domain, notes
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [userId, url, domain, notes || null]
    );

    const newCompetitor = insertResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Competitor added successfully',
      competitor: newCompetitor
    });

  } catch (error) {
    console.error('Error adding competitor:', error);
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

/**
 * DELETE /api/competitors/:id
 * Remove a competitor from tracking
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const competitorId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify ownership and delete
    const result = await db.query(
      `DELETE FROM competitive_tracking
       WHERE id = $1 AND user_id = $2
       RETURNING id, competitor_url`,
      [competitorId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Competitor not found',
        message: 'This competitor does not exist or does not belong to you'
      });
    }

    res.json({
      success: true,
      message: 'Competitor removed successfully',
      removedCompetitor: result.rows[0]
    });

  } catch (error) {
    console.error('Error removing competitor:', error);
    res.status(500).json({ error: 'Failed to remove competitor' });
  }
});

/**
 * PATCH /api/competitors/:id
 * Update competitor (toggle active, update notes)
 */
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const competitorId = parseInt(req.params.id);
    const { is_active, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Build update query
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (typeof is_active !== 'undefined') {
      updates.push(`is_active = $${valueIndex++}`);
      values.push(is_active);
    }

    if (typeof notes !== 'undefined') {
      updates.push(`notes = $${valueIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(competitorId, userId);

    const result = await db.query(
      `UPDATE competitive_tracking
       SET ${updates.join(', ')}
       WHERE id = $${valueIndex++} AND user_id = $${valueIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Competitor not found',
        message: 'This competitor does not exist or does not belong to you'
      });
    }

    res.json({
      success: true,
      message: 'Competitor updated successfully',
      competitor: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: 'Failed to update competitor' });
  }
});

/**
 * GET /api/competitors/:id/history
 * Get score history for a competitor
 */
router.get('/:id/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const competitorId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get competitor with history
    const result = await db.query(
      `SELECT
        id, competitor_url, competitor_domain,
        latest_total_score, latest_scan_date,
        score_history, tracking_started_at
      FROM competitive_tracking
      WHERE id = $1 AND user_id = $2`,
      [competitorId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Competitor not found',
        message: 'This competitor does not exist or does not belong to you'
      });
    }

    const competitor = result.rows[0];
    const history = competitor.score_history || [];

    // Calculate trend
    let trend = 'stable';
    if (history.length >= 2) {
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const diff = latest.score - previous.score;

      if (diff > 20) trend = 'improving';
      else if (diff < -20) trend = 'declining';
    }

    res.json({
      success: true,
      competitor: {
        id: competitor.id,
        url: competitor.competitor_url,
        domain: competitor.competitor_domain,
        currentScore: competitor.latest_total_score,
        lastScanned: competitor.latest_scan_date,
        trackingSince: competitor.tracking_started_at,
        trend
      },
      history: history,
      totalScans: history.length
    });

  } catch (error) {
    console.error('Error fetching competitor history:', error);
    res.status(500).json({ error: 'Failed to fetch competitor history' });
  }
});

/**
 * POST /api/competitors/:id/scan
 * Trigger a new scan for competitor (updates score history)
 */
router.post('/:id/scan', async (req, res) => {
  try {
    const userId = req.user?.id;
    const competitorId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get competitor
    const competitorResult = await db.query(
      `SELECT * FROM competitive_tracking
       WHERE id = $1 AND user_id = $2`,
      [competitorId, userId]
    );

    if (competitorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Competitor not found',
        message: 'This competitor does not exist or does not belong to you'
      });
    }

    const competitor = competitorResult.rows[0];

    // Check rate limiting (no more than 1 scan per hour per competitor)
    if (competitor.last_scanned_at) {
      const hoursSinceLastScan = (Date.now() - new Date(competitor.last_scanned_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastScan < 1) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'You can only scan each competitor once per hour',
          lastScanned: competitor.last_scanned_at,
          nextScanAvailable: new Date(new Date(competitor.last_scanned_at).getTime() + 60 * 60 * 1000).toISOString()
        });
      }
    }

    // Trigger scan (this will be handled by the existing scan endpoint)
    // For now, return a message to use the main scan endpoint
    res.json({
      success: true,
      message: 'Use the /api/scan endpoint with this URL as a competitor scan',
      competitorUrl: competitor.competitor_url,
      instructions: 'POST to /api/scan with body: { url: "' + competitor.competitor_url + '" }'
    });

  } catch (error) {
    console.error('Error triggering competitor scan:', error);
    res.status(500).json({ error: 'Failed to trigger competitor scan' });
  }
});

module.exports = router;
