/**
 * ICP-Specific Scoring Adjuster
 *
 * Adjusts scoring thresholds and weights based on:
 * - Industry/vertical
 * - Target audience (ICP)
 * - Content type
 *
 * Implements PDF Rubric v3.0 requirement for "ICP-Specific Q&A Coverage"
 */

class ICPScoringAdjuster {
  constructor(industry, contentType = 'general') {
    this.industry = industry.toLowerCase();
    this.contentType = contentType;
    this.adjustments = this.getAdjustments();
  }

  /**
   * Get industry-specific adjustments
   */
  getAdjustments() {
    const adjustments = {
      // Default (no adjustments)
      default: {
        questionHeadingWeight: 1.0,
        technicalDepthWeight: 1.0,
        localOptimizationWeight: 1.0,
        multimediarequirement: 1.0,
        faqRequirement: 1.0
      },

      // Healthcare/Medical
      healthcare: {
        questionHeadingWeight: 1.3, // More Q&A expected
        technicalDepthWeight: 1.2,  // Need detailed medical explanations
        localOptimizationWeight: 1.4, // Local clinics/hospitals crucial
        professionalCredentials: 1.5, // MD, RN, certifications critical
        faqRequirement: 1.3,
        minWordCount: 1000, // Detailed medical content
        requiredEntities: ['certifications', 'credentials', 'licenses']
      },

      // Legal
      legal: {
        questionHeadingWeight: 1.2,
        technicalDepthWeight: 1.3,
        localOptimizationWeight: 1.3,
        professionalCredentials: 1.5, // JD, bar admission
        faqRequirement: 1.2,
        minWordCount: 1200,
        requiredEntities: ['credentials', 'bar association']
      },

      // E-commerce/Retail
      ecommerce: {
        questionHeadingWeight: 1.0,
        technicalDepthWeight: 0.8, // Less depth, more visuals
        localOptimizationWeight: 0.7, // Often not location-based
        multimediaRequirement: 1.4, // Product images crucial
        faqRequirement: 1.3, // Shipping, returns Q&A
        minWordCount: 500,
        requiredSchema: ['Product', 'Offer', 'Review']
      },

      // SaaS/Technology
      saas: {
        questionHeadingWeight: 1.3, // "How does X work?"
        technicalDepthWeight: 1.2,
        localOptimizationWeight: 0.5, // Usually global
        faqRequirement: 1.4, // Lots of product Q&A
        minWordCount: 800,
        requiredSchema: ['SoftwareApplication', 'FAQPage']
      },

      // Restaurant/Food Service
      restaurant: {
        questionHeadingWeight: 0.9,
        technicalDepthWeight: 0.7,
        localOptimizationWeight: 1.8, // Extremely location-dependent
        multimediaRequirement: 1.5, // Food photos essential
        faqRequirement: 1.0,
        minWordCount: 300,
        requiredSchema: ['Restaurant', 'LocalBusiness', 'Menu']
      },

      // Real Estate
      realestate: {
        questionHeadingWeight: 1.1,
        technicalDepthWeight: 0.9,
        localOptimizationWeight: 1.7, // Very location-specific
        multimediaRequirement: 1.4, // Property photos
        faqRequirement: 1.2,
        minWordCount: 600,
        requiredSchema: ['RealEstateAgent', 'Place']
      },

      // Finance/Banking
      finance: {
        questionHeadingWeight: 1.3,
        technicalDepthWeight: 1.3,
        localOptimizationWeight: 1.1,
        professionalCredentials: 1.4, // CPA, CFA
        faqRequirement: 1.2,
        minWordCount: 1000,
        requiredEntities: ['certifications', 'licenses']
      },

      // Education
      education: {
        questionHeadingWeight: 1.4, // Educational content = Q&A
        technicalDepthWeight: 1.3,
        localOptimizationWeight: 1.2,
        faqRequirement: 1.3,
        minWordCount: 900,
        requiredSchema: ['EducationalOrganization', 'Course']
      },

      // News/Media/Blog
      media: {
        questionHeadingWeight: 1.2,
        technicalDepthWeight: 0.9,
        localOptimizationWeight: 0.6,
        contentFreshnessWeight: 1.5, // Crucial for news
        faqRequirement: 0.7, // Less FAQ-heavy
        minWordCount: 700,
        requiredSchema: ['Article', 'NewsArticle', 'BlogPosting']
      },

      // Professional Services (Consulting, Agency)
      services: {
        questionHeadingWeight: 1.3,
        technicalDepthWeight: 1.1,
        localOptimizationWeight: 1.2,
        professionalCredentials: 1.3,
        faqRequirement: 1.2,
        minWordCount: 800,
        requiredSchema: ['ProfessionalService', 'Service']
      }
    };

    return adjustments[this.industry] || adjustments.default;
  }

  /**
   * Adjust question heading score based on industry
   */
  adjustQuestionHeadingScore(baseScore, questionPercent) {
    const weight = this.adjustments.questionHeadingWeight || 1.0;
    return baseScore * weight;
  }

  /**
   * Adjust content depth requirements
   */
  adjustContentDepthScore(wordCount) {
    const minWords = this.adjustments.minWordCount || 600;

    if (wordCount >= minWords * 1.5) return 100;
    if (wordCount >= minWords) return 85;
    if (wordCount >= minWords * 0.7) return 65;
    if (wordCount >= minWords * 0.5) return 40;
    return 20;
  }

  /**
   * Adjust local optimization score based on industry
   */
  adjustLocalOptimizationScore(baseScore) {
    const weight = this.adjustments.localOptimizationWeight || 1.0;
    return Math.min(100, baseScore * weight);
  }

