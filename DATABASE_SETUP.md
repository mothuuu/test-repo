# Database Setup Guide

This guide will help you set up your PostgreSQL database for the AI Visibility Tool.

## Prerequisites

✅ You already have:
- PostgreSQL database created on Render
- DATABASE_URL environment variable set in Render

## Setup Steps

### Option 1: Run from your local machine (Recommended)

1. **Make sure your `.env` file has the DATABASE_URL**:
   ```env
   DATABASE_URL=postgresql://ai_visibility_testing_db_user:dRoxa6DLPny6Sm4ss4B3n7SQNV33I005@dpg-d4bsi4uuk2gs73dg3bf0-a/ai_visibility_testing_db
   ```

2. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

3. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

4. **Run the complete setup script**:
   ```bash
   node db/setup-complete.js
   ```

   You should see output like:
   ```
   🚀 Starting Complete Database Setup
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   1️⃣  Creating basic tables...
      ✅ brand_facts table
      ✅ users table
      ✅ scans table
      ...
   🎉 Database setup complete!
   ```

### Option 2: Run directly on Render

If you prefer to run the setup directly on Render:

1. **Add a build script** to your `package.json`:
   ```json
   {
     "scripts": {
       "setup-db": "node db/setup-complete.js"
     }
   }
   ```

2. **SSH into Render** or use the Render console to run:
   ```bash
   npm run setup-db
   ```

## Verify Setup

After running the setup, you can verify it worked by checking your database:

1. Connect to your database using a tool like:
   - Render's built-in database shell
   - pgAdmin
   - psql command line

2. Run this query to see all tables:
   ```sql
   \dt
   ```

   You should see tables like:
   - `users`
   - `scans`
   - `page_analysis`
   - `brand_facts`
   - `stripe_events`
   - `waitlist`
   - `landing_page_content`
   - `usage_logs`

## What This Script Does

The setup script creates:

1. **Core Tables**:
   - `users` - User accounts and authentication
   - `scans` - Scan results and scores
   - `page_analysis` - Individual page analysis data
   - `brand_facts` - Brand identity information

2. **Feature Tables**:
   - `stripe_events` - Stripe webhook event tracking
   - `waitlist` - Email waitlist
   - `landing_page_content` - CMS for landing page
   - `usage_logs` - User activity tracking

3. **Indexes** for performance optimization

4. **Authentication fields** for email verification and password reset

5. **Admin system** columns for super admin and regular admin users

## Troubleshooting

### Error: "relation already exists"
This is safe to ignore - it means the table was already created.

### Error: "permission denied"
Make sure your DATABASE_URL has the correct credentials and the user has CREATE permissions.

### Error: "could not connect to server"
- Check that DATABASE_URL is correct
- Check that your database is running on Render
- Check that SSL settings are correct (script uses `rejectUnauthorized: false` for Render)

### Error: "database does not exist"
Make sure you created the database on Render first. The database name should be in your DATABASE_URL.

## After Setup

Once the database is set up, redeploy your Render service and the errors should be gone! 🎉

Your application will now be able to:
- Store scan results
- Handle user registration and authentication
- Process Stripe webhooks
- Track usage and analytics
