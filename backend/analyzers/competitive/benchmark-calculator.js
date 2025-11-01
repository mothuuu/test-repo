/**
 * Benchmark Calculator
 * Calculate competitive positioning and benchmarks
 */

/**
 * Calculate benchmark data for the comparison
 * @param {Object} primaryScan - Primary domain scan
 * @param {Array} competitorScans - Array of competitor scans
 * @returns {Object} Benchmark data
 */
async function calculateBenchmarks(primaryScan, competitorScans) {
  console.log('📈 Calculating benchmarks...');

  const allScans = [primaryScan, ...competitorScans];

  // Calculate overall statistics
  const overallStats = calculateOverallStats(allScans);

  // Calculate category statistics
  const categoryStats = calculateCategoryStats(allScans);

  // Determine competitive position
  const competitivePosition = determineCompetitivePosition(primaryScan, allScans, overallStats);

  // Calculate percentile rankings
  const percentileRankings = calculatePercentileRankings(primaryScan, allScans);

  // Historical context (placeholder for future implementation)
  const historicalContext = {
    trend: 'stable',
    previous_comparisons: 0,
    note: 'Historical trend data will be available after multiple comparisons over time'
  };

  return {
    overall_stats: overallStats,
    category_stats: categoryStats,
    competitive_position: competitivePosition,
    percentile_rankings: percentileRankings,
    historical_context: historicalContext,
    comparison_set_size: allScans.length,
    generated_at: new Date().toISOString()
  };
}

/**
 * Calculate overall score statistics
 */
function calculateOverallStats(allScans) {
  const scores = allScans.map(s => s.total_score);
  const sortedScores = [...scores].sort((a, b) => b - a);

  return {
    highest_score: sortedScores[0],
    lowest_score: sortedScores[sortedScores.length - 1],
    average_score: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
    median_score: sortedScores[Math.floor(sortedScores.length / 2)],
    score_range: sortedScores[0] - sortedScores[sortedScores.length - 1],
    score_distribution: {
      excellent: scores.filter(s => s >= 800).length,
      good: scores.filter(s => s >= 600 && s < 800).length,
      fair: scores.filter(s => s >= 400 && s < 600).length,
      poor: scores.filter(s => s < 400).length
    }
  };
}

/**
 * Calculate statistics for each category
 */
function calculateCategoryStats(allScans) {
  const categories = {
    ai_readability_score: 'AI Readability',
    ai_search_readiness_score: 'AI Search Readiness',
    content_freshness_score: 'Content Freshness',
    content_structure_score: 'Content Structure',
    speed_ux_score: 'Speed & UX',
    technical_setup_score: 'Technical Setup',
    trust_authority_score: 'Trust & Authority',
    voice_optimization_score: 'Voice Optimization'
  };

  const stats = {};

  for (const [key, name] of Object.entries(categories)) {
    const scores = allScans.map(s => s[key] || 0);
    const sortedScores = [...scores].sort((a, b) => b - a);

    stats[name] = {
      categoryKey: key,
      highest: sortedScores[0],
      lowest: sortedScores[sortedScores.length - 1],
      average: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
      median: sortedScores[Math.floor(sortedScores.length / 2)],
      range: sortedScores[0] - sortedScores[sortedScores.length - 1]
    };
  }

  return stats;
}

/**
 * Determine competitive position with context
 */
