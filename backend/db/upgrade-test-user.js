const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function upgrade() {
  await pool.query(`
    UPDATE users 
    SET plan = 'diy', scans_used_this_month = 0 
    WHERE email = 'test1@example.com'
  `);
  console.log('✅ User upgraded to DIY plan!');
  await pool.end();
}

upgrade();
