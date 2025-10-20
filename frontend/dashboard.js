const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

/**
 * Convert backend score (0-100) to display score (0-1000)
 */
function getDisplayScore(backendScore) {
  return Math.round(backendScore * 10);
}

async function loadRecentScans() {
    const scansList = document.getElementById('scansList');
    const authToken = localStorage.getItem('authToken');
    
    try {
        // TODO: Replace with actual API call when backend is ready
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
            
            // IMPORTANT: Convert backend score (0-100) to display score (0-1000)
            const displayScore = getDisplayScore(scan.total_score || 0);
            
            return `
                <div class="scan-card" onclick="window.location.href='results.html?id=${scan.id}'">
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
        free: 2,
        diy: 10,
        pro: 50
    };
    
    quota = {
        used: user.scans_used_this_month || 0,
        limit: planLimits[user.plan] || 2
    };
    
    const quotaBadge = document.getElementById('quotaBadge');
    quotaBadge.textContent = `${quota.used} / ${quota.limit} scans used`;
    
    // Update badge color based on usage
    quotaBadge.className = 'quota-badge';
    if (quota.used >= quota.limit) {
        quotaBadge.classList.add('quota-error');
    } else if (quota.used >= quota.limit * 0.8) {
        quotaBadge.classList.add('quota-warning');
    }
    
    // Show quota warning
    const quotaWarning = document.getElementById('quotaWarning');
    const quotaWarningText = document.getElementById('quotaWarningText');
    
    if (quota.used >= quota.limit) {
        quotaWarning.style.display = 'block';
        quotaWarning.className = 'quota-error';
        quotaWarningText.innerHTML = `
            ⚠️ You've used all ${quota.limit} scans this month. 
            <a href="checkout.html?plan=diy" style="color: inherit; text-decoration: underline; font-weight: bold;">Upgrade to continue scanning</a>
        `;
    } else if (quota.used >= quota.limit * 0.8) {
        quotaWarning.style.display = 'block';
        quotaWarning.className = 'quota-warning';
        quotaWarningText.textContent = `⚠️ You've used ${quota.used} of ${quota.limit} scans. ${quota.limit - quota.used} remaining this month.`;
    }
}

// Load recent scans
async function loadRecentScans() {
    const scansList = document.getElementById('scansList');
    const authToken = localStorage.getItem('authToken');
    
    try {
        // TODO: Replace with actual API call
        // const response = await fetch(`${API_BASE_URL}/scans/recent`, {
        //     headers: { 'Authorization': `Bearer ${authToken}` }
        // });
        // const data = await response.json();
        
        // MOCK DATA for now
        const mockScans = [
            { id: 1, url: 'https://example.com', score: 735, created_at: '2024-01-15T10:30:00Z' },
            { id: 2, url: 'https://mysite.com', score: 620, created_at: '2024-01-10T14:20:00Z' }
        ];
        
        if (mockScans.length === 0) {
            scansList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 10px;">No scans yet</p>
                    <p>Start your first scan above to see your AI visibility score!</p>
                </div>
            `;
            return;
        }
        
        scansList.innerHTML = mockScans.map(scan => {
            const date = new Date(scan.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            return `
                <div class="scan-card" onclick="window.location.href='index.html#results-${scan.id}'">
                    <div class="scan-info">
                        <h4>${scan.url}</h4>
                        <p>Scanned on ${date}</p>
                    </div>
                    <div class="scan-score">
                        <div class="score-number">${scan.score}</div>
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
document.getElementById('scanForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const url = document.getElementById('scanUrl').value.trim();
    const scanBtn = document.getElementById('scanBtn');
    
    // Check quota
    if (quota.used >= quota.limit) {
        alert(`You've reached your scan limit (${quota.limit}/month). Please upgrade to continue.`);
        window.location.href = 'checkout.html?plan=diy';
        return;
    }
    
    // Disable button
    scanBtn.disabled = true;
    scanBtn.textContent = 'Starting scan...';
    
    try {
        // For DIY/Pro users, go to page selector
        if (user.plan === 'diy' || user.plan === 'pro') {
            window.location.href = `page-selector.html?url=${encodeURIComponent(url)}`;
            return;
        }
        
        // For free users, scan immediately (homepage only)
        // TODO: Call actual API
        console.log('Starting scan for:', url);
        
        // MOCK: Redirect to results after delay
        setTimeout(() => {
            window.location.href = `index.html?scan=true&url=${encodeURIComponent(url)}`;
        }, 2000);
        
    } catch (error) {
        console.error('Scan error:', error);
        alert('Failed to start scan. Please try again.');
        scanBtn.disabled = false;
        scanBtn.textContent = 'Analyze Website';
    }
});

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}

// Loading helpers
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initDashboard);