# Recommendation Quality Improvement & Feedback System Strategy

## Part 1: Initial Quality Improvements (Pre-Feedback)

### 1.1 Content Quality Validation Layer

**Add quality checks before showing recommendations:**

```javascript
// Quality validation criteria
const qualityChecks = {
  hasRealContent: true,        // Uses actual page data (not just templates)
  isRelevant: true,            // Matches the detected issue
  isActionable: true,          // Clear, specific steps
  hasExamples: true,           // Shows before/after or concrete examples
  isIndustrySpecific: true     // Tailored to customer's industry
};
```

**Implementation:**
- Add `validateRecommendationQuality()` function in rec-generator.js
- Score each recommendation 0-100 based on quality metrics
- Only show recommendations scoring 70+
- Log low-quality recommendations for improvement

### 1.2 Industry Detection Enhancement

**Current:** Basic keyword matching
**Improvement:** Multi-signal industry detection

```javascript
// Enhanced industry detection
const industrySignals = {
  keywords: extractKeywords(content),
  schemaTypes: detectSchemaTypes(technical.structuredData),
  domainName: analyzeDomain(url),
  metadata: analyzeMetaTags(metadata),
  contentPatterns: detectContentPatterns(html)
};

// Weighted scoring
const industry = calculateIndustry(industrySignals);
```

**Benefits:**
- More accurate industry classification
- Better recommendation customization
- Higher relevance to customer's actual business

### 1.3 Recommendation Specificity Score

**Add specificity metrics to each recommendation:**

| Metric | Bad Example | Good Example |
|--------|-------------|--------------|
| **Vagueness** | "Improve your headings" | "Convert your H2 'Services Overview' to 'What services do you offer?'" |
| **Generic vs Specific** | "Add more content" | "Add 800 words covering: pricing, timeline, case studies" |
| **Before/After** | No example | Shows actual page content + improved version |
| **Location** | "On your page" | "In your main content section, paragraph 3" |

**Implementation:**
- Calculate specificity score for each recommendation
- Track: uses real page data (yes/no), mentions specific location (yes/no), shows before/after (yes/no)
- Aim for 80%+ specificity score

### 1.4 A/B Testing Framework (Internal)

**Test different recommendation approaches:**

```javascript
const recommendationVariants = {
  scannability: {
    variantA: 'Show longest paragraph with full text',
    variantB: 'Show top 3 long paragraphs with summaries',
    variantC: 'Show word count stats + one example'
  }
};

// Rotate variants per scan
const variant = selectVariant(userId, issueType);
logVariantShown(scanId, issueType, variant);
```

**Benefits:**
- Test different recommendation formats
- Find what resonates best with users
- Data-driven quality improvements

### 1.5 Content Freshness Validation

**Ensure extracted content matches current page:**

```javascript
// Add freshness indicators
const freshnessChecks = {
  cacheAge: Date.now() - scanTimestamp,
  contentHash: hashPageContent(html),
  lastModified: headers['last-modified'],
  dynamicContentDetected: detectJavaScriptRendering(html)
};

// Warn if content might be stale
if (freshnessChecks.cacheAge > 3600000) { // 1 hour
  addWarning('Content may have changed since scan');
}
```

### 1.6 Quality Scoring Algorithm

**Score each recommendation component:**

