const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://your-production-domain.com';

// Plan configurations
const PLANS = {
    diy: {
        name: 'DIY Plan',
        price: 29,
        features: [
            'Analyze 5 pages from your website',
            'Full AI visibility score (X/1000)',
            'Complete 8-pillar breakdown',
            'Detailed recommendations for each page',
            'Unlimited monthly scans',
            'Progress tracking over time',
            'Email support'
        ]
    },
    premium: {
        name: 'Premium Plan',
        price: 99,
        features: [
            'Coming Soon',
            'Join the waitlist for early access',
            'Multi-domain support',
            'Advanced analytics',
            'Priority support',
            'Custom recommendations'
        ]
    },
    agency: {
        name: 'Agency Plan',
        price: 499,
        features: [
            'Coming Soon',
            'Join the waitlist for early access',
            'Unlimited domains',
            'White-label reports',
            'API access',
            'Dedicated account manager'
        ]
    }
};

// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
        alert('Please log in to continue');
        window.location.href = 'auth.html?redirect=checkout.html' + window.location.search;
        return;
    }
    
    // Load plan details
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan') || 'diy';
    
    loadPlanDetails(plan);
    
    // Handle form submission
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutSubmit);
});

// Check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // Check if email is verified
        if (!data.user.email_verified) {
            alert('Please verify your email before upgrading');
            window.location.href = 'verify.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Load plan details into the page
function loadPlanDetails(planKey) {
    const plan = PLANS[planKey];
    
    if (!plan) {
        showError('Invalid plan selected');
        return;
    }
    
    document.getElementById('planName').textContent = plan.name;
    document.getElementById('planPrice').textContent = plan.price;
    
    const featuresList = document.getElementById('planFeaturesList');
    featuresList.innerHTML = '';
    
    plan.features.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresList.appendChild(li);
    });
    
    // If premium or agency, disable form and show waitlist message
    if (planKey === 'premium' || planKey === 'agency') {
        document.getElementById('checkoutForm').innerHTML = `
            <div style="text-align: center; padding: 30px; background: #f8f9fa; border-radius: 15px;">
                <h3 style="margin-bottom: 15px;">Coming Soon!</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    This plan is currently in development. Join our waitlist to be notified when it launches.
                </p>
                <button type="button" onclick="window.location.href='dashboard.html'" class="checkout-btn">
                    Return to Dashboard
                </button>
            </div>
        `;
    }
}

// Handle checkout form submission
async function handleCheckoutSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('checkoutBtn');
    const originalText = btn.innerHTML;
    
    try {
        // Get and validate domain
        let domain = document.getElementById('domain').value.trim();
        
        if (!domain) {
            showError('Please enter a domain to analyze');
            return;
        }
        
        // Add protocol if missing
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = 'https://' + domain;
        }
        
        // Validate URL format
        try {
            new URL(domain);
        } catch (err) {
            showError('Please enter a valid domain (e.g., example.com or https://example.com)');
            return;
        }
        
        // Get plan from URL
        const urlParams = new URLSearchParams(window.location.search);
        const plan = urlParams.get('plan') || 'diy';
        
        // Disable button and show loading
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div>Creating checkout session...';
        
        // Create Stripe checkout session
        const response = await fetch(`${API_BASE_URL}/api/subscription/create-checkout-session`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domain: domain,
                plan: plan
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
        }
        
        // Redirect to Stripe checkout
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL received');
        }
        
    } catch (error) {
        console.error('Checkout error:', error);
        showError(error.message || 'Failed to process checkout. Please try again.');
        
        // Re-enable button
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
    
    // Scroll to error
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}