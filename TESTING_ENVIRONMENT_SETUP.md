# Testing Environment Setup Guide
## Enterprise & Agency Tier Development

This guide explains how to set up a separate testing environment to build and test Enterprise and Agency plans without affecting your production users.

---

## 🎯 Overview

**Current Branch**: `claude/testing-pro-ent-agency-011CV1v7P45Ej8eJhV7XFpya`

**Purpose**: Build and test Enterprise/Agency features in complete isolation from production

**Strategy**: Separate database, separate deployments, separate Stripe test products

---

## 📊 Plan Comparison

| Plan | Price | Scans/Month | Pages/Scan | Competitor Scans | Special Features |
|------|-------|-------------|------------|------------------|------------------|
| **Free** | $0 | 2 | 1 | 0 | Basic testing |
| **DIY** | $29 | 25 | 5 | 2 | Self-service |
| **Pro** | $99 | 50 | 25 | 10 | Priority support |
| **Enterprise** | $299 | 500 | 25 | 25 | API access, Priority support |
| **Agency** | $599 | Unlimited | 50 | 50 | White-label, Multi-client dashboard, Account manager |

---

## 🚀 Quick Start (5 Steps)

### Step 1: Deploy Testing Backend (Render)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your repository
4. **Important Settings**:
   - **Branch**: `claude/testing-pro-ent-agency-011CV1v7P45Ej8eJhV7XFpya`
   - **Name**: `ai-visibility-testing`
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Instance Type**: Free tier (for testing)

5. Your testing backend URL will be: `https://ai-visibility-testing.onrender.com`

---

### Step 2: Create Testing Database (Render)

1. In Render Dashboard → **New** → **PostgreSQL**
2. **Settings**:
   - **Name**: `ai-visibility-testing-db`
   - **Database**: `ai_visibility_test`
   - **User**: `testuser` (auto-generated)
   - **Region**: Same as your backend
   - **Instance Type**: Free tier

3. Copy the **Internal Database URL** (starts with `postgresql://`)

---

### Step 3: Configure Testing Backend Environment Variables

In your Render backend service settings → **Environment** tab, add these variables:

```bash
# Database
DATABASE_URL=<paste Internal Database URL from Step 2>

# Server
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=<generate new random secret for testing>

# Stripe (TEST MODE - No real charges!)
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret
STRIPE_PRICE_DIY=price_test_diy_monthly
STRIPE_PRICE_PRO=price_test_pro_monthly
STRIPE_PRICE_ID_ENTERPRISE=price_test_enterprise_monthly
STRIPE_PRICE_ID_AGENCY=price_test_agency_monthly

# AI APIs
OPENAI_API_KEY=<your OpenAI key>
ANTHROPIC_API_KEY=<your Anthropic key>

# Email (use Mailtrap for testing)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=<your mailtrap username>
EMAIL_PASS=<your mailtrap password>
EMAIL_FROM=noreply@testing.visible2ai.com

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-testing-frontend.vercel.app
FRONTEND_URL=https://your-testing-frontend.vercel.app
```

**Security Note**: Use Stripe **TEST** keys (sk_test_...) - these won't charge real money!

---

### Step 4: Run Database Migrations

Once your testing backend is deployed:

1. In Render Dashboard → Your testing service → **Shell** tab
2. Run these commands:

```bash
# Navigate to backend
cd backend

# Run existing migrations (sets up base tables)
node db/setup.js

# Run NEW Enterprise/Agency migration
node db/migrate-enterprise-agency-tiers.js
```

You should see:
```
✅ Enterprise/Agency fields added successfully
✅ API keys table created
✅ Client accounts table created
🎉 Enterprise/Agency tier migration complete!
```

---

### Step 5: Deploy Testing Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **New Project** → Import your repository
3. **Important Settings**:
   - **Branch**: `claude/testing-pro-ent-agency-011CV1v7P45Ej8eJhV7XFpya`
   - **Root Directory**: `frontend`
   - **Framework Preset**: None (static HTML)

4. **Environment Variables**:
   ```bash
   VITE_API_URL=https://ai-visibility-testing.onrender.com
   ```

5. Deploy!

Your testing frontend URL will be: `https://your-project-xyz.vercel.app`

**Keep it unlisted**: Don't link from your main site or sitemap

---

## 🔧 Stripe Test Products Setup

### Create Test Products (No Real Charges!)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Make sure you're in **Test Mode** (toggle in top-right)

### Create Enterprise Product

