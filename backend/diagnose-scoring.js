#!/usr/bin/env node

/**
 * Diagnostic Script - Compare Old vs Enhanced Engine
 *
 * This will help identify scoring discrepancies
 */

const V5RubricEngine = require('./analyzers/v5-rubric-engine');
const V5EnhancedRubricEngine = require('./analyzers/v5-enhanced-rubric-engine');

async function diagnose(url) {
  console.log('='.repeat(80));
  console.log('SCORING DIAGNOSTIC - OLD VS ENHANCED ENGINE');
  console.log('='.repeat(80));
  console.log(`\nTest URL: ${url}\n`);

  try {
    // Test OLD engine
    console.log('[1/2] Running OLD V5 Engine...');
    const oldEngine = new V5RubricEngine(url, { timeout: 15000 });
    const oldResults = await oldEngine.analyze();

    console.log('[2/2] Running ENHANCED V5 Engine...');
    const enhancedEngine = new V5EnhancedRubricEngine(url, {
      maxPages: 5,
      timeout: 15000
    });
    const enhancedResults = await enhancedEngine.analyze();

    // Compare scores
    console.log('\n' + '='.repeat(80));
    console.log('SCORE COMPARISON');
    console.log('='.repeat(80));

    console.log(`\nOVERALL SCORE:`);
    console.log(`  Old Engine:      ${oldResults.totalScore}/100`);
    console.log(`  Enhanced Engine: ${enhancedResults.totalScore}/100`);
    console.log(`  Difference:      ${(enhancedResults.totalScore - oldResults.totalScore).toFixed(1)} points`);

    console.log('\nCATEGORY SCORES:');
    console.log('-'.repeat(80));

    const categories = [
      { name: 'AI Readability', key: 'aiReadability' },
      { name: 'AI Search Readiness', key: 'aiSearchReadiness' },
      { name: 'Content Freshness', key: 'contentFreshness' },
      { name: 'Content Structure', key: 'contentStructure' },
      { name: 'Speed & UX', key: 'speedUX' },
      { name: 'Technical Setup', key: 'technicalSetup' },
      { name: 'Trust & Authority', key: 'trustAuthority' },
      { name: 'Voice Optimization', key: 'voiceOptimization' }
    ];

    for (const cat of categories) {
      const oldScore = oldResults.categories[cat.key]?.score || 0;
      const enhancedScore = enhancedResults.categories[cat.key]?.score || 0;
      const diff = (enhancedScore - oldScore).toFixed(1);
      const diffStr = diff > 0 ? `+${diff}` : diff;

      console.log(`${cat.name.padEnd(25)} Old: ${oldScore.toString().padStart(3)}  Enhanced: ${enhancedScore.toString().padStart(3)}  Diff: ${diffStr}`);
    }

    // Show enhanced engine metrics
    console.log('\n' + '='.repeat(80));
    console.log('ENHANCED ENGINE - EXTRACTED METRICS');
    console.log('='.repeat(80));

    const metrics = enhancedResults.siteMetrics;
    console.log(`\nPages Crawled: ${enhancedResults.pageCount}`);
    console.log(`\nContent Quality:`);
    console.log(`  Question Headings:     ${(metrics.pagesWithQuestionHeadings * 100).toFixed(0)}% of pages`);
    console.log(`  FAQs:                  ${(metrics.pagesWithFAQs * 100).toFixed(0)}% of pages`);
    console.log(`  Lists (scannability):  ${(metrics.pagesWithLists * 100).toFixed(0)}% of pages`);
    console.log(`  Avg Word Count:        ${Math.round(metrics.avgWordCount)} words`);
    console.log(`  Avg Flesch Score:      ${metrics.avgFleschScore.toFixed(0)}`);
    console.log(`  Avg Sentence Length:   ${metrics.avgSentenceLength.toFixed(1)} words`);

    console.log(`\nStructure:`);
    console.log(`  Proper H1:             ${(metrics.pagesWithProperH1 * 100).toFixed(0)}% of pages`);
    console.log(`  Semantic HTML:         ${(metrics.pagesWithSemanticHTML * 100).toFixed(0)}% of pages`);
    console.log(`  Good Alt Text:         ${(metrics.pagesWithGoodAltText * 100).toFixed(0)}% of pages`);

    console.log(`\nTechnical:`);
    console.log(`  Schema Markup:         ${(metrics.pagesWithSchema * 100).toFixed(0)}% of pages`);
    console.log(`  Organization Schema:   ${(metrics.pagesWithOrganizationSchema * 100).toFixed(0)}% of pages`);
    console.log(`  FAQ Schema:            ${(metrics.pagesWithFAQSchema * 100).toFixed(0)}% of pages`);

    console.log(`\nFreshness:`);
    console.log(`  Last Modified Date:    ${(metrics.pagesWithLastModified * 100).toFixed(0)}% of pages`);
    console.log(`  Current Year Content:  ${(metrics.pagesWithCurrentYear * 100).toFixed(0)}% of pages`);

    console.log(`\nAuthority:`);
    console.log(`  Pillar Pages:          ${metrics.pillarPageCount}`);
    console.log(`  Topic Cluster Coverage: ${(metrics.topicClusterCoverage * 100).toFixed(0)}%`);

    // Evidence check
    console.log('\n' + '='.repeat(80));
    console.log('EVIDENCE CHECK');
    console.log('='.repeat(80));
    console.log(`\nOld Engine Evidence:      ${oldEngine.evidence ? 'Present' : 'MISSING'}`);
    console.log(`Enhanced Engine Evidence: ${enhancedEngine.evidence ? 'Present' : 'MISSING'}`);

    if (enhancedEngine.evidence) {
      const ev = enhancedEngine.evidence;
      console.log(`\nFirst Page Evidence:`);
      console.log(`  Word Count:       ${ev.content.wordCount}`);
      console.log(`  Image Count:      ${ev.media.imageCount}`);
      console.log(`  Schema Count:     ${ev.technical.structuredData.length}`);
      console.log(`  Has FAQ Schema:   ${ev.technical.hasFAQSchema}`);
      console.log(`  H1 Count:         ${ev.structure.headingCount.h1}`);
      console.log(`  Internal Links:   ${ev.structure.internalLinks}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run diagnostic
const url = process.argv[2];
if (!url) {
  console.error('Usage: node diagnose-scoring.js <URL>');
  console.error('Example: node diagnose-scoring.js https://example.com');
  process.exit(1);
}

diagnose(url);
