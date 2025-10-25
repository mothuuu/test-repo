require('dotenv').config(); // Load .env file
const { Pool } = require('pg');

// Parse the connection string to determine if SSL is needed
const connectionString = process.env.DATABASE_URL;
const isRenderDB = connectionString?.includes('render.com');
const isLocalDB = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRenderDB ? {
    rejectUnauthorized: false
  } : (isLocalDB ? false : {
    rejectUnauthorized: false
  })
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};