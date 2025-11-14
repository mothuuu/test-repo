# 🚀 Local Development Setup Guide

Complete guide to set up the AI Visibility Tool on your local computer for safe Pro Plan development.

---

## Prerequisites

Before starting, make sure you have these installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)
- **Git** - [Download here](https://git-scm.com/)

---

## Step 1: Clone the Repository

Open your terminal and run:

```bash
# Clone from GitHub
git clone https://github.com/mothuuu/ai-visibility-tool.git

# Navigate into the project
cd ai-visibility-tool
```

**Or if you already have the repo:**

```bash
# Navigate to your project folder
cd ai-visibility-tool

# Pull latest changes
git pull origin main
```

---

## Step 2: Install PostgreSQL (if not installed)

### macOS (using Homebrew):
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows:
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

---

## Step 3: Create Local Database

```bash
# Connect to PostgreSQL
# macOS/Linux:
psql postgres

# Windows (via pgAdmin or Command Prompt):
psql -U postgres
```

Once connected, create your database:

```sql
-- Create database
CREATE DATABASE ai_visibility_local;

-- Create a user (optional, but recommended)
CREATE USER ai_visibility_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ai_visibility_local TO ai_visibility_user;

-- Exit psql
\q
```

---

## Step 4: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Return to root
cd ..
```

---

## Step 5: Configure Environment Variables

```bash
# Copy the example file
cp .env.example backend/.env

# Edit the .env file with your settings
# Use your favorite text editor (nano, vim, VS Code, etc.)
nano backend/.env
```

### Minimum Required Configuration:

```bash
# Database (use the database you just created)
DATABASE_URL=postgresql://localhost/ai_visibility_local
# Or if you created a user:
# DATABASE_URL=postgresql://ai_visibility_user:your_secure_password@localhost/ai_visibility_local

# Server
PORT=3000
NODE_ENV=development

# JWT Secret (any random string for local dev)
JWT_SECRET=local-dev-secret-change-me-in-production

# Stripe TEST MODE (get these from Stripe Dashboard > Developers)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_DIY=price_test_...
STRIPE_PRICE_ID_PRO=price_test_...

# OpenAI (if you have an API key)
OPENAI_API_KEY=sk-...

# Anthropic (if you have an API key)
ANTHROPIC_API_KEY=sk-ant-...

# Email (optional - use Mailtrap for testing)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-username
EMAIL_PASS=your-mailtrap-password
EMAIL_FROM=noreply@localhost

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

## Step 6: Set Up Database Schema

Run the initial database setup:

```bash
cd backend
node db/setup.js
```

You should see:
```
🔄 Setting up database tables...
✅ Brand facts table created
✅ Users table created
✅ Scans table created
✅ Page analysis table created
✅ Usage logs table created
✅ Indexes created
🎉 Database setup complete!
```

---

## Step 7: Run All Migrations

Apply all existing migrations to get your local database up to date:

```bash
# Still in the backend folder
node db/migrate-auth.js
node db/migrate-scans.js
node db/migrate-user-industry.js
node db/migrate-tracking-and-webhooks.js
node db/migrate-recommendation-feedback.js
node db/migrate-primary-domain.js
node db/migrate-progressive-unlock.js
node db/migrate-hybrid-recommendations.js
node db/migrate-allow-guest-scans.js
node db/migrate-batch-unlock.js
node db/migrate-admin-system.js
node db/migrate-add-competitor-scan-column.js
node db/migrate-add-paused-column.js
node db/migrate-historic-comparison.js
node db/migrate-landing-page-cms.js
```

**Note:** Some migrations may show "column already exists" - that's normal and safe!

---

## Step 8: Start the Server

```bash
# From the backend folder
npm run dev

# Or use regular start:
npm start
```

You should see:
```
🚀 Server running on port 3000
✅ Database connected
```

---

## Step 9: Test Your Setup

Open your browser and test:

1. **Frontend**: `http://localhost:3000`
2. **API Health Check**: `http://localhost:3000/health` (should return "OK")

---

## Step 10: Get Stripe Test Keys

To test Pro plan features with Stripe:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Toggle "Test mode" (top right)
3. Go to **Developers** > **API Keys**
4. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)
5. Create test products/prices:
   - Go to **Products** > **Add Product**
   - Create "DIY Plan" ($29/month) and "Pro Plan" ($99/month)
   - Copy the price IDs (`price_test_...`)
6. Set up webhook for local testing:
   - Install Stripe CLI: `brew install stripe/stripe-cli/stripe` (macOS)
   - Run: `stripe listen --forward-to localhost:3000/api/subscription/webhook`
   - Copy the webhook signing secret (`whsec_...`)

---

## ✅ Verification Checklist

- [ ] PostgreSQL is running
- [ ] Database `ai_visibility_local` created
- [ ] Dependencies installed (`node_modules` exists)
- [ ] `.env` file configured in `backend/` folder
- [ ] Database setup completed (tables created)
- [ ] All migrations run successfully
- [ ] Server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Stripe test keys configured (optional but recommended)

---

## 🎯 You're Ready for Pro Plan Development!

Now you can:
- ✅ Implement Pro plan features safely
- ✅ Test Stripe subscriptions with test mode
- ✅ Make database changes without affecting production
- ✅ Break things without consequences!

### Next Steps:

1. Create a new branch for your work:
   ```bash
   git checkout -b feature/pro-plan-implementation
   ```

2. Make your changes and test locally

3. When ready to go live:
   - Create a migration file for any schema changes
   - Deploy code to production
   - Run migrations on production database
   - Switch to Stripe live mode keys

---

## 🆘 Troubleshooting

### Database connection fails:
```bash
# Check if PostgreSQL is running
# macOS:
brew services list

# Ubuntu:
sudo systemctl status postgresql

# Start it if stopped:
# macOS:
brew services start postgresql

# Ubuntu:
sudo systemctl start postgresql
```

### Port 3000 already in use:
```bash
# Change PORT in .env file to 3001 or any other port
PORT=3001
```

### Migration errors:
```bash
# Check database connection
psql postgresql://localhost/ai_visibility_local

# List tables
\dt

# Exit
\q
```

---

## 📞 Need Help?

- Check the error messages carefully
- Verify all environment variables are set correctly
- Make sure PostgreSQL is running
- Ensure database exists and is accessible

---

**Remember:** Everything you do locally is completely isolated from production! 🎉
