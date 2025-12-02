require('dotenv').config();
const db = require('./database');

async function addMissingScanColumns() {
  console.log('🔄 Adding missing columns to scans and scan_recommendations tables...\n');

  try {
    // ==========================================
    // SCANS TABLE
    // ==========================================
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

    console.log('✅ Scans table columns updated');

    // ==========================================
    // SCAN_RECOMMENDATIONS TABLE
    // ==========================================

    // First create the table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS scan_recommendations (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        category VARCHAR(100),
        recommendation_text TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ scan_recommendations table exists');

    // Add all potentially missing columns
    await db.query(`
      DO $$
      BEGIN
        -- estimated_impact
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='estimated_impact'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN estimated_impact INTEGER;
          RAISE NOTICE 'Added estimated_impact column';
        END IF;

        -- estimated_effort
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='estimated_effort'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN estimated_effort VARCHAR(50);
          RAISE NOTICE 'Added estimated_effort column';
        END IF;

        -- action_steps
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='action_steps'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN action_steps JSONB;
          RAISE NOTICE 'Added action_steps column';
        END IF;

        -- findings
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='findings'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN findings TEXT;
          RAISE NOTICE 'Added findings column';
        END IF;

        -- code_snippet
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='code_snippet'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN code_snippet TEXT;
          RAISE NOTICE 'Added code_snippet column';
        END IF;

        -- unlock_state
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='unlock_state'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN unlock_state VARCHAR(20) DEFAULT 'locked';
          RAISE NOTICE 'Added unlock_state column';
        END IF;

        -- batch_number
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='batch_number'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN batch_number INTEGER DEFAULT 1;
          RAISE NOTICE 'Added batch_number column';
        END IF;

        -- unlocked_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='unlocked_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN unlocked_at TIMESTAMP;
          RAISE NOTICE 'Added unlocked_at column';
        END IF;

        -- recommendation_type
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='recommendation_type'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN recommendation_type VARCHAR(50);
          RAISE NOTICE 'Added recommendation_type column';
        END IF;

        -- page_url
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='page_url'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN page_url TEXT;
          RAISE NOTICE 'Added page_url column';
        END IF;

        -- skip_enabled_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='skip_enabled_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN skip_enabled_at TIMESTAMP;
          RAISE NOTICE 'Added skip_enabled_at column';
        END IF;

        -- impact_description
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='impact_description'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN impact_description TEXT;
          RAISE NOTICE 'Added impact_description column';
        END IF;

        -- customized_implementation
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='customized_implementation'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN customized_implementation TEXT;
          RAISE NOTICE 'Added customized_implementation column';
        END IF;

        -- ready_to_use_content
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='ready_to_use_content'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN ready_to_use_content TEXT;
          RAISE NOTICE 'Added ready_to_use_content column';
        END IF;

        -- implementation_notes
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='implementation_notes'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN implementation_notes JSONB;
          RAISE NOTICE 'Added implementation_notes column';
        END IF;

        -- quick_wins
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='quick_wins'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN quick_wins JSONB;
          RAISE NOTICE 'Added quick_wins column';
        END IF;

        -- validation_checklist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='validation_checklist'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN validation_checklist JSONB;
          RAISE NOTICE 'Added validation_checklist column';
        END IF;

        -- status
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='status'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
          RAISE NOTICE 'Added status column';
        END IF;

        -- implemented_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='implemented_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN implemented_at TIMESTAMP;
          RAISE NOTICE 'Added implemented_at column';
        END IF;

        -- user_feedback
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='user_feedback'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN user_feedback TEXT;
          RAISE NOTICE 'Added user_feedback column';
        END IF;

        -- user_rating
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='user_rating'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN user_rating INTEGER;
          RAISE NOTICE 'Added user_rating column';
        END IF;

        -- updated_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='updated_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          RAISE NOTICE 'Added updated_at column';
        END IF;

      END $$;
    `);

    console.log('✅ scan_recommendations table columns updated');

    // Create indexes if they don't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
      CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(extracted_domain);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_scan_id ON scan_recommendations(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_category ON scan_recommendations(category);
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

    console.log('\n🎉 Scans and scan_recommendations migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMissingScanColumns();
