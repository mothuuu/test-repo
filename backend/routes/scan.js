const express = require('express');
const router = express.Router();
const db = require('../db/database');

const { saveHybridRecommendations } = require('../utils/hybrid-recommendation-helper');
const { extractRootDomain, isPrimaryDomain } = require('../utils/domain-extractor');

// ============================================
// 🚀 IMPORT REAL ENGINES (NEW!)
// ============================================
const V5EnhancedRubricEngine = require('../analyzers/v5-enhanced-rubric-engine'); // Import the ENHANCED class
const V5RubricEngine = V5EnhancedRubricEngine; // Alias for compatibility
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
  free: { scansPerMonth: 2, pagesPerScan: 1, competitorScans: 0 },
  diy: { scansPerMonth: 25, pagesPerScan: 5, competitorScans: 2 },
  pro: { scansPerMonth: 50, pagesPerScan: 25, competitorScans: 10 }
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

    // Perform V5 rubric scan
    // Use 'guest' tier - NO recommendations shown to anonymous users
    const scanResult = await performV5Scan(url, 'guest');

    // Save guest scan to database for analytics (with user_id = NULL)
    // NOTE: Round scores to integers since DB columns are INTEGER type
    try {
      await db.query(
        `INSERT INTO scans (
          user_id, url, status, page_count, rubric_version,
          total_score, ai_readability_score, ai_search_readiness_score,
          content_freshness_score, content_structure_score, speed_ux_score,
          technical_setup_score, trust_authority_score, voice_optimization_score,
          industry, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)`,
        [
          null, // user_id is NULL for guest scans
          url,
          'completed',
          1, // page_count
          'V5',
          Math.round(scanResult.totalScore),  // Round to integer
          Math.round(scanResult.categories.aiReadability),
          Math.round(scanResult.categories.aiSearchReadiness),
          Math.round(scanResult.categories.contentFreshness),
          Math.round(scanResult.categories.contentStructure),
          Math.round(scanResult.categories.speedUX),
          Math.round(scanResult.categories.technicalSetup),
          Math.round(scanResult.categories.trustAuthority),
          Math.round(scanResult.categories.voiceOptimization),
          scanResult.industry
        ]
      );
      console.log('✅ Guest scan saved to database for analytics');
    } catch (dbError) {
      console.error('⚠️  Failed to save guest scan to database:', dbError.message);
      console.error('⚠️  DB Error details:', dbError);
      // Continue anyway - don't fail the response if DB save fails
    }

    // Return results
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

    // Get user info (including industry preference and primary domain)
    const userResult = await db.query(
      `SELECT plan, scans_used_this_month, industry, industry_custom,
              primary_domain, competitor_scans_used_this_month, primary_domain_changed_at
       FROM users WHERE id = $1`,
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

    // Extract domain from scan URL
    const scanDomain = extractRootDomain(url);
    if (!scanDomain) {
      return res.status(400).json({ error: 'Unable to extract domain from URL' });
    }

    // Determine if this is a primary domain or competitor scan
    let domainType = 'primary';
    let isCompetitorScan = false;

    if (!user.primary_domain) {
      // First scan - set as primary domain
      console.log(`🏠 Setting primary domain for user ${userId}: ${scanDomain}`);
      await db.query(
        'UPDATE users SET primary_domain = $1 WHERE id = $2',
        [scanDomain, userId]
      );
      user.primary_domain = scanDomain;
    } else if (!isPrimaryDomain(url, user.primary_domain)) {
      // Different domain - this is a competitor scan
      domainType = 'competitor';
      isCompetitorScan = true;
      console.log(`🔍 Competitor scan detected: ${scanDomain} (primary: ${user.primary_domain})`);

      // Check competitor scan quota
      const competitorScansUsed = user.competitor_scans_used_this_month || 0;
      if (competitorScansUsed >= planLimits.competitorScans) {
        return res.status(403).json({
          error: 'Competitor scan quota exceeded',
          message: `Your ${user.plan} plan allows ${planLimits.competitorScans} competitor scans per month. You've used ${competitorScansUsed}.`,
          quota: {
            type: 'competitor',
            used: competitorScansUsed,
            limit: planLimits.competitorScans
          },
          primaryDomain: user.primary_domain,
          upgrade: user.plan === 'free' ? {
            message: 'Upgrade to DIY to scan 2 competitors per month',
            cta: 'Upgrade to DIY - $29/month',
            ctaUrl: '/checkout.html?plan=diy'
          } : user.plan === 'diy' ? {
            message: 'Upgrade to Pro for 10 competitor scans per month',
            cta: 'Upgrade to Pro - $99/month',
            ctaUrl: '/checkout.html?plan=pro'
          } : null
        });
      }
    }

    // Check primary scan quota (only for primary domain scans)
    if (!isCompetitorScan && user.scans_used_this_month >= planLimits.scansPerMonth) {
      return res.status(403).json({
        error: 'Scan quota exceeded',
        quota: {
          type: 'primary',
          used: user.scans_used_this_month,
          limit: planLimits.scansPerMonth
        }
      });
    }

    // Validate page count for plan
    const pageCount = pages ? Math.min(pages.length, planLimits.pagesPerScan) : 1;

    console.log(`🔍 Authenticated scan for user ${userId} (${user.plan}) - ${url} [${domainType}]`);

    // Create scan record with status 'processing'
    const scanRecord = await db.query(
      `INSERT INTO scans (
        user_id, url, status, page_count, rubric_version, domain_type, extracted_domain
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, url, status, created_at`,
      [userId, url, 'processing', pageCount, 'V5', domainType, scanDomain]
    );

    const scan = scanRecord.rows[0];

    // Get existing user progress for this scan (if any) - only for primary domain scans
    let userProgress = null;
    if (!isCompetitorScan) {
      const existingProgressResult = await db.query(
        `SELECT * FROM user_progress WHERE user_id = $1 AND scan_id = $2`,
        [userId, scan.id]
      );
      userProgress = existingProgressResult.rows.length > 0 ? existingProgressResult.rows[0] : null;
    }

    // Perform appropriate scan type
    let scanResult;
    if (isCompetitorScan) {
      // Lightweight competitor scan (scores only, no recommendations)
      console.log(`🔍 Performing lightweight competitor scan (scores only)`);
      scanResult = await performCompetitorScan(url);
    } else {
      // Full V5 rubric scan with recommendations
      scanResult = await performV5Scan(url, user.plan, pages, userProgress, user.industry);
    }

    // Validate scan result structure
    if (!scanResult || !scanResult.categories) {
      console.error('❌ CRITICAL: performV5Scan returned invalid structure');
      console.error('   scanResult:', JSON.stringify(scanResult, null, 2));
      throw new Error('Scan analyzer returned incomplete data');
    }

    // Validate category structure (categories should be numbers 0-100, not objects)
    const requiredCategories = ['aiReadability', 'aiSearchReadiness', 'contentFreshness',
                                 'contentStructure', 'speedUX', 'technicalSetup',
                                 'trustAuthority', 'voiceOptimization'];

    for (const cat of requiredCategories) {
      const value = scanResult.categories[cat];
      if (typeof value !== 'number' || isNaN(value)) {
        console.error(`❌ CRITICAL: Missing or invalid category: ${cat}`);
        console.error(`   Expected number, got:`, typeof value, value);
        throw new Error(`Invalid category data: ${cat} - expected number, got ${typeof value}`);
      }
    }

    console.log('✅ Scan result validation passed');

    // Increment appropriate scan count AFTER successful scan
    if (isCompetitorScan) {
      await db.query(
        'UPDATE users SET competitor_scans_used_this_month = competitor_scans_used_this_month + 1 WHERE id = $1',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE users SET scans_used_this_month = scans_used_this_month + 1 WHERE id = $1',
        [userId]
      );
    }

    // Update scan record with results
    // NOTE: Round scores to integers since DB columns are INTEGER type
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
        Math.round(scanResult.totalScore),  // Round to integer
        Math.round(scanResult.categories.aiReadability),
        Math.round(scanResult.categories.aiSearchReadiness),
        Math.round(scanResult.categories.contentFreshness),
        Math.round(scanResult.categories.contentStructure),
        Math.round(scanResult.categories.speedUX),
        Math.round(scanResult.categories.technicalSetup),
        Math.round(scanResult.categories.trustAuthority),
        Math.round(scanResult.categories.voiceOptimization),
        scanResult.industry,
        JSON.stringify(scanResult.detailedAnalysis),
        scan.id
      ]
    );
    

    // 🔥 Save recommendations with HYBRID SYSTEM (NEW!)
    // Skip saving recommendations for competitor scans
