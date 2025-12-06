/**
 * Recommendation Context Service
 *
 * Manages recommendation persistence across scans within a 5-day window.
 *
 * Key Concept: "Context Key"
 * A stable identifier for: user_id + primary_domain + page_set_hash
 *
 * Within a 5-day window, all scans with the same context key should:
 * - Share the same active recommendation set
 * - Only update scores (not regenerate recommendations)
 * - Maintain the refresh cycle from the original scan
 *
 * This prevents the issue where every scan creates new recommendations,
 * breaking the "same 5 recs for 5 days" rule.
 */

const crypto = require('crypto');
const { Pool } = require('pg');

class RecommendationContextService {
  // Lazy-load RefreshCycleService to avoid circular dependency
  _getRefreshCycleService() {
    if (!this._refreshCycleService) {
      const RefreshCycleService = require('./refresh-cycle-service');
      this._refreshCycleService = new RefreshCycleService(this.pool);
    }
    return this._refreshCycleService;
  }
  constructor(pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Plan-aware context window durations
    this.DEFAULT_CONTEXT_WINDOW_DAYS = 5;  // DIY/Pro: 5-day cycle
    this.FREE_CONTEXT_WINDOW_DAYS = 30;    // Free: 30-day cycle
  }

  /**
   * Get context window duration based on plan
   * @param {String} plan - User's plan (free, diy, pro, etc.)
   * @returns {Number} Context window in days
   */
  getContextWindowDays(plan) {
    return plan === 'free' ? this.FREE_CONTEXT_WINDOW_DAYS : this.DEFAULT_CONTEXT_WINDOW_DAYS;
  }

  /**
   * Generate a stable context key for a scan
   *
   * @param {Number} userId - User ID
   * @param {String} domain - Primary domain (normalized)
   * @param {Array} pages - Array of page URLs scanned
   * @returns {String} Context key hash
   */
  generateContextKey(userId, domain, pages = []) {
    // Normalize domain (remove www, trailing slashes, etc.)
    const normalizedDomain = this.normalizeDomain(domain);

    // Sort pages for consistent hashing
    const sortedPages = [...pages].sort();
    const pageSetHash = this.hashPageSet(sortedPages);

    // Create composite key
    const compositeKey = `${userId}:${normalizedDomain}:${pageSetHash}`;

    // Return hash of composite key
    return crypto.createHash('sha256').update(compositeKey).digest('hex').substring(0, 32);
  }

  /**
   * Normalize domain for consistent matching
   */
  normalizeDomain(domain) {
    if (!domain) return '';

    let normalized = domain.toLowerCase().trim();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www prefix
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    // Remove port
    normalized = normalized.replace(/:\d+$/, '');

    return normalized;
  }

  /**
   * Create hash of page set for stable identification
   */
  hashPageSet(pages) {
    if (!pages || pages.length === 0) {
      return 'homepage-only';
    }

    // Normalize each page URL and sort
    const normalizedPages = pages.map(p => {
      try {
        const url = new URL(p);
        return url.pathname + url.search;
      } catch {
        return p;
      }
    }).sort();

    const pageString = normalizedPages.join('|');
    return crypto.createHash('md5').update(pageString).digest('hex').substring(0, 16);
  }

  /**
   * Find an active recommendation context for a user/domain/pages combination
   *
   * @param {Number} userId - User ID
   * @param {String} domain - Primary domain
   * @param {Array} pages - Pages scanned
   * @param {Boolean} isCompetitorScan - Whether this is a competitor scan
   * @returns {Object|null} Active context or null
   */
  async findActiveContext(userId, domain, pages = [], isCompetitorScan = false) {
    // Competitor scans don't share context
    if (isCompetitorScan) {
      return null;
    }

    const contextKey = this.generateContextKey(userId, domain, pages);

    // Look for an active context within the 5-day window
    const result = await this.pool.query(`
      SELECT
        rc.id as context_id,
        rc.context_key,
        rc.primary_scan_id,
        rc.created_at,
        rc.expires_at,
        rc.is_active,
        rrc.id as refresh_cycle_id,
        rrc.cycle_number,
        rrc.next_cycle_date,
        rrc.active_recommendation_ids
      FROM recommendation_contexts rc
      LEFT JOIN recommendation_refresh_cycles rrc
        ON rc.primary_scan_id = rrc.scan_id
        AND rrc.cycle_number = (
          SELECT MAX(cycle_number)
          FROM recommendation_refresh_cycles
          WHERE scan_id = rc.primary_scan_id
        )
      WHERE
        rc.user_id = $1
        AND rc.context_key = $2
        AND rc.is_active = true
        AND rc.expires_at > CURRENT_TIMESTAMP
      ORDER BY rc.created_at DESC
      LIMIT 1
    `, [userId, contextKey]);

    if (result.rows.length === 0) {
      return null;
    }

    const context = result.rows[0];

    console.log(`  📎 Found active context: ${contextKey.substring(0, 8)}...`);
    console.log(`     Primary scan: ${context.primary_scan_id}`);
    console.log(`     Expires: ${context.expires_at}`);
    console.log(`     Cycle: ${context.cycle_number || 1}`);

    return {
      contextId: context.context_id,
      contextKey: context.context_key,
      primaryScanId: context.primary_scan_id,
      createdAt: context.created_at,
      expiresAt: context.expires_at,
      refreshCycleId: context.refresh_cycle_id,
      cycleNumber: context.cycle_number || 1,
      nextCycleDate: context.next_cycle_date,
      activeRecommendationIds: context.active_recommendation_ids || []
    };
  }

