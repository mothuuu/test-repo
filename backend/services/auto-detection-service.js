/**
 * Auto-Detection Service
 *
 * Automatically detects when users implement recommendations without marking them.
 *
 * Detection Methods:
 * 1. Score Improvement Detection - Pillar scores improve significantly
 * 2. Schema Validation Detection - Schema markup appears/improves
 * 3. Content Analysis Detection - Content changes match recommendation
 *
 * Thresholds:
 * - Minor improvements (<10 points): Flag for user review
 * - Significant improvements (10+ points): Auto-mark as implemented
 */

const { Pool } = require('pg');
const NotificationService = require('./notification-service');

class AutoDetectionService {
  constructor(pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.SIGNIFICANT_IMPROVEMENT_THRESHOLD = 10; // points
    this.MINOR_IMPROVEMENT_THRESHOLD = 5; // points
  }

  /**
   * Detect implementations by comparing current scan with previous scan
   *
   * @param {Number} userId - User ID
   * @param {Number} currentScanId - Current scan ID
   * @returns {Array} Array of detections
   */
  async detectImplementations(userId, currentScanId) {
    try {
      // Get current and previous scans
      const scans = await this.getScansForComparison(userId, currentScanId);

      if (!scans.current || !scans.previous) {
        console.log('No previous scan for comparison');
        return [];
      }

      // Get active recommendations for this user
      const activeRecommendations = await this.getActiveRecommendations(userId, scans.previous.id);

      if (activeRecommendations.length === 0) {
        console.log('No active recommendations to check');
        return [];
      }

      // Detect improvements for each recommendation
      const detections = [];

      for (const recommendation of activeRecommendations) {
        const detection = await this.detectRecommendationImplementation(
          recommendation,
          scans.current,
          scans.previous
        );

        if (detection) {
          detections.push(detection);
        }
      }

      // Process detections
      for (const detection of detections) {
        await this.processDetection(userId, detection);
      }

      return detections;

    } catch (error) {
      console.error('Auto-detection failed:', error);
      throw error;
    }
  }

