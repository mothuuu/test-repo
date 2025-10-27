// backend/analyzers/recommendation-engine/rec-generator.js

require('dotenv').config();

/**
 * RECOMMENDATION GENERATOR - LIBRARY-FIRST + PROGRAMMATIC JSON-LD + CHATGPT + SMART TEMPLATES
 * Priority Strategy:
 * 1) Curated Library (future / optional)
 * 2) Programmatic output where deterministic (structured data, OG tags, question headings)
 * 3) ChatGPT (high quality copy where needed)
 * 4) Smart Templates (free tier or fallback)
 */

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ✅ FAQ library + customizer (present but optional right now)
// (You can wire these into faqScore later to make it fully programmatic)
const { loadFaqsByIndustry, loadGenericFaqs } = require('./faq-library-loader');
const { customizeFaqItem } = require('./faq-customizer');

// -----------------------------------------
// Inline helpers (no external file imports)
// -----------------------------------------

const SITE_TYPES = new Set(['single_page','small_multi','multi','blog','saas','local_business']);

function normalizeEvidence(raw = {}) {
  const profileRaw = raw.detected_profile || raw.profile || {};
  const factsRaw = raw.extracted_facts || raw.facts || [];

  const profile = {
    site_type: SITE_TYPES.has(profileRaw.site_type) ? profileRaw.site_type : 'small_multi',
    routes_count: Number(profileRaw.routes_count || 1),
    anchors: Array.isArray(profileRaw.anchors) ? profileRaw.anchors : [],
    sections: typeof profileRaw.sections === 'object' && profileRaw.sections !== null ? profileRaw.sections : {}
  };

  // facts as [{name, value, selector?, confidence?}]
  const facts = Array.isArray(factsRaw) ? factsRaw.filter(f => f && f.name) : [];

  return { profile, facts };
}

function factValue(facts, name, fallback = undefined) {
  const f = facts.find(x => x.name === name);
  return f ? f.value : fallback;
}

function absolute(origin, maybeUrl) {
  try { return new URL(maybeUrl, origin).href; } catch { return undefined; }
}

function buildCoreJsonLd(pageUrl, facts) {
  const origin = new URL(pageUrl).origin;
  const brand = factValue(facts, 'brand') || factValue(facts, 'site_name') || origin.replace(/^https?:\/\/(www\.)?/,'');
  const logo = factValue(facts, 'logo');
  const desc = factValue(facts, 'description');
  const socials = factValue(facts, 'social_links', []);

  const orgId = `${origin}/#organization`;
  const siteId = `${origin}/#website`;
  const pageId = `${pageUrl.replace(/#.*$/,'')}/#webpage`;

  const Organization = {
    "@context":"https://schema.org",
    "@type":"Organization",
    "@id": orgId,
    "name": brand,
    "url": origin,
    ...(logo ? { "logo": { "@type":"ImageObject", "url": absolute(origin, logo) }} : {}),
    ...(Array.isArray(socials) && socials.length ? { "sameAs": socials } : {})
  };

  const WebSite = {
    "@context":"https://schema.org",
    "@type":"WebSite",
    "@id": siteId,
    "url": origin,
    "name": brand,
    "publisher": { "@id": orgId }
  };

  const WebPage = {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "@id": pageId,
    "url": pageUrl,
    "isPartOf": { "@id": siteId },
    ...(desc ? { "description": desc } : {})
  };

  return [Organization, WebSite, WebPage];
}

function buildFAQJsonLd(pageUrl, qaPairs = []) {
  if (!Array.isArray(qaPairs) || !qaPairs.length) return null;
  return {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    "@id": `${pageUrl.replace(/#.*$/,'')}/#faq`,
    "mainEntity": qaPairs.map(({q,a}) => ({
      "@type":"Question",
      "name": q,
      "acceptedAnswer": { "@type":"Answer", "text": a }
    }))
  };
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./,''); } catch { return 'your-domain.com'; }
}

// -----------------------------------------
// Static templates (titles, difficulty, etc.)
// -----------------------------------------

// Category display names (matching V5 rubric)
const CATEGORY_NAMES = {
  aiReadability: 'AI Readability',
  aiSearchReadiness: 'AI Search Readiness',
  contentFreshness: 'Content Freshness',
  contentStructure: 'Content Structure',
  speedUX: 'Speed & UX',
  technicalSetup: 'Technical Setup',
  trustAuthority: 'Trust & Authority',
  voiceOptimization: 'Voice Optimization'
};

// Subfactor display names (user-friendly)
const SUBFACTOR_NAMES = {
  structuredDataScore: 'Schema Markup',
  organizationSchema: 'Organization Schema',
  productSchema: 'Product Schema',
  faqScore: 'FAQ Schema',
  questionHeadingsScore: 'Question-Based Headings',
  openGraphScore: 'Open Graph & Social Meta Tags',
  headingHierarchyScore: 'Heading Structure',
  contentDepthScore: 'Content Depth',
  scannabilityScore: 'Content Scannability',
  geoContentScore: 'Location & Geographic Content',
  readabilityScore: 'Readability & Clarity',
  sitemapScore: 'XML Sitemap',
  robotsTxtScore: 'Robots.txt Configuration',
  httpsScore: 'HTTPS Security',
  crawlAccessibilityScore: 'Crawl Accessibility'
};

const RECOMMENDATION_TEMPLATES = {
  structuredDataScore: {
    title: "Implement Structured Data Schema",
    impactArea: "AI Understanding & Rich Results",
    whyItMatters: "Structured data tells AI assistants exactly what your content is about, increasing citation chances by 3–5x.",
    typicalTimeToFix: "1–2 hours",
    difficulty: "Easy",
    estimatedGain: 18
  },
  faqScore: {
    title: "Add FAQ Schema Markup",
    impactArea: "Voice Search & Featured Snippets",
    whyItMatters: "FAQ schema helps your answers surface in AI-generated results and voice search.",
    typicalTimeToFix: "1–2 hours",
    difficulty: "Easy",
    estimatedGain: 12
  },
  altTextScore: {
    title: "Complete Image Alt Text Coverage",
    impactArea: "Multimodal AI & Accessibility",
    whyItMatters: "Alt text enables AI to understand and reference your images in multimodal search.",
    typicalTimeToFix: "1–2 hours",
    difficulty: "Easy",
    estimatedGain: 8
  },
  openGraphScore: {
    title: "Add Open Graph & Twitter Card meta tags",
    impactArea: "Social Sharing & Entity Cards",
    whyItMatters: "Ensures rich previews across social/AI surfaces and better CTR from shares.",
    typicalTimeToFix: "15–30 minutes",
    difficulty: "Easy",
    estimatedGain: 8
  }
};

// -----------------------------------------
// Public entry
// -----------------------------------------

async function generateRecommendations(issues, scanEvidence, tier = 'free', industry = null) {
  console.log(`   🎯 Generating recommendations for ${issues?.length || 0} issues (tier=${tier})`);
  if (!Array.isArray(issues) || !issues.length) return [];

  const BATCH_SIZE = 5;
  const issuesToProcess = issues.slice(0, BATCH_SIZE);
  const out = [];

  for (const issue of issuesToProcess) {
    try {
      // 1) Curated library (placeholder for future)
      const libraryRec = await checkRecommendationLibrary(issue, industry);
      if (libraryRec) {
        out.push(await customizeLibraryRecommendation(libraryRec, issue, scanEvidence, tier));
        continue;
      }

      // 2) HIGH-VALUE PROGRAMMATIC GENERATORS (run FIRST - these have rich, pre-written content)
      // These take precedence over ChatGPT for consistency and quality

      // 2a) FAQ Schema - Rich, ready-to-use FAQ content
      if (issue.subfactor === 'faqScore') {
        console.log(`✅ Detected faqScore issue - calling programmatic FAQ generator`);
        const rec = makeProgrammaticFAQRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ FAQ recommendation generated successfully`);
          console.log(`🔍 FAQ GENERATOR RETURNED:`, {
            title: rec.title?.substring(0, 50),
            category: rec.category,
            subfactor: rec.subfactor,
            hasCustomizedImplementation: !!rec.customizedImplementation,
            hasReadyToUseContent: !!rec.readyToUseContent,
            hasImplementationNotes: !!rec.implementationNotes,
            hasQuickWins: !!rec.quickWins,
            hasValidationChecklist: !!rec.validationChecklist,
            customizedImplLength: rec.customizedImplementation?.length || 0,
            readyToUseLength: rec.readyToUseContent?.length || 0,
            implementationNotesLength: Array.isArray(rec.implementationNotes) ? rec.implementationNotes.length : 0,
            quickWinsLength: Array.isArray(rec.quickWins) ? rec.quickWins.length : 0,
            validationChecklistLength: Array.isArray(rec.validationChecklist) ? rec.validationChecklist.length : 0
          });
          out.push(rec);
          continue;
        } else {
          console.log(`❌ FAQ generator returned null/undefined`);
        }
      }

      // 2b) Alt Text - Image accessibility
      if (issue.subfactor === 'altTextScore') {
        console.log(`✅ Detected altTextScore issue - calling programmatic alt text generator`);
        const rec = makeProgrammaticAltTextRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ Alt text recommendation generated successfully`);
          out.push(rec);
          continue;
        }
      }

      // 2c) Scannability - Content formatting
      if (issue.subfactor === 'scannabilityScore') {
        console.log(`✅ Detected scannabilityScore issue - calling programmatic scannability generator`);
        const rec = makeProgrammaticScannabilityRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ Scannability recommendation generated successfully`);
          out.push(rec);
          continue;
        }
      }

      // 2d) Captions/Transcripts - Video accessibility
      if (issue.subfactor === 'captionsTranscriptsScore') {
        console.log(`✅ Detected captionsTranscriptsScore issue - calling programmatic transcripts generator`);
        const rec = makeProgrammaticCaptionsTranscriptsRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ Transcripts recommendation generated successfully`);
          out.push(rec);
          continue;
        }
      }

      // 2e) IndexNow - Instant indexing
      if (issue.subfactor === 'indexNowScore') {
        console.log(`✅ Detected indexNowScore issue - calling programmatic IndexNow generator`);
        const rec = makeProgrammaticIndexNowRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ IndexNow recommendation generated successfully`);
          out.push(rec);
          continue;
        }
      }

      // 2f) Location & Geographic Content - AEO-optimized service areas
      if (issue.subfactor === 'geoContentScore') {
        console.log(`✅ Detected geoContentScore issue - calling programmatic location/geographic generator`);
        const rec = makeProgrammaticGeoContentRecommendation(issue, scanEvidence, industry);
        if (rec) {
          console.log(`✅ Location/geographic recommendation generated successfully`);
          out.push(rec);
          continue;
        }
      }

      // 2g) Structured Data - Deterministic JSON-LD
      if (issue.subfactor === 'structuredDataScore') {
        const rec = makeProgrammaticStructuredDataRecommendation(issue, scanEvidence);
        out.push(rec);
        continue;
      }

      // 2c) Open Graph - Programmatic meta tags
      if (issue.subfactor === 'openGraphScore') {
        const rec = makeProgrammaticOpenGraphRecommendation(issue, scanEvidence);
        if (rec) { out.push(rec); continue; }
      }

      // 2d) Question Headings - Programmatic suggestions with ChatGPT intelligence
      if (issue.subfactor === 'questionHeadingsScore') {
        const rec = await makeProgrammaticQuestionHeadingsRecommendation(issue, scanEvidence, industry);
        if (rec) { out.push(rec); continue; }
      }

      // 3) ChatGPT for other subfactors (DIY/Pro tier)
      if (tier !== 'free' && process.env.OPENAI_API_KEY) {
        const gptRec = await generateWithChatGPT(issue, scanEvidence, tier, industry);
        out.push(gptRec);
        continue;
      }

      // 4) Smart template fallback
      out.push(generateSmartTemplate(issue, scanEvidence, tier, industry));

    } catch (err) {
      console.error(`   ⚠️  Failed for subfactor=${issue.subfactor}:`, err?.response?.data || err.message);
      out.push(generateSmartTemplate(issue, scanEvidence, tier, industry));
    }
  }

  // Optional: quick visibility into what we are about to save
  console.log('   — Recommendation lengths (finding/impact/code):');
  for (const r of out) {
    const f = (r.finding || '').length;
    const i = (r.impact || '').length;
    const c = (r.codeSnippet || '').length;
    console.log(`     • ${r.subfactor}: f=${f} i=${i} c=${c} steps=${r.actionSteps?.length || 0}`);
  }

  console.log('   ✅ Final recommendations count:', out.length);
  return out;
}

// -----------------------------------------
// Library placeholders (wire these up later if you like)
// -----------------------------------------

async function checkRecommendationLibrary(_issue, _industry) { return null; }
async function customizeLibraryRecommendation(libraryRec, issue, _scanEvidence, _tier) {
  return { ...libraryRec, currentScore: issue.currentScore, targetScore: issue.threshold, generatedBy: 'library' };
}

// -----------------------------------------
// GPT path (used for non-deterministic copy)
// -----------------------------------------

async function generateWithChatGPT(issue, scanEvidence, tier, industry) {
  const template = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility.",
    typicalTimeToFix: "Varies",
    difficulty: "Medium",
    estimatedGain: 10
  };

  const prompt = buildChatGPTPrompt(issue, scanEvidence, template, tier, industry);

  let gptResponse = '';
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: (tier === 'diy' ? 1800 : 3000),
      messages: [
        { role: 'system', content: 'You are an AEO expert. Return concrete step-by-step instructions and avoid generic advice.' },
        { role: 'user', content: prompt }
      ]
    });

 // 🔍 DEBUG: Log token usage
    console.log('🔍 TOKEN USAGE:', resp.usage);
    console.log('🔍 Response length:', resp.choices?.[0]?.message?.content?.length, 'chars');
    console.log('🔍 Finish reason:', resp.choices?.[0]?.finish_reason);

    gptResponse = resp.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('OpenAI error:', e?.response?.data || e.message);
    // fall back to template
    return generateSmartTemplate(issue, scanEvidence, tier, industry);
  }

  // Package result (we parse bracketed sections)
  const rec = structureRecommendation(gptResponse, issue, template, tier, 'chatgpt');
  return coerceRecommendation(rec, template, issue);
}

function buildChatGPTPrompt(issue, scanEvidence, template, tier, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);

  const siteShape = buildSiteShapeDescription(profile);
  const factsSection = buildFactsSection(facts);
  const scoreBreakdown = calculateScoreBreakdown(issue);
  const neededSchemas = determineNeededSchemas(issue, profile, scanEvidence);

  // Get category and subfactor display names
  const categoryName = CATEGORY_NAMES[issue.category] || issue.category;
  const subfactorName = SUBFACTOR_NAMES[issue.subfactor] || issue.subfactor;

  // Build list of EXISTING schemas to explicitly exclude from recommendations
  const existingSchemas = [];
  if (scanEvidence.technical?.hasOrganizationSchema) existingSchemas.push('Organization');
  if (scanEvidence.technical?.hasFAQSchema) existingSchemas.push('FAQPage');
  if (scanEvidence.technical?.hasLocalBusinessSchema) existingSchemas.push('LocalBusiness');
  if (scanEvidence.technical?.hasArticleSchema) existingSchemas.push('Article/BlogPosting');
  if (scanEvidence.technical?.hasBreadcrumbSchema) existingSchemas.push('BreadcrumbList');
  const existingSchemasText = existingSchemas.length > 0
    ? `\n\n**EXISTING SCHEMAS (DO NOT RECOMMEND ADDING THESE):**\n✅ ${existingSchemas.join('\n✅ ')}\n- These schemas are ALREADY IMPLEMENTED on the site\n- DO NOT recommend adding these schemas again\n- Focus only on schemas that are MISSING`
    : '';

  return `You are an AI Search Optimization expert generating PRESCRIPTIVE, ready-to-implement recommendations.

**WEBSITE ANALYSIS**
URL: ${scanEvidence.url}
Industry: ${industry || 'General'}
Category: ${categoryName}
Issue: ${subfactorName} (${issue.currentScore}/100)

**SITE SHAPE DETECTED**
${siteShape}

**EXTRACTED FACTS**
${factsSection}

**CURRENT STATE**
${buildCurrentState(issue, scanEvidence)}${existingSchemasText}

**SCORE BREAKDOWN**
Current: ${issue.currentScore}/100
Target: ${issue.threshold}/100
Gap: ${issue.gap} points
Projected Impact: +${scoreBreakdown.min}-${scoreBreakdown.max} points
- Coverage (40%): ${scoreBreakdown.coverage}
- Completeness (30%): ${scoreBreakdown.completeness}
- Consistency (20%): ${scoreBreakdown.consistency}
- Crawlability (10%): ${scoreBreakdown.crawlability}

---
Generate the following sections with concrete, non-generic content:

[TITLE]
Format: "${categoryName}: ${subfactorName}"
- Use this EXACT format with the category and subfactor names provided above
- Example: "AI Search Readiness: Product Schema"
- Example: "Technical Setup: Organization Schema"

[FINDING]
Provide a detailed, specific finding with:
1. Status line: "Status: Missing" or "Status: Incomplete" or "Status: Needs Improvement"
2. Specific observation based on EXTRACTED FACTS
3. List of detected items (products, services, features, pages, etc.) with bullet points
4. Include actual numbers and metrics from CURRENT STATE

Example format:
Status: Missing
Multiple products mentioned but no Product schema detected:
• ThinkSystem SR675 V3 server (up to 8 NVIDIA GPUs)
• Lenovo Neptune Liquid Cooling technology
• NVIDIA H100 NVL, H200 NVL GPUs

[IMPACT]
Write 1-2 sentences explaining the business impact in plain language.
- Focus on how this affects search engines, AI assistants, and user discovery
- Mention specific visibility/ranking/citation impacts
- Example: "Search engines and AI cannot understand product specifications, pricing context, or purchase intent signals."

[APPLY INSTRUCTIONS]
CRITICAL: Format as a FLAT numbered list of actionable steps (5-7 steps maximum).
- Each step must be a complete, self-contained instruction
- NO nested bullets, NO sub-sections, NO "Steps: a) b) c)" format
- Include file names, specific actions, and validation in each step
- Do not use raw HTML tags like <h1> or <head>; write them as: h1, h2, head

GOOD Example:
1. Open your homepage template file (e.g., index.html) in your code editor.
2. Locate the head section at the top of the HTML file.
3. Paste the meta tags from the CODE section below into the head, just before the closing /head tag.
4. Save the file and upload to your server.
5. Validate using Facebook Sharing Debugger at developers.facebook.com/tools/debug/.

BAD Example (DO NOT USE):
1. Add FAQ Section:
   - File: index.html
   - Steps: a) Create page b) Add questions
   - Validation: Check menu

