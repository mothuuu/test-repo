const db = require('../db/database');

/**
 * Elite Recommendation Generator
 *
 * Generates recommendations for users in Elite mode (score >= 850)
 * Focus: Competitive positioning, growth opportunities, advanced optimization
 */

/**
 * Generate elite-focused recommendations
 *
 * @param {number} scanId - Scan ID
 * @param {Object} evidence - Scan evidence
 * @param {Object} categoryScores - Category scores
 * @param {number} totalScore - Total score
 * @returns {Array} Elite recommendations
 */
async function generateEliteRecommendations(scanId, evidence, categoryScores, totalScore) {
  console.log('[Elite] Generating elite mode recommendations...');

  const recommendations = [];

  // 1. Competitive Intelligence (30%)
  const competitiveRecs = generateCompetitiveIntelligence(evidence, categoryScores);
  recommendations.push(...competitiveRecs);

  // 2. Content Opportunities (30%)
  const contentOpportunityRecs = generateContentOpportunities(evidence, categoryScores);
  recommendations.push(...contentOpportunityRecs);

  // 3. Advanced Optimization (20%)
  const advancedOptimizationRecs = generateAdvancedOptimizations(evidence, categoryScores);
  recommendations.push(...advancedOptimizationRecs);

  // 4. Maintenance & Monitoring (20%)
  const maintenanceRecs = generateMaintenanceRecommendations(evidence, categoryScores, totalScore);
  recommendations.push(...maintenanceRecs);

  console.log(`[Elite] Generated ${recommendations.length} elite recommendations`);
  return recommendations;
}

/**
 * Generate competitive intelligence recommendations (30%)
 */
function generateCompetitiveIntelligence(evidence, categoryScores) {
  const recs = [];

  // Recommendation: Set up competitor tracking
  recs.push({
    category: 'Competitive Intelligence',
    recommendation_text: 'Track Your Top 3 Competitors\' AI Visibility',
    priority: 95,
    estimated_impact: 'High',
    estimated_effort: 'Low',
    findings: `Elite Status Unlocked: Competitive Tracking

Now that you've established strong AI visibility fundamentals (score: ${categoryScores.totalScore || 'N/A'}), it's time to monitor your competitive position.

Recommended Action:
• Identify your top 3 competitors in your industry
• Add them to competitive tracking
• Receive alerts when their scores change significantly
• Identify gaps where they're outperforming you

This helps you stay ahead and identify emerging threats before they impact your visibility.`,
    action_steps: JSON.stringify([
      'Navigate to Competitive Tracking section',
      'Add up to 3 competitor URLs',
      'Enable weekly comparison reports',
      'Review competitor score trends monthly'
    ]),
    subfactor: 'competitive_tracking'
  });

  // Recommendation: Monitor citation trends
  if (evidence.technical?.structuredData?.length > 0) {
    recs.push({
      category: 'Competitive Intelligence',
      recommendation_text: 'Monitor How AI Systems Are Citing Your Content',
      priority: 90,
      estimated_impact: 'Medium',
      estimated_effort: 'Low',
      findings: `Track Citation Patterns

With strong structured data in place, AI systems can now cite your content as a source. Monitor:

Current Status:
• Structured data detected: ${evidence.technical.structuredData.length} schema types
• Organization info: ${evidence.technical.hasOrganizationSchema ? '✓ Present' : '✗ Missing'}

Next Level:
• Track when ChatGPT, Perplexity, or other AI systems cite your site
• Identify which content gets cited most frequently
• Discover citation opportunities in trending topics`,
      action_steps: JSON.stringify([
        'Set up citation tracking alerts',
        'Review weekly citation reports',
        'Identify top-cited content',
        'Expand on high-performing topics'
      ]),
      subfactor: 'citation_tracking'
    });
  }

  return recs;
}

/**
 * Generate content opportunity recommendations (30%)
 */
