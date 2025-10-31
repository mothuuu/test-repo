const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

/**
 * Convert backend score (0-100) to display score (0-1000)
 */
function getDisplayScore(backendScore) {
  return Math.round(backendScore * 10);
}

// Global state
let user = null;
let quota = { used: 0, limit: 2 };

// Initialize dashboard
async function initDashboard() {
    showLoading();
    
    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'auth.html';
        return;
    }

    try {
        // Fetch user data
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Not authenticated');
        }

        const data = await response.json();
        user = data.user;

        // Check email verification
        if (!user.email_verified) {
            window.location.href = 'verify.html';
            return;
        }

        // Store user
        localStorage.setItem('user', JSON.stringify(user));

        // Update UI
        updateUserInfo();
        updateQuota();
        await loadRecentScans();

        // Check if user came with a scan URL
        const urlParams = new URLSearchParams(window.location.search);
        const scanUrl = urlParams.get('scanUrl');
        if (scanUrl) {
            document.getElementById('scanUrl').value = decodeURIComponent(scanUrl);
        }

        hideLoading();

    } catch (error) {
        console.error('Dashboard init error:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'auth.html';
    }
}

// Update user info in header
function updateUserInfo() {
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userName').textContent = user.name || user.email.split('@')[0];

    // Update welcome title
    document.getElementById('welcomeTitle').textContent = `Welcome back, ${user.name || user.email.split('@')[0]}!`;

    // Update plan type
    const planType = document.getElementById('planType');
    const planNames = {
        free: 'Free Plan',
        diy: 'DIY Plan',
        pro: 'Pro Plan'
    };
    planType.textContent = planNames[user.plan] || 'Free Plan';

    // Update plan info text
    const planInfo = {
        free: '✓ Free plan: Homepage scan only',
        diy: '✓ DIY plan: Choose 5 pages per scan',
        pro: '✓ Pro plan: Analyze up to 25 pages'
    };
    document.getElementById('planInfo').textContent = planInfo[user.plan];

    // Show manage subscription button for paid users
    if (user.plan === 'diy' || user.plan === 'pro') {
        document.getElementById('manageSubscriptionBtn').style.display = 'inline-block';
    }
}

// Update quota display
function updateQuota() {
    const planLimits = {
        free: { primary: 2, competitor: 0 },
        diy: { primary: 25, competitor: 2 },
        pro: { primary: 50, competitor: 10 }
    };

    const limits = planLimits[user.plan] || planLimits.free;

    // Primary scan quota
    quota = {
        used: user.scans_used_this_month || 0,
        limit: limits.primary
    };

    // Update primary scans quota display
    const primaryScansQuota = document.getElementById('primaryScansQuota');
    primaryScansQuota.textContent = `${quota.used} / ${quota.limit}`;

    // Competitor scan quota
    const competitorScansQuota = document.getElementById('competitorScansQuota');
    const competitorUsed = user.competitor_scans_used_this_month || 0;
    competitorScansQuota.textContent = `${competitorUsed} / ${limits.competitor}`;

    // Primary domain badge
    const primaryDomainBadge = document.getElementById('primaryDomainBadge');
    if (user.primary_domain) {
        primaryDomainBadge.textContent = user.primary_domain;
        primaryDomainBadge.title = `Primary domain: ${user.primary_domain}\nClick to change (once per month)`;
    } else {
        primaryDomainBadge.textContent = '🏠 Not set';
        primaryDomainBadge.title = 'Primary domain will be set on first scan';
    }
}

