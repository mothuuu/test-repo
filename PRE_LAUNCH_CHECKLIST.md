# Pre-Launch Technical Checklist

## 🚨 CRITICAL (Must Do Before Launch)

### Infrastructure
- [ ] **Upgrade Render Backend** to Starter ($7/month) - ✅ Done or in progress
- [ ] **Upgrade Render Database** to Starter ($7/month) - ⚠️ CRITICAL FOR BACKUPS
- [ ] **Set up database backups** - Verify daily backups are running
- [ ] **Test Stripe payments end-to-end** with test cards
- [ ] **Verify Stripe webhooks** are working (check dashboard)
- [ ] **Configure SendGrid email** and send test emails
- [ ] **Set all production environment variables** on Render

### Security
- [ ] **HTTPS enabled** on all domains (should be automatic with Vercel/Render)
- [ ] **CORS configured correctly** for production domain
- [ ] **JWT_SECRET set** to strong random string (not default)
- [ ] **API rate limiting enabled** (already in code, verify it works)
- [ ] **SQL injection protection** (using parameterized queries - ✅ already done)
- [ ] **XSS protection** (check helmet.js is enabled - ✅ already done)

### Monitoring & Alerts
- [ ] **Set up Render email alerts** for service crashes
- [ ] **Set up Stripe email notifications** for payments
- [ ] **Configure Anthropic billing alerts** ($100, $500, $1000)
- [ ] **Configure OpenAI billing alerts** (if used)
- [ ] **Set up uptime monitoring** (UptimeRobot.com free tier)

## ⚠️ IMPORTANT (Should Do Before Launch)

### Performance
- [ ] **Test site speed** on multiple devices (desktop, mobile, tablet)
- [ ] **Test scan completion times** (<30 seconds is good)
- [ ] **Verify no cold starts** after Render upgrade
- [ ] **Test concurrent scans** (5-10 simultaneous users)
- [ ] **Check database query performance** (scan logs for slow queries)

### User Experience
- [ ] **Test complete signup → scan → results flow**
- [ ] **Test password reset flow** end-to-end
- [ ] **Test upgrade flow** (free → DIY → Pro)
- [ ] **Test on iPhone** (Safari)
- [ ] **Test on Android** (Chrome)
- [ ] **Test on Chromebook**
- [ ] **Verify all emails are branded** and mobile-friendly
- [ ] **Check all links work** in emails

### Payment Testing
- [ ] **Test DIY checkout** ($29/month) with test card
- [ ] **Test Pro checkout** ($99/month) with test card
- [ ] **Test subscription cancellation**
- [ ] **Verify webhook handles** `checkout.session.completed`
- [ ] **Verify webhook handles** `customer.subscription.deleted`
- [ ] **Test failed payment** scenario
- [ ] **Verify user plan upgrades** in database after payment

### Content & Copy
- [ ] **Update all "Coming Soon" text** for live plans
- [ ] **Verify pricing is correct** everywhere ($29 DIY, $99 Pro)
- [ ] **Check Terms of Service** link works
- [ ] **Check Privacy Policy** link works
- [ ] **Update support email** to correct address
- [ ] **Test support chat widget** if enabled

## 📊 MONITORING (Set Up First Week)

### Daily Checks (First 7 Days)
- [ ] Check Render logs for errors
- [ ] Monitor database size/growth
- [ ] Check Stripe dashboard for payments
- [ ] Review API costs (Anthropic/OpenAI)
- [ ] Monitor email deliverability (SendGrid dashboard)
- [ ] Check for user complaints/support emails

### Weekly Checks (First Month)
- [ ] Review Render metrics (CPU, RAM, response times)
- [ ] Check database backup status
- [ ] Review API rate limit usage
- [ ] Monitor customer churn rate
- [ ] Check payment failure rate
- [ ] Review scan completion times

## 💰 COST TRACKING

### Fixed Monthly Costs (Minimum)
```
Render Account (Professional):        $19/month
Render Backend (Starter):              $7/month
Render Database (Starter):             $7/month
Render Build Pipeline (Starter):       $5/month
SendGrid (Free tier):                  $0/month
Vercel (Free tier):                    $0/month
────────────────────────────────────────────────
Total Fixed:                          $38/month

Break-even: 2 DIY customers ($58) or 1 Pro customer ($99)
```

### Variable Costs (API Usage)
```
Anthropic Claude API:         ~$0.50-2.00 per scan
OpenAI (if used):             ~$0.10-0.50 per scan
Estimated per customer:       ~$2-5/month

Budget at 50 customers:       ~$100-250/month in API costs
```

