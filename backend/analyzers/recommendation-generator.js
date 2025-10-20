/**
 * RECOMMENDATION GENERATOR - Main Orchestrator
 * File: backend/analyzers/recommendation-generator.js
 */

const { detectPageIssues, detectMultiPageIssues } = require('./recommendation-engine/issue-detector');
const { generateRecommendations } = require('./recommendation-engine/rec-generator');
const { generateCustomizedFAQ } = require('./recommendation-engine/faq-customizer');   // 
const { filterByTier, formatForAPI } = require('./recommendation-engine/tier-filter');  // 

async function generateCompleteRecommendations(scanResults, tier = 'free', industry = null) {
  try {
    console.log(`🎯 Generating recommendations for tier: ${tier}`);

    const { v5Scores, scanEvidence, scannedPages } = scanResults;

    /// STEP 1: Detect all issues
console.log('🔍 Step 1: Detecting issues...');
let allIssues;

if (tier === 'free') {
  allIssues = detectPageIssues(v5Scores, scanEvidence);
  console.log(`   Found ${allIssues.length} issues on homepage`);
} else {
  // For DIY/Pro, check if we have scannedPages, otherwise use single page
  if (scannedPages && Array.isArray(scannedPages) && scannedPages.length > 0) {
    allIssues = detectMultiPageIssues(scannedPages);
    console.log(`   Found ${allIssues.totalIssues} issues across ${allIssues.totalPages} pages`);
  } else {
    // Fallback: treat as single page scan
    allIssues = detectPageIssues(v5Scores, scanEvidence);
    console.log(`   Found ${allIssues.length} issues on homepage (single page mode)`);
  }
}

    // STEP 2: Generate recommendations from issues
    console.log('💡 Step 2: Generating recommendations...');
    // STEP 2: Generate recommendations from issues
console.log('💡 Step 2: Generating recommendations...');

// Determine which issues to use
let issuesToProcess;
if (tier === 'free') {
  issuesToProcess = allIssues;
} else {
  // For DIY/Pro: check if multi-page or single-page
  if (allIssues.pageBreakdown && allIssues.pageBreakdown.length > 0) {
    issuesToProcess = allIssues.pageBreakdown[0].issues;
  } else {
    issuesToProcess = allIssues; // Single page mode
  }
}

const recommendations = await generateRecommendations(
  issuesToProcess,
  scanEvidence,
  tier,
  industry
);
console.log(`   Generated ${recommendations.length} recommendations`);
    

    // STEP 3: Generate customized FAQ (DIY+ only)
console.log('❓ Step 3: Generating FAQ...');
console.log('   Debug - tier:', tier, 'industry:', industry);
let customizedFAQ = null;
if (tier !== 'free' && industry) {
  console.log('   ✅ Conditions met, generating FAQ...');
  try {
    customizedFAQ = await generateCustomizedFAQ(industry, scanEvidence);
    console.log(`   Generated ${customizedFAQ.faqCount} customized FAQs`);
  } catch (error) {
    console.error('   ❌ FAQ generation failed:', error.message);
    console.error(error.stack);
  }
} else {
  console.log('   ⚠️  Skipping FAQ - tier:', tier, 'industry:', industry);
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