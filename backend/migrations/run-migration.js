#!/usr/bin/env node

/**
 * Migration runner - runs SQL migration files
 * Usage: node migrations/run-migration.js migrations/add_impact_description.sql
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Get migration file from command line args
const migrationFile = process.argv[2] || 'migrations/add_impact_description.sql';
const migrationPath = path.resolve(__dirname, '..', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

// Read migration SQL
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log(`\n🔄 Running migration: ${path.basename(migrationFile)}`);
console.log(`📁 File: ${migrationPath}`);

// Database connection
const connectionString = process.env.DATABASE_URL;
const isLocalDB = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDB ? false : {
    rejectUnauthorized: false
  }
});

// Run migration
async function runMigration() {
  try {
    console.log(`\n🔌 Connecting to database...`);
    const result = await pool.query(sql);
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Rows affected: ${result.rowCount || 0}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error.message);
    console.error(`\nDetails:`, error);
    process.exit(1);
  }
}

runMigration();
