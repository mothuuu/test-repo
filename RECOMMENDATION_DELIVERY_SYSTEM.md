# Recommendation Delivery System

## Overview

The Recommendation Delivery System implements a progressive, intelligent recommendation workflow for the AI Visibility Tool. It includes:

- **5-day refresh cycles** - Automatically replace implemented/skipped recommendations
- **Auto-detection** - Detect when users implement recommendations without marking them
- **Dual modes** - Optimization Mode (0-849) and Elite Maintenance Mode (850+)
- **Impact scoring** - Prioritize recommendations by potential impact
- **Smart notifications** - Alert users to implementations, mode changes, and competitive threats

---

## Architecture

### Core Services

```
/backend/services/
├── impact-score-calculator.js      # Calculates priority scores for recommendations
├── mode-transition-service.js      # Handles Optimization ↔ Elite mode transitions
├── notification-service.js         # Creates and manages user notifications
├── auto-detection-service.js       # Detects implementations by comparing scans
├── refresh-cycle-service.js        # Manages 5-day recommendation refresh cycles
├── elite-recommendation-generator.js # Generates Elite mode recommendations
├── scan-completion-hook.js         # Triggered when scan completes
└── cron-service.js                 # Scheduled tasks (refresh cycles, cleanup)
```

### Database Schema

```
New Tables:
├── recommendation_refresh_cycles   # Track 5-day refresh cycles
├── implementation_detections       # Auto-detected implementations
├── user_modes                      # User's current mode (Optimization/Elite)
├── mode_transition_history         # Mode change history
├── score_history                   # Score tracking over time
├── competitive_tracking            # Competitor tracking (Elite mode)
├── competitive_alerts              # Competitive intelligence alerts
├── recommendation_replacements     # Replacement history
├── page_selection_history          # Page selection changes
└── user_notifications              # User notifications

Updated Tables:
├── scan_recommendations            # Added: status, mode, impact_score, etc.
└── user_progress                   # Added: mode, refresh tracking, plateau detection
```

### API Endpoints

```
POST   /api/recommendations/:id/mark-complete     # Mark recommendation as implemented
POST   /api/recommendations/:id/skip              # Skip a recommendation
GET    /api/recommendations/active                # Get active recommendations
POST   /api/recommendations/refresh/:scanId       # Manual refresh trigger
GET    /api/recommendations/refresh-status/:scanId # Get refresh cycle status
GET    /api/recommendations/notifications         # Get user notifications
POST   /api/recommendations/notifications/:id/read # Mark notification as read
POST   /api/recommendations/notifications/:id/dismiss # Dismiss notification
POST   /api/recommendations/notifications/mark-all-read # Mark all as read
```

---

## Key Features

### 1. Progressive Value Release

Users receive their **top 5 priority recommendations** upon scan completion.

Every **5 days**, any implemented or skipped recommendations are **automatically replaced** with the next highest-priority items.

**Why 5 days?**
- Gives users time to implement recommendations
- Prevents overwhelming users with too many items
- Creates a cadence of progress

**User Flow:**
```
Day 1:  User receives 5 recommendations
Day 3:  User marks 2 as implemented, skips 1 (now showing 2 active)
Day 6:  System replaces the 3 actioned items → back to 5 total
```

**Implementation:**
- `RefreshCycleService.initializeRefreshCycle()` - Creates initial cycle on scan completion
- `RefreshCycleService.processRefreshCycle()` - Replaces recommendations every 5 days
- `CronService` - Runs daily check at 2 AM for due refresh cycles

---

### 2. Action Options

**Mark as Implemented**
```javascript
POST /api/recommendations/:id/mark-complete

Effect:
- Status: 'active' → 'implemented'
- Archived in "Implemented" section
- Opens slot for replacement in next refresh cycle
- Auto-validation on next scan
```

**Skip**
```javascript
POST /api/recommendations/:id/skip

Effect:
- Status: 'active' → 'skipped'
- Moved to "Skipped" section
- Opens slot for replacement in next refresh cycle
- Can still be detected if implemented later
```

