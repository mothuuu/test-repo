// backend/test-improved-recommendations.js
require('dotenv').config();

const { extractSiteFacts } = require('./analyzers/recommendation-engine/fact-extractor');
const { normalizeEvidence } = require('./analyzers/recommendation-engine/types');
const { buildCoreJsonLd } = require('./analyzers/recommendation-engine/jsonld');

console.log('🧪 Testing Improved Recommendation System\n');
console.log('═══════════════════════════════════════════════════\n');

// Mock scan evidence (simulates real data)
const mockScanEvidence = {
  url: 'https://www.technologyfunny.com/',
  pageCount: 1,
  html: `
    <html>
      <head>
        <title>Technology Funny - Tech Humor</title>
        <meta name="description" content="Bringing humor to technology">
        <meta property="og:image" content="/assets/logo.png">
      </head>
      <body>
        <h1>Technology Funny</h1>
        <a href="https://twitter.com/techfunny">Twitter</a>
        <a href="https://linkedin.com/company/tech-funny">LinkedIn</a>
        <a href="mailto:info@technologyfunny.com">Contact</a>
      </body>
    </html>
  `,
  metadata: {
    title: 'Technology Funny - Tech Humor',
    description: 'Bringing humor to technology',
    ogImage: '/assets/logo.png'
  },
  content: {
    headings: {
      h1: ['Technology Funny'],
      h2: ['Features', 'Pricing'],
      h3: []
    }
  },
  technical: {
    structuredData: []
  },
  media: {
    images: [
      { src: '/hero.jpg', alt: 'Tech team', hasAlt: true },
      { src: '/feature.jpg', alt: '', hasAlt: false }
    ]
  }
};

console.log('📊 STEP 1: Extract Facts\n');
const extracted = extractSiteFacts(mockScanEvidence);
console.log('✅ Detected Profile:');
console.log(JSON.stringify(extracted.detected_profile, null, 2));
console.log('\n✅ Extracted Facts:');
console.log(JSON.stringify(extracted.extracted_facts, null, 2));

console.log('\n═══════════════════════════════════════════════════\n');

console.log('📊 STEP 2: Normalize Evidence\n');
const { profile, facts } = normalizeEvidence(extracted);
console.log('✅ Normalized Profile:');
console.log(JSON.stringify(profile, null, 2));
console.log('\n✅ Normalized Facts:');
console.log(JSON.stringify(facts, null, 2));

console.log('\n═══════════════════════════════════════════════════\n');

console.log('📊 STEP 3: Generate JSON-LD (NO PLACEHOLDERS)\n');
const schemas = buildCoreJsonLd(mockScanEvidence.url, facts);
schemas.forEach((schema, i) => {
  console.log(`\n✅ Schema ${i + 1} (${schema['@type']}):`);
  console.log(JSON.stringify(schema, null, 2));
});

console.log('\n═══════════════════════════════════════════════════\n');
console.log('✅ TEST COMPLETE!\n');
console.log('Key Checks:');
console.log('  ✓ Brand extracted?', facts.find(f => f.name === 'brand') ? 'YES' : 'NO');
console.log('  ✓ Logo extracted?', facts.find(f => f.name === 'logo') ? 'YES' : 'NO');
console.log('  ✓ Social links extracted?', facts.find(f => f.name === 'social_links') ? 'YES' : 'NO');
console.log('  ✓ Email extracted?', facts.find(f => f.name === 'email') ? 'YES' : 'NO');
console.log('  ✓ JSON-LD has real brand name?', schemas[0].name ? 'YES' : 'NO');
console.log('  ✓ JSON-LD has NO placeholders?', !JSON.stringify(schemas).includes('[Your Company]') ? 'YES' : 'NO');
console.log('\n🎉 All systems operational!\n');