1. Click **Add Product**
2. **Settings**:
   - **Name**: AI Visibility - Enterprise (TEST)
   - **Description**: 500 scans/month, 25 pages, API access
   - **Pricing**: Recurring, $299/month
   - **Billing Period**: Monthly
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_test_...`)
5. Update `STRIPE_PRICE_ID_ENTERPRISE` in Render environment variables

### Create Agency Product

1. Click **Add Product**
2. **Settings**:
   - **Name**: AI Visibility - Agency (TEST)
   - **Description**: Unlimited scans, white-label, multi-client
   - **Pricing**: Recurring, $599/month
   - **Billing Period**: Monthly
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_test_...`)
5. Update `STRIPE_PRICE_ID_AGENCY` in Render environment variables

### Configure Webhook

1. Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Settings**:
   - **Endpoint URL**: `https://ai-visibility-testing.onrender.com/api/subscription/webhook`
   - **Events**: Select these:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_test_...`)
6. Update `STRIPE_WEBHOOK_SECRET` in Render environment variables

---

## 🧪 Testing the Setup

### Test 1: Health Check

```bash
curl https://ai-visibility-testing.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Test 2: Create Test User

1. Go to your testing frontend
2. Sign up with a test email
3. Check Mailtrap inbox for verification email

### Test 3: Test Enterprise Subscription

1. Use Stripe test card: `4242 4242 4242 4242`
2. Expiry: Any future date
3. CVC: Any 3 digits
4. Subscribe to Enterprise plan
5. Verify in database:

```sql
SELECT subscription_plan, api_access_enabled, priority_support
FROM users
WHERE email = 'your-test@email.com';
```

Should show:
```
subscription_plan | api_access_enabled | priority_support
enterprise       | true               | true
```

### Test 4: Test Agency Features

1. Subscribe to Agency plan (test card again)
2. Check white-label features are enabled:

```sql
SELECT subscription_plan, white_label_enabled, has_account_manager
FROM users
WHERE email = 'your-agency-test@email.com';
```

---

## 📁 Files Modified in This Branch

### New Files Created
- ✅ `/backend/db/migrate-enterprise-agency-tiers.js` - Database migration
- ✅ `TESTING_ENVIRONMENT_SETUP.md` - This guide

### Modified Files
- ✅ `.env.example` - Added Enterprise/Agency Stripe price IDs
- ✅ `/backend/routes/subscription.js` - Added enterprise/agency to PRICE_IDS
- ✅ `/backend/routes/scan.js` - Added enterprise/agency to PLAN_LIMITS

### Database Changes (SAFE - Additive Only!)
- ✅ New columns in `users` table:
  - `api_access_enabled` (default: false)
  - `white_label_enabled` (default: false)
  - `client_accounts` (JSONB, default: [])
  - `branding_settings` (JSONB, default: {})
  - `priority_support` (default: false)
  - `has_account_manager` (default: false)
- ✅ New table: `api_keys`
- ✅ New table: `client_accounts`

**Impact on Production**: ✅ **ZERO** - All changes are additive, existing users unaffected

---

## 🔄 Development Workflow

### Making Changes

```bash
# You're already on the testing branch
git status
# Make changes to code...
git add .
git commit -m "feat: Add Agency white-label dashboard"
git push -u origin claude/testing-pro-ent-agency-011CV1v7P45Ej8eJhV7XFpya
```

Render and Vercel will auto-deploy on push!

### Testing Locally

```bash
# Create local .env with testing database
cp .env.example .env
# Edit .env with your local PostgreSQL and Stripe test keys

# Run backend
cd backend
npm install
npm run dev

# Open frontend in browser
cd ../frontend
python3 -m http.server 8000
# Visit http://localhost:8000
```

---

## 🚢 Deploying to Production (When Ready)

### Pre-Deployment Checklist

- [ ] All Enterprise features tested thoroughly
- [ ] All Agency features tested thoroughly
- [ ] Stripe webhooks working correctly
- [ ] API access tested and secured
- [ ] White-label features functional
- [ ] No breaking changes to existing DIY/Pro plans
- [ ] Database migrations reviewed (ADDITIVE only)

### Deployment Steps

```bash
# 1. Switch to main production branch
git checkout claude/revert-maxpages-to-15-011CV1v7P45Ej8eJhV7XFpya

# 2. Merge testing branch
git merge claude/testing-pro-ent-agency-011CV1v7P45Ej8eJhV7XFpya --no-ff

# 3. Push to production branch
git push -u origin claude/revert-maxpages-to-15-011CV1v7P45Ej8eJhV7XFpya
```

### Production Environment Setup

1. **Create LIVE Stripe Products** (not test mode!)
   - Enterprise: $299/month (LIVE price ID)
   - Agency: $599/month (LIVE price ID)

