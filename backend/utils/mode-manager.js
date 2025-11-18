const db = require('../db/database');

/**
 * Mode Manager
 *
 * Handles transitions between Optimization Mode (0-849) and Elite Mode (850+)
 */

const MODE_THRESHOLDS = {
  ELITE_ENTRY: 850,  // Score needed to enter Elite mode
  ELITE_EXIT: 800    // Score that triggers return to Optimization mode
};

/**
 * Check and update user's recommendation mode based on score
 *
 * @param {number} userId - User ID
 * @param {number} scanId - Scan ID
 * @param {number} totalScore - Current total score
 * @returns {Object} Mode information and transition details
 */
async function checkAndUpdateMode(userId, scanId, totalScore) {
  console.log(`[Mode] Checking mode for user ${userId}, score: ${totalScore}`);

  try {
    // Get current mode
    const modeResult = await db.query(
      `SELECT * FROM user_recommendation_mode WHERE user_id = $1`,
      [userId]
    );

    const currentMode = modeResult.rows.length > 0 ? modeResult.rows[0] : null;
    const previousMode = currentMode?.current_mode || 'optimization';
    const previousScore = currentMode?.current_score || 0;

    // Determine target mode based on score
    let targetMode;
    let transitionReason = null;
    let notification = null;
    let modeChanged = false;

    if (totalScore >= MODE_THRESHOLDS.ELITE_ENTRY && previousMode === 'optimization') {
      // Transition to Elite mode
      targetMode = 'elite';
      transitionReason = 'score_threshold_reached';
      modeChanged = true;

      // Check if this is first time reaching Elite or returning
      const isFirstTime = !currentMode || currentMode.elite_activated_at === null;

      notification = {
        type: 'elite_entry',
        isFirstTime,
        message: isFirstTime
          ? generateFirstTimeEliteNotification(totalScore)
          : generateReturningEliteNotification(totalScore, previousScore)
      };

      console.log(`[Mode] 🎉 User ${userId} entering ELITE mode (score: ${totalScore})`);

    } else if (totalScore < MODE_THRESHOLDS.ELITE_EXIT && previousMode === 'elite') {
      // Transition back to Optimization mode
      targetMode = 'optimization';
      transitionReason = 'score_dropped_below_threshold';
      modeChanged = true;

      notification = {
        type: 'optimization_return',
        message: generateOptimizationReturnNotification(totalScore, previousScore)
      };

      console.log(`[Mode] ⚠️  User ${userId} returning to OPTIMIZATION mode (score: ${totalScore})`);

    } else if (totalScore >= MODE_THRESHOLDS.ELITE_ENTRY) {
      // Already in or should be in Elite mode
      targetMode = 'elite';
    } else {
      // Already in or should be in Optimization mode
      targetMode = 'optimization';
    }

    // Update or create mode record
    if (currentMode) {
      await db.query(
        `UPDATE user_recommendation_mode
         SET current_mode = $1,
             current_score = $2,
             previous_mode = $3,
             transitioned_at = $4,
             transition_reason = $5,
             scan_id = $6,
             mode_changes_count = mode_changes_count + $7,
             elite_activated_at = COALESCE(elite_activated_at, $8),
             last_mode_check = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $9`,
        [
          targetMode,
          totalScore,
          modeChanged ? previousMode : currentMode.previous_mode,
          modeChanged ? new Date() : currentMode.transitioned_at,
          modeChanged ? transitionReason : currentMode.transition_reason,
          scanId,
          modeChanged ? 1 : 0,
          targetMode === 'elite' ? new Date() : null,
          userId
        ]
      );
    } else {
      // Create new record
      await db.query(
        `INSERT INTO user_recommendation_mode (
          user_id, scan_id, current_mode, current_score,
          previous_mode, transitioned_at, transition_reason,
          elite_activated_at, mode_changes_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          scanId,
          targetMode,
          totalScore,
          null,
          new Date(),
          'initial_scan',
          targetMode === 'elite' ? new Date() : null,
          0
        ]
      );

      // If starting in Elite mode (score >= 850 on first scan)
      if (targetMode === 'elite') {
        notification = {
          type: 'elite_entry',
          isFirstTime: true,
          isInitial: true,
          message: generateInitialEliteNotification(totalScore)
        };
      }
    }

    return {
      currentMode: targetMode,
      previousMode: modeChanged ? previousMode : currentMode?.previous_mode,
      modeChanged,
      transitionReason,
      currentScore: totalScore,
      previousScore,
      notification,
      thresholds: MODE_THRESHOLDS
    };

  } catch (error) {
    // If table doesn't exist yet (migration not run), return default optimization mode
    if (error.code === '42P01') { // PostgreSQL error code for "relation does not exist"
      console.log('⚠️  user_recommendation_mode table not found - returning default optimization mode');
      return {
        currentMode: 'optimization',
        previousMode: null,
        modeChanged: false,
        transitionReason: null,
        currentScore: totalScore,
        previousScore: 0,
        notification: null,
        thresholds: MODE_THRESHOLDS
      };
    }
    console.error('[Mode] Error:', error);
    throw error;
  }
}

/**
 * Get current mode for user
 *
 * @param {number} userId - User ID
 * @returns {Object|null} Mode information
 */
async function getCurrentMode(userId) {
  try {
    const result = await db.query(
      `SELECT * FROM user_recommendation_mode WHERE user_id = $1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    // If table doesn't exist yet (migration not run), return null
    // This allows the system to function with default 'optimization' mode
    if (error.code === '42P01') { // PostgreSQL error code for "relation does not exist"
      console.log('⚠️  user_recommendation_mode table not found - defaulting to optimization mode');
      return null;
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Generate notification for first-time Elite entry
 */
function generateFirstTimeEliteNotification(score) {
  return {
    title: '🎉 Congratulations! You\'ve reached Elite Status',
    score: `${score}/1000`,
    body: `You've optimized the foundational elements of your AI visibility. Your recommendations are now focused on maintaining your competitive edge and identifying new opportunities.`,
    focusAreas: [
      'Competitive intelligence and positioning',
      'Emerging content opportunities',
      'Advanced optimization techniques',
      'Performance monitoring and maintenance'
    ],
    badgeAwarded: 'Elite Status'
  };
}

/**
 * Generate notification for returning to Elite mode
 */
function generateReturningEliteNotification(currentScore, previousScore) {
  const improvement = currentScore - previousScore;

  return {
    title: '🌟 Welcome Back to Elite Status!',
    score: `${currentScore}/1000`,
    body: `Your score improved by ${improvement} points! You've re-entered Elite mode. Your recommendations will focus on competitive positioning and advanced optimizations.`,
    focusAreas: [
      'Competitive intelligence and positioning',
      'Emerging content opportunities',
      'Advanced optimization techniques',
      'Performance monitoring and maintenance'
    ]
  };
}

/**
 * Generate notification for initial Elite users (started at 850+)
 */
function generateInitialEliteNotification(score) {
  return {
    title: '🌟 Welcome to Elite Status!',
    score: `${score}/1000`,
    body: `Your site already has strong AI visibility fundamentals in place. Your recommendations focus on maintaining your competitive advantage and identifying opportunities for continued growth.`,
    focusAreas: [
      'Competitive intelligence and positioning',
      'Emerging content opportunities',
      'Advanced optimization techniques',
      'Performance monitoring and maintenance'
    ],
    badgeAwarded: 'Elite Status'
  };
}

/**
 * Generate notification for returning to Optimization mode
 */
function generateOptimizationReturnNotification(currentScore, previousScore) {
  const decline = previousScore - currentScore;

  return {
    title: '⚠️ Focus Mode: Rebuilding Foundation',
    score: `${currentScore}/1000`,
    body: `Your score has dropped to ${currentScore} (down ${decline} points). We've refocused your recommendations on rebuilding your foundation and addressing critical issues.`,
    action: {
      text: 'View what changed →',
      type: 'view_changes'
    }
  };
}

/**
 * Get recommendation strategy based on mode
 *
 * @param {string} mode - 'optimization' or 'elite'
 * @returns {Object} Strategy configuration
 */
function getRecommendationStrategy(mode) {
  if (mode === 'elite') {
    return {
      mode: 'elite',
      focus: 'maintenance_and_growth',
      categories: {
        competitive_intelligence: 0.30,  // 30%
        content_opportunities: 0.30,      // 30%
        advanced_optimization: 0.20,      // 20%
        maintenance_monitoring: 0.20      // 20%
      },
      priorities: [
        'competitive_threats',
        'score_degradation_risks',
        'opportunity_size',
        'implementation_ease'
      ]
    };
  } else {
    return {
      mode: 'optimization',
      focus: 'foundation_building',
      categories: {
        technical_fixes: 0.40,           // 40%
        content_gaps: 0.35,              // 35%
        foundational_optimization: 0.25  // 25%
      },
      priorities: [
        'impact_score',
        'quick_wins',
        'foundation_critical'
      ]
    };
  }
}

module.exports = {
  checkAndUpdateMode,
  getCurrentMode,
  getRecommendationStrategy,
  MODE_THRESHOLDS
};
