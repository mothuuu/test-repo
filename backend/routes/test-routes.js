const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Test endpoint to check recommendation counts
router.get('/check-recommendations/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    const result = await db.query(`
      SELECT 
        recommendation_type,
        COUNT(*) as count
      FROM scan_recommendations
      WHERE scan_id = $1
      GROUP BY recommendation_type
    `, [scanId]);
    
    const total = await db.query(`
      SELECT COUNT(*) as total
      FROM scan_recommendations
      WHERE scan_id = $1
    `, [scanId]);
    
    res.json({
      scanId: scanId,
      breakdown: result.rows,
      total: total.rows[0].total
    });
    
  } catch (error) {
    console.error('Error checking recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;