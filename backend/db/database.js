require('dotenv').config(); // Load .env file
const { Pool } = require('pg');

// Configure database connection with SSL based on environment
// Render free-tier databases may not support SSL, so we disable it for render.com
const connectionString = process.env.DATABASE_URL;
const isLocalDB = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');
const isRenderDB = connectionString?.includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Disable SSL for local and Render databases (Render free tier doesn't support SSL)
  // Keep SSL enabled for other cloud providers
  ssl: isLocalDB || isRenderDB ? false : {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};