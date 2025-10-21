require('dotenv').config();

/**
 * RECOMMENDATION GENERATOR - CHATGPT + SMART TEMPLATES
 * File: backend/analyzers/recommendation-engine/rec-generator.js
 * 
 * Strategy:
 * - Top 5 issues: ChatGPT-generated (high quality)
 * - Remaining issues: Smart template-based (uses real scan data)
 * - NO CLAUDE (avoiding rate limits)
 */

const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========================================
// RECOMMENDATION TEMPLATES (Enhanced)
// ========================================

const RECOMMENDATION_TEMPLATES = {
  structuredDataScore: {
    title: "Implement Structured Data Schema",
    impactArea: "AI Understanding & Rich Results",
    whyItMatters: "Structured data tells AI assistants exactly what your content is about, increasing citation chances by 3-5x",
    typicalTimeToFix: "2-4 hours",
    difficulty: "Medium",
    estimatedGain: 50
  },
  faqScore: {
    title: "Add FAQ Schema Markup",
    impactArea: "Voice Search & Featured Snippets",
    whyItMatters: "FAQ schema is the #1 way to appear in AI-generated answers and voice search results",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy",
    estimatedGain: 35
  },
  altTextScore: {
    title: "Complete Image Alt Text Coverage",
    impactArea: "Multimodal AI & Accessibility",
    whyItMatters: "Alt text enables AI to understand and reference your images in multimodal search",
    typicalTimeToFix: "2-3 hours",
    difficulty: "Easy",
    estimatedGain: 25
  },
  captionsTranscriptsScore: {
    title: "Add Video Transcripts and Captions",
    impactArea: "Video Searchability",
    whyItMatters: "Transcripts make video content quotable by AI assistants, unlocking 70% more discoverability",
    typicalTimeToFix: "3-4 hours per video",
    difficulty: "Medium",
    estimatedGain: 40
  },
  headingHierarchyScore: {
    title: "Fix Heading Structure (H1-H6)",
    impactArea: "Content Organization",
    whyItMatters: "Proper heading hierarchy helps AI understand content structure and extract key points",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy",
    estimatedGain: 20
  },
  accessibilityScore: {
    title: "Improve Web Accessibility",
    impactArea: "Universal Access & AI Parsing",
    whyItMatters: "Accessibility features help AI better understand and present your content accurately",
    typicalTimeToFix: "3-5 hours",
    difficulty: "Medium",
    estimatedGain: 30
  },
  sitemapScore: {
    title: "Optimize XML Sitemap",
    impactArea: "Content Discovery",
    whyItMatters: "A complete sitemap ensures AI crawlers discover all your important pages quickly",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Easy",
    estimatedGain: 25
  },
  indexNowScore: {
    title: "Implement IndexNow Protocol",
    impactArea: "Real-time Indexing",
    whyItMatters: "IndexNow enables instant content updates to search engines, capturing time-sensitive queries",
    typicalTimeToFix: "1-2 hours",
    difficulty: "Medium",
    estimatedGain: 30
  },
  authorBiosScore: {
    title: "Add Comprehensive Author Profiles",
    impactArea: "E-E-A-T & Trust Signals",
    whyItMatters: "Author credentials help AI assess content expertise and trustworthiness for YMYL topics",
    typicalTimeToFix: "2-3 hours",
    difficulty: "Easy",
    estimatedGain: 25
  },
  geoContentScore: {
    title: "Add Location-Specific Content",
    impactArea: "Local Search Visibility",
    whyItMatters: "Geographic signals help AI serve your content for 'near me' and location-based queries",
    typicalTimeToFix: "2-4 hours",
    difficulty: "Medium",
    estimatedGain: 30
  },
  questionHeadingsScore: {
    title: "Use Question-Format Headings",
    impactArea: "Voice Search Optimization",
    whyItMatters: "Question headings align perfectly with how users query AI assistants naturally",
    typicalTimeToFix: "2-3 hours",
    difficulty: "Easy",
    estimatedGain: 20
  }
};

// ========================================
// MAIN GENERATION FUNCTION (HYBRID)
// ========================================

