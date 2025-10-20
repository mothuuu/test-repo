require('dotenv').config();
const db = require('./db/database');

db.query('DELETE FROM users WHERE email = $1', ['test@example.com'])
  .then(() => {
    console.log('✅ Test user deleted');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
