const express = require('express');
const router = express.Router();
const db = require('../db/database');

const { saveHybridRecommendations } = require('../utils/hybrid-recommendation-helper');

// ============================================
// 🚀 IMPORT REAL ENGINES (NEW!)
// ============================================
const V5RubricEngine = require('../analyzers/v5-rubric-engine'); // Import the class
const { generateCompleteRecommendations } = require('../analyzers/recommendation-generator');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Plan limits
const PLAN_LIMITS = {
  free: { scansPerMonth: 2, pagesPerScan: 1 },
  diy: { scansPerMonth: 25, pagesPerScan: 5 },
  pro: { scansPerMonth: 50, pagesPerScan: 25 }
};

// V5 Rubric Category Weights
const V5_WEIGHTS = {
  aiReadability: 0.10,           // 10%
  aiSearchReadiness: 0.20,       // 20%
  contentFreshness: 0.08,        // 8%
  contentStructure: 0.15,        // 15%
  speedUX: 0.05,                 // 5%
  technicalSetup: 0.18,          // 18%
  trustAuthority: 0.12,          // 12%
  voiceOptimization: 0.12        // 12%
};

// ============================================
// POST /api/scan/guest - Guest scan (no auth)
// ============================================
router.post('/guest', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url);
      if (validUrl.protocol !== 'http:' && validUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch (e) {
      return res.status(400).json({ 
        error: 'Invalid URL format. Please use http:// or https://' 
      });
    }

    console.log('🔍 Guest scan requested for:', url);

    // Perform V5 rubric scan (results NOT saved)
    // Use 'guest' tier - NO recommendations shown to anonymous users
    const scanResult = await performV5Scan(url, 'guest');

    // Return results immediately without saving
    res.json({
      success: true,
      total_score: scanResult.totalScore,
      rubric_version: 'V5',
      url: url,
      categories: scanResult.categories,
      recommendations: scanResult.recommendations, // Will be empty array for guest tier
      faq: null, // No FAQ for guest
      upgrade: scanResult.upgrade || null, // CTA to sign up
      message: 'Sign up free to unlock your top 3 recommendations',
      guest: true
    });

  } catch (error) {
    console.error('❌ Guest scan error:', error);
    res.status(500).json({ 
      error: 'Scan failed',
      details: error.message 
    });
  }
});

