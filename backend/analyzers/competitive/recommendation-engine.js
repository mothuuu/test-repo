/**
 * Competitive Recommendations Engine
 * Generates actionable recommendations to beat competitors
 */

/**
 * Generate competitive recommendations based on gap analysis
 * @param {Object} primaryScan - Primary domain scan
 * @param {Array} competitorScans - Array of competitor scans
 * @param {Object} gapAnalysis - Gap analysis results
 * @returns {Object} Recommendations and roadmap
 */
async function generateCompetitiveRecommendations(primaryScan, competitorScans, gapAnalysis) {
  console.log('💡 Generating competitive recommendations...');

  const recommendations = [];
  const quickWins = [];
  const longTermActions = [];

  // Process each gap from the analysis
  for (const gap of gapAnalysis.categories_behind) {
    const category = gap.category;
    const categoryKey = gap.categoryKey;
    const scoreGap = gap.gap;

    // Find which competitor is best in this category
    const bestCompetitor = findBestCompetitorInCategory(competitorScans, categoryKey);

    const recommendation = {
      id: recommendations.length + 1,
      category,
      categoryKey,
      title: `Close ${Math.round(scoreGap)}-point gap in ${category}`,
      competitor_doing_better: bestCompetitor.extracted_domain,
      competitor_score: bestCompetitor[categoryKey],
      your_score: primaryScan[categoryKey],
      gap: Math.round(scoreGap),
      priority: determinePriority(scoreGap),
      estimated_impact: calculateImpactLevel(scoreGap),
      estimated_effort: estimateEffort(categoryKey, scoreGap),
      what_competitor_does_better: describeCompetitorAdvantage(category, categoryKey),
      action_steps: generateActionSteps(categoryKey, scoreGap),
      implementation_details: generateImplementationDetails(categoryKey),
      expected_outcome: `Implementing these changes could improve your ${category} score by ${Math.round(scoreGap * 0.7)}-${Math.round(scoreGap)} points, bringing you closer to ${bestCompetitor.extracted_domain}'s performance.`,
      quick_win: scoreGap < 100 && !['speed_ux_score', 'trust_authority_score'].includes(categoryKey)
    };

    recommendations.push(recommendation);

    // Categorize by effort
    if (recommendation.quick_win) {
      quickWins.push(recommendation);
    } else if (recommendation.estimated_effort === 'high') {
      longTermActions.push(recommendation);
    }
  }

  // Sort recommendations by priority and impact
  recommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const impactOrder = { high: 3, medium: 2, low: 1 };

    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }

    return impactOrder[b.estimated_impact] - impactOrder[a.estimated_impact];
  });

  // Generate actionable roadmap
  const roadmap = generateCompetitiveRoadmap(recommendations, quickWins, longTermActions, gapAnalysis);

  return {
    recommendations,
    quick_wins: quickWins,
    long_term_actions: longTermActions,
    roadmap,
    summary: {
      total_recommendations: recommendations.length,
      quick_wins: quickWins.length,
      high_priority: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical').length
    }
  };
}

/**
 * Find the best competitor in a specific category
 */
function findBestCompetitorInCategory(competitorScans, categoryKey) {
  return competitorScans.reduce((best, competitor) => {
    const competitorScore = competitor[categoryKey] || 0;
    const bestScore = best[categoryKey] || 0;
    return competitorScore > bestScore ? competitor : best;
  }, competitorScans[0]);
}

/**
 * Determine priority based on score gap
 */
function determinePriority(gap) {
  if (gap >= 150) return 'critical';
  if (gap >= 100) return 'high';
  if (gap >= 50) return 'medium';
  return 'low';
}

/**
 * Calculate impact level
 */
function calculateImpactLevel(gap) {
  if (gap >= 100) return 'high';
  if (gap >= 50) return 'medium';
  return 'low';
}

/**
 * Estimate implementation effort
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

/**
 * Describe what the competitor does better
 */