2. **Update Production Render Environment Variables**:
   ```bash
   STRIPE_PRICE_ID_ENTERPRISE=price_live_ent_xxx
   STRIPE_PRICE_ID_AGENCY=price_live_agency_xxx
   ```

3. **Run Migration on Production Database**:
   ```bash
   # In Render production service Shell
   cd backend
   node db/migrate-enterprise-agency-tiers.js
   ```

4. **Monitor Deployment**:
   - Check Render logs for errors
   - Test existing DIY/Pro users still work
   - Verify new Enterprise/Agency subscriptions work

---

## 🛡️ Safety Guarantees

### Current Users (DIY/Pro) Are Protected

✅ **Database**: All migrations are ADDITIVE (new columns only)
✅ **Stripe**: New products created, existing products unchanged
✅ **Code**: New plan logic added, old logic preserved
✅ **Quotas**: DIY (25 scans) and Pro (50 scans) limits unchanged

### What Could Break Things (DON'T DO!)

❌ **Renaming database columns**
❌ **Changing existing Stripe product IDs**
❌ **Modifying DIY/Pro quotas without migration**
❌ **Removing old plan code before verifying no users on it**

---

## 📞 Support & Questions

### Common Issues

**Q: Render backend won't start**
- Check environment variables are set correctly
- Verify DATABASE_URL is the Internal URL from Render PostgreSQL
- Check logs in Render dashboard

**Q: Stripe webhooks not working**
- Verify webhook endpoint URL is correct
- Check STRIPE_WEBHOOK_SECRET matches Stripe dashboard
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/subscription/webhook`

**Q: Database migration fails**
- Ensure you ran `node db/setup.js` first
- Check PostgreSQL connection string is correct
- Verify database exists and is accessible

**Q: Frontend can't connect to backend**
- Check CORS settings (ALLOWED_ORIGINS includes your Vercel URL)
- Verify API URL in frontend environment variables
- Check Render backend is running (visit /health endpoint)

---

## 🎓 Next Steps

1. **Build Enterprise Features**:
   - [ ] API key generation endpoint
   - [ ] API documentation
   - [ ] Priority support ticket system
   - [ ] Usage analytics dashboard

2. **Build Agency Features**:
   - [ ] White-label dashboard
   - [ ] Client account management UI
   - [ ] Multi-client scan allocation
   - [ ] Custom branding settings
   - [ ] Agency reporting tools

3. **Test Everything**:
   - [ ] End-to-end subscription flows
   - [ ] Webhook handling
   - [ ] Plan upgrades/downgrades
   - [ ] Cancellations and refunds

4. **Soft Launch**:
   - [ ] Beta test with 5-10 friendly customers
   - [ ] Gather feedback
   - [ ] Fix any issues
   - [ ] Monitor for 1 week

5. **Full Production Launch**:
   - [ ] Merge to production
   - [ ] Deploy
   - [ ] Announce to existing users
   - [ ] Update marketing site

---

## 📝 Plan Feature Matrix

### Enterprise Plan Features ($299/month)

**Included**:
- ✅ 500 scans per month
- ✅ 25 pages per scan
- ✅ 25 competitor scans
- ✅ API access (REST API + webhooks)
- ✅ Priority support (24-hour response)
- ✅ Advanced analytics
- ✅ Custom report exports (PDF, CSV)
- ✅ SSO integration (optional)

**Code Implementation Needed**:
- `/api/enterprise/api-keys` - Generate and manage API keys
- `/api/enterprise/analytics` - Advanced usage analytics
- `/api/enterprise/exports` - Export data in various formats

---

### Agency Plan Features ($599/month)

**Included**:
- ✅ Unlimited scans
- ✅ 50 pages per scan
- ✅ 50 competitor scans
- ✅ Everything in Enterprise, PLUS:
- ✅ White-label dashboard (custom branding)
- ✅ Multi-client account management
- ✅ Client scan allocation
- ✅ Dedicated account manager
- ✅ Custom domain (yourbrand.visible2ai.com)
- ✅ Agency-level reporting

**Code Implementation Needed**:
- `/api/agency/clients` - CRUD for client accounts
- `/api/agency/branding` - Manage white-label settings
- `/api/agency/allocate` - Allocate scans to clients
- `/api/agency/reports` - Agency-wide reporting

---

## 🎉 You're All Set!

Your testing environment is now configured and ready for Enterprise/Agency development.

**Testing Site**: `https://your-project-xyz.vercel.app` (unlisted)
**Testing API**: `https://ai-visibility-testing.onrender.com`
**Testing DB**: Separate from production
**Stripe Mode**: TEST (no real charges)

**Build fearlessly!** 🚀 Nothing you do here will affect production users.

---

*Last Updated: 2025-11-15*
