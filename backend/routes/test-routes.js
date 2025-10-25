const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Check user quota by email
router.get('/check-quota-by-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await db.query(
      'SELECT id, email, plan, scans_used_this_month FROM users WHERE email = $1',
      [email]
    );
    
    const PLAN_LIMITS = {
      free: { scansPerMonth: 2 },
      diy: { scansPerMonth: 25 },
      pro: { scansPerMonth: 50 }
    };
    
    if (user.rows.length === 0) {
      return res.json({ error: 'User not found' });
    }
    
    const userData = user.rows[0];
    const limit = PLAN_LIMITS[userData.plan]?.scansPerMonth || 2;
    
    res.json({
      userId: userData.id,
      email: userData.email,
      plan: userData.plan,
      scansUsed: userData.scans_used_this_month,
      scanLimit: limit,
      remaining: limit - userData.scans_used_this_month,
      quotaExceeded: userData.scans_used_this_month >= limit
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;