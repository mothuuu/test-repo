/**
 * RECOMMENDATION GENERATOR - Main Orchestrator (HYBRID SYSTEM)
 * File: backend/analyzers/recommendation-generator.js
 */

const { detectPageIssues, detectMultiPageIssues } = require('./recommendation-engine/issue-detector');
const { generateRecommendations } = require('./recommendation-engine/rec-generator');
const { generateCustomizedFAQ } = require('./recommendation-engine/faq-customizer');
const { filterByTier, formatForAPI } = require('./recommendation-engine/tier-filter');

async function generateCompleteRecommendations(scanResults, tier = 'free', industry = null) {
  try {
    console.log(`🎯 Generating recommendations for tier: ${tier}`);

    const { v5Scores, scanEvidence, scannedPages } = scanResults;

    // STEP 1: Detect all issues
    console.log('🔍 Step 1: Detecting issues...');
    let allIssues;

    if (tier === 'free') {
      allIssues = detectPageIssues(v5Scores, scanEvidence);
      console.log(`   Found ${allIssues.length} issues on homepage`);
    } else {
      if (scannedPages && Array.isArray(scannedPages) && scannedPages.length > 0) {
        const multiPageResult = detectMultiPageIssues(scannedPages);
        allIssues = multiPageResult.pageBreakdown[0].issues; // Use first page's issues
        console.log(`   Found ${multiPageResult.totalIssues} issues across ${multiPageResult.totalPages} pages`);
      } else {
        allIssues = detectPageIssues(v5Scores, scanEvidence);
        console.log(`   Found ${allIssues.length} issues on homepage (single page mode)`);
      }
    }

    // STEP 2: Generate recommendations (HYBRID: top 5 AI, rest templates)
    console.log('💡 Step 2: Generating recommendations (Hybrid Mode)...');
    const recommendations = await generateRecommendations(
      allIssues,
      scanEvidence,
      tier,
      industry
    );
    console.log(`   Generated ${recommendations.length} total recommendations`);

    // STEP 3: Generate customized FAQ (DIY+ only)
    console.log('❓ Step 3: Generating FAQ...');
    let customizedFAQ = null;
    if (tier !== 'free' && industry) {
      try {
        customizedFAQ = await generateCustomizedFAQ(industry, scanEvidence);
        console.log(`   Generated ${customizedFAQ.faqCount} customized FAQs`);
      } catch (error) {
        console.error('   ⚠️  FAQ generation failed:', error.message);
      }
    } else {
      console.log('   ⏭️  Skipping FAQ (tier: free or no industry)');
    }

    // STEP 4: Filter and format by tier
    console.log('🎚️  Step 4: Applying tier filtering...');
    const filteredResults = filterByTier(recommendations, customizedFAQ, tier, {
      url: scanEvidence.url,
      scannedAt: new Date().toISOString()
    });
    console.log(`   Filtered to ${filteredResults.recommendations.length} recommendations for ${tier} tier`);

    // Return formatted results
    return formatForAPI(filteredResults);

  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    throw error;
  }
}

async function getPageRecommendations(pageScores, pageEvidence, tier = 'free') {
  const scanResults = {
    v5Scores: pageScores,
    scanEvidence: pageEvidence,
    scannedPages: [{ v5Scores: pageScores, evidence: pageEvidence }]
  };

  return generateCompleteRecommendations(scanResults, tier);
}

async function getMultiPageRecommendations(scannedPages, tier = 'diy', industry = null) {
  const scanResults = {
    scannedPages: scannedPages
  };

  return generateCompleteRecommendations(scanResults, tier, industry);
}

module.exports = {
  generateCompleteRecommendations,
  getPageRecommendations,
  getMultiPageRecommendations
};