### Revenue Projections
```
10 DIY customers:            $290/month - $38 fixed - $50 API = $202 profit ✅
20 DIY customers:            $580/month - $38 fixed - $100 API = $442 profit ✅
50 DIY customers:          $1,450/month - $38 fixed - $250 API = $1,162 profit ✅

5 Pro customers:             $495/month - $38 fixed - $50 API = $407 profit ✅
10 Pro customers:            $990/month - $38 fixed - $100 API = $852 profit ✅
```

## 🚀 UPGRADE TRIGGERS

### When to Upgrade Render Backend to Standard ($25/month)
- 50+ paying customers
- $1,000+/month revenue
- RAM usage consistently >450 MB
- Response times >5 seconds
- Customer complaints about speed

### When to Upgrade Database to Standard ($25/month)
- 500+ users
- 25,000+ scans stored
- 5+ GB data
- Need high availability
- Compliance requirements

### When to Upgrade Vercel to Pro ($20/month)
- 1,000+ daily visitors
- Bandwidth approaching 100 GB/month
- Need analytics/insights
- Need better performance

### When to Upgrade Anthropic/OpenAI Tier
- Monthly API costs >$500
- Hitting rate limits frequently
- Need higher throughput
- Need priority support

## 🛡️ DISASTER RECOVERY

### Database Backup Strategy
- [ ] **Daily automated backups** enabled on Render
- [ ] **Manual backup before** any major changes
- [ ] **Test restore process** quarterly
- [ ] **Document recovery procedures**

### If Database is Lost
1. Render Starter: Restore from automated backup (7-day retention)
2. Export customer list from Stripe as backup
3. Customer data may be lost if on Free tier (NO BACKUPS!)

### If Backend Crashes
1. Check Render logs for errors
2. Rollback to previous deployment if needed
3. Render automatically restarts failed services
4. SSH into service if needed (paid tier only)

### If Payment Processing Fails
1. Check Stripe webhook logs
2. Manually process missed subscriptions
3. Contact Stripe support
4. Keep customers informed

## 📈 SUCCESS METRICS TO TRACK

### Product Metrics
- Sign-up conversion rate (visitors → sign-ups)
- Free → Paid conversion rate
- Scan completion rate
- Average scans per user
- Customer retention rate (monthly)
- Churn rate

### Technical Metrics
- Average scan time
- API error rate
- Database query time
- Uptime percentage
- Email deliverability rate
- Payment success rate

### Financial Metrics
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- LTV:CAC ratio (should be >3:1)
- Profit margin after costs
- Revenue per customer

## 🎯 LAUNCH DAY CHECKLIST

Day before launch:
- [ ] Run through complete user journey 3 times
- [ ] Verify all environment variables are correct
- [ ] Check all services are running (Render, Vercel, SendGrid, Stripe)
- [ ] Send test emails to yourself
- [ ] Make test payment and verify it works
- [ ] Clear any test data from production database
- [ ] Backup database manually
- [ ] Announce maintenance window if needed

Launch day:
- [ ] Monitor Render logs continuously first 2 hours
- [ ] Watch Stripe dashboard for payments
- [ ] Check email inbox for user issues
- [ ] Monitor server metrics (CPU, RAM, response time)
- [ ] Test signup flow every hour
- [ ] Be ready to rollback if critical issues

First 24 hours:
- [ ] Monitor continuously for errors
- [ ] Respond to all support emails within 2 hours
- [ ] Check payment processing is working
- [ ] Verify emails are sending
- [ ] Monitor API costs
- [ ] Check database growth

## 🆘 EMERGENCY CONTACTS

- **Render Support**: support@render.com (chat available on paid plans)
- **Stripe Support**: https://support.stripe.com/
- **SendGrid Support**: https://support.sendgrid.com/
- **Anthropic Support**: support@anthropic.com
- **Vercel Support**: https://vercel.com/support

## 📚 DOCUMENTATION TO PREPARE

- [ ] Create internal runbook for common issues
- [ ] Document how to manually upgrade user
- [ ] Document how to manually refund customer
- [ ] Document how to reset user quota
- [ ] Document how to check user scan history
- [ ] Create customer onboarding guide
- [ ] Create FAQ document
- [ ] Prepare cancellation process

---

## ⏰ RECOMMENDED TIMELINE

### 1 Week Before Launch
- Upgrade infrastructure (Render backend & database)
- Set up monitoring and alerts
- Complete all security checks
- Test payment flows thoroughly

### 3 Days Before Launch
- Final end-to-end testing
- Test on all devices
- Verify email flows
- Check all documentation

### 1 Day Before Launch
- Manual database backup
- Final smoke tests
- Announce to team/early users
- Prepare support channels

### Launch Day
- Monitor closely
- Respond quickly to issues
- Collect feedback
- Celebrate! 🎉

### Week After Launch
- Daily monitoring
- Quick fixes for issues
- Gather user feedback
- Optimize based on real usage

---

**Remember**: It's better to launch with a few missing features than to launch with critical technical debt. Focus on stability and reliability first!