---

### 3. Auto-Detection

**How It Works:**

When a user runs a new scan, the system compares it with the previous scan:

```javascript
// In scan-completion-hook.js
const autoDetectionService = new AutoDetectionService();
const detections = await autoDetectionService.detectImplementations(userId, scanId);

// Detection logic:
1. Compare pillar scores (aiSearchReadiness, contentStructure, etc.)
2. Look for specific changes (new schema, added FAQs, etc.)
3. Calculate confidence score (0-100)
4. If confidence >= 60, create detection
5. If score improvement >= 10 points, auto-mark as implemented
6. If score improvement 5-9 points, flag as partial implementation
```

**Detection Thresholds:**
- **Significant improvement** (10+ points): Auto-mark as implemented
- **Minor improvement** (5-9 points): Flag for user review
- **Confidence < 60**: No detection

**Notification:**
```
✓ Implementation Detected!

Great work! We detected you implemented improvements that
increased your score by 15 points.

Changes detected:
• Added Organization schema markup
• Implemented FAQ schema
• Added 5 new FAQ(s)
```

**Edge Case:** User skipped a recommendation, then implemented it later
```javascript
// System detects improvement in skipped area
const skippedImplementations = await autoDetectionService.checkSkippedImplementations(userId, scanId);

// Prompt user:
"We noticed you improved your FAQ schema score by 25 points.
You previously skipped the FAQ recommendation - would you like to
mark it as implemented instead?"
```

---

### 4. Optimization vs Elite Maintenance Mode

**Mode Transition Thresholds:**
- **Enter Elite Mode:** Score >= 850
- **Exit Elite Mode:** Score < 800
- **Buffer Zone (800-849):** Maintain current mode (prevents ping-ponging)

**Hysteresis Example:**
```
Score: 848 → User implements change → Score: 852
→ Enters Elite Mode ✓

Score: 852 → Minor decline → Score: 825
→ Stays in Elite Mode (buffer zone)

Score: 825 → Further decline → Score: 795
→ Returns to Optimization Mode
```

**Optimization Mode (0-849)**

Focus: **Fix structural issues and build foundation**

Recommendation Types:
- Technical fixes (schema, speed, crawlability)
- Content gaps (missing FAQs, entity definitions)
- Foundational optimizations (core markup, site structure)

Impact Score Weighting:
```javascript
impactScore = (
  deficiency * 0.40 +      // 40% - Room for improvement
  difficulty * 0.30 +      // 30% - Quick wins prioritized
  compounding * 0.20 +     // 20% - Multi-pillar impact
  industry * 0.10          // 10% - Industry relevance
)
```

**Elite Maintenance Mode (850+)**

Focus: **Maintain competitive advantage and advanced optimization**

Recommendation Categories:
1. **Competitive Intelligence (30%)** - "Competitor 'ABC Corp' added 12 new FAQ schemas - here are the questions they're targeting"
2. **Content Opportunities (30%)** - "15 emerging questions detected in your industry that you don't address"
3. **Advanced Optimization (20%)** - "Implement speakable schema for voice search optimization"
4. **Maintenance & Monitoring (20%)** - "2 of your FAQ schemas have validation warnings"

Impact Score Weighting:
```javascript
impactScore = (
  deficiency * 0.25 +      // 25% - Less weight on gaps (foundation solid)
  difficulty * 0.20 +      // 20% - Quick wins still matter
  compounding * 0.30 +     // 30% - Multi-pillar impact more important
  industry * 0.25          // 25% - Industry relevance crucial
)
```

Elite Features:
- Competitive dashboard (track up to 3 competitors)
- AI citation tracking
- Trend alerts
- Score protection alerts (if score drops 20+ points)

**Transition Notifications:**

Improved to Elite:
```
🎉 Congratulations! You've reached Elite Status (850/1000)

You've optimized the foundational elements of your AI visibility.
Your recommendations are now focused on maintaining your competitive
edge and identifying new opportunities.

Your focus areas:
✓ Competitive intelligence and positioning
✓ Emerging content opportunities
✓ Advanced optimization techniques
✓ Performance monitoring and maintenance
```

