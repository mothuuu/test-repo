# AI Support Chat Configuration

## ⚠️ CRITICAL: Pricing Information Maintenance

The AI support chat provides pricing information to users. **Incorrect pricing can result in legal liability.**

### Source of Truth

**Always verify pricing against:**
- `/backend/config/stripe.js` - The definitive source for all pricing

### Current Pricing (as of last update)

- **Free Plan**: $0/month
  - 2 scans per month
  - Homepage only (1 page)
  - Basic AI visibility score
  - Top 3 recommendations

- **DIY/Starter Plan**: $29/month
  - 10 scans per month
  - Homepage + 4 pages YOU choose (5 total)
  - Page-level TODO lists
  - Progress tracking
  - Basic JSON-LD export
  - Combined recommendations

- **Pro Plan**: $99/month
  - 50 scans per month
  - Up to 25 pages per scan
  - Brand Visibility Index
  - Competitor benchmarking (3 domains)
  - Outside-in crawl (PR, reviews, social)
  - Advanced JSON-LD pack
  - Knowledge Graph fields
  - Live dashboard & analytics
  - PDF export

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

After updating pricing:
1. Test the AI chat on dashboard
2. Ask: "What are the plans?"
3. Ask: "Tell me about my current plan" (test with different plan types)
4. Verify prices match `/backend/config/stripe.js` exactly

### Support Contact

Current support email: `aivisibility@xeo.marketing`

To change this, update:
- `/backend/routes/support-chat.js` - knowledge base
- `/frontend/support-chat.js` - disclaimer link
