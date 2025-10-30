const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/auth/signup - Create account
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, industry, industryCustom } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Strong password validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({
        error: 'Password must include uppercase, lowercase, number, and special character'
      });
    }

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user with optional industry
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, plan, verification_token, email_verified, industry, industry_custom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, plan, email_verified, industry, industry_custom`,
      [email, passwordHash, name || 'User', 'free', verificationToken, false, industry || null, industryCustom || null]
    );

    const user = result.rows[0];

    console.log(`✅ New user signup: ${email}${industry ? ` (Industry: ${industry})` : ''}`);
    
    // Generate JWT
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken);
    
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        email_verified: user.email_verified,
        industry: user.industry,
        industry_custom: user.industry_custom
      },
      accessToken
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login - Sign in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Get user
    const result = await db.query(
      `SELECT id, email, password_hash, name, plan, email_verified,
              scans_used_this_month, competitor_scans_used_this_month,
              primary_domain, primary_domain_changed_at,
              industry, industry_custom
       FROM users WHERE email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    // Generate JWT
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        email_verified: user.email_verified,
        scans_used_this_month: user.scans_used_this_month || 0,
        competitor_scans_used_this_month: user.competitor_scans_used_this_month || 0,
        primary_domain: user.primary_domain,
        primary_domain_changed_at: user.primary_domain_changed_at,
        industry: user.industry,
        industry_custom: user.industry_custom
      },
      accessToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - Sign out
router.post('/logout', authenticateToken, async (req, res) => {
  // In a JWT-based system, logout is handled client-side by removing the token
  // But we can still provide an endpoint for consistency
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, name, plan, email_verified, scans_used_this_month,
              competitor_scans_used_this_month, primary_domain, primary_domain_changed_at,
              industry, industry_custom, created_at, last_login
       FROM users WHERE id = $1`,
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /api/auth/verify - Check if user is authenticated
router.get('/verify', authenticateToken, async (req, res) => {
  res.json({
    authenticated: true,
    userId: req.user.id,
    email: req.user.email,
    plan: req.user.plan
  });
});

// POST /api/auth/verify-email - Verify email with token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }
    
    // Find user with this token
    const result = await db.query(
      'SELECT id, email FROM users WHERE verification_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    const user = result.rows[0];
    
    // Update user as verified
    await db.query(
      'UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1',
      [user.id]
    );
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    // Get user
    const result = await db.query(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Update user
    await db.query(
      'UPDATE users SET verification_token = $1 WHERE id = $2',
      [verificationToken, user.id]
    );
    
    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    // Find user
    const result = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent'
      });
    }
    
    const user = result.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    
    // Save token
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );
    
    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken);
    
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Find user with valid token
    const result = await db.query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const user = result.rows[0];
    
    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

module.exports = router;