  /**
   * Adjust FAQ requirement score
   */
  adjustFAQScore(faqCount) {
    const weight = this.adjustments.faqRequirement || 1.0;

    // Adjusted thresholds based on industry
    const excellentThreshold = Math.max(5, Math.round(5 / weight));
    const goodThreshold = Math.max(2, Math.round(2 / weight));

    if (faqCount >= excellentThreshold) return 100;
    if (faqCount >= goodThreshold) return 75;
    if (faqCount >= 1) return 50;
    return 25;
  }

  /**
   * Adjust professional credential requirements
   */
  adjustCredentialScore(credentialCount) {
    const weight = this.adjustments.professionalCredentials || 1.0;

    if (weight >= 1.3) {
      // High credential requirement industries (healthcare, legal, finance)
      if (credentialCount >= 3) return 100;
      if (credentialCount >= 2) return 70;
      if (credentialCount >= 1) return 40;
      return 0; // No credentials = serious problem
    } else {
      // Standard credential requirement
      if (credentialCount >= 2) return 100;
      if (credentialCount >= 1) return 70;
      return 40; // Some points even without
    }
  }

  /**
   * Check if required schema types are present
   */
  checkRequiredSchema(structuredData) {
    const requiredTypes = this.adjustments.requiredSchema || [];

    if (requiredTypes.length === 0) return 100; // No specific requirements

    const presentTypes = structuredData.map(sd => sd.type);
    const missingTypes = requiredTypes.filter(type => !presentTypes.includes(type));

    if (missingTypes.length === 0) return 100;
    if (missingTypes.length <= requiredTypes.length / 2) return 70;
    return 40;
  }

  /**
   * Check if required entities are present
   */
  checkRequiredEntities(entities) {
    const requiredTypes = this.adjustments.requiredEntities || [];

    if (requiredTypes.length === 0) return 100;

    const hasCredentials = entities.professionalCredentials && entities.professionalCredentials.length > 0;
    const hasOrganization = entities.organizations && entities.organizations.length > 0;

    if (requiredTypes.includes('certifications') || requiredTypes.includes('credentials')) {
      if (!hasCredentials) return 40;
    }

    return 100;
  }

  /**
   * Get industry-specific recommendations
   */
  getRecommendations(currentState) {
    const recommendations = [];

    // Question headings
    if (this.adjustments.questionHeadingWeight > 1.1) {
      if (currentState.questionPercent < 40) {
        recommendations.push({
          priority: 'high',
          category: 'AI Search Readiness',
          message: `${this.industry} sites need more question-based headings. Aim for 40%+ (currently ${Math.round(currentState.questionPercent)}%)`,
          action: 'Add more "How", "What", "Why" headings based on customer questions'
        });
      }
    }

    // Local optimization
    if (this.adjustments.localOptimizationWeight > 1.3) {
      if (!currentState.hasLocalSchema) {
        recommendations.push({
          priority: 'high',
          category: 'Voice Optimization',
          message: `${this.industry} businesses must optimize for local search`,
          action: 'Add LocalBusiness schema with NAP (Name, Address, Phone) and hours'
        });
      }
    }

    // Professional credentials
    if (this.adjustments.professionalCredentials > 1.3) {
      if (currentState.credentialCount === 0) {
        recommendations.push({
          priority: 'critical',
          category: 'Trust & Authority',
          message: `${this.industry} sites must display professional credentials`,
          action: 'Add certifications, licenses, and professional affiliations prominently'
        });
      }
    }

    // Required schema
    if (this.adjustments.requiredSchema) {
      const missing = this.adjustments.requiredSchema.filter(type =>
        !currentState.schemaTypes.includes(type)
      );

      if (missing.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'Technical Setup',
          message: `Missing recommended schema types for ${this.industry}`,
          action: `Add ${missing.join(', ')} schema markup`
        });
      }
    }

    // Content depth
    if (currentState.avgWordCount < this.adjustments.minWordCount) {
      recommendations.push({
        priority: 'medium',
        category: 'AI Search Readiness',
        message: `${this.industry} content should be at least ${this.adjustments.minWordCount} words`,
        action: `Expand content (currently ${Math.round(currentState.avgWordCount)} words average)`
      });
    }

    return recommendations;
  }

  /**
   * Get industry-specific pain points to detect
   */
  getIndustryPainPoints() {
    const painPoints = {
      healthcare: ['symptoms', 'treatment', 'diagnosis', 'pain', 'medication', 'recovery', 'insurance', 'appointment'],
      legal: ['lawsuit', 'contract', 'legal issue', 'court', 'rights', 'liability', 'settlement', 'attorney'],
      ecommerce: ['shipping', 'returns', 'refund', 'payment', 'delivery', 'warranty', 'sizing', 'availability'],
      saas: ['integration', 'setup', 'configuration', 'pricing', 'support', 'migration', 'downtime', 'security'],
      restaurant: ['reservation', 'menu', 'dietary', 'allergy', 'hours', 'location', 'parking', 'delivery'],
      realestate: ['financing', 'mortgage', 'inspection', 'closing', 'commission', 'market', 'neighborhood'],
      finance: ['interest rate', 'fees', 'loan', 'investment', 'risk', 'return', 'portfolio', 'tax'],
      education: ['enrollment', 'tuition', 'financial aid', 'curriculum', 'accreditation', 'graduation', 'career'],
      services: ['consultation', 'pricing', 'timeline', 'process', 'results', 'guarantee', 'experience'],
      media: ['breaking', 'update', 'analysis', 'opinion', 'fact-check', 'source']
    };

    return painPoints[this.industry] || ['problem', 'solution', 'challenge', 'issue'];
  }
}

module.exports = ICPScoringAdjuster;
