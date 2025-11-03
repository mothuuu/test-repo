#!/usr/bin/env node

/**
 * Test Script for Enhanced V5 Rubric Engine
 *
 * Tests:
 * - Multi-page site crawling
 * - Site-wide metric aggregation
 * - Precise PDF scoring thresholds
 * - Enhanced entity analysis
 * - ICP-specific adjustments
 */

const V5EnhancedRubricEngine = require('./analyzers/v5-enhanced-rubric-engine');

async function testEnhancedRubric() {
  console.log('='.repeat(80));
  console.log('TESTING ENHANCED V5 RUBRIC ENGINE');
  console.log('='.repeat(80));
  console.log('');

  // Test URL - use a well-structured site
  const testUrl = process.argv[2] || 'https://www.mozilla.org';

  console.log(`Test URL: ${testUrl}`);
  console.log('');

  try {
    // Create engine instance
    const engine = new V5EnhancedRubricEngine(testUrl, {
      maxPages: 10, // Crawl 10 pages for testing
      timeout: 15000
    });

    console.log('[TEST] Starting enhanced analysis...');
    console.log('');

    const startTime = Date.now();

    // Run analysis
    const results = await engine.analyze();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80));
    console.log('');

    // Overall score
    console.log(`Total Score: ${results.totalScore}/100 (Grade: ${results.grade})`);
    console.log(`Pages Analyzed: ${results.pageCount}`);
    console.log(`Analysis Duration: ${duration}s`);
    console.log('');

    // Category scores
    console.log('Category Scores:');
    console.log('-'.repeat(80));

    const categories = [
      { name: 'AI Search Readiness', key: 'aiSearchReadiness' },
      { name: 'Content Structure', key: 'contentStructure' },
      { name: 'Voice Optimization', key: 'voiceOptimization' },
      { name: 'Technical Setup', key: 'technicalSetup' },
      { name: 'Trust & Authority', key: 'trustAuthority' },
      { name: 'AI Readability', key: 'aiReadability' },
      { name: 'Content Freshness', key: 'contentFreshness' },
      { name: 'Speed & UX', key: 'speedUX' }
    ];

    for (const cat of categories) {
      const score = results.categories[cat.key].score;
      const weight = Math.round(results.categories[cat.key].weight * 100);
      const weighted = Math.round(score * results.categories[cat.key].weight);
      const bar = '█'.repeat(Math.round(score / 5)) + '░'.repeat(20 - Math.round(score / 5));

      console.log(`${cat.name.padEnd(25)} ${bar} ${score}/100 (${weight}%) → ${weighted} points`);
    }

    console.log('');
    console.log('Site-Wide Metrics:');
    console.log('-'.repeat(80));

    const metrics = results.siteMetrics;

    console.log(`Question Headings:     ${Math.round(metrics.pagesWithQuestionHeadings * 100)}% of pages`);
    console.log(`FAQ Schema:            ${Math.round(metrics.pagesWithFAQSchema * 100)}% of pages`);
    console.log(`Good Alt Text:         ${Math.round(metrics.pagesWithGoodAltText * 100)}% of pages`);
    console.log(`Schema Markup:         ${Math.round(metrics.pagesWithSchema * 100)}% of pages`);
    console.log(`Proper H1:             ${Math.round(metrics.pagesWithProperH1 * 100)}% of pages`);
    console.log(`Last Modified Date:    ${Math.round(metrics.pagesWithLastModified * 100)}% of pages`);
    console.log(`Current Year Content:  ${Math.round(metrics.pagesWithCurrentYear * 100)}% of pages`);
    console.log(``);
    console.log(`Avg Word Count:        ${Math.round(metrics.avgWordCount)} words`);
    console.log(`Avg Flesch Score:      ${Math.round(metrics.avgFleschScore)}`);
    console.log(`Avg Sentence Length:   ${Math.round(metrics.avgSentenceLength)} words`);
    console.log(`Avg Entities/Page:     ${Math.round(metrics.avgEntitiesPerPage)}`);
    console.log(`Pillar Pages:          ${metrics.pillarPageCount}`);
    console.log(`Topic Cluster Coverage: ${Math.round(metrics.topicClusterCoverage * 100)}%`);

    console.log('');
    console.log('Detailed Category Breakdown:');
    console.log('-'.repeat(80));

    // Show AI Search Readiness details
    const aiSearch = results.categories.aiSearchReadiness;
    console.log('\nAI Search Readiness (20%):');
    console.log(`  Direct Answer Structure: ${Math.round(aiSearch.parameters.directAnswerStructure.score)}/100`);
    console.log(`    - Question Density: ${aiSearch.parameters.directAnswerStructure.factors.questionDensity.toFixed(1)}/2.0 points`);
    console.log(`    - Scannability: ${aiSearch.parameters.directAnswerStructure.factors.scannability.toFixed(1)}/2.0 points`);
    console.log(`    - Readability: ${aiSearch.parameters.directAnswerStructure.factors.readability.toFixed(1)}/2.0 points`);
    console.log(`    - ICP Q&A: ${aiSearch.parameters.directAnswerStructure.factors.icpQA.toFixed(1)}/2.0 points`);
    console.log(`  Topical Authority: ${Math.round(aiSearch.parameters.topicalAuthority.score)}/100`);
    console.log(`    - Pillar Pages: ${aiSearch.parameters.topicalAuthority.factors.pillarPages.toFixed(1)}/2.0 points`);
    console.log(`    - Topic Clusters: ${aiSearch.parameters.topicalAuthority.factors.topicClusters.toFixed(1)}/2.0 points`);

    // Show Content Structure details
    const contentStruct = results.categories.contentStructure;
    console.log('\nContent Structure & Entity Recognition (15%):');
    console.log(`  Semantic HTML: ${Math.round(contentStruct.parameters.semanticHTML.score)}/100`);
    console.log(`  Entity Recognition: ${Math.round(contentStruct.parameters.entityRecognition.score)}/100`);

    // Grade assessment
    console.log('');
    console.log('='.repeat(80));
    console.log('ASSESSMENT');
    console.log('='.repeat(80));
    console.log('');

    if (results.grade === 'A') {
      console.log('✅ EXCELLENT - AI-optimized leader');
      console.log('   This site is well-optimized for AI search engines and voice assistants.');
    } else if (results.grade === 'B') {
      console.log('✅ VERY GOOD - Strong AI readiness');
      console.log('   This site has strong AI optimization with room for improvement.');
    } else if (results.grade === 'C') {
      console.log('⚠️  GOOD - Adequate AI preparation');
      console.log('   This site has basic AI optimization but needs enhancements.');
    } else if (results.grade === 'D') {
      console.log('⚠️  FAIR - Needs significant improvement');
      console.log('   This site requires substantial work to be AI-ready.');
    } else {
      console.log('❌ POOR - Requires fundamental restructuring');
      console.log('   This site needs major overhaul for AI search optimization.');
    }

    console.log('');
    console.log('Critical Success Thresholds (from PDF Rubric):');
    console.log(`  AI Search Readiness: ${aiSearch.score}/100 (need 70+ for effective AI citation)`);
    console.log(`  Technical Setup: ${results.categories.technicalSetup.score}/100 (need 67+ for reliable crawler access)`);
    console.log(`  Content Structure: ${contentStruct.score}/100 (need 67+ for AI comprehension)`);

    console.log('');
    console.log('='.repeat(80));
    console.log('TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

    return results;

  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('TEST FAILED');
    console.error('='.repeat(80));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEnhancedRubric()
    .then(() => {
      console.log('');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedRubric };
