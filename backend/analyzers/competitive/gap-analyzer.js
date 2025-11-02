/**
 * Gap Analyzer - Level 3 Detailed Analysis
 * Identifies where competitors are ahead and by how much
 */

const CATEGORY_NAMES = {
  ai_readability_score: 'AI Readability',
  ai_search_readiness_score: 'AI Search Readiness',
  content_freshness_score: 'Content Freshness',
  content_structure_score: 'Content Structure',
  speed_ux_score: 'Speed & UX',
  technical_setup_score: 'Technical Setup',
  trust_authority_score: 'Trust & Authority',
  voice_optimization_score: 'Voice Optimization'
};

const CATEGORY_KEYS = Object.keys(CATEGORY_NAMES);

/**
 * Analyze competitive gaps between primary scan and competitors
 * @param {Object} primaryScan - Primary domain scan
 * @param {Array} competitorScans - Array of competitor scans
 * @returns {Object} Gap analysis with insights
 */
async function analyzeCompetitiveGaps(primaryScan, competitorScans) {
  console.log('🔍 Analyzing gaps...');

  const insights = [];
  const categoriesAhead = [];
  const categoriesBehind = [];
  const categoryComparisons = [];

  // Calculate overall ranking
  const allScores = [
    { domain: primaryScan.extracted_domain, score: primaryScan.total_score, isPrimary: true },
    ...competitorScans.map(c => ({ domain: c.extracted_domain, score: c.total_score, isPrimary: false }))
  ];
  allScores.sort((a, b) => b.score - a.score);
  const rankPosition = allScores.findIndex(s => s.isPrimary) + 1;

  // Analyze each category against each competitor
  for (const categoryKey of CATEGORY_KEYS) {
    const categoryName = CATEGORY_NAMES[categoryKey];
    const primaryScore = primaryScan[categoryKey] || 0;

    // Find best competitor score in this category
    let bestCompetitor = null;
    let worstCompetitor = null;
    let maxCompetitorScore = -Infinity;
    let minCompetitorScore = Infinity;

    for (const competitor of competitorScans) {
      const competitorScore = competitor[categoryKey] || 0;

      if (competitorScore > maxCompetitorScore) {
        maxCompetitorScore = competitorScore;
        bestCompetitor = competitor;
      }

      if (competitorScore < minCompetitorScore) {
        minCompetitorScore = competitorScore;
        worstCompetitor = competitor;
      }
    }

    const gap = primaryScore - maxCompetitorScore;
    const avgCompetitorScore = competitorScans.reduce((sum, c) => sum + (c[categoryKey] || 0), 0) / competitorScans.length;

    // Determine if ahead or behind
    if (gap >= 0) {
      categoriesAhead.push({
        category: categoryName,
        categoryKey,
        yourScore: primaryScore,
        bestCompetitorScore: maxCompetitorScore,
        gap: gap
      });
    } else {
      categoriesBehind.push({
        category: categoryName,
        categoryKey,
        yourScore: primaryScore,
        bestCompetitorScore: maxCompetitorScore,
        gap: Math.abs(gap)
      });

      // Create detailed insight for categories where we're behind
      const insight = await analyzeSpecificGap(
        primaryScan,
        bestCompetitor,
        categoryKey,
        categoryName,
        Math.abs(gap)
      );

      if (insight) {
        insights.push(insight);
      }
    }

    // Store category comparison data
    categoryComparisons.push({
      category: categoryName,
      categoryKey,
      primaryScore,
      avgCompetitorScore,
      bestCompetitorScore: maxCompetitorScore,
      worstCompetitorScore: minCompetitorScore,
      gap,
      status: gap >= 0 ? 'ahead' : 'behind'
    });
  }

  // Calculate overall score gap
  const avgCompetitorOverallScore = competitorScans.reduce((sum, c) => sum + c.total_score, 0) / competitorScans.length;
  const overallScoreGap = primaryScan.total_score - avgCompetitorOverallScore;

  // Find biggest opportunities (largest gaps)
  const biggestGaps = categoriesBehind
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return {
    rank_position: rankPosition,
    overall_score_gap: Math.round(overallScoreGap),
    categories_ahead: categoriesAhead,
    categories_behind: categoriesBehind,
    category_comparisons: categoryComparisons,
    biggest_opportunities: biggestGaps,
    insights: insights,
    summary: {
      leading_in: categoriesAhead.length,
      trailing_in: categoriesBehind.length,
      competitive_position: rankPosition === 1 ? 'leader' : rankPosition <= competitorScans.length / 2 ? 'strong' : 'behind'
    }
  };
}

/**
 * Analyze specific gap in detail (Level 3 analysis)
 * @param {Object} primaryScan
 * @param {Object} competitorScan
 * @param {String} categoryKey
 * @param {String} categoryName
 * @param {Number} gap
 * @returns {Object} Detailed insight
 */
