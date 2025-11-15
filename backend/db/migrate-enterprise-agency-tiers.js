const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateEnterpriseAgencyTiers() {
  try {
    console.log('🔄 Adding Enterprise and Agency tier support...');

    // Add new columns for advanced plan features
    await pool.query(`
      DO $$
      BEGIN
        -- Add API access flag for Enterprise/Agency users
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='api_access_enabled'
        ) THEN
          ALTER TABLE users ADD COLUMN api_access_enabled BOOLEAN DEFAULT false;
        END IF;

        -- Add white-label flag for Agency users
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='white_label_enabled'
        ) THEN
          ALTER TABLE users ADD COLUMN white_label_enabled BOOLEAN DEFAULT false;
        END IF;

        -- Add multi-client management for Agency users
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='client_accounts'
        ) THEN
          ALTER TABLE users ADD COLUMN client_accounts JSONB DEFAULT '[]'::jsonb;
        END IF;

        -- Add custom branding settings for white-label
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='branding_settings'
        ) THEN
          ALTER TABLE users ADD COLUMN branding_settings JSONB DEFAULT '{}'::jsonb;
        END IF;

        -- Add priority support flag
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='priority_support'
        ) THEN
          ALTER TABLE users ADD COLUMN priority_support BOOLEAN DEFAULT false;
        END IF;

        -- Add dedicated account manager flag for Agency
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='has_account_manager'
        ) THEN
          ALTER TABLE users ADD COLUMN has_account_manager BOOLEAN DEFAULT false;
        END IF;

        -- Update subscription_plan to support new tiers (if column exists)
        -- Note: This is safe because we're just allowing more values, not changing existing ones
        DO $inner$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='users' AND column_name='subscription_plan'
          ) THEN
            -- Alter the check constraint to include enterprise and agency
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_plan_check;
            ALTER TABLE users ADD CONSTRAINT users_subscription_plan_check
              CHECK (subscription_plan IN ('free', 'diy', 'pro', 'enterprise', 'agency'));
          END IF;
        END $inner$;

      END $$;
    `);
    console.log('✅ Enterprise/Agency fields added successfully');

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_api_access
        ON users(api_access_enabled)
        WHERE api_access_enabled = true;

      CREATE INDEX IF NOT EXISTS idx_users_white_label
        ON users(white_label_enabled)
        WHERE white_label_enabled = true;

      CREATE INDEX IF NOT EXISTS idx_users_priority_support
        ON users(priority_support)
        WHERE priority_support = true;
    `);
    console.log('✅ Enterprise/Agency indexes created');

    // Create API keys table for Enterprise/Agency users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        name VARCHAR(100),
        scopes JSONB DEFAULT '[]'::jsonb,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        revoked BOOLEAN DEFAULT false,
        UNIQUE(key_hash)
      );
    `);
    console.log('✅ API keys table created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
        ON api_keys(user_id);

      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
        ON api_keys(key_hash)
        WHERE revoked = false;
    `);
    console.log('✅ API keys indexes created');

    // Create client accounts table for Agency users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_accounts (
        id SERIAL PRIMARY KEY,
        agency_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_name VARCHAR(255) NOT NULL,
        client_domain VARCHAR(255),
        client_email VARCHAR(255),
        client_metadata JSONB DEFAULT '{}'::jsonb,
        scans_allocated INTEGER DEFAULT 0,
        scans_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT true
      );
    `);
    console.log('✅ Client accounts table created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_client_accounts_agency_user
        ON client_accounts(agency_user_id);

      CREATE INDEX IF NOT EXISTS idx_client_accounts_active
        ON client_accounts(active)
        WHERE active = true;
    `);
    console.log('✅ Client accounts indexes created');

    console.log('🎉 Enterprise/Agency tier migration complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Update STRIPE_PRICE_ID_ENTERPRISE in your .env file');
    console.log('2. Update STRIPE_PRICE_ID_AGENCY in your .env file');
    console.log('3. Create Enterprise and Agency products in Stripe Dashboard');
    console.log('4. Test the new tiers in your testing environment');
    console.log('');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

migrateEnterpriseAgencyTiers();