function generateContentOpportunities(evidence, categoryScores) {
  const recs = [];

  const faqCount = evidence.content?.faqs?.length || 0;
  const hasFAQSchema = evidence.technical?.hasFAQSchema || false;

  // Recommendation: Expand FAQ coverage
  if (faqCount >= 5 || hasFAQSchema) {
    recs.push({
      category: 'Content Opportunities',
      recommendation_text: 'Expand FAQ Coverage to Trending AI Queries',
      priority: 88,
      estimated_impact: 'High',
      estimated_effort: 'Medium',
      findings: `Scale Your FAQ Strategy

Current Performance:
• FAQ pairs detected: ${faqCount}
• FAQPage schema: ${hasFAQSchema ? '✓ Implemented' : '✗ Not detected'}

Elite Opportunity:
Your FAQ foundation is strong. Now identify trending questions in your industry that AI systems are being asked but you haven't covered yet.

Recommended Approach:
• Research trending queries in your niche using AI search tools
• Create FAQ content addressing emerging questions
• Target "People Also Ask" queries from Google
• Monitor seasonal question trends`,
      action_steps: JSON.stringify([
        'Research trending questions using ChatGPT, Perplexity',
        'Identify 10-15 new high-value questions',
        'Create comprehensive FAQ answers',
        'Add to existing FAQ page or create topic-specific FAQs',
        'Update FAQPage schema with new entries'
      ]),
      subfactor: 'content_expansion'
    });
  }

  // Recommendation: Topic authority expansion
  const h2Count = evidence.content?.headingStructure?.h2 || 0;
  if (h2Count >= 3) {
    recs.push({
      category: 'Content Opportunities',
      recommendation_text: 'Build Topic Clusters for AI Authority',
      priority: 85,
      estimated_impact: 'High',
      estimated_effort: 'High',
      findings: `Establish Topic Authority

Current Content Structure:
• Main topics covered (H2 headings): ${h2Count}

Elite Strategy:
Create comprehensive topic clusters that establish you as the authoritative source in your niche. AI systems prioritize sites with deep, interconnected content.

Topic Cluster Approach:
1. Identify your core expertise areas (pillar topics)
2. Create pillar pages for each topic
3. Build 5-10 supporting articles per pillar
4. Interlink strategically with contextual anchor text
5. Use consistent terminology AI systems recognize`,
      action_steps: JSON.stringify([
        'Audit current content for topic gaps',
        'Choose 2-3 pillar topics to develop',
        'Create pillar page outlines',
        'Plan 5-10 supporting articles per pillar',
        'Implement internal linking strategy',
        'Track AI visibility by topic cluster'
      ]),
      subfactor: 'topic_authority'
    });
  }

  // Recommendation: Multimedia optimization
  const hasVideos = evidence.media?.videoCount > 0;
  const hasPodcasts = false; // We don't detect this yet, placeholder

  recs.push({
    category: 'Content Opportunities',
    recommendation_text: 'Optimize Multimedia Content for AI Discovery',
    priority: 82,
    estimated_impact: 'Medium',
    estimated_effort: 'Medium',
    findings: `Multimedia AI Optimization

Current Multimedia:
• Videos detected: ${evidence.media?.videoCount || 0}
• Images: ${evidence.media?.imageCount || 0}

Opportunity:
AI systems are increasingly indexing video transcripts, podcast content, and audio. Optimize these assets:

Recommended Actions:
• Add detailed video transcripts (not auto-generated captions)
• Include VideoObject schema markup
• Create text summaries of video/podcast content
• Use descriptive file names and alt text for all media
• Add timestamps to video content for specific topics`,
    action_steps: JSON.stringify([
      'Audit all video/audio content',
      'Create detailed transcripts for each',
      'Implement VideoObject schema',
      'Add timestamps for key topics',
      'Create text-based companion content'
    ]),
    subfactor: 'multimedia_optimization'
  });

  return recs;
}

/**
 * Generate advanced optimization recommendations (20%)
 */
function generateAdvancedOptimizations(evidence, categoryScores) {
  const recs = [];

  // Recommendation: Schema enhancement
  const schemaTypes = evidence.technical?.structuredData?.length || 0;
  if (schemaTypes > 0) {
    recs.push({
      category: 'Advanced Optimization',
      recommendation_text: 'Enhance Schema Markup with Advanced Properties',
      priority: 80,
      estimated_impact: 'Medium',
      estimated_effort: 'Low',
      findings: `Advanced Schema Optimization

Current Schema:
• Schema types detected: ${schemaTypes}
• Organization schema: ${evidence.technical?.hasOrganizationSchema ? 'Present' : 'Missing'}

Enhancement Opportunities:
Add advanced properties to your existing schema:

Organization Schema Enhancements:
• Add "knowsAbout" property (list your expertise areas)
• Add "awards" and "memberOf" properties
• Include "foundingDate" and "founders"
• Add detailed "contactPoint" with multiple departments

Article Schema Enhancements:
• Add "speakable" property for voice search
• Include "backstory" for context
• Add "publisher" with full Organization details`,
      action_steps: JSON.stringify([
        'Audit current schema for completeness',
        'Add "knowsAbout" property to Organization schema',
        'Enhance Article schema with speakable properties',
        'Add awards and credentials',
        'Validate with Google Rich Results Test'
      ]),
      subfactor: 'schema_enhancement'
    });
  }

  // Recommendation: Internal linking optimization
  recs.push({
    category: 'Advanced Optimization',
    recommendation_text: 'Implement Strategic Internal Linking for AI Crawlers',
    priority: 78,
    estimated_impact: 'Medium',
    estimated_effort: 'Medium',
    findings: `Internal Linking for AI Discovery

AI systems use internal links to understand:
• Topic relationships
• Content hierarchy
• Expertise areas
• Information flow

Advanced Internal Linking Strategy:
1. Use descriptive anchor text (not "click here")
2. Link to related concepts contextually
3. Create topic-based link clusters
4. Maintain consistent terminology
5. Link newer content to established authority pages

Target: 3-5 contextual internal links per page to related content.`,
    action_steps: JSON.stringify([
      'Audit current internal linking patterns',
      'Identify orphaned content (no internal links)',
      'Create contextual linking opportunities',
      'Update anchor text to be descriptive',
      'Build topic-based link clusters',
      'Monitor which pages AI systems prioritize'
    ]),
    subfactor: 'internal_linking'
  });

  return recs;
}

