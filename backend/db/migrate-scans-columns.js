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

        -- FAQ Schema (JSONB for storing FAQ structured data)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='faq_schema'
        ) THEN
          ALTER TABLE scans ADD COLUMN faq_schema JSONB;
          RAISE NOTICE 'Added faq_schema column';
        END IF;

        -- Industry column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='industry'
        ) THEN
          ALTER TABLE scans ADD COLUMN industry VARCHAR(100);
          RAISE NOTICE 'Added industry column';
        END IF;

        -- Page count
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='page_count'
        ) THEN
          ALTER TABLE scans ADD COLUMN page_count INTEGER DEFAULT 1;
          RAISE NOTICE 'Added page_count column';
        END IF;

        -- Score column (legacy)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='score'
        ) THEN
          ALTER TABLE scans ADD COLUMN score INTEGER;
          RAISE NOTICE 'Added score column';
        END IF;

        -- Scan data (legacy JSONB)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='scan_data'
        ) THEN
          ALTER TABLE scans ADD COLUMN scan_data JSONB;
          RAISE NOTICE 'Added scan_data column';
        END IF;

        -- Pages scanned (legacy)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='pages_scanned'
        ) THEN
          ALTER TABLE scans ADD COLUMN pages_scanned INTEGER;
          RAISE NOTICE 'Added pages_scanned column';
        END IF;

        -- Created at (if missing)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scans' AND column_name='created_at'
        ) THEN
          ALTER TABLE scans ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          RAISE NOTICE 'Added created_at column';
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

        -- skipped_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='skipped_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN skipped_at TIMESTAMP;
          RAISE NOTICE 'Added skipped_at column';
        END IF;

        -- recommendation_mode (diy, done_for_you, elite)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='recommendation_mode'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN recommendation_mode VARCHAR(50);
          RAISE NOTICE 'Added recommendation_mode column';
        END IF;

        -- elite_category
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='elite_category'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN elite_category VARCHAR(100);
          RAISE NOTICE 'Added elite_category column';
        END IF;

        -- impact_score
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='impact_score'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN impact_score INTEGER;
          RAISE NOTICE 'Added impact_score column';
        END IF;

        -- implementation_difficulty
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='implementation_difficulty'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN implementation_difficulty VARCHAR(50);
          RAISE NOTICE 'Added implementation_difficulty column';
        END IF;

        -- compounding_effect_score
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='compounding_effect_score'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN compounding_effect_score INTEGER;
          RAISE NOTICE 'Added compounding_effect_score column';
        END IF;

        -- industry_relevance_score
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='industry_relevance_score'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN industry_relevance_score INTEGER;
          RAISE NOTICE 'Added industry_relevance_score column';
        END IF;

        -- last_refresh_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='last_refresh_date'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN last_refresh_date TIMESTAMP;
          RAISE NOTICE 'Added last_refresh_date column';
        END IF;

        -- next_refresh_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='next_refresh_date'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN next_refresh_date TIMESTAMP;
          RAISE NOTICE 'Added next_refresh_date column';
        END IF;

        -- refresh_cycle_number
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='refresh_cycle_number'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN refresh_cycle_number INTEGER DEFAULT 0;
          RAISE NOTICE 'Added refresh_cycle_number column';
        END IF;

        -- implementation_progress
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='implementation_progress'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN implementation_progress INTEGER DEFAULT 0;
          RAISE NOTICE 'Added implementation_progress column';
        END IF;

        -- previous_findings
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='previous_findings'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN previous_findings TEXT;
          RAISE NOTICE 'Added previous_findings column';
        END IF;

        -- is_partial_implementation
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='is_partial_implementation'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN is_partial_implementation BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added is_partial_implementation column';
        END IF;

        -- validation_status
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='validation_status'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN validation_status VARCHAR(50);
          RAISE NOTICE 'Added validation_status column';
        END IF;

        -- validation_errors
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='validation_errors'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN validation_errors JSONB;
          RAISE NOTICE 'Added validation_errors column';
        END IF;

        -- last_validated_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='last_validated_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN last_validated_at TIMESTAMP;
          RAISE NOTICE 'Added last_validated_at column';
        END IF;

        -- affected_pages
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='affected_pages'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN affected_pages JSONB;
          RAISE NOTICE 'Added affected_pages column';
        END IF;

        -- pages_implemented
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='pages_implemented'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN pages_implemented JSONB;
          RAISE NOTICE 'Added pages_implemented column';
        END IF;

        -- auto_detected_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='auto_detected_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN auto_detected_at TIMESTAMP;
          RAISE NOTICE 'Added auto_detected_at column';
        END IF;

        -- archived_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='archived_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN archived_at TIMESTAMP;
          RAISE NOTICE 'Added archived_at column';
        END IF;

        -- archived_reason
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='archived_reason'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN archived_reason TEXT;
          RAISE NOTICE 'Added archived_reason column';
        END IF;

        -- subfactor (required for validation engine)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='subfactor'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN subfactor VARCHAR(100);
          RAISE NOTICE 'Added subfactor column';
        END IF;

        -- marked_complete_at (required for validation engine)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='marked_complete_at'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN marked_complete_at TIMESTAMP;
          RAISE NOTICE 'Added marked_complete_at column';
        END IF;

      END $$;
    `);

    console.log('✅ scan_recommendations table columns updated');

    // ==========================================
    // PAGE_PRIORITIES TABLE
    // ==========================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS page_priorities (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        page_url TEXT NOT NULL,
        priority_rank INTEGER NOT NULL,
        page_score INTEGER,
        total_recommendations INTEGER DEFAULT 0,
        completed_recommendations INTEGER DEFAULT 0,
        unlocked BOOLEAN DEFAULT false,
        unlocked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scan_id, page_url)
      )
    `);
    console.log('✅ page_priorities table created');

    // ==========================================
    // USER_PROGRESS TABLE
    // ==========================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        total_recommendations INTEGER DEFAULT 0,
        active_recommendations INTEGER DEFAULT 0,
        completed_recommendations INTEGER DEFAULT 0,
        verified_recommendations INTEGER DEFAULT 0,
        current_batch INTEGER DEFAULT 1,
        last_unlock_date DATE,
        unlocks_today INTEGER DEFAULT 0,
        next_unlock_available_at TIMESTAMP,
        completion_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, scan_id)
      )
    `);
    console.log('✅ user_progress table created');

    // Add missing columns to user_progress if table existed before
    await db.query(`
      DO $$
      BEGIN
        -- site_wide_total
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='site_wide_total'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN site_wide_total INTEGER DEFAULT 0;
        END IF;

        -- site_wide_completed
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='site_wide_completed'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN site_wide_completed INTEGER DEFAULT 0;
        END IF;

        -- site_wide_active
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='site_wide_active'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN site_wide_active INTEGER DEFAULT 0;
        END IF;

        -- page_specific_total
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='page_specific_total'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN page_specific_total INTEGER DEFAULT 0;
        END IF;

        -- page_specific_completed
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='page_specific_completed'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN page_specific_completed INTEGER DEFAULT 0;
        END IF;

        -- site_wide_complete
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='site_wide_complete'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN site_wide_complete BOOLEAN DEFAULT false;
        END IF;

        -- batch_1_unlock_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='batch_1_unlock_date'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN batch_1_unlock_date TIMESTAMP;
        END IF;

        -- batch_2_unlock_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='batch_2_unlock_date'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN batch_2_unlock_date TIMESTAMP;
        END IF;

        -- batch_3_unlock_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='batch_3_unlock_date'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN batch_3_unlock_date TIMESTAMP;
        END IF;

        -- batch_4_unlock_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='batch_4_unlock_date'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN batch_4_unlock_date TIMESTAMP;
        END IF;

        -- total_batches
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='total_batches'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN total_batches INTEGER DEFAULT 1;
        END IF;

        -- next_replacement_date
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='next_replacement_date'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN next_replacement_date TIMESTAMP;
        END IF;

        -- target_active_count
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='user_progress' AND column_name='target_active_count'
        ) THEN
          ALTER TABLE user_progress ADD COLUMN target_active_count INTEGER DEFAULT 5;
        END IF;

      END $$;
    `);
    console.log('✅ user_progress table columns updated');

    // Add page_priority column to scan_recommendations if missing
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='scan_recommendations' AND column_name='page_priority'
        ) THEN
          ALTER TABLE scan_recommendations ADD COLUMN page_priority INTEGER;
        END IF;
      END $$;
    `);
    console.log('✅ scan_recommendations.page_priority column added');

    // Create indexes if they don't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
      CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(extracted_domain);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_scan_id ON scan_recommendations(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_category ON scan_recommendations(category);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_type ON scan_recommendations(scan_id, recommendation_type);
      CREATE INDEX IF NOT EXISTS idx_scan_recommendations_page ON scan_recommendations(scan_id, page_url);
      CREATE INDEX IF NOT EXISTS idx_page_priorities_scan_id ON page_priorities(scan_id);
      CREATE INDEX IF NOT EXISTS idx_page_priorities_rank ON page_priorities(scan_id, priority_rank);
      CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_progress_scan_id ON user_progress(scan_id);
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

    // ==========================================
    // USER_RECOMMENDATION_MODE TABLE
    // ==========================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_recommendation_mode (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,

        -- Current mode
        current_mode VARCHAR(20) DEFAULT 'optimization',
        current_score INTEGER,

        -- Mode transition tracking
        previous_mode VARCHAR(20),
        transitioned_at TIMESTAMP,
        transition_reason TEXT,

        -- Elite mode settings
        elite_activated_at TIMESTAMP,
        elite_features_enabled JSONB DEFAULT '{"competitive_tracking": true, "citation_tracking": true, "trend_alerts": true}'::jsonb,

        -- Tracking
        mode_changes_count INTEGER DEFAULT 0,
        last_mode_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id)
      )
    `);
    console.log('✅ user_recommendation_mode table created');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mode_user_id
        ON user_recommendation_mode(user_id);
    `);
    console.log('✅ user_recommendation_mode index created');

    // ==========================================
    // LANDING_PAGE_CONTENT TABLE (CMS)
    // ==========================================
    await db.query(`
      CREATE TABLE IF NOT EXISTS landing_page_content (
        id SERIAL PRIMARY KEY,
        section_key VARCHAR(100) UNIQUE NOT NULL,
        content JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ landing_page_content table created');

    console.log('\n🎉 Scans and scan_recommendations migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMissingScanColumns();