Started at Elite (first scan 850+):
```
🌟 Welcome to Elite Status! (875/1000)

Your site already has strong fundamentals in place. Many sites
start at 400-600, but you're already in Elite territory.

[Same focus areas as above]
```

Return to Optimization:
```
⚠️ Your score has dropped to 795/1000

We've refocused your recommendations on rebuilding your foundation
and addressing the issues that caused the decline.
```

---

### 5. Impact Score Calculation

**Formula:**
```javascript
impact_score = (
  pillar_deficiency_score * weight_1 +
  difficulty_multiplier * weight_2 +
  compounding_effect_score * weight_3 +
  industry_relevance_score * weight_4
)
```

**Components:**

1. **Pillar Deficiency (0-100)**
   - Current score: 0 → Deficiency: 100
   - Current score: 10 → Deficiency: 0
   - Weighted by pillar importance (aiSearchReadiness = 20%, etc.)

2. **Difficulty Multiplier**
   - quick_win: 1.5
   - moderate: 1.0
   - complex: 0.6

3. **Compounding Effect**
   - Recommendations affecting multiple pillars score higher
   - Example: Organization schema affects `aiSearchReadiness`, `trustAuthority`, and `voiceOptimization`

4. **Industry Relevance**
   - Industry-specific recommendations prioritized
   - Example: SaaS → Product schema = 100, Local business schema = 50

**Example Calculation:**
```
Recommendation: "Add Organization Schema"
Pillar: aiSearchReadiness (current score: 3/10)

Deficiency: ((10 - 3) / 10) * 100 * 1.2 = 84
Difficulty: quick_win = 1.5 * 100 = 150
Compounding: Affects 3 pillars = 75
Industry: High relevance for SaaS = 100

Optimization Mode:
impact_score = (84 * 0.40) + (150 * 0.30) + (75 * 0.20) + (100 * 0.10)
             = 33.6 + 45 + 15 + 10
             = 103.6

Elite Mode:
impact_score = (84 * 0.25) + (150 * 0.20) + (75 * 0.30) + (100 * 0.25)
             = 21 + 30 + 22.5 + 25
             = 98.5
```

---

### 6. Edge Case Handling

**Case 1: User Implements Without Marking**

**Detection:**
```javascript
// In auto-detection-service.js
if (scoreDelta >= 10 && detectedChanges.length > 0) {
  // Auto-mark as implemented
  status = 'implemented'
  auto_detected_at = CURRENT_TIMESTAMP
}
```

**Notification:**
```
We detected you implemented FAQ schema improvements!
We've marked the related recommendation as complete.
```

---

**Case 2: New User Starts at 850+**

**Onboarding:**
```
🌟 Impressive! Your AI Visibility Score: 875/1000

Your site already has strong fundamentals. Many sites start at 400-600,
but you're already in Elite territory.

[Elite mode recommendations from day 1]
```

**No Optimization Mode phase** - goes straight to Elite Maintenance.

---

**Case 3: Score Plateau**

**Detection:**
```sql
-- Triggered by cron job weekly
SELECT user_id FROM score_history
WHERE
  scan_date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY user_id
HAVING
  COUNT(*) >= 4 AND                           -- At least 4 scans
  SUM(recommendations_implemented_count) >= 10 AND  -- Implemented 10+ recommendations
  (MAX(total_score) - MIN(total_score)) < 30  -- Score improved < 30 points
```

**Intervention:**
```
📊 Progress Check-In

You've implemented 15 recommendations over the past 2 months,
but your score has only improved by 10 points (780 → 790).

This typically means:
1. Implementations may be partial or need refinement
2. Technical issues are preventing improvements from registering
3. Your site needs deeper structural changes

[Schedule review] [Run diagnostic scan]
```

---

**Case 4: Multi-Page Prioritization**

