# Stripe Setup Guide

This guide will walk you through setting up Stripe payments for the AI Visibility Score tool.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Access to your Render dashboard (for backend environment variables)
3. Access to your production site (https://www.visible2ai.com/)

## Step 1: Create Stripe Products & Prices

### 1.1 Log into Stripe Dashboard
- Go to https://dashboard.stripe.com/
- Make sure you're in **Test mode** first (toggle in top right)

### 1.2 Create DIY Plan Product

1. Navigate to **Products** → **Add product**
2. Fill in the details:
   - **Name**: `AI Visibility Score - DIY Plan`
   - **Description**: `25 scans per month, 5 pages per scan, page-level recommendations, 2 competitor scans`
   - **Pricing**:
     - Select **Recurring**
     - **Price**: `$29.00 USD`
     - **Billing period**: `Monthly`
   - Click **Add pricing** then **Save product**

3. **Copy the Price ID**:
   - After creating, you'll see something like `price_abc123xyz`
   - Copy this - you'll need it for `STRIPE_PRICE_DIY`

### 1.3 Create Pro Plan Product

1. Navigate to **Products** → **Add product**
2. Fill in the details:
   - **Name**: `AI Visibility Score - Pro Plan`
   - **Description**: `100 scans per month, 10 pages per scan, 10 competitor scans, advanced features`
   - **Pricing**:
     - Select **Recurring**
     - **Price**: `$99.00 USD`
     - **Billing period**: `Monthly`
   - Click **Add pricing** then **Save product**

3. **Copy the Price ID**:
   - Copy the price ID (something like `price_def456uvw`)
   - You'll need it for `STRIPE_PRICE_PRO`

## Step 2: Get Your API Keys

### 2.1 Get Secret Key

1. Navigate to **Developers** → **API keys**
2. Find the **Secret key** (starts with `sk_test_` in test mode)
3. Click **Reveal test key** and copy it
4. This is your `STRIPE_SECRET_KEY`

⚠️ **Security**: Never commit this key to GitHub or share it publicly

### 2.2 Get Publishable Key (optional, for frontend)

1. In the same API keys section
2. Copy the **Publishable key** (starts with `pk_test_` in test mode)
3. This is your `STRIPE_PUBLISHABLE_KEY` (not currently used but good to have)

## Step 3: Set Up Webhooks

Webhooks allow Stripe to notify your backend about payment events (successful payments, subscription cancellations, etc.)

### 3.1 Create Webhook Endpoint

1. Navigate to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://ai-visibility-tool.onrender.com/api/subscription/webhook`
4. **Description**: `AI Visibility Tool - Payment Events`
5. **Events to send**:
   - Select **checkout.session.completed**
   - Select **customer.subscription.created**
   - Select **customer.subscription.updated**
   - Select **customer.subscription.deleted**
   - Select **invoice.payment_succeeded**
   - Select **invoice.payment_failed**

6. Click **Add endpoint**

### 3.2 Get Webhook Signing Secret

1. After creating the endpoint, click on it
2. Find the **Signing secret** section
3. Click **Reveal** and copy the secret (starts with `whsec_`)
4. This is your `STRIPE_WEBHOOK_SECRET`

## Step 4: Configure Environment Variables on Render

### 4.1 Go to Render Backend Dashboard

1. Go to https://dashboard.render.com/
2. Select your backend service (`ai-visibility-tool`)
3. Navigate to the **Environment** tab

### 4.2 Add Stripe Environment Variables

Add the following environment variables:

| Key | Value | Example |
|-----|-------|---------|
| `STRIPE_SECRET_KEY` | Your secret key from Step 2.1 | `sk_test_51Ab...` |
| `STRIPE_PRICE_DIY` | DIY plan price ID from Step 1.2 | `price_abc123xyz` |
| `STRIPE_PRICE_PRO` | Pro plan price ID from Step 1.3 | `price_def456uvw` |
| `STRIPE_WEBHOOK_SECRET` | Webhook secret from Step 3.2 | `whsec_123...` |
| `FRONTEND_URL` | Your frontend URL | `https://www.visible2ai.com` |

### 4.3 Save and Redeploy

1. Click **Save Changes**
2. Render will automatically redeploy your backend (takes ~2-5 minutes)

## Step 5: Test Your Integration

### 5.1 Test Checkout Flow

1. Go to your site: https://www.visible2ai.com/
2. Sign in to your account
3. Click on **Upgrade** or go to checkout
4. Use Stripe's test card:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: Any future date (e.g., `12/34`)
   - **CVC**: Any 3 digits (e.g., `123`)
   - **ZIP**: Any 5 digits (e.g., `12345`)

5. Complete the checkout

### 5.2 Verify in Stripe Dashboard

1. Go to **Payments** in Stripe Dashboard
2. You should see your test payment
3. Go to **Customers** - you should see the customer created
4. Go to **Subscriptions** - you should see an active subscription

### 5.3 Check Webhook Events

1. Go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. You should see events like `checkout.session.completed`
4. Click on any event to see the details and response

### 5.4 Test in Your Application

1. After successful payment, you should be redirected to success page
2. Your user's plan should be upgraded in the database
3. Check your Render logs for successful webhook processing:
   ```
   ✅ Subscription created for user [userId]
   ✅ User upgraded to [plan] plan
   ```

## Step 6: Go Live (When Ready)

⚠️ **Important**: Only do this when you're ready to accept real payments!

### 6.1 Switch to Live Mode in Stripe

1. Toggle from **Test mode** to **Live mode** in Stripe Dashboard
2. Repeat Steps 1-3 above in **Live mode**:
   - Create live products/prices
   - Get live API keys (start with `sk_live_` and `pk_live_`)
   - Create live webhook endpoint
   - Get live webhook secret

### 6.2 Update Render Environment Variables

Replace the test keys with live keys in Render:
- Update `STRIPE_SECRET_KEY` with live secret key
- Update `STRIPE_PRICE_DIY` with live DIY price ID
- Update `STRIPE_PRICE_PRO` with live Pro price ID
- Update `STRIPE_WEBHOOK_SECRET` with live webhook secret

### 6.3 Activate Your Stripe Account

1. Complete Stripe's account verification
2. Add your bank account for payouts
3. Review and accept Stripe's terms

## Troubleshooting

### Issue: Webhook not receiving events

**Solution**:
1. Check that webhook URL is correct: `https://ai-visibility-tool.onrender.com/api/subscription/webhook`
2. Check Render logs for incoming webhook requests
3. Verify webhook secret matches in Render environment variables
4. Test webhook manually using Stripe CLI:
   ```bash
   stripe listen --forward-to https://ai-visibility-tool.onrender.com/api/subscription/webhook
   ```

### Issue: Checkout session not creating

**Solutions**:
1. Check Render logs for errors
2. Verify `STRIPE_SECRET_KEY` is set correctly
3. Verify `STRIPE_PRICE_DIY` and `STRIPE_PRICE_PRO` match your Stripe products
4. Check browser console for frontend errors

### Issue: Payment succeeds but user not upgraded

**Solutions**:
1. Check webhook is receiving events (Stripe Dashboard → Webhooks)
2. Check Render logs for webhook processing errors
3. Verify `STRIPE_WEBHOOK_SECRET` matches
4. Check database for user plan updates

### Issue: "No such price" error

**Solution**:
- The price ID is incorrect or doesn't exist
- Go to Stripe Dashboard → Products and copy the correct Price ID
- Make sure you're using test price IDs in test mode and live price IDs in live mode

## Testing Scenarios

### Test Cards

Stripe provides various test cards:

| Scenario | Card Number | Result |
|----------|-------------|---------|
| Success | `4242 4242 4242 4242` | Payment succeeds |
| Decline | `4000 0000 0000 0002` | Card declined |
| Insufficient funds | `4000 0000 0000 9995` | Insufficient funds |
| Expired card | `4000 0000 0000 0069` | Expired card |

Use expiry: `12/34`, CVC: `123`, ZIP: `12345` for all test cards.

## Security Best Practices

1. ✅ Never commit API keys to GitHub
2. ✅ Always use test mode for development
3. ✅ Use environment variables for all secrets
4. ✅ Verify webhook signatures (already implemented)
5. ✅ Use HTTPS for all webhook endpoints (Render provides this)
6. ✅ Log all payment events for audit trail

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Support**: https://support.stripe.com/
- **Test Your Integration**: https://stripe.com/docs/testing

## Summary Checklist

- [ ] Created DIY product and price in Stripe
- [ ] Created Pro product and price in Stripe
- [ ] Copied Price IDs for both plans
- [ ] Got Stripe Secret Key
- [ ] Created webhook endpoint in Stripe
- [ ] Got webhook signing secret
- [ ] Added all environment variables to Render
- [ ] Tested checkout with test card
- [ ] Verified payment in Stripe Dashboard
- [ ] Checked webhook events are being received
- [ ] Verified user plan upgrade in application

Once all items are checked, your Stripe integration is ready! 🎉
