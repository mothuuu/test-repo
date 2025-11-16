/**
 * Cron Service
 *
 * Manages scheduled tasks for the recommendation delivery system:
 * - Process 5-day refresh cycles
 * - Clean up expired notifications
 * - Process auto-detections for recent scans
 * - Check for score plateaus
 */

const cron = require('node-cron');
const { Pool } = require('pg');
const RefreshCycleService = require('./refresh-cycle-service');
const AutoDetectionService = require('./auto-detection-service');
const NotificationService = require('./notification-service');

class CronService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.jobs = [];
  }

  /**
   * Start all cron jobs
   */
  start() {
    console.log('🕐 Starting cron services...');

    // Process refresh cycles - Run daily at 2 AM
    this.jobs.push(
      cron.schedule('0 2 * * *', async () => {
        console.log('⏰ Running daily refresh cycle check...');
        await this.processRefreshCycles();
      })
    );

    // Clean up expired notifications - Run daily at 3 AM
    this.jobs.push(
      cron.schedule('0 3 * * *', async () => {
        console.log('⏰ Cleaning up expired notifications...');
        await this.cleanupExpiredNotifications();
      })
    );

    // Check for score plateaus - Run weekly on Mondays at 4 AM
    this.jobs.push(
      cron.schedule('0 4 * * 1', async () => {
        console.log('⏰ Checking for score plateaus...');
        await this.checkScorePlateaus();
      })
    );

    console.log(`✅ Started ${this.jobs.length} cron jobs`);
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    console.log('🛑 Stopping cron services...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
  }

  /**
   * Process all due refresh cycles
   */
  async processRefreshCycles() {
    try {
      const refreshService = new RefreshCycleService(this.pool);
      const results = await refreshService.processAllDueRefreshCycles();

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`✅ Processed ${successful} refresh cycles successfully`);
      if (failed > 0) {
        console.log(`❌ Failed to process ${failed} refresh cycles`);
      }

      return results;
    } catch (error) {
      console.error('❌ Refresh cycle cron job failed:', error);
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await this.pool.query(`
        DELETE FROM user_notifications
        WHERE
          expires_at IS NOT NULL
          AND expires_at < CURRENT_TIMESTAMP
          AND is_read = true
      `);

      console.log(`✅ Cleaned up ${result.rowCount} expired notifications`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Notification cleanup cron job failed:', error);
    }
  }

  /**
   * Check for score plateaus
   */
  async checkScorePlateaus() {
    try {
      // Find users with plateauing scores
      const plateauUsers = await this.pool.query(`
        SELECT
          sh.user_id,
          sh.scan_id,
          COUNT(*) as scan_count,
          MAX(sh.total_score) - MIN(sh.total_score) as score_range,
          MAX(sh.scan_date) as latest_scan_date,
          SUM(sh.recommendations_implemented_count) as total_implemented
        FROM score_history sh
        WHERE
          sh.scan_date >= CURRENT_DATE - INTERVAL '60 days'
        GROUP BY sh.user_id, sh.scan_id
        HAVING
          COUNT(*) >= 4
          AND SUM(sh.recommendations_implemented_count) >= 10
          AND (MAX(sh.total_score) - MIN(sh.total_score)) < 30
      `);

      console.log(`Found ${plateauUsers.rows.length} users with plateauing scores`);

      const notificationService = new NotificationService(this.pool);

      for (const user of plateauUsers.rows) {
        // Check if plateau notification already sent recently
        const existingNotification = await this.pool.query(`
          SELECT id
          FROM user_notifications
          WHERE
            user_id = $1
            AND notification_type = 'plateau_intervention'
            AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        `, [user.user_id]);

        if (existingNotification.rows.length === 0) {
          // Send plateau intervention notification
          await notificationService.createPlateauNotification(
            user.user_id,
            user.scan_id,
            {
              scans_count: user.scan_count,
              recommendations_actioned: user.total_implemented,
              score_improvement: user.score_range
            }
          );

          // Mark plateau in user_progress
          await this.pool.query(`
            UPDATE user_progress
            SET
              plateau_detected = true,
              plateau_intervention_shown = true
            WHERE user_id = $1 AND scan_id = $2
          `, [user.user_id, user.scan_id]);

          console.log(`   📊 Plateau intervention sent to user ${user.user_id}`);
        }
      }

      return plateauUsers.rows.length;
    } catch (error) {
      console.error('❌ Score plateau check failed:', error);
    }
  }

  /**
   * Manual trigger for refresh cycles (for testing/admin)
   */
  async manualRefreshCycleCheck() {
    console.log('🔄 Manual refresh cycle check triggered');
    return await this.processRefreshCycles();
  }

  /**
   * Manual trigger for plateau check (for testing/admin)
   */
  async manualPlateauCheck() {
    console.log('📊 Manual plateau check triggered');
    return await this.checkScorePlateaus();
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      running: this.jobs.length > 0,
      jobCount: this.jobs.length,
      jobs: [
        {
          name: 'Refresh Cycles',
          schedule: 'Daily at 2 AM',
          status: 'active'
        },
        {
          name: 'Notification Cleanup',
          schedule: 'Daily at 3 AM',
          status: 'active'
        },
        {
          name: 'Plateau Detection',
          schedule: 'Weekly on Mondays at 4 AM',
          status: 'active'
        }
      ]
    };
  }
}

// Singleton instance
let cronServiceInstance = null;

function getCronService() {
  if (!cronServiceInstance) {
    cronServiceInstance = new CronService();
  }
  return cronServiceInstance;
}

module.exports = {
  CronService,
  getCronService
};
