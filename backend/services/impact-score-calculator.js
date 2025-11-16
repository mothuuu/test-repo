/**
 * Impact Score Calculator
 *
 * Calculates priority/impact scores for recommendations based on:
 * 1. Pillar score deficiency (more room for improvement = higher priority)
 * 2. Implementation difficulty (quick wins prioritized)
 * 3. Compounding effect on other pillars
 * 4. Industry-specific relevance
 *
 * Impact Score Range: 0-100
 */

// Pillar weights from V5 Rubric
const PILLAR_WEIGHTS = {
  aiSearchReadiness: 0.20,      // 20%
  contentStructure: 0.15,        // 15%
  voiceOptimization: 0.12,       // 12%
  technicalSetup: 0.18,          // 18%
  trustAuthority: 0.12,          // 12%
  aiReadability: 0.10,           // 10%
  contentFreshness: 0.08,        // 8%
  speedUX: 0.05                  // 5%
};

// Difficulty multipliers (inverse - easier = higher score)
const DIFFICULTY_MULTIPLIERS = {
  quick_win: 1.5,     // 15-30 minutes
  moderate: 1.0,      // 1-3 hours
  complex: 0.6        // 3+ hours or technical expertise needed
};

// Compounding effects - recommendations that impact multiple pillars
const COMPOUNDING_EFFECTS = {
  // Schema markup impacts multiple pillars
  organization_schema: ['aiSearchReadiness', 'trustAuthority', 'voiceOptimization'],
  faq_schema: ['aiSearchReadiness', 'contentStructure', 'voiceOptimization'],
  article_schema: ['aiSearchReadiness', 'contentStructure', 'contentFreshness'],
  howto_schema: ['aiSearchReadiness', 'contentStructure', 'voiceOptimization'],
  local_business_schema: ['aiSearchReadiness', 'trustAuthority'],

  // Content improvements
  add_faqs: ['contentStructure', 'voiceOptimization', 'aiReadability'],
  entity_definitions: ['aiReadability', 'trustAuthority', 'contentStructure'],
  content_freshness: ['contentFreshness', 'trustAuthority'],

  // Technical improvements
  page_speed: ['speedUX', 'technicalSetup'],
  mobile_optimization: ['speedUX', 'technicalSetup', 'voiceOptimization'],
  structured_headings: ['contentStructure', 'aiReadability'],

  // Trust signals
  author_bio: ['trustAuthority', 'aiSearchReadiness'],
  certifications: ['trustAuthority', 'aiSearchReadiness'],
  reviews: ['trustAuthority', 'aiSearchReadiness']
};

// Industry-specific priority boosts
const INDUSTRY_PRIORITIES = {
  saas: {
    high: ['organization_schema', 'product_schema', 'faq_schema', 'software_app_schema'],
    medium: ['pricing_transparency', 'feature_comparison', 'integration_docs']
  },
  agency: {
    high: ['local_business_schema', 'service_schema', 'reviews', 'portfolio'],
    medium: ['case_studies', 'team_bios', 'certifications']
  },
  telecom: {
    high: ['service_schema', 'faq_schema', 'pricing_transparency', 'coverage_info'],
    medium: ['support_docs', 'technical_specs']
  },
  msp_var: {
    high: ['local_business_schema', 'certifications', 'partnerships', 'service_schema'],
    medium: ['case_studies', 'security_compliance', 'support_sla']
  },
  ecommerce: {
    high: ['product_schema', 'review_schema', 'faq_schema', 'breadcrumbs'],
    medium: ['shipping_info', 'return_policy', 'payment_security']
  },
  healthcare: {
    high: ['local_business_schema', 'medical_org_schema', 'provider_bios', 'hipaa_compliance'],
    medium: ['insurance_info', 'patient_reviews', 'facility_info']
  }
};