DO NOT include any code blocks in this section. Put all code in [CODE].

${tier !== 'free' && neededSchemas.length ? `
[PRE-FILLED JSON-LD]
CRITICAL: Pre-fill ALL fields with actual data from EXTRACTED FACTS above.
- DO NOT use placeholders like [Your Company Name] or [INSERT X]
- Use actual brand name, products, services, contact info from the facts
- If data is missing from facts, omit that field entirely
- Use stable @ids like ${scanEvidence.url}/#organization
- Link schemas (Organization → logo, WebSite → publisher)
- For multiple products/services, generate schema for EACH ONE detected
- Required schemas:
${neededSchemas.map((s, i) => `${i + 1}. ${s.type} — use: ${s.useData}`).join('\n')}

Example of pre-filled Product schema:
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "ThinkSystem SR675 V3",
  "brand": { "@type": "Brand", "name": "Lenovo" },
  "description": "Up to 8 NVIDIA H100/H200 NVL GPUs",
  ...
}

Then repeat for each product detected.
` : ''}

[CODE]
- If any code is required (HTML/JSON-LD/meta tags), include ONLY here
- PRE-FILL with actual data from EXTRACTED FACTS (no placeholders!)
- Use the smallest working snippet
- For schema markup, generate separate blocks for EACH item detected

[QUICK WINS]
- 2 or 3 actionable wins based on detected profile/sections.

Output ONLY the following sections in this exact order, each starting on its own line:

[TITLE]
[FINDING]
[IMPACT]
[APPLY INSTRUCTIONS]
[CODE]
[QUICK WINS]
[END]

Rules:
- Do NOT include any additional commentary outside these sections.
- Put ALL code (HTML/JSON-LD/meta tags) ONLY in [CODE].
- Do NOT include code fences (no triple backticks) inside [APPLY INSTRUCTIONS]. Use [CODE] for code fences.
- Keep each section concise and specific.`;
}

// -----------------------------------------
// Programmatic recommendations (deterministic)
// -----------------------------------------

// Industry-specific FAQ libraries (rich, ready-to-use content)
const FAQ_LIBRARIES = {
  Agency: {
    title: "AI Search Readiness: FAQ Section",
    questions: [
      {
        q: "How do you measure and report on marketing ROI?",
        pageAnswer: "We connect every initiative to outcomes like revenue, qualified pipeline, and CAC. You'll get transparent reports that show which channels drive results, plus a live dashboard so you always know what's working.",
        schemaAnswer: "We connect marketing activity to outcomes like qualified pipeline, revenue influence, and CAC. Our approach uses multi-touch attribution where feasible and clear performance tracking across channels, with scheduled reports and a live dashboard."
      },
      {
        q: "What makes your agency different from others?",
        pageAnswer: "We're an AI-first, B2B marketing partner specialized in your industry vertical. Instead of generic tactics, we use answer-engine optimization and AI-readable content to help the right buyers find, understand, and trust you.",
        schemaAnswer: "We are an AI-first, B2B-focused team specializing in answer-engine optimization (AEO) and AI-readable content so assistants can accurately match you to high-fit intent, not generic searches."
      },
      {
        q: "How long until we see results?",
        pageAnswer: "Quick wins (e.g., conversion improvements, qualified demos) typically appear within weeks; durable gains from programs like content/AEO build over a few months. We set expectations up front and report progress on a regular cadence.",
        schemaAnswer: "Tactical improvements (e.g., conversion lifts) can appear within weeks; strategic programs like content/AEO typically show meaningful, compounding results over several months. We set milestones and report progress regularly."
      },
      {
        q: "What does it cost to work with you?",
        pageAnswer: "Investment depends on scope and goals. We share a clear proposal with deliverables and reporting so you can see value-for-spend and make decisions with confidence.",
        schemaAnswer: "Investment varies by scope and goals. We share transparent proposals with deliverables, reporting, and success metrics so you can evaluate value-for-spend and expected outcomes."
      },
      {
        q: "Do you require long-term contracts?",
        pageAnswer: "We prefer flexible terms and aim to earn your renewal with results—not lock-ins. We set clear goals, deliverables, and review cadence so you always know where we stand.",
        schemaAnswer: "We favor flexible terms and aim to earn ongoing partnership through results. Engagements include clear deliverables, communication cadence, and success metrics with reasonable cancellation notice."
      }
    ],
    impact: "FAQs consistently surface in rich results and AI answers. Adding a focused set of agency FAQs improves entity clarity, reduces pre-sales friction, and qualifies leads earlier.",
    quickWins: [
      "Link the FAQ headings in-page (anchor links) and from your Help/Resources menu",
      "Add the FAQ page to your sitemap and include it in your internal linking from Services and Pricing pages",
      "Reuse these Q&As in your chatbot prompts and Answer Engine optimization"
    ]
  },
  SaaS: {
    title: "AI Search Readiness: FAQ Section",
    questions: [
      {
        q: "How does pricing work?",
        pageAnswer: "We offer flexible pricing based on your team size and feature needs. Start with our free plan to test core features, then upgrade to unlock advanced capabilities, integrations, and priority support.",
        schemaAnswer: "Pricing is usage-based with free and paid tiers. Free plans include core features; paid plans unlock advanced capabilities, integrations, and priority support scaled to team size."
      },
      {
        q: "What integrations do you support?",
        pageAnswer: "We integrate with 50+ popular tools including Slack, Salesforce, HubSpot, Zapier, and major CRMs. Native API access lets you build custom integrations for your workflow.",
        schemaAnswer: "We support 50+ native integrations including Slack, Salesforce, HubSpot, Zapier, and major CRMs, plus REST API for custom integrations."
      },
      {
        q: "How secure is our data?",
        pageAnswer: "Enterprise-grade security is standard: SOC 2 Type II certified, end-to-end encryption, role-based access controls, and regular third-party audits. Your data stays yours—we never train AI models on customer data.",
        schemaAnswer: "We maintain SOC 2 Type II certification, end-to-end encryption, role-based access controls, and regular security audits. Customer data is never used for AI training."
      },
      {
        q: "Can I try it before buying?",
        pageAnswer: "Yes! Start with our 14-day free trial—no credit card required. You'll get full access to premium features so you can test everything with your real workflows before committing.",
        schemaAnswer: "14-day free trial with full premium access, no credit card required. Test all features with your actual workflows before purchasing."
      },
      {
        q: "What kind of support do you offer?",
        pageAnswer: "All plans include email support and comprehensive documentation. Paid plans add live chat and priority response times. Enterprise customers get dedicated success managers and custom onboarding.",
        schemaAnswer: "Support ranges from email and documentation (all plans) to live chat and priority response (paid plans) to dedicated success managers (enterprise)."
      }
    ],
    impact: "FAQs help AI assistants and buyers quickly evaluate fit, reducing friction in the purchase journey and improving qualified demo requests.",
    quickWins: [
      "Add FAQ schema to pricing and product pages for rich snippet eligibility",
      "Link FAQs from your chatbot and support widget for instant answers",
      "Include FAQ content in your demo request flow to pre-qualify leads"
    ]
  },
  General: {
    title: "AI Search Readiness: FAQ Section",
    questions: [
      {
        q: "What services or products do you offer?",
        pageAnswer: "We provide solutions designed to solve specific customer challenges. Our offerings include core products/services, support resources, and ongoing updates to ensure you get maximum value.",
        schemaAnswer: "We offer comprehensive solutions including core products/services, support resources, and continuous updates for maximum customer value."
      },
      {
        q: "How do I get started?",
        pageAnswer: "Getting started is simple: explore our offerings, choose what fits your needs, and follow the guided setup process. Our team is available to help with onboarding and answer questions.",
        schemaAnswer: "Start by exploring offerings, selecting what fits your needs, and following guided setup. Onboarding support is available."
      },
      {
        q: "What makes you different from competitors?",
        pageAnswer: "We focus on delivering measurable results through proven methodologies, transparent communication, and customer-centric service. Our approach combines innovation with reliability.",
        schemaAnswer: "We deliver measurable results through proven methodologies, transparent communication, and customer-centric service combining innovation with reliability."
      },
      {
        q: "How long does implementation take?",
        pageAnswer: "Typical implementations range from days to weeks depending on complexity. We provide clear timelines upfront and keep you informed throughout the process.",
        schemaAnswer: "Implementation timelines range from days to weeks based on complexity, with clear milestones and regular progress updates."
      },
      {
        q: "What support options are available?",
        pageAnswer: "We offer multiple support channels including documentation, email support, and live assistance. Premium customers receive priority access and dedicated account management.",
        schemaAnswer: "Support includes documentation, email, and live assistance, with premium customers receiving priority access and dedicated account management."
      }
    ],
    impact: "FAQs help search engines and AI assistants extract clear answers about your offerings, improving discoverability and reducing barriers to engagement.",
    quickWins: [
      "Link FAQs from your main navigation and footer for easy access",
      "Include FAQ schema in your homepage and key landing pages",
      "Update FAQs quarterly based on actual customer questions from support tickets"
    ]
  }
};

function makeProgrammaticFAQRecommendation(issue, scanEvidence, industry) {
  console.log('🎯 Starting FAQ recommendation generation...');
  const domain = extractDomain(scanEvidence.url);
  const { profile, facts } = normalizeEvidence(scanEvidence);

  // Use provided industry or default to General
  // Industry is passed from V5 analysis (detected from content/metadata)
  const detectedIndustry = industry || 'General';
  const faqLib = FAQ_LIBRARIES[detectedIndustry] || FAQ_LIBRARIES.General;
  console.log(`📚 Using FAQ library for industry: ${detectedIndustry}`);

  // Check if FAQ schema exists (but content might be missing)
  const hasFAQSchema = scanEvidence.technical?.hasFAQSchema;
  const faqCount = scanEvidence.content?.faqs?.length || 0;

  // Build the finding based on what exists
  let finding;
  if (hasFAQSchema && faqCount === 0) {
    // Schema exists but no on-page FAQ content
    finding = `Status: Incomplete

FAQPage schema detected in JSON-LD, but no visible FAQ content found on ${domain}. Search engines and AI assistants need BOTH schema markup AND on-page Q&A pairs to surface your answers in rich results.

Your schema exists but is disconnected from actual user-facing FAQ content.`;
  } else if (!hasFAQSchema && faqCount > 0) {
    // Content exists but no schema
    finding = `Status: Missing Schema

${faqCount} FAQ pairs detected on-page, but no FAQPage schema markup. Adding schema will help AI assistants extract and cite your answers in voice search and rich results.`;
  } else {
    // Neither exists
    finding = `Status: Missing

No on-page FAQ content or FAQPage schema detected on ${domain}. This limits how AI assistants and search engines extract clear answers about your services, ROI, timelines, pricing, and terms.`;
  }
  const faqPageCopy = faqLib.questions.map((faq, idx) =>
    `Q${idx + 1}. ${faq.q}\n${faq.pageAnswer}`
  ).join('\n\n');

  // Build JSON-LD schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqLib.questions.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.schemaAnswer
      }
    }))
  };

  const schemaCode = `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`;

  // Build the recommendation in the exact format requested
  const categoryName = CATEGORY_NAMES[issue.category] || issue.category;
  const title = `${categoryName}: FAQ Section`;

  // Impact is consistent regardless of scenario
  const impact = `Impact: High | +${Math.max(8, Math.round(issue.gap * 0.7))}-${Math.max(15, Math.round(issue.gap * 0.95))} pts potential

${faqLib.impact}`;

  // Action steps vary based on what exists
  let actionSteps;
  if (hasFAQSchema && faqCount === 0) {
    // Schema exists but content missing - focus on adding visible content
    actionSteps = `1. Add a dedicated FAQ section to your page (below your primary CTA or above the footer)
2. Copy the ready-to-use FAQ content from the "Ready-to-use FAQ" section below
3. Paste the Q&A pairs into your page HTML so they're visible to users
4. Update your existing FAQPage schema to match the new on-page content (or replace with the schema below)
5. Validate in Google Rich Results Test to ensure schema matches visible content
6. Re-scan in the AI Visibility Tool to confirm lift in "FAQ Score"`;
  } else if (!hasFAQSchema && faqCount > 0) {
    // Content exists but schema missing - just add schema
    actionSteps = `1. Review your existing on-page FAQ content
2. Copy the FAQ Schema JSON-LD from the "FAQ Schema" section below
3. Customize the Q&A pairs in the schema to match your actual on-page FAQs
4. Paste the JSON-LD into your page <head> (or via tag manager)
5. Validate in Google Rich Results Test
6. Re-scan in the AI Visibility Tool to confirm lift`;
  } else {
    // Neither exists - full implementation
    actionSteps = `1. Add a dedicated FAQ section to your page (below your primary CTA or above the footer)
2. Copy the ready-to-use FAQ content from the "Ready-to-use FAQ" section below
3. Paste the Q&A pairs into your page HTML
4. Copy the FAQ Schema JSON-LD and paste it into your page <head> (or via tag manager)
5. Validate in Google Rich Results Test (search.google.com/test/rich-results)
6. Re-scan in the AI Visibility Tool to confirm lift in "FAQ Score" and "Entity Clarity"`;
  }

  // Implementation Notes as array (for structured display)
  const implementationNotes = [
    'Keep each answer concise (80-140 words on page; shorter in JSON-LD is fine)',
    'Avoid unverifiable claims (e.g., exact % lifts) unless you have public proof',
    'Update FAQ content quarterly based on actual customer questions from support tickets or sales calls',
    'Ensure Q&A pairs are visible on the page (not hidden behind collapsed accordions that block crawlers)'
  ];

  // Validation Checklist as array (for interactive checkboxes)
  const validationChecklist = [
    'Google Rich Results Test: FAQ detected, no warnings',
    'Page renders Q&A visibly (not hidden behind tabs that block crawl)',
    'Re-scan in AI Visibility Tool: "FAQ Score" and "Entity Clarity" increase',
    'FAQPage schema validates at schema.org/validator'
  ];

  // Build separate frontend and backend code
  let customizedImplementation = '';
  let readyToUseContent = '';
  let frontendCode = '';
  let backendCode = '';

  if (hasFAQSchema && faqCount === 0) {
    // Schema exists, just need on-page content
    customizedImplementation = `### Your Customized FAQ Implementation\n\nYou already have FAQ schema in place, but you're missing visible FAQ content on your page. Here's what you need to add:\n\n**Industry-Specific Questions for ${detectedIndustry}:**\n\n${faqLib.questions.map((faq, idx) => `**Q${idx + 1}: ${faq.q}**\n\n${faq.pageAnswer}`).join('\n\n---\n\n')}\n\nThese questions target common search queries in the ${detectedIndustry} industry and will help AI understand your business expertise.`;
    readyToUseContent = faqPageCopy;
    frontendCode = `<!-- Add this FAQ section to your page HTML -->\n<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n  \n${faqLib.questions.map((faq, idx) => `  <div class="faq-item">\n    <h3>${faq.q}</h3>\n    <p>${faq.pageAnswer}</p>\n  </div>`).join('\n\n')}\n</section>`;
    backendCode = `**Note:** You already have FAQ schema. Update it to match the new on-page content above.`;
  } else if (!hasFAQSchema && faqCount > 0) {
    // Content exists, just need schema
    customizedImplementation = `### Your Customized FAQ Schema Implementation\n\nYou already have FAQ content on your page (${faqCount} question${faqCount > 1 ? 's' : ''} detected). Now you need to add structured data schema so AI systems like ChatGPT, Perplexity, and Google can understand and reference your FAQs.\n\n**What's Missing:** FAQPage schema in JSON-LD format\n\n**Impact:** Without schema, AI can see your FAQ text but can't reliably extract and cite specific Q&A pairs. Adding schema makes your expertise directly quotable by AI.`;
    readyToUseContent = '**Note:** You already have FAQ content on your page. Just add the schema below to your page <head>.';
    frontendCode = '<!-- Your existing FAQ content is good. No changes needed. -->';
    backendCode = schemaCode;
  } else {
    // Need both - full implementation
    customizedImplementation = `### Your Complete FAQ Implementation for ${detectedIndustry}\n\nYou currently have no FAQ section. Implementing this will significantly boost your AI visibility.\n\n**Industry-Tailored Questions:**\n\n${faqLib.questions.map((faq, idx) => `**Q${idx + 1}: ${faq.q}**\n\n${faq.pageAnswer}`).join('\n\n---\n\n')}\n\n**Why These Questions Matter:**\n- Targets actual search queries in ${detectedIndustry}\n- Helps AI systems understand your expertise\n- Increases chances of being cited by ChatGPT, Perplexity, and other AI assistants\n- Improves traditional SEO rankings for question-based searches`;
    readyToUseContent = faqPageCopy;
    frontendCode = `<!-- Add this FAQ section to your page HTML -->\n<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n  \n${faqLib.questions.map((faq, idx) => `  <div class="faq-item">\n    <h3>${faq.q}</h3>\n    <p>${faq.pageAnswer}</p>\n  </div>`).join('\n\n')}\n</section>`;
    backendCode = schemaCode;
  }

  // Combine frontend and backend for codeSnippet display
  const codeSnippet = `## Frontend Implementation (Page Content)\n\n${frontendCode}\n\n---\n\n## Backend Implementation (FAQ Schema)\n\n${backendCode}`;

  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: title,
    category: issue.category,
    subfactor: "faqScore",
    priority: issue.severity || 'high',
    priorityScore: issue.priority || 85,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps.split('\n').filter(s => s.trim()),
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,  // ✅ ADDED: Customized implementation for blue box
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: faqLib.quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: "1-2 hours",
    difficulty: "Easy",
    estimatedScoreGain: Math.max(12, Math.round(issue.gap * 0.8)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: { faqDetected: false, industry: detectedIndustry },
    generatedBy: 'programmatic_faq_library'
  };
}