// ============================================
// POST /api/scan/analyze - Authenticated scan
// ============================================
router.post('/analyze', authenticateToken, async (req, res) => {
  let scan = null; // Define outside try block for error handling

  try {
    const { url, pages } = req.body;
    const userId = req.userId;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url);
      if (validUrl.protocol !== 'http:' && validUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid URL format. Please use http:// or https://'
      });
    }

    // Get user info (including industry preference)
    const userResult = await db.query(
      'SELECT plan, scans_used_this_month, industry, industry_custom FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const planLimits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

    // Log user's industry preference if set
    if (user.industry) {
      console.log(`👤 User industry preference: ${user.industry}${user.industry_custom ? ` (${user.industry_custom})` : ''}`);
    }

    // Check quota
    if (user.scans_used_this_month >= planLimits.scansPerMonth) {
      return res.status(403).json({
        error: 'Scan quota exceeded',
        quota: {
          used: user.scans_used_this_month,
          limit: planLimits.scansPerMonth
        }
      });
    }

    // Validate page count for plan
    const pageCount = pages ? Math.min(pages.length, planLimits.pagesPerScan) : 1;

    console.log(`🔍 Authenticated scan for user ${userId} (${user.plan}) - ${url}`);

    // Create scan record with status 'processing'
    const scanRecord = await db.query(
      `INSERT INTO scans (
        user_id, url, status, page_count, rubric_version
      ) VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, url, status, created_at`,
      [userId, url, 'processing', pageCount, 'V5']
    );

    const scan = scanRecord.rows[0];

    // Get existing user progress for this scan (if any)
    const existingProgressResult = await db.query(
      `SELECT * FROM user_progress WHERE user_id = $1 AND scan_id = $2`,
      [userId, scan.id]
    );
    const userProgress = existingProgressResult.rows.length > 0 ? existingProgressResult.rows[0] : null;

    // Perform V5 rubric scan 🔥 REAL ENGINE!
    const scanResult = await performV5Scan(url, user.plan, pages, userProgress, user.industry);

    // Increment user's scan count AFTER successful scan
    await db.query(
      'UPDATE users SET scans_used_this_month = scans_used_this_month + 1 WHERE id = $1',
      [userId]
    );

    // Update scan record with results
    await db.query(
      `UPDATE scans SET 
        status = $1,
        total_score = $2,
        ai_readability_score = $3,
        ai_search_readiness_score = $4,
        content_freshness_score = $5,
        content_structure_score = $6,
        speed_ux_score = $7,
        technical_setup_score = $8,
        trust_authority_score = $9,
        voice_optimization_score = $10,
        industry = $11,
        detailed_analysis = $12,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $13`,
      [
        'completed',
        scanResult.totalScore,
        scanResult.categories.aiReadability,
        scanResult.categories.aiSearchReadiness,
        scanResult.categories.contentFreshness,
        scanResult.categories.contentStructure,
        scanResult.categories.speedUX,
        scanResult.categories.technicalSetup,
        scanResult.categories.trustAuthority,
        scanResult.categories.voiceOptimization,
        scanResult.industry,
        JSON.stringify(scanResult.detailedAnalysis),
        scan.id
      ]
    );
    
    
    // 🔥 Save recommendations with HYBRID SYSTEM (NEW!)
let progressInfo = null;
if (scanResult.recommendations && scanResult.recommendations.length > 0) {
  // Prepare page priorities from request
  const selectedPages = pages && pages.length > 0 
    ? pages.map((pageUrl, index) => ({
        url: pageUrl,
        priority: index + 1 // First page = priority 1, etc.
      }))
    : [{ url: url, priority: 1 }]; // Just main URL if no pages specified
  
  // Save with hybrid system
  progressInfo = await saveHybridRecommendations(
    scan.id,
    userId,
    url,
    selectedPages,
    scanResult.recommendations,
    user.plan
  );
  
  console.log(`   📊 Recommendations saved:`);
  console.log(`      Site-wide: ${progressInfo.siteWideTotal} (${progressInfo.siteWideActive} active)`);
  console.log(`      Page-specific: ${progressInfo.pageSpecificTotal} (all locked)`);
  console.log(`      Total: ${progressInfo.totalRecommendations}`);
}

    // 🔥 Save FAQ schema if available (DIY tier only)
    if (scanResult.faq && scanResult.faq.length > 0) {
      await db.query(
        `UPDATE scans SET faq_schema = $1 WHERE id = $2`,
        [JSON.stringify(scanResult.faq), scan.id]
      );
    }

    // Log usage
    await db.query(
      'INSERT INTO usage_logs (user_id, action, metadata) VALUES ($1, $2, $3)',
      [userId, 'scan', JSON.stringify({ url, score: scanResult.totalScore, scan_id: scan.id })]
    );

    console.log(`✅ Scan ${scan.id} completed with score: ${scanResult.totalScore}`);

    // Return results
    res.json({
      success: true,
      scan: {
        id: scan.id,
        url: url,
        status: 'completed',
        total_score: scanResult.totalScore,
        rubric_version: 'V5',
        categories: scanResult.categories,
        recommendations: scanResult.recommendations,
        faq: scanResult.faq || null,
        upgrade: scanResult.upgrade || null,
        created_at: scan.created_at
      },
      quota: {
        used: user.scans_used_this_month + 1,
        limit: planLimits.scansPerMonth
      }
    });

  } catch (error) {
    console.error('❌ Authenticated scan error:', error);
    console.error('Stack trace:', error.stack);

    // Mark scan as failed if we created a scan record
    if (scan && scan.id) {
      await db.query(
        `UPDATE scans SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2`,
        ['failed', scan.id]
      );
    }

    res.status(500).json({
      error: 'Scan failed',
      details: error.message
    });
  }
});

