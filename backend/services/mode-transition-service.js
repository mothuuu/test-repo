/**
 * Mode Transition Service
 *
 * Handles transitions between Optimization Mode and Elite Maintenance Mode
 *
 * Optimization Mode (0-849): Focus on foundational improvements
 * Elite Maintenance Mode (850+): Focus on competitive intelligence and advanced optimization
 *
 * Hysteresis prevents ping-ponging:
 * - Enter Elite Mode: Score >= 850
 * - Exit Elite Mode: Score < 800
 * - Buffer zone (800-849): Maintain current mode
 */

const { Pool } = require('pg');
const NotificationService = require('./notification-service');

class ModeTransitionService {
  constructor(pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.ELITE_ENTRY_THRESHOLD = 850;
    this.ELITE_EXIT_THRESHOLD = 800;
  }

  /**
   * Check and process mode transition for a user based on their latest scan
   *
   * @param {Number} userId - User ID
   * @param {Number} scanId - Latest scan ID
   * @param {Number} currentScore - Current total score
   * @returns {Object} Transition result
   */
  async checkAndTransition(userId, scanId, currentScore) {
    try {
      // Get or create user mode record
      const userMode = await this.getUserMode(userId);
      const previousMode = userMode.current_mode;
      const previousScore = userMode.current_score;

      // Determine if transition is needed
      const transitionDecision = this.shouldTransition(
        currentScore,
        previousMode,
        previousScore
      );

      if (!transitionDecision.shouldTransition) {
        // Update score but keep same mode
        await this.updateScoreOnly(userId, currentScore);

        return {
          transitioned: false,
          currentMode: previousMode,
          currentScore,
          previousScore,
          inBufferZone: transitionDecision.inBufferZone
        };
      }

      // Perform transition
      const newMode = transitionDecision.newMode;
      await this.performTransition(userId, scanId, previousMode, newMode, currentScore);

      // Create notification
      await this.createTransitionNotification(
        userId,
        scanId,
        previousMode,
        newMode,
        currentScore,
        previousScore
      );

      return {
        transitioned: true,
        fromMode: previousMode,
        toMode: newMode,
        currentScore,
        previousScore,
        transitionReason: transitionDecision.reason
      };

    } catch (error) {
      console.error('Mode transition check failed:', error);
      throw error;
    }
  }

  /**
   * Get user's current mode record (create if doesn't exist)
   */
  async getUserMode(userId) {
    const result = await this.pool.query(
      'SELECT * FROM user_modes WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create initial mode record
      const insertResult = await this.pool.query(`
        INSERT INTO user_modes (
          user_id,
          current_mode,
          current_score,
          score_at_mode_entry
        )
        VALUES ($1, 'optimization', 0, 0)
        RETURNING *
      `, [userId]);

      return insertResult.rows[0];
    }

    return result.rows[0];
  }

  /**
   * Determine if mode transition should occur
   */
  shouldTransition(currentScore, currentMode, previousScore = null) {
    // First scan scenario
    if (previousScore === null || previousScore === 0) {
      if (currentScore >= this.ELITE_ENTRY_THRESHOLD) {
        return {
          shouldTransition: true,
          newMode: 'elite_maintenance',
          reason: 'first_scan_elite',
          inBufferZone: false
        };
      }
      return {
        shouldTransition: false,
        inBufferZone: false
      };
    }

    // Currently in Optimization Mode
    if (currentMode === 'optimization') {
      if (currentScore >= this.ELITE_ENTRY_THRESHOLD) {
        return {
          shouldTransition: true,
          newMode: 'elite_maintenance',
          reason: 'score_threshold',
          inBufferZone: false
        };
      }
      return {
        shouldTransition: false,
        inBufferZone: false
      };
    }

    // Currently in Elite Maintenance Mode
    if (currentMode === 'elite_maintenance') {
      // In buffer zone (800-849)
      if (currentScore >= this.ELITE_EXIT_THRESHOLD && currentScore < this.ELITE_ENTRY_THRESHOLD) {
        return {
          shouldTransition: false,
          inBufferZone: true
        };
      }

      // Dropped below exit threshold
      if (currentScore < this.ELITE_EXIT_THRESHOLD) {
        return {
          shouldTransition: true,
          newMode: 'optimization',
          reason: 'score_threshold',
          inBufferZone: false
        };
      }

      // Still above entry threshold
      return {
        shouldTransition: false,
        inBufferZone: false
      };
    }

    return { shouldTransition: false, inBufferZone: false };
  }

