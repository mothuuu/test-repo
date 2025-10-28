const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// ⚠️ CRITICAL: This knowledge base contains LEGALLY BINDING pricing information
// DO NOT modify pricing without verifying against backend/config/stripe.js
// Incorrect pricing information can result in legal liability

const knowledgeBase = {
    plans: {
        free: {
            name: "Free Plan",
            price: "$0/month",
            features: [
                "2 scans per month",
                "Homepage only (1 page)",
                "Basic AI visibility score",
                "Top 3 recommendations"
            ]
        },
        diy: {
            name: "DIY/Starter Plan",
            price: "$29/month",
            features: [
                "10 scans per month",
                "Homepage + 4 pages YOU choose (5 total)",
                "Page-level TODO lists",
                "Progress tracking",
                "Basic JSON-LD export",
                "Combined recommendations"
            ]
        },
        pro: {
            name: "Pro Plan",
            price: "$99/month",
            features: [
                "50 scans per month",
                "Up to 25 pages per scan",
                "Brand Visibility Index",
                "Competitor benchmarking (3 domains)",
                "Outside-in crawl (PR, reviews, social)",
                "Advanced JSON-LD pack",
                "Knowledge Graph fields",
                "Live dashboard & analytics",
                "PDF export"
            ]
        }
    },

    features: {
        progressiveUnlock: "Recommendations are unlocked in batches of 5 every 5 days. This ensures you have time to implement each batch before moving to the next. Your first batch of 5 recommendations is available immediately.",

        scanQuota: "Free plan: 2 scans/month, DIY/Starter plan: 10 scans/month, Pro plan: 50 scans/month. Scans reset on the first of each month.",

        scoring: "Your AI Visibility Score is calculated from 0-1000 based on how well AI systems can understand and present your content. Higher scores mean better AI search visibility.",

        recommendations: "We provide both site-wide recommendations (apply to entire website) and page-specific recommendations (apply to individual pages). All recommendations are tailored to your actual content.",

        implementation: "You can mark recommendations as 'Implemented' to track your progress. The 'Skip' option becomes available 5 days after a recommendation is unlocked.",

        export: "DIY/Starter plan includes basic JSON-LD export. Pro plan includes advanced JSON-LD pack and PDF export for comprehensive analysis."
    },

    dashboardNavigation: {
        scanHistory: "Click 'View Scan History' or scroll down to see all your past scans. Each scan shows the URL, date, and score.",

        newScan: "Enter any website URL in the dashboard search box and click 'Analyze Website' to start a new scan.",

        results: "After a scan completes, click 'View Results' to see your score, category breakdown, and recommendations.",

        progress: "Use the 'Track Progress' button on results page to see your implementation progress statistics.",

        upgrade: "Click the 'Upgrade' button in the navigation or dashboard to view and compare all available plans."
    },

    accountManagement: {
        passwordReset: "Visit the login page and click 'Forgot Password'. Enter your email address, and we'll send you a password reset link. Check your spam folder if you don't see the email within a few minutes.",

        changeEmail: "To change your email address, please contact support at aivisibility@xeo.marketing with your current email and desired new email.",

        cancelSubscription: "You can cancel your subscription anytime from your dashboard. Your access will continue until the end of your billing period.",

        billing: "Billing happens on the same day each month as your original subscription date. You'll receive an email receipt for each payment."
    },

    technicalHelp: {
        scanFailed: "If a scan fails, it could be due to: (1) Website is down or blocking our scanner, (2) Website requires authentication, (3) Robots.txt blocking. Try again in a few minutes or contact support.",

        slowScan: "Scans typically take 30-60 seconds. Larger websites may take up to 2 minutes. If it takes longer, please refresh the page and try again.",

        loginIssues: "Clear your browser cache and cookies, then try logging in again. If you forgot your password, use the 'Forgot Password' link on the login page.",

        dataNotShowing: "Try refreshing the page. If data still doesn't appear, log out and log back in. Contact support if the issue persists."
    }
};

