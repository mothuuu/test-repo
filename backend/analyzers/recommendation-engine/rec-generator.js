require('dotenv').config();

/**
 * RECOMMENDATION GENERATOR - Part 2
 * File: backend/analyzers/recommendation-engine/rec-generator.js
 * 
 * Takes detected issues and generates actionable, context-aware recommendations
 * using Claude AI (Anthropic).
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ========================================
// RECOMMENDATION TEMPLATES
// ========================================

/**
 * Template library for each issue type
 * These provide structure for Claude to work with
 */
const RECOMMENDATION_TEMPLATES = {
  // AI Search Readiness
  schemaMarkup: {
    title: "Add Missing Schema Markup",
    impactArea: "AI Search Visibility",
    whyItMatters: "Schema markup helps AI engines understand and categorize your content accurately",
    typicalTimeToFix: "2-4 hours",
    difficulty: "Medium"
  },
  faqStructure: {
    title: "Implement FAQ Schema",
    impactArea: "Featured Snippets & Voice Search",
    whyItMatters: "FAQ schema increases chances of appearing in AI-generated answers and voice results",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy"
  },
  entityRecognition: {
    title: "Improve Entity Recognition",
    impactArea: "Brand & Topic Authority",
    whyItMatters: "Clear entity markup helps AI connect your brand to relevant topics and queries",
    typicalTimeToFix: "3-5 hours",
    difficulty: "Medium"
  },
  
  // AI Readability
  imageAltText: {
    title: "Add Alt Text to Images",
    impactArea: "Multimodal AI Understanding",
    whyItMatters: "Alt text enables AI to understand and reference your visual content",
    typicalTimeToFix: "1-3 hours",
    difficulty: "Easy"
  },
  videoTranscripts: {
    title: "Add Video Transcripts",
    impactArea: "Content Accessibility & AI Indexing",
    whyItMatters: "Transcripts make video content searchable and quotable by AI engines",
    typicalTimeToFix: "2-4 hours per video",
    difficulty: "Medium"
  },
  visualHierarchy: {
    title: "Fix Heading Structure",
    impactArea: "Content Organization",
    whyItMatters: "Proper heading hierarchy helps AI understand content structure and importance",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy"
  },
  
  // Technical Setup
  robotsTxt: {
    title: "Create/Fix robots.txt File",
    impactArea: "AI Crawler Access",
    whyItMatters: "Robots.txt controls which content AI crawlers can access and index",
    typicalTimeToFix: "30 minutes",
    difficulty: "Easy"
  },
  xmlSitemap: {
    title: "Add XML Sitemap",
    impactArea: "Content Discovery",
    whyItMatters: "Sitemaps help AI crawlers discover and prioritize your content",
    typicalTimeToFix: "1 hour",
    difficulty: "Easy"
  },
  httpsImplementation: {
    title: "Implement HTTPS",
    impactArea: "Security & Trust",
    whyItMatters: "HTTPS is required for AI engines to trust and index your content",
    typicalTimeToFix: "2-4 hours",
    difficulty: "Medium"
  },
  
  // Trust & Authority
  authorBios: {
    title: "Add Author Information",
    impactArea: "Content Credibility",
    whyItMatters: "Author credentials help AI assess content expertise and trustworthiness",
    typicalTimeToFix: "2-3 hours",
    difficulty: "Easy"
  },
  contactInformation: {
    title: "Improve Contact Information",
    impactArea: "Business Trust Signals",
    whyItMatters: "Clear contact info increases AI confidence in your business legitimacy",
    typicalTimeToFix: "1 hour",
    difficulty: "Easy"
  },
  
  // Content Structure
  headingHierarchy: {
    title: "Fix Heading Hierarchy",
    impactArea: "Content Structure",
    whyItMatters: "Logical heading structure helps AI parse and summarize your content",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy"
  },
  paragraphLength: {
    title: "Optimize Paragraph Length",
    impactArea: "Readability & Scannability",
    whyItMatters: "Well-sized paragraphs make content easier for AI to extract and quote",
    typicalTimeToFix: "2-3 hours",
    difficulty: "Easy"
  }
};

// ========================================
// MAIN GENERATION FUNCTION
// ========================================

/**
 * Generate recommendations from detected issues
 * @param {Array} issues - Detected issues from issue-detector
 * @param {Object} scanEvidence - Full evidence from the scan
 * @param {string} tier - User's plan tier ('free', 'diy', 'pro')
 * @param {string} industry - User's industry (optional)
 * @returns {Array} - Array of recommendation objects
 */
