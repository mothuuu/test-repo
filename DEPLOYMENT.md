# Deployment Guide

## Required Environment Variables for Render Backend

To ensure your backend works correctly with the frontend deployed at `https://aome.xeo.marketing/`, you need to configure the following environment variables in your Render dashboard.

### Setting Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your backend service (`ai-visibility-tool`)
3. Navigate to **Environment** tab
4. Add/Update the following variables:

### Required Variables

#### ALLOWED_ORIGINS
**Description**: Comma-separated list of allowed frontend origins for CORS
**Value**:
```
https://aome.xeo.marketing,http://localhost:3000,http://localhost:8000
```

This allows the backend to accept requests from:
- Production frontend: `https://aome.xeo.marketing`
- Local development: `http://localhost:3000` and `http://localhost:8000`

#### Other Important Variables

Make sure these are also configured (if not already):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `ANTHROPIC_API_KEY` - API key for Anthropic Claude
- `OPENAI_API_KEY` - API key for OpenAI (if used)
- `EMAIL_USER` - Email service username
- `EMAIL_PASS` - Email service password
- `NODE_ENV` - Set to `production`
- `FRONTEND_URL` - Frontend URL (e.g., `https://aome.xeo.marketing`)

#### Stripe Payment Variables (Required for Payments)

For detailed Stripe setup instructions, see **[STRIPE_SETUP.md](./STRIPE_SETUP.md)**

- `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_test_` or `sk_live_`)
- `STRIPE_PRICE_DIY` - Stripe Price ID for DIY plan (e.g., `price_abc123`)
- `STRIPE_PRICE_PRO` - Stripe Price ID for Pro plan (e.g., `price_def456`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (starts with `whsec_`)

**Note**: Follow the step-by-step guide in STRIPE_SETUP.md to create products, get price IDs, and configure webhooks.

### After Setting Variables

1. **Save** the environment variables
2. Render will automatically **redeploy** your service
3. Wait for the deployment to complete (usually 2-5 minutes)
4. Test the site on mobile devices to confirm the fix

## Vercel Frontend Deployment

The frontend is deployed on Vercel and should automatically deploy when you push to GitHub. No additional configuration needed for the frontend as it already detects the environment and uses the correct API URL.

## Troubleshooting

### CORS errors still appearing?
1. Check that `ALLOWED_ORIGINS` is correctly set on Render
2. Make sure the backend has redeployed after setting the variable
3. Clear browser cache on mobile devices
4. Check browser console for specific error messages

### Backend not responding?
1. Check Render logs for errors
2. Verify the backend service is running
3. Test the health check endpoint: `https://ai-visibility-tool.onrender.com/health`

## Testing the Fix

After deployment, test on:
- ✅ Desktop browsers (Chrome, Firefox, Safari)
- ✅ iPhone Safari
- ✅ Chromebook Chrome
- ✅ Android Chrome

All should work once CORS is properly configured.
