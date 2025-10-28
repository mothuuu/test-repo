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
    document.getElementById('userName').textContent = user.email.split('@')[0];
    
    // Update plan badge
    const planBadge = document.getElementById('planBadge');
    const planNames = {
        free: '🆓 Free Plan',
        diy: '🎯 DIY Plan',
        pro: '⭐ Pro Plan'
    };
    planBadge.textContent = planNames[user.plan] || 'Free Plan';
    
    // Update plan info text
    const planInfo = {
        free: '✓ Free plan: Homepage scan only',
        diy: '✓ DIY plan: Choose 5 pages per scan',
        pro: '✓ Pro plan: Analyze up to 25 pages'
    };
    document.getElementById('planInfo').textContent = planInfo[user.plan];
    
    // Show upgrade banner for free users
    if (user.plan === 'free') {
        document.getElementById('upgradeBanner').style.display = 'block';
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

    const quotaBadge = document.getElementById('quotaBadge');
    quotaBadge.textContent = `${quota.used} / ${quota.limit} primary scans`;
    quotaBadge.title = 'Scans of your primary domain';

    // Update badge color based on usage
    quotaBadge.className = 'quota-badge';
    if (quota.used >= quota.limit) {
        quotaBadge.classList.add('quota-error');
    } else if (quota.used >= quota.limit * 0.8) {
        quotaBadge.classList.add('quota-warning');
    }

    // Competitor scan quota (show only for DIY and Pro)
    const competitorQuotaBadge = document.getElementById('competitorQuotaBadge');
    if (limits.competitor > 0) {
        const competitorUsed = user.competitor_scans_used_this_month || 0;
        competitorQuotaBadge.textContent = `${competitorUsed} / ${limits.competitor} competitors`;
        competitorQuotaBadge.title = 'Competitor scans (scores only)';
        competitorQuotaBadge.style.display = 'inline-block';

        // Color code competitor quota
        competitorQuotaBadge.className = 'quota-badge';
        if (competitorUsed >= limits.competitor) {
            competitorQuotaBadge.classList.add('quota-error');
        } else if (competitorUsed >= limits.competitor * 0.8) {
            competitorQuotaBadge.classList.add('quota-warning');
        }
    } else {
        competitorQuotaBadge.style.display = 'none';
    }

    // Primary domain badge
    const primaryDomainBadge = document.getElementById('primaryDomainBadge');
    if (user.primary_domain) {
        primaryDomainBadge.textContent = `🏠 ${user.primary_domain}`;
        primaryDomainBadge.title = `Your primary domain: ${user.primary_domain}`;
    } else {
        primaryDomainBadge.textContent = '🏠 Not set';
        primaryDomainBadge.title = 'Primary domain will be set on first scan';
    }

    // Show quota warning
    const quotaWarning = document.getElementById('quotaWarning');
    const quotaWarningText = document.getElementById('quotaWarningText');

    if (quota.used >= quota.limit) {
        quotaWarning.style.display = 'block';
        quotaWarning.className = 'quota-error';
        quotaWarningText.innerHTML = `
            ⚠️ You've used all ${quota.limit} primary domain scans this month.
            <a href="checkout.html?plan=diy" style="color: inherit; text-decoration: underline; font-weight: bold;">Upgrade to continue scanning</a>
        `;
    } else if (quota.used >= quota.limit * 0.8) {
        quotaWarning.style.display = 'block';
        quotaWarning.className = 'quota-warning';
        quotaWarningText.textContent = `⚠️ You've used ${quota.used} of ${quota.limit} primary scans. ${quota.limit - quota.used} remaining this month.`;
    }
}

// Load recent scans
async function loadRecentScans() {
    const scansList = document.getElementById('scansList');
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
        
        if (scans.length === 0) {
            scansList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 10px;">No scans yet</p>
                    <p>Start your first scan above to see your AI visibility score!</p>
                </div>
            `;
            return;
        }
        
        scansList.innerHTML = scans.map(scan => {
            const date = new Date(scan.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Convert backend score (0-100) to display score (0-1000)
            const displayScore = getDisplayScore(scan.total_score || 0);
            
            return `
                <div class="scan-card" onclick="window.location.href='results.html?scanId=${scan.id}'">
                    <div class="scan-info">
                        <h4>${scan.url}</h4>
                        <p>Scanned on ${date}</p>
                    </div>
                    <div class="scan-score">
                        <div class="score-number">${displayScore}</div>
                        <div class="score-label">/ 1000</div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading scans:', error);
        scansList.innerHTML = `
            <div class="empty-state">
                <p style="color: #dc3545;">Failed to load recent scans. Please try again.</p>
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
            const proceed = confirm(
                `⚠️ COMPETITOR SCAN DETECTED\n\n` +
                `You're trying to scan: ${scanDomain}\n` +
                `Your primary domain: ${user.primary_domain}\n\n` +
                `Free plan doesn't include competitor scans.\n\n` +
                `Upgrade to DIY ($29/month) for 2 competitor scans per month, or Pro ($99/month) for 10 competitor scans.\n\n` +
                `Click OK to view upgrade options.`
            );

            if (proceed) {
                window.location.href = 'checkout.html?plan=diy';
            }
            return;
        }

        if (competitorUsed >= competitorLimit) {
            const proceed = confirm(
                `⚠️ COMPETITOR SCAN QUOTA EXCEEDED\n\n` +
                `You've used all ${competitorLimit} competitor scans this month (${competitorUsed}/${competitorLimit}).\n\n` +
                user.plan === 'diy'
                    ? `Upgrade to Pro ($99/month) for 10 competitor scans per month.\n\nClick OK to upgrade.`
                    : `Your quota will reset next month.\n\nClick OK to return to dashboard.`
            );

            if (proceed && user.plan === 'diy') {
                window.location.href = 'checkout.html?plan=pro';
            }
            return;
        }

        // Warn user about competitor scan limitations
        const proceed = confirm(
            `⚠️ COMPETITOR SCAN\n\n` +
            `You're scanning: ${scanDomain} (competitor)\n` +
            `Your primary domain: ${user.primary_domain}\n\n` +
            `Competitor scans provide:\n` +
            `✅ AI Visibility Scores\n` +
            `✅ Category breakdown\n` +
            `❌ NO recommendations\n` +
            `❌ NO implementation guidance\n\n` +
            `Quota: ${competitorUsed + 1} / ${competitorLimit} competitor scans used\n\n` +
            `Continue with competitor scan?`
        );

        if (!proceed) {
            return;
        }
    }

    // Check primary scan quota (only for primary domain scans)
    if (!isCompetitorScan && quota.used >= quota.limit) {
        alert(`You've reached your primary scan limit (${quota.limit}/month). Please upgrade to continue.`);
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
        alert('Failed to start scan: ' + error.message);
        scanBtn.disabled = false;
        scanBtn.textContent = 'Analyze Website';
    }
});

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

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const modal = document.getElementById('logoutModal');
    if (modal && event.target === modal) {
        closeLogoutModal();
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