  /**
   * Get current and previous scans for comparison
   */
  async getScansForComparison(userId, currentScanId) {
    // Get current scan
    const currentResult = await this.pool.query(`
      SELECT *
      FROM scans
      WHERE id = $1 AND user_id = $2
    `, [currentScanId, userId]);

    if (currentResult.rows.length === 0) {
      return { current: null, previous: null };
    }

    const current = currentResult.rows[0];

    // Get previous scan (most recent before current)
    const previousResult = await this.pool.query(`
      SELECT *
      FROM scans
      WHERE
        user_id = $1
        AND id < $2
        AND status = 'completed'
        AND domain = $3
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, currentScanId, current.domain]);

    const previous = previousResult.rows.length > 0 ? previousResult.rows[0] : null;

    return { current, previous };
  }

  /**
   * Get active recommendations
   */
  async getActiveRecommendations(userId, scanId) {
    const result = await this.pool.query(`
      SELECT sr.*
      FROM scan_recommendations sr
      JOIN scans s ON sr.scan_id = s.id
      WHERE
        s.user_id = $1
        AND sr.scan_id = $2
        AND sr.status = 'active'
      ORDER BY sr.impact_score DESC
    `, [userId, scanId]);

    return result.rows;
  }

  /**
   * Detect if a specific recommendation was implemented
   */
  async detectRecommendationImplementation(recommendation, currentScan, previousScan) {
    // Determine which pillar this recommendation affects
    const affectedPillar = this.determineAffectedPillar(recommendation);

    if (!affectedPillar) {
      return null;
    }

    // Get score change for this pillar
    const scoreColumn = `${affectedPillar}_score`;
    const scoreBefore = previousScan[scoreColumn] || 0;
    const scoreAfter = currentScan[scoreColumn] || 0;
    const scoreDelta = scoreAfter - scoreBefore;

    // No improvement, no detection
    if (scoreDelta <= 0) {
      return null;
    }

    // Detect specific changes
    const detectedChanges = await this.detectSpecificChanges(
      recommendation,
      currentScan,
      previousScan
    );

    // Determine detection type and confidence
    const detectionType = this.determineDetectionType(scoreDelta, detectedChanges);
    const confidenceScore = this.calculateConfidence(scoreDelta, detectedChanges);

    // Only return detection if confidence is sufficient
    if (confidenceScore < 60) {
      return null;
    }

    return {
      recommendation_id: recommendation.id,
      scan_id: currentScan.id,
      previous_scan_id: previousScan.id,
      detection_type: detectionType,
      detection_method: 'score_improvement',
      confidence_score: confidenceScore,
      pillar_affected: affectedPillar,
      score_before: scoreBefore,
      score_after: scoreAfter,
      score_delta: scoreDelta,
      detected_changes: detectedChanges,
      evidence: {
        recommendation_title: recommendation.title,
        recommendation_category: recommendation.category,
        score_improvement: scoreDelta,
        specific_changes: detectedChanges
      }
    };
  }

  /**
   * Determine which pillar a recommendation affects
   */
  determineAffectedPillar(recommendation) {
    const category = recommendation.category || '';
    const title = recommendation.title || '';
    const text = (category + ' ' + title).toLowerCase();

    // Map categories to pillar column names
    if (text.includes('schema') || text.includes('markup') || text.includes('structured')) {
      return 'ai_search_readiness';
    }
    if (text.includes('faq') || text.includes('content structure')) {
      return 'content_structure';
    }
    if (text.includes('voice')) {
      return 'voice_optimization';
    }
    if (text.includes('speed') || text.includes('performance')) {
      return 'speed_ux';
    }
    if (text.includes('technical') || text.includes('crawl')) {
      return 'technical_setup';
    }
    if (text.includes('trust') || text.includes('authority') || text.includes('credential')) {
      return 'trust_authority';
    }
    if (text.includes('readability') || text.includes('entity')) {
      return 'ai_readability';
    }
    if (text.includes('fresh') || text.includes('update')) {
      return 'content_freshness';
    }

    return 'ai_search_readiness'; // Default
  }

  /**
   * Detect specific changes between scans
   */
  async detectSpecificChanges(recommendation, currentScan, previousScan) {
    const changes = [];
    const recType = recommendation.title?.toLowerCase() || '';

    // Schema detection
    if (recType.includes('schema')) {
      const schemaChanges = this.detectSchemaChanges(currentScan, previousScan);
      changes.push(...schemaChanges);
    }

    // FAQ detection
    if (recType.includes('faq')) {
      const faqChanges = this.detectFAQChanges(currentScan, previousScan);
      changes.push(...faqChanges);
    }

    // Content detection
    if (recType.includes('content') || recType.includes('entity')) {
      const contentChanges = this.detectContentChanges(currentScan, previousScan);
      changes.push(...contentChanges);
    }

    // Technical detection
    if (recType.includes('speed') || recType.includes('mobile')) {
      const technicalChanges = this.detectTechnicalChanges(currentScan, previousScan);
      changes.push(...technicalChanges);
    }

    return changes;
  }

  /**
   * Detect schema markup changes
   */
  detectSchemaChanges(currentScan, previousScan) {
    const changes = [];

    try {
      const currentAnalysis = currentScan.detailed_analysis || {};
      const previousAnalysis = previousScan.detailed_analysis || {};

      const currentSchema = currentAnalysis.schema_types || [];
      const previousSchema = previousAnalysis.schema_types || [];

      // New schema types added
      const newSchemas = currentSchema.filter(s => !previousSchema.includes(s));
      if (newSchemas.length > 0) {
        changes.push(`Added ${newSchemas.length} new schema type(s): ${newSchemas.join(', ')}`);
      }

      // Check for specific schema improvements
      if (currentAnalysis.has_organization_schema && !previousAnalysis.has_organization_schema) {
        changes.push('Added Organization schema markup');
      }
      if (currentAnalysis.has_faq_schema && !previousAnalysis.has_faq_schema) {
        changes.push('Added FAQ schema markup');
      }
      if (currentAnalysis.has_local_business_schema && !previousAnalysis.has_local_business_schema) {
        changes.push('Added LocalBusiness schema markup');
      }

    } catch (error) {
      console.error('Error detecting schema changes:', error);
    }

    return changes;
  }

  /**
   * Detect FAQ changes
   */
  detectFAQChanges(currentScan, previousScan) {
    const changes = [];

    try {
      const currentFAQs = currentScan.faq_schema || [];
      const previousFAQs = previousScan.faq_schema || [];

      const faqDelta = currentFAQs.length - previousFAQs.length;

      if (faqDelta > 0) {
        changes.push(`Added ${faqDelta} new FAQ(s)`);
      }

      // Check FAQ schema implementation
      const currentAnalysis = currentScan.detailed_analysis || {};
      const previousAnalysis = previousScan.detailed_analysis || {};

      if (currentAnalysis.has_faqpage_markup && !previousAnalysis.has_faqpage_markup) {
        changes.push('Implemented FAQPage schema markup');
      }

    } catch (error) {
      console.error('Error detecting FAQ changes:', error);
    }

    return changes;
  }

  /**
   * Detect content changes
   */
  detectContentChanges(currentScan, previousScan) {
    const changes = [];

    try {
      const currentAnalysis = currentScan.detailed_analysis || {};
      const previousAnalysis = previousScan.detailed_analysis || {};

      // Entity detection
      const currentEntities = currentAnalysis.entities_found || 0;
      const previousEntities = previousAnalysis.entities_found || 0;

      if (currentEntities > previousEntities) {
        changes.push(`Added ${currentEntities - previousEntities} new entity definition(s)`);
      }

      // Content freshness
      const currentLastModified = currentAnalysis.last_modified_date;
      const previousLastModified = previousAnalysis.last_modified_date;

      if (currentLastModified && previousLastModified) {
        const currentDate = new Date(currentLastModified);
        const previousDate = new Date(previousLastModified);

        if (currentDate > previousDate) {
          changes.push('Content updated/refreshed');
        }
      }

    } catch (error) {
      console.error('Error detecting content changes:', error);
    }

    return changes;
  }

  /**
   * Detect technical changes
   */
  detectTechnicalChanges(currentScan, previousScan) {
    const changes = [];

    try {
      const currentAnalysis = currentScan.detailed_analysis || {};
      const previousAnalysis = previousScan.detailed_analysis || {};

      // Page speed
      if (currentAnalysis.page_load_time && previousAnalysis.page_load_time) {
        const improvement = previousAnalysis.page_load_time - currentAnalysis.page_load_time;
        if (improvement > 0.5) {
          changes.push(`Page load time improved by ${improvement.toFixed(2)}s`);
        }
      }

      // Mobile optimization
      if (currentAnalysis.is_mobile_friendly && !previousAnalysis.is_mobile_friendly) {
        changes.push('Mobile optimization implemented');
      }

    } catch (error) {
      console.error('Error detecting technical changes:', error);
    }

    return changes;
  }

  /**
   * Determine detection type based on score delta
   */
  determineDetectionType(scoreDelta, detectedChanges) {
    if (scoreDelta >= this.SIGNIFICANT_IMPROVEMENT_THRESHOLD && detectedChanges.length > 0) {
      return 'auto_complete';
    }

    if (scoreDelta >= this.MINOR_IMPROVEMENT_THRESHOLD && detectedChanges.length > 0) {
      return 'auto_partial';
    }

    return 'auto_detected';
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(scoreDelta, detectedChanges) {
    let confidence = 0;

    // Score delta contributes 60%
    if (scoreDelta >= this.SIGNIFICANT_IMPROVEMENT_THRESHOLD) {
      confidence += 60;
    } else if (scoreDelta >= this.MINOR_IMPROVEMENT_THRESHOLD) {
      confidence += 40;
    } else {
      confidence += (scoreDelta / this.MINOR_IMPROVEMENT_THRESHOLD) * 30;
    }

    // Specific changes contribute 40%
    if (detectedChanges.length > 0) {
      const changeContribution = Math.min(detectedChanges.length * 15, 40);
      confidence += changeContribution;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Process detection (save to DB and create notification)
   */
  async processDetection(userId, detection) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Save detection record
      const detectionResult = await client.query(`
        INSERT INTO implementation_detections (
          user_id,
          recommendation_id,
          detection_type,
          detection_method,
          confidence_score,
          previous_scan_id,
          current_scan_id,
          pillar_affected,
          score_before,
          score_after,
          score_delta,
          detected_changes,
          evidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        userId,
        detection.recommendation_id,
        detection.detection_type,
        detection.detection_method,
        detection.confidence_score,
        detection.previous_scan_id,
        detection.scan_id,
        detection.pillar_affected,
        detection.score_before,
        detection.score_after,
        detection.score_delta,
        JSON.stringify(detection.detected_changes),
        JSON.stringify(detection.evidence)
      ]);

      const savedDetection = detectionResult.rows[0];

      // Update recommendation status based on detection type
      if (detection.detection_type === 'auto_complete') {
        // Significant improvement - mark as implemented
        await client.query(`
          UPDATE scan_recommendations
          SET
            status = 'implemented',
            auto_detected_at = CURRENT_TIMESTAMP,
            implemented_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [detection.recommendation_id]);

      } else if (detection.detection_type === 'auto_partial') {
        // Partial improvement - mark as in progress
        await client.query(`
          UPDATE scan_recommendations
          SET
            is_partial_implementation = true,
            implementation_progress = $1
          WHERE id = $2
        `, [
          (detection.score_delta / this.SIGNIFICANT_IMPROVEMENT_THRESHOLD) * 100,
          detection.recommendation_id
        ]);
      }

      await client.query('COMMIT');

      // Create notification
      const notificationService = new NotificationService(this.pool);
      await notificationService.createAutoDetectionNotification(userId, savedDetection);

      return savedDetection;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing detection:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check for skipped recommendations that were later implemented
   */
  async checkSkippedImplementations(userId, currentScanId) {
    // Get skipped recommendations
    const skippedRecs = await this.pool.query(`
      SELECT sr.*
      FROM scan_recommendations sr
      JOIN scans s ON sr.scan_id = s.id
      WHERE
        s.user_id = $1
        AND sr.status = 'skipped'
        AND sr.skipped_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `, [userId]);

    if (skippedRecs.rows.length === 0) {
      return [];
    }

    // Get current scan
    const currentScan = await this.pool.query(
      'SELECT * FROM scans WHERE id = $1',
      [currentScanId]
    );

    if (currentScan.rows.length === 0) {
      return [];
    }

    const detections = [];

    for (const rec of skippedRecs.rows) {
      // Get the scan this recommendation was from
      const previousScan = await this.pool.query(
        'SELECT * FROM scans WHERE id = $1',
        [rec.scan_id]
      );

      if (previousScan.rows.length === 0) continue;

      // Check for implementation
      const detection = await this.detectRecommendationImplementation(
        rec,
        currentScan.rows[0],
        previousScan.rows[0]
      );

      if (detection && detection.confidence_score >= 70) {
        detections.push({
          ...detection,
          was_skipped: true,
          skipped_at: rec.skipped_at
        });
      }
    }

    return detections;
  }
}

module.exports = AutoDetectionService;
