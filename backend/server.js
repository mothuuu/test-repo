require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const aiTestingRoutes = require('./routes/ai-testing');
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscription');
const scanRoutes = require('./routes/scan');
const recommendationRoutes = require('./routes/recommendations');
const feedbackRoutes = require('./routes/feedback');
const supportChatRoutes = require('./routes/support-chat');
const waitlistRoutes = require('./routes/waitlist');

const app = express();
const PORT = process.env.PORT || 3001;

// CRITICAL: Trust proxy for Render deployment
// Set to 1 to trust the first proxy (Render's reverse proxy)
// This is required for rate limiting and IP-based features to work correctly
app.set('trust proxy', 1);

app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://aome.xeo.marketing',
    'http://localhost:3000',
    'http://localhost:8000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting - Fixed for Render
// Trust proxy is set at app level, don't override it here
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 50,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 / 60)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health';
  }
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', aiTestingRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/support-chat', supportChatRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/test', require('./routes/test-routes'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`AI Visibility API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});