async function generateRecommendations(issues, scanEvidence, tier = 'free', industry = null) {
  console.log(`   🎯 HYBRID MODE: Generating recommendations for ${issues.length} issues...`);
  
  const recommendations = [];
  
  // Limit based on tier
  const limit = tier === 'free' ? 5 : (tier === 'diy' ? 40 : 300);
  const issuesToProcess = issues.slice(0, limit);
  
  // Split into ChatGPT (top 5) and template (rest)
  const aiIssues = issuesToProcess.slice(0, 5);
  const templateIssues = issuesToProcess.slice(5);
  
  console.log(`   🤖 ChatGPT Generation: ${aiIssues.length} issues`);
  console.log(`   📋 Smart Template Generation: ${templateIssues.length} issues`);
  
  // PART 1: Generate ChatGPT recommendations for top 5 issues
  for (let i = 0; i < aiIssues.length; i++) {
    const issue = aiIssues[i];
    
    try {
      const recommendation = await generateWithChatGPT(issue, scanEvidence, tier, industry);
      recommendations.push(recommendation);
      console.log(`   ✅ ChatGPT: ${issue.subfactor}`);
      
      // Add 5-second delay between API calls (except for last one)
      if (i < aiIssues.length - 1) {
        console.log(`   ⏳ Waiting 5 seconds before next call...`);
        await sleep(5000);
      }
      
    } catch (error) {
      console.error(`   ⚠️  ChatGPT failed for ${issue.subfactor}: ${error.message}`);
      console.log(`   📋 Using smart template instead`);
      recommendations.push(generateSmartTemplate(issue, scanEvidence, tier, industry));
    }
  }
  
  // PART 2: Generate smart template recommendations (instant, no API calls)
  for (const issue of templateIssues) {
    recommendations.push(generateSmartTemplate(issue, scanEvidence, tier, industry));
  }
  
  console.log(`   ✅ Generated ${recommendations.length} total recommendations (${aiIssues.length} ChatGPT, ${templateIssues.length} smart template)`);
  
  return recommendations;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// CHATGPT GENERATION (Top 5 Only)
// ========================================

async function generateWithChatGPT(issue, scanEvidence, tier, industry) {
  const template = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility",
    typicalTimeToFix: "Varies",
    difficulty: "Medium",
    estimatedGain: 20
  };
  
  const prompt = buildChatGPTPrompt(issue, scanEvidence, template, tier, industry);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: tier === 'free' ? 600 : 1800,
    temperature: 0.7,
    messages: [{
      role: 'system',
      content: 'You are an AI Search Optimization expert specializing in Answer Engine Optimization (AEO). Provide specific, actionable recommendations based on real website data.'
    }, {
      role: 'user',
      content: prompt
    }]
  });
  
  const gptResponse = response.choices[0].message.content;
  return structureRecommendation(gptResponse, issue, template, tier, 'chatgpt');
}

function buildChatGPTPrompt(issue, scanEvidence, template, tier, industry) {
  const detailLevel = tier === 'free' ? 'brief and general' : 'detailed and specific';
  const includeCode = tier !== 'free';
  
  // Create a MUCH smaller evidence summary (not the entire object)
  const evidenceSummary = summarizeEvidence(issue.evidence);
  
  return `Generate a ${detailLevel} recommendation for this AI visibility issue.

**WEBSITE CONTEXT:**
- URL: ${scanEvidence.url}
- Industry: ${industry || 'General'}
- Issue: ${issue.subfactor}
- Current Score: ${issue.currentScore}/100
- Target Score: ${issue.threshold}/100
- Gap: ${issue.gap} points
- Priority: ${issue.severity}

**KEY FINDINGS:**
${evidenceSummary}

**GUIDANCE:**
- Title: ${template.title}
- Impact: ${template.impactArea}
- Why it matters: ${template.whyItMatters}
- Estimated gain: +${template.estimatedGain} points

**FORMAT YOUR RESPONSE EXACTLY LIKE THIS:**

[FINDING]
What specific problem was detected? Use the key findings data above. Be specific with numbers and examples.

[IMPACT]
Why does this matter for AI visibility? What opportunities are being missed? Focus on business impact. (2-3 sentences)

[ACTION STEPS]
${tier === 'free' ? '3-4 clear action items' : '5-7 detailed step-by-step instructions with specific guidance'}

${includeCode ? `[CODE]
Provide copy-paste ready code snippet customized for ${scanEvidence.url}. Make it production-ready.` : ''}

**IMPORTANT:**
- Use specific numbers from the key findings
- Reference the actual URL when relevant
- ${tier === 'free' ? 'Keep it concise but actionable' : 'Be comprehensive with technical details'}
- Make code examples use their real domain: ${scanEvidence.url}`;
}

