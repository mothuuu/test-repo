const express = require('express');
const router = express.Router();
const { stripe, PLANS } = require('../config/stripe');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, domain } = req.body;
    
    if (!email || !domain) {
      return res.status(400).json({ error: 'Email and domain required' });
    }
    
    let user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      
      const newUser = await db.query(
        'INSERT INTO users (email, password_hash, plan) VALUES ($1, $2, $3) RETURNING id',
        [email, passwordHash, 'free']
      );
      user = newUser;
    }
    
    const userId = user.rows[0].id;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Premium Plan - ${domain}`,
            description: 'Deep AI visibility analysis',
          },
          unit_amount: 2900,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout.html?cancelled=true`,
      customer_email: email,
      client_reference_id: userId.toString(),
      metadata: { userId: userId.toString(), domain: domain }
    });
    
    res.json({ sessionId: session.id, url: session.url });
    
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;