// ========================================
// ALT TEXT GENERATOR
// ========================================

function makeProgrammaticAltTextRecommendation(issue, scanEvidence, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);
  const detectedIndustry = industry || 'General';

  // Extract image data
  const images = scanEvidence.content?.images || [];
  const imagesWithoutAlt = images.filter(img => !img.alt || img.alt.trim() === '');
  const imagesWithAlt = images.filter(img => img.alt && img.alt.trim() !== '');

  const totalImages = images.length;
  const missingAltCount = imagesWithoutAlt.length;
  const altCoverage = totalImages > 0 ? Math.round((imagesWithAlt.length / totalImages) * 100) : 0;

  // Build Finding
  const finding = `Status: ${missingAltCount === 0 ? 'Good' : 'Needs Improvement'}

Your page contains ${totalImages} image${totalImages === 1 ? '' : 's'}:
• ${imagesWithAlt.length} image${imagesWithAlt.length === 1 ? '' : 's'} with alt text (${altCoverage}% coverage)
• ${missingAltCount} image${missingAltCount === 1 ? '' : 's'} missing alt text

${missingAltCount > 0 ? `Images without alt text cannot be understood by AI assistants, screen readers, or search engines. This reduces your content's accessibility and discoverability.` : `Great job! All your images have alt text. Make sure the descriptions are meaningful and descriptive.`}`;

  // Build Impact
  const impact = `Impact: ${missingAltCount > 5 ? 'High' : missingAltCount > 0 ? 'Medium' : 'Low'} | +${Math.max(5, Math.round(issue.gap * 0.7))} to +${Math.max(10, Math.round(issue.gap))} pts potential

Alt text serves three critical purposes:
• **AI Understanding:** ChatGPT, Perplexity, and other AI assistants can reference your images in answers
• **Accessibility:** Screen readers can describe images to visually impaired users
• **SEO:** Search engines index alt text for image search results

Missing alt text means AI systems skip your visual content entirely, reducing citation opportunities.`;

  // Build Action Steps
  const actionSteps = [
    `Audit all ${totalImages} images on this page to identify those missing alt text`,
    `Write descriptive alt text for each image (8-15 words recommended)`,
    `Include relevant keywords naturally - describe what's actually in the image`,
    `For decorative images (borders, spacers), use empty alt="" to indicate they're decorative`,
    `Validate implementation using an accessibility checker (WAVE, axe DevTools)`,
    `Re-scan this page to confirm alt text coverage reaches 100%`
  ];

  // Customized Implementation - Show actual images that need alt text
  let customizedImplementation = '';
  if (missingAltCount > 0) {
    const exampleImages = imagesWithoutAlt.slice(0, 3);
    customizedImplementation = `### Your Images That Need Alt Text\n\nWe detected ${missingAltCount} image${missingAltCount === 1 ? '' : 's'} without alt text. Here are ${Math.min(3, missingAltCount)} that need attention:\n\n`;

    exampleImages.forEach((img, idx) => {
      const fileName = img.src ? img.src.split('/').pop() : 'unknown';
      const suggestedAlt = generateAltTextSuggestion(fileName, detectedIndustry);
      customizedImplementation += `**Image ${idx + 1}:** \`${fileName}\`\n`;
      customizedImplementation += `- **Current:** No alt text\n`;
      customizedImplementation += `- **Suggested:** "${suggestedAlt}"\n`;
      customizedImplementation += `- **Code:** \`<img src="${img.src}" alt="${suggestedAlt}">\`\n\n`;
    });

    if (missingAltCount > 3) {
      customizedImplementation += `*...and ${missingAltCount - 3} more image${missingAltCount - 3 === 1 ? '' : 's'} need${missingAltCount - 3 === 1 ? 's' : ''} alt text.*\n\n`;
    }

    customizedImplementation += `**Why These Matter:**\n- AI assistants can now reference your visual content in answers\n- Screen readers can describe images to visually impaired visitors\n- Google Images can index and rank these images for relevant searches`;
  } else {
    customizedImplementation = `### Excellent Alt Text Coverage!\n\nAll ${totalImages} images on your page have alt text. To maximize AI visibility:\n\n1. **Review quality:** Make sure alt text is descriptive, not just "image" or "photo"\n2. **Include context:** Describe what's happening in the image and why it matters\n3. **Natural keywords:** Include relevant terms naturally without keyword stuffing\n\n**Example of good vs. poor alt text:**\n- ❌ Poor: "team photo"\n- ✅ Good: "AI startup team collaborating on product roadmap in modern office"\n\nWell-written alt text helps AI assistants cite your content with visual context.`;
  }

  // Ready-to-use content - HTML template
  const readyToUseContent = missingAltCount > 0 ? `Copy-paste this HTML template for adding alt text to your images:

\`\`\`html
<!-- Before: Missing alt text -->
<img src="/images/hero.jpg">

<!-- After: With descriptive alt text -->
<img src="/images/hero.jpg" alt="${generateAltTextSuggestion('hero', detectedIndustry)}">
\`\`\`

**Alt Text Formula:** [What's in the image] + [Context/Purpose] + [Relevant keyword if natural]

Example: "Marketing team reviewing analytics dashboard on laptop"` : null;

  // Implementation Notes
  const implementationNotes = [
    'Keep alt text between 8-15 words - descriptive but concise',
    'Avoid starting with "image of" or "picture of" - it\'s implied',
    'For complex images (charts, diagrams), provide detailed descriptions or link to full text alternative',
    'Decorative images should have empty alt="" to indicate they add no informational value',
    'Use your industry terminology naturally - helps with topical relevance'
  ];

  // Quick Wins
  const quickWins = [
    'Add alt text to your logo: "' + (facts.brand || 'Your Company') + ' logo"',
    'Add alt text to hero/banner image first - most visible to visitors',
    'Update team photos with names and roles when appropriate',
    'For product images, include product name and key feature'
  ];

  // Validation Checklist
  const validationChecklist = [
    'Run WAVE accessibility checker - no alt text errors',
    'Test with screen reader (NVDA, JAWS, or VoiceOver) - images described correctly',
    'Google Lighthouse accessibility score improved',
    'Re-scan in AI Visibility Tool - altTextScore increases',
    'All images have meaningful alt text (not "image1.jpg" or generic descriptions)'
  ];

  // Code Snippet
  const codeSnippet = missingAltCount > 0 ? `## Adding Alt Text to Images

### Step 1: Locate Images Without Alt Text

Use browser DevTools or view page source to find \`<img>\` tags missing alt attributes.

### Step 2: Add Descriptive Alt Text

\`\`\`html
<!-- Generic example -->
<img src="/images/product-demo.jpg"
     alt="${generateAltTextSuggestion('product-demo', detectedIndustry)}">

<!-- Logo -->
<img src="/images/logo.png"
     alt="${facts.brand || 'Company'} logo">

<!-- Team photo -->
<img src="/images/team.jpg"
     alt="Marketing team collaborating in ${detectedIndustry} strategy session">

<!-- Decorative image (no informational value) -->
<img src="/images/decorative-border.svg"
     alt=""
     role="presentation">
\`\`\`

### Step 3: Validate

Test with a screen reader or use WAVE browser extension to verify alt text is present and meaningful.` : `## Maintaining Good Alt Text

Your images already have alt text! Here's how to keep it high-quality:

\`\`\`html
<!-- Good alt text example -->
<img src="/images/case-study.jpg"
     alt="AI startup dashboard showing 40% increase in user engagement">

<!-- Poor alt text example - too generic -->
<img src="/images/case-study.jpg"
     alt="screenshot">
\`\`\`

**Quality Checklist:**
✓ Describes what's actually in the image
✓ Provides context about why it matters
✓ Uses natural language (not keyword stuffing)
✓ Concise but informative (8-15 words ideal)
\`\`\``;

  return {
    id: `rec_${issue.category}_altText_${Date.now()}`,
    title: 'AI Readability: Image Alt Text',
    category: issue.category,
    subfactor: 'altTextScore',
    priority: missingAltCount > 5 ? 'high' : missingAltCount > 0 ? 'medium' : 'low',
    priorityScore: issue.priority || 70,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: missingAltCount > 10 ? "2-3 hours" : missingAltCount > 0 ? "1-2 hours" : "30 minutes",
    difficulty: "Easy",
    estimatedScoreGain: Math.max(5, Math.round(issue.gap * 0.8)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      totalImages: totalImages,
      missingAlt: missingAltCount,
      altCoverage: altCoverage
    },
    generatedBy: 'programmatic_alt_text'
  };
}

// Helper: Generate alt text suggestions based on filename and industry
function generateAltTextSuggestion(filename, industry) {
  const name = filename.replace(/\.(jpg|jpeg|png|gif|svg|webp)$/i, '').replace(/[-_]/g, ' ');

  // Common patterns
  if (/logo/i.test(name)) return `${industry} company logo`;
  if (/hero|banner/i.test(name)) return `${industry} professional services hero image`;
  if (/team|people|staff/i.test(name)) return `${industry} team members collaborating`;
  if (/product|demo|screenshot/i.test(name)) return `${industry} product demonstration screenshot`;
  if (/office|workspace/i.test(name)) return `Modern ${industry} office workspace`;

  // Generic fallback
  return `${name} - ${industry} visual content`;
}

// ========================================
// SCANNABILITY GENERATOR
// ========================================

function makeProgrammaticScannabilityRecommendation(issue, scanEvidence, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);

  // Extract scannability metrics
  const wordCount = scanEvidence.content?.word_count || 0;
  const paragraphs = scanEvidence.content?.paragraphs || [];
  const headings = {
    h1: scanEvidence.content?.headings?.h1 || [],
    h2: scanEvidence.content?.headings?.h2 || [],
    h3: scanEvidence.content?.headings?.h3 || [],
  };

  const totalHeadings = headings.h1.length + headings.h2.length + headings.h3.length;
  const avgWordsPerHeading = totalHeadings > 0 ? Math.round(wordCount / totalHeadings) : wordCount;

  // Find long paragraphs (>150 words)
  const longParagraphs = paragraphs.filter(p => p.length > 150);

  // Detect lists/bullets
  const hasBullets = /<ul|<ol|<li/i.test(scanEvidence.html);

  // Build Finding
  const finding = `Status: ${avgWordsPerHeading > 300 ? 'Needs Improvement' : avgWordsPerHeading > 200 ? 'Fair' : 'Good'}

**Page Structure:**
• Total word count: ${wordCount}
• Headings: ${totalHeadings} (${headings.h2.length} H2s, ${headings.h3.length} H3s)
• Average words per section: ${avgWordsPerHeading}
• Long paragraphs (>150 words): ${longParagraphs.length}
• Bullet points/lists: ${hasBullets ? 'Detected' : 'Not detected'}

${avgWordsPerHeading > 300 ? `Your content has large sections without headings. AI assistants prefer content broken into clear, scannable sections with descriptive headings every 150-250 words.` : `Your content structure is reasonable, but optimizing scannability will improve AI comprehension and user engagement.`}`;

  // Build Impact
  const impact = `Impact: Medium | +${Math.max(8, Math.round(issue.gap * 0.6))} to +${Math.max(12, Math.round(issue.gap))} pts potential

Scannable content helps AI assistants:
• **Extract answers faster:** Clear headings signal what each section covers
• **Cite specific points:** Bullet points are easier to reference than dense paragraphs
• **Understand hierarchy:** Proper H2/H3 structure shows content organization

Well-structured content gets cited more frequently because AI can quickly find relevant information.`;

  // Build Action Steps
  const actionSteps = [
    `Break long paragraphs (>150 words) into smaller chunks of 3-4 sentences each`,
    `Add descriptive H2/H3 headings every 150-250 words to segment content`,
    `Convert process lists or feature lists into bullet points for clarity`,
    `Use bold text to highlight key terms and important concepts`,
    `Add white space between sections to improve visual scannability`,
    `Test readability score - aim for Flesch Reading Ease >65`
  ];

  // Customized Implementation
  let customizedImplementation = '';
  if (longParagraphs.length > 0) {
    const longestParagraph = longParagraphs[0];
    const previewText = longestParagraph.substring(0, 300) + (longestParagraph.length > 300 ? '...' : '');

    customizedImplementation = `### Reformatting Your Content for Better Scannability\n\n**Before:** One long paragraph (${longestParagraph.length} words)\n\n${previewText}\n\n---\n\n**After:** Broken into scannable sections with headings and bullets\n\n## [Add Descriptive H2 Here]\n\n[First key point in 2-3 sentences]\n\n**Key benefits:**\n- [Benefit 1]\n- [Benefit 2]\n- [Benefit 3]\n\n## [Add Second H2 Here]\n\n[Next point in 2-3 sentences]\n\n---\n\n**Why This Works:**\n- AI assistants can quickly scan headings to find relevant sections\n- Bullets make individual points easy to extract and cite\n- Shorter paragraphs improve comprehension and keep readers engaged`;
  } else {
    customizedImplementation = `### Optimizing Your Content Structure\n\nYour content is already fairly scannable! Here's how to make it even better:\n\n**Current Structure:**\n- ${totalHeadings} headings dividing ${wordCount} words\n- Average ${avgWordsPerHeading} words per section\n\n**Optimization Opportunities:**\n1. Ensure every 150-250 words has a descriptive H2 or H3 heading\n2. Convert any process descriptions or feature lists to bullet points\n3. Add bold formatting to key terms AI should pay attention to\n4. Use short paragraphs (3-4 sentences max) for easy scanning`;
  }

  // Ready-to-use content
  const readyToUseContent = `### Scannability Checklist\n\nApply these formatting rules to your content:\n\n**Heading Frequency:** Add H2/H3 every 150-250 words\n**Paragraph Length:** Keep paragraphs to 3-4 sentences (50-100 words)\n**Lists:** Convert 3+ related items to bullet points\n**White Space:** Add line breaks between sections\n**Bold Text:** Highlight 1-2 key terms per section\n\n**Example Format:**\n\n## Clear, Descriptive Heading\n\nShort introductory paragraph (2-3 sentences) that previews what this section covers.\n\n**Key points:**\n- First important point\n- Second important point\n- Third important point\n\nBrief conclusion or transition (1-2 sentences).`;

  // Implementation Notes
  const implementationNotes = [
    'Aim for Flesch Reading Ease score above 65 (readable by 13-15 year olds)',
    'Average sentence length should be under 20 words',
    'Use transition words (However, Therefore, Additionally) to connect ideas',
    'Bold key terms but avoid over-formatting (3-5 bold terms per section max)',
    'Test on mobile - scannable content is even more critical on small screens'
  ];

  // Quick Wins
  const quickWins = [
    'Break your longest paragraph in half - add a subheading between the two parts',
    'Find one list of items in sentence form - convert it to bullet points',
    'Add bold formatting to 5-10 key terms throughout the page',
    'Review your H2 headings - make them more descriptive and keyword-rich'
  ];

  // Validation Checklist
  const validationChecklist = [
    'Hemingway App or similar tool shows readability grade of 8th grade or lower',
    'Every section has a clear H2 or H3 heading',
    'No paragraphs exceed 4-5 sentences',
    'Important lists are formatted as bullet points',
    'Re-scan shows improved scannabilityScore'
  ];

  // Code Snippet
  const codeSnippet = `## Content Formatting Template

### Before: Dense, Hard-to-Scan Content

\`\`\`html
<p>
  This is a very long paragraph that covers multiple topics without any breaks.
  It discusses the first topic at length, then moves to a second topic, and
  eventually covers a third topic. There are no headings, no bullets, and no
  clear visual breaks. AI assistants struggle to extract specific information
  from this format because everything is jumbled together in one continuous block.
  [continues for 200+ words...]
</p>
\`\`\`

### After: Scannable, AI-Friendly Format

\`\`\`html
<h2>First Topic: Clear Descriptive Heading</h2>

<p>
  Short introduction to this topic (2-3 sentences that summarize the key point).
</p>

<p><strong>Key benefits:</strong></p>
<ul>
  <li>First specific benefit</li>
  <li>Second specific benefit</li>
  <li>Third specific benefit</li>
</ul>

<h2>Second Topic: Another Clear Heading</h2>

<p>
  Brief explanation of this topic with <strong>key terms</strong> highlighted for emphasis.
</p>

<p>
  Additional details in a separate paragraph (keeps each para to 3-4 sentences).
</p>
\`\`\`

**Key Improvements:**
- Clear H2 headings every 150-250 words
- Short paragraphs (3-4 sentences each)
- Bullet points for lists
- Bold text on key terms`;

  return {
    id: `rec_${issue.category}_scannability_${Date.now()}`,
    title: 'AI Search Readiness: Content Scannability',
    category: issue.category,
    subfactor: 'scannabilityScore',
    priority: avgWordsPerHeading > 400 ? 'high' : 'medium',
    priorityScore: issue.priority || 75,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: "1-3 hours",
    difficulty: "Easy",
    estimatedScoreGain: Math.max(8, Math.round(issue.gap * 0.7)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      wordCount: wordCount,
      totalHeadings: totalHeadings,
      avgWordsPerHeading: avgWordsPerHeading,
      longParagraphs: longParagraphs.length
    },
    generatedBy: 'programmatic_scannability'
  };
}