function describeCompetitorAdvantage(category, categoryKey) {
  const descriptions = {
    technical_setup_score: 'They have comprehensive technical SEO implementation with optimized sitemaps, robots.txt configuration, and extensive structured data markup.',
    content_structure_score: 'They use semantic HTML, clear heading hierarchies, and well-organized content sections that make it easy for AI to understand.',
    ai_readability_score: 'They write in clear, concise language with well-defined entities and explicit context that AI systems can easily parse.',
    ai_search_readiness_score: 'They have rich metadata, FAQ schemas, and content optimized specifically for AI search engines.',
    trust_authority_score: 'They display strong trust signals including testimonials, certifications, authoritative author bios, and links to credible sources.',
    speed_ux_score: 'They have faster page load times through image optimization, code minification, and effective use of CDNs.',
    voice_optimization_score: 'They structure content in conversational formats with natural language patterns optimized for voice queries.',
    content_freshness_score: 'They regularly update content with clear publication dates and maintain fresh, current information.'
  };

  return descriptions[categoryKey] || `They have a stronger ${category} implementation.`;
}

/**
 * Generate specific action steps for each category
 */
function generateActionSteps(categoryKey, gap) {
  const steps = {
    technical_setup_score: [
      '1. Audit current sitemap.xml and ensure all important pages are included',
      '2. Configure robots.txt with AI crawler directives (GPTBot, Claude-Web, etc.)',
      '3. Implement comprehensive JSON-LD structured data across key pages',
      '4. Add schema.org markup for Organization, WebSite, and relevant content types',
      '5. Ensure HTTPS is properly configured with valid SSL certificate',
      '6. Test technical implementation using Google Rich Results Test'
    ],
    content_structure_score: [
      '1. Audit heading structure (H1-H6) and ensure logical hierarchy',
      '2. Replace generic divs with semantic HTML5 elements (article, section, nav, aside)',
      '3. Add descriptive ARIA labels for accessibility and context',
      '4. Structure content in clear, logical sections with meaningful subheadings',
      '5. Use lists (ul, ol) for structured information',
      '6. Implement breadcrumb navigation for context'
    ],
    ai_readability_score: [
      '1. Simplify complex sentences and reduce jargon',
      '2. Define key terms and entities explicitly on first mention',
      '3. Add context and background information for clarity',
      '4. Use active voice and clear, direct language',
      '5. Break long paragraphs into shorter, scannable chunks',
      '6. Add summaries or introductions to complex sections'
    ],
    ai_search_readiness_score: [
      '1. Enhance meta descriptions with contextual information (150-160 chars)',
      '2. Implement FAQ schema markup for common questions',
      '3. Add breadcrumb schema for site navigation context',
      '4. Optimize content for featured snippet formats (lists, tables, definitions)',
      '5. Include relevant keywords naturally in headers and first paragraphs',
      '6. Ensure mobile-friendliness and responsive design'
    ],
    trust_authority_score: [
      '1. Add customer testimonials with names and photos',
      '2. Display relevant certifications, awards, and credentials prominently',
      '3. Include detailed author bios with expertise and credentials',
      '4. Link to authoritative external sources to support claims',
      '5. Add case studies or success stories with quantifiable results',
      '6. Display security badges, privacy certifications, or industry memberships',
      '7. Include "About Us" content with company history and mission'
    ],
    speed_ux_score: [
      '1. Optimize all images: compress and convert to WebP format',
      '2. Minify CSS and JavaScript files',
      '3. Implement lazy loading for images and iframes',
      '4. Set up a CDN for static assets',
      '5. Enable browser caching with appropriate cache headers',
      '6. Reduce server response time (aim for <200ms)',
      '7. Eliminate render-blocking resources',
      '8. Test with Google PageSpeed Insights and address issues'
    ],
    voice_optimization_score: [
      '1. Create FAQ sections with natural, conversational questions',
      '2. Optimize for long-tail, question-based queries',
      '3. Use conversational tone that mirrors how people speak',
      '4. Implement speakable schema markup for voice-friendly content',
      '5. Answer the "who, what, when, where, why, how" for key topics',
      '6. Keep answers concise (40-60 words for voice snippets)'
    ],
    content_freshness_score: [
      '1. Add or update publication dates on all content',
      '2. Audit and refresh outdated content (update statistics, examples, links)',
      '3. Add "Last Updated" timestamps with modified schema markup',
      '4. Create a content refresh schedule (quarterly or bi-annually)',
      '5. Remove or update outdated information',
      '6. Add date-sensitive content like "2025 Guide to..." for relevance'
    ]
  };

  return steps[categoryKey] || [
    '1. Analyze competitor implementation in detail',
    '2. Identify specific gaps in current implementation',
    '3. Develop action plan with timeline',
    '4. Implement changes incrementally',
    '5. Test and measure impact'
  ];
}

/**
 * Generate implementation details with code examples
 */