// New helper function to summarize evidence (keeps prompt small)
function summarizeEvidence(evidence) {
  if (!evidence) return 'No specific evidence available';
  
  const summary = [];
  
  // Only include the most important evidence fields
  if (evidence.found !== undefined) {
    summary.push(`- Feature detected: ${evidence.found ? 'Yes' : 'No'}`);
  }
  if (evidence.totalImages) {
    summary.push(`- Total images: ${evidence.totalImages}`);
  }
  if (evidence.imagesWithoutAlt) {
    summary.push(`- Images without alt text: ${evidence.imagesWithoutAlt}`);
  }
  if (evidence.totalSchemas !== undefined) {
    summary.push(`- Schema markup found: ${evidence.totalSchemas} types`);
  }
  if (evidence.faqCount !== undefined) {
    summary.push(`- FAQ schemas: ${evidence.faqCount}`);
  }
  if (evidence.videoCount) {
    summary.push(`- Videos found: ${evidence.videoCount}`);
  }
  if (evidence.h1Count !== undefined) {
    summary.push(`- H1 tags: ${evidence.h1Count}`);
  }
  if (evidence.questionHeadings) {
    summary.push(`- Question-format headings: ${evidence.questionHeadings}`);
  }
  if (evidence.locationMentions) {
    summary.push(`- Location mentions: ${evidence.locationMentions}`);
  }
  if (evidence.authorCount) {
    summary.push(`- Authors found: ${evidence.authorCount}`);
  }
  
  return summary.length > 0 ? summary.join('\n') : 'Limited evidence available - general recommendations apply';
}

function structureRecommendation(aiResponse, issue, template, tier, source) {
  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: template.title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    
    finding: extractSection(aiResponse, 'FINDING') || 'AI-generated finding not available',
    impact: extractSection(aiResponse, 'IMPACT') || template.whyItMatters,
    actionSteps: extractActionSteps(aiResponse),
    codeSnippet: tier !== 'free' ? (extractSection(aiResponse, 'CODE') || null) : null,
    
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    estimatedScoreGain: template.estimatedGain,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: tier !== 'free' ? issue.evidence : null,
    generatedBy: source
  };
}

// ========================================
// SMART TEMPLATE GENERATION
// (Uses actual scan data like FAQ library)
// ========================================

function generateSmartTemplate(issue, scanEvidence, tier, industry) {
  const template = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility",
    typicalTimeToFix: "Varies",
    difficulty: "Medium",
    estimatedGain: 20
  };
  
  // Build SMART finding using actual evidence (like FAQ library extraction rules)
  const finding = buildSmartFinding(issue, scanEvidence, template);
  
  // Generate context-aware action steps
  const actionSteps = generateContextAwareSteps(issue, scanEvidence, industry);
  
  // Generate code snippet with real data
  const codeSnippet = tier !== 'free' ? generateSmartCodeSnippet(issue, scanEvidence, industry) : null;
  
  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: template.title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    finding: finding,
    impact: template.whyItMatters,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    estimatedScoreGain: template.estimatedGain,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: tier !== 'free' ? issue.evidence : null,
    generatedBy: 'smart_template'
  };
}

// ========================================
// SMART FINDING BUILDER (Uses Real Data)
// ========================================

