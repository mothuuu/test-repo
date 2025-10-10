const db = require('../db/database');

const PLAN_LIMITS = {
  free: {
    scansPerMonth: 2,
    multiPageScan: false,
    competitorAnalysis: false,
    pdfExport: false
  },
  premium: {
    scansPerMonth: 50,
    multiPageScan: true,
    competitorAnalysis: true,
    pdfExport: true
  }
};

async function checkScanLimit(req, res, next) {
  try {
    const userId = req.user.id;
    const userPlan = req.user.plan;
    const limits = PLAN_LIMITS[userPlan];
    
    // Check if user exceeded monthly limit
    if (req.user.scans_used_this_month >= limits.scansPerMonth) {
      return res.status(403).json({
        error: 'Scan limit reached',
        message: `You've used ${req.user.scans_used_this_month}/${limits.scansPerMonth} scans this month.`,
        upgrade: userPlan === 'free' ? 'Upgrade to Pro for 50 scans/month' : null
      });
    }
    
    // Increment usage
    await db.query(
      'UPDATE users SET scans_used_this_month = scans_used_this_month + 1 WHERE id = $1',
      [userId]
    );
    
    req.planLimits = limits;
    next();
  } catch (error) {
    console.error('Usage limit check failed:', error);
    res.status(500).json({ error: 'Failed to check usage limits' });
  }
}

function checkFeatureAccess(feature) {
  return (req, res, next) => {
    const limits = PLAN_LIMITS[req.user.plan];
    
    if (!limits[feature]) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature requires a Pro plan. Current plan: ${req.user.plan}`,
        upgrade: true
      });
    }
    
    next();
  };
}

module.exports = { checkScanLimit, checkFeatureAccess, PLAN_LIMITS };