class ImpactScoreCalculator {
  /**
   * Calculate impact score for a recommendation
   *
   * @param {Object} recommendation - The recommendation object
   * @param {Object} pillarScores - Current pillar scores (0-10 scale)
   * @param {String} industry - User's industry
   * @param {String} currentMode - 'optimization' or 'elite_maintenance'
   * @returns {Number} Impact score (0-100)
   */
  static calculateImpactScore(recommendation, pillarScores, industry = null, currentMode = 'optimization') {
    const scores = {
      deficiency: this.calculateDeficiencyScore(recommendation, pillarScores),
      difficulty: this.calculateDifficultyScore(recommendation),
      compounding: this.calculateCompoundingScore(recommendation, pillarScores),
      industry: this.calculateIndustryScore(recommendation, industry)
    };

    // Different weighting for different modes
    let impactScore;
    if (currentMode === 'elite_maintenance') {
      // Elite mode prioritizes competitive and opportunity-based recommendations
      impactScore = (
        scores.deficiency * 0.25 +
        scores.difficulty * 0.20 +
        scores.compounding * 0.30 +
        scores.industry * 0.25
      );
    } else {
      // Optimization mode prioritizes foundational fixes
      impactScore = (
        scores.deficiency * 0.40 +
        scores.difficulty * 0.30 +
        scores.compounding * 0.20 +
        scores.industry * 0.10
      );
    }

    return Math.round(impactScore * 100) / 100;
  }

  /**
   * Calculate deficiency score - how much room for improvement exists
   */
  static calculateDeficiencyScore(recommendation, pillarScores) {
    const category = recommendation.category || this.detectCategory(recommendation);
    const pillarMapping = this.mapCategoryToPillar(category);

    if (!pillarMapping || !pillarScores[pillarMapping]) {
      return 50; // Default moderate deficiency
    }

    const currentScore = pillarScores[pillarMapping];
    const pillarWeight = PILLAR_WEIGHTS[pillarMapping] || 0.10;

    // More deficiency = higher score
    // Score of 0 = 100 deficiency, Score of 10 = 0 deficiency
    const deficiencyPercentage = ((10 - currentScore) / 10) * 100;

    // Apply pillar weight (more important pillars get higher priority)
    return deficiencyPercentage * (1 + pillarWeight);
  }

  /**
   * Calculate difficulty score (inverse - easier = higher)
   */
  static calculateDifficultyScore(recommendation) {
    const difficulty = recommendation.implementation_difficulty ||
                       recommendation.estimated_effort ||
                       this.detectDifficulty(recommendation);

    const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
    return multiplier * 100;
  }

  /**
   * Calculate compounding effect score
   */
  static calculateCompoundingScore(recommendation, pillarScores) {
    const recType = this.detectRecommendationType(recommendation);
    const affectedPillars = COMPOUNDING_EFFECTS[recType] || [];

    if (affectedPillars.length === 0) {
      return 0;
    }

    // Calculate average deficiency across all affected pillars
    let totalDeficiency = 0;
    affectedPillars.forEach(pillar => {
      if (pillarScores[pillar] !== undefined) {
        totalDeficiency += (10 - pillarScores[pillar]);
      }
    });

    const avgDeficiency = totalDeficiency / affectedPillars.length;

    // More pillars affected = higher multiplier
    const multiplier = 1 + (affectedPillars.length * 0.2);

    return (avgDeficiency / 10) * 100 * multiplier;
  }

  /**
   * Calculate industry relevance score
   */
  static calculateIndustryScore(recommendation, industry) {
    if (!industry || !INDUSTRY_PRIORITIES[industry.toLowerCase()]) {
      return 50; // Default moderate relevance
    }

    const recType = this.detectRecommendationType(recommendation);
    const priorities = INDUSTRY_PRIORITIES[industry.toLowerCase()];

    if (priorities.high.includes(recType)) {
      return 100;
    } else if (priorities.medium.includes(recType)) {
      return 75;
    }

    return 50; // Still relevant, just not industry-specific
  }

  /**
   * Detect recommendation type from content
   */
  static detectRecommendationType(recommendation) {
    const text = (
      (recommendation.title || '') +
      ' ' +
      (recommendation.recommendation_text || '') +
      ' ' +
      (recommendation.category || '')
    ).toLowerCase();

    // Schema types
    if (text.includes('organization schema')) return 'organization_schema';
    if (text.includes('faq schema') || text.includes('faqpage')) return 'faq_schema';
    if (text.includes('article schema')) return 'article_schema';
    if (text.includes('howto schema') || text.includes('how-to')) return 'howto_schema';
    if (text.includes('local business') || text.includes('localbusiness')) return 'local_business_schema';
    if (text.includes('product schema')) return 'product_schema';
    if (text.includes('service schema')) return 'service_schema';
    if (text.includes('review schema') || text.includes('aggregaterating')) return 'reviews';

    // Content types
    if (text.includes('add faq') || text.includes('create faq')) return 'add_faqs';
    if (text.includes('entity') && text.includes('definition')) return 'entity_definitions';
    if (text.includes('content') && (text.includes('update') || text.includes('fresh'))) return 'content_freshness';
    if (text.includes('heading') || text.includes('h1') || text.includes('h2')) return 'structured_headings';

    // Technical
    if (text.includes('speed') || text.includes('performance')) return 'page_speed';
    if (text.includes('mobile')) return 'mobile_optimization';

    // Trust
    if (text.includes('author')) return 'author_bio';
    if (text.includes('certification') || text.includes('credential')) return 'certifications';
    if (text.includes('portfolio') || text.includes('case stud')) return 'case_studies';

    return 'general';
  }