  /**
   * Update score without changing mode
   */
  async updateScoreOnly(userId, currentScore) {
    await this.pool.query(`
      UPDATE user_modes
      SET
        current_score = $1,
        highest_score_achieved = GREATEST(highest_score_achieved, $1),
        in_buffer_zone = CASE
          WHEN current_mode = 'elite_maintenance' AND $1 >= $2 AND $1 < $3 THEN true
          ELSE false
        END
      WHERE user_id = $4
    `, [currentScore, this.ELITE_EXIT_THRESHOLD, this.ELITE_ENTRY_THRESHOLD, userId]);
  }

  /**
   * Perform mode transition
   */
  async performTransition(userId, scanId, fromMode, toMode, currentScore) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update user_modes
      await client.query(`
        UPDATE user_modes
        SET
          current_mode = $1,
          mode_since = CURRENT_TIMESTAMP,
          current_score = $2,
          score_at_mode_entry = $2,
          highest_score_achieved = GREATEST(highest_score_achieved, $2),
          last_mode_transition = CURRENT_TIMESTAMP,
          total_elite_entries = CASE
            WHEN $1 = 'elite_maintenance' THEN total_elite_entries + 1
            ELSE total_elite_entries
          END,
          total_optimization_entries = CASE
            WHEN $1 = 'optimization' THEN total_optimization_entries + 1
            ELSE total_optimization_entries
          END,
          in_buffer_zone = false
        WHERE user_id = $3
      `, [toMode, currentScore, userId]);

