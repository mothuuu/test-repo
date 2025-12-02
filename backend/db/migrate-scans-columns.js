require('dotenv').config();
const db = require('./database');

async function addMissingScanColumns() {
  console.log('🔄 Adding missing columns to scans table...\n');

  try {
    // Add all potentially missing columns to scans table
    await db.query(`
      DO $$
      BEGIN
        -- Status column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='status'
        ) THEN
          ALTER TABLE scans ADD COLUMN status VARCHAR(50) DEFAULT 'completed';
          RAISE NOTICE 'Added status column';
        END IF;

        -- Total score (may exist as 'score')
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='total_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN total_score INTEGER;
          RAISE NOTICE 'Added total_score column';
        END IF;

        -- Rubric version
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='rubric_version'
        ) THEN
          ALTER TABLE scans ADD COLUMN rubric_version VARCHAR(10) DEFAULT 'V5';
          RAISE NOTICE 'Added rubric_version column';
        END IF;

        -- Category scores
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='ai_readability_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN ai_readability_score INTEGER;
          RAISE NOTICE 'Added ai_readability_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='ai_search_readiness_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN ai_search_readiness_score INTEGER;
          RAISE NOTICE 'Added ai_search_readiness_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='content_freshness_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN content_freshness_score INTEGER;
          RAISE NOTICE 'Added content_freshness_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='content_structure_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN content_structure_score INTEGER;
          RAISE NOTICE 'Added content_structure_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='speed_ux_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN speed_ux_score INTEGER;
          RAISE NOTICE 'Added speed_ux_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='technical_setup_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN technical_setup_score INTEGER;
          RAISE NOTICE 'Added technical_setup_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='trust_authority_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN trust_authority_score INTEGER;
          RAISE NOTICE 'Added trust_authority_score column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='voice_optimization_score'
        ) THEN
          ALTER TABLE scans ADD COLUMN voice_optimization_score INTEGER;
          RAISE NOTICE 'Added voice_optimization_score column';
        END IF;

        -- Domain columns
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='domain_type'
        ) THEN
          ALTER TABLE scans ADD COLUMN domain_type VARCHAR(50);
          RAISE NOTICE 'Added domain_type column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='extracted_domain'
        ) THEN
          ALTER TABLE scans ADD COLUMN extracted_domain VARCHAR(255);
          RAISE NOTICE 'Added extracted_domain column';
        END IF;

        -- Timestamps
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='completed_at'
        ) THEN
          ALTER TABLE scans ADD COLUMN completed_at TIMESTAMP;
          RAISE NOTICE 'Added completed_at column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='updated_at'
        ) THEN
          ALTER TABLE scans ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          RAISE NOTICE 'Added updated_at column';
        END IF;

        -- Analysis data
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='detailed_analysis'
        ) THEN
          ALTER TABLE scans ADD COLUMN detailed_analysis JSONB;
          RAISE NOTICE 'Added detailed_analysis column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='recommendations'
        ) THEN
          ALTER TABLE scans ADD COLUMN recommendations JSONB;
          RAISE NOTICE 'Added recommendations column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='pages_analyzed'
        ) THEN
          ALTER TABLE scans ADD COLUMN pages_analyzed JSONB;
          RAISE NOTICE 'Added pages_analyzed column';
        END IF;

        -- Comparison data
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='domain'
        ) THEN
          ALTER TABLE scans ADD COLUMN domain VARCHAR(255);
          RAISE NOTICE 'Added domain column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='previous_scan_id'
        ) THEN
          ALTER TABLE scans ADD COLUMN previous_scan_id INTEGER REFERENCES scans(id);
          RAISE NOTICE 'Added previous_scan_id column';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='comparison_data'
        ) THEN
          ALTER TABLE scans ADD COLUMN comparison_data JSONB;
          RAISE NOTICE 'Added comparison_data column';
        END IF;

      END $$;
    `);

    console.log('✅ All missing columns added to scans table');

    // Create indexes if they don't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
      CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(extracted_domain);
    `);
    console.log('✅ Indexes created');

    // Copy score to total_score if total_score is null but score exists
    await db.query(`
      UPDATE scans
      SET total_score = score
      WHERE total_score IS NULL AND score IS NOT NULL
    `);
    console.log('✅ Migrated score values to total_score');

    // Set default status for existing scans
    await db.query(`
      UPDATE scans
      SET status = 'completed'
      WHERE status IS NULL
    `);
    console.log('✅ Set default status for existing scans');

    console.log('\n🎉 Scans table migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMissingScanColumns();
