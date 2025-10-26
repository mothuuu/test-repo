#!/bin/bash
# Quick script to reset monthly scan quota

echo "🔄 Resetting monthly scan quota..."

# Run the SQL script using psql
# Adjust the database connection details if needed
psql $DATABASE_URL -f backend/migrations/reset_monthly_quota.sql

echo "✅ Done! Your scan quota has been reset to 0/2"
