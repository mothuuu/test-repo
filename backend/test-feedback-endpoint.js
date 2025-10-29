// Quick test to check if feedback endpoint works
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const feedbackRoutes = require('./routes/feedback');
const db = require('./db/database');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

// Test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      AND table_name LIKE '%feedback%'
    `);
    res.json({
      success: true,
      tables: result.rows,
      message: result.rows.length === 0
        ? '⚠️ No feedback tables found - migration needed!'
        : '✅ Feedback tables exist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check DATABASE_URL in .env file'
    });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🧪 Test server running on http://localhost:${PORT}`);
  console.log(`\nTest database connection: http://localhost:${PORT}/test-db`);
  console.log(`\nTest feedback endpoint:
  curl -X POST http://localhost:${PORT}/api/feedback/recommendation \\
    -H "Content-Type: application/json" \\
    -d '{"scanId": 1, "recommendationId": "test", "subfactor": "test", "helpful": true}'
  `);
});
