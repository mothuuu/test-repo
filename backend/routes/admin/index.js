const express = require('express');
const router = express.Router();

// Import admin route modules
const overviewRoutes = require('./overview');
const usersRoutes = require('./users');
const curationRoutes = require('./curation');

// Mount routes
router.use('/overview', overviewRoutes);
router.use('/users', usersRoutes);
router.use('/curation', curationRoutes);

module.exports = router;
