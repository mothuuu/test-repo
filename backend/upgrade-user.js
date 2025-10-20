require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function upgradeUser() {
  try {
    console.log('🔄 Upgrading rueben@rogers.com to DIY plan...');
    
    const result = await pool.query(
      `UPDATE users 
       SET plan = $1, 
           scans_used_this_month = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = $2
       RETURNING id, email, plan, scans_used_this_month`,
      ['diy', 'rueben@rogers.com']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found!');
    } else {
      console.log('✅ User upgraded successfully:');
      console.log(result.rows[0]);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

upgradeUser();