**Problem:** DIY user scans 5 pages with different scores:
- Page 1: 650
- Page 2: 800
- Page 3: 450
- Page 4: 700
- Page 5: 600

**Solution:** Unified recommendation pool

```javascript
// Calculate impact across ALL pages
allRecommendations = [];
foreach (page in scannedPages) {
  pageRecs = generateRecommendations(page);
  pageRecs.forEach(rec => {
    rec.impact_score = calculateImpact(rec, page.current_score);
    rec.page_url = page.url;
  });
  allRecommendations.push(...pageRecs);
}

// Return top 5 across all pages
return allRecommendations
  .sort((a, b) => b.impact_score - a.impact_score)
  .slice(0, 5);
```

**Display:**
```
1. Add Organization schema to Homepage (Page 1)
   Impact: +45 points | Page: example.com/

2. Implement FAQ schema on Services page (Page 3)
   Impact: +40 points | Page: example.com/services

3. Optimize page speed on About page (Page 4)
   Impact: +35 points | Page: example.com/about
```

---

**Case 5: Incorrect Implementation**

**Detection:**
```javascript
// On next scan, validation finds errors
if (schema_validation_errors.length > 0 && status === 'implemented') {
  // Move back to active with updated findings
  status = 'active'
  validation_status = 'failed'
  validation_errors = errors
}
```

**Notification:**
```
⚠️ Implementation Issue Detected

You marked "Add FAQ schema" as implemented, but our scan found
validation errors:

Errors found:
• Missing required property 'acceptedAnswer'
• Invalid JSON-LD syntax on line 12

Updated recommendation:
"Fix FAQ schema validation errors - Your FAQ markup has 3 critical
errors preventing AI parsing."

[View fix guide]
```

---

**Case 6: Enterprise Scale (200 pages)**

**Solution:** Tiered recommendation display

```
🎯 Top 5 Site-Wide Priorities
1. Add Organization schema to 180 pages | Impact: +120 points
2. Implement FAQ schema on service pages (12 pages) | Impact: +95 points
...

📄 By Page Category
├─ Homepage (1 page) - 3 recommendations
├─ Service Pages (12 pages) - 18 recommendations
├─ Blog Posts (45 pages) - 8 recommendations (grouped)
└─ Location Pages (30 pages) - 15 recommendations (grouped)

📊 By Pillar
├─ Schema Markup - 45 recommendations
├─ FAQs - 28 recommendations
...
```

---

## Deployment Steps

### 1. Install Dependencies

```bash
cd /home/user/ai-visibility-tool/backend
npm install node-cron
```

### 2. Run Database Migration

```bash
node db/migrate-recommendation-delivery-system.js
```

This creates all necessary tables and schema changes.

### 3. Update Server Startup

Add to `backend/server.js`:

```javascript
const { getCronService } = require('./services/cron-service');
const ScanCompletionHook = require('./services/scan-completion-hook');

// Start cron services
const cronService = getCronService();
cronService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping cron services...');
  cronService.stop();
  process.exit(0);
});
```

### 4. Integrate Scan Completion Hook

Add to `backend/routes/scan.js` (or wherever scan completion is handled):

```javascript
const ScanCompletionHook = require('../services/scan-completion-hook');

// After scan completes successfully
const scanHook = new ScanCompletionHook(db.pool);
await scanHook.onScanComplete(userId, scanId, {
  total_score: scan.total_score,
  ai_readability_score: scan.ai_readability_score,
  ai_search_readiness_score: scan.ai_search_readiness_score,
  // ... other pillar scores
  detailed_analysis: scan.detailed_analysis
});
```

---

## Testing

### Test Auto-Detection

```javascript
const AutoDetectionService = require('./services/auto-detection-service');
const service = new AutoDetectionService();

// Run detection for a specific scan
const detections = await service.detectImplementations(userId, scanId);
console.log('Detections:', detections);
```

### Test Mode Transition

```javascript
const ModeTransitionService = require('./services/mode-transition-service');
const service = new ModeTransitionService();

// Check transition for a score
const result = await service.checkAndTransition(userId, scanId, 855);
console.log('Transition:', result);
```