// ========================================
// CAPTIONS/TRANSCRIPTS GENERATOR
// ========================================

function makeProgrammaticCaptionsTranscriptsRecommendation(issue, scanEvidence, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);

  // Detect videos
  const videos = scanEvidence.content?.videos || [];
  const videoCount = videos.length;
  const hasTranscripts = /transcript|caption/i.test(scanEvidence.html);

  // Build Finding
  const finding = `Status: ${hasTranscripts ? 'Partial' : videoCount > 0 ? 'Missing' : 'N/A'}

${videoCount > 0 ? `**Video Content Detected:**
• Videos on page: ${videoCount}
• Transcripts detected: ${hasTranscripts ? 'Yes (partial)' : 'No'}

${!hasTranscripts ? `Without transcripts, AI assistants cannot index or reference your video content. Search engines skip video content entirely unless transcripts are provided.` : `You have some transcript content, but ensure all videos have complete, properly formatted transcripts for maximum AI visibility.`}` : `No video content detected on this page. This recommendation will apply when you add video content.`}`;

  // Build Impact
  const impact = `Impact: ${videoCount > 0 && !hasTranscripts ? 'High' : 'Medium'} | +${Math.max(6, Math.round(issue.gap * 0.6))} to +${Math.max(12, Math.round(issue.gap))} pts potential

Video transcripts unlock AI visibility in three ways:
• **AI Citations:** ChatGPT and Perplexity can reference specific quotes from your videos
• **Search Indexing:** Google indexes transcript text for traditional and video search
• **Accessibility:** Screen readers and deaf/hard-of-hearing users can access video content

Without transcripts, your video content is invisible to AI systems - regardless of how valuable the information is.`;

  // Build Action Steps
  const actionSteps = [
    `Identify all ${videoCount > 0 ? videoCount : ''} video${videoCount === 1 ? '' : 's'} on your page that need transcripts`,
    `Use a transcription service (Rev, Otter.ai, YouTube auto-captions) to generate initial transcript`,
    `Edit transcript for accuracy - fix technical terms, company names, and industry jargon`,
    `Format transcript with timestamps and speaker labels for clarity`,
    `Add transcript to page in accessible location (expandable section below video, separate tab, or dedicated transcript page)`,
    `Test with screen reader to ensure transcript is properly labeled and accessible`,
    `Validate with Google Rich Results Test - transcript should be crawlable`
  ];

  // Customized Implementation
  const customizedImplementation = videoCount > 0 ? `### Adding Transcripts to Your Video Content\n\n**Videos Detected:** ${videoCount}\n\nEach video needs a complete, accurate transcript to be AI-readable. Here's what to do:\n\n**Option 1: Embedded Transcript (Recommended)**\nAdd an expandable transcript section directly below each video:\n\n\`\`\`html
<div class="video-container">
  <video src="your-video.mp4" controls></video>

  <details class="transcript">
    <summary>📄 View Transcript</summary>
    <div class="transcript-content">
      <p><strong>[00:00]</strong> Introduction to ${facts.brand || 'our service'}...</p>
      <p><strong>[00:30]</strong> Key feature explanation...</p>
      <p><strong>[01:15]</strong> Customer success story...</p>
    </div>
  </details>
</div>
\`\`\`

**Option 2: Separate Transcript Page**\nCreate a dedicated transcript page and link to it below the video:

\`\`\`html
<video src="your-video.mp4" controls></video>
<p><a href="/transcripts/video-1-transcript">Read full transcript</a></p>
\`\`\`

**Why This Matters:**\n- AI assistants can now cite specific quotes from your video\n- Search engines index the transcript text\n- Accessible to all users regardless of ability to hear audio` : `### Preparing for Video Content\n\nWhen you add video content to your site, follow this transcript workflow:\n\n1. **Record video** with clear audio\n2. **Generate transcript** using Rev.com, Otter.ai, or YouTube auto-captions\n3. **Edit for accuracy** - fix technical terms and jargon\n4. **Format with timestamps** for easy reference\n5. **Embed on page** below video or link to separate transcript page\n6. **Validate accessibility** with screen reader testing\n\nProper transcripts can increase video content's AI citation rate by 300%+.`;

  // Ready-to-use content
  const readyToUseContent = `### Video Transcript Template\n\n\`\`\`html
<div class="video-with-transcript">
  <h2>Video Title Here</h2>

  <video controls>
    <source src="/videos/demo.mp4" type="video/mp4">
    <track kind="captions" src="/captions/demo.vtt" srclang="en" label="English">
  </video>

  <details class="video-transcript" open>
    <summary><strong>📄 Transcript</strong></summary>

    <div class="transcript-content">
      <p>
        <span class="timestamp">[00:00]</span>
        <span class="speaker">Speaker:</span>
        Welcome to this overview of [topic]. In this video, we'll cover...
      </p>

      <p>
        <span class="timestamp">[00:30]</span>
        First key point about [topic]...
      </p>

      <p>
        <span class="timestamp">[01:15]</span>
        Second key point...
      </p>
    </div>
  </details>
</div>
\`\`\`

Copy this template and fill in your actual video content.`;

  // Implementation Notes
  const implementationNotes = [
    'Use professional transcription services (Rev, Otter.ai) for accuracy - auto-captions need heavy editing',
    'Include timestamps every 30-60 seconds for easy navigation',
    'Add speaker labels if multiple people appear in video',
    'Correct all technical terms, company names, and industry jargon',
    'Make transcripts accessible via <details> element, accordion, or separate linked page'
  ];

  // Quick Wins
  const quickWins = [
    'Start with your homepage video - it likely gets the most traffic',
    'Use YouTube auto-captions as a starting point (free)',
    'For short videos (<5 min), manually transcribe - faster than editing auto-captions',
    'Add VTT caption files for native browser caption support'
  ];

  // Validation Checklist
  const validationChecklist = [
    'Every video on the page has a complete transcript',
    'Transcript is visible and accessible (not hidden in code comments)',
    'Screen reader can navigate and read transcript properly',
    'Transcript includes timestamps for longer videos (>5 minutes)',
    'Google Rich Results Test can crawl the transcript text'
  ];

  // Code Snippet
  const codeSnippet = `## Video Transcript Implementation

### Complete Example with Styles

\`\`\`html
<style>
.video-transcript {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-left: 4px solid #0066cc;
  border-radius: 4px;
}

.video-transcript summary {
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 10px;
}

.transcript-content p {
  margin: 10px 0;
  line-height: 1.6;
}

.timestamp {
  font-weight: bold;
  color: #0066cc;
  margin-right: 8px;
}

.speaker {
  font-style: italic;
  margin-right: 8px;
}
</style>

<div class="video-container">
  <h2>Product Demo Video</h2>

  <video width="100%" controls>
    <source src="/videos/product-demo.mp4" type="video/mp4">
    <track kind="captions" src="/captions/demo.vtt" srclang="en" label="English">
    Your browser does not support the video tag.
  </video>

  <details class="video-transcript" open>
    <summary>📄 Full Transcript</summary>

    <div class="transcript-content">
      <p>
        <span class="timestamp">[00:00]</span>
        <span class="speaker">Presenter:</span>
        Welcome to our product demo. Today I'll show you how our platform helps ${industry} companies improve their efficiency.
      </p>

      <p>
        <span class="timestamp">[00:30]</span>
        Let's start with the dashboard. As you can see, all your key metrics are displayed in real-time...
      </p>

      <p>
        <span class="timestamp">[01:00]</span>
        Now let's look at the reporting features. You can generate custom reports by...
      </p>

      <!-- Continue with full transcript -->
    </div>
  </details>
</div>
\`\`\`

### VTT Caption File Format

Create a \`.vtt\` file for native browser captions:

\`\`\`
WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to our product demo.

00:00:05.000 --> 00:00:10.000
Today I'll show you how our platform helps companies improve efficiency.

00:00:10.000 --> 00:00:15.000
Let's start with the dashboard.
\`\`\`

Save as \`demo.vtt\` and reference in video tag.`;

  return {
    id: `rec_${issue.category}_transcripts_${Date.now()}`,
    title: 'AI Readability: Video Transcripts',
    category: issue.category,
    subfactor: 'captionsTranscriptsScore',
    priority: videoCount > 0 && !hasTranscripts ? 'high' : 'medium',
    priorityScore: issue.priority || 70,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: videoCount > 0 ? `${videoCount * 2}-${videoCount * 4} hours` : "2-3 hours per video",
    difficulty: "Medium",
    estimatedScoreGain: Math.max(6, Math.round(issue.gap * 0.75)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      videoCount: videoCount,
      hasTranscripts: hasTranscripts
    },
    generatedBy: 'programmatic_transcripts'
  };
}

// ========================================
// INDEXNOW GENERATOR
// ========================================

function makeProgrammaticIndexNowRecommendation(issue, scanEvidence, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);
  const domain = extractDomain(scanEvidence.url);

  // Check if IndexNow is already implemented
  const hasIndexNow = /indexnow/i.test(scanEvidence.html);

  // Build Finding
  const finding = `Status: ${hasIndexNow ? 'Detected (verify implementation)' : 'Missing'}

${!hasIndexNow ? `**IndexNow Protocol:** Not detected

IndexNow is a protocol that instantly notifies search engines when your content changes. Without it, search engines may take days or weeks to discover your updates.

**Current situation:**
• No IndexNow implementation detected
• Search engines rely on periodic crawling to discover changes
• New or updated content may remain unindexed for extended periods` : `**IndexNow Protocol:** Detected

You appear to have IndexNow implemented. Verify that:
• The API key is valid and properly configured
• Notifications are sent automatically on content updates
• All major search engines (Bing, Yandex) are receiving notifications`}`;

  // Build Impact
  const impact = `Impact: Medium | +${Math.max(5, Math.round(issue.gap * 0.5))} to +${Math.max(10, Math.round(issue.gap))} pts potential

IndexNow provides instant indexing benefits:
• **Immediate Discovery:** Search engines notified within seconds of content updates
• **Faster Rankings:** New content can rank within hours instead of days/weeks
• **API Efficiency:** One API call notifies multiple search engines simultaneously
• **Competitive Advantage:** Your content gets indexed before competitors using traditional crawling

For news sites, blogs, or frequently updated content, IndexNow can dramatically accelerate visibility.`;

  // Build Action Steps
  const actionSteps = [
    `Generate an IndexNow API key at bing.com/indexnow`,
    `Create a text file containing your API key (e.g., abc123.txt) in your site root`,
    `Add the API key file to your site root directory (${domain}/abc123.txt)`,
    `Implement automatic notifications: send POST request to api.indexnow.org when content changes`,
    `Test implementation by updating a page and verifying notification was sent`,
    `Monitor IndexNow submissions in Bing Webmaster Tools`,
    `Set up automatic notifications for CMS publish/update events`
  ];

  // Customized Implementation
  const customizedImplementation = `### IndexNow Setup for ${domain}\n\n**Step-by-Step Implementation:**\n\n**1. Generate Your API Key**\n- Visit https://www.bing.com/indexnow\n- Generate a unique API key (e.g., \`8f3d2c1b9a7e5f4d3c2b1a0987654321\`)\n- Save this key securely\n\n**2. Create Key File**\nCreate a text file named \`[your-key].txt\` containing only your API key:\n\n\`\`\`
8f3d2c1b9a7e5f4d3c2b1a0987654321
\`\`\`

Upload to: \`${domain}/8f3d2c1b9a7e5f4d3c2b1a0987654321.txt\`\n\n**3. Verify Key File**\nConfirm the file is publicly accessible by visiting the URL in your browser.\n\n**4. Send Notifications**\nWhen you publish or update content, send a POST request to IndexNow API (implementation code in the Code section below).\n\n**Why This Matters for ${industry}:**\n- Your content gets discovered immediately instead of waiting for the next crawl\n- Critical updates (pricing changes, new features, breaking news) are indexed within hours\n- Competitive advantage over companies relying on traditional crawling`;

  // Ready-to-use content
  const readyToUseContent = `### Quick IndexNow Setup\n\n**1. Get Your API Key:**\nhttps://www.bing.com/indexnow\n\n**2. Create Key File:**\nCreate \`[your-api-key].txt\` with just the key inside\n\n**3. Upload to Site Root:**\n\`${domain}/[your-api-key].txt\`\n\n**4. Submit URLs:**\nUse the code examples in the Code section to notify search engines when content changes.\n\n**Supported Search Engines:**\n- Bing\n- Yandex\n- Seznam.cz\n- Naver\n\n(Google doesn't support IndexNow but uses its own instant indexing API)`;

  // Implementation Notes
  const implementationNotes = [
    'API key file must be publicly accessible at [domain]/[key].txt',
    'Send notifications only when content actually changes - not on every page view',
    'You can submit up to 10,000 URLs per batch',
    'Notifications are free - no rate limits or usage fees',
    'Test with a single URL first before implementing site-wide'
  ];

  // Quick Wins
  const quickWins = [
    'Start with manual submissions for important pages using the web interface',
    'Implement automatic notifications for blog posts first',
    'Add IndexNow to your CMS publish workflow',
    'Monitor Bing Webmaster Tools to confirm submissions are working'
  ];

  // Validation Checklist
  const validationChecklist = [
    'API key file accessible at public URL',
    'Test notification sent successfully (check response code 200)',
    'Bing Webmaster Tools shows submitted URLs',
    'New content appears in Bing search within 24-48 hours',
    'Automatic notifications trigger on CMS publish/update events'
  ];

  // Code Snippet
  const codeSnippet = `## IndexNow Implementation

### 1. Create API Key File

Create a file named \`8f3d2c1b9a7e5f4d3c2b1a0987654321.txt\` (use your actual key):

\`\`\`
8f3d2c1b9a7e5f4d3c2b1a0987654321
\`\`\`

Upload to your site root: \`${domain}/8f3d2c1b9a7e5f4d3c2b1a0987654321.txt\`

---

### 2. Manual Submission (Test First)

\`\`\`bash
curl -X POST "https://api.indexnow.org/indexnow" \\
  -H "Content-Type: application/json" \\
  -d '{
    "host": "${domain}",
    "key": "8f3d2c1b9a7e5f4d3c2b1a0987654321",
    "keyLocation": "https://${domain}/8f3d2c1b9a7e5f4d3c2b1a0987654321.txt",
    "urlList": [
      "https://${domain}/new-page",
      "https://${domain}/updated-page"
    ]
  }'
\`\`\`

---

### 3. Node.js/Express Implementation

\`\`\`javascript
const axios = require('axios');

async function notifyIndexNow(urls) {
  try {
    const response = await axios.post('https://api.indexnow.org/indexnow', {
      host: '${domain}',
      key: '8f3d2c1b9a7e5f4d3c2b1a0987654321',
      keyLocation: 'https://${domain}/8f3d2c1b9a7e5f4d3c2b1a0987654321.txt',
      urlList: Array.isArray(urls) ? urls : [urls]
    });

    console.log('IndexNow notification sent:', response.status);
    return response.status === 200;
  } catch (error) {
    console.error('IndexNow error:', error.message);
    return false;
  }
}

// Usage: Call when content is published/updated
notifyIndexNow([
  'https://${domain}/new-blog-post',
  'https://${domain}/updated-service-page'
]);
\`\`\`

---

### 4. WordPress Plugin Alternative

If using WordPress, install the **IndexNow** plugin:
1. Go to Plugins → Add New
2. Search for "IndexNow"
3. Install and activate
4. Enter your API key in Settings → IndexNow
5. URLs auto-submitted on publish/update

---

### 5. Python Implementation

\`\`\`python
import requests
import json

def notify_indexnow(urls):
    payload = {
        "host": "${domain}",
        "key": "8f3d2c1b9a7e5f4d3c2b1a0987654321",
        "keyLocation": "https://${domain}/8f3d2c1b9a7e5f4d3c2b1a0987654321.txt",
        "urlList": urls if isinstance(urls, list) else [urls]
    }

    response = requests.post(
        "https://api.indexnow.org/indexnow",
        json=payload
    )

    return response.status_code == 200

# Usage
notify_indexnow([
    "https://${domain}/new-page",
    "https://${domain}/updated-page"
])
\`\`\`

**Response Codes:**
- \`200\`: Success - URL submitted
- \`400\`: Bad request - check your JSON format
- \`403\`: Forbidden - verify key file is accessible
- \`422\`: Unprocessable - invalid URL format`;

  return {
    id: `rec_${issue.category}_indexnow_${Date.now()}`,
    title: 'Technical Setup: IndexNow Protocol',
    category: issue.category,
    subfactor: 'indexNowScore',
    priority: 'medium',
    priorityScore: issue.priority || 65,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: "1-2 hours",
    difficulty: "Medium",
    estimatedScoreGain: Math.max(5, Math.round(issue.gap * 0.6)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      hasIndexNow: hasIndexNow,
      domain: domain
    },
    generatedBy: 'programmatic_indexnow'
  };
}

/**
 * Generates comprehensive location/geographic content recommendations
 * with AEO-focused question-based headings and schema markup
 */