  /**
   * Create a new recommendation context
   *
   * @param {Number} userId - User ID
   * @param {Number} scanId - Primary scan ID for this context
   * @param {String} domain - Primary domain
   * @param {Array} pages - Pages scanned
   * @param {Number} initialScore - Initial scan score (for tracking improvement)
   * @param {String} userPlan - User's plan (free, diy, pro) for context duration
   * @returns {Object} New context
   */
  async createContext(userId, scanId, domain, pages = [], initialScore = null, userPlan = 'diy') {
    const contextKey = this.generateContextKey(userId, domain, pages);

    // Calculate expiry based on plan
    let expiresAt;
    if (userPlan === 'free') {
      // Free users: expire at end of current calendar month
      const now = new Date();
      expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      console.log(`📎 Creating context with calendar month expiry (plan: free)`);
    } else {
      // DIY/Pro: rolling 5 days
      const contextWindowDays = this.getContextWindowDays(userPlan);
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + contextWindowDays);
      console.log(`📎 Creating context with ${contextWindowDays}-day window (plan: ${userPlan})`);
    }
    console.log(`   Expires: ${expiresAt.toISOString()}`);

    const result = await this.pool.query(`
      INSERT INTO recommendation_contexts (
        user_id,
        context_key,
        primary_scan_id,
        domain,
        pages_hash,
        expires_at,
        is_active,
        initial_score,
        latest_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
      ON CONFLICT (user_id, context_key)
      DO UPDATE SET
        primary_scan_id = EXCLUDED.primary_scan_id,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP,
        initial_score = COALESCE(recommendation_contexts.initial_score, EXCLUDED.initial_score),
        latest_score = EXCLUDED.latest_score
      RETURNING *
    `, [
      userId,
      contextKey,
      scanId,
      this.normalizeDomain(domain),
      this.hashPageSet(pages),
      expiresAt,
      initialScore
    ]);

    const contextId = result.rows[0].id;

    // Update recommendations with this context_id
    await this.pool.query(`
      UPDATE scan_recommendations
      SET context_id = $1
      WHERE scan_id = $2 AND context_id IS NULL
    `, [contextId, scanId]);

    console.log(`  📎 Created new context: ${contextKey.substring(0, 8)}...`);
    console.log(`     Primary scan: ${scanId}`);
    console.log(`     Initial score: ${initialScore || 'N/A'}`);
    console.log(`     Expires: ${expiresAt.toISOString()}`);