### Test Refresh Cycle

```javascript
const RefreshCycleService = require('./services/refresh-cycle-service');
const service = new RefreshCycleService();

// Process refresh for a scan
const result = await service.processRefreshCycle(userId, scanId);
console.log('Refresh result:', result);
```

### Manual Cron Trigger

```javascript
const { getCronService } = require('./services/cron-service');
const cronService = getCronService();

// Manually trigger refresh cycles
await cronService.manualRefreshCycleCheck();

// Manually trigger plateau check
await cronService.manualPlateauCheck();
```

---

## Monitoring

### Cron Job Status

```javascript
GET /api/admin/cron-status

Response:
{
  "running": true,
  "jobCount": 3,
  "jobs": [
    {
      "name": "Refresh Cycles",
      "schedule": "Daily at 2 AM",
      "status": "active"
    },
    ...
  ]
}
```

### Refresh Cycle Status

```javascript
GET /api/recommendations/refresh-status/:scanId

Response:
{
  "currentCycle": 3,
  "nextRefreshDate": "2025-11-21",
  "daysUntilRefresh": 4,
  "stats": {
    "implemented": 5,
    "skipped": 2,
    "replaced": 7
  }
}
```

---

## Future Enhancements

### Phase 2 Features

1. **AI Citation Tracking** - Monitor where AI assistants cite your content
2. **Competitive Dashboard** - Visual competitor comparison
3. **Trend Alerts** - Detect emerging questions in your industry
4. **Batch Implementation** - "Mark all [recommendation type] as implemented across selected pages"
5. **Implementation Templates** - One-click implementation for common recommendations
6. **Score Prediction** - "Implementing these 3 recommendations will increase your score to ~780"
7. **Video Guides** - Embedded video tutorials for complex recommendations

### Phase 3 Features

1. **A/B Testing** - Test recommendations to see which drive best results
2. **Machine Learning** - Learn which recommendations users implement most
3. **Integration Marketplace** - Connect to CMS platforms for automatic implementation
4. **API Access** - Programmatic access to recommendations
5. **White-Label** - Rebrand for agencies

---

## Troubleshooting

### Recommendations Not Refreshing

**Check:**
1. Is cron service running? `cronService.getStatus()`
2. Are there recommendations to replace? Check `status IN ('implemented', 'skipped')`
3. Is next_refresh_date past? Query `recommendation_refresh_cycles`

**Fix:**
```javascript
// Manual refresh trigger
POST /api/recommendations/refresh/:scanId
```

### Auto-Detection Not Working

**Check:**
1. Is there a previous scan to compare? Query `scans WHERE user_id = X ORDER BY created_at DESC`
2. Did score improve? Check `score_delta` in `score_history`
3. Are there active recommendations? Query `scan_recommendations WHERE status = 'active'`

**Debug:**
```javascript
const AutoDetectionService = require('./services/auto-detection-service');
const service = new AutoDetectionService();
const detections = await service.detectImplementations(userId, scanId);
// Check detections array and confidence scores
```

### Mode Not Transitioning

**Check:**
1. Is score at threshold? 850+ for Elite, <800 for Optimization
2. Is user in buffer zone? Check `user_modes.in_buffer_zone`
3. Check transition history: Query `mode_transition_history WHERE user_id = X`

**Force transition (admin only):**
```javascript
const ModeTransitionService = require('./services/mode-transition-service');
const service = new ModeTransitionService();
await service.forceTransition(userId, 'elite_maintenance', 'manual_override');
```

---

## Contributing

When adding new recommendation types:

1. **Update `ImpactScoreCalculator`** - Add to `COMPOUNDING_EFFECTS` if it affects multiple pillars
2. **Update `detectRecommendationType()`** - Add keyword detection
3. **Update `AutoDetectionService`** - Add specific detection logic if needed
4. **Update `EliteRecommendationGenerator`** - Add Elite mode variants if applicable

---

## License

Proprietary - AI Visibility Tool