async function analyzeSpecificGap(primaryScan, competitorScan, categoryKey, categoryName, gap) {
  const insight = {
    type: 'gap',
    category: categoryName,
    categoryKey,
    competitor_scan_id: competitorScan.id,
    competitor_domain: competitorScan.extracted_domain,
    title: `${categoryName}: Behind by ${Math.round(gap)} points`,
    description: '',
    score_gap: Math.round(gap),
    impact_score: calculateImpactScore(gap),
    priority: determinePriority(gap),
    estimated_effort: estimateEffort(categoryKey, gap),
    quick_win: gap < 100 && categoryKey !== 'speed_ux_score', // Speed is harder
    action_items: [],
    code_examples: []
  };

  // Category-specific analysis
  switch (categoryKey) {
    case 'technical_setup_score':
      insight.description = `${competitorScan.extracted_domain} has a stronger technical foundation. They likely have better sitemap optimization, robots.txt configuration, and structured data implementation.`;
      insight.action_items = [
        'Audit and optimize XML sitemap',
        'Configure robots.txt with AI crawler directives',
        'Implement comprehensive JSON-LD structured data',
        'Add schema.org markup for key pages'
      ];
      insight.code_examples = [
        {
          title: 'Robots.txt with AI crawler support',
          code: `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml`
        }
      ];
      break;

    case 'content_structure_score':
      insight.description = `${competitorScan.extracted_domain} has better content organization with semantic HTML, clear heading hierarchy, and well-structured information architecture.`;
      insight.action_items = [
        'Implement proper H1-H6 heading hierarchy',
        'Use semantic HTML5 elements (article, section, aside)',
        'Add ARIA labels for accessibility',
        'Structure content in logical sections'
      ];
      break;

    case 'ai_readability_score':
      insight.description = `${competitorScan.extracted_domain} has more AI-friendly content with clear language, defined entities, and better context.`;
      insight.action_items = [
        'Simplify complex sentences',
        'Define key terms and entities explicitly',
        'Add context and background information',
        'Use clear, descriptive language'
      ];
      break;

    case 'ai_search_readiness_score':
      insight.description = `${competitorScan.extracted_domain} is better optimized for AI search engines with rich metadata and structured content.`;
      insight.action_items = [
        'Enhance meta descriptions with context',
        'Add FAQ schema markup',
        'Implement breadcrumb navigation',
        'Optimize for featured snippets'
      ];
      break;

    case 'trust_authority_score':
      insight.description = `${competitorScan.extracted_domain} demonstrates stronger trust signals through social proof, credentials, and authoritative content.`;
      insight.action_items = [
        'Add customer testimonials and reviews',
        'Display certifications and awards',
        'Include author bios with credentials',
        'Link to authoritative sources'
      ];
      break;

    case 'speed_ux_score':
      insight.description = `${competitorScan.extracted_domain} has faster page load times and better user experience.`;
      insight.action_items = [
        'Optimize and compress images (use WebP format)',
        'Minimize CSS and JavaScript',
        'Implement lazy loading',
        'Use CDN for static assets',
        'Enable browser caching'
      ];
      break;

    case 'voice_optimization_score':
      insight.description = `${competitorScan.extracted_domain} is better optimized for voice search with conversational content and FAQ formats.`;
      insight.action_items = [
        'Create FAQ sections with natural language',
        'Optimize for question-based queries',
        'Use conversational tone',
        'Implement speakable schema markup'
      ];
      break;

    case 'content_freshness_score':
      insight.description = `${competitorScan.extracted_domain} has more recent, up-to-date content with clear publication dates.`;
      insight.action_items = [
        'Add or update publication dates',
        'Refresh outdated content',
        'Add "Last Updated" timestamps',
        'Create regular content updates'
      ];
      break;
  }

  return insight;
}

/**
 * Calculate impact score (1-10) based on gap size
 */
function calculateImpactScore(gap) {
  if (gap >= 200) return 10;
  if (gap >= 150) return 9;
  if (gap >= 100) return 8;
  if (gap >= 75) return 7;
  if (gap >= 50) return 6;
  if (gap >= 30) return 5;
  if (gap >= 20) return 4;
  if (gap >= 10) return 3;
  if (gap >= 5) return 2;
  return 1;
}

/**
 * Determine priority based on gap size
 */
function determinePriority(gap) {
  if (gap >= 150) return 'critical';
  if (gap >= 100) return 'high';
  if (gap >= 50) return 'medium';
  return 'low';
}

/**
 * Estimate effort based on category and gap size
 */
function estimateEffort(categoryKey, gap) {
  const complexCategories = ['speed_ux_score', 'technical_setup_score', 'trust_authority_score'];

  if (complexCategories.includes(categoryKey)) {
    if (gap >= 100) return 'high';
    if (gap >= 50) return 'medium';
    return 'low';
  }

  if (gap >= 150) return 'high';
  if (gap >= 75) return 'medium';
  return 'low';
}

module.exports = {
  analyzeCompetitiveGaps
};
