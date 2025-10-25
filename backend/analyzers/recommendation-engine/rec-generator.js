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

  // Create comprehensive evidence summary with site context
  const evidenceSummary = summarizeEvidence(issue.evidence, scanEvidence);

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

// Enhanced helper function to summarize evidence (comprehensive context for ChatGPT)
function summarizeEvidence(evidence, scanEvidence) {
  if (!evidence) return 'No specific evidence available';

  const summary = [];

  // ===== SITE IDENTITY & BRANDING =====
  if (scanEvidence) {
    if (scanEvidence.metadata?.title) {
      summary.push(`- Page title: "${scanEvidence.metadata.title}"`);
    }
    if (scanEvidence.metadata?.description) {
      summary.push(`- Meta description: "${scanEvidence.metadata.description.substring(0, 120)}..."`);
    }
    if (scanEvidence.metadata?.ogTitle && scanEvidence.metadata.ogTitle !== scanEvidence.metadata.title) {
      summary.push(`- Open Graph title: "${scanEvidence.metadata.ogTitle}"`);
    }
  }

  // ===== ISSUE-SPECIFIC EVIDENCE =====
  if (evidence.found !== undefined) {
    summary.push(`- Feature detected: ${evidence.found ? 'Yes' : 'No'}`);
  }

  // Images & Media
  if (evidence.totalImages !== undefined) {
    summary.push(`- Total images: ${evidence.totalImages}`);
  }
  if (evidence.imagesWithoutAlt !== undefined) {
    const coverage = evidence.totalImages > 0
      ? Math.round((evidence.totalImages - evidence.imagesWithoutAlt) / evidence.totalImages * 100)
      : 0;
    summary.push(`- Images without alt text: ${evidence.imagesWithoutAlt} (${coverage}% coverage)`);
  }
  if (evidence.videoCount !== undefined && evidence.videoCount > 0) {
    summary.push(`- Videos found: ${evidence.videoCount}`);
    if (evidence.videosWithTranscripts !== undefined) {
      summary.push(`- Videos with transcripts: ${evidence.videosWithTranscripts}`);
    }
    if (evidence.videosWithCaptions !== undefined) {
      summary.push(`- Videos with captions: ${evidence.videosWithCaptions}`);
    }
  }

  // Structured Data & Schemas
  if (evidence.totalSchemas !== undefined) {
    summary.push(`- Schema markup types found: ${evidence.totalSchemas}`);
    if (evidence.schemaTypes && evidence.schemaTypes.length > 0) {
      summary.push(`- Schema types: ${evidence.schemaTypes.join(', ')}`);
    }
    if (evidence.missingSchemas && evidence.missingSchemas.length > 0) {
      summary.push(`- Missing recommended schemas: ${evidence.missingSchemas.slice(0, 5).join(', ')}`);
    }
  }
  if (evidence.faqCount !== undefined) {
    summary.push(`- FAQ schemas: ${evidence.faqCount}`);
    if (evidence.totalQuestions !== undefined) {
      summary.push(`- Question-format headings found: ${evidence.totalQuestions}`);
    }
  }

  // Headings & Content Structure
  if (evidence.h1Count !== undefined) {
    summary.push(`- H1 tags: ${evidence.h1Count} ${evidence.h1Count === 1 ? '(good)' : evidence.h1Count === 0 ? '(MISSING)' : '(should be exactly 1)'}`);
  }
  if (evidence.multipleH1s) {
    summary.push(`- ⚠️ Multiple H1s detected (confuses AI)`);
  }
  if (evidence.skippedLevels) {
    summary.push(`- ⚠️ Heading hierarchy skips levels (e.g., H1→H3)`);
  }
  if (evidence.emptyHeadings) {
    summary.push(`- ⚠️ Empty headings: ${evidence.emptyHeadings}`);
  }
  if (evidence.totalHeadings !== undefined) {
    summary.push(`- Total headings (H2-H6): ${evidence.totalHeadings}`);
  }
  if (evidence.questionHeadings !== undefined) {
    const percentage = evidence.totalHeadings > 0
      ? Math.round((evidence.questionHeadings / evidence.totalHeadings) * 100)
      : 0;
    summary.push(`- Question-format headings: ${evidence.questionHeadings} (${percentage}% of all headings)`);
  }

  // Content Depth & Quality
  if (scanEvidence?.content?.wordCount) {
    summary.push(`- Content length: ${scanEvidence.content.wordCount} words`);
  }
  if (scanEvidence?.content?.paragraphs?.length) {
    summary.push(`- Paragraphs: ${scanEvidence.content.paragraphs.length}`);
  }
  if (scanEvidence?.content?.lists?.length) {
    summary.push(`- Lists: ${scanEvidence.content.lists.length}`);
  }
  if (scanEvidence?.content?.faqs?.length) {
    summary.push(`- FAQ content detected: ${scanEvidence.content.faqs.length} Q&A pairs`);
  }

  // Links & Navigation
  if (scanEvidence?.structure?.internalLinks !== undefined) {
    summary.push(`- Internal links: ${scanEvidence.structure.internalLinks}`);
  }
  if (scanEvidence?.structure?.hasBreadcrumbs !== undefined) {
    summary.push(`- Breadcrumbs: ${scanEvidence.structure.hasBreadcrumbs ? 'Yes' : 'No'}`);
  }
  if (scanEvidence?.structure?.hasTOC !== undefined && scanEvidence.structure.hasTOC) {
    summary.push(`- Table of contents: Present`);
  }

  // Geographic & Local Content
  if (evidence.locationMentions !== undefined) {
    summary.push(`- Location mentions: ${evidence.locationMentions}`);
  }
  if (scanEvidence?.metadata?.geoRegion) {
    summary.push(`- Geographic region: ${scanEvidence.metadata.geoRegion}`);
  }
  if (scanEvidence?.metadata?.geoPlacename) {
    summary.push(`- Location: ${scanEvidence.metadata.geoPlacename}`);
  }

  // Author & Trust Signals
  if (evidence.authorCount !== undefined) {
    summary.push(`- Authors found: ${evidence.authorCount}`);
  }
  if (scanEvidence?.metadata?.author) {
    summary.push(`- Page author: ${scanEvidence.metadata.author}`);
  }

  // Technical Signals
  if (scanEvidence?.technical?.hasCanonical !== undefined) {
    summary.push(`- Canonical tag: ${scanEvidence.technical.hasCanonical ? 'Present' : 'Missing'}`);
  }
  if (scanEvidence?.technical?.hasSitemapLink !== undefined) {
    summary.push(`- Sitemap: ${scanEvidence.technical.hasSitemapLink ? 'Detected' : 'Not found'}`);
  }
  if (scanEvidence?.technical?.hasRSSFeed !== undefined && scanEvidence.technical.hasRSSFeed) {
    summary.push(`- RSS feed: Present`);
  }
  if (scanEvidence?.technical?.robotsMeta) {
    summary.push(`- Robots meta: ${scanEvidence.technical.robotsMeta}`);
  }

  // Accessibility
  if (evidence.contrastIssues) {
    summary.push(`- ⚠️ Color contrast issues: ${evidence.contrastIssues}`);
  }
  if (evidence.missingAriaLabels) {
    summary.push(`- ⚠️ Missing ARIA labels: ${evidence.missingAriaLabels}`);
  }
  if (scanEvidence?.accessibility?.hasLangAttribute !== undefined) {
    summary.push(`- Language attribute: ${scanEvidence.accessibility.hasLangAttribute ? 'Present' : 'Missing'}`);
  }

  // Dates & Freshness
  if (scanEvidence?.metadata?.lastModified) {
    summary.push(`- Last modified: ${scanEvidence.metadata.lastModified}`);
  }
  if (scanEvidence?.metadata?.publishedTime) {
    summary.push(`- Published: ${scanEvidence.metadata.publishedTime}`);
  }

  // Performance
  if (scanEvidence?.performance?.ttfb) {
    summary.push(`- Time to First Byte: ${scanEvidence.performance.ttfb}ms`);
  }

  return summary.length > 0
    ? summary.join('\n')
    : 'Limited evidence available - general recommendations apply';
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
  const companyName = extractCompanyName(scanEvidence);
  const pageTitle = scanEvidence.metadata?.title || 'this page';
  const wordCount = scanEvidence.content?.wordCount || 0;

  // Subfactor-specific smart findings (using comprehensive evidence data)
  const smartFindings = {
    structuredDataScore: () => {
      if (!evidence.found || evidence.totalSchemas === 0) {
        const hasOrgData = scanEvidence.technical?.structuredData?.some(sd =>
          sd.type === 'Organization' || sd.type === 'LocalBusiness'
        );
        if (hasOrgData) {
          return `Organization schema found but missing critical schemas. AI assistants need FAQ, Product/Service, and BreadcrumbList schemas to fully understand your ${wordCount > 500 ? 'comprehensive' : ''} content.`;
        }
        return `No structured data (Schema.org) detected on ${domain}. AI assistants cannot understand your business type, services, or content structure. Your ${wordCount} words of content are invisible to entity-based queries.`;
      }
      const schemasFound = scanEvidence.technical?.structuredData?.map(sd => sd.type).join(', ') || 'Unknown';
      const missing = evidence.missingSchemas?.slice(0, 3).join(', ') || 'Organization, FAQ, Article';
      return `Limited structured data found (${evidence.totalSchemas || 0} types: ${schemasFound}). Missing critical schemas: ${missing}. Adding these would help AI assistants cite "${pageTitle}" ${evidence.totalSchemas > 0 ? 'more effectively' : ''}.`;
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
    },

    // Additional enhanced findings with more evidence context
    crawlerAccessScore: () => {
      const hasRobotsTxt = scanEvidence.technical?.robotsMeta || '';
      const hasSitemap = scanEvidence.technical?.hasSitemapLink;
      const canonical = scanEvidence.technical?.hasCanonical;

      const issues = [];
      if (!hasRobotsTxt) issues.push('no robots.txt configuration');
      if (!hasSitemap) issues.push('sitemap not linked');
      if (!canonical) issues.push('missing canonical tags');

      if (issues.length > 0) {
        return `Crawler accessibility issues detected: ${issues.join(', ')}. These barriers prevent AI crawlers from efficiently discovering and indexing your ${wordCount} words of content on "${pageTitle}".`;
      }
      return `Score: ${issue.currentScore}/100. Some crawler access optimizations needed to ensure AI bots can efficiently index all content on ${domain}.`;
    },

    readabilityScore: () => {
      const fleschScore = evidence.fleschScore || issue.currentScore;
      const paragraphCount = scanEvidence.content?.paragraphs?.length || 0;
      const avgSentenceLength = evidence.avgSentenceLength;

      if (fleschScore < 50) {
        return `Content readability is too complex (Flesch score: ${Math.round(fleschScore)}/100). AI assistants prefer content written at 8th-10th grade level for better understanding and citation. Your ${paragraphCount} paragraphs may have overly long sentences${avgSentenceLength ? ` (avg ${Math.round(avgSentenceLength)} words)` : ''}.`;
      }
      return `Readability score: ${Math.round(fleschScore)}/100. Simplifying sentence structure and using clearer language will help AI assistants better understand and cite your content from "${pageTitle}".`;
    },

    scannabilityScore: () => {
      const h2Count = scanEvidence.structure?.headingCount?.h2 || 0;
      const h3Count = scanEvidence.structure?.headingCount?.h3 || 0;
      const listCount = scanEvidence.content?.lists?.length || 0;
      const tableCount = scanEvidence.content?.tables?.length || 0;

      if (h2Count < 3) {
        return `Poor content scannability: Only ${h2Count} H2 headings on ${wordCount} words of content. AI assistants rely on headings to understand content structure and extract key points. Add 3-5 H2 headings to break up your content.`;
      }
      if (listCount === 0 && wordCount > 500) {
        return `Content lacks scannable elements. Your ${wordCount}-word page has ${h2Count} headings but no bulleted/numbered lists. Adding lists helps AI extract key takeaways from "${pageTitle}".`;
      }
      return `Scannability score: ${issue.currentScore}/100. Page has ${h2Count} H2s, ${h3Count} H3s, ${listCount} lists, ${tableCount} tables. More structural elements would help AI better understand and cite your content.`;
    },

    snippetEligibleScore: () => {
      const hasList = (scanEvidence.content?.lists?.length || 0) > 0;
      const hasTable = (scanEvidence.content?.tables?.length || 0) > 0;
      const paragraphCount = scanEvidence.content?.paragraphs?.length || 0;

      if (!hasList && !hasTable && paragraphCount > 5) {
        return `Content on "${pageTitle}" is not formatted for featured snippets. AI assistants prefer: numbered lists (how-to steps), bulleted lists (features/benefits), or tables (comparisons). Your ${paragraphCount} paragraphs are hard to extract.`;
      }
      return `Snippet eligibility score: ${issue.currentScore}/100. Page has ${hasList ? 'lists' : 'no lists'}, ${hasTable ? 'tables' : 'no tables'}. Formatting content for snippet extraction will increase AI citation chances by 3-5x.`;
    },

    linkedSubpagesScore: () => {
      const internalLinks = scanEvidence.structure?.internalLinks || 0;
      const hasBreadcrumbs = scanEvidence.structure?.hasBreadcrumbs;
      const hasTOC = scanEvidence.structure?.hasTOC;

      if (internalLinks < 5) {
        return `Weak internal linking structure: Only ${internalLinks} internal links detected. AI assistants use internal links to understand site hierarchy and related content. Add links to ${hasTOC ? 'expand beyond table of contents' : 'related pages and resources'}.`;
      }
      return `Internal linking: ${internalLinks} links found${hasBreadcrumbs ? ' with breadcrumbs' : ' (no breadcrumbs)'}${hasTOC ? ' and TOC' : ''}. Score: ${issue.currentScore}/100. Stronger linking helps AI understand content relationships.`;
    },

    pillarPagesScore: () => {
      const internalLinks = scanEvidence.structure?.internalLinks || 0;
      const hasTOC = scanEvidence.structure?.hasTOC;

      if (wordCount < 1000) {
        return `"${pageTitle}" is too thin to be a pillar page (${wordCount} words). AI assistants prioritize comprehensive content (1500+ words) with deep topic coverage. ${hasTOC ? 'Table of contents is present but' : 'Add a TOC and'} expand content depth.`;
      }
      if (!hasTOC && wordCount > 2000) {
        return `Long-form content (${wordCount} words) without table of contents. Add a TOC to help AI understand your content structure and navigate to relevant sections for citations.`;
      }
      return `Pillar content score: ${issue.currentScore}/100. Page has ${wordCount} words, ${internalLinks} internal links${hasTOC ? ', and TOC' : ' (no TOC)'}. Strengthen topic depth and internal linking structure.`;
    },

    painPointsScore: () => {
      const questionHeadings = evidence.questionHeadings || 0;
      const faqCount = scanEvidence.content?.faqs?.length || 0;

      if (questionHeadings === 0 && faqCount === 0) {
        return `Content on "${pageTitle}" doesn't address user pain points or questions. No question-format headings or FAQ content detected. AI assistants prioritize content that directly answers user problems.`;
      }
      return `Pain point coverage score: ${issue.currentScore}/100. Page has ${questionHeadings} question headings and ${faqCount} FAQ entries. Add more problem-solution content to improve AI visibility.`;
    },

    openGraphScore: () => {
      const hasOgTitle = !!scanEvidence.metadata?.ogTitle;
      const hasOgDescription = !!scanEvidence.metadata?.ogDescription;
      const hasOgImage = !!scanEvidence.metadata?.ogImage;
      const hasTwitterCard = !!scanEvidence.metadata?.twitterCard;

      const missing = [];
      if (!hasOgTitle) missing.push('og:title');
      if (!hasOgDescription) missing.push('og:description');
      if (!hasOgImage) missing.push('og:image');
      if (!hasTwitterCard) missing.push('twitter:card');

      if (missing.length > 0) {
        return `Social sharing metadata incomplete: Missing ${missing.join(', ')}. When AI assistants or users share "${pageTitle}", it will appear without proper preview. This reduces click-through rates and discoverability.`;
      }
      return `Open Graph tags present but may need optimization. Ensure og:image is high-quality (1200x630px) and og:description is compelling for AI citation previews.`;
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
// CONTEXT-AWARE ACTION STEPS (Industry-Specific)
// ========================================

function generateContextAwareSteps(issue, scanEvidence, industry) {
  const subfactor = issue.subfactor;
  const domain = extractDomain(scanEvidence.url);
  const companyName = extractCompanyName(scanEvidence);
  const evidence = issue.evidence || {};

  // Industry-specific action steps for TOP 10+ subfactors
  const industrySteps = {
    // HIGH PRIORITY: Technical Setup (18% weight)
    structuredDataScore: {
      default: [
        'Run Google\'s Rich Results Test on your homepage to see what\'s currently detected',
        'Implement Organization schema with complete business information (name, logo, contact)',
        `Add ${industry === 'Agency' ? 'Service' : 'Product'} schema for your main offerings`,
        'Implement FAQ schema for your most common customer questions',
        'Validate all markup with Schema.org validator and fix any errors',
        'Submit schema-rich pages to Google Search Console for monitoring'
      ],
      SaaS: [
        'Audit current structured data using Google Rich Results Test',
        'Add Organization schema with company name, logo, and social profiles',
        'Implement SoftwareApplication schema for your product with features, pricing, and reviews',
        'Add HowTo schema for integration guides and tutorials',
        'Include FAQ schema on pricing and product pages',
        'Add aggregate rating schema if you have customer reviews',
        'Validate with Schema.org validator and monitor in Search Console'
      ],
      'E-commerce': [
        'Test your product pages with Google Rich Results Test',
        'Add Organization schema with brand information and social profiles',
        'Implement Product schema for all product pages with price, availability, reviews',
        'Add aggregate rating and review schema for products',
        'Implement BreadcrumbList schema for category navigation',
        'Add FAQPage schema to product detail pages',
        'Monitor rich results performance in Search Console'
      ],
      Agency: [
        'Audit current structured data using Google\'s Rich Results Test',
        'Add Organization schema with agency details, services, and client industries',
        'Implement Service schema for each core service (SEO, PPC, Content, etc.)',
        'Add FAQPage schema for your services and pricing pages',
        'Include aggregate rating schema if you have client testimonials',
        'Add Person schema for team members and leadership',
        'Validate with Schema.org validator and monitor in Search Console'
      ],
      Healthcare: [
        'Test current markup with Google Rich Results Test',
        'Implement MedicalOrganization or Physician schema with credentials',
        'Add MedicalBusiness schema with services, hours, and location',
        'Include FAQPage schema for common patient questions',
        'Add Review schema for patient testimonials (following HIPAA guidelines)',
        'Implement MedicalCondition schema for educational content',
        'Validate all medical markup with Schema.org validator'
      ],
      'Real Estate': [
        'Audit property listings with Google Rich Results Test',
        'Add RealEstateAgent or Organization schema with contact information',
        'Implement Product or Place schema for property listings with price, location, features',
        'Add aggregate rating schema for agent reviews',
        'Include FAQPage schema on listing and about pages',
        'Add BreadcrumbList for property category navigation',
        'Monitor listing performance in Search Console'
      ]
    },

    // HIGH PRIORITY: AI Search Readiness (20% weight)
    faqScore: {
      default: [
        `Review ${companyName || domain}'s customer inquiries and support tickets for common questions`,
        'Identify 5-10 high-value questions your target audience actually asks',
        'Write clear, comprehensive answers (100-250 words each)',
        'Add FAQ schema markup to relevant pages (services, pricing, about)',
        'Test FAQ rich results using Google\'s Rich Results Test',
        'Monitor FAQ performance in Google Search Console'
      ],
      SaaS: [
        'Analyze support tickets and chatbot logs for most common customer questions',
        'Create FAQs around pricing, features, integrations, and setup',
        'Write detailed answers (100-250 words) with screenshots or video demos',
        'Add FAQ schema to pricing page, documentation, and product pages',
        'Focus on "How do I..." and "Can I..." questions for voice search',
        'Test FAQ rich results and monitor click-through rates in Search Console'
      ],
      'E-commerce': [
        'Review customer service inquiries for product, shipping, and return questions',
        'Create FAQs for each product category and popular products',
        'Answer questions about sizing, shipping times, returns, and payment options',
        'Add FAQ schema to product detail pages, category pages, and help center',
        'Include "What is..." and "How to..." questions for product usage',
        'Monitor FAQ rich snippets performance in Search Console'
      ],
      Agency: [
        'Review sales calls and discovery meetings for client questions',
        'Focus on questions about services, process, timeline, and pricing',
        'Write answers that demonstrate expertise and differentiate your agency',
        'Add FAQ schema to services pages, about page, and contact page',
        'Include questions about ROI, deliverables, and case studies',
        'Test FAQ markup and track which questions drive the most traffic'
      ],
      Healthcare: [
        'Compile questions from patient intake forms and phone inquiries',
        'Create FAQs about appointments, insurance, procedures, and preparation',
        'Write clear, jargon-free answers (100-250 words) following HIPAA guidelines',
        'Add FAQ schema to service pages, conditions treated, and contact pages',
        'Focus on "How do I..." questions for appointment scheduling and prep',
        'Monitor FAQ performance and update based on seasonal health trends'
      ]
    },

    questionHeadingsScore: {
      default: [
        'Audit your current headings - how many are in question format?',
        'Rewrite 30-50% of H2/H3 headings as natural questions',
        'Use questions people actually search for (check Google autocomplete)',
        'Start questions with Who, What, When, Where, Why, How',
        'Place questions as H2 headings with answers in following paragraphs',
        'Test voice search compatibility by reading headings out loud'
      ],
      SaaS: [
        'Review your documentation and blog - identify opportunities for question headings',
        'Focus on "How do I...", "Can I...", and "What is..." questions',
        'Examples: "How do I integrate with Salesforce?", "Can I export my data?"',
        'Use question headings in knowledge base articles and tutorials',
        'Test voice search: "Alexa, how do I [your feature]?"',
        'Analyze which question headings drive traffic in Search Console'
      ],
      'E-commerce': [
        'Review product pages and category pages for heading opportunities',
        'Add question headings like "What sizes are available?", "How does shipping work?"',
        'Use questions on blog posts: "Which [product type] is best for [use case]?"',
        'Include buying guide questions: "How to choose the right [product]?"',
        'Test mobile voice search with your question headings',
        'Monitor which questions appear in "People Also Ask" in Google'
      ],
      Agency: [
        'Audit service pages and case studies for question heading opportunities',
        'Use client-focused questions: "How long does [service] take?", "What results can I expect?"',
        'Add questions to blog posts: "When should you hire an agency vs. in-house?"',
        'Include process questions: "How does your discovery process work?"',
        'Test voice search with business-focused questions',
        'Track which questions resonate most with your target audience'
      ]
    },

    // MEDIUM PRIORITY: Content Structure (15% weight)
    altTextScore: {
      default: (() => {
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
      SaaS: (() => {
        const missing = evidence.imagesWithoutAlt || 0;
        return [
          `Audit ${evidence.totalImages || 'all'} images - prioritize screenshots, diagrams, and UI images`,
          missing > 0 ? `Fix ${missing} images without alt text starting with product screenshots` : 'Improve existing alt text quality',
          'For screenshots: Describe what the user sees - "Dashboard showing real-time analytics with conversion graphs"',
          'For diagrams: Explain the concept - "Integration diagram showing data flow between CRM and marketing tools"',
          'For team photos: Include names and roles - "Sarah Chen, Head of Product, presenting at team meeting"',
          'For decorative graphics, use alt="" to avoid cluttering AI responses',
          'Set CMS rules to require alt text for all uploaded images'
        ];
      })()
    },

    headingHierarchyScore: {
      default: [
        'Ensure exactly ONE H1 tag per page with your primary keyword/topic',
        'Use H2 tags for main sections (aim for 3-5 per page)',
        'Use H3 tags for subsections under each H2',
        'Never skip heading levels (e.g., don\'t go H1 → H3)',
        'Review heading structure in HTML or with a heading analyzer tool',
        'Make headings descriptive and meaningful, not just "Introduction" or "Section 1"'
      ],
      SaaS: [
        'Audit your product pages, docs, and blog for heading hierarchy issues',
        'Use ONE H1 per page - typically the page title or main feature name',
        'Structure product pages: H1: Product Name → H2: Features → H3: Specific Feature Details',
        'Documentation: H1: Guide Title → H2: Steps → H3: Substeps or Options',
        'Never skip levels - going H1 → H3 confuses AI about content importance',
        'Make headings scannable: "How to Set Up SSO" not "Setup Instructions"',
        'Use a heading hierarchy tool to visualize and fix structure issues'
      ]
    },

    sitemapScore: {
      default: [
        'Check if sitemap exists at /sitemap.xml',
        'Generate XML sitemap using your CMS or sitemap generator tool',
        'Include all important pages - prioritize core content and service pages',
        'Set appropriate priority (0.0-1.0) and changefreq (daily, weekly, monthly)',
        'Add lastmod dates to show content freshness',
        'Submit sitemap to Google Search Console and Bing Webmaster Tools'
      ],
      SaaS: [
        'Generate comprehensive XML sitemap including product pages, docs, blog, and changelog',
        'Prioritize: Homepage (1.0), Product pages (0.9), Docs (0.8), Blog (0.7)',
        'Set changefreq: Product pages (weekly), Docs (weekly), Blog (monthly)',
        'Include lastmod dates for all pages - critical for showing freshness',
        'Create separate sitemaps for blog and docs if you have 100+ pages',
        'Submit to Google Search Console and monitor indexing status',
        'Update sitemap automatically when publishing new content'
      ],
      'E-commerce': [
        'Create XML sitemap with all product pages, categories, and content pages',
        'Prioritize: Homepage (1.0), Category pages (0.9), Product pages (0.8), Blog (0.6)',
        'Set changefreq based on inventory updates: Products (daily), Categories (weekly)',
        'Include availability changes in lastmod dates',
        'Create separate product sitemap if you have 1000+ SKUs',
        'Submit to Google Search Console, Bing, and shopping search engines',
        'Auto-update sitemap when products are added/removed'
      ]
    },

    crawlerAccessScore: {
      default: [
        'Check robots.txt file - ensure it\'s not blocking important pages',
        'Review meta robots tags - remove "noindex" from pages you want indexed',
        'Test crawler access using Google Search Console URL Inspection tool',
        'Fix any 4xx/5xx errors preventing crawler access',
        'Ensure your server handles crawler bot traffic without rate limiting',
        'Monitor crawl stats in Search Console for crawl errors'
      ],
      SaaS: [
        'Audit robots.txt - ensure marketing pages, blog, docs are crawlable',
        'Allow crawlers for public pages, block: /admin, /app, /dashboard, /api',
        'Check that documentation isn\'t accidentally blocked by authentication',
        'Remove "noindex" from public-facing product pages and help content',
        'Test with Google Search Console: Inspect URL for key pages',
        'Monitor server logs - ensure crawler requests get 200 status codes',
        'Set up robots.txt: Allow: / for all marketing content'
      ]
    },

    authorBiosScore: {
      default: [
        'Create author profile pages for all content creators',
        'Include author credentials, expertise, and relevant experience',
        'Add author bylines to all blog posts and articles',
        'Implement Person schema markup for each author',
        'Link author bios to social media profiles (LinkedIn, Twitter)',
        'Update existing content to include author information'
      ],
      Agency: [
        'Create comprehensive team member profiles with bios and credentials',
        'Highlight relevant certifications (Google Ads, HubSpot, etc.)',
        'Add author bylines to all blog posts and case studies',
        'Implement Person schema with job titles, expertise areas, and social profiles',
        'Include years of experience and notable client work',
        'Link each team member to their LinkedIn and portfolio',
        'Add testimonials or quotes from clients about specific team members'
      ],
      Healthcare: [
        'Create detailed provider profiles with medical credentials and specializations',
        'Include education, certifications, board certifications, and years in practice',
        'Add provider bylines to all medical content and health articles',
        'Implement Physician schema with medical specialty and affiliations',
        'Include professional photos and biographies',
        'Link to medical association profiles (Healthgrades, WebMD)',
        'Add patient reviews and ratings (following HIPAA guidelines)'
      ]
    },

    geoContentScore: {
      default: [
        'Add location-specific content to relevant pages',
        'Include city/region names in headings and content naturally',
        'Create location pages for each service area',
        'Add "near me" optimized content',
        'Include local landmarks and neighborhood references',
        'Add geographic schema markup (address, service areas)'
      ],
      'Real Estate': [
        'Create dedicated pages for each neighborhood and zip code you serve',
        'Include local market data, school ratings, and community information',
        'Add neighborhood names to property listing titles and descriptions',
        'Create "Homes for Sale in [Neighborhood]" landing pages',
        'Include local landmarks, parks, shopping centers in property descriptions',
        'Add geo-specific schema: address, latitude/longitude, service radius',
        'Write blog posts about local market trends and neighborhood spotlights'
      ],
      'Local Services': [
        'Add city/town names to service pages and page titles',
        'Create separate pages for each service area with unique local content',
        'Include local customer testimonials with city mentions',
        'Add "near me" content: "Plumber near Downtown [City]"',
        'Reference local landmarks in directions and service descriptions',
        'Implement LocalBusiness schema with service areas and geo-coordinates',
        'Create local blog content about community events and partnerships'
      ]
    },

    captionsTranscriptsScore: {
      default: [
        'Audit all video content - identify videos without transcripts/captions',
        'Use video platform auto-captioning (YouTube, Vimeo) as starting point',
        'Edit auto-generated captions for accuracy (critical for brand terms)',
        'Add full text transcripts below each video',
        'Include speaker names and timestamps in transcripts',
        'Add transcript download option (PDF) for accessibility'
      ],
      SaaS: [
        `Audit product demos, tutorials, and webinars - ${evidence.videoCount || 'all videos'} need transcripts`,
        'Use YouTube or Vimeo auto-captioning, then edit for technical accuracy',
        'Ensure product names, feature names, and technical terms are spelled correctly',
        'Add full transcripts to video landing pages below the player',
        'Include speaker names and timestamps for multi-speaker content',
        'Create searchable transcript index for long-form webinars',
        'Add transcripts to docs site for SEO and AI citation potential'
      ]
    }
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

  // Extract real data from scan evidence
  const companyName = extractCompanyName(scanEvidence);
  const location = extractLocationData(scanEvidence);
  const contact = extractContactInfo(scanEvidence);
  const socialProfiles = extractSocialProfiles(scanEvidence);

  // Generate industry and evidence-aware code
  const codeSnippets = {
    structuredDataScore: () => {
      const description = scanEvidence.metadata?.description ||
        (industry ? `Professional ${industry} services and solutions` : 'Your company description');

      // Build address object only if we have real data
      const addressLines = [];
      if (location.street) {
        addressLines.push(`    "streetAddress": "${location.street}",`);
      }
      if (location.city) {
        addressLines.push(`    "addressLocality": "${location.city}",`);
      }
      if (location.state) {
        addressLines.push(`    "addressRegion": "${location.state}",`);
      }
      if (location.zip) {
        addressLines.push(`    "postalCode": "${location.zip}",`);
      }
      addressLines.push(`    "addressCountry": "${location.country || 'US'}"`);

      // Build contact point
      const contactLines = [];
      if (contact.phone) {
        contactLines.push(`    "telephone": "${contact.phone}",`);
      }
      contactLines.push(`    "contactType": "Customer Service"`);
      if (contact.email) {
        contactLines.push(`,\n    "email": "${contact.email}"`);
      }

      // Build social profiles
      let socialLines = '';
      if (socialProfiles.length > 0) {
        socialLines = `,\n  "sameAs": [\n${socialProfiles.map(url => `    "${url}"`).join(',\n')}\n  ]`;
      } else {
        socialLines = `,\n  "sameAs": [\n    "[Add your LinkedIn URL]",\n    "[Add your Twitter/X URL]",\n    "[Add your Facebook URL]"\n  ]`;
      }

      return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${companyName || domain}",
  "url": "${url}",
  "logo": "${url}/logo.png",
  "description": "${description}",
  "address": {
    "@type": "PostalAddress",
${addressLines.join('\n')}
  },
  "contactPoint": {
    "@type": "ContactPoint",
${contactLines.join('\n')}
  }${socialLines}
}
</script>

<!-- Implementation notes:
1. Update logo path if different from /logo.png
${!location.street ? '2. Add your complete business address\n' : ''}${!contact.phone ? '3. Add your business phone number\n' : ''}${socialProfiles.length === 0 ? '4. Add your social media profile URLs\n' : ''}-->`;
    },
    
    faqScore: () => {
      // Extract actual FAQ content from the page if available
      const pageFAQs = scanEvidence.content?.faqs || [];
      const detectedQuestions = evidence.detectedQuestions || [];

      let faqEntries = [];

      // Use actual FAQ content from page if available
      if (pageFAQs.length > 0) {
        faqEntries = pageFAQs.slice(0, 3).map(faq => ({
          question: faq.question,
          answer: faq.answer
        }));
      } else if (detectedQuestions.length > 0) {
        // Use detected question headings
        faqEntries = detectedQuestions.slice(0, 3).map(q => ({
          question: q,
          answer: '[Write your detailed answer here (100-250 words)]'
        }));
      } else {
        // Generate industry-relevant sample questions
        const sampleQuestions = {
          'SaaS': `What features does ${companyName || domain} offer?`,
          'E-commerce': `What is your shipping and return policy?`,
          'Healthcare': `How do I schedule an appointment?`,
          'Legal': `What types of legal services do you provide?`,
          'Financial': `How do I open an account?`,
          'Agency': `What services does ${companyName || domain} provide?`,
          'Real Estate': `How can I schedule a property viewing?`
        };
        const defaultQuestion = sampleQuestions[industry] || `What services does ${companyName || domain} provide?`;
        faqEntries = [{ question: defaultQuestion, answer: '[Write your detailed answer here (100-250 words)]' }];
      }

      const faqJSON = faqEntries.map((faq, idx) => `    {
      "@type": "Question",
      "name": "${faq.question}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${faq.answer}"
      }
    }`).join(',\n');

      return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
${faqJSON}
  ]
}
</script>

<!-- Best practices:
- Add this schema to pages with Q&A content (${url}/faq, ${url}/services, ${url}/pricing)
- Each answer should be 100-250 words for optimal AI citation
- Focus on questions your customers actually ask
${pageFAQs.length > 0 ? '- ✓ Your page already has FAQ content - just add the schema markup!' : '- Create FAQ content based on common customer questions'}
-->`;
    },
    
    altTextScore: () => {
      // Get actual images from the page
      const images = scanEvidence.media?.images || [];
      const imagesWithoutAlt = images.filter(img => !img.hasAlt || !img.alt);
      const totalImages = scanEvidence.media?.imageCount || 0;
      const missingAltCount = scanEvidence.media?.imagesWithoutAlt || 0;

      // Generate industry-specific example alt text
      const industryExamples = {
        'SaaS': 'Dashboard screenshot showing analytics and reporting features',
        'E-commerce': 'Product photo of wireless headphones in matte black finish',
        'Healthcare': 'Medical professional consulting with patient in modern clinic',
        'Legal': 'Attorneys reviewing legal documents in conference room',
        'Financial': 'Financial advisor explaining investment portfolio to client',
        'Agency': 'Marketing team collaborating on digital strategy in modern office',
        'Real Estate': 'Luxury living room with hardwood floors and natural lighting'
      };
      const exampleAlt = industryExamples[industry] || 'Professional team working together on business solutions';

      let examplesSection = '';
      if (imagesWithoutAlt.length > 0 && imagesWithoutAlt.length <= 10) {
        examplesSection = `\n<!-- Your images missing alt text: -->\n` +
          imagesWithoutAlt.slice(0, 5).map(img =>
            `<img src="${img.src}" alt="[Describe: what's shown in this image?]" loading="lazy">`
          ).join('\n');
      } else if (missingAltCount > 10) {
        examplesSection = `\n<!-- You have ${missingAltCount} images missing alt text. Prioritize: -->\n` +
          `<!-- 1. Hero images and banners -->\n` +
          `<!-- 2. Product/service images -->\n` +
          `<!-- 3. Team photos and testimonials -->\n` +
          `<!-- 4. Infographics and diagrams -->`;
      }

      return `<!-- ❌ BAD: Generic or missing alt text -->
<img src="/images/hero.jpg" alt="image">
<img src="/images/team.jpg" alt="">
<img src="/images/product.jpg" alt="photo">

<!-- ✅ GOOD: Descriptive alt text that AI can understand -->
<img src="/images/hero.jpg"
     alt="${exampleAlt}"
     loading="lazy">

<!-- Alt text best practices: -->
<!-- 1. Describe what's IN the image (not just "image" or "photo") -->
<!-- 2. Include relevant context (who, what, where) -->
<!-- 3. Keep it concise (10-15 words) -->
<!-- 4. Don't start with "Image of..." or "Picture of..." -->
<!-- 5. For decorative images, use alt="" to tell AI to skip -->
${examplesSection}

<!-- Impact: ${totalImages} total images, ${missingAltCount} missing alt text (${totalImages > 0 ? Math.round((totalImages - missingAltCount) / totalImages * 100) : 0}% coverage) -->`;
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

/**
 * Extract company/brand name from various evidence sources
 */
function extractCompanyName(scanEvidence) {
  if (!scanEvidence) return null;

  // Try multiple sources in priority order
  const sources = [
    // From structured data (most reliable)
    scanEvidence.technical?.structuredData?.find(sd => sd.type === 'Organization')?.raw?.name,
    scanEvidence.technical?.structuredData?.find(sd => sd.type === 'LocalBusiness')?.raw?.name,

    // From Open Graph tags
    scanEvidence.metadata?.ogTitle,

    // From page title (extract brand name - usually after | or -)
    scanEvidence.metadata?.title?.split(/[|\-–—]/)[0]?.trim(),

    // From domain (fallback)
    extractDomain(scanEvidence.url)?.split('.')[0]?.replace(/-/g, ' ')
      ?.split(' ')
      ?.map(w => w.charAt(0).toUpperCase() + w.slice(1))
      ?.join(' ')
  ];

  // Return first non-empty value
  for (const source of sources) {
    if (source && source.length > 0 && source.length < 100) {
      return source;
    }
  }

  return extractDomain(scanEvidence.url);
}

/**
 * Extract location/address data from evidence
 */
function extractLocationData(scanEvidence) {
  if (!scanEvidence) return {};

  const location = {};

  // From structured data
  const orgSchema = scanEvidence.technical?.structuredData?.find(sd =>
    sd.type === 'Organization' || sd.type === 'LocalBusiness'
  );

  if (orgSchema?.raw?.address) {
    const addr = orgSchema.raw.address;
    location.street = addr.streetAddress || '';
    location.city = addr.addressLocality || '';
    location.state = addr.addressRegion || '';
    location.zip = addr.postalCode || '';
    location.country = addr.addressCountry || '';
  }

  // From meta tags
  if (!location.city && scanEvidence.metadata?.geoPlacename) {
    location.city = scanEvidence.metadata.geoPlacename;
  }
  if (!location.state && scanEvidence.metadata?.geoRegion) {
    location.state = scanEvidence.metadata.geoRegion;
  }

  return location;
}

/**
 * Extract contact information from evidence
 */
function extractContactInfo(scanEvidence) {
  if (!scanEvidence) return {};

  const contact = {};

  // From structured data
  const orgSchema = scanEvidence.technical?.structuredData?.find(sd =>
    sd.type === 'Organization' || sd.type === 'LocalBusiness'
  );

  if (orgSchema?.raw) {
    contact.phone = orgSchema.raw.telephone || orgSchema.raw.contactPoint?.telephone || '';
    contact.email = orgSchema.raw.email || orgSchema.raw.contactPoint?.email || '';
  }

  // Generate default email from domain if not found
  if (!contact.email) {
    contact.email = `info@${extractDomain(scanEvidence.url)}`;
  }

  return contact;
}

/**
 * Extract social media profiles from structured data
 */
function extractSocialProfiles(scanEvidence) {
  if (!scanEvidence) return [];

  const orgSchema = scanEvidence.technical?.structuredData?.find(sd =>
    sd.type === 'Organization' || sd.type === 'LocalBusiness'
  );

  return orgSchema?.raw?.sameAs || [];
}

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