// Load recent scans
async function loadRecentScans() {
    const primaryScansList = document.getElementById('primaryScansList');
    const competitorScansList = document.getElementById('competitorScansList');
    const authToken = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/scan/list/recent`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load scans');
        }

        const data = await response.json();
        const scans = data.scans || [];

        // Separate primary and competitor scans
        const primaryScans = scans.filter(scan => scan.domain_type === 'primary');
        const competitorScans = scans.filter(scan => scan.domain_type === 'competitor');

        // Display primary scans
        if (primaryScans.length === 0) {
            primaryScansList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-text">No primary scans yet. Start your first scan above!</div>
                </div>
            `;
        } else {
            primaryScansList.innerHTML = primaryScans.map(scan => {
                const date = new Date(scan.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                const displayScore = getDisplayScore(scan.total_score || 0);

                return `
                    <div class="scan-item" onclick="window.location.href='results.html?scanId=${scan.id}'">
                        <div class="scan-info">
                            <div class="scan-url">${scan.url}</div>
                            <div class="scan-date">Scanned on ${date}</div>
                        </div>
                        <div>
                            <div class="scan-score">${displayScore}</div>
                            <div class="score-label">/ 1000</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Display competitor scans
        if (competitorScans.length === 0) {
            competitorScansList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-text">No competitor scans yet</div>
                </div>
            `;
        } else {
            competitorScansList.innerHTML = competitorScans.map(scan => {
                const date = new Date(scan.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                const displayScore = getDisplayScore(scan.total_score || 0);

                return `
                    <div class="scan-item" onclick="window.location.href='results.html?scanId=${scan.id}'">
                        <div class="scan-info">
                            <div class="scan-url">${scan.url}</div>
                            <div class="scan-date">Scanned on ${date}</div>
                        </div>
                        <div>
                            <div class="scan-score">${displayScore}</div>
                            <div class="score-label">/ 1000</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

    } catch (error) {
        console.error('Error loading scans:', error);
        primaryScansList.innerHTML = `
            <div class="empty-state">
                <div class="empty-text" style="color: #dc3545;">Failed to load scans</div>
            </div>
        `;
        competitorScansList.innerHTML = `
            <div class="empty-state">
                <div class="empty-text" style="color: #dc3545;">Failed to load scans</div>
            </div>
        `;
    }
}

// Handle scan form submission
// Helper function to extract root domain
function extractRootDomain(urlString) {
    try {
        const parsedUrl = new URL(urlString);
        let hostname = parsedUrl.hostname.toLowerCase();

        // Remove www prefix
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }

        // Get root domain (last 2 parts)
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return hostname;
    } catch (error) {
        return null;
    }
}

document.getElementById('scanForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const url = document.getElementById('scanUrl').value.trim();
    const scanBtn = document.getElementById('scanBtn');
    const authToken = localStorage.getItem('authToken');

    // Extract domain from URL
    const scanDomain = extractRootDomain(url);

    // Check if this is a competitor scan
    let isCompetitorScan = false;
    if (user.primary_domain && scanDomain !== user.primary_domain) {
        isCompetitorScan = true;

        const planLimits = {
            free: { competitor: 0 },
            diy: { competitor: 2 },
            pro: { competitor: 10 }
        };

        const competitorLimit = planLimits[user.plan]?.competitor || 0;
        const competitorUsed = user.competitor_scans_used_this_month || 0;

        // Check competitor quota
        if (competitorLimit === 0) {
            const content = `
                <div style="text-align: left; background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="margin-bottom: 12px; color: #333; font-size: 1rem; line-height: 1.6;">
                        <strong style="color: #00B9DA;">Scanning:</strong> ${scanDomain}
                    </p>
                    <p style="margin-bottom: 0; color: #333; font-size: 1rem; line-height: 1.6;">
                        <strong style="color: #7030A0;">Your Primary:</strong> ${user.primary_domain}
                    </p>
                </div>
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #856404; font-weight: 600;">
                        ❌ Free plan doesn't include competitor scans
                    </p>
                </div>
                <div style="text-align: left; color: #4a5568; font-size: 0.95rem; line-height: 1.6;">
                    <p style="margin-bottom: 15px;"><strong>Upgrade Options:</strong></p>
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 10px;">
                        <p style="margin: 0;"><strong style="color: #00B9DA;">DIY Plan - $29/month</strong></p>
                        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">✓ 2 competitor scans per month</p>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #e5e7eb;">
                        <p style="margin: 0;"><strong style="color: #7030A0;">Pro Plan - $99/month</strong></p>
                        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">✓ 10 competitor scans per month</p>
                    </div>
                </div>
            `;

            const proceed = await showCompetitorModal(
                'Competitor Scan Detected',
                content,
                'View Upgrade Options',
                'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
            );

            if (proceed) {
                window.location.href = 'checkout.html?plan=diy';
            }
            return;
        }

        if (competitorUsed >= competitorLimit) {
            const isDiy = user.plan === 'diy';
            const content = `
                <div style="text-align: center; background: #fee2e2; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b; font-size: 1.1rem; font-weight: 600;">
                        📊 Quota Exceeded
                    </p>
                    <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 1rem;">
                        You've used all <strong>${competitorLimit}</strong> competitor scans this month
                    </p>
                    <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 0.95rem;">
                        (${competitorUsed}/${competitorLimit} used)
                    </p>
                </div>
                ${isDiy ? `
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 20px; border-radius: 12px; text-align: left;">
                        <p style="margin: 0 0 15px 0; color: #0c4a6e; font-weight: 600; font-size: 1.05rem;">
                            🚀 Upgrade to Pro Plan
                        </p>
                        <div style="color: #075985; font-size: 0.95rem; line-height: 1.6;">
                            <p style="margin: 0 0 10px 0;">✓ 10 competitor scans per month</p>
                            <p style="margin: 0 0 10px 0;">✓ 100 primary scans per month</p>
                            <p style="margin: 0 0 10px 0;">✓ 10 pages per scan</p>
                            <p style="margin: 0; font-weight: 600; color: #0c4a6e;">Only $99/month</p>
                        </div>
                    </div>
                ` : `
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center;">
                        <p style="margin: 0; color: #4a5568; font-size: 1rem;">
                            Your quota will reset next month
                        </p>
                    </div>
                `}
            `;

            const proceed = await showCompetitorModal(
                'Competitor Scan Quota Exceeded',
                content,
                isDiy ? 'Upgrade to Pro' : 'OK',
                isDiy ? 'linear-gradient(135deg, #7030A0 0%, #00B9DA 100%)' : '#6b7280'
            );

            if (proceed && isDiy) {
                window.location.href = 'checkout.html?plan=pro';
            }
            return;
        }

        // Warn user about competitor scan limitations
        const content = `
            <div style="text-align: left; background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="margin-bottom: 12px; color: #333; font-size: 1rem; line-height: 1.6;">
                    <strong style="color: #00B9DA;">Scanning:</strong> ${scanDomain} <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">COMPETITOR</span>
                </p>
                <p style="margin-bottom: 0; color: #333; font-size: 1rem; line-height: 1.6;">
                    <strong style="color: #7030A0;">Your Primary:</strong> ${user.primary_domain}
                </p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #e5e7eb; margin-bottom: 15px;">
                <p style="margin: 0 0 15px 0; font-weight: 600; color: #1a202c; font-size: 1.05rem;">
                    What You'll Get:
                </p>
                <div style="color: #4a5568; font-size: 0.95rem; line-height: 1.8;">
                    <p style="margin: 0 0 8px 0;">✅ AI Visibility Scores</p>
                    <p style="margin: 0 0 8px 0;">✅ Category breakdown</p>
                    <p style="margin: 0 0 8px 0; color: #dc2626; font-weight: 600;">❌ NO recommendations</p>
                    <p style="margin: 0; color: #dc2626; font-weight: 600;">❌ NO implementation guidance</p>
                </div>
            </div>

            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px;">
                <p style="margin: 0; color: #1e40af; font-weight: 600;">
                    📊 Quota: ${competitorUsed + 1} / ${competitorLimit} competitor scans will be used
                </p>
            </div>
        `;

        const proceed = await showCompetitorModal(
            'Competitor Scan',
            content,
            'Continue Scan',
            'linear-gradient(135deg, #00B9DA 0%, #7030A0 100%)'
        );

        if (!proceed) {
            return;
        }
    }

    // Check primary scan quota (only for primary domain scans)
    if (!isCompetitorScan && quota.used >= quota.limit) {
        const content = `
            <div style="text-align: center; background: #fee2e2; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #991b1b; font-size: 1.1rem; font-weight: 600;">
                    📊 Scan Limit Reached
                </p>
                <p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 1rem;">
                    You've used all <strong>${quota.limit}</strong> scans this month
                </p>
            </div>
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 25px; border-radius: 12px; text-align: left;">
                <p style="margin: 0 0 15px 0; color: #0c4a6e; font-weight: 600; font-size: 1.1rem;">
                    🚀 Upgrade to Continue Scanning
                </p>
                <div style="color: #075985; font-size: 0.95rem; line-height: 1.7;">
                    <p style="margin: 0 0 10px 0;">✓ <strong>25 scans per month</strong></p>
                    <p style="margin: 0 0 10px 0;">✓ <strong>5 pages per scan</strong></p>
                    <p style="margin: 0 0 10px 0;">✓ Page-level recommendations</p>
                    <p style="margin: 0 0 10px 0;">✓ 2 competitor scans</p>
                    <p style="margin: 15px 0 0 0; font-weight: 700; color: #0c4a6e; font-size: 1.1rem;">
                        Only $29/month
                    </p>
                </div>
            </div>
        `;

        await showCompetitorModal(
            'Upgrade Required',
            content,
            'Upgrade Now',
            'linear-gradient(135deg, #00B9DA 0%, #7030A0 100%)'
        );

        window.location.href = 'checkout.html?plan=diy';
        return;
    }

    // Disable button
    scanBtn.disabled = true;
    scanBtn.textContent = isCompetitorScan ? 'Scanning competitor...' : 'Starting scan...';
    
    try {
        // For free users - scan homepage immediately
        if (user.plan === 'free') {
            const response = await fetch(`${API_BASE_URL}/scan/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    scanType: 'homepage'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Scan failed');
            }
            
            const data = await response.json();
            console.log('Scan response:', data);
            
            // Redirect to results - FIXED for correct API response structure
            if (data.scan && data.scan.id) {
                window.location.href = `results.html?scanId=${data.scan.id}`;
            } else if (data.scanId) {
                window.location.href = `results.html?scanId=${data.scanId}`;
            } else {
                console.error('No scan ID in response:', data);
                throw new Error('No scan ID received');
            }
            return;
        }
        
        // For DIY/Pro users - go to page selector
        window.location.href = `page-selector.html?domain=${encodeURIComponent(url)}`;
        
    } catch (error) {
        console.error('Scan error:', error);

        const content = `
            <div style="text-align: center; background: #fee2e2; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #991b1b; font-size: 1.1rem; font-weight: 600;">
                    ❌ Scan Failed
                </p>
                <p style="margin: 15px 0 0 0; color: #7f1d1d; font-size: 0.95rem; font-family: monospace; background: white; padding: 10px; border-radius: 6px;">
                    ${error.message}
                </p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: left;">
                <p style="margin: 0 0 10px 0; color: #4a5568; font-weight: 600;">
                    Please try again or contact support if the issue persists.
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">
                    📧 <a href="mailto:aivisibility@xeo.marketing" style="color: #00B9DA; text-decoration: none;">aivisibility@xeo.marketing</a>
                </p>
            </div>
        `;

        await showCompetitorModal(
            'Error',
            content,
            'OK',
            '#6b7280'
        );

        scanBtn.disabled = false;
        scanBtn.textContent = 'Analyze Website';
    }
});

// Manage Subscription - Opens Stripe Customer Portal
async function manageSubscription() {
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
        alert('Please log in to manage your subscription');
        return;
    }

    try {
        // Show loading state
        const btn = document.getElementById('manageSubscriptionBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Loading...';

        // Get Stripe Customer Portal URL
        const response = await fetch(`${API_BASE_URL}/subscription/portal`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to open subscription portal');
        }

        // Redirect to Stripe Customer Portal
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No portal URL received');
        }

    } catch (error) {
        console.error('Subscription management error:', error);
        alert(error.message || 'Failed to open subscription portal. Please try again or contact support.');

        // Restore button
        const btn = document.getElementById('manageSubscriptionBtn');
        btn.disabled = false;
        btn.innerHTML = '⚙️ Manage Subscription';
    }
}

// Change Primary Domain Modal Functions
function openDomainModal() {
    if (!user || !user.primary_domain) {
        alert('No primary domain set yet. Your primary domain will be set automatically on your first scan.');
        return;
    }

    // Set current domain in modal
    document.getElementById('currentDomainText').textContent = user.primary_domain;

    // Clear previous input and errors
    document.getElementById('newDomainInput').value = '';
    document.getElementById('domainChangeError').style.display = 'none';

    // Show modal
    document.getElementById('changeDomainModal').style.display = 'flex';
}

function closeDomainModal() {
    document.getElementById('changeDomainModal').style.display = 'none';
}

async function confirmDomainChange() {
    const newDomain = document.getElementById('newDomainInput').value.trim();
    const errorDiv = document.getElementById('domainChangeError');
    const btn = document.getElementById('changeDomainBtn');
    const originalText = btn.innerHTML;

    // Validate input
    if (!newDomain) {
        errorDiv.textContent = 'Please enter a new domain';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        // Show loading state
        btn.disabled = true;
        btn.innerHTML = '⏳ Changing...';
        errorDiv.style.display = 'none';

        const authToken = localStorage.getItem('authToken');

        const response = await fetch(`${API_BASE_URL}/auth/change-primary-domain`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newDomain })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to change primary domain');
        }

        // Success!
        alert(`✅ Primary domain changed successfully to: ${data.newDomain}\n\nYour scan quotas have been reset. Please refresh the page.`);

        // Close modal and reload page to reflect changes
        closeDomainModal();
        window.location.reload();

    } catch (error) {
        console.error('Domain change error:', error);
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';

        // Restore button
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Logout functions
function logout() {
    // Show the styled logout modal instead of browser confirm
    document.getElementById('logoutModal').style.display = 'flex';
}

function closeLogoutModal() {
    document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
    // Perform actual logout
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Competitor Modal functions
let competitorModalResolve = null;

function showCompetitorModal(title, content, confirmText = 'Continue', confirmStyle = null) {
    return new Promise((resolve) => {
        competitorModalResolve = resolve;

        document.getElementById('competitorModalTitle').textContent = title;
        document.getElementById('competitorModalContent').innerHTML = content;

        const confirmBtn = document.getElementById('competitorConfirmBtn');
        confirmBtn.textContent = confirmText;

        if (confirmStyle) {
            confirmBtn.style.background = confirmStyle;
        } else {
            confirmBtn.style.background = 'linear-gradient(135deg, #00B9DA 0%, #7030A0 100%)';
        }

        document.getElementById('competitorModal').style.display = 'flex';
    });
}

function closeCompetitorModal(result = false) {
    document.getElementById('competitorModal').style.display = 'none';
    if (competitorModalResolve) {
        competitorModalResolve(result);
        competitorModalResolve = null;
    }
}

function confirmCompetitorAction() {
    closeCompetitorModal(true);
}

// Attach confirm handler to button
document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('competitorConfirmBtn');
    if (confirmBtn) {
        confirmBtn.onclick = confirmCompetitorAction;
    }
});

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal && event.target === logoutModal) {
        closeLogoutModal();
    }

    const competitorModal = document.getElementById('competitorModal');
    if (competitorModal && event.target === competitorModal) {
        closeCompetitorModal(false);
    }
});

// Loading helpers
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initDashboard);