function buildSmartFinding(issue, scanEvidence, template) {
  const subfactor = issue.subfactor;
  const evidence = issue.evidence || {};
  const domain = extractDomain(scanEvidence.url);
  
  // Subfactor-specific smart findings (using actual evidence data)
  const smartFindings = {
    structuredDataScore: () => {
      if (!evidence.found || evidence.totalSchemas === 0) {
        return `No structured data (Schema.org) was detected on ${domain}. This means AI assistants cannot understand your business type, services, or content structure, making you invisible for entity-based queries.`;
      }
      return `Limited structured data found (${evidence.totalSchemas || 0} schemas). Missing critical schemas like Organization, FAQ, and Service markup that AI assistants use for citations.`;
    },
    
    faqScore: () => {
      if (!evidence.found || evidence.faqCount === 0) {
        return `No FAQ schema markup detected on ${domain}. Your page contains ${evidence.totalQuestions || 0} question-format headings, but without FAQ schema, AI assistants cannot extract and cite these answers.`;
      }
      return `FAQ schema partially implemented. Only ${evidence.faqCount} questions marked up, but page contains ${evidence.totalQuestions || 0} total questions. Missing opportunity for ${evidence.totalQuestions - evidence.faqCount} additional citations.`;
    },
    
    altTextScore: () => {
      const missing = evidence.imagesWithoutAlt || 0;
      const total = evidence.totalImages || 0;
      const coverage = total > 0 ? Math.round((total - missing) / total * 100) : 0;
      
      if (missing > 0) {
        return `${missing} of ${total} images are missing alt text (${coverage}% coverage). Without descriptive alt text, AI assistants cannot understand or reference your visual content in multimodal search results.`;
      }
      return `Alt text coverage is ${coverage}%. While technically present, many alt attributes may be too generic (e.g., "image" or "photo") to be useful for AI understanding.`;
    },
    
    captionsTranscriptsScore: () => {
      const videoCount = evidence.videoCount || evidence.totalVideos || 0;
      if (videoCount > 0) {
        return `${videoCount} video${videoCount > 1 ? 's' : ''} detected with no transcripts or captions. Video content is invisible to AI assistants without text alternatives, missing 70% of potential discoverability.`;
      }
      return `Video content on ${domain} lacks transcripts or captions, making it unsearchable and uncitable by AI assistants.`;
    },
    
    headingHierarchyScore: () => {
      const issues = [];
      if (evidence.multipleH1s) issues.push(`${evidence.h1Count} H1 tags (should be exactly 1)`);
      if (evidence.skippedLevels) issues.push('heading levels skipped (e.g., H1→H3)');
      if (evidence.emptyHeadings) issues.push(`${evidence.emptyHeadings} empty headings`);
      
      if (issues.length > 0) {
        return `Heading structure problems detected: ${issues.join(', ')}. This confuses AI about your content hierarchy and makes it harder to extract key points accurately.`;
      }
      return `Heading hierarchy needs improvement. Score: ${issue.currentScore}/100. Proper structure helps AI understand content organization and extract relevant sections for citations.`;
    },
    
    accessibilityScore: () => {
      const issues = [];
      if (evidence.contrastIssues) issues.push(`${evidence.contrastIssues} color contrast issues`);
      if (evidence.missingAriaLabels) issues.push(`${evidence.missingAriaLabels} missing ARIA labels`);
      if (evidence.keyboardIssues) issues.push('keyboard navigation issues');
      
      if (issues.length > 0) {
        return `Accessibility issues detected: ${issues.join(', ')}. These same issues prevent AI from properly parsing your content structure.`;
      }
      return `Accessibility score: ${issue.currentScore}/100. Improvements will help both users with disabilities and AI assistants understand your content better.`;
    },
    
    sitemapScore: () => {
      if (!evidence.found) {
        return `No XML sitemap found at ${domain}/sitemap.xml. AI crawlers cannot efficiently discover all your pages, meaning important content may be invisible.`;
      }
      const pages = evidence.totalPages || 0;
      if (pages < 10) {
        return `XML sitemap found but only contains ${pages} pages. Ensure all important pages are included and sitemap is submitted to Google Search Console.`;
      }
      return `XML sitemap exists with ${pages} pages, but may need optimization (priority, changefreq, lastmod tags) to help AI prioritize your most important content.`;
    },
    
    indexNowScore: () => {
      if (!evidence.found) {
        return `IndexNow protocol not implemented on ${domain}. Without real-time indexing, it can take hours or days for AI assistants to discover your content updates.`;
      }
      return `IndexNow partially configured but not fully optimized. Ensure instant notification on content updates to capture time-sensitive queries.`;
    },
    
    geoContentScore: () => {
      if (!evidence.found || !evidence.locationMentions) {
        return `No location-specific content detected on ${domain}. Missing opportunities for "near me" searches and local AI assistant recommendations.`;
      }
      return `Limited geographic signals found. Only ${evidence.locationMentions || 0} location mentions. Add explicit city/region targeting to capture local search traffic.`;
    },
    
    questionHeadingsScore: () => {
      const questionCount = evidence.questionHeadings || 0;
      const totalHeadings = evidence.totalHeadings || 1;
      const percentage = Math.round((questionCount / totalHeadings) * 100);
      
      return `Only ${questionCount} of ${totalHeadings} headings (${percentage}%) are question-format. Voice search queries are 75% question-based, so question headings dramatically improve discoverability.`;
    },
    
    authorBiosScore: () => {
      if (!evidence.found || !evidence.authorCount) {
        return `No author information found on ${domain}. For YMYL (Your Money Your Life) content, AI assistants heavily weight author credentials when determining trustworthiness.`;
      }
      return `Basic author information found for ${evidence.authorCount} author(s), but missing detailed credentials, expertise indicators, and structured markup that AI uses for E-E-A-T evaluation.`;
    }
  };
  
  // Get smart finding or fallback to basic
  const smartFinder = smartFindings[subfactor];
  if (smartFinder) {
    return smartFinder();
  }
  
  // Generic fallback
  return `Your ${subfactor} score is ${issue.currentScore}/100, below the recommended ${issue.threshold}/100 threshold. Gap: ${issue.gap} points. ${template.whyItMatters}`;
}

