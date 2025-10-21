/**
 * TIER FILTER - Part 4 (Final)
 * File: backend/analyzers/recommendation-engine/tier-filter.js
 * 
 * Formats recommendation output based on user's plan tier.
 * Controls what information each tier can access.
 */

// ========================================
// TIER LIMITS
// ========================================

const TIER_LIMITS = {
  free: {
    maxRecommendations: 5,
    showCodeSnippets: false,
    showEvidence: false,
    showFAQ: false,
    showPDF: false,
    detailLevel: 'basic'
  },
  diy: {
    maxRecommendations: 40,
    showCodeSnippets: true,
    showEvidence: true,
    showFAQ: true,
    showPDF: true,
    detailLevel: 'detailed'
  },
  pro: {
    maxRecommendations: 300,
    showCodeSnippets: true,
    showEvidence: true,
    showFAQ: true,
    showPDF: true,
    detailLevel: 'comprehensive'
  }
};

// ========================================
// MAIN FILTER FUNCTION
// ========================================

function filterByTier(recommendations, customizedFAQ, tier = 'free', metadata = {}) {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  
  // Ensure recommendations is an array
  const recs = Array.isArray(recommendations) ? recommendations : [];
  
  // Sort by priority score (highest first)
  const sortedRecs = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Limit number of recommendations
  const limitedRecs = sortedRecs.slice(0, limits.maxRecommendations);
  
  // Filter each recommendation based on tier
  const filteredRecs = limitedRecs.map(rec => filterRecommendation(rec, limits));
  
  // Build tier-specific response
  return {
    tier: tier,
    limits: {
      recommendationsShown: filteredRecs.length,
      recommendationsAvailable: recs.length,
      hasMoreRecommendations: recs.length > limits.maxRecommendations
    },
    recommendations: filteredRecs,
    faq: filterFAQ(customizedFAQ, limits),
    upgrade: getUpgradeCTA(tier, recs.length, customizedFAQ),
    features: getTierFeatures(tier),
    metadata: metadata
  };
}

function filterRecommendation(rec, limits) {
  const filtered = {
    id: rec.id,
    title: rec.title,
    category: rec.category,
    priority: rec.priority,
    finding: rec.finding,
    impact: rec.impact,
    actionSteps: rec.actionSteps,
    estimatedTime: rec.estimatedTime,
    difficulty: rec.difficulty,
    estimatedScoreGain: rec.estimatedScoreGain,
    currentScore: rec.currentScore,
    targetScore: rec.targetScore
  };
  
  // Add code snippets for paid tiers only
  if (limits.showCodeSnippets && rec.codeSnippet) {
    filtered.codeSnippet = rec.codeSnippet;
  } else if (!limits.showCodeSnippets && rec.codeSnippet) {
    filtered.codeSnippetAvailable = true;
    filtered.upgradeMessage = 'Upgrade to DIY for copy-paste code';
  }
  
  // Add evidence for paid tiers only
  if (limits.showEvidence && rec.evidence) {
    filtered.evidence = rec.evidence;
  }
  
  filtered.detailLevel = limits.detailLevel;
  
  return filtered;
}

function filterFAQ(faq, limits) {
  if (!faq) return null;
  
  if (!limits.showFAQ) {
    return {
      available: true,
      message: 'Customized FAQ schema available with DIY plan',
      preview: faq.faqs?.[0]?.question || null
    };
  }
  
  return faq;
}

function getUpgradeCTA(tier, totalRecommendations, faq) {
  if (tier === 'free') {
    return {
      show: true,
      title: 'Unlock Full AI Visibility Analysis',
      message: `You're seeing ${TIER_LIMITS.free.maxRecommendations} of ${totalRecommendations} recommendations. Upgrade to DIY for complete analysis.`,
      benefits: [
        'All recommendations with detailed action steps',
        'Copy-paste ready code snippets',
        'Industry-specific FAQ schema',
        'PDF export',
        'Track 5 pages with unlimited scans'
      ],
      cta: 'Upgrade to DIY - $29/month',
      ctaUrl: '/checkout?plan=diy'
    };
  }
  
  if (tier === 'diy') {
    return {
      show: true,
      title: 'Coming Soon: Premium Features',
      message: 'Be first to access advanced features when they launch.',
      benefits: [
        'Track 25 pages (vs 5)',
        'Website Visibility Index',
        'Brand Visibility Index',
        'Advanced competitor analysis',
        'Priority support'
      ],
      cta: 'Join Premium Waitlist - $99/month',
      ctaUrl: '/waitlist?plan=premium',
      comingSoon: true
    };
  }
  
  return null;
}

