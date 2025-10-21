const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkScans() {
  try {
    console.log('🔍 Checking all scans in database...\n');
    
    const result = await pool.query(`
      SELECT 
        s.id, 
        s.url, 
        s.total_score,
        s.created_at,
        u.email,
        u.plan
      FROM scans s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No scans found in database at all!');
      console.log('   Run a scan through the frontend first.\n');
    } else {
      console.log(`✅ Found ${result.rows.length} recent scans:\n`);
      result.rows.forEach((scan, i) => {
        console.log(`${i + 1}. Scan ID: ${scan.id}`);
        console.log(`   URL: ${scan.url}`);
        console.log(`   User: ${scan.email} (${scan.plan})`);
        console.log(`   Score: ${scan.total_score}`);
        console.log(`   Created: ${scan.created_at}\n`);
      });
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

checkScans();