      // Record transition history
      await client.query(`
        INSERT INTO mode_transition_history (
          user_id,
          from_mode,
          to_mode,
          transition_reason,
          score_at_transition,
          scan_id,
          notification_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        fromMode,
        toMode,
        'score_threshold',
        currentScore,
        scanId,
        this.getNotificationType(fromMode, toMode, currentScore)
      ]);

      // Update user_progress mode
      await client.query(`
        UPDATE user_progress
        SET current_mode = $1
        WHERE user_id = $2
      `, [toMode, userId]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get notification type based on transition
   */
  getNotificationType(fromMode, toMode, score) {
    if (toMode === 'elite_maintenance') {
      if (fromMode === null || fromMode === 'optimization') {
        return score >= 850 ? 'improvement_to_elite' : 'initial_elite';
      }
    }

    if (toMode === 'optimization' && fromMode === 'elite_maintenance') {
      return 'return_to_optimization';
    }

    return 'first_scan';
  }

  /**
   * Create notification for mode transition
   */
  async createTransitionNotification(userId, scanId, fromMode, toMode, currentScore, previousScore) {
    const notificationService = new NotificationService(this.pool);

    let notification;

    if (toMode === 'elite_maintenance') {
      if (!fromMode || fromMode === 'optimization') {
        // Improved to Elite
        notification = {
          type: 'improvement_to_elite',
          category: 'mode_transition',
          priority: 'high',
          title: '🎉 Congratulations! You've reached Elite Status',
          message: `You've achieved an impressive score of ${currentScore}/1000!\n\nYou've optimized the foundational elements of your AI visibility. Your recommendations are now focused on maintaining your competitive edge and identifying new opportunities.\n\nYour focus areas:\n✓ Competitive intelligence and positioning\n✓ Emerging content opportunities\n✓ Advanced optimization techniques\n✓ Performance monitoring and maintenance`,
          actionLabel: 'View Elite Dashboard',
          actionUrl: `/dashboard?mode=elite`
        };
      } else {
        // Started at Elite (first scan)
        notification = {
          type: 'initial_elite',
          category: 'mode_transition',
          priority: 'high',
          title: '🌟 Welcome to Elite Status!',
          message: `Impressive! Your AI Visibility Score: ${currentScore}/1000\n\nYour site already has strong AI visibility fundamentals in place. Your recommendations focus on maintaining your competitive advantage and identifying opportunities for continued growth.\n\nYour focus areas:\n✓ Competitive intelligence and positioning\n✓ Emerging content opportunities\n✓ Advanced optimization techniques\n✓ Performance monitoring and maintenance`,
          actionLabel: 'Explore Elite Features',
          actionUrl: `/dashboard?mode=elite`
        };
      }
    } else if (toMode === 'optimization' && fromMode === 'elite_maintenance') {
      // Dropped back to Optimization
      notification = {
        type: 'return_to_optimization',
        category: 'mode_transition',
        priority: 'high',
        title: '⚠️ Your score needs attention',
        message: `Your score has dropped to ${currentScore}/1000 (from ${previousScore || 'N/A'}).\n\nWe've refocused your recommendations on rebuilding your foundation and addressing the issues that caused the decline.\n\nYour updated focus:\n✓ Fix structural issues\n✓ Address content gaps\n✓ Restore foundational optimizations`,
        actionLabel: 'View Priority Fixes',
        actionUrl: `/dashboard?mode=optimization`
      };
    }

    if (notification) {
      await notificationService.create(userId, {
        ...notification,
        scanId,
        deliveryMethod: 'both' // In-app + email
      });
    }
  }

  /**
   * Get mode-specific recommendation configuration
   */
  getModeConfiguration(mode) {
    if (mode === 'elite_maintenance') {
      return {
        mode: 'elite_maintenance',
        focusAreas: [
          'Competitive Intelligence',
          'Content Opportunities',
          'Advanced Optimization',
          'Maintenance & Monitoring'
        ],
        recommendationMix: {
          competitive_intelligence: 0.30,
          content_opportunities: 0.30,
          advanced_optimization: 0.20,
          maintenance_monitoring: 0.20
        },
        features: {
          competitiveDashboard: true,
          aiCitationTracking: true,
          trendAlerts: true,
          scoreProtectionAlerts: true
        }
      };
    }

    // Optimization mode (default)
    return {
      mode: 'optimization',
      focusAreas: [
        'Technical Fixes',
        'Content Gaps',
        'Schema Markup',
        'Foundational Optimizations'
      ],
      recommendationMix: {
        technical_fixes: 0.35,
        content_gaps: 0.30,
        schema_markup: 0.25,
        performance: 0.10
      },
      features: {
        competitiveDashboard: false,
        aiCitationTracking: false,
        trendAlerts: false,
        scoreProtectionAlerts: false
      }
    };
  }

  /**
   * Check if user is in buffer zone
   */
  async isInBufferZone(userId) {
    const result = await this.pool.query(
      'SELECT in_buffer_zone FROM user_modes WHERE user_id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].in_buffer_zone : false;
  }

  /**
   * Get mode transition history for user
   */
  async getTransitionHistory(userId, limit = 10) {
    const result = await this.pool.query(`
      SELECT
        from_mode,
        to_mode,
        transition_reason,
        score_at_transition,
        notification_type,
        transitioned_at
      FROM mode_transition_history
      WHERE user_id = $1
      ORDER BY transitioned_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;
  }

  /**
   * Manual mode transition (admin override)
   */
  async forceTransition(userId, toMode, reason = 'manual_override') {
    const userMode = await this.getUserMode(userId);

    await this.performTransition(
      userId,
      null,
      userMode.current_mode,
      toMode,
      userMode.current_score
    );

    return {
      success: true,
      fromMode: userMode.current_mode,
      toMode,
      reason
    };
  }
}

module.exports = ModeTransitionService;
