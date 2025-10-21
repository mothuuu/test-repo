const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// POST /api/recommendations/:id/mark-complete
// Mark a recommendation as completed
// ============================================
router.post('/:id/mark-complete', authenticateToken, async (req, res) => {
  try {
    const recId = req.params.id;
    const userId = req.user.id;
    
    console.log(`📝 Marking recommendation ${recId} as complete for user ${userId}`);
    
    // Verify the recommendation belongs to this user
    const recCheck = await db.query(
      `SELECT sr.id, sr.scan_id, sr.unlock_state, s.user_id 
       FROM scan_recommendations sr
       JOIN scans s ON sr.scan_id = s.id
       WHERE sr.id = $1`,
      [recId]
    );
    
    if (recCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    const rec = recCheck.rows[0];
    
    if (rec.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (rec.unlock_state !== 'active') {
      return res.status(400).json({ 
        error: 'Can only mark active recommendations as complete' 
      });
    }
    
    // Update recommendation to completed
    await db.query(
      `UPDATE scan_recommendations 
       SET unlock_state = 'completed',
           marked_complete_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [recId]
    );
    
    // Update user_progress
    await db.query(
      `UPDATE user_progress 
       SET completed_recommendations = completed_recommendations + 1,
           active_recommendations = active_recommendations - 1,
           last_activity_date = CURRENT_DATE
       WHERE scan_id = $1`,
      [rec.scan_id]
    );
    
    console.log(`   ✅ Recommendation marked complete`);
    
    // Get updated progress
    const progressResult = await db.query(
      `SELECT 
        total_recommendations, 
        active_recommendations, 
        completed_recommendations,
        verified_recommendations
       FROM user_progress 
       WHERE scan_id = $1`,
      [rec.scan_id]
    );
    
    const progress = progressResult.rows[0];
    
    res.json({
      success: true,
      message: 'Recommendation marked as complete',
      progress: {
        total: progress.total_recommendations,
        active: progress.active_recommendations,
        completed: progress.completed_recommendations,
        verified: progress.verified_recommendations
      }
    });
    
  } catch (error) {
    console.error('❌ Mark complete error:', error);
    res.status(500).json({ error: 'Failed to mark recommendation as complete' });
  }
});

// ============================================
// GET /api/recommendations/active
// Get all active (unlocked) recommendations for user's scans
// ============================================
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const scanId = req.query.scan_id; // Optional: filter by specific scan
    
    let query = `
      SELECT 
        sr.id, sr.scan_id, sr.category, sr.recommendation_text,
        sr.priority, sr.estimated_impact, sr.estimated_effort,
        sr.action_steps, sr.findings, sr.code_snippet,
        sr.unlock_state, sr.batch_number, sr.unlocked_at,
        sr.marked_complete_at, sr.verified_at,
        s.url as scan_url, s.total_score
      FROM scan_recommendations sr
      JOIN scans s ON sr.scan_id = s.id
      WHERE s.user_id = $1 AND sr.unlock_state = 'active'
    `;
    
    const params = [userId];
    
    if (scanId) {
      query += ` AND sr.scan_id = $2`;
      params.push(scanId);
    }
    
    query += ` ORDER BY sr.batch_number, sr.priority DESC`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      recommendations: result.rows
    });
    
  } catch (error) {
    console.error('❌ Get active recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// ============================================
// GET /api/recommendations/scan/:scanId
// Get all recommendations for a specific scan
// ============================================
router.get('/scan/:scanId', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scanId;
    const userId = req.user.id;
    
    // Verify scan belongs to user
    const scanCheck = await db.query(
      'SELECT user_id FROM scans WHERE id = $1',
      [scanId]
    );
    
    if (scanCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    if (scanCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get all recommendations for this scan
    const result = await db.query(
      `SELECT 
        id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, action_steps,
        findings, code_snippet, unlock_state, batch_number,
        unlocked_at, marked_complete_at, verified_at
       FROM scan_recommendations 
       WHERE scan_id = $1 
       ORDER BY batch_number, priority DESC`,
      [scanId]
    );
    
    // Get progress
    const progressResult = await db.query(
      `SELECT 
        total_recommendations, active_recommendations,
        completed_recommendations, verified_recommendations,
        current_batch, unlocks_today
       FROM user_progress 
       WHERE scan_id = $1`,
      [scanId]
    );
    
    res.json({
      success: true,
      recommendations: result.rows,
      progress: progressResult.rows[0] || null
    });
    
  } catch (error) {
    console.error('❌ Get scan recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// ============================================
// POST /api/recommendations/unlock-next
// Unlock the next batch of recommendations
// ============================================
router.post('/unlock-next', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { scan_id } = req.body;
    
    if (!scan_id) {
      return res.status(400).json({ error: 'scan_id is required' });
    }
    
    console.log(`🔓 Attempting to unlock next batch for scan ${scan_id}`);
    
    // Verify scan belongs to user and get user plan
    const userCheck = await db.query(
      `SELECT u.plan, s.id 
       FROM users u 
       JOIN scans s ON s.user_id = u.id 
       WHERE u.id = $1 AND s.id = $2`,
      [userId, scan_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    const userPlan = userCheck.rows[0].plan;
    
    // Get user progress
    const progressResult = await db.query(
      `SELECT * FROM user_progress WHERE scan_id = $1`,
      [scan_id]
    );
    
    if (progressResult.rows.length === 0) {
      return res.status(404).json({ error: 'Progress record not found' });
    }
    
    const progress = progressResult.rows[0];
    
    // Check if all active recommendations are completed
    if (progress.active_recommendations > 0) {
      return res.status(400).json({ 
        error: 'Complete all active recommendations before unlocking more',
        active_remaining: progress.active_recommendations
      });
    }
    
    // Check if there are more recommendations to unlock
    const totalLocked = await db.query(
      `SELECT COUNT(*) as count 
       FROM scan_recommendations 
       WHERE scan_id = $1 AND unlock_state = 'locked'`,
      [scan_id]
    );
    
    if (parseInt(totalLocked.rows[0].count) === 0) {
      return res.status(400).json({ 
        error: 'No more recommendations to unlock',
        message: 'All recommendations have been unlocked!'
      });
    }
    
    // Check daily unlock limits (DIY only)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastUnlockDate = progress.last_unlock_date ? 
      new Date(progress.last_unlock_date).toISOString().split('T')[0] : null;
    
    let unlocksToday = progress.unlocks_today || 0;
    
    // Reset counter if new day
    if (lastUnlockDate !== today) {
      unlocksToday = 0;
    }
    
    // DIY plan has daily limit of 1 unlock (5 recommendations)
    if (userPlan === 'diy' && unlocksToday >= 1) {
      return res.status(429).json({ 
        error: 'Daily unlock limit reached',
        message: 'DIY plan allows 1 unlock per day (5 recommendations). Upgrade to Pro for unlimited unlocks!',
        next_unlock_available: 'Tomorrow'
      });
    }
    
    // Pro plan has no limits
    console.log(`   ✅ Unlock allowed (Plan: ${userPlan}, Unlocks today: ${unlocksToday})`);
    
    // Determine batch size
    const batchSize = userPlan === 'pro' ? 10 : 5;
    const nextBatch = progress.current_batch + 1;
    
    // Get next batch of locked recommendations
    const nextRecsResult = await db.query(
      `SELECT id FROM scan_recommendations 
       WHERE scan_id = $1 AND unlock_state = 'locked' AND batch_number = $2
       ORDER BY priority DESC, id
       LIMIT $3`,
      [scan_id, nextBatch, batchSize]
    );
    
    if (nextRecsResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'No recommendations found in next batch',
        message: 'All recommendations may already be unlocked'
      });
    }
    
    const recIds = nextRecsResult.rows.map(r => r.id);
    
    // Unlock the recommendations
    await db.query(
      `UPDATE scan_recommendations 
       SET unlock_state = 'active',
           unlocked_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1)`,
      [recIds]
    );
    
    console.log(`   🔓 Unlocked ${recIds.length} recommendations in batch ${nextBatch}`);
    
    // Update user_progress
    await db.query(
      `UPDATE user_progress 
       SET current_batch = $1,
           active_recommendations = active_recommendations + $2,
           last_unlock_date = CURRENT_DATE,
           unlocks_today = $3,
           last_activity_date = CURRENT_DATE
       WHERE scan_id = $4`,
      [nextBatch, recIds.length, unlocksToday + 1, scan_id]
    );
    
    // Get updated progress
    const updatedProgress = await db.query(
      `SELECT 
        total_recommendations, 
        active_recommendations, 
        completed_recommendations,
        verified_recommendations,
        current_batch,
        unlocks_today
       FROM user_progress 
       WHERE scan_id = $1`,
      [scan_id]
    );
    
    // Get the newly unlocked recommendations
    const newRecs = await db.query(
      `SELECT 
        id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, action_steps,
        findings, code_snippet, batch_number
       FROM scan_recommendations 
       WHERE id = ANY($1)
       ORDER BY priority DESC`,
      [recIds]
    );
    
    res.json({
      success: true,
      message: `Unlocked ${recIds.length} new recommendations!`,
      unlocked_count: recIds.length,
      batch_number: nextBatch,
      recommendations: newRecs.rows,
      progress: updatedProgress.rows[0],
      daily_limit_reached: userPlan === 'diy' && (unlocksToday + 1) >= 1
    });
    
  } catch (error) {
    console.error('❌ Unlock next batch error:', error);
    res.status(500).json({ error: 'Failed to unlock next batch' });
  }
});

module.exports = router;