let progressInfo = null;
if (!isCompetitorScan && scanResult.recommendations && scanResult.recommendations.length > 0) {
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
        domain_type: domainType,
        extracted_domain: scanDomain,
        primary_domain: user.primary_domain,
        categories: scanResult.categories,
        categoryBreakdown: scanResult.categories, // Frontend expects this field name
        recommendations: scanResult.recommendations || [],
        faq: (!isCompetitorScan && scanResult.faq) ? scanResult.faq : null,
        upgrade: scanResult.upgrade || null,
        created_at: scan.created_at,
        is_competitor: isCompetitorScan
      },
      quota: {
        primary: {
          used: user.scans_used_this_month + (isCompetitorScan ? 0 : 1),
          limit: planLimits.scansPerMonth
        },
        competitor: {
          used: (user.competitor_scans_used_this_month || 0) + (isCompetitorScan ? 1 : 0),
          limit: planLimits.competitorScans
        }
      },
      message: isCompetitorScan
        ? `Competitor scan complete. Scores only - recommendations not available for competitor domains.`
        : null
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
        site_wide_complete,
        batch_1_unlock_date, batch_2_unlock_date,
        batch_3_unlock_date, batch_4_unlock_date,
        total_batches
       FROM user_progress
       WHERE user_id = $1 AND scan_id = $2`,
      [userId, scanId]
    );

    const userProgress = progressResult.rows.length > 0 ? progressResult.rows[0] : null;

    // Check if any batches should be auto-unlocked based on date
    let batchesUnlocked = 0;
    if (userProgress && userProgress.total_batches > 0) {
      const now = new Date();
      const batchDates = [
        userProgress.batch_1_unlock_date,
        userProgress.batch_2_unlock_date,
        userProgress.batch_3_unlock_date,
        userProgress.batch_4_unlock_date
      ];

      // Find which batch should be unlocked based on current date
      let targetBatch = 1;
      for (let i = 0; i < 4; i++) {
        if (batchDates[i] && new Date(batchDates[i]) <= now) {
          targetBatch = i + 1;
        }
      }

      // If we should unlock more batches than currently unlocked
      if (targetBatch > userProgress.current_batch) {
        console.log(`🔓 Auto-unlocking batches ${userProgress.current_batch + 1} to ${targetBatch} for scan ${scanId}`);

        // Calculate how many recommendations to unlock
        const recsPerBatch = 5;
        const currentlyActive = userProgress.active_recommendations || 0;
        const shouldBeActive = Math.min(targetBatch * recsPerBatch, userProgress.total_recommendations);
        const toUnlock = shouldBeActive - currentlyActive;

        if (toUnlock > 0) {
          // Unlock the next batch of recommendations
          await db.query(
            `UPDATE scan_recommendations
             SET unlock_state = 'active',
                 unlocked_at = NOW(),
                 skip_enabled_at = NOW() + INTERVAL '5 days'
             WHERE scan_id = $1
               AND unlock_state = 'locked'
               AND batch_number <= $2
             ORDER BY batch_number, id
             LIMIT $3`,
            [scanId, targetBatch, toUnlock]
          );

          // Update user progress
          await db.query(
            `UPDATE user_progress
             SET current_batch = $1,
                 active_recommendations = $2
             WHERE user_id = $3 AND scan_id = $4`,
            [targetBatch, shouldBeActive, userId, scanId]
          );

          batchesUnlocked = targetBatch - userProgress.current_batch;
          console.log(`   ✅ Unlocked ${toUnlock} recommendations (batches ${userProgress.current_batch + 1}-${targetBatch})`);

          // Refresh user progress
          const updatedProgress = await db.query(
            `SELECT * FROM user_progress WHERE user_id = $1 AND scan_id = $2`,
            [userId, scanId]
          );
          Object.assign(userProgress, updatedProgress.rows[0]);
        }
      }
    }

    // Get updated recommendations after potential unlock
    const updatedRecResult = await db.query(
      `SELECT
        id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, status,
        action_steps, findings, code_snippet,
        impact_description,
        customized_implementation, ready_to_use_content,
        implementation_notes, quick_wins, validation_checklist,
        user_rating, user_feedback, implemented_at,
        unlock_state, batch_number, unlocked_at, skipped_at,
        recommendation_type, page_url
       FROM scan_recommendations
       WHERE scan_id = $1
       ORDER BY batch_number, priority DESC, estimated_impact DESC`,
      [scanId]
    );

    // Calculate next batch unlock info
    let nextBatchUnlock = null;
    if (userProgress && userProgress.current_batch < userProgress.total_batches) {
      const nextBatchNum = userProgress.current_batch + 1;
      const nextBatchDate = userProgress[`batch_${nextBatchNum}_unlock_date`];
      if (nextBatchDate) {
        const now = new Date();
        const unlockDate = new Date(nextBatchDate);
        const daysUntilUnlock = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));

        nextBatchUnlock = {
          batchNumber: nextBatchNum,
          unlockDate: nextBatchDate,
          daysRemaining: Math.max(0, daysUntilUnlock),
          recommendationsInBatch: 5
        };
      }
    }

    const categoryScores = {
      aiReadability: scan.ai_readability_score,
      aiSearchReadiness: scan.ai_search_readiness_score,
      contentFreshness: scan.content_freshness_score,
      contentStructure: scan.content_structure_score,
      speedUX: scan.speed_ux_score,
      technicalSetup: scan.technical_setup_score,
      trustAuthority: scan.trust_authority_score,
      voiceOptimization: scan.voice_optimization_score
    };

    res.json({
      success: true,
      scan: {
        ...scan,
        categories: categoryScores,
        categoryBreakdown: categoryScores, // Frontend expects this field name
        recommendations: updatedRecResult.rows,
        faq: scan.faq_schema ? JSON.parse(scan.faq_schema) : null,
        userProgress: userProgress, // Include progress for DIY tier
        nextBatchUnlock: nextBatchUnlock, // Next batch unlock info
        batchesUnlocked: batchesUnlocked // How many batches were just unlocked
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
        page_count, industry, domain_type, extracted_domain,
        ai_readability_score, ai_search_readiness_score,
        content_freshness_score, content_structure_score,
        speed_ux_score, technical_setup_score,
        trust_authority_score, voice_optimization_score,
        created_at, completed_at
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
          message: 'Upgrade to DIY Starter to unlock 5 recommendations every 5 days',
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
    const now = new Date();
    const lastUnlock = progress.last_unlock_date ? new Date(progress.last_unlock_date) : null;

    // Calculate days since last unlock
    let daysSinceLastUnlock = 0;
    if (lastUnlock) {
      daysSinceLastUnlock = Math.floor((now - lastUnlock) / (1000 * 60 * 60 * 24));
    }

    // Check 5-day interval requirement (DIY tier only)
    if (user.plan === 'diy' && lastUnlock && daysSinceLastUnlock < 5) {
      const daysRemaining = 5 - daysSinceLastUnlock;
      const nextUnlockDate = new Date(lastUnlock);
      nextUnlockDate.setDate(nextUnlockDate.getDate() + 5);

      return res.status(429).json({
        error: 'Unlock interval not met',
        message: `You can unlock 5 new recommendations every 5 days. Come back in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}!`,
        canUnlockAgainAt: nextUnlockDate.toISOString(),
        daysRemaining: daysRemaining
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

    // Update user progress (remove unlocks_today since we're using 5-day intervals)
    const updated = await db.query(
      `UPDATE user_progress
       SET active_recommendations = active_recommendations + $1,
           last_unlock_date = CURRENT_DATE
       WHERE user_id = $2 AND scan_id = $3
       RETURNING *`,
      [toUnlock, userId, scanId]
    );

    console.log(`🔓 User ${userId} unlocked ${toUnlock} recommendations for scan ${scanId}`);

    // Calculate next unlock date (5 days from now for DIY)
    const nextUnlockDate = new Date();
    nextUnlockDate.setDate(nextUnlockDate.getDate() + 5);

    res.json({
      success: true,
      message: `Unlocked ${toUnlock} new recommendation${toUnlock > 1 ? 's' : ''}!`,
      progress: updated.rows[0],
      unlocked: toUnlock,
      canUnlockMore: user.plan === 'pro' && (progress.active_recommendations + toUnlock) < progress.total_recommendations,
      nextUnlockDate: user.plan === 'diy' ? nextUnlockDate.toISOString() : null,
      daysUntilNextUnlock: user.plan === 'diy' ? 5 : 0
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

    // If marking as implemented, update user progress
    if (status === 'implemented') {
      await db.query(
        `UPDATE user_progress
         SET completed_recommendations = completed_recommendations + 1
         WHERE user_id = $1 AND scan_id = $2`,
        [userId, scanId]
      );
    }

    res.json({
      success: true,
      message: status === 'implemented'
        ? 'Recommendation marked as implemented! Your progress has been updated.'
        : 'Feedback recorded for learning loop'
    });

  } catch (error) {
    console.error('❌ Feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// ============================================
// POST /api/scan/:id/recommendation/:recId/skip
// Skip a recommendation (available after 5 days)
// ============================================
router.post('/:id/recommendation/:recId/skip', authenticateToken, async (req, res) => {
  try {
    const { id: scanId, recId } = req.params;
    const userId = req.userId;

    // Verify scan belongs to user
    const scanCheck = await db.query(
      'SELECT id FROM scans WHERE id = $1 AND user_id = $2',
      [scanId, userId]
    );

    if (scanCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Get recommendation details
    const recResult = await db.query(
      `SELECT id, unlock_state, skip_enabled_at, skipped_at, status
       FROM scan_recommendations
       WHERE id = $1 AND scan_id = $2`,
      [recId, scanId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    const recommendation = recResult.rows[0];

    // Check if already skipped
    if (recommendation.skipped_at) {
      return res.status(400).json({
        error: 'Already skipped',
        message: 'This recommendation has already been skipped.'
      });
    }

    // Check if recommendation is locked
    if (recommendation.unlock_state === 'locked') {
      return res.status(403).json({
        error: 'Recommendation not yet unlocked',
        message: 'You can only skip unlocked recommendations.'
      });
    }

    // Check if skip is enabled (5 days after unlock)
    const now = new Date();
    const skipEnabledAt = recommendation.skip_enabled_at ? new Date(recommendation.skip_enabled_at) : null;

    if (skipEnabledAt && skipEnabledAt > now) {
      const daysRemaining = Math.ceil((skipEnabledAt - now) / (1000 * 60 * 60 * 24));
      return res.status(403).json({
        error: 'Skip not yet available',
        message: `You can skip this recommendation in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`,
        skipEnabledAt: skipEnabledAt.toISOString(),
        daysRemaining
      });
    }

    // Mark as skipped
    await db.query(
      `UPDATE scan_recommendations
       SET skipped_at = NOW(),
           status = 'skipped'
       WHERE id = $1 AND scan_id = $2`,
      [recId, scanId]
    );

    // Update user progress (skipped counts as completed)
    await db.query(
      `UPDATE user_progress
       SET completed_recommendations = completed_recommendations + 1
       WHERE user_id = $1 AND scan_id = $2`,
      [userId, scanId]
    );

    console.log(`⏭️  User ${userId} skipped recommendation ${recId} for scan ${scanId}`);

    res.json({
      success: true,
      message: 'Recommendation skipped. It will appear in your "Skipped" tab.'
    });

  } catch (error) {
    console.error('❌ Skip recommendation error:', error);
    res.status(500).json({ error: 'Failed to skip recommendation' });
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
/**
 * Lightweight Competitor Scan - Scores Only
 * Skips recommendation generation to save API tokens
 */
async function performCompetitorScan(url) {
  console.log('🔬 Starting lightweight competitor scan for:', url);

  try {
    // Run V5 Rubric Engine for scoring only
    console.log('📊 Running V5 Rubric Engine (scores only)...');
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

    console.log(`✅ Competitor scan complete. Total score: ${totalScore}/100`);
    console.log(`💰 Saved token costs by skipping recommendations`);

    return {
      totalScore,
      categories,
      recommendations: [], // No recommendations for competitor scans
      faq: null, // No FAQ for competitor scans
      upgrade: null,
      industry: v5Results.industry || 'General',
      detailedAnalysis: {
        url,
        scannedAt: new Date().toISOString(),
        rubricVersion: 'V5',
        categoryBreakdown: categories,
        summary: 'Competitor scan - scores only',
        metadata: v5Results.metadata
      }
    };

  } catch (error) {
    console.error('❌ Competitor scan error:', error);
    throw new Error(`Competitor scan failed: ${error.message}`);
  }
}

/**
 * Transform V5 categories structure to flat subfactor scores
 * The new V5 engine returns nested objects and different key names
 * This function flattens and renames to match what the issue detector expects
 */
function transformV5ToSubfactors(v5Categories) {
  const subfactors = {};

  // AI Readability - Scale from 0-2/0-10 to 0-100 and rename keys
  if (v5Categories.aiReadability) {
    const ar = v5Categories.aiReadability;
    subfactors.aiReadability = {
      altTextScore: (ar.altText || 0) * 50,  // 0-2 scale → 0-100
      captionsTranscriptsScore: (ar.transcription || 0) * 10,  // 0-10 scale → 0-100
      interactiveAccessScore: (ar.interactive || 0) * 50,  // 0-2 scale → 0-100
      crossMediaScore: (ar.crossMedia || 0) * 50  // 0-2 scale → 0-100
    };
  }

  // AI Search Readiness - Extract from nested structure and scale
  if (v5Categories.aiSearchReadiness) {
    const asr = v5Categories.aiSearchReadiness;
    const directAnswer = asr.directAnswerStructure || {};
    const topical = asr.topicalAuthority || {};

    subfactors.aiSearchReadiness = {
      questionHeadingsScore: (directAnswer.factors?.questionDensity || 0) * 50,  // 0-2 → 0-100 (hybrid scoring)
      scannabilityScore: (directAnswer.factors?.scannability || 0) * 50,  // 0-2 → 0-100
      readabilityScore: (directAnswer.factors?.readability || 0) * 50,  // 0-2 → 0-100 (factor max is 2.0)
      faqScore: (directAnswer.factors?.icpQA || 0) * 50,  // 0-2 → 0-100 (FIXED: was * 33, now * 50)
      snippetEligibleScore: (directAnswer.factors?.answerCompleteness || 0) * 50,  // 0-2 → 0-100
      pillarPagesScore: (topical.factors?.pillarPages || 0) * 50,  // 0-2 → 0-100 (max is 2.0, not 3.0)
      linkedSubpagesScore: (topical.factors?.semanticLinking || 0) * 50,  // 0-2 → 0-100 (max is 2.0)
      painPointsScore: (topical.factors?.contentDepth || 0) * 50,  // 0-2 → 0-100 (max is 2.0)
      geoContentScore: 50  // Default middle value if not available
    };
  }

  // Content Freshness - Scale from 0-2 to 0-100
  if (v5Categories.contentFreshness) {
    const cf = v5Categories.contentFreshness;
    subfactors.contentFreshness = {
      lastUpdatedScore: (cf.lastModified || 0) * 50,  // 0-2 → 0-100
      versioningScore: (cf.versioning || 0) * 50,  // 0-2 → 0-100
      timeSensitiveScore: (cf.timeSensitive || 0) * 50,  // 0-2 → 0-100
      auditProcessScore: (cf.auditProcess || 0) * 50,  // 0-2 → 0-100
      liveDataScore: (cf.realTimeInfo || 0) * 50,  // 0-2 → 0-100
      httpFreshnessScore: 50,  // Not in new structure, use default
      editorialCalendarScore: 50  // Not in new structure, use default
    };
  }

  // Content Structure - Extract from nested structure and scale
  if (v5Categories.contentStructure) {
    const cs = v5Categories.contentStructure;
    const semantic = cs.semanticHTML || {};
    const entity = cs.entityRecognition || {};

    subfactors.contentStructure = {
      headingHierarchyScore: (semantic.factors?.headingHierarchy || 0) * 33,  // 0-3 → 0-100
      navigationScore: (semantic.factors?.contentSectioning || 0) * 33,  // 0-3 → 0-100
      entityCuesScore: (entity.factors?.namedEntities || 0) * 33,  // 0-3 → 0-100
      accessibilityScore: (semantic.factors?.accessibility || 0) * 33,  // 0-3 → 0-100
      geoMetaScore: (entity.factors?.geoEntities || 0) * 33  // 0-3 → 0-100
    };
  }

  // Speed & UX - Scale from 0-1 to 0-100
  if (v5Categories.speedUX) {
    const su = v5Categories.speedUX;
    subfactors.speedUX = {
      lcpScore: (su.lcp || 0) * 100,  // 0-1 → 0-100
      clsScore: (su.cls || 0) * 100,  // 0-1 → 0-100
      inpScore: (su.inp || 0) * 100,  // 0-1 → 0-100
      mobileScore: (su.mobile || 0) * 100,  // 0-1 → 0-100
      crawlerResponseScore: (su.crawlerResponse || 0) * 100  // 0-1 → 0-100
    };
  }

  // Technical Setup - Extract from nested structure and scale
  if (v5Categories.technicalSetup) {
    const ts = v5Categories.technicalSetup;
    const crawler = ts.crawlerAccess || {};
    const structured = ts.structuredData || {};

    subfactors.technicalSetup = {
      crawlerAccessScore: (crawler.factors?.robotsTxt || 0) * 33,  // 0-3 → 0-100
      structuredDataScore: (structured.factors?.schemaMarkup || 0) * 33,  // 0-3 → 0-100
      canonicalHreflangScore: 50,  // Not in new structure, use default
      openGraphScore: 50,  // Not in new structure, use default
      sitemapScore: (crawler.factors?.serverResponse || 0) * 33,  // 0-3 → 0-100
      indexNowScore: 50,  // Not in new structure, use default
      rssFeedScore: 50  // Not in new structure, use default
    };
  }

  // Trust & Authority - Extract from nested structure and scale
  if (v5Categories.trustAuthority) {
    const ta = v5Categories.trustAuthority;
    const eeat = ta.eeat || {};
    const authority = ta.authorityNetwork || {};

    subfactors.trustAuthority = {
      authorBiosScore: (eeat.factors?.authorProfiles || 0) * 50,  // 0-2 → 0-100
      certificationsScore: (eeat.factors?.credentials || 0) * 50,  // 0-2 → 0-100
      domainAuthorityScore: (authority.factors?.domainAuthority || 0) * 33,  // 0-3 → 0-100
      thoughtLeadershipScore: (authority.factors?.thoughtLeadership || 0) * 33,  // 0-3 → 0-100
      thirdPartyProfilesScore: (authority.factors?.socialAuthority || 0) * 50  // 0-2 → 0-100
    };
  }

  // Voice Optimization - Extract from nested structure and scale
  if (v5Categories.voiceOptimization) {
    const vo = v5Categories.voiceOptimization;
    const conversational = vo.conversationalKeywords || {};
    const voice = vo.voiceSearch || {};

    subfactors.voiceOptimization = {
      longTailScore: (conversational.factors?.longTail || 0) * 83,  // 0-1.2 → 0-100
      localIntentScore: (conversational.factors?.localIntent || 0) * 83,  // 0-1.2 → 0-100
      conversationalTermsScore: (voice.factors?.conversationalFlow || 0) * 83,  // 0-1.2 → 0-100
      snippetFormatScore: (conversational.factors?.snippetOptimization || 0) * 83,  // 0-1.2 → 0-100 (hybrid scoring)
      multiTurnScore: (conversational.factors?.followUpQuestions || 0) * 83  // 0-1.2 → 0-100
    };
  }

  return subfactors;
}

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

    // Transform V5 categories structure to flat subfactor scores for issue detection
    // The V5 engine returns nested structures, but issue detector expects flat key-value pairs
    const subfactorScores = transformV5ToSubfactors(v5Results.categories);
    console.log('[V5Transform] Transformed subfactor scores for issue detection');

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