  /**
   * Map recommendation category to pillar
   */
  static mapCategoryToPillar(category) {
    const categoryMap = {
      'Schema Markup': 'aiSearchReadiness',
      'FAQ Content': 'contentStructure',
      'Voice Optimization': 'voiceOptimization',
      'Technical SEO': 'technicalSetup',
      'Trust Signals': 'trustAuthority',
      'Content Quality': 'aiReadability',
      'Content Updates': 'contentFreshness',
      'Performance': 'speedUX',
      'Entity Definitions': 'aiReadability',
      'Structured Data': 'aiSearchReadiness'
    };

    return categoryMap[category] || 'aiSearchReadiness';
  }

  /**
   * Detect difficulty from recommendation content
   */
  static detectDifficulty(recommendation) {
    const text = (
      (recommendation.title || '') +
      ' ' +
      (recommendation.recommendation_text || '')
    ).toLowerCase();

    // Quick wins
    const quickWinKeywords = [
      'add', 'include', 'update text', 'insert', 'copy',
      'simple', 'easy', 'quick', 'basic'
    ];

    // Complex tasks
    const complexKeywords = [
      'restructure', 'rebuild', 'implement custom', 'develop',
      'technical', 'advanced', 'complex', 'requires developer'
    ];

    if (complexKeywords.some(kw => text.includes(kw))) {
      return 'complex';
    }

    if (quickWinKeywords.some(kw => text.includes(kw))) {
      return 'quick_win';
    }

    return 'moderate';
  }

  /**
   * Detect category from recommendation content
   */
  static detectCategory(recommendation) {
    const text = (
      (recommendation.title || '') +
      ' ' +
      (recommendation.recommendation_text || '')
    ).toLowerCase();

    if (text.includes('schema') || text.includes('markup')) return 'Schema Markup';
    if (text.includes('faq')) return 'FAQ Content';
    if (text.includes('voice')) return 'Voice Optimization';
    if (text.includes('speed') || text.includes('performance')) return 'Performance';
    if (text.includes('entity')) return 'Entity Definitions';
    if (text.includes('trust') || text.includes('author') || text.includes('credential')) return 'Trust Signals';
    if (text.includes('fresh') || text.includes('update')) return 'Content Updates';
    if (text.includes('content')) return 'Content Quality';
    if (text.includes('technical') || text.includes('crawl')) return 'Technical SEO';

    return 'Structured Data';
  }

  /**
   * Batch calculate impact scores for multiple recommendations
   */
  static calculateBatchImpactScores(recommendations, pillarScores, industry = null, currentMode = 'optimization') {
    return recommendations.map(rec => ({
      ...rec,
      impact_score: this.calculateImpactScore(rec, pillarScores, industry, currentMode),
      implementation_difficulty: rec.implementation_difficulty || this.detectDifficulty(rec),
      compounding_effect_score: this.calculateCompoundingScore(rec, pillarScores),
      industry_relevance_score: this.calculateIndustryScore(rec, industry)
    }));
  }

  /**
   * Sort recommendations by impact score
   */
  static sortByImpact(recommendations) {
    return [...recommendations].sort((a, b) => {
      // Primary sort: impact score (descending)
      if (b.impact_score !== a.impact_score) {
        return b.impact_score - a.impact_score;
      }

      // Secondary sort: difficulty (easier first)
      const difficultyOrder = { quick_win: 0, moderate: 1, complex: 2 };
      const aDiff = difficultyOrder[a.implementation_difficulty] || 1;
      const bDiff = difficultyOrder[b.implementation_difficulty] || 1;

      return aDiff - bDiff;
    });
  }

  /**
   * Get top N recommendations by impact
   */
  static getTopRecommendations(recommendations, n = 5) {
    const sorted = this.sortByImpact(recommendations);
    return sorted.slice(0, n);
  }
}

module.exports = ImpactScoreCalculator;