// ========================================
// CONTEXT-AWARE ACTION STEPS
// ========================================

function generateContextAwareSteps(issue, scanEvidence, industry) {
  const subfactor = issue.subfactor;
  const domain = extractDomain(scanEvidence.url);
  const evidence = issue.evidence || {};
  
  // Industry-specific action steps
  const industrySteps = {
    structuredDataScore: {
      default: [
        'Run Google\'s Rich Results Test on your homepage to see what\'s currently detected',
        'Implement Organization schema with complete business information (name, logo, contact)',
        `Add ${industry === 'Agency' ? 'Service' : 'Product'} schema for your main offerings`,
        'Implement FAQ schema for your most common customer questions',
        'Validate all markup with Schema.org validator and fix any errors',
        'Submit schema-rich pages to Google Search Console for monitoring'
      ],
      Agency: [
        'Audit current structured data using Google\'s Rich Results Test',
        'Add Organization schema with agency details, services, and client industries',
        'Implement Service schema for each core service (SEO, PPC, Content, etc.)',
        'Add FAQPage schema for your services and pricing pages',
        'Include aggregate rating schema if you have client testimonials',
        'Validate with Schema.org validator and monitor in Search Console'
      ]
    },
    
    faqScore: [
      `Review ${domain}'s customer inquiries and support tickets for common questions`,
      'Identify 5-10 high-value questions your target audience actually asks',
      'Write clear, comprehensive answers (100-250 words each)',
      'Add FAQ schema markup to relevant pages (services, pricing, about)',
      'Test FAQ rich results using Google\'s Rich Results Test',
      'Monitor FAQ performance in Google Search Console'
    ],
    
    altTextScore: (() => {
      const missing = evidence.imagesWithoutAlt || 0;
      return [
        `Audit all ${evidence.totalImages || 'images'} on ${domain} using a crawler or browser extension`,
        missing > 0 ? `Prioritize the ${missing} images without alt text` : 'Review existing alt text for quality',
        'Write descriptive alt text that explains what\'s in the image (not just "image" or "photo")',
        'Include relevant keywords naturally, but don\'t keyword stuff',
        'For decorative images, use empty alt="" to tell AI to skip them',
        'Update CMS settings to require alt text before publishing new images'
      ];
    })(),
    
    headingHierarchyScore: [
      'Ensure exactly ONE H1 tag per page with your primary keyword/topic',
      'Use H2 tags for main sections (aim for 3-5 per page)',
      'Use H3 tags for subsections under each H2',
      'Never skip heading levels (e.g., don\'t go H1 → H3)',
      'Review heading structure in HTML or with a heading analyzer tool',
      'Make headings descriptive and meaningful, not just "Introduction" or "Section 1"'
    ]
  };
  
  // Get industry-specific steps or default
  if (industrySteps[subfactor]) {
    if (typeof industrySteps[subfactor] === 'object' && industry && industrySteps[subfactor][industry]) {
      return industrySteps[subfactor][industry];
    }
    if (Array.isArray(industrySteps[subfactor])) {
      return industrySteps[subfactor];
    }
    if (industrySteps[subfactor].default) {
      return industrySteps[subfactor].default;
    }
  }
  
  // Generic fallback steps
  return [
    `Review current implementation of ${subfactor} on ${domain}`,
    'Research best practices and requirements for AI visibility',
    'Create implementation plan with timeline and priorities',
    'Execute changes systematically and test thoroughly',
    'Monitor impact on AI visibility metrics and adjust as needed'
  ];
}

// ========================================
// SMART CODE SNIPPET GENERATOR
// ========================================

