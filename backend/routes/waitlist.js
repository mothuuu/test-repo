const express = require('express');
const db = require('../db/database');
const { sendWaitlistConfirmationEmail, sendWaitlistAdminNotification } = require('../utils/email');
const router = express.Router();

// Middleware to verify JWT token (optional for waitlist)
const authenticateTokenOptional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
    } catch (error) {
      // Token invalid, continue without userId
    }
  }

  next();
};

// POST /api/waitlist/join - Join waitlist
router.post('/join', authenticateTokenOptional, async (req, res) => {
  try {
    const { plan, name, email, company, website, currentPlan, message } = req.body;

    // Validation
    if (!plan || !name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Plan, name, and email are required'
      });
    }

    // Validate plan type
    const validPlans = ['premium', 'pro', 'agency'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if already on waitlist for this plan
    const existing = await db.query(
      'SELECT id FROM waitlist WHERE email = $1 AND plan = $2',
      [email, plan]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You are already on the waitlist for this plan'
      });
    }

    // Insert into waitlist table
    const result = await db.query(
      `INSERT INTO waitlist (
        user_id, plan, name, email, company, website, current_plan, message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, plan, name, email, created_at`,
      [
        req.userId || null,
        plan,
        name,
        email,
        company || null,
        website || null,
        currentPlan || null,
        message || null
      ]
    );

    const waitlistEntry = result.rows[0];

    console.log(`✅ New waitlist signup: ${email} for ${plan} plan`);

    // Send confirmation email to user
    try {
      await sendWaitlistConfirmationEmail(email, name, plan);
      console.log(`📧 Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send admin notification email
    try {
      await sendWaitlistAdminNotification({
        name,
        email,
        plan,
        company,
        website,
        currentPlan,
        message
      });
      console.log(`📧 Admin notification sent to aivisibility@xeo.marketing`);
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the waitlist!',
      waitlist: {
        id: waitlistEntry.id,
        plan: waitlistEntry.plan,
        name: waitlistEntry.name,
        email: waitlistEntry.email,
        createdAt: waitlistEntry.created_at
      }
    });

  } catch (error) {
    console.error('Waitlist join error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join waitlist. Please try again.'
    });
  }
});

// GET /api/waitlist/check - Check if user is on waitlist
router.get('/check', authenticateTokenOptional, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await db.query(
      'SELECT plan, created_at FROM waitlist WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        onWaitlist: false
      });
    }

    res.json({
      success: true,
      onWaitlist: true,
      plans: result.rows.map(row => ({
        plan: row.plan,
        joinedAt: row.created_at
      }))
    });

  } catch (error) {
    console.error('Waitlist check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check waitlist status'
    });
  }
});

module.exports = router;
