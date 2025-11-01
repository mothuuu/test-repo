const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// Import analysis engines
const { analyzeCompetitiveGaps } = require('../analyzers/competitive/gap-analyzer');
const { generateCompetitiveRecommendations } = require('../analyzers/competitive/recommendation-engine');
const { generateExecutiveSummary } = require('../analyzers/competitive/executive-summary');
const { calculateBenchmarks } = require('../analyzers/competitive/benchmark-calculator');

// ============================================
// GET /api/competitive-analysis/scans
// Get all scans available for comparison (primary + competitors)
// ============================================
router.get('/scans', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's plan to verify Pro access
    const userResult = await db.query(
      'SELECT plan, primary_domain FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Enforce Pro plan requirement
    if (user.plan !== 'pro') {
      return res.status(403).json({
        error: 'Competitive analysis requires Pro plan',
        upgrade_url: '/checkout'
      });
    }

    // Get all scans (primary + competitors) for this user
    const scansResult = await db.query(`
      SELECT
        id,
        url,
        extracted_domain,
        domain_type,
        total_score,
        ai_readability_score,
        ai_search_readiness_score,
        content_freshness_score,
        content_structure_score,
        speed_ux_score,
        technical_setup_score,
        trust_authority_score,
        voice_optimization_score,
        industry,
        created_at
      FROM scans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // Group scans by type
    const primaryScans = scansResult.rows.filter(s => s.domain_type === 'primary');
    const competitorScans = scansResult.rows.filter(s => s.domain_type === 'competitor');

    res.json({
      primary_scans: primaryScans,
      competitor_scans: competitorScans,
      primary_domain: user.primary_domain,
      total_scans: scansResult.rows.length
    });

  } catch (error) {
    console.error('Error fetching scans:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// ============================================
// POST /api/competitive-analysis/compare
// Create a new competitive comparison report
// ============================================
router.post('/compare', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { primary_scan_id, competitor_scan_ids, comparison_name } = req.body;

    // Validate input
    if (!primary_scan_id || !competitor_scan_ids || !Array.isArray(competitor_scan_ids)) {
      return res.status(400).json({
        error: 'Invalid request. Required: primary_scan_id and competitor_scan_ids (array)'
      });
    }

    // Limit to 3 competitors max
    if (competitor_scan_ids.length > 3) {
      return res.status(400).json({
        error: 'Maximum 3 competitors allowed per comparison'
      });
    }

    // Verify Pro plan
    const userResult = await db.query(
      'SELECT plan, primary_domain FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.plan !== 'pro') {
      return res.status(403).json({
        error: 'Competitive analysis requires Pro plan',
        upgrade_url: '/checkout'
      });
    }

    // Fetch primary scan
    const primaryScanResult = await db.query(`
      SELECT * FROM scans WHERE id = $1 AND user_id = $2
    `, [primary_scan_id, userId]);

    if (primaryScanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Primary scan not found' });
    }

    const primaryScan = primaryScanResult.rows[0];

    // Fetch competitor scans
    const competitorScansResult = await db.query(`
      SELECT * FROM scans
      WHERE id = ANY($1) AND user_id = $2
    `, [competitor_scan_ids, userId]);

    if (competitorScansResult.rows.length !== competitor_scan_ids.length) {
      return res.status(404).json({
        error: 'One or more competitor scans not found'
      });
    }

    const competitorScans = competitorScansResult.rows;

    console.log('🔍 Starting competitive analysis...');
    console.log(`Primary: ${primaryScan.extracted_domain} (Score: ${primaryScan.total_score})`);
    competitorScans.forEach((c, i) => {
      console.log(`Competitor ${i + 1}: ${c.extracted_domain} (Score: ${c.total_score})`);
    });

    // ============================================
    // STEP 1: Gap Analysis
    // ============================================
    console.log('📊 Analyzing competitive gaps...');
    const gapAnalysis = await analyzeCompetitiveGaps(primaryScan, competitorScans);

    // ============================================
    // STEP 2: Competitive Recommendations
    // ============================================
    console.log('💡 Generating competitive recommendations...');
    const competitiveRecs = await generateCompetitiveRecommendations(
      primaryScan,
      competitorScans,
      gapAnalysis
    );

    // ============================================
    // STEP 3: Executive Summary (AI-generated)
    // ============================================
    console.log('📝 Generating executive summary...');
    const executiveSummary = await generateExecutiveSummary(
      primaryScan,
      competitorScans,
      gapAnalysis,
      competitiveRecs
    );

    // ============================================
    // STEP 4: Benchmark Calculation
    // ============================================
    console.log('📈 Calculating benchmarks...');
    const benchmarkData = await calculateBenchmarks(primaryScan, competitorScans);

    // ============================================
    // STEP 5: Calculate Overall Metrics
    // ============================================
    const categoriesLeading = gapAnalysis.categories_ahead.length;
    const categoriesTrailing = gapAnalysis.categories_behind.length;
    const totalScoreGap = gapAnalysis.overall_score_gap;
    const overallRank = gapAnalysis.rank_position;

    // ============================================
    // STEP 6: Save Comparison to Database
    // ============================================
    console.log('💾 Saving comparison report...');

    const competitorDomains = competitorScans.map(c => c.extracted_domain);

    const comparisonResult = await db.query(`
      INSERT INTO competitor_comparisons (
        user_id,
        primary_scan_id,
        competitor_scan_ids,
        comparison_name,
        primary_domain,
        competitor_domains,
        executive_summary,
        gap_analysis,
        competitive_recommendations,
        roadmap,
        benchmark_data,
        overall_rank,
        categories_leading,
        categories_trailing,
        total_score_gap,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      userId,
      primary_scan_id,
      competitor_scan_ids,
      comparison_name || `Comparison ${new Date().toLocaleDateString()}`,
      primaryScan.extracted_domain,
      competitorDomains,
      executiveSummary,
      JSON.stringify(gapAnalysis),
      JSON.stringify(competitiveRecs.recommendations),
      JSON.stringify(competitiveRecs.roadmap),
      JSON.stringify(benchmarkData),
      overallRank,
      categoriesLeading,
      categoriesTrailing,
      totalScoreGap,
      'completed'
    ]);

    const comparison = comparisonResult.rows[0];

    // ============================================
    // STEP 7: Save Competitive Insights
    // ============================================
    console.log('💡 Saving competitive insights...');

    for (const insight of gapAnalysis.insights) {
      await db.query(`
        INSERT INTO competitive_insights (
          comparison_id,
          insight_type,
          category,
          competitor_scan_id,
          competitor_domain,
          title,
          description,
          score_gap,
          impact_score,
          priority,
          estimated_effort,
          quick_win,
          action_items,
          code_examples
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        comparison.id,
        insight.type,
        insight.category,
        insight.competitor_scan_id,
        insight.competitor_domain,
        insight.title,
        insight.description,
        insight.score_gap,
        insight.impact_score,
        insight.priority,
        insight.estimated_effort,
        insight.quick_win || false,
        JSON.stringify(insight.action_items || []),
        JSON.stringify(insight.code_examples || [])
      ]);
    }

    // ============================================
    // STEP 8: Save to Comparison History (for trending)
    // ============================================
    console.log('📊 Saving to comparison history...');

    for (const competitor of competitorScans) {
      await db.query(`
        INSERT INTO comparison_history (
          user_id,
          primary_domain,
          competitor_domain,
          primary_scan_id,
          competitor_scan_id,
          primary_total_score,
          competitor_total_score,
          score_delta,
          category_deltas,
          trend,
          rank_position,
          categories_ahead,
          categories_behind,
          comparison_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        userId,
        primaryScan.extracted_domain,
        competitor.extracted_domain,
        primary_scan_id,
        competitor.id,
        primaryScan.total_score,
        competitor.total_score,
        primaryScan.total_score - competitor.total_score,
        JSON.stringify({
          aiReadability: primaryScan.ai_readability_score - competitor.ai_readability_score,
          aiSearchReadiness: primaryScan.ai_search_readiness_score - competitor.ai_search_readiness_score,
          contentFreshness: primaryScan.content_freshness_score - competitor.content_freshness_score,
          contentStructure: primaryScan.content_structure_score - competitor.content_structure_score,
          speedUX: primaryScan.speed_ux_score - competitor.speed_ux_score,
          technicalSetup: primaryScan.technical_setup_score - competitor.technical_setup_score,
          trustAuthority: primaryScan.trust_authority_score - competitor.trust_authority_score,
          voiceOptimization: primaryScan.voice_optimization_score - competitor.voice_optimization_score
        }),
        'stable', // Will be calculated based on historical data later
        overallRank,
        categoriesLeading,
        categoriesTrailing,
        comparison.id
      ]);
    }

    console.log('✅ Comparison complete!');

    // Return the complete comparison
    res.json({
      comparison_id: comparison.id,
      executive_summary: executiveSummary,
      gap_analysis: gapAnalysis,
      recommendations: competitiveRecs.recommendations,
      roadmap: competitiveRecs.roadmap,
      benchmark_data: benchmarkData,
      overall_rank: overallRank,
      categories_leading: categoriesLeading,
      categories_trailing: categoriesTrailing,
      total_score_gap: totalScoreGap,
      primary_scan: {
        domain: primaryScan.extracted_domain,
        total_score: primaryScan.total_score
      },
      competitor_scans: competitorScans.map(c => ({
        domain: c.extracted_domain,
        total_score: c.total_score
      })),
      created_at: comparison.created_at
    });

  } catch (error) {
    console.error('❌ Error creating comparison:', error);
    res.status(500).json({
      error: 'Failed to create comparison',
      details: error.message
    });
  }
});

