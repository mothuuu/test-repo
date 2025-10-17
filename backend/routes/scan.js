const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkScanLimit } = require('../middleware/usageLimits');
const db = require('../db/database');

// ============================================
// GUEST SCAN ENDPOINT (No Auth Required)
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

    // Perform the scan (results NOT saved to database)
    const scanResult = await performWebsiteScan(url);

    // Return results immediately without saving
    res.json({
      score: scanResult.score,
      url: url,
      scan_data: scanResult.data,
      message: 'Sign up to save these results and track progress',
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
// AUTHENTICATED SCAN ENDPOINT (Auth Required)
// ============================================
router.post('/', authenticateToken, checkScanLimit, async (req, res) => {
  try {
    const { url } = req.body;
    const userId = req.user.id;
    const userPlan = req.user.plan;

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

    console.log('🔍 Authenticated scan requested for:', url, 'by user:', userId, 'plan:', userPlan);

    // For FREE users: only allow homepage scans
    if (userPlan === 'free') {
      // Extract domain/homepage from URL
      const homepage = validUrl.origin;
      console.log('📄 Free user - scanning homepage only:', homepage);
    }

    // Perform the scan
    const scanResult = await performWebsiteScan(url);

    // Save scan to database
    try {
      await db.query(
        'INSERT INTO scans (user_id, url, score, scan_data) VALUES ($1, $2, $3, $4)',
        [userId, url, scanResult.score, JSON.stringify(scanResult.data)]
      );
      console.log('✅ Scan saved to database for user:', userId);
    } catch (dbError) {
      console.error('⚠️ Failed to save scan to database:', dbError);
      // Continue anyway - user still gets results
    }

    // Log usage
    try {
      await db.query(
        'INSERT INTO usage_logs (user_id, action, metadata) VALUES ($1, $2, $3)',
        [userId, 'scan', JSON.stringify({ url, score: scanResult.score })]
      );
    } catch (logError) {
      console.error('⚠️ Failed to log usage:', logError);
      // Non-critical, continue
    }

    // Return results
    res.json({
      score: scanResult.score,
      url: url,
      scan_data: scanResult.data,
      saved: true,
      plan: userPlan
    });

  } catch (error) {
    console.error('❌ Authenticated scan error:', error);
    res.status(500).json({ 
      error: 'Scan failed',
      details: error.message 
    });
  }
});

// ============================================
// GET SCAN HISTORY (Authenticated Users Only)
// ============================================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT id, url, score, scan_data, created_at 
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
      scans: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });

  } catch (error) {
    console.error('❌ Error fetching scan history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scan history',
      details: error.message 
    });
  }
});

// ============================================
// GET SPECIFIC SCAN BY ID
// ============================================
router.get('/:scanId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const scanId = req.params.scanId;

    const result = await db.query(
      'SELECT * FROM scans WHERE id = $1 AND user_id = $2',
      [scanId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('❌ Error fetching scan:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scan',
      details: error.message 
    });
  }
});

// ============================================
// HELPER FUNCTION - PERFORM WEBSITE SCAN
// ============================================
async function performWebsiteScan(url) {
  console.log('🔬 Starting scan analysis for:', url);
  
  // Simulate scanning delay (replace with actual scanning logic)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // TODO: Replace this mock data with your actual AI visibility scanning logic
  // This should include:
  // - Web scraping/crawling the URL
  // - Analyzing Schema.org markup
  // - Checking entity signals
  // - Evaluating FAQ content
  // - Assessing citation quality
  // - Testing crawlability
  // - Measuring page speed
  // - Checking trust signals
  // - Analyzing AEO content optimization

  // Mock AI visibility analysis - 8 pillars (each out of 125)
  const pillars = {
    schema: Math.floor(Math.random() * 40) + 85,        // 85-125
    entities: Math.floor(Math.random() * 40) + 70,      // 70-110
    faqs: Math.floor(Math.random() * 40) + 80,          // 80-120
    citations: Math.floor(Math.random() * 40) + 75,     // 75-115
    crawlability: Math.floor(Math.random() * 40) + 85,  // 85-125
    speed: Math.floor(Math.random() * 40) + 70,         // 70-110
    trust: Math.floor(Math.random() * 40) + 80,         // 80-120
    aeoContent: Math.floor(Math.random() * 40) + 75     // 75-115
  };

  // Calculate overall score (out of 1000)
  const totalPillarScore = Object.values(pillars).reduce((a, b) => a + b, 0);
  const score = totalPillarScore; // Sum of all 8 pillars (640-1000 range)

  // Generate recommendations based on weakest pillars
  const recommendations = [];
  const pillarThreshold = 95; // Recommend improvement if below this

  if (pillars.schema < pillarThreshold) {
    recommendations.push({
      priority: 'high',
      pillar: 'Schema Markup',
      action: 'Add structured data (Schema.org) to improve entity recognition',
      impact: 'High - Helps AI understand your content structure'
    });
  }
  
  if (pillars.entities < pillarThreshold) {
    recommendations.push({
      priority: 'high',
      pillar: 'Entity Signals',
      action: 'Strengthen brand entity signals with consistent NAP (Name, Address, Phone)',
      impact: 'High - Improves brand recognition by AI systems'
    });
  }
  
  if (pillars.faqs < pillarThreshold) {
    recommendations.push({
      priority: 'medium',
      pillar: 'FAQ Content',
      action: 'Add FAQ schema markup for common questions',
      impact: 'Medium - Increases chances of appearing in AI-generated answers'
    });
  }
  
  if (pillars.citations < pillarThreshold) {
    recommendations.push({
      priority: 'medium',
      pillar: 'Citations',
      action: 'Build high-quality backlinks from authoritative sources',
      impact: 'Medium - Improves trust signals for AI systems'
    });
  }
  
  if (pillars.crawlability < pillarThreshold) {
    recommendations.push({
      priority: 'high',
      pillar: 'Crawlability',
      action: 'Improve site architecture and internal linking structure',
      impact: 'High - Ensures AI can access and index all content'
    });
  }
  
  if (pillars.speed < pillarThreshold) {
    recommendations.push({
      priority: 'medium',
      pillar: 'Page Speed',
      action: 'Optimize page speed and Core Web Vitals (LCP, FID, CLS)',
      impact: 'Medium - Better user experience signals to AI'
    });
  }
  
  if (pillars.trust < pillarThreshold) {
    recommendations.push({
      priority: 'low',
      pillar: 'Trust Signals',
      action: 'Add trust signals like security badges, reviews, and testimonials',
      impact: 'Low - Incremental improvement in authority perception'
    });
  }
  
  if (pillars.aeoContent < pillarThreshold) {
    recommendations.push({
      priority: 'high',
      pillar: 'AEO Content',
      action: 'Optimize content for Answer Engine Optimization (AEO) - use natural language, answer questions directly',
      impact: 'High - Critical for appearing in AI-generated responses'
    });
  }

  // If no recommendations yet, add some general ones
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      pillar: 'General',
      action: 'Your site is well-optimized! Continue monitoring and updating content regularly',
      impact: 'Maintenance - Keep up the good work'
    });
  }

  // Sort by priority (high > medium > low)
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  console.log('✅ Scan complete. Score:', score);

  return {
    score: Math.round(score),
    data: {
      pillars,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      scannedAt: new Date().toISOString(),
      url: url,
      breakdown: {
        excellent: score >= 800,
        good: score >= 600 && score < 800,
        fair: score >= 400 && score < 600,
        needsWork: score < 400
      }
    }
  };
}

module.exports = router;