    return result.rows[0];
  }

  /**
   * Link a new scan to an existing context
   * This allows multiple scans to share the same recommendation set
   *
   * @param {Number} contextId - Context ID
   * @param {Number} newScanId - New scan ID to link
   */
  async linkScanToContext(contextId, newScanId, latestScore = null) {
    await this.pool.query(`
      INSERT INTO context_scan_links (
        context_id,
        scan_id
      )
      VALUES ($1, $2)
      ON CONFLICT (context_id, scan_id) DO NOTHING
    `, [contextId, newScanId]);

    // Update the context's latest score and calculate change
    if (latestScore !== null) {
      await this.pool.query(`
        UPDATE recommendation_contexts
        SET latest_score = $1,
            score_change = $1 - COALESCE(initial_score, $1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [latestScore, contextId]);
    }

    console.log(`  🔗 Linked scan ${newScanId} to context ${contextId}${latestScore ? ` (score: ${latestScore})` : ''}`);
  }

  /**
   * Get recommendations from a context's primary scan
   *
   * @param {Number} primaryScanId - Primary scan ID
   * @returns {Array} Active recommendations
   */
  async getContextRecommendations(primaryScanId) {
    const result = await this.pool.query(`
      SELECT *
      FROM scan_recommendations
      WHERE scan_id = $1
        AND unlock_state IN ('active', 'locked')
        AND status NOT IN ('archived')
      ORDER BY impact_score DESC
    `, [primaryScanId]);

    return result.rows;
  }

  /**
   * Copy recommendation references to a new scan
   * This creates "virtual" links so the new scan shows the same recommendations
   *
   * @param {Number} primaryScanId - Source scan with original recommendations
   * @param {Number} newScanId - New scan to link recommendations to
   */
  async copyRecommendationReferences(primaryScanId, newScanId) {
    // Get active recommendations from primary scan
    const recommendations = await this.getContextRecommendations(primaryScanId);

    if (recommendations.length === 0) {
      console.log(`     ⚠️ No recommendations to copy from scan ${primaryScanId}`);
      return 0;
    }

    // Create references (not copies) in scan_recommendation_links table
    let linked = 0;
    for (const rec of recommendations) {
      await this.pool.query(`
        INSERT INTO scan_recommendation_links (
          scan_id,
          recommendation_id,
          source_scan_id
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (scan_id, recommendation_id) DO NOTHING
      `, [newScanId, rec.id, primaryScanId]);
      linked++;
    }

    console.log(`     ✓ Linked ${linked} recommendations to scan ${newScanId}`);
    return linked;
  }

  /**
   * Check if recommendation generation should be skipped for this scan
   *
   * Also checks refresh cycle status:
   * - If next_cycle_date is in the future → reuse current recommendations
   * - If next_cycle_date is due → process refresh cycle first, then reuse
   *
   * @param {Number} userId - User ID
   * @param {String} domain - Primary domain
   * @param {Array} pages - Pages scanned
   * @param {Boolean} isCompetitorScan - Whether this is a competitor scan
   * @returns {Object} { shouldSkip: boolean, activeContext?: object, refreshProcessed?: boolean }
   */
  async shouldSkipRecommendationGeneration(userId, domain, pages = [], isCompetitorScan = false) {
    // Never skip for competitor scans
    if (isCompetitorScan) {
      return { shouldSkip: false, reason: 'competitor_scan' };
    }

    const activeContext = await this.findActiveContext(userId, domain, pages, isCompetitorScan);

    if (activeContext) {
      // ALSO check refresh cycle status for this context's primary scan
      let refreshProcessed = false;

      try {
        const refreshService = this._getRefreshCycleService();
        const refreshStatus = await refreshService.getRefreshStatus(userId, activeContext.primaryScanId);

        if (refreshStatus) {
          const now = new Date();
          const nextRefreshDate = new Date(refreshStatus.nextRefreshDate);

          if (nextRefreshDate <= now) {
            // Refresh cycle is due! Process it before reusing recommendations
            console.log(`  🔄 Refresh cycle due for context (scan ${activeContext.primaryScanId})`);
            console.log(`     next_cycle_date: ${refreshStatus.nextRefreshDate}`);

            const refreshResult = await refreshService.processRefreshCycle(userId, activeContext.primaryScanId);

            if (refreshResult.replaced > 0) {
              console.log(`     ✓ Replaced ${refreshResult.replaced} recommendations`);
              console.log(`     ✓ Next refresh: ${refreshResult.nextRefreshDate}`);
            } else {
              console.log(`     ✓ No replacements needed (cycle extended)`);
            }

            refreshProcessed = true;
          } else {
            // Refresh not due yet - just log status
            console.log(`  🔄 Refresh cycle status: ${refreshStatus.daysUntilRefresh} days until next refresh`);
          }
        } else {
          console.log(`  ⚠️ No refresh cycle found for context scan ${activeContext.primaryScanId}`);
        }
      } catch (refreshError) {
        console.error(`  ⚠️ Refresh cycle check failed (continuing with reuse):`, refreshError.message);
        // Don't fail the context check if refresh processing fails
      }

      return {
        shouldSkip: true,
        reason: 'active_context_exists',
        activeContext,
        refreshProcessed
      };
    }

    return { shouldSkip: false, reason: 'no_active_context' };
  }

  /**
   * Expire a context (e.g., when refresh cycle completes)
   *
   * @param {Number} contextId - Context ID to expire
   */
  async expireContext(contextId) {
    await this.pool.query(`
      UPDATE recommendation_contexts
      SET
        is_active = false,
        expired_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [contextId]);

    console.log(`  ⏰ Context ${contextId} expired`);
  }

  /**
   * Clean up expired contexts (for cron job)
   */
  async cleanupExpiredContexts() {
    const result = await this.pool.query(`
      UPDATE recommendation_contexts
      SET
        is_active = false,
        expired_at = CURRENT_TIMESTAMP
      WHERE
        is_active = true
        AND expires_at < CURRENT_TIMESTAMP
      RETURNING id
    `);

    console.log(`🧹 Cleaned up ${result.rows.length} expired contexts`);
    return result.rows.length;
  }
}

module.exports = RecommendationContextService;