// ============================================
// GET /api/competitive-analysis/comparisons
// Get all comparisons for the user
// ============================================
router.get('/comparisons', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const comparisonsResult = await db.query(`
      SELECT
        id,
        comparison_name,
        primary_domain,
        competitor_domains,
        overall_rank,
        categories_leading,
        categories_trailing,
        total_score_gap,
        created_at,
        pdf_url
      FROM competitor_comparisons
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);

    res.json({
      comparisons: comparisonsResult.rows
    });

  } catch (error) {
    console.error('Error fetching comparisons:', error);
    res.status(500).json({ error: 'Failed to fetch comparisons' });
  }
});

// ============================================
// GET /api/competitive-analysis/comparisons/:id
// Get a specific comparison report
// ============================================
router.get('/comparisons/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const comparisonId = req.params.id;

    // Fetch comparison
    const comparisonResult = await db.query(`
      SELECT * FROM competitor_comparisons
      WHERE id = $1 AND user_id = $2
    `, [comparisonId, userId]);

    if (comparisonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comparison not found' });
    }

    const comparison = comparisonResult.rows[0];

    // Fetch associated insights
    const insightsResult = await db.query(`
      SELECT * FROM competitive_insights
      WHERE comparison_id = $1
      ORDER BY priority DESC, impact_score DESC
    `, [comparisonId]);

    // Fetch primary scan details
    const primaryScanResult = await db.query(`
      SELECT
        id, url, extracted_domain, total_score,
        ai_readability_score, ai_search_readiness_score,
        content_freshness_score, content_structure_score,
        speed_ux_score, technical_setup_score,
        trust_authority_score, voice_optimization_score
      FROM scans WHERE id = $1
    `, [comparison.primary_scan_id]);

    // Fetch competitor scan details
    const competitorScansResult = await db.query(`
      SELECT
        id, url, extracted_domain, total_score,
        ai_readability_score, ai_search_readiness_score,
        content_freshness_score, content_structure_score,
        speed_ux_score, technical_setup_score,
        trust_authority_score, voice_optimization_score
      FROM scans WHERE id = ANY($1)
    `, [comparison.competitor_scan_ids]);

    res.json({
      comparison: {
        id: comparison.id,
        comparison_name: comparison.comparison_name,
        executive_summary: comparison.executive_summary,
        gap_analysis: comparison.gap_analysis,
        recommendations: comparison.competitive_recommendations,
        roadmap: comparison.roadmap,
        benchmark_data: comparison.benchmark_data,
        overall_rank: comparison.overall_rank,
        categories_leading: comparison.categories_leading,
        categories_trailing: comparison.categories_trailing,
        total_score_gap: comparison.total_score_gap,
        created_at: comparison.created_at,
        pdf_url: comparison.pdf_url
      },
      primary_scan: primaryScanResult.rows[0],
      competitor_scans: competitorScansResult.rows,
      insights: insightsResult.rows
    });

  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch comparison' });
  }
});

// ============================================
// GET /api/competitive-analysis/history/:domain
// Get historical competitive position for a domain
// ============================================
router.get('/history/:domain', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const competitorDomain = req.params.domain;

    const historyResult = await db.query(`
      SELECT
        primary_domain,
        competitor_domain,
        primary_total_score,
        competitor_total_score,
        score_delta,
        category_deltas,
        trend,
        rank_position,
        measurement_date
      FROM comparison_history
      WHERE user_id = $1 AND competitor_domain = $2
      ORDER BY measurement_date DESC
      LIMIT 12
    `, [userId, competitorDomain]);

    res.json({
      competitor_domain: competitorDomain,
      history: historyResult.rows
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
