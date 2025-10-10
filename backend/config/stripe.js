const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  premium: {
    name: 'Premium',
    price: 2900,
    interval: 'month',
    features: [
      'Deep multi-page scan (30+ pages)',
      'Competitor benchmarking (3 competitors)',
      'AI Engine simulation',
      'Exportable PDF reports',
      'Monthly tracking & trends'
    ]
  }
};

module.exports = { stripe, PLANS };