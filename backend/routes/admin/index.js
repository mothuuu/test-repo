const express = require('express');
const router = express.Router();

// Import admin route modules
const overviewRoutes = require('./overview');
const usersRoutes = require('./users');
const curationRoutes = require('./curation');
const analyticsRoutes = require('./analytics');
const cmsRoutes = require('./cms');

// Middleware to prevent caching of admin data
// This ensures admins always see the latest real-time data
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Mount routes
router.use('/overview', overviewRoutes);
router.use('/users', usersRoutes);
router.use('/curation', curationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/cms', cmsRoutes);

module.exports = router;
