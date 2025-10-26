// Helper functions for hybrid recommendation system
const db = require('../db/database');

// Site-wide recommendation categories (affect whole site)
const SITE_WIDE_CATEGORIES = [
  'indexNowScore',
  'sitemapScore',
  'robotsTxtScore',
  'httpsScore',
  'mobileScore',
  'speedScore',
  'coreWebVitalsScore',
  'organizationSchema',
  'brandSchema'
];

// Site-wide recommendation keywords (in title/text)
const SITE_WIDE_KEYWORDS = [
  'indexnow',
  'sitemap',
  'robots.txt',
  'https',
  'ssl',
  'site-wide',
  'entire site',
  'all pages',
  'organization schema',
  'brand schema'
];

/**
 * Classify recommendation as site-wide or page-specific
 */
function classifyRecommendation(rec) {
  const text = (rec.title || rec.recommendation_text || '').toLowerCase();
  const category = (rec.category || '').toLowerCase();
  
  // Check if category is site-wide
  if (SITE_WIDE_CATEGORIES.some(cat => category.includes(cat.toLowerCase()))) {
    return 'site-wide';
  }
  
  // Check if text contains site-wide keywords
  if (SITE_WIDE_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'site-wide';
  }
  
  // Default to page-specific
  return 'page-specific';
}

/**
 * Save recommendations with hybrid system
 * @param {number} scanId - Scan ID
 * @param {number} userId - User ID
 * @param {string} mainUrl - Main URL scanned
 * @param {array} selectedPages - Array of page URLs with priorities
 * @param {array} recommendations - All recommendations from scan
 * @param {string} userPlan - User's plan (free, diy, pro)
 */
