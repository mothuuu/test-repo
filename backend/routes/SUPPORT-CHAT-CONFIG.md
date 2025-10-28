# AI Support Chat Configuration

## ⚠️ CRITICAL: Pricing Information Maintenance

The AI support chat provides pricing information to users. **Incorrect pricing can result in legal liability.**

### Source of Truth

**Always verify pricing against:**
- `/backend/config/stripe.js` - The definitive source for all pricing

### Current Pricing (Verified with Product Team)

- **Free Plan**: $0/month ✅ ACTIVE
  - 2 scans per month (resets on 1st)
  - Homepage only (1 page)
  - AI Visibility Score (0-1000 points)
  - 8-category breakdown
  - Top 5 priority recommendations
  - Email verification required

- **DIY Plan**: $29/month ✅ ACTIVE
  - 25 scans per month (resets on 1st, NO ROLLOVER)
  - 5 pages per domain (homepage + 4 you choose)
  - Up to 15 detailed recommendations
  - Page-level action items
  - Copy-paste ready code snippets
  - Industry-specific FAQ schema (JSON-LD)
  - Track 2 competitors (score-only view)
  - Progress tracking & historical comparison
  - Cancel anytime

- **Premium Plan**: $99/month ⏳ WAITLIST ONLY (launches Q1 2026)
  - 50 scans per month
  - 25 pages per domain (homepage + 24)
  - Website Visibility Index + Brand Visibility Index (dual indexes)
  - Up to 25 detailed recommendations
  - Track 3 competitors (full analysis + gap analysis)
  - Outside-in crawl (PR mentions, reviews, social)
  - PDF export
  - Priority support

- **Agency Plan**: $499/month ⏳ WAITLIST ONLY (launches mid 2026)
  - All Premium features × 10 domains
  - Unified agency dashboard
  - Team member access controls
  - Branded PDF reports
  - Custom domain mapping
  - 3 competitors per domain
  - Role-based permissions

### Key Facts to Remember

- **Scans**: Reset on the 1st of each month, NO ROLLOVER
- **Pages**: All pages must be from the SAME domain
- **Homepage**: Always locked and required for paid plans
- **Competitor Tracking**:
  - Free: None
  - DIY: 2 competitors (score-only view)
  - Premium: 3 competitors (full analysis with gap analysis)
  - Agency: 3 competitors per domain
- **PDF Export**: Only Premium & Agency
- **Dual Indexes**: Only Premium & Agency (Website + Brand Visibility Index)
- **Waitlist Status**: Premium and Agency are NOT purchasable yet

### How to Update Pricing

When you change pricing, you MUST update TWO files:

1. **Backend Configuration** (Source of Truth)
   - File: `/backend/config/stripe.js`
   - Update the `PLANS` object

2. **AI Support Chat Knowledge Base**
   - File: `/backend/routes/support-chat.js`
   - Update the `knowledgeBase.plans` object
   - Update the system prompt pricing summary

### Anti-Hallucination Safeguards

The system prompt includes critical rules to prevent the AI from:
- Making up pricing information
- Inventing features not in the knowledge base
- Guessing plan details

**DO NOT remove or weaken these safeguards.**

### Legal Disclaimer

A legal disclaimer is shown at the top of the chat widget:
- Location: `/frontend/support-chat.js` (HTML) and `/frontend/support-chat.css` (styling)
- Purpose: Inform users the AI may make errors
- Directs users to human support for critical information

### Testing After Pricing Changes

After updating pricing, test these questions in the AI chat:

**Basic Pricing Tests:**
1. "What are the plans?" - Should show $0, $29, $99, $499 with correct details
2. "Tell me about my current plan" - Test with Free, DIY, Premium (if available)
3. "What's included in the DIY plan?" - Should list 25 scans, 5 pages, 15 recommendations
4. "What's the difference between DIY and Premium?" - Should mention waitlist status

**Competitor Tracking Tests:**
5. "Can I track competitors?" - Should explain DIY = 2 (score-only), Premium = 3 (full)
6. "What competitor analysis is included in DIY?" - Should clarify score-only view
7. "How many competitors can I track?" - Should vary by plan

**Edge Cases:**
8. "Why can't I scan another page?" - Should explain plan limits and upgrade path
9. "When do my scans reset?" - Should say 1st of month, no rollover
10. "Can I see my competitor's recommendations?" - Should say No for DIY, Yes for Premium

**Waitlist Tests:**
11. "Can I buy Premium?" - Should say WAITLIST ONLY, not purchasable yet
12. "When will Premium launch?" - Should say Q1 2026

Verify all prices match `/backend/config/stripe.js` and product team specifications exactly.

### Support Contact

Current support email: `aivisibility@xeo.marketing`

To change this, update:
- `/backend/routes/support-chat.js` - knowledge base
- `/frontend/support-chat.js` - disclaimer link