function getTierFeatures(tier) {
  const features = {
    free: {
      scansPerMonth: 2,
      pagesPerScan: 1,
      recommendationsShown: 5,
      codeSnippets: false,
      faqSchema: false,
      pdfExport: false,
      tracking: false
    },
    diy: {
      scansPerMonth: 'Unlimited',
      pagesPerScan: 5,
      recommendationsShown: 15,
      codeSnippets: true,
      faqSchema: true,
      pdfExport: true,
      tracking: true
    },
    pro: {
      scansPerMonth: 'Unlimited',
      pagesPerScan: 25,
      recommendationsShown: 25,
      codeSnippets: true,
      faqSchema: true,
      pdfExport: true,
      tracking: true,
      dualIndexes: true,
      competitorAnalysis: true
    }
  };
  
  return features[tier] || features.free;
}

// ========================================
// SUMMARY GENERATION
// ========================================

function generateSummary(recommendations, faq, tier) {
  const recs = Array.isArray(recommendations) ? recommendations : [];
  const critical = recs.filter(r => r.priority === 'critical' || r.priority === 'high');
  const totalScoreGain = recs.reduce((sum, r) => sum + (r.estimatedScoreGain || 0), 0);
  
  return {
    overallStatus: getOverallStatus(recs),
    criticalIssues: critical.length,
    totalRecommendations: recs.length,
    potentialScoreGain: Math.round(totalScoreGain),
    topPriorities: critical.slice(0, 3).map(r => r.title),
    estimatedTimeToImplement: calculateTotalTime(recs),
    hasFAQ: !!faq,
    tier: tier
  };
}

function getOverallStatus(recommendations) {
  const recs = Array.isArray(recommendations) ? recommendations : [];
  const critical = recs.filter(r => r.priority === 'critical').length;
  const high = recs.filter(r => r.priority === 'high').length;
  
  if (critical > 3) return 'needs_immediate_attention';
  if (critical > 0 || high > 5) return 'needs_improvement';
  if (high > 0) return 'good_with_opportunities';
  return 'excellent';
}

function calculateTotalTime(recommendations) {
  const recs = Array.isArray(recommendations) ? recommendations : [];
  let totalHours = 0;
  
  for (const rec of recs) {
    if (rec.estimatedTime) {
      const match = rec.estimatedTime.match(/(\d+)(?:-(\d+))?\s*hour/i);
      if (match) {
        const min = parseInt(match[1]);
        const max = match[2] ? parseInt(match[2]) : min;
        totalHours += (min + max) / 2;
      }
    }
  }
  
  if (totalHours < 8) return `${Math.round(totalHours)} hours`;
  if (totalHours < 40) return `${Math.round(totalHours / 8)} days`;
  return `${Math.round(totalHours / 40)} weeks`;
}

// ========================================
// FORMATTING HELPERS
// ========================================

function formatForAPI(filteredResults) {
  return {
    success: true,
    tier: filteredResults.tier,
    summary: generateSummary(
      filteredResults.recommendations,
      filteredResults.faq,
      filteredResults.tier
    ),
    data: filteredResults,
    timestamp: new Date().toISOString()
  };
}

function formatForPDF(filteredResults) {
  if (!TIER_LIMITS[filteredResults.tier].showPDF) {
    return null;
  }
  
  return {
    title: 'AI Visibility Score Report',
    tier: filteredResults.tier,
    summary: generateSummary(
      filteredResults.recommendations,
      filteredResults.faq,
      filteredResults.tier
    ),
    recommendations: filteredResults.recommendations,
    faq: filteredResults.faq,
    metadata: filteredResults.metadata,
    generatedAt: new Date().toISOString()
  };
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  filterByTier,
  generateSummary,
  formatForAPI,
  formatForPDF,
  TIER_LIMITS
};