async function saveHybridRecommendations(scanId, userId, mainUrl, selectedPages, recommendations, userPlan) {
  console.log(`💾 Saving hybrid recommendations for scan ${scanId}...`);
  
  // Separate site-wide and page-specific recommendations
  const siteWideRecs = [];
  const pageSpecificRecs = [];
  
  recommendations.forEach(rec => {
    const type = classifyRecommendation(rec);
    if (type === 'site-wide') {
      siteWideRecs.push(rec);
    } else {
      pageSpecificRecs.push(rec);
    }
  });
  
  console.log(`   🌐 ${siteWideRecs.length} site-wide recommendations`);
  console.log(`   📄 ${pageSpecificRecs.length} page-specific recommendations`);
  
  // Limit site-wide to 10-15
  const limitedSiteWide = siteWideRecs.slice(0, 15);
  
  // FIXED: Save ALL page-specific recommendations (no 5-per-page limit for single page)
  const pagesWithRecs = selectedPages || [{ url: mainUrl, priority: 1 }];
  
  // If single page, save ALL page-specific recs
  // If multiple pages, distribute evenly
  const recsPerPage = pagesWithRecs.length === 1 
    ? pageSpecificRecs.length 
    : Math.ceil(pageSpecificRecs.length / pagesWithRecs.length);
  
  console.log(`   📄 Will save ${recsPerPage} recommendations per page (${pagesWithRecs.length} page(s))`);

  // Determine initial active count based on plan
  let initialActive;
  if (userPlan === 'free') {
    initialActive = 3;  // Free: Top 3 recommendations
  } else if (userPlan === 'diy') {
    initialActive = 5;  // DIY: First 5, then progressive unlock
  } else if (userPlan === 'pro') {
    initialActive = 999; // Pro: All recommendations active immediately
  } else {
    initialActive = 0;   // Guest: No recommendations
  }

  console.log(`   🔓 Initial active recommendations for ${userPlan} tier: ${initialActive}`);

  // Save site-wide recommendations
  let siteWideActive = 0;
  let siteWideLocked = 0;

  for (let i = 0; i < limitedSiteWide.length; i++) {
    const rec = limitedSiteWide[i];
    const batchNumber = Math.floor(i / 5) + 1;
    const unlockState = i < initialActive ? 'active' : 'locked';
    const unlockedAt = i < initialActive ? new Date() : null;
    const skipEnabledAt = i < initialActive ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) : null; // 5 days

    if (unlockState === 'active') siteWideActive++;
    if (unlockState === 'locked') siteWideLocked++;
    
    await db.query(
      `INSERT INTO scan_recommendations (
        scan_id, category, recommendation_text, priority,
        estimated_impact, estimated_effort, action_steps, findings, code_snippet,
        unlock_state, batch_number, unlocked_at,
        recommendation_type, page_url, skip_enabled_at, impact_description,
        customized_implementation, ready_to_use_content, implementation_notes, quick_wins, validation_checklist
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        scanId,
        rec.category || 'General',
        rec.title || rec.recommendation_text || rec.recommendation,  // Save short title
        rec.priority,
        rec.estimatedScoreGain || 0,
        rec.difficulty || 'medium',
        rec.actionSteps ? JSON.stringify(rec.actionSteps) : null,
        rec.finding || null,
        rec.codeSnippet || null,
        unlockState,
        batchNumber,
        unlockedAt,
        'site-wide',
        null, // No specific page URL
        skipEnabledAt,
        rec.impact || null,  // Add impact description
        rec.customizedImplementation || null,  // NEW: Customized before/after
        rec.readyToUseContent || null,  // NEW: Ready-to-use content
        rec.implementationNotes ? JSON.stringify(rec.implementationNotes) : null,  // NEW: Implementation notes
        rec.quickWins ? JSON.stringify(rec.quickWins) : null,  // NEW: Quick wins
        rec.validationChecklist ? JSON.stringify(rec.validationChecklist) : null  // NEW: Validation checklist
      ]
    );
  }
  
  console.log(`   ✅ Saved ${siteWideActive} active, ${siteWideLocked} locked site-wide`);
  
  // Save page-specific recommendations
  let pageSpecificTotal = 0;
  
  for (const page of pagesWithRecs) {
    const pageRecs = pageSpecificRecs.slice(
      pageSpecificTotal, 
      pageSpecificTotal + recsPerPage
    );
    
    for (const rec of pageRecs) {
      await db.query(
        `INSERT INTO scan_recommendations (
          scan_id, category, recommendation_text, priority,
          estimated_impact, estimated_effort, action_steps, findings, code_snippet,
          unlock_state, batch_number, unlocked_at,
          recommendation_type, page_url, page_priority, impact_description,
          customized_implementation, ready_to_use_content, implementation_notes, quick_wins, validation_checklist
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          scanId,
          rec.category || 'General',
          rec.title || rec.recommendation_text || rec.recommendation,  // Save short title
          rec.priority,
          rec.estimatedScoreGain || 0,
          rec.difficulty || 'medium',
          rec.actionSteps ? JSON.stringify(rec.actionSteps) : null,
          rec.finding || null,
          rec.codeSnippet || null,
          'locked', // All page-specific start locked
          1,
          null,
          'page-specific',
          page.url,
          page.priority || 1,
          rec.impact || null,  // Add impact description
          rec.customizedImplementation || null,  // NEW: Customized before/after
          rec.readyToUseContent || null,  // NEW: Ready-to-use content
          rec.implementationNotes ? JSON.stringify(rec.implementationNotes) : null,  // NEW: Implementation notes
          rec.quickWins ? JSON.stringify(rec.quickWins) : null,  // NEW: Quick wins
          rec.validationChecklist ? JSON.stringify(rec.validationChecklist) : null  // NEW: Validation checklist
        ]
      );
      pageSpecificTotal++;
    }
    
    // Create page_priorities entry
    await db.query(
      `INSERT INTO page_priorities (
        scan_id, page_url, priority_rank, 
        total_recommendations, completed_recommendations, unlocked
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (scan_id, page_url) DO NOTHING`,
      [scanId, page.url, page.priority || 1, pageRecs.length, 0, false]
    );
  }
  
  console.log(`   ✅ Saved ${pageSpecificTotal} page-specific recommendations`);
  
  // Create user_progress record
  await db.query(
    `INSERT INTO user_progress (
      user_id, scan_id,
      total_recommendations, active_recommendations,
      completed_recommendations, verified_recommendations,
      current_batch, last_unlock_date, unlocks_today,
      site_wide_total, site_wide_completed, site_wide_active,
      page_specific_total, page_specific_completed,
      site_wide_complete
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 1, $8, $9, $10, $11, $12, $13)`,
    [
      userId,
      scanId,
      limitedSiteWide.length + pageSpecificTotal, // Total
      siteWideActive, // Active (first 5 site-wide)
      0, // Completed
      0, // Verified
      1, // Current batch
      limitedSiteWide.length, // Site-wide total
      0, // Site-wide completed
      siteWideActive, // Site-wide active
      pageSpecificTotal, // Page-specific total
      0, // Page-specific completed
      false // Site-wide not complete yet
    ]
  );
  
  console.log(`   ✅ Progress tracking initialized`);
  
  return {
    siteWideTotal: limitedSiteWide.length,
    siteWideActive,
    pageSpecificTotal,
    totalRecommendations: limitedSiteWide.length + pageSpecificTotal
  };
}

module.exports = {
  classifyRecommendation,
  saveHybridRecommendations
};