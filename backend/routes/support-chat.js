const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Knowledge Base
const knowledgeBase = {
    plans: {
        free: {
            name: "Free Plan",
            price: "$0/month",
            features: [
                "1 scan per month",
                "Basic visibility score",
                "10 recommendations (unlocked progressively)",
                "Site-wide and page-specific analysis"
            ]
        },
        diy: {
            name: "DIY Plan",
            price: "$49/month",
            features: [
                "10 scans per month",
                "Full visibility score with category breakdown",
                "Unlimited recommendations (unlocked progressively)",
                "Site-wide and page-specific analysis",
                "Export results (PDF)",
                "Custom FAQ generation",
                "Schema markup code"
            ]
        },
        diyPlus: {
            name: "DIY+ Plan",
            price: "$149/month",
            features: [
                "Unlimited scans",
                "Full visibility score with category breakdown",
                "Unlimited recommendations (unlocked progressively)",
                "Site-wide and page-specific analysis",
                "Export results (PDF, CSV)",
                "Custom FAQ generation",
                "Schema markup code",
                "Priority support"
            ]
        }
    },

    features: {
        progressiveUnlock: "Recommendations are unlocked in batches of 5 every 5 days. This ensures you have time to implement each batch before moving to the next. Your first batch of 5 recommendations is available immediately.",

        scanQuota: "Free plan: 1 scan/month, DIY plan: 10 scans/month, DIY+ plan: unlimited scans. Scans reset on the first of each month.",

        scoring: "Your AI Visibility Score is calculated from 0-1000 based on how well AI systems can understand and present your content. Higher scores mean better AI search visibility.",

        recommendations: "We provide both site-wide recommendations (apply to entire website) and page-specific recommendations (apply to individual pages). All recommendations are tailored to your actual content.",

        implementation: "You can mark recommendations as 'Implemented' to track your progress. The 'Skip' option becomes available 5 days after a recommendation is unlocked.",

        export: "DIY and DIY+ plans can export scan results. PDF export is available for both, and DIY+ includes CSV export for deeper analysis."
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

Your role is to:
1. Answer questions about pricing, plans, and features
2. Help users navigate the dashboard
3. Provide technical troubleshooting support
4. Explain how the tool works
5. Help with account issues like password resets

Be friendly, concise, and helpful. Use the knowledge base provided to give accurate information. If you don't know something, direct users to email support@aivisibility.com.

Key product information:
- Free Plan: $0/month, 1 scan/month, 10 recommendations
- DIY Plan: $49/month, 10 scans/month, unlimited recommendations, PDF export, custom FAQs
- DIY+ Plan: $149/month, unlimited scans, all DIY features plus CSV export and priority support

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
            model: 'claude-3-5-sonnet-20241022',
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
            message: 'I apologize, but I\'m having trouble connecting right now. Please email us at support@aivisibility.com for immediate assistance.'
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
