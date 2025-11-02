const express = require('express');
const router = express.Router();

// Import admin route modules
const overviewRoutes = require('./overview');
const usersRoutes = require('./users');
const curationRoutes = require('./curation');
const analyticsRoutes = require('./analytics');

// Mount routes
router.use('/overview', overviewRoutes);
router.use('/users', usersRoutes);
router.use('/curation', curationRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