// ============================================
// GET /api/scan/:id - Get scan results
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.id;
    const userId = req.userId;

    const result = await db.query(
      `SELECT 
        id, user_id, url, status, total_score, rubric_version,
        ai_readability_score, ai_search_readiness_score,
        content_freshness_score, content_structure_score,
        speed_ux_score, technical_setup_score,
        trust_authority_score, voice_optimization_score,
        industry, page_count, pages_analyzed,
        detailed_analysis, faq_schema, created_at, completed_at
       FROM scans 
       WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const scan = result.rows[0];

    // Get recommendations
    const recResult = await db.query(
      `SELECT
        id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, status,
        action_steps, findings, code_snippet,
        impact_description,
        customized_implementation, ready_to_use_content,
        implementation_notes, quick_wins, validation_checklist,
        user_rating, user_feedback, implemented_at
       FROM scan_recommendations
       WHERE scan_id = $1
       ORDER BY priority DESC, estimated_impact DESC`,
      [scanId]
    );

    // Get user progress (for DIY progressive unlock)
    const progressResult = await db.query(
      `SELECT
        total_recommendations, active_recommendations,
        completed_recommendations, verified_recommendations,
        current_batch, last_unlock_date, unlocks_today,
        site_wide_total, site_wide_completed, site_wide_active,
        page_specific_total, page_specific_completed,
        site_wide_complete
       FROM user_progress
       WHERE user_id = $1 AND scan_id = $2`,
      [userId, scanId]
    );

    const userProgress = progressResult.rows.length > 0 ? progressResult.rows[0] : null;

    res.json({
      success: true,
      scan: {
        ...scan,
        categories: {
          aiReadability: scan.ai_readability_score,
          aiSearchReadiness: scan.ai_search_readiness_score,
          contentFreshness: scan.content_freshness_score,
          contentStructure: scan.content_structure_score,
          speedUX: scan.speed_ux_score,
          technicalSetup: scan.technical_setup_score,
          trustAuthority: scan.trust_authority_score,
          voiceOptimization: scan.voice_optimization_score
        },
        recommendations: recResult.rows,
        faq: scan.faq_schema ? JSON.parse(scan.faq_schema) : null,
        userProgress: userProgress // Include progress for DIY tier
      }
    });

  } catch (error) {
    console.error('❌ Get scan error:', error);
    res.status(500).json({ error: 'Failed to retrieve scan' });
  }
});

// ============================================
// GET /api/scan/list/recent - List recent scans
// ============================================
router.get('/list/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT 
        id, url, status, total_score, rubric_version,
        page_count, industry, created_at, completed_at
       FROM scans 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM scans WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      scans: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + result.rows.length < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('❌ List scans error:', error);
    res.status(500).json({ error: 'Failed to retrieve scans' });
  }
});

// ============================================
// ============================================
// POST /api/scan/:id/unlock - Unlock next batch of recommendations (DIY tier)
// ============================================
router.post('/:id/unlock', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.id;
    const userId = req.userId;

    // Get user plan
    const userResult = await db.query(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Only DIY and Pro users can unlock recommendations
    if (user.plan !== 'diy' && user.plan !== 'pro') {
      return res.status(403).json({
        error: 'Progressive unlock is only available for DIY and Pro tiers',
        upgrade: {
          message: 'Upgrade to DIY Starter to unlock 5 recommendations per day',
          cta: 'Upgrade to DIY - $29/month',
          ctaUrl: '/checkout.html?plan=diy'
        }
      });
    }

    // Verify scan belongs to user
    const scanCheck = await db.query(
      'SELECT id FROM scans WHERE id = $1 AND user_id = $2',
      [scanId, userId]
    );

    if (scanCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Get current user progress
    const progressResult = await db.query(
      `SELECT * FROM user_progress WHERE user_id = $1 AND scan_id = $2`,
      [userId, scanId]
    );

    if (progressResult.rows.length === 0) {
      return res.status(404).json({ error: 'No progress found for this scan' });
    }

    const progress = progressResult.rows[0];
    const today = new Date().toDateString();
    const lastUnlock = progress.last_unlock_date ? new Date(progress.last_unlock_date).toDateString() : null;

    // Check if we need to reset daily counter
    let unlocksToday = progress.unlocks_today || 0;
    if (lastUnlock !== today) {
      unlocksToday = 0; // Reset counter for new day
    }

    // Check daily limit (5 unlocks per day)
    if (unlocksToday >= 5) {
      return res.status(429).json({
        error: 'Daily unlock limit reached',
        message: 'You can unlock 5 new recommendations per day. Come back tomorrow for more!',
        canUnlockAgainAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      });
    }

    // Check if all recommendations are already unlocked
    if (progress.active_recommendations >= progress.total_recommendations) {
      return res.status(400).json({
        error: 'All recommendations already unlocked',
        message: 'You\'ve unlocked all available recommendations for this scan.'
      });
    }

    // Calculate how many to unlock (up to 5, but not more than remaining)
    const remaining = progress.total_recommendations - progress.active_recommendations;
    const toUnlock = Math.min(5, remaining);

    // Update user progress
    const updated = await db.query(
      `UPDATE user_progress
       SET active_recommendations = active_recommendations + $1,
           unlocks_today = $2,
           last_unlock_date = CURRENT_DATE
       WHERE user_id = $3 AND scan_id = $4
       RETURNING *`,
      [toUnlock, unlocksToday + 1, userId, scanId]
    );

    console.log(`🔓 User ${userId} unlocked ${toUnlock} recommendations for scan ${scanId}`);

    res.json({
      success: true,
      message: `Unlocked ${toUnlock} new recommendation${toUnlock > 1 ? 's' : ''}!`,
      progress: updated.rows[0],
      unlocked: toUnlock,
      canUnlockMore: (unlocksToday + 1) < 5 && (progress.active_recommendations + toUnlock) < progress.total_recommendations
    });

  } catch (error) {
    console.error('❌ Unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock recommendations' });
  }
});

// POST /api/scan/:id/recommendation/:recId/feedback
// Learning Loop: Track user actions
// ============================================
router.post('/:id/recommendation/:recId/feedback', authenticateToken, async (req, res) => {
  try {
    const { id: scanId, recId } = req.params;
    const userId = req.userId;
    const { status, feedback, rating } = req.body;

    // Verify scan belongs to user
    const scanCheck = await db.query(
      'SELECT id FROM scans WHERE id = $1 AND user_id = $2',
      [scanId, userId]
    );

    if (scanCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Update recommendation
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(status);
      
      if (status === 'implemented') {
        updateFields.push(`implemented_at = CURRENT_TIMESTAMP`);
      }
    }

    if (feedback) {
      updateFields.push(`user_feedback = $${paramCount++}`);
      updateValues.push(feedback);
    }

    if (rating !== undefined) {
      updateFields.push(`user_rating = $${paramCount++}`);
      updateValues.push(rating);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updateValues.push(recId, scanId);

    await db.query(
      `UPDATE scan_recommendations 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount++} AND scan_id = $${paramCount}`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Feedback recorded for learning loop'
    });

  } catch (error) {
    console.error('❌ Feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// ============================================
// DELETE /api/scan/:id - Delete a scan
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.id;
    const userId = req.userId;

    const result = await db.query(
      'DELETE FROM scans WHERE id = $1 AND user_id = $2 RETURNING id',
      [scanId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json({
      success: true,
      message: 'Scan deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete scan error:', error);
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

// ============================================
// 🔥 CORRECTED - PERFORM V5 RUBRIC SCAN
// Now properly uses the V5RubricEngine class!
// ============================================
async function performV5Scan(url, plan, pages = null, userProgress = null, userIndustry = null) {
  console.log('🔬 Starting V5 rubric analysis for:', url);

  try {
    // Step 1: Create V5 Rubric Engine instance and run analysis
    console.log('📊 Running V5 Rubric Engine...');
    const engine = new V5RubricEngine(url, {});
    const v5Results = await engine.analyze();

    // Extract scores from category results
    const categories = {
      aiReadability: v5Results.categories.aiReadability.score || 0,
      aiSearchReadiness: v5Results.categories.aiSearchReadiness.score || 0,
      contentFreshness: v5Results.categories.contentFreshness.score || 0,
      contentStructure: v5Results.categories.contentStructure.score || 0,
      speedUX: v5Results.categories.speedUX.score || 0,
      technicalSetup: v5Results.categories.technicalSetup.score || 0,
      trustAuthority: v5Results.categories.trustAuthority.score || 0,
      voiceOptimization: v5Results.categories.voiceOptimization.score || 0
    };

    const totalScore = v5Results.totalScore;
    const scanEvidence = engine.evidence;

    // Extract subfactors from each category for issue detection
    const subfactorScores = {};
    for (const [category, data] of Object.entries(v5Results.categories)) {
      subfactorScores[category] = data.subfactors;
    }

    // Determine industry: Prioritize user-selected > auto-detected > fallback
    const finalIndustry = userIndustry || v5Results.industry || 'General';
    const industrySource = userIndustry ? 'user-selected' : (v5Results.industry ? 'auto-detected' : 'default');

    console.log(`🏢 Industry for recommendations: ${finalIndustry} (${industrySource})`);

    // Step 2: Generate recommendations with user progress for DIY tier
    console.log('🤖 Generating recommendations...');

    const recommendationResults = await generateCompleteRecommendations(
      {
        v5Scores: subfactorScores,
        scanEvidence: scanEvidence
      },
      plan,
      finalIndustry,
      userProgress // Pass userProgress for progressive unlock
    );

    console.log(`✅ V5 scan complete. Total score: ${totalScore}/100 (${finalIndustry})`);
    console.log(`📊 Generated ${recommendationResults.data.recommendations.length} recommendations`);

    return {
      totalScore,
      categories,
      recommendations: recommendationResults.data.recommendations,
      faq: recommendationResults.data.faq || null,
      upgrade: recommendationResults.data.upgrade || null,
      industry: v5Results.industry || 'General',
      detailedAnalysis: {
        url,
        scannedAt: new Date().toISOString(),
        rubricVersion: 'V5',
        categoryBreakdown: categories,
        summary: recommendationResults.summary,
        metadata: v5Results.metadata
      }
    };

  } catch (error) {
    console.error('❌ V5 Scan error:', error);
    throw new Error(`V5 scan failed: ${error.message}`);
  }
}

module.exports = router;