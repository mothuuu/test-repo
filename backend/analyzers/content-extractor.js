const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const EntityAnalyzer = require('./entity-analyzer');

/**
 * Content Extractor for V5 Rubric Analysis
 * Fetches and parses website content for scoring
 */

class ContentExtractor {
  constructor(url, options = {}) {
    this.url = url;
    this.timeout = options.timeout || 30000; // Increased to 30s for slower sites
    // Use Googlebot user-agent to ensure WordPress serves full HTML with schema markup
    this.userAgent = options.userAgent || 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    this.maxContentLength = options.maxContentLength || 5000000; // 5MB
  }

  /**
   * Main extraction method - orchestrates all content gathering
   */
  async extract() {
    try {
      const fetchResult = await this.fetchHTML();
const html = fetchResult.html; // Extract the HTML string from the object
const $ = cheerio.load(html);

      const evidence = {
        url: this.url,
        html: html, // Store HTML for analysis
        metadata: this.extractMetadata($),
        technical: this.extractTechnical($, html), // MUST run BEFORE extractContent removes <script> tags!
        content: this.extractContent($),
        structure: this.extractStructure($),
        media: this.extractMedia($),
        performance: await this.checkPerformance(),
        accessibility: this.extractAccessibility($),
        timestamp: new Date().toISOString()
      };

      // Run entity analysis
      const entityAnalyzer = new EntityAnalyzer(evidence);
      evidence.entities = entityAnalyzer.analyze();

      return evidence;
    } catch (error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  /**
   * Fetch HTML content from URL with multiple fallback strategies
   */
  async fetchHTML() {
    // Try multiple user agents if blocked
    const userAgents = [
      // Real browser user agent (most likely to work)
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Googlebot (good for SEO-friendly sites)
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      // Another popular browser
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    let lastError = null;

    // Try each user agent
    for (let i = 0; i < userAgents.length; i++) {
      try {
        const startTime = Date.now();
        const response = await axios.get(this.url, {
          timeout: this.timeout,
          maxContentLength: this.maxContentLength,
          maxRedirects: 5, // Follow up to 5 redirects
          headers: {
            'User-Agent': userAgents[i],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          validateStatus: (status) => status >= 200 && status < 400 // Accept 2xx and 3xx
        });

        const responseTime = Date.now() - startTime;

        // Check if we got HTML content
        if (!response.data || typeof response.data !== 'string') {
          throw new Error('Invalid response: expected HTML content');
        }

        // Success! Log and return
        console.log(`[ContentExtractor] Successfully fetched with User-Agent #${i + 1}`);
        console.log(`[ContentExtractor] Response time: ${responseTime}ms`);
        console.log(`[ContentExtractor] HTML length: ${response.data.length} characters`);

        // Debug: Log first 1000 chars of HTML
        const htmlPreview = response.data.substring(0, 1000);
        console.log('[ContentExtractor] HTML preview (first 1000 chars):');
        console.log(htmlPreview);
        console.log('[ContentExtractor] ... (HTML continues)');

        return {
          html: response.data,
          responseTime,
          headers: response.headers,
          status: response.status
        };

      } catch (error) {
        lastError = error;
        console.log(`[ContentExtractor] Attempt ${i + 1}/${userAgents.length} failed:`, error.message);

        // If it's a 403 and we have more user agents to try, continue
        if (error.response && error.response.status === 403 && i < userAgents.length - 1) {
          console.log(`[ContentExtractor] Trying next user agent...`);
          continue;
        }

        // If it's not a 403, or we're on the last attempt, break and throw
        if (i === userAgents.length - 1) {
          // This was our last attempt
          break;
        }

        // For non-403 errors, stop trying and throw immediately
        if (!error.response || error.response.status !== 403) {
          break;
        }
      }
    }

    // All attempts failed, throw the last error with improved message
    if (lastError) {
      if (lastError.code === 'ECONNABORTED') {
        throw new Error(`Request timeout - ${this.url} took longer than ${this.timeout/1000}s to respond`);
      }
      if (lastError.code === 'ENOTFOUND') {
        throw new Error(`Domain not found - ${this.url} does not exist`);
      }
      if (lastError.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused - ${this.url} is not accepting connections`);
      }
      if (lastError.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        throw new Error(`SSL certificate error - ${this.url} has an invalid certificate`);
      }
      if (lastError.response) {
        const status = lastError.response.status;
        if (status === 403) {
          throw new Error(`Access denied - This website is blocking automated scanners. Try scanning a different page on this domain, or contact the site owner to whitelist our scanner.`);
        }
        if (status === 429) {
          throw new Error(`Rate limited - Too many requests. Please wait a few minutes and try again.`);
        }
        if (status === 503) {
          throw new Error(`Service unavailable - The website is temporarily down. Please try again later.`);
        }
        throw new Error(`HTTP ${status}: ${lastError.response.statusText || 'Request failed'}`);
      }
      throw new Error(`Failed to fetch ${this.url}: ${lastError.message}`);
    }

    throw new Error(`Failed to fetch ${this.url}: Unknown error`);
  }

  /**
   * Extract metadata (title, description, Open Graph, etc.)
   */
  extractMetadata($) {
    return {
      title: $('title').text().trim() || '',
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      author: $('meta[name="author"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      robots: $('meta[name="robots"]').attr('content') || '',
      
      // Open Graph
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
      ogType: $('meta[property="og:type"]').attr('content') || '',
      ogUrl: $('meta[property="og:url"]').attr('content') || '',
      
      // Twitter Cards
      twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
      twitterTitle: $('meta[name="twitter:title"]').attr('content') || '',
      twitterDescription: $('meta[name="twitter:description"]').attr('content') || '',
      
      // Dates
      lastModified: $('meta[name="last-modified"]').attr('content') || 
                    $('meta[property="article:modified_time"]').attr('content') || '',
      publishedTime: $('meta[property="article:published_time"]').attr('content') || '',
      
      // Language & Location
      language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '',
      geoRegion: $('meta[name="geo.region"]').attr('content') || '',
      geoPlacename: $('meta[name="geo.placename"]').attr('content') || '',
    };
  }

  /**
   * Extract main content - text, headings, paragraphs
   */
  extractContent($) {
    // Remove script, style, and navigation elements
    $('script, style, nav, header, footer, aside').remove();
    
    const headings = {
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: []
    };

    // Extract all headings
    for (let i = 1; i <= 6; i++) {
      $(`h${i}`).each((idx, el) => {
        headings[`h${i}`].push($(el).text().trim());
      });
    }

    // Extract paragraphs with intelligent prioritization
    const allParagraphs = [];
    $('p').each((idx, el) => {
      const $el = $(el);
      const text = $el.text().trim();

      // Skip very short paragraphs or common boilerplate patterns
      if (text.length < 20) return;
      if (text.match(/^(copyright|©|all rights reserved|privacy policy|terms of service)/i)) return;

      // Check if paragraph is likely hidden
      const style = $el.attr('style') || '';
      const classAttr = $el.attr('class') || '';
      const isHidden = style.includes('display:none') ||
                       style.includes('display: none') ||
                       style.includes('visibility:hidden') ||
                       style.includes('visibility: hidden') ||
                       classAttr.includes('hidden') ||
                       $el.css('display') === 'none';

      if (isHidden) return;

      // Calculate relevance score for this paragraph
      let score = 0;

      // Higher score for paragraphs in main content areas
      const inMain = $el.closest('main, article, [role="main"], .content, .post-content, .entry-content').length > 0;
      const inModal = $el.closest('.modal, .popup, [role="dialog"], .overlay').length > 0;
      const inSidebar = $el.closest('aside, .sidebar, .widget').length > 0;

      if (inMain) score += 10;
      if (inModal) score -= 5;  // Deprioritize modal content
      if (inSidebar) score -= 3; // Deprioritize sidebar content

      // Longer paragraphs are generally more substantial
      if (text.length > 100) score += 2;
      if (text.length > 200) score += 3;
      if (text.length > 400) score += 2;

      // Paragraphs with proper sentence structure are more valuable
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length >= 2) score += 2;
      if (sentences.length >= 4) score += 2;

      // Avoid common template/boilerplate text
      const boilerplatePatterns = [
        /click here/i,
        /read more/i,
        /learn more/i,
        /^(yes|no|ok|cancel|submit|continue)/i,
        /cookie/i,
        /subscribe to (our|the) newsletter/i
      ];

      const hasBoilerplate = boilerplatePatterns.some(pattern => pattern.test(text));
      if (hasBoilerplate) score -= 2;

      allParagraphs.push({ text, score });
    });

    // Sort by score (highest first), then by length for tie-breaking
    allParagraphs.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.text.length - a.text.length;
    });

    // Extract just the text, prioritizing highest-scored paragraphs
    const paragraphs = allParagraphs.map(p => p.text);

    // Debug: Log extracted paragraphs for quality analysis
    console.log(`[ContentExtractor] 📋 Extracted ${paragraphs.length} total paragraphs (scored and prioritized)`);
    if (paragraphs.length > 0) {
      console.log('[ContentExtractor] Top 3 highest-priority paragraphs:');
      allParagraphs.slice(0, 3).forEach((p, idx) => {
        const preview = p.text.length > 150 ? p.text.substring(0, 150) + '...' : p.text;
        console.log(`  ${idx + 1}. Score: ${p.score}, Length: ${p.text.length} chars`);
        console.log(`     "${preview}"`);
      });

      // Show longest paragraphs (these are what the scannability generator uses)
      const longParagraphs = allParagraphs.filter(p => p.text.length > 150);
      if (longParagraphs.length > 0) {
        console.log(`[ContentExtractor] 📊 Found ${longParagraphs.length} long paragraphs (>150 chars)`);
        console.log('[ContentExtractor] Top 3 longest high-quality paragraphs:');
        longParagraphs.slice(0, 3).forEach((p, idx) => {
          const preview = p.text.substring(0, 100) + '...';
          console.log(`  ${idx + 1}. Score: ${p.score}, Length: ${p.text.length} chars`);
          console.log(`     "${preview}"`);
        });
      }
    }

    // Extract lists
    const lists = [];
    $('ul, ol').each((idx, el) => {
      const items = [];
      $(el).find('li').each((i, li) => {
        items.push($(li).text().trim());
      });
      lists.push({
        type: el.name,
        items,
        itemCount: items.length
      });
    });

    // Extract tables
    const tables = [];
    $('table').each((idx, el) => {
      const rows = $(el).find('tr').length;
      const cols = $(el).find('tr').first().find('th, td').length;
      tables.push({ rows, cols, hasHeaders: $(el).find('th').length > 0 });
    });

    // Get all text content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).length;

    // Extract FAQs if present (enhanced detection)
    const faqs = [];

    // Method 1: Detect FAQs with schema markup
    $('[itemtype*="FAQPage"], [itemtype*="Question"]').each((idx, el) => {
      const question = $(el).find('[itemprop="name"]').text().trim() ||
                       $(el).find('h2, h3, h4, strong').first().text().trim();
      const answer = $(el).find('[itemprop="acceptedAnswer"]').text().trim() ||
                     $(el).find('p').first().text().trim();
      if (question && answer) {
        faqs.push({ question, answer, source: 'schema' });
      }
    });

    // Method 2: Detect FAQ sections by class/id (common patterns)
    const faqSelectors = [
      '[class*="faq" i], [id*="faq" i]',
      '[class*="question" i], [id*="question" i]',
      '[class*="accordion" i]',
      'details'
    ].join(', ');

    $(faqSelectors).each((idx, el) => {
      const $el = $(el);

      // For details/summary elements
      if (el.name === 'details') {
        const question = $el.find('summary').text().trim();
        const answer = $el.contents().not('summary').text().trim();
        if (question && answer && question.length > 10) {
          faqs.push({ question, answer, source: 'details' });
        }
        return;
      }

      // For FAQ containers, look for Q&A patterns
      const headings = $el.find('h2, h3, h4, h5, dt, [class*="question" i], [class*="title" i]');
      headings.each((i, heading) => {
        const $heading = $(heading);
        const question = $heading.text().trim();

        // Get the answer (next siblings until next heading)
        let answer = '';
        if (heading.name === 'dt') {
          // Definition list pattern
          answer = $heading.next('dd').text().trim();
        } else {
          // Get content until next heading
          let $next = $heading.next();
          while ($next.length && !$next.is('h1, h2, h3, h4, h5, h6, dt')) {
            answer += ' ' + $next.text().trim();
            $next = $next.next();
          }
        }

        // Only add if it looks like a Q&A (question ends with ? or is in FAQ section)
        if (question && answer &&
            (question.includes('?') || question.length > 15) &&
            answer.length > 20) {
          faqs.push({ question, answer, source: 'html' });
        }
      });
    });

    // Method 3: Look for question-like headings followed by content
    if (faqs.length === 0) {
      $('h2, h3, h4').each((idx, heading) => {
        const $heading = $(heading);
        const question = $heading.text().trim();

        // Check if heading looks like a question
        if (question.includes('?') && question.length > 15) {
          // Get the next paragraph(s) as answer
          let answer = '';
          let $next = $heading.next();
          while ($next.length && !$next.is('h1, h2, h3, h4, h5, h6') && answer.length < 500) {
            if ($next.is('p, div')) {
              answer += ' ' + $next.text().trim();
            }
            $next = $next.next();
          }

          if (answer.length > 50) {
            faqs.push({ question, answer, source: 'heading' });
          }
        }
      });
    }

    // Deduplicate FAQs (keep first occurrence)
    const uniqueFAQs = [];
    const seen = new Set();
    for (const faq of faqs) {
      const key = faq.question.toLowerCase().substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFAQs.push(faq);
      }
    }

    console.log(`[ContentExtractor] Found ${uniqueFAQs.length} FAQs (schema: ${uniqueFAQs.filter(f => f.source === 'schema').length}, html: ${uniqueFAQs.filter(f => f.source === 'html').length}, details: ${uniqueFAQs.filter(f => f.source === 'details').length}, heading: ${uniqueFAQs.filter(f => f.source === 'heading').length})`);

    return {
      headings,
      paragraphs: paragraphs.slice(0, 50), // First 50 paragraphs
      lists,
      tables,
      faqs: uniqueFAQs,
      wordCount,
      textLength: bodyText.length,
      bodyText: bodyText.substring(0, 10000) // First 10K chars for analysis
    };
  }

  /**
   * Extract structural elements and semantic HTML
   */
  extractStructure($) {
    return {
      // Semantic HTML5 elements
      hasMain: $('main').length > 0,
      hasArticle: $('article').length > 0,
      hasSection: $('section').length > 0,
      hasAside: $('aside').length > 0,
      hasNav: $('nav').length > 0,
      hasHeader: $('header').length > 0,
      hasFooter: $('footer').length > 0,
      
      // ARIA landmarks
      landmarks: $('[role="main"], [role="navigation"], [role="complementary"], [role="contentinfo"]').length,
      
      // Heading hierarchy
      headingCount: {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length,
        h4: $('h4').length,
        h5: $('h5').length,
        h6: $('h6').length
      },
      
      // Links
      internalLinks: $('a[href^="/"], a[href^="' + this.url + '"]').length,
      externalLinks: $('a[href^="http"]').not('[href^="' + this.url + '"]').length,
      
      // IDs and anchors
      elementsWithIds: $('[id]').length,
      anchorLinks: $('a[href^="#"]').length,
      
      // Table of contents detection
      hasTOC: $('[id*="toc"], [class*="toc"], [class*="table-of-contents"]').length > 0,
      
      // Breadcrumbs
      hasBreadcrumbs: $('[itemtype*="BreadcrumbList"], nav[aria-label*="breadcrumb"]').length > 0
    };
  }

  /**
   * Extract media elements (images, videos, audio)
   */
  extractMedia($) {
    const images = [];
    $('img').each((idx, el) => {
      images.push({
        src: $(el).attr('src') || '',
        alt: $(el).attr('alt') || '',
        hasAlt: !!$(el).attr('alt'),
        title: $(el).attr('title') || '',
        loading: $(el).attr('loading') || ''
      });
    });

    const videos = [];
    $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').each((idx, el) => {
      const tagName = el.name;
      videos.push({
        type: tagName === 'video' ? 'native' : 'embed',
        src: $(el).attr('src') || $(el).find('source').attr('src') || '',
        hasControls: tagName === 'video' ? $(el).attr('controls') !== undefined : false,
        hasTranscript: $(el).siblings('[class*="transcript"], [id*="transcript"]').length > 0,
        hasCaptions: tagName === 'video' ? $(el).find('track[kind="captions"]').length > 0 : false
      });
    });

    const audio = [];
    $('audio').each((idx, el) => {
      audio.push({
        src: $(el).attr('src') || $(el).find('source').attr('src') || '',
        hasControls: $(el).attr('controls') !== undefined,
        hasTranscript: $(el).siblings('[class*="transcript"], [id*="transcript"]').length > 0
      });
    });

    return {
      images: images.slice(0, 100), // First 100 images
      videos,
      audio,
      imageCount: images.length,
      imagesWithAlt: images.filter(img => img.hasAlt).length,
      imagesWithoutAlt: images.filter(img => !img.hasAlt).length,
      videoCount: videos.length,
      audioCount: audio.length
    };
  }

  /**
   * Extract technical SEO elements
   */
  extractTechnical($, htmlData) {
    const html = typeof htmlData === 'string' ? htmlData : htmlData.html;
    
    // Structured data detection (JSON-LD)
    const structuredData = [];
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`[ContentExtractor] Found ${jsonLdScripts.length} JSON-LD script tags`);

    jsonLdScripts.each((idx, el) => {
      try {
        const scriptContent = $(el).html();
        console.log(`[ContentExtractor] Parsing JSON-LD #${idx + 1}, length: ${scriptContent?.length || 0} chars`);
        const data = JSON.parse(scriptContent);
        const schemaType = data['@type'] || 'Unknown';
        console.log(`[ContentExtractor] Successfully parsed: ${schemaType}`);
        structuredData.push({
          type: schemaType,
          context: data['@context'] || '',
          raw: data
        });
      } catch (e) {
        console.log(`[ContentExtractor] Failed to parse JSON-LD #${idx + 1}:`, e.message);
      }
    });

    console.log(`[ContentExtractor] Total structured data found: ${structuredData.length}`);
    console.log(`[ContentExtractor] Has Organization: ${structuredData.some(sd => sd.type === 'Organization')}`);
    console.log(`[ContentExtractor] Has FAQPage: ${structuredData.some(sd => sd.type === 'FAQPage')}`);
    console.log(`[ContentExtractor] Has LocalBusiness: ${structuredData.some(sd => sd.type === 'LocalBusiness')}`);

    return {
      // Structured Data
      structuredData,
      hasOrganizationSchema: structuredData.some(sd => sd.type === 'Organization'),
      hasLocalBusinessSchema: structuredData.some(sd => sd.type === 'LocalBusiness'),
      hasFAQSchema: structuredData.some(sd => sd.type === 'FAQPage'),
      hasArticleSchema: structuredData.some(sd => sd.type === 'Article' || sd.type === 'BlogPosting'),
      hasBreadcrumbSchema: structuredData.some(sd => sd.type === 'BreadcrumbList'),
      
      // Hreflang
      hreflangTags: $('link[rel="alternate"][hreflang]').length,
      hreflangLanguages: $('link[rel="alternate"][hreflang]').map((i, el) => $(el).attr('hreflang')).get(),
      
      // Canonical
      hasCanonical: $('link[rel="canonical"]').length > 0,
      canonicalUrl: $('link[rel="canonical"]').attr('href') || '',
      
      // Sitemap
      hasSitemapLink: $('link[rel="sitemap"]').length > 0 || 
                      html.toLowerCase().includes('sitemap.xml'),
      
      // RSS/Atom
      hasRSSFeed: $('link[type="application/rss+xml"], link[type="application/atom+xml"]').length > 0,
      
      // Viewport
      hasViewport: $('meta[name="viewport"]').length > 0,
      viewport: $('meta[name="viewport"]').attr('content') || '',
      
      // Character encoding
      charset: $('meta[charset]').attr('charset') || 
               $('meta[http-equiv="Content-Type"]').attr('content')?.match(/charset=([^;]+)/)?.[1] || '',
      
      // Robots meta
      robotsMeta: $('meta[name="robots"]').attr('content') || '',
      
      // Cache control (from headers if available)
      cacheControl: htmlData.headers?.['cache-control'] || '',
      lastModified: htmlData.headers?.['last-modified'] || '',
      etag: htmlData.headers?.['etag'] || ''
    };
  }

  /**
   * Check performance metrics (basic)
   */
  async checkPerformance() {
    try {
      const startTime = Date.now();
      const response = await axios.head(this.url, { timeout: 5000 });
      const ttfb = Date.now() - startTime; // Time to First Byte
      
      return {
        ttfb,
        responseTime: ttfb,
        serverTiming: response.headers['server-timing'] || '',
        contentLength: parseInt(response.headers['content-length']) || 0,
        contentType: response.headers['content-type'] || ''
      };
    } catch (error) {
      return {
        ttfb: null,
        responseTime: null,
        error: error.message
      };
    }
  }

  /**
   * Extract accessibility-related attributes
   */
  extractAccessibility($) {
    return {
      // ARIA attributes
      ariaLabels: $('[aria-label]').length,
      ariaDescribed: $('[aria-describedby]').length,
      ariaLabelledBy: $('[aria-labelledby]').length,
      ariaHidden: $('[aria-hidden="true"]').length,
      ariaLive: $('[aria-live]').length,
      
      // Form accessibility
      formsWithLabels: $('form').length > 0 ? 
        $('form label').length / Math.max($('form input, form select, form textarea').length, 1) : 0,
      
      // Image alt text (already in media section, but important for a11y)
      imagesWithAlt: $('img[alt]').length,
      imagesTotal: $('img').length,
      
      // Language
      hasLangAttribute: $('html[lang]').length > 0,
      
      // Skip links
      hasSkipLink: $('a[href="#main"], a[href="#content"]').length > 0,
      
      // Focus management
      tabindex: $('[tabindex]').length,
      
      // Color contrast (basic detection - would need actual color analysis)
      hasInlineStyles: $('[style*="color"]').length,
      
      // Semantic buttons vs divs with click handlers
      semanticButtons: $('button').length,
      divClickHandlers: $('div[onclick], div[role="button"]').length
    };
  }

  /**
   * Detect industry/vertical based on content
   */
  static detectIndustry(content, metadata) {
    const keywords = {
      // Specialized Tech Industries (matched to FAQ libraries)
      'UCaaS': ['ucaas', 'unified communications', 'voip', 'cloud communications', 'cloud phone', 'business phone'],
      'Cybersecurity': ['cybersecurity', 'cyber security', 'infosec', 'security solutions', 'threat detection', 'penetration testing', 'vulnerability'],
      'Fintech': ['fintech', 'financial technology', 'payment processing', 'digital payments', 'blockchain', 'cryptocurrency', 'neobank'],
      'AI Infrastructure': ['ai infrastructure', 'machine learning infrastructure', 'ml ops', 'gpu cloud', 'ai platform'],
      'AI Startups': ['ai startup', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network'],
      'Data Center': ['data center', 'datacenter', 'colocation', 'colo', 'server hosting', 'infrastructure hosting'],
      'Digital Infrastructure': ['digital infrastructure', 'cloud infrastructure', 'edge computing', 'content delivery'],
      'ICT Hardware': ['ict hardware', 'networking equipment', 'routers', 'switches', 'hardware infrastructure', 'it hardware'],
      'Managed Service Provider': ['msp', 'managed services', 'managed service provider', 'it services', 'outsourced it'],
      'Telecom Service Provider': ['telecom', 'telecommunications', 'carrier', 'network operator', 'mobile network'],
      'Telecom Software': ['telecom software', 'telecommunications software', 'oss', 'bss', 'network management'],
      'Mobile Connectivity': ['esim', 'mobile connectivity', 'iot connectivity', 'cellular', 'mobile network'],

      // General Industries (existing)
      'SaaS': ['saas', 'software as a service', 'cloud software', 'subscription', 'platform', 'dashboard'],
      'Agency': ['marketing agency', 'digital agency', 'creative agency', 'advertising', 'seo agency'],
      'Healthcare': ['health', 'medical', 'doctor', 'patient', 'hospital', 'clinic', 'treatment'],
      'Legal': ['law', 'legal', 'attorney', 'lawyer', 'court', 'litigation', 'contract'],
      'Real Estate': ['real estate', 'property', 'homes', 'listing', 'realtor', 'mls', 'mortgage'],
      'E-commerce': ['shop', 'buy', 'cart', 'product', 'price', 'checkout', 'shipping', 'ecommerce'],
      'Financial': ['finance', 'investment', 'banking', 'insurance', 'loan', 'credit'],
      'Education': ['education', 'learning', 'course', 'student', 'training', 'university'],
      'Restaurant': ['restaurant', 'menu', 'food', 'dining', 'reservation', 'cuisine']
    };

    const text = `${metadata.title} ${metadata.description} ${content.bodyText}`.toLowerCase();
    const scores = {};

    for (const [industry, terms] of Object.entries(keywords)) {
      scores[industry] = terms.filter(term => text.includes(term)).length;
    }

    const detected = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    return detected.length > 0 ? detected[0][0] : 'General';
  }
}

module.exports = ContentExtractor;