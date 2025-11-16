/**
 * Notification Service
 *
 * Handles creation and delivery of user notifications for:
 * - Mode transitions
 * - Auto-detected implementations
 * - Competitive alerts
 * - Score plateaus
 * - Validation failures
 * - Refresh cycle updates
 */

const { Pool } = require('pg');

class NotificationService {
  constructor(pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Create a new notification
   *
   * @param {Number} userId - User ID
   * @param {Object} options - Notification options
   * @returns {Object} Created notification
   */
  async create(userId, options) {
    const {
      type,
      category,
      priority = 'medium',
      title,
      message,
      actionLabel = null,
      actionUrl = null,
      scanId = null,
      recommendationId = null,
      deliveryMethod = 'in_app',
      expiresInDays = 30
    } = options;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await this.pool.query(`
      INSERT INTO user_notifications (
        user_id,
        notification_type,
        category,
        priority,
        title,
        message,
        action_label,
        action_url,
        scan_id,
        recommendation_id,
        delivery_method,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      userId,
      type,
      category,
      priority,
      title,
      message,
      actionLabel,
      actionUrl,
      scanId,
      recommendationId,
      deliveryMethod,
      expiresAt
    ]);

    const notification = result.rows[0];

    // Send email if requested
    if (deliveryMethod === 'email' || deliveryMethod === 'both') {
      await this.sendEmail(userId, notification);
    }

    return notification;
  }

  /**
   * Get unread notifications for user
   */
  async getUnread(userId, limit = 20) {
    const result = await this.pool.query(`
      SELECT *
      FROM user_notifications
      WHERE
        user_id = $1
        AND is_read = false
        AND is_dismissed = false
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;
  }

  /**
   * Get all notifications for user
   */
  async getAll(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      category = null,
      includeRead = true,
      includeDismissed = false
    } = options;

    let query = `
      SELECT *
      FROM user_notifications
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (!includeRead) {
      query += ' AND is_read = false';
    }

    if (!includeDismissed) {
      query += ' AND is_dismissed = false';
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    await this.pool.query(`
      UPDATE user_notifications
      SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    await this.pool.query(`
      UPDATE user_notifications
      SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `, [userId]);
  }

  /**
   * Dismiss notification
   */
  async dismiss(notificationId, userId) {
    await this.pool.query(`
      UPDATE user_notifications
      SET
        is_dismissed = true,
        dismissed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM user_notifications
      WHERE
        user_id = $1
        AND is_read = false
        AND is_dismissed = false
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, [userId]);

    return parseInt(result.rows[0].count);
  }

  /**
   * Send email notification
   */
  async sendEmail(userId, notification) {
    // Get user email
    const userResult = await this.pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error('User not found for notification email:', userId);
      return;
    }

    const user = userResult.rows[0];

    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, just log
    console.log('Email notification to send:', {
      to: user.email,
      subject: notification.title,
      body: notification.message,
      action: notification.action_label ? {
        label: notification.action_label,
        url: notification.action_url
      } : null
    });

    // Mark as sent
    await this.pool.query(`
      UPDATE user_notifications
      SET
        email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [notification.id]);
  }

  /**
   * Create auto-detection notification
   */
  async createAutoDetectionNotification(userId, detection) {
    const { recommendation_id, detected_changes, score_delta } = detection;

    return await this.create(userId, {
      type: 'auto_detected_implementation',
      category: 'detection',
      priority: 'medium',
      title: '✓ Implementation Detected!',
      message: `Great work! We detected you implemented improvements that increased your score by ${score_delta} points.\n\nChanges detected:\n${this.formatDetectedChanges(detected_changes)}`,
      actionLabel: 'View Details',
      actionUrl: `/recommendations/${recommendation_id}`,
      recommendationId: recommendation_id,
      deliveryMethod: 'both'
    });
  }

  /**
   * Create plateau intervention notification
   */
  async createPlateauNotification(userId, scanId, stats) {
    const { scans_count, recommendations_actioned, score_improvement } = stats;

    return await this.create(userId, {
      type: 'plateau_intervention',
      category: 'plateau',
      priority: 'high',
      title: '📊 Progress Check-In',
      message: `You've implemented ${recommendations_actioned} recommendations over the past 2 months, but your score has only improved by ${score_improvement} points.\n\nThis typically means:\n1. Implementations may be partial or need refinement\n2. Technical issues are preventing improvements from registering\n3. Your site needs deeper structural changes\n\nLet's get your progress back on track.`,
      actionLabel: 'Schedule Review',
      actionUrl: '/support/review',
      scanId,
      deliveryMethod: 'both'
    });
  }

  /**
   * Create competitive alert notification
   */
  async createCompetitiveAlert(userId, competitorName, alertData) {
    const { score_change, improvements } = alertData;

    return await this.create(userId, {
      type: 'competitive_alert',
      category: 'competitive',
      priority: 'high',
      title: `🔔 Competitor Alert: ${competitorName}`,
      message: `${competitorName} improved their AI Visibility Score by ${score_change} points.\n\nKey improvements:\n${this.formatImprovements(improvements)}\n\nReview your competitive position to stay ahead.`,
      actionLabel: 'View Competitive Dashboard',
      actionUrl: '/competitive-dashboard',
      deliveryMethod: 'both'
    });
  }

  /**
   * Create validation failure notification
   */
  async createValidationFailureNotification(userId, recommendationId, validationErrors) {
    return await this.create(userId, {
      type: 'validation_failure',
      category: 'validation',
      priority: 'high',
      title: '⚠️ Implementation Issue Detected',
      message: `We found validation errors in your implementation:\n\n${this.formatValidationErrors(validationErrors)}\n\nThe recommendation has been updated with fix instructions.`,
      actionLabel: 'View Fix Guide',
      actionUrl: `/recommendations/${recommendationId}`,
      recommendationId,
      deliveryMethod: 'both'
    });
  }

  /**
   * Create refresh cycle notification
   */
  async createRefreshCycleNotification(userId, scanId, stats) {
    const { replaced_count, new_recommendations } = stats;

    return await this.create(userId, {
      type: 'refresh_cycle',
      category: 'refresh',
      priority: 'medium',
      title: '🔄 New Recommendations Available',
      message: `Your 5-day refresh cycle is complete! We've replaced ${replaced_count} actioned recommendations with new high-priority items.\n\nNew recommendations focus on:\n${this.formatNewRecommendations(new_recommendations)}`,
      actionLabel: 'View Recommendations',
      actionUrl: `/scan/${scanId}`,
      scanId,
      deliveryMethod: 'in_app'
    });
  }

  /**
   * Create score protection alert (Elite mode)
   */
  async createScoreProtectionAlert(userId, scanId, scoreDrop) {
    return await this.create(userId, {
      type: 'score_protection',
      category: 'elite_alert',
      priority: 'critical',
      title: '⚠️ Score Drop Alert',
      message: `Your AI Visibility Score has dropped by ${Math.abs(scoreDrop)} points.\n\nImmediate attention needed to protect your Elite status.\n\nWe've identified the issues causing the decline.`,
      actionLabel: 'View Priority Fixes',
      actionUrl: `/scan/${scanId}`,
      scanId,
      deliveryMethod: 'both'
    });
  }

  // Helper formatting methods

  formatDetectedChanges(changes) {
    if (!changes || !Array.isArray(changes)) return '';
    return changes.map(c => `• ${c}`).join('\n');
  }

  formatImprovements(improvements) {
    if (!improvements || !Array.isArray(improvements)) return '';
    return improvements.map(i => `• ${i}`).join('\n');
  }

  formatValidationErrors(errors) {
    if (!errors || !Array.isArray(errors)) return '';
    return errors.map(e => `• ${e}`).join('\n');
  }

  formatNewRecommendations(recommendations) {
    if (!recommendations || !Array.isArray(recommendations)) return '';
    return recommendations.map(r => `• ${r}`).join('\n');
  }
}

module.exports = NotificationService;