function makeProgrammaticGeoContentRecommendation(issue, scanEvidence, industry) {
  const { profile, facts } = normalizeEvidence(scanEvidence);
  const detectedIndustry = industry || 'Technology';
  const domain = extractDomain(scanEvidence.url);
  const pageTitle = scanEvidence.metadata?.title || 'Your Page';

  // Analyze current location content
  const html = scanEvidence.html || '';
  const hasLocationContent = /\b(serve|service area|location|region|country|city|local|area)\b/i.test(html);
  const hasAreaServedSchema = /"areaServed"/i.test(html) || /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?"areaServed"/i.test(html);
  const hasQuestionHeadings = /(where|who|what|when|why|how)\s+(do|can|will|should|does|are|is)/i.test(html);

  // Extract any existing location mentions
  const locationMentions = [];
  const locationPattern = /\b(Canada|United States|USA|UK|United Kingdom|Australia|Global|Europe|Asia|North America)\b/gi;
  const matches = html.match(locationPattern);
  if (matches) {
    const uniqueLocations = [...new Set(matches)];
    locationMentions.push(...uniqueLocations.slice(0, 5));
  }

  const currentLocations = locationMentions.length;
  const hasGoodCoverage = currentLocations >= 2 && hasLocationContent;

  // Build finding text
  const finding = hasGoodCoverage
    ? `Your page mentions ${currentLocations} location(s), but lacks the structured format and schema markup that answer engines need to understand your service areas. Current location mentions: ${locationMentions.join(', ')}. Score: ${issue.currentScore}/100 (Target: ${issue.threshold}).`
    : `Your page has minimal geographic content (Score: ${issue.currentScore}/100, Target: ${issue.threshold}). Answer engines like ChatGPT, Perplexity, and Google's AI Overviews prioritize businesses with clear service areas and location-specific value propositions.`;

  // Build impact description
  const impact = `**Why Location Content Matters for AEO:**

Answer engines need explicit geographic signals to recommend your business for location-specific queries. Without clear service areas:

- **Local intent queries miss you**: "AI marketing services in Toronto" won't surface your business
- **Answer engines can't verify relevance**: ChatGPT/Perplexity won't cite you for regional queries
- **Schema validation fails**: Missing \`areaServed\` schema prevents rich result eligibility
- **Multi-market queries exclude you**: "US vs Canada providers" comparisons won't include you

**Estimated Impact:**
- **+${Math.round(issue.gap * 0.7)} points** on Location & Geographic Content score
- **+15-25%** visibility in location-qualified answer engine responses
- **Improved entity clarity**: Helps AI understand your market scope`;

  // Build action steps
  const actionSteps = [
    'Add a "Where We Work" section with 2-3 core regions',
    'Include one-sentence value promise per region tied to outcomes',
    'Implement areaServed schema markup in <head>',
    'Use question-based H2/H3 headings for AEO optimization',
    'Keep location content visible in HTML (not hidden in tabs/JS)',
    'Re-scan page to confirm lift in Location & Geographic Content score'
  ];

  // Build customized implementation (blue box)
  const customizedImplementation = `### Comprehensive Location Content for ${pageTitle}

${currentLocations > 0 ? `**Current Locations Detected:** ${locationMentions.join(', ')}\n\n` : ''}**Add AEO-Optimized Location Section**

Answer engines prioritize question-based headings. Add this section below your main services/intro content:

\`\`\`html
<!-- Question-based heading for AEO (Answer Engine Optimization) -->
<section class="service-areas">
  <h2>Where do we deliver ${detectedIndustry.toLowerCase()} services?</h2>

  <p>
    [Your Company Name] partners with ${detectedIndustry.toLowerCase()} companies across
    Canada, the United States, and globally. Our solutions adapt to local market needs
    while keeping your brand consistently visible to AI assistants and answer engines.
  </p>

  <ul>
    <li>
      <strong>Canada:</strong> AI-first strategy and growth programs for B2B ${detectedIndustry.toLowerCase()}
      companies seeking answer engine visibility.
    </li>
    <li>
      <strong>United States:</strong> Answer-engine optimization and AI content intelligence
      for ${detectedIndustry.toLowerCase()} growth-stage teams.
    </li>
    <li>
      <strong>Global:</strong> Scalable frameworks for multi-region visibility and
      localized intent coverage in AI search.
    </li>
  </ul>
</section>
\`\`\`

**Alternative Question-Based Headings** (choose what fits your tone):
- "Where can you find our ${detectedIndustry.toLowerCase()} services?"
- "What regions do we serve?"
- "Which markets benefit from our ${detectedIndustry.toLowerCase()} expertise?"
- "Where are we available?"

**Key Principles:**
✅ **Intent-matched copy**: Each region ties to an outcome/benefit
✅ **Visible HTML**: Don't hide in JavaScript tabs/accordions
✅ **Question format**: Improves answer engine extraction
✅ **Schema support**: Backs up visible copy with structured data`;

  // Build ready-to-use schema markup
  const readyToUseContent = `<!-- Page-Scoped Schema Markup for Service Areas -->
<!-- Add this to your <head> section or before </body> -->

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "${domain}#service",
  "serviceType": "${detectedIndustry}Service",
  "name": "${detectedIndustry} Services",
  "url": "${domain}",
  "areaServed": [
    {
      "@type": "Country",
      "name": "Canada"
    },
    {
      "@type": "Country",
      "name": "United States"
    },
    {
      "@type": "Place",
      "name": "Global"
    }
  ],
  "audience": {
    "@type": "BusinessAudience",
    "name": "B2B ${detectedIndustry.toLowerCase()} companies"
  },
  "provider": {
    "@type": "Organization",
    "@id": "${domain}#organization"
  }
}
</script>

<!-- If you want to specify provinces/states instead of countries: -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "${domain}#service-regional",
  "serviceType": "${detectedIndustry}Service",
  "name": "${detectedIndustry} Services",
  "areaServed": [
    {
      "@type": "State",
      "name": "Ontario",
      "containedInPlace": {
        "@type": "Country",
        "name": "Canada"
      }
    },
    {
      "@type": "State",
      "name": "British Columbia",
      "containedInPlace": {
        "@type": "Country",
        "name": "Canada"
      }
    },
    {
      "@type": "State",
      "name": "California",
      "containedInPlace": {
        "@type": "Country",
        "name": "United States"
      }
    },
    {
      "@type": "State",
      "name": "New York",
      "containedInPlace": {
        "@type": "Country",
        "name": "United States"
      }
    }
  ]
}
</script>`;

  // Build implementation notes (yellow box)
  const implementationNotes = [
    '**Placement**: Add location section after your main service intro, before case studies or testimonials',
    '**Length**: Keep 2-3 core regions. More than 5 dilutes focus for answer engines',
    '**Value propositions**: Each region needs one sentence tied to an outcome (not just "we serve X")',
    '**Question headings**: Use natural question format (Where/What/Who) to match how users query AI',
    '**Schema validation**: Test with Google Rich Results Test after adding schema',
    '**Visibility**: Location copy must be in HTML source - not loaded via JavaScript tabs/modals',
    '**Entity linking**: If you have physical offices, link to location pages with LocalBusiness schema',
    '**Update frequency**: Revise when you expand to new markets (then notify IndexNow)'
  ];

  // Build quick wins (purple box)
  const quickWins = [
    '✅ Add 2-3 core regions in visible copy (5 min)',
    '✅ Write one outcome-focused sentence per region (10 min)',
    '✅ Paste areaServed schema into <head> (2 min)',
    '✅ Change section heading to question format (2 min)',
    '✅ Re-scan to confirm Location & Geographic Content score lift'
  ];

  // Build validation checklist (indigo box)
  const validationChecklist = [
    {
      text: 'Location section added with 2-3 regions',
      checked: false
    },
    {
      text: 'Each region has outcome/value statement (not just "we serve X")',
      checked: false
    },
    {
      text: 'Heading uses question format (Where/What/Who)',
      checked: false
    },
    {
      text: 'areaServed schema added to <head>',
      checked: false
    },
    {
      text: 'Schema validated with Google Rich Results Test',
      checked: false
    },
    {
      text: 'Location content visible in HTML source (not JS-loaded)',
      checked: false
    },
    {
      text: 'Re-scanned page and confirmed score improvement',
      checked: false
    }
  ];

  // Build comprehensive code snippet
  const codeSnippet = `## Complete Location Content Implementation

### 1. HTML Section (Add to page body)

\`\`\`html
<section class="service-areas" id="locations">
  <!-- Question-based heading for AEO -->
  <h2>Where do we deliver ${detectedIndustry.toLowerCase()} services?</h2>

  <p>
    [Your Company Name] partners with ${detectedIndustry.toLowerCase()} companies across
    Canada, the United States, and globally. Our solutions adapt to local buying behavior
    while keeping your brand consistently visible to AI assistants and answer engines.
  </p>

  <!-- Region-specific value propositions -->
  <ul class="region-list">
    <li>
      <strong>Canada:</strong> AI-first strategy and demand programs for B2B ${detectedIndustry.toLowerCase()}
      companies and MSPs seeking answer engine visibility.
    </li>
    <li>
      <strong>United States:</strong> Answer-engine optimization and AI content intelligence
      for growth-stage ${detectedIndustry.toLowerCase()} teams.
    </li>
    <li>
      <strong>Global:</strong> Scalable frameworks for multi-region visibility and
      localized intent coverage.
    </li>
  </ul>

  <!-- Optional: Link to location pages if you have them -->
  <p>
    <a href="/locations/">View all service locations →</a>
  </p>
</section>
\`\`\`

### 2. Schema Markup (Add to <head>)

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "${domain}#service",
  "serviceType": "${detectedIndustry}Service",
  "name": "${detectedIndustry} Services",
  "url": "${domain}",
  "description": "Professional ${detectedIndustry.toLowerCase()} services for businesses across North America and globally",
  "areaServed": [
    {
      "@type": "Country",
      "name": "Canada"
    },
    {
      "@type": "Country",
      "name": "United States"
    },
    {
      "@type": "Place",
      "name": "Global"
    }
  ],
  "audience": {
    "@type": "BusinessAudience",
    "name": "B2B ${detectedIndustry.toLowerCase()} companies"
  },
  "provider": {
    "@type": "Organization",
    "@id": "${domain}#organization"
  }
}
</script>
\`\`\`

### 3. CSS Styling (Optional)

\`\`\`css
.service-areas {
  margin: 3rem 0;
  padding: 2rem;
  background: #f9fafb;
  border-left: 4px solid #3b82f6;
}

.service-areas h2 {
  color: #1e40af;
  margin-bottom: 1rem;
  font-size: 1.75rem;
}

.region-list {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0;
}

.region-list li {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  position: relative;
}

.region-list li:before {
  content: "📍";
  position: absolute;
  left: 0;
}

.region-list strong {
  color: #1f2937;
  font-weight: 600;
}
\`\`\`

### 4. Validation Steps

**Test Schema Markup:**
1. Visit: https://search.google.com/test/rich-results
2. Paste your page URL or code
3. Verify "Service" type appears with areaServed property

**Test Answer Engine Visibility:**
1. Re-scan with AI Visibility Tool
2. Check Location & Geographic Content score increase
3. Query ChatGPT/Perplexity: "[your service] providers in [region]"
4. Verify your business appears in responses

**Common Issues:**
- ❌ Location content hidden in collapsed tabs → Move to visible HTML
- ❌ Generic "we serve globally" → Add specific regions with value props
- ❌ Schema validation errors → Check JSON syntax and required fields
- ❌ No score improvement → Ensure content is crawlable (not JS-rendered)`;

  return {
    id: `rec_${issue.category}_geo_${Date.now()}`,
    title: 'AI Search Readiness: Location & Geographic Content',
    category: issue.category,
    subfactor: 'geoContentScore',
    priority: 'high',
    priorityScore: issue.priority || 75,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    codeSnippet: codeSnippet,
    customizedImplementation: customizedImplementation,
    readyToUseContent: readyToUseContent,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: "30-45 minutes",
    difficulty: "Easy",
    estimatedScoreGain: Math.max(8, Math.round(issue.gap * 0.7)),
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      hasLocationContent: hasLocationContent,
      hasAreaServedSchema: hasAreaServedSchema,
      hasQuestionHeadings: hasQuestionHeadings,
      currentLocations: currentLocations,
      locationMentions: locationMentions
    },
    generatedBy: 'programmatic_geocontent'
  };
}

function makeProgrammaticStructuredDataRecommendation(issue, scanEvidence) {
  const { profile, facts } = normalizeEvidence(scanEvidence);
  const template = RECOMMENDATION_TEMPLATES.structuredDataScore;

  const core = buildCoreJsonLd(scanEvidence.url, facts);
  const faqPairs = (profile.sections?.has_faq && Array.isArray(profile.sections.faq_pairs))
    ? profile.sections.faq_pairs.slice(0, 6) : [];
  const faq = buildFAQJsonLd(scanEvidence.url, faqPairs);
  const blocks = [...core, ...(faq ? [faq] : [])];

  const codeSnippet = blocks
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');

  const domain = extractDomain(scanEvidence.url);
  const found = (scanEvidence.technical?.structuredData || []).length;

  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: "Add Organization + WebSite + WebPage schema",
    category: issue.category,
    subfactor: "structuredDataScore",
    priority: issue.severity || 'high',
    priorityScore: issue.priority || 90,
    finding: found
      ? `Structured data is incomplete on ${domain}. Core entity schemas missing or not linked with stable @ids.`
      : `No Schema.org JSON-LD detected on ${domain}. AI assistants cannot reliably identify your entity.`,
    impact: "Defines your canonical entity for AI systems, enables rich results, and improves citation accuracy.",
    actionSteps: [
      "Open your homepage layout/template file.",
      "Paste the JSON-LD snippets below just before </head> on the homepage.",
      "Deploy, then validate in Google's Rich Results Test.",
      ...(faq ? ["(Optional) Ensure your on-page FAQ section matches the generated FAQPage items."] : [])
    ],
    codeSnippet,
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    estimatedScoreGain: template.estimatedGain,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: scanEvidence.technical?.structuredData || null,
    generatedBy: 'programmatic'
  };
}

function pickUnique(list = [], n = 10) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = String(item || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(item).trim());
    if (out.length >= n) break;
  }
  return out;
}

function deriveTopicsFromFacts(facts) {
  const topics = new Set();

  const pushFromArrayFact = (name) => {
    const v = facts.find(f => f.name === name)?.value;
    if (Array.isArray(v)) v.forEach(x => typeof x === 'string' && topics.add(x));
  };
  const pushFromStringFact = (name) => {
    const v = facts.find(f => f.name === name)?.value;
    if (typeof v === 'string') {
      v.split(/[,\|/]/).forEach(x => topics.add(x.trim()));
    }
  };

  pushFromArrayFact('services');
  pushFromArrayFact('products');
  pushFromArrayFact('features');
  pushFromArrayFact('audiences');
  pushFromStringFact('description');
  pushFromStringFact('tagline');

  // prune short/noisy
  return Array.from(topics).filter(t => t && t.length > 2).slice(0, 20);
}

