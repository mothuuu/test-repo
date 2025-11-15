#!/usr/bin/env node
/**
 * Complete Database Setup Script
 * Runs initial setup + all necessary migrations
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function runSetup() {
  console.log('🚀 Starting Complete Database Setup\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Basic Tables
    console.log('1️⃣  Creating basic tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_facts (
        brand_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_name VARCHAR(255),
        domain VARCHAR(255) UNIQUE NOT NULL,
        same_as JSONB DEFAULT '[]',
        wikidata_id VARCHAR(100),
        crunchbase_url VARCHAR(255),
        socials JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ brand_facts table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        scans_used_this_month INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ users table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        brand_id UUID REFERENCES brand_facts(brand_id),
        user_id INTEGER REFERENCES users(id),
        url VARCHAR(500) NOT NULL,
        score INTEGER,
        industry VARCHAR(100),
        scan_data JSONB,
        pages_scanned JSONB DEFAULT '[]',
        page_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ scans table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_analysis (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
        page_url VARCHAR(500) NOT NULL,
        page_score INTEGER,
        page_data JSONB,
        recommendations JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ page_analysis table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ usage_logs table\n');

    // Step 2: Auth Fields
    console.log('2️⃣  Adding authentication fields...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN
          ALTER TABLE users ADD COLUMN name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') THEN
          ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
          ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token') THEN
          ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token_expires') THEN
          ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='industry') THEN
          ALTER TABLE users ADD COLUMN industry VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='industry_custom') THEN
          ALTER TABLE users ADD COLUMN industry_custom VARCHAR(255);
        END IF;
      END $$;
    `);
    console.log('   ✅ Authentication fields added\n');

    // Step 3: Tracking & Analytics Fields
    console.log('3️⃣  Adding tracking and analytics fields...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signup_source') THEN
          ALTER TABLE users ADD COLUMN signup_source VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signup_medium') THEN
          ALTER TABLE users ADD COLUMN signup_medium VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signup_campaign') THEN
          ALTER TABLE users ADD COLUMN signup_campaign VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signup_content') THEN
          ALTER TABLE users ADD COLUMN signup_content VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='signup_term') THEN
          ALTER TABLE users ADD COLUMN signup_term VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referrer_url') THEN
          ALTER TABLE users ADD COLUMN referrer_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='landing_page') THEN
          ALTER TABLE users ADD COLUMN landing_page TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='affiliate_id') THEN
          ALTER TABLE users ADD COLUMN affiliate_id VARCHAR(255);
        END IF;
      END $$;
    `);
    console.log('   ✅ Tracking fields added\n');

    // Step 4: Competitive Analysis & Primary Domain
    console.log('4️⃣  Adding competitive analysis fields...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='competitor_scans_used_this_month') THEN
          ALTER TABLE users ADD COLUMN competitor_scans_used_this_month INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='primary_domain') THEN
          ALTER TABLE users ADD COLUMN primary_domain VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='primary_domain_changed_at') THEN
          ALTER TABLE users ADD COLUMN primary_domain_changed_at TIMESTAMP;
        END IF;
      END $$;
    `);
    console.log('   ✅ Competitive analysis fields added\n');

    // Step 5: Allow Guest Scans
    console.log('5️⃣  Enabling guest scans...');
    await pool.query(`
      ALTER TABLE scans ALTER COLUMN user_id DROP NOT NULL;
    `);
    console.log('   ✅ Guest scans enabled\n');

    // Step 6: Admin System
    console.log('6️⃣  Setting up admin system...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
          ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_super_admin') THEN
          ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS landing_page_content (
        id SERIAL PRIMARY KEY,
        section VARCHAR(100) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id),
        UNIQUE(section, key)
      );
    `);
    console.log('   ✅ Admin system ready\n');

    // Step 7: Stripe Events
    console.log('7️⃣  Setting up Stripe webhooks...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        customer_id VARCHAR(255),
        subscription_id VARCHAR(255),
        event_data JSONB,
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ Stripe webhooks table created\n');

    // Step 8: Waitlist
    console.log('8️⃣  Creating waitlist table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        plan VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ Waitlist table created\n');

    // Step 9: Subscription Management
    console.log('9️⃣  Adding subscription fields...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_cancel_at') THEN
          ALTER TABLE users ADD COLUMN subscription_cancel_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status') THEN
          ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none';
        END IF;
      END $$;
    `);
    console.log('   ✅ Subscription fields added\n');

    // Step 10: Indexes
    console.log('🔟 Creating indexes for performance...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
      CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at);
      CREATE INDEX IF NOT EXISTS idx_page_analysis_scan ON page_analysis(scan_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_events_customer ON stripe_events(customer_id);
    `);
    console.log('   ✅ Indexes created\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSetup();