function generateImplementationDetails(categoryKey) {
  const details = {
    technical_setup_score: {
      difficulty: 'Medium',
      timeline: '1-2 weeks',
      resources_needed: ['Developer', 'SEO tools'],
      code_example: `<!-- robots.txt -->
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml

<!-- JSON-LD Organization Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://yourdomain.com",
  "logo": "https://yourdomain.com/logo.png",
  "sameAs": [
    "https://twitter.com/yourcompany",
    "https://linkedin.com/company/yourcompany"
  ]
}
</script>`
    },
    content_structure_score: {
      difficulty: 'Easy',
      timeline: '3-5 days',
      resources_needed: ['Content editor', 'Developer'],
      code_example: `<!-- Before: Generic structure -->
<div class="content">
  <div class="title">About Us</div>
  <div class="text">Content here...</div>
</div>

<!-- After: Semantic HTML5 -->
<article>
  <header>
    <h1>About Us</h1>
  </header>
  <section>
    <h2>Our Mission</h2>
    <p>Content here...</p>
  </section>
  <section>
    <h2>Our Team</h2>
    <p>Content here...</p>
  </section>
</article>`
    },
    ai_readability_score: {
      difficulty: 'Easy',
      timeline: '1 week',
      resources_needed: ['Content writer', 'Editor'],
      code_example: null // Content changes don't require code
    },
    speed_ux_score: {
      difficulty: 'High',
      timeline: '2-4 weeks',
      resources_needed: ['Developer', 'DevOps', 'CDN service'],
      code_example: `<!-- Lazy loading images -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- WebP with fallback -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>

<!-- Preload critical resources -->
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>`
    }
  };

  return details[categoryKey] || {
    difficulty: 'Medium',
    timeline: '1-2 weeks',
    resources_needed: ['Developer', 'Content team']
  };
}

/**
 * Generate a prioritized roadmap to beat competitors
 */
function generateCompetitiveRoadmap(recommendations, quickWins, longTermActions, gapAnalysis) {
  const roadmap = {
    phase_1_quick_wins: {
      title: '🚀 Phase 1: Quick Wins (Week 1-2)',
      description: 'Start here for immediate impact with minimal effort',
      actions: quickWins.slice(0, 3).map(r => ({
        action: r.title,
        category: r.category,
        estimated_time: '2-5 days',
        expected_impact: `+${Math.round(r.gap * 0.5)}-${Math.round(r.gap * 0.7)} points`
      })),
      total_expected_impact: quickWins.slice(0, 3).reduce((sum, r) => sum + r.gap * 0.6, 0)
    },
    phase_2_high_priority: {
      title: '🎯 Phase 2: High Priority Gaps (Week 3-6)',
      description: 'Focus on largest competitive gaps for maximum impact',
      actions: recommendations
        .filter(r => (r.priority === 'critical' || r.priority === 'high') && !r.quick_win)
        .slice(0, 3)
        .map(r => ({
          action: r.title,
          category: r.category,
          estimated_time: r.estimated_effort === 'high' ? '2-4 weeks' : '1-2 weeks',
          expected_impact: `+${Math.round(r.gap * 0.6)}-${Math.round(r.gap * 0.8)} points`
        }))
    },
    phase_3_long_term: {
      title: '📈 Phase 3: Long-term Improvements (Month 2-3)',
      description: 'Sustained efforts for lasting competitive advantage',
      actions: longTermActions.slice(0, 3).map(r => ({
        action: r.title,
        category: r.category,
        estimated_time: '3-6 weeks',
        expected_impact: `+${Math.round(r.gap * 0.7)}-${Math.round(r.gap * 0.9)} points`
      }))
    },
    competitive_goal: {
      title: '🏆 Competitive Goal',
      description: gapAnalysis.rank_position === 1
        ? 'Maintain leadership position across all categories'
        : `Move from #${gapAnalysis.rank_position} to #${Math.max(1, gapAnalysis.rank_position - 1)} by implementing this roadmap`,
      estimated_timeline: '2-3 months',
      success_metrics: [
        `Close gap in ${gapAnalysis.biggest_opportunities[0]?.category || 'key categories'}`,
        `Improve overall score by ${Math.round(Math.abs(gapAnalysis.overall_score_gap) * 0.6)}+ points`,
        `Lead in ${gapAnalysis.categories_ahead.length + 2}+ categories`
      ]
    }
  };

  return roadmap;
}

module.exports = {
  generateCompetitiveRecommendations
};
