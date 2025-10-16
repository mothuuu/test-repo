const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db/database');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

// Price IDs from your Stripe dashboard
const PRICE_IDS = {
  diy: process.env.STRIPE_PRICE_DIY || 'price_diy_monthly',
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly'
};

// Create Checkout Session - NOW REQUIRES AUTHENTICATION
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { domain, plan = 'diy' } = req.body;
    const userId = req.user.id;
    const email = req.user.email;

    console.log(`🛒 Checkout request: User ${userId} (${email}) for ${plan} plan`);

    if (!domain) {
      return res.status(400).json({ error: 'Domain required' });
    }

    if (!['diy', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Get or create Stripe customer
    let customerId = req.user.stripe_customer_id;
    
    if (!customerId) {
      console.log(`📝 Creating new Stripe customer for user ${userId}`);
      const customer = await stripe.customers.create({
        email: email,
        metadata: { userId: userId.toString(), domain }
      });
      customerId = customer.id;
      
      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
      console.log(`✅ Stripe customer created: ${customerId}`);
    }

    // ... rest of the function

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout.html?plan=${plan}`,
      metadata: {
        userId: userId.toString(),
        domain,
        plan
      },
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          domain,
          plan
        }
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook Handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Webhook Handlers
async function handleCheckoutComplete(session) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  const subscriptionId = session.subscription;

  await db.query(
    `UPDATE users 
     SET plan = $1, 
         stripe_subscription_id = $2,
         scans_used_this_month = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [plan, subscriptionId, userId]
  );

  console.log(`✅ User ${userId} upgraded to ${plan} plan`);
}

async function handleSubscriptionChange(subscription) {
  const customerId = subscription.customer;
  
  const user = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (user.rows.length === 0) return;

  const userId = user.rows[0].id;
  const isActive = subscription.status === 'active';
  const plan = isActive ? subscription.metadata.plan : 'free';

  await db.query(
    `UPDATE users 
     SET plan = $1, 
         stripe_subscription_id = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [plan, subscription.id, userId]
  );

  console.log(`🔄 Subscription updated for user ${userId}: ${plan}`);
}

async function handlePaymentSuccess(invoice) {
  const customerId = invoice.customer;
  
  const user = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (user.rows.length === 0) return;

  // Reset monthly scan counter on successful payment
  await db.query(
    'UPDATE users SET scans_used_this_month = 0 WHERE id = $1',
    [user.rows[0].id]
  );

  console.log(`💳 Payment succeeded for user ${user.rows[0].id}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  
  const user = await db.query(
    'SELECT id, email FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (user.rows.length === 0) return;

  console.log(`❌ Payment failed for user ${user.rows[0].id}`);
}

// Get subscription status
router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await db.query(
      `SELECT plan, stripe_subscription_id, scans_used_this_month 
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    let subscriptionStatus = null;

    if (user.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(
        user.stripe_subscription_id
      );
      subscriptionStatus = {
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      };
    }

    res.json({
      plan: user.plan,
      scansUsed: user.scans_used_this_month,
      subscription: subscriptionStatus
    });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await db.query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_subscription_id) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    // Cancel at period end (don't cancel immediately)
    const subscription = await stripe.subscriptions.update(
      result.rows[0].stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    res.json({
      message: 'Subscription will be cancelled at period end',
      periodEnd: subscription.current_period_end
    });
  } catch (error) {
    console.error('Cancellation failed:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;