```javascript
function calculateRecommendationQualityScore(rec) {
  let score = 0;

  // Uses real page data (0-30 points)
  if (rec.customizedImplementation.includes('Before:')) score += 15;
  if (rec.customizedImplementation.length > 500) score += 15;

  // Actionability (0-25 points)
  const actionableSteps = rec.actionSteps.filter(s =>
    s.includes('Add') || s.includes('Change') || s.includes('Remove')
  );
  score += Math.min(25, actionableSteps.length * 5);

  // Examples (0-20 points)
  if (rec.readyToUseContent.includes('```')) score += 10; // Has code
  if (rec.validationChecklist.length >= 3) score += 10;

  // Industry specificity (0-15 points)
  if (rec.finding.includes(industry)) score += 10;
  if (rec.customizedImplementation.includes(pageTitle)) score += 5;

  // Quick wins (0-10 points)
  if (rec.quickWins.length >= 3) score += 10;

  return score; // 0-100
}
```

---

## Part 2: User Feedback System

### 2.1 Database Schema

**Add new tables to track feedback:**

```sql
-- Recommendation feedback table
CREATE TABLE recommendation_feedback (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES scans(id),
  recommendation_id TEXT NOT NULL,  -- e.g., "scannabilityScore_123"
  subfactor TEXT NOT NULL,           -- e.g., "scannabilityScore"

  -- Feedback data
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),  -- 1-5 stars
  helpful BOOLEAN,                    -- Thumbs up/down
  implemented BOOLEAN DEFAULT FALSE,  -- Did they implement it?
  comment TEXT,                       -- Optional user feedback

  -- Context
  user_id INTEGER REFERENCES users(id),
  industry TEXT,
  page_url TEXT,
  recommendation_variant TEXT,        -- For A/B testing

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Recommendation interactions (implicit feedback)
CREATE TABLE recommendation_interactions (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES scans(id),
  recommendation_id TEXT NOT NULL,

  -- Interaction events
  viewed BOOLEAN DEFAULT TRUE,
  expanded BOOLEAN DEFAULT FALSE,     -- Clicked "show more"
  copied_code BOOLEAN DEFAULT FALSE,  -- Copied ready-to-use content
  downloaded BOOLEAN DEFAULT FALSE,   -- Downloaded/exported recommendation
  time_spent_seconds INTEGER,         -- How long they viewed it

  -- Metadata
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recommendation quality metrics (aggregated)
CREATE TABLE recommendation_quality_metrics (
  id SERIAL PRIMARY KEY,
  subfactor TEXT NOT NULL,
  variant TEXT,

  -- Aggregated metrics
  total_shown INTEGER DEFAULT 0,
  total_helpful INTEGER DEFAULT 0,
  total_not_helpful INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  implementation_rate DECIMAL(5,2),  -- % who marked "implemented"
  avg_time_spent DECIMAL(8,2),

  -- Industry breakdown
  industry TEXT,

  -- Time period
  period_start DATE,
  period_end DATE,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_feedback_subfactor ON recommendation_feedback(subfactor);
CREATE INDEX idx_feedback_rating ON recommendation_feedback(rating);
CREATE INDEX idx_feedback_created ON recommendation_feedback(created_at);
CREATE INDEX idx_interactions_scan ON recommendation_interactions(scan_id);
CREATE INDEX idx_quality_subfactor ON recommendation_quality_metrics(subfactor);
```

### 2.2 Frontend Feedback UI Components

**A. Inline Feedback Widget (after each recommendation):**

```html
<!-- Simple thumbs up/down -->
<div class="recommendation-feedback">
  <p class="feedback-prompt">Was this recommendation helpful?</p>
  <div class="feedback-buttons">
    <button class="feedback-btn" data-helpful="true">
      👍 Helpful
    </button>
    <button class="feedback-btn" data-helpful="false">
      👎 Not helpful
    </button>
  </div>

  <!-- Expanded feedback form (shown after clicking) -->
  <div class="feedback-form" style="display: none;">
    <label>
      <input type="checkbox" name="implemented">
      I implemented this recommendation
    </label>

    <div class="rating-stars">
      <span class="star" data-rating="1">⭐</span>
      <span class="star" data-rating="2">⭐</span>
      <span class="star" data-rating="3">⭐</span>
      <span class="star" data-rating="4">⭐</span>
      <span class="star" data-rating="5">⭐</span>
    </div>

    <textarea
      placeholder="What could make this recommendation better? (optional)"
      name="comment"
      rows="3"
    ></textarea>

    <button class="submit-feedback-btn">Submit Feedback</button>
  </div>
</div>
```

**B. Bulk Feedback Survey (end of scan results):**

```html
<div class="scan-feedback-summary">
  <h3>Help us improve your recommendations</h3>
  <p>Which recommendations were most valuable?</p>

  <form class="bulk-feedback-form">
    <!-- Show all recommendations with quick rating -->
    <div class="recommendation-rating-list">
      <div class="rec-rating-item">
        <span class="rec-title">Content Scannability</span>
        <select name="rating_scannability">
          <option value="">Not rated</option>
          <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
          <option value="4">⭐⭐⭐⭐ Good</option>
          <option value="3">⭐⭐⭐ Okay</option>
          <option value="2">⭐⭐ Needs work</option>
          <option value="1">⭐ Not helpful</option>
        </select>
      </div>
      <!-- Repeat for each recommendation -->
    </div>

    <button type="submit">Submit Ratings</button>
  </form>
</div>
```

### 2.3 Backend API Endpoints

```javascript
// POST /api/recommendations/:recommendationId/feedback
router.post('/api/recommendations/:recommendationId/feedback', async (req, res) => {
  const { recommendationId } = req.params;
  const { scanId, helpful, rating, implemented, comment, variant } = req.body;

  try {
    const feedback = await db.query(`
      INSERT INTO recommendation_feedback
        (scan_id, recommendation_id, subfactor, rating, helpful, implemented, comment, user_id, recommendation_variant)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [scanId, recommendationId, extractSubfactor(recommendationId), rating, helpful, implemented, comment, req.user.id, variant]);

    // Update aggregated metrics
    await updateQualityMetrics(extractSubfactor(recommendationId), variant);

    res.json({ success: true, feedback: feedback.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recommendations/:recommendationId/interaction
router.post('/api/recommendations/:recommendationId/interaction', async (req, res) => {
  const { recommendationId } = req.params;
  const { scanId, expanded, copiedCode, timeSpent } = req.body;

  // Track implicit engagement signals
  await db.query(`
    INSERT INTO recommendation_interactions
      (scan_id, recommendation_id, expanded, copied_code, time_spent_seconds, user_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (scan_id, recommendation_id, user_id)
    DO UPDATE SET
      expanded = EXCLUDED.expanded OR recommendation_interactions.expanded,
      copied_code = EXCLUDED.copied_code OR recommendation_interactions.copied_code,
      time_spent_seconds = EXCLUDED.time_spent_seconds
  `, [scanId, recommendationId, expanded, copiedCode, timeSpent, req.user.id]);

  res.json({ success: true });
});

// GET /api/analytics/recommendation-quality
router.get('/api/analytics/recommendation-quality', async (req, res) => {
  const { subfactor, startDate, endDate, industry } = req.query;

  const metrics = await db.query(`
    SELECT
      subfactor,
      COUNT(*) as total_ratings,
      AVG(rating) as avg_rating,
      SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as helpful_count,
      SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END) as not_helpful_count,
      SUM(CASE WHEN implemented = true THEN 1 ELSE 0 END) as implemented_count,
      ROUND(AVG(CASE WHEN implemented = true THEN 100 ELSE 0 END), 2) as implementation_rate
    FROM recommendation_feedback
    WHERE ($1::text IS NULL OR subfactor = $1)
      AND created_at BETWEEN $2 AND $3
      AND ($4::text IS NULL OR industry = $4)
    GROUP BY subfactor
    ORDER BY avg_rating DESC
  `, [subfactor, startDate, endDate, industry]);

  res.json({ metrics: metrics.rows });
});
```

### 2.4 Analytics Dashboard

**Key Metrics to Track:**

```
┌─────────────────────────────────────────────────────────────┐
│ Recommendation Quality Dashboard                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Overall Performance (Last 30 Days)                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│ Total Recommendations Shown:     4,523                      │
│ Avg Rating:                      4.2 / 5 ⭐                │
│ Helpful Rate:                    78% 👍                     │
│ Implementation Rate:             34% ✅                     │
│ Avg Time Spent:                  2m 34s ⏱️                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Top Performing Recommendations                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│ 1. Alt Text for Images         Rating: 4.8 | Impl: 52%    │
│ 2. Heading Hierarchy            Rating: 4.6 | Impl: 41%    │
│ 3. Content Scannability         Rating: 4.4 | Impl: 38%    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Needs Improvement                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│ 1. Crawl Accessibility          Rating: 3.1 | Impl: 12%    │
│    → Common feedback: "Too technical"                       │
│                                                              │
│ 2. Robots.txt Config            Rating: 3.4 | Impl: 18%    │
│    → Common feedback: "Not sure how to implement"           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Automated Quality Improvements

**Use feedback data to auto-improve generators:**

```javascript
// Weekly quality analysis job
async function analyzeRecommendationQuality() {
  const lowPerformers = await db.query(`
    SELECT subfactor, AVG(rating) as avg_rating,
           array_agg(comment) as comments
    FROM recommendation_feedback
    WHERE rating <= 3
      AND created_at > NOW() - INTERVAL '7 days'
      AND comment IS NOT NULL
    GROUP BY subfactor
    HAVING AVG(rating) < 3.5
  `);

  for (const rec of lowPerformers.rows) {
    // Analyze common feedback themes
    const themes = extractCommonThemes(rec.comments);

    // Create improvement ticket
    await createImprovementTask({
      subfactor: rec.subfactor,
      avgRating: rec.avg_rating,
      commonIssues: themes,
      priority: rec.avg_rating < 3 ? 'high' : 'medium'
    });

    // Send alert to team
    await notifyTeam({
      type: 'quality_alert',
      message: `${rec.subfactor} has low rating (${rec.avg_rating}). Common issues: ${themes.join(', ')}`
    });
  }
}
```

### 2.6 Feedback-Driven Generator Updates

**Create feedback review workflow:**

1. **Weekly Review Meeting**
   - Review top 5 lowest-rated recommendations
   - Read user comments
   - Identify patterns (too vague? wrong industry fit? not actionable?)

2. **Improvement Sprints**
   - Pick 2-3 low-performing generators per sprint
   - Enhance based on feedback
   - A/B test improvements

3. **Continuous Monitoring**
   - Track rating changes after updates
   - Measure implementation rate improvements
   - Validate changes with data

---

## Part 3: Implementation Priority

### Phase 1: Quick Wins (Week 1)
- ✅ Add inline thumbs up/down buttons
- ✅ Track helpful/not helpful in database
- ✅ Create basic analytics query

### Phase 2: Core Feedback (Week 2-3)
- ✅ Implement full feedback form (rating, implemented, comment)
- ✅ Build analytics dashboard
- ✅ Track implicit signals (expanded, copied, time spent)

### Phase 3: Quality Loop (Week 4+)
- ✅ Weekly quality reports
- ✅ A/B testing framework
- ✅ Automated improvement suggestions
- ✅ Feedback-driven generator updates

---

## Part 4: Success Metrics

**Track these KPIs:**

| Metric | Current | Target (3 months) |
|--------|---------|-------------------|
| Avg Rating | Baseline | 4.2+ / 5 |
| Helpful Rate | Baseline | 75%+ |
| Implementation Rate | Baseline | 35%+ |
| Avg Time Spent | Baseline | 2+ minutes |
| Negative Feedback | Baseline | <10% |
| Comment Rate | Baseline | 25%+ |

**Leading Indicators:**
- Increasing ratings over time
- Decreasing "not helpful" clicks
- More "implemented" checkmarks
- Longer time spent on recommendations
- Positive comments mentioning specificity/usefulness
