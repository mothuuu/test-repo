/**
 * Scan Comparison Utility
 * Compares current scan with previous scan for the same domain
 */

/**
 * Calculate comparison data between current and previous scan
 * @param {Object} currentScan - Current scan data with category scores
 * @param {Object} previousScan - Previous scan data with category scores (optional)
 * @returns {Object} Comparison data including score changes and category improvements
 */
function calculateScanComparison(currentScan, previousScan) {
  if (!previousScan) {
    return null; // No previous scan to compare with
  }

  const categoryKeys = [
    'ai_readability_score',
    'ai_search_readiness_score',
    'content_freshness_score',
    'content_structure_score',
    'speed_ux_score',
    'technical_setup_score',
    'trust_authority_score',
    'voice_optimization_score'
  ];

  const categoryNames = {
    'ai_readability_score': 'AI Readability',
    'ai_search_readiness_score': 'AI Search Readiness',
    'content_freshness_score': 'Content Freshness',
    'content_structure_score': 'Content Structure',
    'speed_ux_score': 'Speed & UX',
    'technical_setup_score': 'Technical Setup',
    'trust_authority_score': 'Trust & Authority',
    'voice_optimization_score': 'Voice Optimization'
  };

  // Calculate overall score change
  const currentTotal = currentScan.total_score || 0;
  const previousTotal = previousScan.total_score || 0;
  const scoreChange = currentTotal - previousTotal;

  // Calculate category changes
  const categoryChanges = [];
  const categoriesImproved = [];
  const categoriesDeclined = [];

  categoryKeys.forEach(key => {
    const current = currentScan[key] || 0;
    const previous = previousScan[key] || 0;
    const change = current - previous;

    const categoryData = {
      key: key,
      name: categoryNames[key] || key,
      currentScore: current,
      previousScore: previous,
      change: change,
      changePercent: previous > 0 ? ((change / previous) * 100) : 0
    };

    categoryChanges.push(categoryData);

    // Categorize as improved or declined (threshold: 5 points)
    if (change >= 5) {
      categoriesImproved.push(categoryData);
    } else if (change <= -5) {
      categoriesDeclined.push(categoryData);
    }
  });

  // Sort categories by improvement/decline magnitude
  categoriesImproved.sort((a, b) => b.change - a.change);
  categoriesDeclined.sort((a, b) => a.change - b.change);

  // Calculate time between scans
  const daysBetweenScans = calculateDaysBetween(previousScan.created_at, currentScan.created_at);

  return {
    hasPreviousScan: true,
    previousScanId: previousScan.id,
    previousScanDate: previousScan.created_at,
    daysBetweenScans,
    scoreChange: {
      total: scoreChange,
      previous: previousTotal,
      current: currentTotal,
      changePercent: previousTotal > 0 ? ((scoreChange / previousTotal) * 100) : 0
    },
    categoryChanges,
    categoriesImproved: categoriesImproved.map(c => ({
      name: c.name,
      change: c.change,
      currentScore: c.currentScore,
      previousScore: c.previousScore
    })),
    categoriesDeclined: categoriesDeclined.map(c => ({
      name: c.name,
      change: c.change,
      currentScore: c.currentScore,
      previousScore: c.previousScore
    })),
    summary: {
      improved: categoriesImproved.length,
      declined: categoriesDeclined.length,
      unchanged: 8 - (categoriesImproved.length + categoriesDeclined.length)
    }
  };
}

/**
 * Calculate days between two dates
 */
function calculateDaysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get historical scan data for timeline visualization
 * @param {Array} scans - Array of scan records for the same domain
 * @returns {Object} Timeline data with scores over time
 */
function getHistoricalTimeline(scans) {
  if (!scans || scans.length === 0) {
    return null;
  }

  // Sort scans by date (oldest first)
  const sortedScans = scans.sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  return {
    dataPoints: sortedScans.map(scan => ({
      scanId: scan.id,
      date: scan.created_at,
      totalScore: scan.total_score || 0,
      categories: {
        aiReadability: scan.ai_readability_score || 0,
        aiSearchReadiness: scan.ai_search_readiness_score || 0,
        contentFreshness: scan.content_freshness_score || 0,
        contentStructure: scan.content_structure_score || 0,
        speedUX: scan.speed_ux_score || 0,
        technicalSetup: scan.technical_setup_score || 0,
        trustAuthority: scan.trust_authority_score || 0,
        voiceOptimization: scan.voice_optimization_score || 0
      }
    })),
    totalScans: sortedScans.length,
    dateRange: {
      first: sortedScans[0].created_at,
      last: sortedScans[sortedScans.length - 1].created_at
    }
  };
}

module.exports = {
  calculateScanComparison,
  getHistoricalTimeline,
  calculateDaysBetween
};
