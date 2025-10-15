const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '2 scans per month',
      'Homepage only (1 page)',
      'Basic AI visibility score',
      'Top 3 recommendations'
    ]
  },
  diy: {
    name: 'DIY/Starter',
    price: 2900, // $29.00
    interval: 'month',
    priceId: process.env.STRIPE_PRICE_DIY,
    features: [
      '10 scans per month',
      'Homepage + 4 pages YOU choose (5 total)',
      'Page-level TODO lists',
      'Progress tracking',
      'Basic JSON-LD export',
      'Combined recommendations'
    ]
  },
  pro: {
    name: 'Pro',
    price: 9900, // $99.00
    interval: 'month',
    priceId: process.env.STRIPE_PRICE_PRO,
    features: [
      '50 scans per month',
      'Up to 25 pages per scan',
      'Brand Visibility Index',
      'Competitor benchmarking (3 domains)',
      'Outside-in crawl (PR, reviews, social)',
      'Advanced JSON-LD pack',
      'Knowledge Graph fields',
      'Live dashboard & analytics',
      'PDF export'
    ]
  }
};

module.exports = { stripe, PLANS };