/**
 * Migration: Add UTM tracking, affiliate tracking, and webhook support
 * Run this in Render Shell: node backend/db/migrate-tracking-and-webhooks.js
 */

const db = require('./database');

async function runMigration() {
  console.log('🚀 Starting migration: UTM tracking, affiliate tracking, and webhooks...\n');

  try {
    // 1. Add UTM and affiliate tracking columns to users table
    console.log('1️⃣  Adding tracking columns to users table...');
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS signup_source VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signup_medium VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signup_campaign VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signup_content VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signup_term VARCHAR(100),
      ADD COLUMN IF NOT EXISTS referrer_url TEXT,
      ADD COLUMN IF NOT EXISTS landing_page TEXT,
      ADD COLUMN IF NOT EXISTS affiliate_id VARCHAR(50);
    `);
    console.log('✅ Tracking columns added\n');

    // 2. Create stripe_events table for webhook tracking
    console.log('2️⃣  Creating stripe_events table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        customer_id VARCHAR(100),
        subscription_id VARCHAR(100),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_data JSONB,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ stripe_events table created\n');

    // 3. Create indexes for performance
    console.log('3️⃣  Creating indexes...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);
      CREATE INDEX IF NOT EXISTS idx_users_affiliate_id ON users(affiliate_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_user_id ON stripe_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
    `);
    console.log('✅ Indexes created\n');

    // 4. Create source_analytics view for quick reporting
    console.log('4️⃣  Creating source_analytics view...');
    await db.query(`
      CREATE OR REPLACE VIEW source_analytics AS
      SELECT
        signup_source,
        signup_medium,
        signup_campaign,
        affiliate_id,
        COUNT(*) as total_signups,
        COUNT(*) FILTER (WHERE plan IN ('diy', 'pro')) as paid_conversions,
        ROUND(COUNT(*) FILTER (WHERE plan IN ('diy', 'pro'))::numeric / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as signups_last_30_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as signups_last_7_days
      FROM users
      WHERE signup_source IS NOT NULL
      GROUP BY signup_source, signup_medium, signup_campaign, affiliate_id
      ORDER BY total_signups DESC;
    `);
    console.log('✅ Source analytics view created\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('📊 New features enabled:');
    console.log('   ✓ UTM parameter tracking');
    console.log('   ✓ Affiliate tracking');
    console.log('   ✓ Stripe webhook event logging');
    console.log('   ✓ Source analytics view\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
