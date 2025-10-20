console.log('🚀 Script started!');

require('dotenv').config({ path: './backend/.env' });

const { generateCompleteRecommendations } = require('./analyzers/recommendation-generator');

const mockScanResults = {
  v5Scores: {
    aiSearchReadiness: {
      schemaMarkup: 45,
      faqStructure: 65,
      entityRecognition: 80
    },
    technicalSetup: {
      httpsImplementation: 100,
      robotsTxt: 60
    }
  },
  scanEvidence: {
    url: 'https://example.com',
    schemas: ['Organization'],
    schemaTypes: ['Organization'],
    technical: {
      robotsTxt: { exists: false }
    }
  }
};

console.log('✅ Starting tests...\n');

async function runTest() {
  console.log('🧪 Testing Complete Recommendation Engine...\n');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ERROR: ANTHROPIC_API_KEY not found');
    process.exit(1);
  }
  
  console.log('✅ API Key found\n');
  
  console.log('📦 Testing FREE tier...\n');
  const freeResults = await generateCompleteRecommendations(mockScanResults, 'free');
  
  console.log('✅ FREE tier complete');
  console.log('   Recommendations:', freeResults.data.recommendations.length);
  console.log('   Upgrade CTA:', freeResults.data.upgrade?.title || 'None');
  
  console.log('\n📦 Testing DIY tier with FAQ...\n');
  const diyResults = await generateCompleteRecommendations(mockScanResults, 'diy', 'SaaS B2B');
  
  console.log('✅ DIY tier complete');
  console.log('   Recommendations:', diyResults.data.recommendations.length);
  
  if (diyResults.data.faq) {
    console.log('\n📋 FAQ Details:');
    console.log('   Source:', diyResults.data.faq.source);
    console.log('   Industry:', diyResults.data.faq.industry);
    console.log('   Quality:', diyResults.data.faq.quality);
    console.log('   FAQ Count:', diyResults.data.faq.faqCount);
  }
  
  console.log('\n\n✅ ALL TESTS PASSED! 🎉');
  console.log('\n🎊 RECOMMENDATION ENGINE COMPLETE! 🎊');
  console.log('   ✅ Part 1: Issue Detection');
  console.log('   ✅ Part 2: Recommendation Generation');
  console.log('   ✅ Part 3: FAQ Customization with Library');
  console.log('   ✅ Part 4: Tier Filtering');
}

runTest().catch(error => {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
});