async function generateRecommendations(issues, scanEvidence, tier = 'free', industry = null) {
  console.log(`   Generating ${issues.length} recommendations for ${tier} tier...`);
  
  const recommendations = [];
  
  // Limit based on tier
  const limit = tier === 'free' ? 5 : (tier === 'diy' ? 15 : 25);
  const issuesToProcess = issues.slice(0, limit);
  
  // Generate each recommendation
  for (const issue of issuesToProcess) {
    try {
      const recommendation = await generateSingleRecommendation(issue, scanEvidence, tier, industry);
      recommendations.push(recommendation);
    } catch (error) {
      console.error(`   ⚠️  Failed to generate recommendation for ${issue.subfactor}:`, error.message);
      // Add a fallback generic recommendation
      recommendations.push(generateFallbackRecommendation(issue));
    }
  }
  
  return recommendations;
}

/**
 * Generate a single recommendation using Claude AI
 * @param {Object} issue - Single detected issue
 * @param {Object} scanEvidence - Scan evidence
 * @param {string} tier - Plan tier
 * @param {string} industry - Industry
 * @returns {Object} - Complete recommendation
 */
async function generateSingleRecommendation(issue, scanEvidence, tier, industry) {
  const template = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility",
    typicalTimeToFix: "Varies",
    difficulty: "Medium"
  };
  
  // Build the prompt for Claude
  const prompt = buildClaudePrompt(issue, scanEvidence, template, tier, industry);
  
  // Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: tier === 'free' ? 500 : 1500,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });
  
  // Parse Claude's response
  const claudeResponse = response.content[0].text;
  
  // Structure the recommendation
  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: template.title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    
    // From Claude
    finding: extractSection(claudeResponse, 'FINDING'),
    impact: extractSection(claudeResponse, 'IMPACT'),
    actionSteps: extractActionSteps(claudeResponse),
    codeSnippet: tier !== 'free' ? extractSection(claudeResponse, 'CODE') : null,
    
    // From template
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    
    // Calculated
    estimatedScoreGain: Math.round(issue.gap * 0.7), // 70% of gap is realistic gain
    
    // Metadata
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: tier !== 'free' ? issue.evidence : null // Only show evidence to paid users
  };
}

/**
 * Build the prompt for Claude
 */
function buildClaudePrompt(issue, scanEvidence, template, tier, industry) {
  const detailLevel = tier === 'free' ? 'brief and general' : 'detailed and specific';
  const includeCode = tier !== 'free';
  
  return `You are an AI Search Optimization expert. Generate a ${detailLevel} recommendation for this website issue.

CONTEXT:
- Website: ${scanEvidence.url}
- Industry: ${industry || 'General'}
- Issue: ${issue.subfactor}
- Current Score: ${issue.currentScore}/100
- Target Score: ${issue.threshold}/100
- Severity: ${issue.severity}

EVIDENCE:
${JSON.stringify(issue.evidence, null, 2)}

TEMPLATE GUIDANCE:
- Title: ${template.title}
- Impact Area: ${template.impactArea}
- Why it matters: ${template.whyItMatters}

INSTRUCTIONS:
Generate a recommendation with these sections:

[FINDING]
What specific problem was detected on this website? (2-3 sentences, use the actual evidence)

[IMPACT]
Why does this matter for AI visibility? What opportunities are being missed? (2-3 sentences)

[ACTION STEPS]
${tier === 'free' ? '3-4 brief action items' : '5-7 detailed step-by-step instructions'}

${includeCode ? `[CODE]
Provide copy-paste ready code snippet customized for this website. Use actual data from the evidence when possible.` : ''}

Be specific to THIS website using the evidence provided. ${tier !== 'free' ? 'Include exact URLs, numbers, and data from the evidence.' : 'Keep it general but actionable.'}`;
}

/**
 * Extract a section from Claude's response
 */
function extractSection(response, sectionName) {
  const regex = new RegExp(`\\[${sectionName}\\]\\s*([\\s\\S]*?)(?=\\[|$)`, 'i');
  const match = response.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract action steps as an array
 */
function extractActionSteps(response) {
  const stepsSection = extractSection(response, 'ACTION STEPS');
  if (!stepsSection) return [];
  
  // Split by line breaks and filter out empty lines
  return stepsSection
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')); // Remove bullets/numbers
}

/**
 * Generate a fallback recommendation if Claude fails
 */
function generateFallbackRecommendation(issue) {
  const template = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility",
    typicalTimeToFix: "Varies",
    difficulty: "Medium"
  };
  
  return {
    id: `rec_${issue.category}_${issue.subfactor}_fallback`,
    title: template.title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    finding: `Your ${issue.subfactor} score is ${issue.currentScore}/100, which is below the recommended threshold of ${issue.threshold}/100.`,
    impact: template.whyItMatters,
    actionSteps: ['Review and improve this area', 'Consult documentation', 'Consider expert help'],
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    estimatedScoreGain: Math.round(issue.gap * 0.7),
    currentScore: issue.currentScore,
    targetScore: issue.threshold
  };
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  generateRecommendations,
  generateSingleRecommendation,
  RECOMMENDATION_TEMPLATES
};