const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ai_visibility_db',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function checkRecentRecommendations() {
  try {
    console.log('\n🔍 Checking most recent FAQ recommendations...\n');

    const result = await pool.query(`
      SELECT
        id,
        recommendation_text,
        category,
        created_at,
        LENGTH(customized_implementation) as customized_impl_length,
        LENGTH(ready_to_use_content) as ready_to_use_length,
        CASE
          WHEN implementation_notes IS NOT NULL AND implementation_notes != 'null' THEN true
          ELSE false
        END as has_impl_notes,
        CASE
          WHEN quick_wins IS NOT NULL AND quick_wins != 'null' THEN true
          ELSE false
        END as has_quick_wins,
        CASE
          WHEN validation_checklist IS NOT NULL AND validation_checklist != 'null' THEN true
          ELSE false
        END as has_validation_checklist,
        implementation_notes,
        quick_wins,
        validation_checklist
      FROM scan_recommendations
      WHERE category LIKE '%FAQ%' OR findings LIKE '%FAQ%' OR recommendation_text LIKE '%FAQ%'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    if (result.rows.length === 0) {
      console.log('❌ No FAQ recommendations found in database');
      await pool.end();
      return;
    }

    result.rows.forEach((row, idx) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 RECOMMENDATION #${idx + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`ID: ${row.id}`);
      console.log(`Title: ${row.recommendation_text}`);
      console.log(`Category: ${row.category}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`\n📊 STRUCTURED FIELDS STATUS:`);
      console.log(`  ${row.customized_impl_length > 0 ? '✅' : '❌'} customized_implementation: ${row.customized_impl_length || 0} chars`);
      console.log(`  ${row.ready_to_use_length > 0 ? '✅' : '❌'} ready_to_use_content: ${row.ready_to_use_length || 0} chars`);
      console.log(`  ${row.has_impl_notes ? '✅' : '❌'} implementation_notes: ${row.has_impl_notes ? 'YES' : 'NO'}`);
      console.log(`  ${row.has_quick_wins ? '✅' : '❌'} quick_wins: ${row.has_quick_wins ? 'YES' : 'NO'}`);
      console.log(`  ${row.has_validation_checklist ? '✅' : '❌'} validation_checklist: ${row.has_validation_checklist ? 'YES' : 'NO'}`);

      // Show array contents if they exist
      if (row.has_impl_notes) {
        try {
          const notes = typeof row.implementation_notes === 'string'
            ? JSON.parse(row.implementation_notes)
            : row.implementation_notes;
          console.log(`\n  📝 Implementation Notes (${notes.length} items):`);
          notes.forEach((note, i) => {
            console.log(`     ${i + 1}. ${note.substring(0, 80)}${note.length > 80 ? '...' : ''}`);
          });
        } catch (e) {
          console.log(`  ⚠️  Error parsing implementation_notes: ${e.message}`);
        }
      }

      if (row.has_quick_wins) {
        try {
          const wins = typeof row.quick_wins === 'string'
            ? JSON.parse(row.quick_wins)
            : row.quick_wins;
          console.log(`\n  ⚡ Quick Wins (${wins.length} items):`);
          wins.forEach((win, i) => {
            console.log(`     ${i + 1}. ${win.substring(0, 80)}${win.length > 80 ? '...' : ''}`);
          });
        } catch (e) {
          console.log(`  ⚠️  Error parsing quick_wins: ${e.message}`);
        }
      }

      if (row.has_validation_checklist) {
        try {
          const checklist = typeof row.validation_checklist === 'string'
            ? JSON.parse(row.validation_checklist)
            : row.validation_checklist;
          console.log(`\n  ✓ Validation Checklist (${checklist.length} items):`);
          checklist.forEach((item, i) => {
            console.log(`     ${i + 1}. ${item.substring(0, 80)}${item.length > 80 ? '...' : ''}`);
          });
        } catch (e) {
          console.log(`  ⚠️  Error parsing validation_checklist: ${e.message}`);
        }
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkRecentRecommendations();
