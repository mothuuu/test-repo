const axios = require('axios');
const ContentExtractor = require('./content-extractor');

/**
 * Site Crawler - Multi-Page Analysis
 *
 * Crawls multiple pages from a website to enable site-wide metrics
 * as required by the Enhanced AI Readiness Assessment Rubric v3.0
 *
 * Features:
 * - Fetches and parses sitemap.xml
 * - Crawls up to N pages (configurable, default 15)
 * - Aggregates evidence across all pages
 * - Calculates site-wide percentages
 */

class SiteCrawler {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      maxPages: options.maxPages || 15,
      timeout: options.timeout || 10000,
      includeSitemap: options.includeSitemap !== false,
      includeInternalLinks: options.includeInternalLinks !== false,
      respectRobots: options.respectRobots !== false,
      userAgent: options.userAgent || 'AI-Visibility-Tool/1.0'
    };
    this.visitedUrls = new Set();
    this.pageEvidences = [];
  }

  /**
   * Main crawl method - returns aggregated site-wide evidence
   */
  async crawl() {
    try {
      console.log(`[Crawler] Starting site crawl for: ${this.baseUrl}`);

      // Get URLs to crawl
      const urlsToCrawl = await this.getUrlsToCrawl();
      console.log(`[Crawler] Found ${urlsToCrawl.length} URLs to analyze`);

      // Crawl each URL
      for (const url of urlsToCrawl.slice(0, this.options.maxPages)) {
        try {
          await this.crawlPage(url);
        } catch (error) {
          console.warn(`[Crawler] Failed to crawl ${url}:`, error.message);
        }
      }

      console.log(`[Crawler] Successfully crawled ${this.pageEvidences.length} pages`);

      // Aggregate evidence from all pages
      return this.aggregateEvidence();

    } catch (error) {
      console.error('[Crawler] Crawl failed:', error);
      throw new Error(`Site crawl failed: ${error.message}`);
    }
  }

  /**
   * Get list of URLs to crawl from sitemap and/or internal links
   */
  async getUrlsToCrawl() {
    const urls = new Set();

    // Always crawl the base URL
    urls.add(this.baseUrl);

    // Try to get URLs from sitemap
    if (this.options.includeSitemap) {
      const sitemapUrls = await this.fetchSitemapUrls();
      sitemapUrls.forEach(url => urls.add(url));
    }

    // If we don't have enough URLs, crawl the base page for internal links
    if (urls.size < this.options.maxPages && this.options.includeInternalLinks) {
      const internalLinks = await this.fetchInternalLinks(this.baseUrl);
      internalLinks.forEach(url => urls.add(url));
    }

    // Filter out XML files (belt and suspenders - should already be filtered above)
    const filteredUrls = Array.from(urls).filter(url => !url.endsWith('.xml'));

    if (filteredUrls.length < urls.size) {
      console.log(`[Crawler] Filtered out ${urls.size - filteredUrls.length} XML files from crawl list`);
    }

    return filteredUrls;
  }

  /**
   * Fetch URLs from sitemap.xml
   */
  async fetchSitemapUrls() {
    const sitemapUrls = [];
    const urlObj = new URL(this.baseUrl);
    const sitemapUrl = `${urlObj.protocol}//${urlObj.host}/sitemap.xml`;

    try {
      console.log(`[Crawler] Fetching sitemap: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: this.options.timeout,
        headers: { 'User-Agent': this.options.userAgent }
      });

      const xml = response.data;

      // Check if this is a sitemap index (WordPress style with nested sitemaps)
      if (xml.includes('<sitemapindex')) {
        console.log(`[Crawler] Detected sitemap index, fetching nested sitemaps...`);

        // Extract nested sitemap URLs
        const sitemapMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        const nestedSitemaps = [];

        for (const match of sitemapMatches) {
          const url = match[1].trim();
          // Only include XML sitemaps, not regular pages
          if (url.endsWith('.xml') && url.startsWith(urlObj.origin)) {
            nestedSitemaps.push(url);
          }
        }

        console.log(`[Crawler] Found ${nestedSitemaps.length} nested sitemaps`);

        // Fetch URLs from each nested sitemap
        for (const nestedSitemapUrl of nestedSitemaps) {
          try {
            const nestedUrls = await this.fetchNestedSitemap(nestedSitemapUrl);
            sitemapUrls.push(...nestedUrls);
          } catch (error) {
            console.warn(`[Crawler] Failed to fetch nested sitemap ${nestedSitemapUrl}:`, error.message);
          }
        }
      } else {
        // Regular sitemap - extract URLs directly
        const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        for (const match of urlMatches) {
          const url = match[1].trim();
          // Only include URLs from the same domain, exclude XML files
          if (url.startsWith(urlObj.origin) && !url.endsWith('.xml')) {
            sitemapUrls.push(url);
          }
        }
      }

      console.log(`[Crawler] Found ${sitemapUrls.length} page URLs in sitemap`);

      // Prioritize diverse content types
      return this.prioritizeUrls(sitemapUrls);

    } catch (error) {
      console.warn(`[Crawler] Could not fetch sitemap:`, error.message);
      return [];
    }
  }

  /**
   * Fetch URLs from a nested sitemap (e.g., WordPress wp-sitemap-posts-page-1.xml)
   */
  async fetchNestedSitemap(sitemapUrl) {
    const urls = [];

    try {
      const response = await axios.get(sitemapUrl, {
        timeout: this.options.timeout,
        headers: { 'User-Agent': this.options.userAgent }
      });

      const xml = response.data;
      const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);

      const urlObj = new URL(this.baseUrl);
      for (const match of urlMatches) {
        const url = match[1].trim();
        // Only include actual page URLs, not more XML files
        if (url.startsWith(urlObj.origin) && !url.endsWith('.xml')) {
          urls.push(url);
        }
      }

      console.log(`[Crawler] Extracted ${urls.length} URLs from ${sitemapUrl}`);
      return urls;

    } catch (error) {
      console.warn(`[Crawler] Failed to parse nested sitemap:`, error.message);
      return [];
    }
  }

  /**
   * Fetch internal links from a page
   */
  async fetchInternalLinks(url) {
    try {
      const extractor = new ContentExtractor(url, this.options);
      const evidence = await extractor.extract();

      const urlObj = new URL(url);
      const internalLinks = [];

      // Extract internal links from the HTML
      const linkRegex = /<a[^>]+href=["']([^"']+)["']/g;
      const matches = evidence.html.matchAll(linkRegex);

      for (const match of matches) {
        let href = match[1];

        // Skip anchors and external links
        if (href.startsWith('#')) continue;
        if (href.startsWith('mailto:')) continue;
        if (href.startsWith('tel:')) continue;

        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(href, url);
          if (absoluteUrl.origin === urlObj.origin) {
            internalLinks.push(absoluteUrl.href);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }

      return [...new Set(internalLinks)]; // Remove duplicates

    } catch (error) {
      console.warn(`[Crawler] Could not fetch internal links from ${url}:`, error.message);
      return [];
    }
  }

  /**
   * Prioritize URLs to get diverse content
   */
  prioritizeUrls(urls) {
    // Prioritize different types of pages
    const priorities = {
      home: 10,      // Homepage
      about: 9,      // About pages
      blog: 8,       // Blog posts
      service: 7,    // Service/product pages
      contact: 6,    // Contact pages
      faq: 5,        // FAQ pages
      other: 1       // Everything else
    };

    const scored = urls.map(url => {
      let score = priorities.other;
      const lower = url.toLowerCase();

      if (lower === this.baseUrl.toLowerCase() || lower.endsWith('/')) score = priorities.home;
      else if (lower.includes('/about')) score = priorities.about;
      else if (lower.includes('/blog') || lower.includes('/article')) score = priorities.blog;
      else if (lower.includes('/service') || lower.includes('/product')) score = priorities.service;
      else if (lower.includes('/contact')) score = priorities.contact;
      else if (lower.includes('/faq')) score = priorities.faq;

      return { url, score };
    });

    // Sort by priority and return URLs
    return scored.sort((a, b) => b.score - a.score).map(item => item.url);
  }

  /**
   * Crawl a single page and extract evidence
   */
  async crawlPage(url) {
    if (this.visitedUrls.has(url)) {
      return; // Already visited
    }

    console.log(`[Crawler] Crawling page: ${url}`);
    this.visitedUrls.add(url);

    try {
      const extractor = new ContentExtractor(url, this.options);
      const evidence = await extractor.extract();

      this.pageEvidences.push({
        url,
        evidence,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw new Error(`Failed to extract evidence from ${url}: ${error.message}`);
    }
  }

  /**
   * Aggregate evidence from all crawled pages into site-wide metrics
   */
  aggregateEvidence() {
    if (this.pageEvidences.length === 0) {
      throw new Error('No pages successfully crawled');
    }

    console.log(`[Crawler] Aggregating evidence from ${this.pageEvidences.length} pages`);

    const aggregated = {
      siteUrl: this.baseUrl,
      pageCount: this.pageEvidences.length,
      pages: this.pageEvidences,

      // Site-wide metrics for scoring
      siteMetrics: {
        // Question-based content density (% of pages)
        pagesWithQuestionHeadings: this.calculatePageMetric(e => this.hasQuestionHeadings(e)),
        pagesWithFAQs: this.calculatePageMetric(e => e.content.faqs.length > 0),
        pagesWithFAQSchema: this.calculatePageMetric(e => e.technical.hasFAQSchema),

        // Scannability (% of pages)
        pagesWithLists: this.calculatePageMetric(e => e.content.lists.length >= 2),
        pagesWithTables: this.calculatePageMetric(e => e.content.tables.length > 0),

        // Readability (site average)
        avgFleschScore: this.calculateAverageFleschScore(),
        avgSentenceLength: this.calculateAvgSentenceLength(),

        // Heading hierarchy (% of pages)
        pagesWithProperH1: this.calculatePageMetric(e => e.structure.headingCount.h1 === 1),
        pagesWithSemanticHTML: this.calculatePageMetric(e => e.structure.hasMain || e.structure.hasArticle),

        // Alt text coverage (% of pages)
        pagesWithGoodAltText: this.calculatePageMetric(e => this.hasGoodAltText(e)),

        // Schema markup (% of pages)
        pagesWithSchema: this.calculatePageMetric(e => e.technical.structuredData.length > 0),
        pagesWithOrganizationSchema: this.calculatePageMetric(e => e.technical.hasOrganizationSchema),

        // Freshness (% of pages)
        pagesWithLastModified: this.calculatePageMetric(e => e.metadata.lastModified || e.metadata.publishedTime),
        pagesWithCurrentYear: this.calculatePageMetric(e => this.hasCurrentYear(e)),

        // Voice optimization (% of pages)
        pagesWithLongTailKeywords: this.calculatePageMetric(e => this.hasLongTailKeywords(e)),
        pagesWithConversationalContent: this.calculatePageMetric(e => this.hasConversationalContent(e)),

        // Pillar pages
        pillarPageCount: this.countPillarPages(),

        // Topic cluster coverage
        topicClusterCoverage: this.calculateTopicClusterCoverage(),

        // Average content depth
        avgWordCount: this.calculateAverage(e => e.content.wordCount),
        avgImageCount: this.calculateAverage(e => e.media.imageCount),

        // Entity recognition
        avgEntitiesPerPage: this.calculateAverage(e => this.countEntities(e)),
        pagesWithLocationData: this.calculatePageMetric(e => e.metadata.geoRegion || e.metadata.geoPlacename),
      },

      timestamp: new Date().toISOString()
    };

    console.log('[Crawler] Aggregation complete:', {
      pageCount: aggregated.pageCount,
      questionHeadingsPercent: Math.round(aggregated.siteMetrics.pagesWithQuestionHeadings * 100),
      schemaPercent: Math.round(aggregated.siteMetrics.pagesWithSchema * 100)
    });

    return aggregated;
  }

  // ===== HELPER METHODS FOR METRIC CALCULATION =====

  /**
   * Calculate what % of pages meet a condition
   */
  calculatePageMetric(conditionFn) {
    const count = this.pageEvidences.filter(p => conditionFn(p.evidence)).length;
    return count / this.pageEvidences.length;
  }

  /**
   * Calculate average of a numeric value across pages
   */
  calculateAverage(extractFn) {
    const sum = this.pageEvidences.reduce((total, p) => total + extractFn(p.evidence), 0);
    return sum / this.pageEvidences.length;
  }

  hasQuestionHeadings(evidence) {
    const allHeadings = [
      ...evidence.content.headings.h1,
      ...evidence.content.headings.h2,
      ...evidence.content.headings.h3
    ];

    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 'can', 'should', 'does'];
    return allHeadings.some(h => {
      const lower = h.toLowerCase();
      return questionWords.some(q => lower.startsWith(q)) || lower.includes('?');
    });
  }

  hasGoodAltText(evidence) {
    if (evidence.media.imageCount === 0) return true;
    const coverage = evidence.media.imagesWithAlt / evidence.media.imageCount;
    return coverage >= 0.9; // 90% coverage = good
  }

  hasCurrentYear(evidence) {
    const currentYear = new Date().getFullYear().toString();
    return evidence.content.bodyText.includes(currentYear);
  }

  hasLongTailKeywords(evidence) {
    const fourWordPhrases = evidence.content.bodyText.match(/\b\w+\s+\w+\s+\w+\s+\w+\b/g) || [];
    return fourWordPhrases.length >= 20;
  }

  hasConversationalContent(evidence) {
    const conversationalKeywords = ['how to', 'what is', 'why', 'best way', 'guide'];
    const text = evidence.content.bodyText.toLowerCase();
    return conversationalKeywords.some(k => text.includes(k));
  }

  countPillarPages() {
    return this.pageEvidences.filter(p => {
      const e = p.evidence;
      return e.content.wordCount >= 1500 &&
             e.content.headings.h2.length >= 5 &&
             e.structure.internalLinks >= 5;
    }).length;
  }

  calculateTopicClusterCoverage() {
    // Analyze internal linking between pages
    const internalLinkCounts = this.pageEvidences.map(p => p.evidence.structure.internalLinks);
    const avgInternalLinks = internalLinkCounts.reduce((a, b) => a + b, 0) / internalLinkCounts.length;

    // If pages have 5+ internal links on average, cluster coverage is good
    if (avgInternalLinks >= 5) return 0.8;
    if (avgInternalLinks >= 3) return 0.6;
    if (avgInternalLinks >= 1) return 0.4;
    return 0.2;
  }

  calculateAverageFleschScore() {
    // Simple estimation based on word count and sentence count
    const scores = this.pageEvidences.map(p => {
      const text = p.evidence.content.bodyText;
      const words = text.split(/\s+/).length;
      const sentences = text.split(/[.!?]+/).length;
      if (words === 0 || sentences === 0) return 60;

      const avgWordsPerSentence = words / sentences;
      // Simplified: shorter sentences = higher score
      if (avgWordsPerSentence < 15) return 70;
      if (avgWordsPerSentence < 20) return 60;
      if (avgWordsPerSentence < 25) return 50;
      return 40;
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  calculateAvgSentenceLength() {
    const lengths = this.pageEvidences.map(p => {
      const text = p.evidence.content.bodyText;
      const words = text.split(/\s+/).length;
      const sentences = text.split(/[.!?]+/).length;
      return sentences > 0 ? words / sentences : 20;
    });

    return lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  countEntities(evidence) {
    // Count proper nouns (capitalized words)
    const properNouns = evidence.content.bodyText.match(/\b[A-Z][a-z]+\b/g) || [];
    return [...new Set(properNouns)].length;
  }
}

module.exports = SiteCrawler;