function generateSmartCodeSnippet(issue, scanEvidence, industry) {
  const subfactor = issue.subfactor;
  const url = scanEvidence.url;
  const domain = extractDomain(url);
  const evidence = issue.evidence || {};
  
  // Generate industry and evidence-aware code
  const codeSnippets = {
    structuredDataScore: () => {
      const companyName = evidence.companyName || `[Your Company Name]`;
      const description = evidence.description || industry ? `${industry} services and solutions` : 'Your company description';
      
      return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${companyName}",
  "url": "${url}",
  "logo": "${url}/logo.png",
  "description": "${description}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Your Street]",
    "addressLocality": "[Your City]",
    "addressRegion": "[Your State]",
    "postalCode": "[Your ZIP]",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-XXX-XXX-XXXX",
    "contactType": "Customer Service",
    "email": "info@${domain}"
  },
  "sameAs": [
    "[LinkedIn URL]",
    "[Twitter URL]",
    "[Facebook URL]"
  ]
}
</script>`;
    },
    
    faqScore: () => {
      const questions = evidence.detectedQuestions || [];
      const sampleFAQ = questions.length > 0 ? questions[0] : `What services does ${extractDomain(url)} provide?`;
      
      return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "${sampleFAQ}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Write your detailed answer here (100-250 words). Be comprehensive and include relevant keywords naturally."
      }
    },
    {
      "@type": "Question",
      "name": "[Your second question]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Your second answer]"
      }
    }
  ]
}
</script>

<!-- Add this schema to pages with FAQ content:
${url}/services
${url}/pricing
${url}/about -->`;
    },
    
    altTextScore: () => {
      return `<!-- Replace generic alt text like this: -->
<img src="/images/hero.jpg" alt="image"> ❌

<!-- With descriptive alt text like this: -->
<img src="/images/hero.jpg" 
     alt="${industry === 'Agency' ? 'Marketing team collaborating on digital strategy in modern office' : 'Professional team working together on business solutions'}" 
     loading="lazy"> ✅

<!-- Examples for your images: -->
${evidence.sampleImages ? evidence.sampleImages.map(img => 
  `<img src="${img}" alt="[Describe what's in this specific image]" loading="lazy">`
).join('\n') : '<!-- Audit your images and add descriptive alt text to each one -->'}`;
    },
    
    sitemapScore: () => {
      return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage: Highest priority, updates weekly -->
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
  </url>
  
  <!-- Key landing pages: High priority -->
  <url>
    <loc>${url}/services</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.9</priority>
    <changefreq>monthly</changefreq>
  </url>
  
  <url>
    <loc>${url}/about</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>0.8</priority>
    <changefreq>monthly</changefreq>
  </url>
  
  <!-- Add all important pages here -->
</urlset>

<!-- Save as: ${url}/sitemap.xml
Then submit to Google Search Console -->`;
    },
    
    headingHierarchyScore: () => {
      return `<!-- ❌ INCORRECT: Multiple H1s, skipped levels -->
<h1>Welcome</h1>
<h1>About Us</h1>
<h3>Our Services</h3>

<!-- ✅ CORRECT: Single H1, logical hierarchy -->
<h1>${industry === 'Agency' ? 'Full-Service Digital Marketing Agency' : 'Professional [Your Service] Solutions'}</h1>

<h2>Our Services</h2>
  <h3>${industry === 'Agency' ? 'Search Engine Optimization (SEO)' : 'Core Service #1'}</h3>
  <h3>${industry === 'Agency' ? 'Pay-Per-Click (PPC) Advertising' : 'Core Service #2'}</h3>
  <h3>${industry === 'Agency' ? 'Content Marketing' : 'Core Service #3'}</h3>

<h2>Why Choose Us</h2>
  <h3>Industry Expertise</h3>
  <h3>Proven Results</h3>`;
    }
  };
  
  const generator = codeSnippets[subfactor];
  return generator ? generator() : `<!-- Code implementation for ${subfactor} -->
<!-- Visit ${url} for specific implementation guidance -->`;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function extractSection(response, sectionName) {
  const regex = new RegExp(`\\[${sectionName}\\]\\s*([\\s\\S]*?)(?=\\[|$)`, 'i');
  const match = response.match(regex);
  return match ? match[1].trim() : '';
}

function extractActionSteps(response) {
  const stepsSection = extractSection(response, 'ACTION STEPS');
  if (!stepsSection) return [];
  
  return stepsSection
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
    .filter(line => line.length > 10);
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'your-domain.com';
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  generateRecommendations,
  RECOMMENDATION_TEMPLATES
};