function determineCompetitivePosition(primaryScan, allScans, overallStats) {
  const sortedScans = [...allScans].sort((a, b) => b.total_score - a.total_score);
  const position = sortedScans.findIndex(s => s.id === primaryScan.id) + 1;
  const totalCompetitors = allScans.length;

  let positionLabel = '';
  let positionDescription = '';
  let strengths = [];
  let weaknesses = [];

  // Determine position label
  if (position === 1) {
    positionLabel = 'Market Leader';
    positionDescription = `You are currently leading the competitive set with the highest AI Visibility Score of ${primaryScan.total_score}/1000. Your challenge is to maintain this position and continue improving.`;
  } else if (position === 2) {
    positionLabel = 'Strong Challenger';
    const leader = sortedScans[0];
    const gap = leader.total_score - primaryScan.total_score;
    positionDescription = `You are ${gap} points behind the market leader (${leader.extracted_domain}). With focused improvements, you can close this gap and take the lead.`;
  } else if (position <= Math.ceil(totalCompetitors / 2)) {
    positionLabel = 'Above Average';
    const leader = sortedScans[0];
    const gap = leader.total_score - primaryScan.total_score;
    positionDescription = `You rank #${position} out of ${totalCompetitors} competitors. You're above the median but have opportunities to improve and move toward the leadership position.`;
  } else {
    positionLabel = 'Below Average';
    const avgScore = overallStats.average_score;
    const gap = avgScore - primaryScan.total_score;
    positionDescription = `You rank #${position} out of ${totalCompetitors} competitors, below the average score of ${avgScore}. Focus on the high-priority recommendations to quickly improve your position.`;
  }

  // Identify strengths (categories where you're above average)
  const categories = [
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
    ai_readability_score: 'AI Readability',
    ai_search_readiness_score: 'AI Search Readiness',
    content_freshness_score: 'Content Freshness',
    content_structure_score: 'Content Structure',
    speed_ux_score: 'Speed & UX',
    technical_setup_score: 'Technical Setup',
    trust_authority_score: 'Trust & Authority',
    voice_optimization_score: 'Voice Optimization'
  };

  for (const catKey of categories) {
    const yourScore = primaryScan[catKey] || 0;
    const avgScore = allScans.reduce((sum, s) => sum + (s[catKey] || 0), 0) / allScans.length;
    const bestScore = Math.max(...allScans.map(s => s[catKey] || 0));

    if (yourScore >= avgScore + 50) {
      strengths.push({
        category: categoryNames[catKey],
        score: yourScore,
        vs_average: Math.round(yourScore - avgScore)
      });
    } else if (yourScore < avgScore - 50) {
      weaknesses.push({
        category: categoryNames[catKey],
        score: yourScore,
        vs_average: Math.round(avgScore - yourScore)
      });
    }
  }

  return {
    rank: position,
    total_competitors: totalCompetitors,
    position_label: positionLabel,
    description: positionDescription,
    your_score: primaryScan.total_score,
    leader_score: sortedScans[0].total_score,
    average_score: overallStats.average_score,
    gap_to_leader: sortedScans[0].total_score - primaryScan.total_score,
    gap_to_average: overallStats.average_score - primaryScan.total_score,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3)
  };
}

/**
 * Calculate percentile rankings for the primary scan
 */
function calculatePercentileRankings(primaryScan, allScans) {
  const rankings = {};

  // Overall percentile
  const sortedOverall = [...allScans].sort((a, b) => b.total_score - a.total_score);
  const overallRank = sortedOverall.findIndex(s => s.id === primaryScan.id);
  rankings.overall = calculatePercentile(overallRank, allScans.length);

  // Category percentiles
  const categories = {
    ai_readability_score: 'AI Readability',
    ai_search_readiness_score: 'AI Search Readiness',
    content_freshness_score: 'Content Freshness',
    content_structure_score: 'Content Structure',
    speed_ux_score: 'Speed & UX',
    technical_setup_score: 'Technical Setup',
    trust_authority_score: 'Trust & Authority',
    voice_optimization_score: 'Voice Optimization'
  };

  for (const [key, name] of Object.entries(categories)) {
    const sortedCategory = [...allScans].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const categoryRank = sortedCategory.findIndex(s => s.id === primaryScan.id);
    rankings[name] = {
      percentile: calculatePercentile(categoryRank, allScans.length),
      score: primaryScan[key] || 0
    };
  }

  return rankings;
}

/**
 * Calculate percentile (0-100)
 */
function calculatePercentile(rank, total) {
  return Math.round(((total - rank) / total) * 100);
}

module.exports = {
  calculateBenchmarks
};