function proposeQuestionHeadings(industryId, facts) {
  const brand = facts.find(f=>f.name==='brand')?.value || facts.find(f=>f.name==='site_name')?.value || 'your business';
  const topics = deriveTopicsFromFacts(facts);

  // Industry-specific question seeds library
  const SEEDS = {
    saas: [
      `What is ${brand}?`,
      `How does ${brand} work?`,
      `Who is ${brand} best for?`,
      `How much does ${brand} cost?`,
      `What problems does ${brand} solve?`,
      `How secure is ${brand}?`,
      `Does ${brand} integrate with my tools?`,
      `How long does ${brand} take to implement?`,
      `What's the ROI of ${brand}?`,
      `How is ${brand} different from alternatives?`
    ],
    ai_infrastructure: [
      `How do I reduce GPU costs without losing performance?`,
      `What infrastructure supports sub-100ms inference at scale?`,
      `How do I choose between A100, H100, and L4 for my workload?`,
      `How can I optimize GPU utilization for transformer training?`,
      `What benchmarking metrics matter for production inference?`,
      `How does autoscaling work for bursty inference traffic?`,
      `What SLAs should I expect for AI infrastructure?`,
      `How do I secure model artifacts and datasets?`,
      `What's the best way to deploy multi-model routing?`
    ],
    ecommerce: [
      `What products does ${brand} sell?`,
      `How long does shipping take?`,
      `What is the return policy?`,
      `How do I track my order?`,
      `What payment methods do you accept?`,
      `Do you offer free shipping?`,
      `How do I know what size to order?`,
      `Are your products authentic?`,
      `Do you ship internationally?`,
      `How can I contact customer service?`
    ],
    healthcare: [
      `How do I schedule an appointment?`,
      `What insurance do you accept?`,
      `What should I bring to my first visit?`,
      `How do I access my medical records?`,
      `What are your office hours?`,
      `Do you offer telehealth appointments?`,
      `How long will my appointment take?`,
      `What safety measures are in place?`,
      `How do I request a prescription refill?`,
      `What if I need to cancel my appointment?`
    ],
    agency: [
      `What services does ${brand} provide?`,
      `How much do your services cost?`,
      `What's your typical project timeline?`,
      `Who are your ideal clients?`,
      `Can you show me case studies?`,
      `What makes ${brand} different from other agencies?`,
      `How do you measure success?`,
      `What's your process for new clients?`,
      `Do you offer ongoing support after launch?`,
      `How do I get started with ${brand}?`
    ],
    real_estate: [
      `How do I search for homes in my area?`,
      `What's the current market value of my home?`,
      `How long does it take to sell a home?`,
      `What are closing costs?`,
      `How do I schedule a showing?`,
      `Do you help with first-time home buyers?`,
      `What neighborhoods do you serve?`,
      `How is the local housing market?`,
      `What's your commission rate?`,
      `How do I get pre-approved for a mortgage?`
    ],
    financial: [
      `How do I open an account?`,
      `What are your interest rates?`,
      `Is my money FDIC insured?`,
      `What fees do you charge?`,
      `How do I access my account online?`,
      `What types of accounts do you offer?`,
      `How long does a loan approval take?`,
      `What credit score do I need?`,
      `How do I contact customer support?`,
      `Are there any minimum balance requirements?`
    ],
    legal: [
      `What types of cases does ${brand} handle?`,
      `How much do legal services cost?`,
      `Do you offer free consultations?`,
      `How long will my case take?`,
      `What are my legal rights?`,
      `How do I know if I have a strong case?`,
      `What should I bring to my consultation?`,
      `How do you communicate with clients?`,
      `What is your success rate?`,
      `How do I get started?`
    ],
    restaurant: [
      `What are your hours?`,
      `Do you take reservations?`,
      `What's on your menu?`,
      `Do you offer takeout or delivery?`,
      `Do you have vegetarian/vegan options?`,
      `What are your most popular dishes?`,
      `Do you accommodate dietary restrictions?`,
      `Where can I park?`,
      `Do you have outdoor seating?`,
      `How do I make a reservation?`
    ],
    generic: [
      `What is ${brand}?`,
      `How does ${brand} help my business?`,
      `Who should use ${brand}?`,
      `How much does it cost to use ${brand}?`,
      `How do I get started with ${brand}?`,
      `What are the benefits of using ${brand}?`,
      `What support does ${brand} provide?`,
      `How does ${brand} compare to alternatives?`
    ]
  };

  // Expand seeds with topic-based questions
  const topicQs = topics.flatMap(t => ([
    `What is ${t}?`,
    `How does ${t} work?`,
    `Why is ${t} important?`,
    `How do I implement ${t}?`,
    `What are best practices for ${t}?`
  ]));

  // Match industry to seeds (case-insensitive, partial match)
  const industryLower = (industryId || '').toLowerCase();
  const base =
    industryLower.includes('ai_infrastructure') || industryLower.includes('ai infrastructure') ? SEEDS.ai_infrastructure :
    industryLower.includes('saas') || industryLower.includes('software') ? SEEDS.saas :
    industryLower.includes('ecommerce') || industryLower.includes('e-commerce') || industryLower.includes('retail') ? SEEDS.ecommerce :
    industryLower.includes('health') || industryLower.includes('medical') ? SEEDS.healthcare :
    industryLower.includes('agency') || industryLower.includes('marketing') ? SEEDS.agency :
    industryLower.includes('real') || industryLower.includes('estate') ? SEEDS.real_estate :
    industryLower.includes('financial') || industryLower.includes('bank') || industryLower.includes('fintech') ? SEEDS.financial :
    industryLower.includes('legal') || industryLower.includes('law') || industryLower.includes('attorney') ? SEEDS.legal :
    industryLower.includes('restaurant') || industryLower.includes('food') ? SEEDS.restaurant :
    SEEDS.generic;

  return pickUnique([...base, ...topicQs], 12);
}

async function makeProgrammaticQuestionHeadingsRecommendation(issue, scanEvidence, industry) {
  console.log('🎯 Starting Question Headings recommendation generation...');
  const { profile, facts } = normalizeEvidence(scanEvidence);
  const domain = extractDomain(scanEvidence.url);
  const pageUrl = scanEvidence.url || '';

  // Extract page name from URL slug or SEO title
  let pageTitle = '';
  try {
    const urlObj = new URL(pageUrl);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    if (pathParts.length > 0) {
      // Get the last meaningful part of the path (the slug)
      const slug = pathParts[pathParts.length - 1];
      // Convert slug to title case (e.g., "ai-marketing-services" → "AI Marketing Services")
      pageTitle = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  } catch (e) {
    // Fallback to empty string if URL parsing fails
  }

  // If no slug, try metadata title, otherwise use generic label
  if (!pageTitle) {
    pageTitle = scanEvidence.metadata?.title || 'this page';
  }

  // Extract actual headings from the page
  const allH2s = scanEvidence.content?.headings?.h2 || [];
  const allH3s = scanEvidence.content?.headings?.h3 || [];
  const allHeadings = [...allH2s, ...allH3s];

  // Count question vs statement headings
  const questionHeadings = allHeadings.filter(h => h.trim().endsWith('?'));
  const statementHeadings = allHeadings.filter(h => !h.trim().endsWith('?'));
  const questionPercent = allHeadings.length > 0
    ? Math.round((questionHeadings.length / allHeadings.length) * 100)
    : 0;

  // Build Finding with actual examples from the page
  const exampleStatementHeadings = statementHeadings.slice(0, 3);
  const exampleQuestionHeadings = questionHeadings.slice(0, 2);

  const findingParts = [];

  if (questionHeadings.length > 0) {
    findingParts.push(`Your ${pageTitle ? `"${pageTitle}" page` : 'page'} already includes ${questionHeadings.length} question-based heading${questionHeadings.length === 1 ? '' : 's'}:`);
    findingParts.push('');
    exampleQuestionHeadings.forEach(q => {
      findingParts.push(`• "${q}"`);
    });
    findingParts.push('');
    findingParts.push(`${questionHeadings.length > 2 ? 'These provide' : 'This provides'} a solid foundation for AI-readable, conversational content.`);
  } else {
    findingParts.push(`Your ${pageTitle ? `"${pageTitle}" page` : 'page'} currently uses ${statementHeadings.length} statement-based headings with no question-format H2/H3s.`);
  }

  findingParts.push('');

  if (statementHeadings.length > 0) {
    findingParts.push(`However, ${statementHeadings.length} important section${statementHeadings.length === 1 ? '' : 's'} still ${statementHeadings.length === 1 ? 'relies' : 'rely'} on statement-based headings rather than question-based H2/H3s:`);
    findingParts.push('');
    exampleStatementHeadings.forEach(s => {
      findingParts.push(`• "${s}"`);
    });
    findingParts.push('');
    findingParts.push(`As a result, your Direct Answer Structure sub-score remains partially optimized (${questionPercent}% question-format headings).`);
  }

  const finding = findingParts.join('\n');

  // Calculate impact points
  const potentialGainMin = Math.max(8, Math.round(issue.gap * 0.6));
  const potentialGainMax = Math.max(12, Math.round(issue.gap * 0.9));

  const impact = `Impact: High | +${potentialGainMin} to +${potentialGainMax} pts potential

AI assistants prioritize pages that mirror how users ask questions. Shifting remaining static headings into natural-language questions will:
• Strengthen your content's eligibility for AI citations and "People Also Ask" features
• Raise your Direct Answer Structure and Entity Clarity metrics
• Improve user scannability and dwell time by matching reading rhythm to question-and-answer flow`;

  // Build action steps
  const actionSteps = [
    `1️⃣ Identify non-question headings on this page — ${exampleStatementHeadings.length > 0 ? `e.g., "${exampleStatementHeadings[0]}"` : 'review all H2/H3 headings'}`,
    '2️⃣ Rewrite them as question-based H2/H3s that mirror how buyers would ask',
    '3️⃣ Pair each question with a concise (50–150 word) answer written in conversational tone and active voice',
    '4️⃣ Validate readability and AI parsing: target Flesch > 65 and average sentence < 20 words',
    '5️⃣ Re-scan this page after publishing to confirm improvement in AI Search Readiness and Entity Clarity metrics'
  ];

  // Generate customized before/after examples for the top statement headings
  const customizedSections = [];

  const topHeadings = statementHeadings.slice(0, 3);
  console.log(`📝 Processing ${topHeadings.length} headings with ChatGPT...`);

  // Process all headings in parallel for better performance
  const sectionPromises = topHeadings.map(async (heading, idx) => {
    const questionVersion = await convertToQuestionHeading(heading, industry, facts);
    const exampleAnswer = await generateExampleAnswer(heading, questionVersion, industry, facts);

    return {
      sectionNumber: idx + 1,
      sectionTitle: heading,
      before: `<h2>${heading}</h2>`,
      after: `<h2>${questionVersion}</h2>`,
      suggestedAnswer: exampleAnswer
    };
  });

  // Wait for all conversions to complete
  const sections = await Promise.all(sectionPromises);
  customizedSections.push(...sections);

  // Build customized implementation text
  const customizedImplementation = buildCustomizedImplementationText(customizedSections, pageUrl);

  // Build code snippet with before/after examples
  const codeSnippet = buildQuestionHeadingsCodeSnippet(customizedSections);

  // Implementation notes
  const implementationNotes = [
    'Keep each answer concise (80–150 words) and start with a direct response',
    'Use conversational tone and active voice',
    'Target Flesch readability score > 65',
    'Ensure each H2/H3 question is followed immediately by answer content',
    'Avoid overly technical jargon unless your audience demands it'
  ];

  // Quick wins
  const quickWins = [
    `Add 2–3 question-based H2/H3 headings in your main content sections`,
    'Ensure each answer is 80–150 words and starts with a direct response',
    `${questionHeadings.length === 0 ? 'Add FAQ schema for existing question content' : 'Expand your FAQ schema to include new questions'}`,
    'Re-scan this page after publishing to measure lift in Direct Answer Structure (sub-factor 1a)'
  ];

  // Validation checklist
  const validationChecklist = [
    '≥ 70% of H2/H3 are question-formatted',
    'Average answer length 80–150 words',
    'Flesch readability score > 65',
    'Each question immediately followed by answer content',
    'No orphaned questions (every Q has an A)'
  ];

  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: "AI Search Readiness: Direct Answer Structure (Question-Based Headings Enhancement)",
    category: issue.category,
    subfactor: "questionHeadingsScore",
    priority: issue.severity || 'high',
    priorityScore: issue.priority || 85,
    finding: finding,
    impact: impact,
    actionSteps: actionSteps,
    customizedImplementation: customizedImplementation,
    readyToUseContent: null, // Not applicable for this subfactor
    codeSnippet: codeSnippet,
    implementationNotes: implementationNotes,
    quickWins: quickWins,
    validationChecklist: validationChecklist,
    estimatedTime: "45–90 minutes",
    difficulty: "Easy",
    estimatedScoreGain: potentialGainMax,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: {
      totalHeadings: allHeadings.length,
      questionHeadings: questionHeadings.length,
      statementHeadings: statementHeadings.length,
      questionPercent: questionPercent,
      exampleStatements: exampleStatementHeadings,
      exampleQuestions: exampleQuestionHeadings
    },
    generatedBy: 'programmatic_question_headings'
  };
}

// Helper: Convert statement heading to question format (ChatGPT-powered)
async function convertToQuestionHeading(statement, industry, facts) {
  const brandName = factValue(facts, 'brand') || 'your company';

  // Fallback for when OpenAI is not available
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not found - using fallback conversion');
    const cleanedStatement = statement.replace(/^(our|the)\s+/i, '').trim();
    return `What is ${cleanedStatement}?`;
  }

  try {
    console.log(`🤖 Converting heading with ChatGPT: "${statement}"`);
    const prompt = `Convert this heading to a natural, conversational question that preserves the original meaning and intent.

Heading: "${statement}"
Brand: ${brandName}
Industry: ${industry || 'general'}

Rules:
- Preserve the exact meaning and intent of the original heading
- Make it sound natural (how a real person would ask)
- Use conversational, engaging tone
- Keep it under 15 words
- Don't just add "What is" or "How does" - be creative and contextual
- If it's already question-like, refine it naturally
- Return ONLY the question, nothing else

Example transformations:
- "Stop Marketing Like It's 2019." → "Why should modern companies rethink their marketing strategies?"
- "Our Services" → "What services do we offer?"
- "About Our Team" → "Who's behind our work?"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 60,
      messages: [
        { role: 'system', content: 'You are an expert copywriter converting headings to natural questions. Be creative and preserve meaning.' },
        { role: 'user', content: prompt }
      ]
    });

    const question = response.choices[0].message.content.trim();
    console.log(`✅ ChatGPT conversion successful: "${question}"`);
    return question;
  } catch (error) {
    console.error('❌ Error converting heading to question:', error.message);
    console.error('❌ Full error:', error);
    // Fallback to simple conversion
    const cleanedStatement = statement.replace(/^(our|the)\s+/i, '').trim();
    return `What is ${cleanedStatement}?`;
  }
}

// Helper: Generate example answer for a heading (ChatGPT-powered)
async function generateExampleAnswer(heading, questionVersion, industry, facts) {
  const brandName = factValue(facts, 'brand') || 'Our company';
  const location = factValue(facts, 'location') || '';
  const services = factValue(facts, 'services') || '';

  // Fallback for when OpenAI is not available
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not found - using fallback answer');
    return `${brandName} specializes in ${industry || 'our industry'} solutions. We help businesses achieve their goals through innovative strategies and proven methodologies.`;
  }

  try {
    console.log(`🤖 Generating answer with ChatGPT for: "${heading}"`);
    const contextInfo = [];
    if (location) contextInfo.push(`Location: ${location}`);
    if (services) contextInfo.push(`Services: ${services}`);

    const prompt = `Write a concise, direct answer to this question based on the heading context.

Original Heading: "${heading}"
Question Version: "${questionVersion}"
Brand: ${brandName}
Industry: ${industry || 'general'}
${contextInfo.length > 0 ? contextInfo.join('\n') : ''}

Requirements:
- Write 80-150 words maximum
- Start with a DIRECT answer (no fluff)
- Use conversational, engaging tone
- Use active voice and present tense
- Include specific value or benefits when possible
- Target Flesch readability > 65
- Make it sound natural and helpful
- Return ONLY the answer text, no extra formatting

The answer should help AI understand what ${brandName} offers and why it matters.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.5,
      max_tokens: 200,
      messages: [
        { role: 'system', content: 'You are a professional copywriter creating clear, engaging answers for website content. Focus on being helpful and direct.' },
        { role: 'user', content: prompt }
      ]
    });

    const answer = response.choices[0].message.content.trim();
    console.log(`✅ ChatGPT answer generation successful (${answer.length} chars)`);
    return answer;
  } catch (error) {
    console.error('❌ Error generating example answer:', error.message);
    console.error('❌ Full error:', error);
    // Fallback to generic answer
    return `${brandName} specializes in ${industry || 'our industry'} solutions. We help businesses achieve their goals through innovative strategies and proven methodologies.`;
  }
}

// Helper: Build customized implementation text
function buildCustomizedImplementationText(sections, pageUrl) {
  if (sections.length === 0) return 'No specific sections identified for conversion.';

  const parts = [`## Customized Implementation for This Page\n`];
  parts.push(`**Page:** ${pageUrl}\n`);

  sections.forEach(section => {
    parts.push(`\n### Section ${section.sectionNumber} — ${section.sectionTitle}\n`);
    parts.push(`**Replace:**`);
    parts.push(`\`\`\`html`);
    parts.push(section.before);
    parts.push(`\`\`\``);
    parts.push(``);
    parts.push(`**With:**`);
    parts.push(`\`\`\`html`);
    parts.push(section.after);
    parts.push(`\`\`\``);
    parts.push(``);
    parts.push(`**Suggested Answer:**`);
    parts.push(`<p>${section.suggestedAnswer}</p>`);
  });

  return parts.join('\n');
}

// Helper: Build code snippet with examples
function buildQuestionHeadingsCodeSnippet(sections) {
  if (sections.length === 0) {
    return `<!-- No specific heading conversions identified -->`;
  }

  const parts = [];
  parts.push(`<!-- Before/After Examples for Question-Based Headings -->\n`);

  sections.forEach(section => {
    parts.push(`<!-- Section ${section.sectionNumber}: ${section.sectionTitle} -->`);
    parts.push(`<!-- BEFORE: -->`);
    parts.push(`<!-- ${section.before} -->`);
    parts.push(``);
    parts.push(`<!-- AFTER: -->`);
    parts.push(section.after);
    parts.push(`<p>${section.suggestedAnswer}</p>`);
    parts.push(``);
  });

  return parts.join('\n');
}

function makeProgrammaticOpenGraphRecommendation(issue, scanEvidence) {
  const { facts } = normalizeEvidence(scanEvidence);
  const url = scanEvidence.url;
  let origin = '';
  try { origin = new URL(url).origin; } catch {}

  const title = factValue(facts, 'page_title') || factValue(facts, 'brand') || extractDomain(url);
  const desc  = factValue(facts, 'description') || 'Visit our site to learn more.';
  const logo  = factValue(facts, 'logo');
  const ogImg = factValue(facts, 'og_image') || (logo && origin ? new URL(logo, origin).href : '');
  const siteName = factValue(facts, 'site_name') || factValue(facts, 'brand') || extractDomain(url);

  const metaBlock =
`<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
${ogImg ? `<meta property="og:image" content="${ogImg}">` : ''} 
<meta property="og:site_name" content="${escapeHtml(siteName)}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
${ogImg ? `<meta name="twitter:image" content="${ogImg}">` : ''}`;

  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: "Add Open Graph & Twitter Card meta tags",
    category: issue.category,
    subfactor: "openGraphScore",
    priority: issue.severity || 'medium',
    priorityScore: issue.priority || 70,
    finding: `No or incomplete Open Graph metadata detected. Social previews and link shares will be poor or inconsistent.`,
    impact: "Improves social link previews (title/description/image) and helps AI assistants form rich entity cards.",
    actionSteps: sanitizeSteps([
  "Open your homepage template (e.g., index.html) and each key landing page.",
  "Paste the meta tags below inside the head block — keep one set per page.",
  "If available, set og:image and twitter:image to a 1200×630 image (JPG/PNG) hosted on your domain.",
  "Validate with Facebook Sharing Debugger and Twitter Card Validator, then re-scan."
]),
    codeSnippet: metaBlock,
    estimatedTime: "15–30 minutes",
    difficulty: "Easy",
    estimatedScoreGain: 8,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: scanEvidence.technical?.openGraph || null,
    generatedBy: 'programmatic'
  };
}

