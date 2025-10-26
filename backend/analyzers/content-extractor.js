const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Content Extractor for V5 Rubric Analysis
 * Fetches and parses website content for scoring
 */

class ContentExtractor {
  constructor(url, options = {}) {
    this.url = url;
    this.timeout = options.timeout || 10000;
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
      
      return {
        url: this.url,
        html: html, // Store HTML for analysis
        metadata: this.extractMetadata($),
        content: this.extractContent($),
        structure: this.extractStructure($),
        media: this.extractMedia($),
        technical: this.extractTechnical($, html),
        performance: await this.checkPerformance(),
        accessibility: this.extractAccessibility($),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  /**
   * Fetch HTML content from URL
   */
  async fetchHTML() {
    try {
      const startTime = Date.now();
      const response = await axios.get(this.url, {
        timeout: this.timeout,
        maxContentLength: this.maxContentLength,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        validateStatus: (status) => status === 200
      });

      const responseTime = Date.now() - startTime;

      // Debug: Log first 3000 chars of HTML to see what we're getting
      const htmlPreview = response.data.substring(0, 3000);
      console.log('[ContentExtractor] HTML preview (first 3000 chars):');
      console.log(htmlPreview);
      console.log('[ContentExtractor] ... (HTML continues)');

      // Debug: Check if schema exists ANYWHERE in the full HTML
      const fullHtmlLength = response.data.length;
      const hasJsonLd = response.data.includes('application/ld+json');
      const jsonLdMatches = response.data.match(/application\/ld\+json/g);
      const jsonLdCount = jsonLdMatches ? jsonLdMatches.length : 0;
      console.log(`[ContentExtractor] Full HTML analysis:`);
      console.log(`  - Total HTML length: ${fullHtmlLength} characters`);
      console.log(`  - Contains 'application/ld+json': ${hasJsonLd}`);
      console.log(`  - Count of 'application/ld+json' occurrences: ${jsonLdCount}`);

      // Debug: Show actual HTML context around each schema occurrence
      if (jsonLdCount > 0) {
        console.log(`\n[ContentExtractor] Extracting HTML context for each schema tag:`);
        let searchPos = 0;
        for (let i = 0; i < jsonLdCount; i++) {
          const foundPos = response.data.indexOf('application/ld+json', searchPos);
          if (foundPos !== -1) {
            // Extract 500 chars before and after to see the actual HTML structure
            const contextStart = Math.max(0, foundPos - 500);
            const contextEnd = Math.min(response.data.length, foundPos + 1000);
            const context = response.data.substring(contextStart, contextEnd);
            console.log(`\n--- Schema #${i + 1} Context (position ${foundPos}) ---`);
            console.log(context);
            console.log(`--- End Schema #${i + 1} ---\n`);
            searchPos = foundPos + 1;
          }
        }
      }

      return {
        html: response.data,
        responseTime,
        headers: response.headers,
        status: response.status
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - site took too long to respond');
      }
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
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

    // Extract paragraphs
    const paragraphs = [];
    $('p').each((idx, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) { // Filter out very short paragraphs
        paragraphs.push(text);
      }
    });

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

    // Extract FAQs if present (common patterns)
    const faqs = [];
    $('[itemtype*="FAQPage"], [itemtype*="Question"]').each((idx, el) => {
      const question = $(el).find('[itemprop="name"]').text().trim() || 
                       $(el).find('h2, h3, h4, strong').first().text().trim();
      const answer = $(el).find('[itemprop="acceptedAnswer"]').text().trim() ||
                     $(el).find('p').first().text().trim();
      if (question && answer) {
        faqs.push({ question, answer });
      }
    });

    return {
      headings,
      paragraphs: paragraphs.slice(0, 50), // First 50 paragraphs
      lists,
      tables,
      faqs,
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
      'Healthcare': ['health', 'medical', 'doctor', 'patient', 'hospital', 'clinic', 'treatment'],
      'Legal': ['law', 'legal', 'attorney', 'lawyer', 'court', 'litigation', 'contract'],
      'Real Estate': ['real estate', 'property', 'homes', 'listing', 'realtor', 'mls', 'mortgage'],
      'E-commerce': ['shop', 'buy', 'cart', 'product', 'price', 'checkout', 'shipping'],
      'SaaS': ['software', 'platform', 'subscription', 'api', 'integration', 'dashboard'],
      'Financial': ['finance', 'investment', 'banking', 'insurance', 'loan', 'credit'],
      'Education': ['education', 'learning', 'course', 'student', 'training', 'university'],
      'Restaurant': ['restaurant', 'menu', 'food', 'dining', 'reservation', 'cuisine'],
      'Agency': ['agency', 'services', 'marketing', 'design', 'consulting', 'solutions']
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