const express = require('express');
const router = express.Router();
const db = require('../../db/database');

/**
 * Admin Migrations Endpoint
 * Run database migrations through API
 */

// POST /api/admin/migrations/user-progress-columns - Add missing user_progress columns
router.post('/user-progress-columns', async (req, res) => {
  try {
    console.log('🔧 Running migration: Adding missing user_progress columns...');

    // Add all missing columns that are referenced in hybrid-recommendation-helper.js
    await db.query(`
      ALTER TABLE user_progress
      -- Hybrid recommendation system columns
      ADD COLUMN IF NOT EXISTS site_wide_total INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS site_wide_completed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS site_wide_active INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS page_specific_total INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS page_specific_completed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS site_wide_complete BOOLEAN DEFAULT false,

      -- Batch unlock date tracking
      ADD COLUMN IF NOT EXISTS batch_1_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_2_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_3_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS batch_4_unlock_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS total_batches INTEGER DEFAULT 1,

      -- Refresh/replacement tracking
      ADD COLUMN IF NOT EXISTS next_replacement_date DATE;
    `);

    console.log('✅ Migration completed successfully');
    console.log('   Added columns:');
    console.log('   - site_wide_total, site_wide_completed, site_wide_active');
    console.log('   - page_specific_total, page_specific_completed');
    console.log('   - site_wide_complete');
    console.log('   - batch_1_unlock_date through batch_4_unlock_date');
    console.log('   - total_batches');
    console.log('   - next_replacement_date');

    res.json({
      success: true,
      message: 'Migration completed: Added missing columns to user_progress table',
      columns_added: [
        'site_wide_total',
        'site_wide_completed',
        'site_wide_active',
        'page_specific_total',
        'page_specific_completed',
        'site_wide_complete',
        'batch_1_unlock_date',
        'batch_2_unlock_date',
        'batch_3_unlock_date',
        'batch_4_unlock_date',
        'total_batches',
        'next_replacement_date'
      ]
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

module.exports = router;