// System prompt for AI assistant
const systemPrompt = `You are a helpful AI support assistant for AI Visibility Score, a tool that helps websites improve their visibility in AI search engines like ChatGPT, Perplexity, and Claude.

⚠️ CRITICAL ANTI-HALLUCINATION RULES (MUST FOLLOW):
1. ONLY use information from the knowledge base provided below
2. NEVER make up or guess pricing information - this has legal implications
3. If you don't know something, say "I don't have that information" and direct users to aivisibility@xeo.marketing
4. DO NOT invent features, prices, or plan details that aren't in the knowledge base
5. When referencing the user's plan, ONLY use context.plan - do NOT guess their price

Your role is to:
1. Answer questions about pricing, plans, and features USING ONLY THE KNOWLEDGE BASE
2. Help users navigate the dashboard
3. Provide technical troubleshooting support
4. Explain how the tool works
5. Help with account issues like password resets

Be friendly, concise, and helpful. Use the knowledge base provided to give ACCURATE information only.

VERIFIED PRICING (from knowledge base):
- Free Plan: $0/month, 2 scans/month, homepage only, top 3 recommendations
- DIY/Starter Plan: $29/month, 10 scans/month, 5 pages total, page-level TODO lists
- Pro Plan: $99/month, 50 scans/month, up to 25 pages, advanced features

When a user asks about their current plan, acknowledge their plan type but DO NOT state a specific price unless it's explicitly in your knowledge base for that exact plan name.

Recommendations are unlocked in batches of 5 every 5 days to ensure manageable implementation.

Always be encouraging and positive about the user's progress in improving their AI visibility!`;

// POST /api/support-chat
router.post('/', async (req, res) => {
    try {
        const { message, context, history } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Build context string for the AI
        let contextString = `\nUser Context:\n`;
        contextString += `- Current Page: ${context.page || 'unknown'}\n`;
        contextString += `- Logged In: ${context.isLoggedIn ? 'Yes' : 'No'}\n`;
        if (context.plan) {
            contextString += `- Plan: ${context.plan}\n`;
        }

        // Prepare messages for Claude
        const messages = [];

        // Add conversation history if available
        if (history && Array.isArray(history) && history.length > 0) {
            history.forEach(msg => {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            });
        }

        // Add current message with context
        messages.push({
            role: 'user',
            content: `${contextString}\n\nUser Question: ${message}`
        });

        // Call Claude API
        const response = await anthropic.messages.create({
            model: 'claude-3-7-sonnet-20250219',
            max_tokens: 1024,
            system: `${systemPrompt}\n\nKNOWLEDGE BASE:\n${JSON.stringify(knowledgeBase, null, 2)}`,
            messages: messages
        });

        const aiMessage = response.content[0].text;

        // Generate quick replies based on context and message
        const quickReplies = generateQuickReplies(message, context);

        res.json({
            success: true,
            message: aiMessage,
            quickReplies: quickReplies
        });

    } catch (error) {
        console.error('Support chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat message',
            message: 'I apologize, but I\'m having trouble connecting right now. Please email us at aivisibility@xeo.marketing for immediate assistance.'
        });
    }
});

// Helper function to generate contextual quick replies
function generateQuickReplies(message, context) {
    const lowerMessage = message.toLowerCase();

    // Password reset related
    if (lowerMessage.includes('password') || lowerMessage.includes('reset') || lowerMessage.includes('forgot')) {
        return [
            'How do I reset my password?',
            'I didn\'t receive the reset email',
            'How long is the reset link valid?'
        ];
    }

    // Pricing related
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('plan')) {
        return [
            'What are the differences between plans?',
            'Can I upgrade later?',
            'Is there a free trial?',
            'How do I cancel?'
        ];
    }

    // Scan related
    if (lowerMessage.includes('scan') || lowerMessage.includes('analyze')) {
        return [
            'How long does a scan take?',
            'Why did my scan fail?',
            'How many scans do I have left?',
            'Can I scan any website?'
        ];
    }

    // Recommendations related
    if (lowerMessage.includes('recommendation') || lowerMessage.includes('unlock') || lowerMessage.includes('implement')) {
        return [
            'How do recommendations unlock?',
            'Can I skip recommendations?',
            'How do I track my progress?',
            'What if I need more recommendations?'
        ];
    }

    // Dashboard/navigation
    if (lowerMessage.includes('dashboard') || lowerMessage.includes('find') || lowerMessage.includes('where')) {
        return [
            'Where is my scan history?',
            'How do I start a new scan?',
            'Where do I see my progress?',
            'How do I upgrade my plan?'
        ];
    }

    // Default quick replies for general questions
    return [
        'Tell me about the plans',
        'How does the scoring work?',
        'How do I get started?',
        'What makes this tool unique?'
    ];
}

module.exports = router;