/**
 * Generate maintenance & monitoring recommendations (20%)
 */
function generateMaintenanceRecommendations(evidence, categoryScores, totalScore) {
  const recs = [];

  // Recommendation: Regular content freshness
  recs.push({
    category: 'Maintenance & Monitoring',
    recommendation_text: 'Maintain Content Freshness with Regular Updates',
    priority: 75,
    estimated_impact: 'Medium',
    estimated_effort: 'Medium',
    findings: `Content Freshness for AI Systems

Current Score: ${totalScore}/1000

AI systems favor fresh, updated content. Even with a strong score, regular updates signal:
• Active maintenance
• Current information
• Evolving expertise

Maintenance Schedule:
• Update cornerstone content quarterly
• Refresh statistics and examples monthly
• Review FAQ answers for accuracy monthly
• Update schema markup with new achievements
• Add new case studies or examples

Red Flags to Monitor:
• Outdated statistics or data
• Deprecated product references
• Old timestamps in Article schema
• Broken internal or external links`,
    action_steps: JSON.stringify([
      'Create quarterly content review calendar',
      'Identify cornerstone pages for regular updates',
      'Set up monthly FAQ review process',
      'Update schema timestamps when content refreshed',
      'Monitor for broken links monthly'
    ]),
    subfactor: 'content_freshness'
  });

  // Recommendation: Score monitoring
  recs.push({
    category: 'Maintenance & Monitoring',
    recommendation_text: 'Set Up Weekly Score Monitoring & Alerts',
    priority: 72,
    estimated_impact: 'Low',
    estimated_effort: 'Low',
    findings: `Proactive Score Monitoring

You've reached Elite status (${totalScore}/1000). Protect your position by:

Monitoring Strategy:
• Run weekly scans to track score changes
• Set up alerts for drops below 850 (Elite threshold)
• Monitor competitor score movements
• Track category-specific trends

Alert Triggers:
• Total score drops >20 points
• Any category drops >10 points
• Competitor scores within 50 points
• Missing schema detected (previous scan had it)

Early detection prevents score degradation and keeps you in Elite mode.`,
    action_steps: JSON.stringify([
      'Schedule weekly automated scans',
      'Enable score drop alerts (>20 points)',
      'Monitor category trends monthly',
      'Review competitor movements weekly',
      'Investigate and fix issues within 48 hours'
    ]),
    subfactor: 'score_monitoring'
  });

  return recs;
}

/**
 * Prioritize elite recommendations
 *
 * Uses different prioritization than optimization mode:
 * - Competitive threats (highest)
 * - Score degradation risks
 * - Opportunity size
 * - Implementation ease
 */
function prioritizeEliteRecommendations(recommendations) {
  return recommendations.sort((a, b) => {
    // Sort by priority (DESC)
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    // Then by impact
    const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const impactDiff = (impactOrder[b.estimated_impact] || 0) - (impactOrder[a.estimated_impact] || 0);
    if (impactDiff !== 0) return impactDiff;

    // Then by effort (lower effort first)
    const effortOrder = { 'Low': 3, 'Medium': 2, 'High': 1 };
    return (effortOrder[b.estimated_effort] || 0) - (effortOrder[a.estimated_effort] || 0);
  });
}

module.exports = {
  generateEliteRecommendations,
  prioritizeEliteRecommendations
};