// -----------------------------------------
// Template (fallback) path
// -----------------------------------------

function generateSmartTemplate(issue, scanEvidence, _tier, _industry) {
  const tpl = RECOMMENDATION_TEMPLATES[issue.subfactor] || {
    title: `Improve ${issue.subfactor}`,
    impactArea: issue.category,
    whyItMatters: "This affects your AI visibility.",
    typicalTimeToFix: "Varies",
    difficulty: "Medium",
    estimatedGain: 10
  };

  const finding = buildSmartFinding(issue, scanEvidence);
  const actionSteps = generateContextAwareSteps(issue, scanEvidence);

  const result = {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: tpl.title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    finding,
    impact: tpl.whyItMatters,
    actionSteps,
    codeSnippet: '', // no placeholders
    estimatedTime: tpl.typicalTimeToFix,
    difficulty: tpl.difficulty,
    estimatedScoreGain: tpl.estimatedGain,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: null,
    generatedBy: 'smart_template'
  };

  return coerceRecommendation(result, tpl, issue);
}

function buildSmartFinding(issue, scanEvidence) {
  const subfactor = issue.subfactor;
  const evidence = issue.evidence || {};
  const domain = extractDomain(scanEvidence.url);
  const pageTitle = scanEvidence.metadata?.title || 'this page';
  const wordCount = scanEvidence.content?.wordCount || 0;

  // Structured Data
  if (subfactor === 'structuredDataScore') {
    const found = scanEvidence.technical?.structuredData?.length || 0;
    const types = found > 0 ? scanEvidence.technical.structuredData.map(s => s.type).join(', ') : '';

    // Determine which schemas are ACTUALLY missing
    const missing = [];
    if (!scanEvidence.technical?.hasOrganizationSchema) missing.push('Organization');
    if (!scanEvidence.technical?.hasFAQSchema) missing.push('FAQ');
    if (!scanEvidence.technical?.hasLocalBusinessSchema) missing.push('LocalBusiness');
    if (!scanEvidence.technical?.hasBreadcrumbSchema) missing.push('BreadcrumbList');
    if (!scanEvidence.technical?.hasArticleSchema) missing.push('Article');

    if (!found) return `No Schema.org markup detected on ${domain}. Your ${wordCount} words of content are invisible to AI entity recognition.`;
    if (missing.length > 0) {
      return `Limited Schema.org on ${domain}. Found: ${types}. Missing: ${missing.join(', ')}. Adding these will improve AI citation accuracy.`;
    }
    return `Schema.org detected on ${domain}: ${types}. Consider enhancing with more specific schema types for your content.`;
  }

  // FAQ
  if (subfactor === 'faqScore') {
    const hasFAQSchema = scanEvidence.technical?.hasFAQSchema;
    const faqCount = scanEvidence.content?.faqs?.length || 0;
    if (!hasFAQSchema && faqCount > 0) return `Found ${faqCount} on-page FAQs on "${pageTitle}" but no FAQPage schema. Adding schema would enable AI citation of these answers.`;
    return `No FAQ content or schema on ${domain}. Your ${wordCount}-word page could be restructured into Q&A format to increase AI visibility.`;
  }

  // Alt Text
  if (subfactor === 'altTextScore' || subfactor === 'imageAltText') {
    const total = evidence.totalImages || scanEvidence.media?.imageCount || 0;
    const withAlt = evidence.imagesWithAlt || scanEvidence.media?.imagesWithAlt || 0;
    const missing = evidence.imagesWithoutAlt || scanEvidence.media?.imagesWithoutAlt || 0;
    const coverage = total > 0 ? Math.round((withAlt/total) * 100) : 0;
    return `Alt text coverage: ${coverage}% (${withAlt}/${total} images). ${missing} images missing alt text, making them invisible to multimodal AI search.`;
  }

  // Question Headings
  if (subfactor === 'questionHeadingsScore') {
    const h2s = scanEvidence.content?.headings?.h2?.length || 0;
    const h3s = scanEvidence.content?.headings?.h3?.length || 0;
    const questions = (scanEvidence.content?.headings?.h2?.filter(h => h.endsWith('?')).length || 0) +
                      (scanEvidence.content?.headings?.h3?.filter(h => h.endsWith('?')).length || 0);
    const pct = (h2s + h3s) > 0 ? Math.round((questions / (h2s + h3s)) * 100) : 0;
    return `Only ${questions} of ${h2s + h3s} headings (${pct}%) are question-format on "${pageTitle}". Voice search queries are 75% question-based, limiting your AI discoverability.`;
  }

  // Open Graph
  if (subfactor === 'openGraphScore') {
    const missing = [];
    if (!scanEvidence.metadata?.ogTitle) missing.push('og:title');
    if (!scanEvidence.metadata?.ogDescription) missing.push('og:description');
    if (!scanEvidence.metadata?.ogImage) missing.push('og:image');
    if (!scanEvidence.metadata?.twitterCard) missing.push('twitter:card');
    if (missing.length > 0) {
      return `Open Graph incomplete on "${pageTitle}": missing ${missing.join(', ')}. When AI assistants or users share this page, it appears without proper preview.`;
    }
    return `Open Graph tags present but may need optimization (ensure 1200x630px image for best AI/social preview).`;
  }

  // Heading Hierarchy
  if (subfactor === 'headingHierarchyScore') {
    const h1Count = scanEvidence.structure?.headingCount?.h1 || 0;
    const issues = [];
    if (h1Count === 0) issues.push('Missing H1');
    if (h1Count > 1) issues.push(`${h1Count} H1s (should be exactly 1)`);
    if (issues.length > 0) {
      return `Heading hierarchy issues on "${pageTitle}": ${issues.join(', ')}. This confuses AI about your content structure and makes extracting key points harder.`;
    }
    return `Heading structure score ${issue.currentScore}/100. Better H1-H6 hierarchy will help AI understand content organization for accurate citations.`;
  }

  // Readability
  if (subfactor === 'readabilityScore') {
    return `Content readability score ${issue.currentScore}/100 on ${wordCount}-word page. AI assistants prefer 8th-10th grade reading level (Flesch 60-70) for better understanding and citation.`;
  }

  // Scannability
  if (subfactor === 'scannabilityScore') {
    const h2Count = scanEvidence.structure?.headingCount?.h2 || 0;
    const listCount = scanEvidence.content?.lists?.length || 0;
    if (h2Count < 3 && wordCount > 500) {
      return `Poor scannability: Only ${h2Count} H2 headings on ${wordCount}-word page. AI relies on headings to extract key points. Add 3-5 H2 sections.`;
    }
    if (listCount === 0 && wordCount > 500) {
      return `No bulleted/numbered lists on ${wordCount}-word page. Adding lists helps AI extract key takeaways and features.`;
    }
    return `Scannability score ${issue.currentScore}/100. More structure (headings, lists, tables) helps AI understand and cite your content.`;
  }

  // Generic fallback with context
  return `Your ${subfactor} score is ${issue.currentScore}/100 on "${pageTitle}" (target ${issue.threshold}/100). Gap: ${issue.gap} points. Improvements needed for AI visibility.`;
}

function generateContextAwareSteps(issue, scanEvidence) {
  const subfactor = issue.subfactor;
  const domain = extractDomain(scanEvidence.url);
  const wordCount = scanEvidence.content?.wordCount || 0;
  const imageCount = scanEvidence.media?.imageCount || 0;

  // Structured Data - already has programmatic generator, but fallback here
  if (subfactor === 'structuredDataScore') {
    return [
      'Open your homepage template file (e.g., index.html or header.php).',
      'Add Organization, WebSite, and WebPage JSON-LD before </head>.',
      `Validate at schema.org/validator and Google Rich Results Test.`,
      'Submit updated page to Google Search Console for indexing.'
    ];
  }

  // FAQ Schema
  if (subfactor === 'faqScore') {
    const faqCount = scanEvidence.content?.faqs?.length || 0;
    if (faqCount > 0) {
      return [
        `Your page has ${faqCount} FAQ pairs detected - add FAQPage schema to mark them up.`,
        'Copy the FAQ JSON-LD code from the CODE section below.',
        'Paste it into your page template before </head>.',
        `Match each schema Q&A to your on-page content exactly.`,
        'Validate with Google Rich Results Test.',
        'Monitor FAQ rich snippets in Search Console.'
      ];
    }
    return [
      `Identify 5-10 common questions customers ask about ${domain}.`,
      'Write comprehensive answers (100-250 words each).',
      'Add Q&A content to your page in a dedicated FAQ section.',
      'Implement FAQPage schema matching your on-page content.',
      'Validate with Rich Results Test and re-scan.'
    ];
  }

  // Alt Text
  if (subfactor === 'altTextScore' || subfactor === 'imageAltText') {
    const missing = scanEvidence.media?.imagesWithoutAlt || 0;
    return [
      `Audit all ${imageCount} images on ${domain} - ${missing} are missing alt text.`,
      'Prioritize: Hero images, product photos, infographics, team photos.',
      'Write descriptive alt text explaining what\'s shown (10-15 words).',
      'For decorative images (borders, backgrounds), use empty alt="".',
      'Update your CMS to require alt text before publishing.',
      'Re-run scan to verify 90%+ coverage.'
    ];
  }

  // Question Headings
  if (subfactor === 'questionHeadingsScore') {
    const h2Count = scanEvidence.structure?.headingCount?.h2 || 0;
    return [
      `Audit your ${h2Count} H2/H3 headings - rewrite 30-50% as natural questions.`,
      'Use questions users actually search: check Google autocomplete.',
      'Start with: Who, What, When, Where, Why, How.',
      'Example: Change "Our Services" to "What services does ${domain} offer?"',
      'Place questions as H2 headings with answers in following paragraphs.',
      'Test voice search: read headings aloud to verify they sound natural.'
    ];
  }

  // Open Graph Tags
  if (subfactor === 'openGraphScore') {
    return [
      'Open your site\'s <head> template file.',
      'Add the Open Graph meta tags from the CODE section below.',
      'Create a 1200x630px image for og:image (JPG or PNG).',
      'Ensure og:description is compelling (155-160 characters).',
      'Validate with Facebook Sharing Debugger and Twitter Card Validator.',
      'Re-scan to verify all tags are detected.'
    ];
  }

  // Heading Hierarchy
  if (subfactor === 'headingHierarchyScore') {
    const h1Count = scanEvidence.structure?.headingCount?.h1 || 0;
    if (h1Count === 0 || h1Count > 1) {
      return [
        h1Count === 0 ? 'Add exactly ONE H1 tag to your page with your primary keyword/topic.' : `Reduce from ${h1Count} H1 tags to exactly 1 (merge or change extras to H2).`,
        'Structure content: H1 → H2 for main sections → H3 for subsections.',
        'Never skip levels (don\'t go H1 → H3 directly).',
        'Make headings descriptive: "How We Help" not "Section 1".',
        'Use a heading hierarchy analyzer to visualize structure.',
        'Re-scan to verify structure score improves.'
      ];
    }
    return [
      'Ensure you have exactly ONE H1 tag per page.',
      'Use 3-5 H2 tags for main sections.',
      'Use H3 tags for subsections under each H2.',
      'Never skip heading levels (H1 → H2 → H3, not H1 → H3).',
      'Make headings scannable and descriptive for AI parsing.'
    ];
  }

  // Readability
  if (subfactor === 'readabilityScore') {
    return [
      `Review your ${wordCount}-word page for complex sentences and jargon.`,
      'Target reading level: 8th-10th grade (Flesch score 60-70).',
      'Break long sentences (aim for 15-20 words per sentence).',
      'Use active voice: "We analyze data" not "Data is analyzed by us".',
      'Define technical terms or link to glossary.',
      'Use tools like Hemingway Editor or readable.com to check score.',
      'Re-scan to verify improved readability.'
    ];
  }

  // Scannability
  if (subfactor === 'scannabilityScore') {
    const h2Count = scanEvidence.structure?.headingCount?.h2 || 0;
    const recommended = Math.max(3, Math.round(wordCount / 300));
    return [
      `Add ${Math.max(0, recommended - h2Count)} more H2 headings to break up ${wordCount} words.`,
      'Convert paragraphs into bulleted lists where appropriate (features, benefits, steps).',
      'Use numbered lists for sequential instructions or processes.',
      'Add bold/italic for emphasis on key points.',
      'Keep paragraphs short: 50-100 words maximum.',
      'Re-scan to verify scannability score improves.'
    ];
  }

  // Sitemap
  if (subfactor === 'sitemapScore') {
    return [
      'Generate XML sitemap using your CMS plugin or sitemap generator tool.',
      'Include all important pages with priority (0.0-1.0) and changefreq.',
      'Add lastmod dates to show content freshness.',
      'Upload sitemap to /sitemap.xml on your root domain.',
      'Submit sitemap URL to Google Search Console and Bing Webmaster Tools.',
      'Set up automatic updates when you publish new content.'
    ];
  }

  // Crawler Access
  if (subfactor === 'crawlerAccessScore') {
    return [
      'Check robots.txt - ensure it\'s not blocking important pages.',
      'Review meta robots tags - remove "noindex" from pages you want indexed.',
      'Test with Google Search Console URL Inspection tool.',
      'Ensure canonical tags point to correct URLs.',
      'Link your XML sitemap in robots.txt: "Sitemap: https://' + domain + '/sitemap.xml"',
      'Monitor crawl stats in Search Console for errors.'
    ];
  }

  // Videos/Captions
  if (subfactor === 'captionsTranscriptsScore' || subfactor === 'videoTranscripts') {
    const videoCount = scanEvidence.media?.videoCount || 0;
    if (videoCount > 0) {
      return [
        `Audit your ${videoCount} videos - add captions and transcripts to each.`,
        'Use YouTube/Vimeo auto-captioning as starting point, then edit for accuracy.',
        'Ensure product names, brand terms, and technical terms are spelled correctly.',
        'Add full transcript below each video on the page.',
        'Include speaker names and timestamps for multi-speaker content.',
        'Add download link for transcript PDF.',
        'Re-scan to verify transcripts are detected.'
      ];
    }
    return [
      'If you have video content, ensure all videos have captions enabled.',
      'Add full text transcripts below each video.',
      'Use auto-captioning tools as starting point, then edit for accuracy.',
      'Include transcripts in your sitemap for SEO.',
      'Re-scan after adding transcripts.'
    ];
  }

  // Generic fallback - still helpful
  return [
    `Open the relevant page/template for ${domain}.`,
    `Review current ${subfactor} implementation against best practices.`,
    'Make necessary changes based on the recommendations above.',
    'Validate changes with automated tools (validators, analyzers).',
    'Re-run the scan to verify score improvement.',
    'Monitor impact on AI visibility over 2-4 weeks.'
  ];
}

// -----------------------------------------
// Shared utilities (patched)
// -----------------------------------------

function escapeHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// --- TEXT SANITIZER: escape HTML in user-visible text (not in code) ---
function escapeAngleBrackets(s = '') {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeStepText(s = '') {
  // 1) escape angle brackets so UI doesn't strip them
  let out = escapeAngleBrackets(s);
  // 2) collapse stray backticks-only artifacts (```/` blocks that got split)
  out = out.replace(/^\s*`+\s*$/g, '').replace(/\s*`+\s*/g, '`');
  // 3) trim
  return out.trim();
}

function sanitizeSteps(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(sanitizeStepText)
    .filter(Boolean);
}

function stripCodeFences(code) {
  if (!code) return '';
  // Remove markdown code fences (```language and closing ```)
  return code.replace(/^```\w*\n?/gm, '').replace(/\n?```$/gm, '').trim();
}

// PATCH A1 — robust section parsing
function extractSection(response, sectionName) {
  const text = String(response || '');

  // 1) Strict [SECTION] ... [NEXT]
  const strict = new RegExp(
    `\\[${sectionName}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)`,
    'i'
  );
  const m1 = text.match(strict);
  if (m1) return m1[1].trim();

  // 2) Tolerant headings like ## FINDING or **FINDING**
  const tolerant = new RegExp(
    `^(?:#{1,3}\\s*|\\*\\*\\s*)${sectionName}(?:\\s*\\*\\*|\\s*)\\s*([\\s\\S]*?)(?=^\\s*(?:#{1,3}\\s*|\\*\\*\\s*)[A-Z]|$)`,
    'im'
  );
  const m2 = text.match(tolerant);
  return m2 ? m2[1].trim() : '';
}

// PATCH A2 — safer step extraction
function extractActionSteps(response) {
  const section = extractSection(response, 'APPLY INSTRUCTIONS') || extractSection(response, 'ACTION STEPS');
  if (!section) {
    console.log('❌ No APPLY INSTRUCTIONS section found!');
    return [];
  }

  console.log('📋 SECTION FOUND (first 600 chars):', section.slice(0, 600));
  
  const lines = section.split('\n');
  const steps = [];
  
  console.log('📋 Total lines to process:', lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    
    console.log(`  Line ${i}: "${line.slice(0, 80)}"`);
    
    // Match numbered steps: "1.", "2.", etc.
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      console.log(`    ✓ MATCHED: "${numberedMatch[2].slice(0, 60)}"`);
      steps.push(numberedMatch[2].trim());
    }
  }
  
  console.log('📋 EXTRACTED STEPS:', steps);
  return steps.filter(s => s.length >= 10);
}
// Helper for length safety
function clamp(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// PATCH B — coerce/guard final recommendation
function coerceRecommendation(rec, template, issue) {
  // Ensure non-empty sections
  if (!rec.finding || rec.finding.length < 20) {
    rec.finding = `Your ${issue.subfactor} score is ${issue.currentScore}/100; improvements are needed to reach ${issue.threshold}/100.`;
  }
  if (!rec.impact || rec.impact.length < 20) {
    rec.impact = template.whyItMatters || 'This affects your AI visibility.';
  }
  if (!Array.isArray(rec.actionSteps) || rec.actionSteps.length === 0) {
    rec.actionSteps = [
      `Open the relevant template/page for ${issue.subfactor}.`,
      'Apply the code/content changes below.',
      'Validate with the recommended validator and re-scan.'
    ];
  }
  if (typeof rec.codeSnippet !== 'string') rec.codeSnippet = '';

  // Length guards (tune to your DB column sizes)
  rec.finding     = clamp(rec.finding,     1500);
  rec.impact      = clamp(rec.impact,      2200);
  rec.codeSnippet = clamp(rec.codeSnippet, 20000);
  rec.actionSteps = rec.actionSteps.map(s => clamp(s, 600)).slice(0, 12);

  return rec;
}

// parse GPT response to our object (then coerced by caller)
function structureRecommendation(aiResponse, issue, template, tier, source) {
  // Debug (first 400 chars)
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n--- FULL GPT RESPONSE ---\n', aiResponse, '\n----------------------\n');
  }

  // 🔍 EXTRACTION DEBUG
  const rawSteps = extractActionSteps(aiResponse);
  const rawCode = extractSection(aiResponse, 'PRE-FILLED JSON-LD') || extractSection(aiResponse, 'CODE');
  
  console.log('🔍 EXTRACTION DEBUG:');
  console.log('  Raw steps found:', rawSteps?.length, 'steps');
  console.log('  Raw code found:', rawCode?.length, 'chars');
  console.log('  First step:', rawSteps?.[0]?.slice(0, 100));

  // Extract title from ChatGPT response (fallback to template title)
  const extractedTitle = extractSection(aiResponse, 'TITLE');
  const title = extractedTitle ? extractedTitle.trim().replace(/^-\s*/, '') : template.title;

  return {
    id: `rec_${issue.category}_${issue.subfactor}_${Date.now()}`,
    title: title,
    category: issue.category,
    subfactor: issue.subfactor,
    priority: issue.severity,
    priorityScore: issue.priority,
    finding: escapeAngleBrackets(extractSection(aiResponse, 'FINDING') || ''),
    impact: escapeAngleBrackets(extractSection(aiResponse, 'IMPACT') || extractSection(aiResponse, 'IMPACT BREAKDOWN') || ''),
actionSteps: sanitizeSteps(extractActionSteps(aiResponse)),
    codeSnippet: tier !== 'free'
  ? stripCodeFences(extractSection(aiResponse, 'PRE-FILLED JSON-LD') || extractSection(aiResponse, 'CODE') || '')
  : '',
    estimatedTime: template.typicalTimeToFix,
    difficulty: template.difficulty,
    estimatedScoreGain: template.estimatedGain,
    currentScore: issue.currentScore,
    targetScore: issue.threshold,
    evidence: tier !== 'free' ? issue.evidence : null,
    generatedBy: source
  };
}

function buildSiteShapeDescription(profile) {
  const typeDesc = {
    single_page: 'Single-page site with in-page navigation',
    small_multi: 'Small multi-page site (≤10 pages)',
    multi: 'Multi-page website',
    blog: 'Blog or news site',
    saas: 'SaaS/Product site',
    local_business: 'Local business site'
  };
  const lines = [
    `- Type: ${typeDesc[profile.site_type] || profile.site_type}`,
    `- Pages scanned: ${profile.routes_count}`
  ];
  if (profile.anchors?.length) lines.push(`- In-page anchors: ${profile.anchors.join(', ')}`);

  const s = profile.sections || {};
  const has = [];
  if (s.has_faq) has.push('FAQ');
  if (s.has_pricing) has.push('Pricing');
  if (s.has_contact) has.push('Contact');
  if (s.has_blog) has.push('Blog');
  if (has.length) lines.push(`- Has: ${has.join(', ')} sections`);

  const missing = [];
  if (!s.has_faq) missing.push('FAQ');
  if (!s.has_blog && profile.site_type !== 'blog') missing.push('Blog');
  if (missing.length) lines.push(`- Missing: ${missing.join(', ')} sections`);

  return lines.join('\n');
}

function buildFactsSection(facts) {
  if (!facts?.length) return '- No facts extracted (site may be behind auth or empty).';

  // Prioritize important facts for ChatGPT context
  const priorityOrder = ['brand', 'site_name', 'logo', 'description', 'tagline', 'services', 'products', 'features', 'audiences', 'contact_email', 'contact_phone', 'address', 'social_links'];
  const prioritized = [];
  const rest = [];

  for (const f of facts) {
    if (priorityOrder.includes(f.name)) {
      prioritized.push(f);
    } else {
      rest.push(f);
    }
  }

  // Sort prioritized by the order defined above
  prioritized.sort((a, b) => priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name));

  // Format with smart truncation and visual hierarchy
  const formatFact = (f) => {
    let val = f.value;

    // Smart formatting by type
    if (Array.isArray(val)) {
      if (val.length > 5) {
        val = val.slice(0, 5).join(', ') + ` (+${val.length - 5} more)`;
      } else {
        val = val.join(', ');
      }
    } else if (typeof val === 'string') {
      if (val.length > 150) {
        val = val.slice(0, 150) + '…';
      }
    }

    const parts = [`• ${f.name}: ${val}`];
    if (f.confidence && f.confidence < 0.8) parts.push(`[${Math.round(f.confidence * 100)}% confidence]`);
    return parts.join(' ');
  };

  const lines = [
    '**KEY IDENTIFIERS:**',
    ...prioritized.slice(0, 8).map(formatFact)
  ];

  if (rest.length > 0) {
    lines.push('\n**ADDITIONAL CONTEXT:**');
    lines.push(...rest.slice(0, 10).map(formatFact));
  }

  return lines.join('\n');
}

function buildCurrentState(issue, scanEvidence) {
  const sub = issue.subfactor;
  const ev = issue.evidence || {};
  const meta = scanEvidence.metadata || {};
  const content = scanEvidence.content || {};
  const tech = scanEvidence.technical || {};
  const struct = scanEvidence.structure || {};

  // Structured Data
  if (sub === 'structuredDataScore') {
    const found = tech.structuredData || [];
    const types = found.map(s => s.type).join(', ') || 'None';

    // Determine which schemas are ACTUALLY missing
    const missing = [];
    if (!tech.hasOrganizationSchema) missing.push('Organization');
    if (!tech.hasFAQSchema) missing.push('FAQ');
    if (!tech.hasLocalBusinessSchema) missing.push('LocalBusiness');
    if (!tech.hasBreadcrumbSchema) missing.push('BreadcrumbList');
    if (!tech.hasArticleSchema) missing.push('Article/BlogPosting');

    if (!found.length) {
      return `- No Schema.org detected\n- Missing: ${missing.join(', ')}\n- Page word count: ${content.wordCount || 0}`;
    }
    return `- Found ${found.length} Schema.org block(s): ${types}\n- Missing: ${missing.length > 0 ? missing.join(', ') : 'None - good coverage!'}\n- Page word count: ${content.wordCount || 0}`;
  }

  // FAQ
  if (sub === 'faqScore') {
    const hasFAQSchema = tech.hasFAQSchema;
    const faqCount = content.faqs?.length || 0;
    const questionHeadings = content.headings?.h2?.filter(h => h.endsWith('?')).length || 0;
    if (!hasFAQSchema && faqCount > 0) {
      return `- Detected ${faqCount} on-page FAQs without schema\n- ${questionHeadings} question-format headings found\n- Adding FAQ schema will enable AI citation`;
    }
    if (questionHeadings > 0) {
      return `- ${questionHeadings} question headings found but no FAQ content\n- Expand headings into Q&A pairs with 100-200 word answers`;
    }
    return `- No FAQ content or schema detected\n- ${content.wordCount || 0} words of content could be restructured as Q&A`;
  }

  // Alt Text / Images
  if (sub === 'altTextScore' || sub === 'imageAltText') {
    const total = ev.totalImages || scanEvidence.media?.imageCount || 0;
    const withAlt = ev.imagesWithAlt || scanEvidence.media?.imagesWithAlt || 0;
    const missing = ev.imagesWithoutAlt || scanEvidence.media?.imagesWithoutAlt || 0;
    const coverage = total > 0 ? Math.round((withAlt / total) * 100) : 0;
    return `- Images: ${total} total, ${withAlt} with alt (${coverage}% coverage), ${missing} missing\n- Priority: Hero images, product photos, infographics\n- Decorative images should use empty alt=""`;
  }

  // Question Headings
  if (sub === 'questionHeadingsScore') {
    const h2Count = content.headings?.h2?.length || 0;
    const h3Count = content.headings?.h3?.length || 0;
    const questionH2 = content.headings?.h2?.filter(h => h.endsWith('?')).length || 0;
    const questionH3 = content.headings?.h3?.filter(h => h.endsWith('?')).length || 0;
    const totalQuestions = questionH2 + questionH3;
    return `- Total headings: ${h2Count} H2s, ${h3Count} H3s\n- Question-format headings: ${totalQuestions} (${h2Count + h3Count > 0 ? Math.round((totalQuestions / (h2Count + h3Count)) * 100) : 0}%)\n- Target: 30-50% of headings should be questions`;
  }

  // Open Graph
  if (sub === 'openGraphScore') {
    const hasTitle = !!meta.ogTitle;
    const hasDesc = !!meta.ogDescription;
    const hasImage = !!meta.ogImage;
    const hasTwitter = !!meta.twitterCard;
    const missing = [];
    if (!hasTitle) missing.push('og:title');
    if (!hasDesc) missing.push('og:description');
    if (!hasImage) missing.push('og:image');
    if (!hasTwitter) missing.push('twitter:card');
    if (missing.length) {
      return `- Open Graph incomplete: missing ${missing.join(', ')}\n- Current: ${hasTitle ? '✓' : '✗'} title, ${hasDesc ? '✓' : '✗'} description, ${hasImage ? '✓' : '✗'} image, ${hasTwitter ? '✓' : '✗'} twitter`;
    }
    return `- Open Graph tags present but may need optimization\n- Ensure og:image is 1200x630px for best preview`;
  }

  // Heading Hierarchy
  if (sub === 'headingHierarchyScore') {
    const h1Count = struct.headingCount?.h1 || 0;
    const h2Count = struct.headingCount?.h2 || 0;
    const h3Count = struct.headingCount?.h3 || 0;
    const issues = [];
    if (h1Count === 0) issues.push('Missing H1');
    if (h1Count > 1) issues.push(`${h1Count} H1s (should be 1)`);
    if (h2Count === 0 && content.wordCount > 300) issues.push('No H2 sections');
    return `- Heading structure: ${h1Count} H1, ${h2Count} H2, ${h3Count} H3\n${issues.length ? `- Issues: ${issues.join(', ')}\n` : ''}- Content length: ${content.wordCount || 0} words`;
  }

  // Internal Linking
  if (sub === 'linkedSubpagesScore' || sub === 'internalLinking') {
    const internal = struct.internalLinks || 0;
    const hasBreadcrumbs = struct.hasBreadcrumbs;
    const hasTOC = struct.hasTOC;
    return `- Internal links: ${internal}\n- Breadcrumbs: ${hasBreadcrumbs ? 'Present' : 'Missing'}\n- Table of contents: ${hasTOC ? 'Present' : 'Missing'}\n- Recommended: ${Math.max(10, Math.round(content.wordCount / 150))} links for ${content.wordCount} words`;
  }

  // Readability
  if (sub === 'readabilityScore') {
    const wordCount = content.wordCount || 0;
    const paragraphs = content.paragraphs?.length || 0;
    const avgWordsPerPara = paragraphs > 0 ? Math.round(wordCount / paragraphs) : 0;
    return `- Content: ${wordCount} words in ${paragraphs} paragraphs\n- Average paragraph length: ${avgWordsPerPara} words\n- Target: 50-100 words per paragraph for AI readability\n- Flesch score target: 60-70 (8th-10th grade level)`;
  }

  // Scannability
  if (sub === 'scannabilityScore') {
    const h2Count = struct.headingCount?.h2 || 0;
    const listCount = content.lists?.length || 0;
    const wordCount = content.wordCount || 0;
    return `- Content: ${wordCount} words\n- Structure: ${h2Count} H2 headings, ${listCount} lists\n- Recommended: ${Math.max(3, Math.round(wordCount / 300))} H2 headings for ${wordCount} words\n- Add: Bulleted lists for features/benefits, numbered lists for steps`;
  }

  // Sitemap
  if (sub === 'sitemapScore') {
    const hasSitemap = tech.hasSitemapLink;
    const hasRobots = !!tech.robotsMeta;
    return `- XML Sitemap: ${hasSitemap ? 'Detected' : 'Not found'}\n- Robots.txt: ${hasRobots ? 'Present' : 'Missing'}\n${hasSitemap ? '- Ensure sitemap submitted to Google Search Console' : '- Create sitemap at /sitemap.xml'}`;
  }

  // Crawler Access
  if (sub === 'crawlerAccessScore') {
    const hasRobots = !!tech.robotsMeta;
    const hasCanonical = tech.hasCanonical;
    const hasSitemap = tech.hasSitemapLink;
    return `- Robots meta: ${hasRobots ? tech.robotsMeta : 'Not set'}\n- Canonical tag: ${hasCanonical ? 'Present' : 'Missing'}\n- Sitemap: ${hasSitemap ? 'Linked' : 'Not linked'}\n- Ensure no accidental blocking of AI crawlers`;
  }

  // Videos/Captions
  if (sub === 'captionsTranscriptsScore' || sub === 'videoTranscripts') {
    const videoCount = scanEvidence.media?.videoCount || 0;
    if (videoCount > 0) {
      return `- Videos detected: ${videoCount}\n- Transcripts: Not detected\n- Adding transcripts makes ${videoCount} videos searchable and quotable by AI`;
    }
    return `- No video content detected\n- If you have videos, ensure they have captions and full transcripts`;
  }

  // Generic fallback with more context
  return `- Current score: ${issue.currentScore}/100 (target: ${issue.threshold}/100)\n- Gap: ${issue.gap} points\n- Page word count: ${content.wordCount || 0}\n- Improvement needed for AI visibility`;
}

function calculateScoreBreakdown(issue) {
  const gap = Math.max(0, issue.gap || (issue.threshold - issue.currentScore) || 0);
  const maxGain = Math.min(Math.round(gap * 0.85), 40);
  const coverage = Math.round(maxGain * 0.4);
  const completeness = Math.round(maxGain * 0.3);
  const consistency = Math.round(maxGain * 0.2);
  const crawlability = maxGain - (coverage + completeness + consistency);
  return {
    min: Math.max(8, Math.round(maxGain * 0.6)),
    max: maxGain,
    coverage: `+${coverage} pts (missing types)`,
    completeness: `+${completeness} pts (empty fields)`,
    consistency: `+${consistency} pts (duplicates/conflicts)`,
    crawlability: `+${crawlability} pts (placement/URLs)`
  };
}

function determineNeededSchemas(issue, profile, scanEvidence) {
  const schemas = [];
  if (issue.subfactor === 'structuredDataScore') {
    const existing = (scanEvidence.technical?.structuredData || []).map(s => s.type);
    const hasOrganization = scanEvidence.technical?.hasOrganizationSchema || existing.includes('Organization');
    const hasLocalBusiness = scanEvidence.technical?.hasLocalBusinessSchema || existing.includes('LocalBusiness');
    const hasFAQ = scanEvidence.technical?.hasFAQSchema || existing.includes('FAQPage');
    const hasArticle = scanEvidence.technical?.hasArticleSchema || existing.includes('Article') || existing.includes('BlogPosting');
    const hasBreadcrumb = scanEvidence.technical?.hasBreadcrumbSchema || existing.includes('BreadcrumbList');

    // Only recommend schemas that are MISSING
    if (!hasOrganization) {
      schemas.push({ type: 'Organization', useData: 'brand, logo, sameAs, address, contact' });
    }
    if (!existing.includes('WebSite')) {
      schemas.push({ type: 'WebSite', useData: 'url, name, publisher→Organization' });
    }
    if (profile.site_type === 'local_business' && !hasLocalBusiness) {
      schemas.push({ type: 'LocalBusiness', useData: 'address, phone, opening hours, geo coordinates' });
    }
    if (profile.site_type === 'saas' && !existing.includes('SoftwareApplication')) {
      schemas.push({ type: 'SoftwareApplication', useData: 'name, description, offers (optional)' });
    }
    if (!hasFAQ && profile.sections?.has_faq) {
      schemas.push({ type: 'FAQPage', useData: 'on-page Q/A pairs' });
    }
    if (!hasBreadcrumb && profile.site_type !== 'simple_site') {
      schemas.push({ type: 'BreadcrumbList', useData: 'navigation hierarchy' });
    }
  }
  if (issue.subfactor === 'faqScore') {
    const hasFAQ = scanEvidence.technical?.hasFAQSchema;
    if (!hasFAQ) {
      schemas.push({ type: 'FAQPage', useData: 'on-page Q/A pairs' });
    }
  }
  return schemas;
}

// -----------------------------------------
// Exports
// -----------------------------------------

module.exports = {
  generateRecommendations
};
