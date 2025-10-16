// ===== CONFIGURATION =====
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

// ===== AUTH HELPERS =====
function getAuthToken() {
    try {
        return localStorage.getItem('authToken');
    } catch (e) {
        console.warn('localStorage not available:', e);
        return null;
    }
}

function getUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.warn('Error reading user data:', e);
        return null;
    }
}

function logout() {
    try {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    } catch (e) {
        console.warn('Error clearing storage:', e);
    }
    window.location.href = 'auth.html';
}

// ===== PLAN HELPERS =====
const PLAN_LIMITS = {
    free: { scansPerMonth: 2, pagesPerScan: 1 },
    diy: { scansPerMonth: 10, pagesPerScan: 5 },
    pro: { scansPerMonth: 50, pagesPerScan: 25 }
};

function getPlanLimit(plan, type) {
    return PLAN_LIMITS[plan]?.[type] || PLAN_LIMITS.free[type];
}

// ===== UI: USER MENU =====
function renderUserMenu() {
    const user = getUser();
    const userMenu = document.getElementById('userMenu');
    
    if (!userMenu) return;
    
    if (user) {
        const planBadge = user.plan === 'diy' ? '🎯 DIY' : 
                         user.plan === 'pro' ? '⭐ PRO' : 
                         '🆓 Free';
        
        userMenu.innerHTML = `
            <div style="position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 15px; color: white;">
                <div style="text-align: right;">
                    <div style="font-weight: 600;">${user.email}</div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        ${planBadge} • ${user.scans_used_this_month || 0} scans used
                    </div>
                </div>
                <button onclick="logout()" style="padding: 8px 20px; border: 2px solid white; background: transparent; color: white; border-radius: 20px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    Logout
                </button>
            </div>
        `;
    } else {
        userMenu.innerHTML = `
            <div style="position: absolute; top: 20px; right: 20px;">
                <a href="auth.html" style="padding: 10px 25px; background: white; color: #00B9DA; border-radius: 25px; text-decoration: none; font-weight: 600; transition: all 0.3s;">
                    Sign In
                </a>
            </div>
        `;
    }
}

// ===== MAIN FORM HANDLER =====
document.getElementById('urlForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('websiteUrl').value.trim();
    
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    // Submit to Google Sheets (sidecar)
    submitToGoogleSheets(url);
    
    // Start analysis
    await analyzeWebsite(url);
});

function submitToGoogleSheets(url) {
    try {
        const byId = (id) => document.getElementById(id);
        const sheetWebsite = byId('sheet_website');
        const sheetPageUrl = byId('sheet_page_url');
        const sheetUserAgent = byId('sheet_user_agent');
        const sheetReferrer = byId('sheet_referrer');
        const sheetForm = byId('sheetForm');
        
        if (sheetWebsite) sheetWebsite.value = url;
        if (sheetPageUrl) sheetPageUrl.value = window.location.href;
        if (sheetUserAgent) sheetUserAgent.value = navigator.userAgent;
        if (sheetReferrer) sheetReferrer.value = document.referrer || '';
        if (sheetForm) sheetForm.submit();
    } catch (e) {
        console.warn('Google Sheets submit failed:', e);
    }
}

// ===== MAIN ANALYSIS FUNCTION =====
async function analyzeWebsite(url, selectedPages = []) {
    showLoading();
    
    // Mark that user has scanned (for freemium detection)
    try {
        localStorage.setItem('hasScanned', 'true');
    } catch (e) {
        console.warn('Could not set hasScanned flag:', e);
    }
    
    try {
        // Step 1: Technical Analysis
        updateProgress('Analyzing website structure...', 30);
        const analysisData = await fetchTechnicalAnalysis(url, selectedPages);
        
        if (!analysisData) {
            showError('Analysis failed. Please try again.');
            return;
        }
        
        // Step 2: Display results
        updateProgress('Finalizing results...', 100);
        
        setTimeout(() => {
            showResults(analysisData);
        }, 500);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        showError(error.message || 'Analysis failed. Please try again.');
    }
}

// ===== API CALLS =====
async function fetchTechnicalAnalysis(url, pages = []) {
    const token = getAuthToken();
    const user = getUser();
    
    // Check if anonymous user has scanned before
    if (!token && localStorage.getItem('hasScanned')) {
        // Redirect to signup for 2nd scan
        alert('Sign up free to continue scanning and track your progress!');
        window.location.href = 'auth.html?reason=limit';
        return null;
    }
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const body = { url, useAIDetection: true };
    if (pages.length > 0) {
        body.pages = pages;
    }
    
    const response = await fetch(`${API_BASE_URL}/analyze-website`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    
    if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        if (data.error === 'Scan limit reached') {
            alert(data.message + '\n\n' + (data.upgrade || 'Please upgrade your plan.'));
            window.location.href = 'checkout.html?plan=diy';
        }
        return null;
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Analysis failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
}

// ===== UI: LOADING STATES =====
function showLoading() {
    hideAllSections();
    document.getElementById('loadingSection').style.display = 'block';
}

function updateProgress(text, percentage) {
    const loadingText = document.getElementById('loadingText');
    const progressFill = document.getElementById('progressFill');
    
    if (loadingText) loadingText.textContent = text;
    if (progressFill) progressFill.style.width = percentage + '%';
}

function showError(message) {
    hideAllSections();
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorSection) errorSection.style.display = 'block';
    if (errorMessage) errorMessage.textContent = message;
}

function showResults(results) {
    hideAllSections();
    document.getElementById('resultsSection').style.display = 'block';
    displayResults(results);
}

function hideAllSections() {
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
}

function resetForm() {
    document.getElementById('inputSection').style.display = 'block';
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('websiteUrl').value = '';
    document.getElementById('progressFill').style.width = '0%';
}

// ===== UI: DISPLAY RESULTS =====
function displayResults(results) {
    if (!results) {
        showError('No results to display');
        return;
    }
    
    const isFreemium = results.isFreemium || !getUser();
    const user = getUser();
    
    // 1. Industry Detection
    displayIndustryInfo(results);
    
    // 2. Total Score
    displayTotalScore(results);
    
    // 3. Category Breakdown
    if (isFreemium) {
        displayLockedCategories();
    } else {
        displayCategoryBreakdown(results);
    }
    
    // 4. Page Count (if multi-page)
    displayPageCount(results);
    
    // 5. Recommendations
    displayRecommendations(results, isFreemium ? 3 : null);
    
    // 6. Upgrade CTA
    displayUpgradeCTA(results, isFreemium, user);
}

function displayIndustryInfo(results) {
    const detectedIndustry = document.getElementById('detectedIndustry');
    const websiteStats = document.getElementById('websiteStats');
    
    if (detectedIndustry && results.industry) {
        detectedIndustry.textContent = results.industry.name || 'General Business';
        
        // Add confidence badge
        if (results.industry.confidence) {
            const confidenceBadge = document.createElement('span');
            confidenceBadge.style.cssText = 'font-size: 0.8rem; background: rgba(77,172,166,0.2); color: #4DACA6; padding: 4px 12px; border-radius: 20px; margin-left: 10px;';
            confidenceBadge.textContent = results.industry.confidence.toUpperCase() + ' confidence';
            detectedIndustry.appendChild(confidenceBadge);
        }
    }
    
    if (websiteStats && results.url) {
        try {
            const hostname = new URL(results.url).hostname;
            const analyzedDate = results.analyzedAt ? new Date(results.analyzedAt).toLocaleDateString() : 'Today';
            websiteStats.textContent = `Domain: ${hostname} | Analyzed: ${analyzedDate}`;
        } catch (e) {
            console.warn('Error parsing URL:', e);
        }
    }
}

function displayTotalScore(results) {
    const totalScore = Math.round(results.scores?.total || 0);
    const totalScoreElement = document.getElementById('totalScore');
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreTitle = document.getElementById('scoreTitle');
    const scoreDescription = document.getElementById('scoreDescription');
    
    if (totalScoreElement) {
        totalScoreElement.textContent = totalScore;
    }
    
    // Score interpretation (out of 1000)
    if (totalScore < 300) {
        if (scoreCircle) scoreCircle.className = 'score-circle score-poor';
        if (scoreTitle) scoreTitle.textContent = 'Critical AI Visibility Issues';
        if (scoreDescription) scoreDescription.textContent = 'Your website has significant barriers preventing AI systems from finding and recommending you.';
    } else if (totalScore < 600) {
        if (scoreCircle) scoreCircle.className = 'score-circle score-fair';
        if (scoreTitle) scoreTitle.textContent = 'Moderate AI Visibility';
        if (scoreDescription) scoreDescription.textContent = 'Your website appears in some AI results but has room for substantial improvement.';
    } else {
        if (scoreCircle) scoreCircle.className = 'score-circle score-good';
        if (scoreTitle) scoreTitle.textContent = 'Strong AI Visibility';
        if (scoreDescription) scoreDescription.textContent = 'Your website is well-optimized for AI discovery with minor optimization opportunities.';
    }
}

function displayLockedCategories() {
    const categoriesContainer = document.getElementById('scoreCategories');
    if (!categoriesContainer) return;
    
    categoriesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(0,185,218,0.1) 0%, rgba(112,48,160,0.1) 100%); border-radius: 15px; border: 2px dashed #00B9DA;">
            <h3 style="margin-bottom: 15px; color: #333;">🔒 Unlock Full Category Breakdown</h3>
            <p style="color: #666; margin-bottom: 25px;">
                Sign up free to see your detailed scores across all 8 AI readiness pillars
            </p>
            <button class="analyze-btn" onclick="window.location.href='auth.html'" style="margin: 0 auto;">
                Sign Up Free - No Credit Card
            </button>
        </div>
    `;
}

function displayCategoryBreakdown(results) {
    const categories = [
        { key: 'aiReadabilityMultimodal', name: 'AI Readability & Multimodal', icon: '👁️', max: 125 },
        { key: 'aiSearchReadiness', name: 'AI Search Readiness', icon: '🎯', max: 125 },
        { key: 'contentFreshness', name: 'Content Freshness', icon: '🔄', max: 125 },
        { key: 'contentStructure', name: 'Content Structure', icon: '🗂️', max: 125 },
        { key: 'speedUX', name: 'Speed & UX', icon: '⚡', max: 125 },
        { key: 'technicalSetup', name: 'Technical Setup', icon: '⚙️', max: 125 },
        { key: 'trustAuthority', name: 'Trust & Authority', icon: '🛡️', max: 125 },
        { key: 'voiceOptimization', name: 'Voice Optimization', icon: '🎤', max: 125 }
    ];
    
    const categoriesContainer = document.getElementById('scoreCategories');
    if (!categoriesContainer) return;
    
    categoriesContainer.innerHTML = '';
    
    categories.forEach(category => {
        const score = Math.round(results.scores?.[category.key] || 0);
        const percentage = (score / category.max) * 100;
        
        let categoryClass, statusEmoji;
        if (percentage >= 70) {
            categoryClass = 'category-good';
            statusEmoji = '✅';
        } else if (percentage >= 40) {
            categoryClass = 'category-fair';
            statusEmoji = '🟡';
        } else {
            categoryClass = 'category-poor';
            statusEmoji = '❌';
        }
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = `category ${categoryClass}`;
        categoryDiv.innerHTML = `
            <h4>
                <span>${category.icon}</span>
                ${category.name}
                <span class="category-score">${score}/${category.max} ${statusEmoji}</span>
            </h4>
            <div class="category-progress">
                <div class="progress-bar-small">
                    <div class="progress-fill-small" style="width: ${Math.min(100, percentage)}%"></div>
                </div>
                <span class="progress-text">${percentage.toFixed(0)}%</span>
            </div>
        `;
        
        categoriesContainer.appendChild(categoryDiv);
    });
}

function displayPageCount(results) {
    const pageCountInfo = document.getElementById('pageCountInfo');
    const pageCountText = document.getElementById('pageCountText');
    
    if (!pageCountInfo || !pageCountText) return;
    
    if (results.pagesFetched && results.pagesFetched > 1) {
        pageCountInfo.style.display = 'block';
        pageCountText.textContent = `Analyzed ${results.pagesFetched} pages: ${(results.pagesScanned || []).join(', ')}`;
    } else {
        pageCountInfo.style.display = 'none';
    }
}

function displayRecommendations(results, limit = null) {
    let recommendations = results.recommendations || [];
    
    if (limit && limit > 0) {
        recommendations = recommendations.slice(0, limit);
    }
    
    const quickWinsContainer = document.getElementById('quickWins');
    if (!quickWinsContainer) return;
    
    quickWinsContainer.innerHTML = '';
    
    if (recommendations.length === 0) {
        quickWinsContainer.innerHTML = `
            <div class="quick-win">
                <h4>🎉 Excellent Optimization!</h4>
                <p>Your website is well-optimized for AI visibility. Continue monitoring for new opportunities.</p>
            </div>
        `;
        return;
    }
    
    const impactColors = {
        'Critical': '#F31C7E',
        'High': '#FF6B35',
        'Medium': '#FFA726',
        'Low': '#4DACA6'
    };
    
    recommendations.forEach(rec => {
        const recDiv = document.createElement('div');
        recDiv.className = 'quick-win';
        recDiv.innerHTML = `
            <h4 style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                ${rec.title}
                <span style="background: ${impactColors[rec.impact] || '#4DACA6'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">
                    ${rec.impact}
                </span>
            </h4>
            <p style="margin: 10px 0;">${rec.description}</p>
            ${rec.quickWin ? `<p style="background: rgba(77,172,166,0.1); padding: 12px; border-radius: 8px; margin-top: 10px;"><strong>💡 Quick Win:</strong> ${rec.quickWin}</p>` : ''}
        `;
        quickWinsContainer.appendChild(recDiv);
    });
}

function displayUpgradeCTA(results, isFreemium, user) {
    const upgradeCTA = document.getElementById('upgradeCTA');
    if (!upgradeCTA) return;
    
    upgradeCTA.innerHTML = '';
    
    if (isFreemium) {
        // Freemium user - show all plans
        upgradeCTA.innerHTML = createPricingTable(results.url);
    } else if (user && user.plan === 'free') {
        // Free plan - show upgrade to DIY/Pro
        upgradeCTA.innerHTML = createUpgradeCard(user.plan, results.url);
    } else if (user && user.plan === 'diy') {
        // DIY plan - show upgrade to Pro
        upgradeCTA.innerHTML = createUpgradeCard(user.plan, results.url);
    }
    // Pro users see nothing
}

function createPricingTable(url = '') {
    return `
        <div style="margin: 40px 0; padding: 40px; background: linear-gradient(135deg, rgba(0,185,218,0.05) 0%, rgba(112,48,160,0.05) 100%); border-radius: 20px;">
            <h3 style="text-align: center; margin-bottom: 30px;">Choose Your Plan</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px;">
                <!-- FREE -->
                <div style="background: white; padding: 30px; border-radius: 15px; border: 2px solid #e0e0e0;">
                    <h4>Free</h4>
                    <div style="font-size: 2rem; font-weight: bold; color: #00B9DA; margin: 15px 0;">$0<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                    <ul style="list-style: none; padding: 0; margin: 20px 0;">
                        <li style="padding: 8px 0;">✓ 2 scans/month</li>
                        <li style="padding: 8px 0;">✓ Homepage only</li>
                        <li style="padding: 8px 0;">✓ Basic score</li>
                        <li style="padding: 8px 0;">✓ Top 3 recommendations</li>
                    </ul>
                    <button onclick="window.location.href='auth.html'" style="width: 100%; padding: 12px; background: #f5f5f5; color: #333; border: 2px solid #00B9DA; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Sign Up Free
                    </button>
                </div>
                
                <!-- DIY -->
                <div style="background: white; padding: 30px; border-radius: 15px; border: 3px solid #00B9DA; position: relative;">
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #00B9DA; color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.8rem;">POPULAR</div>
                    <h4>DIY / Starter</h4>
                    <div style="font-size: 2rem; font-weight: bold; color: #00B9DA; margin: 15px 0;">$29<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                    <ul style="list-style: none; padding: 0; margin: 20px 0;">
                        <li style="padding: 8px 0;"><strong>✓ 10 scans/month</strong></li>
                        <li style="padding: 8px 0;"><strong>✓ 5 pages YOU choose</strong></li>
                        <li style="padding: 8px 0;">✓ Page-level TODO lists</li>
                        <li style="padding: 8px 0;">✓ JSON-LD export</li>
                        <li style="padding: 8px 0;">✓ Progress tracking</li>
                    </ul>
                    <button onclick="upgradeToPlan('diy', '${url}')" style="width: 100%; padding: 12px; background: #00B9DA; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Get Started
                    </button>
                </div>
                
                <!-- PRO -->
                <div style="background: white; padding: 30px; border-radius: 15px; border: 2px solid #7030A0;">
                    <h4>Pro</h4>
                    <div style="font-size: 2rem; font-weight: bold; color: #7030A0; margin: 15px 0;">$99<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                    <ul style="list-style: none; padding: 0; margin: 20px 0;">
                        <li style="padding: 8px 0;"><strong>✓ 50 scans/month</strong></li>
                        <li style="padding: 8px 0;"><strong>✓ 25 pages per scan</strong></li>
                        <li style="padding: 8px 0;">✓ Brand Visibility Index</li>
                        <li style="padding: 8px 0;">✓ Competitor tracking</li>
                        <li style="padding: 8px 0;">✓ Advanced analytics</li>
                    </ul>
                    <button onclick="upgradeToPlan('pro', '${url}')" style="width: 100%; padding: 12px; background: #7030A0; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Upgrade to Pro
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createUpgradeCard(currentPlan, url = '') {
    if (currentPlan === 'free') {
        return `
            <div style="margin: 40px 0; padding: 30px; background: linear-gradient(135deg, #00B9DA 0%, #7030A0 100%); color: white; border-radius: 20px; text-align: center;">
                <h3>🚀 Upgrade to DIY Starter</h3>
                <p style="margin: 15px 0;">Track 5 pages with unlimited scans for just $29/month</p>
                <button onclick="upgradeToPlan('diy', '${url}')" style="padding: 12px 30px; background: white; color: #00B9DA; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; margin-top: 10px;">
                    Upgrade Now
                </button>
            </div>
        `;
    } else if (currentPlan === 'diy') {
        return `
            <div style="margin: 40px 0; padding: 30px; background: linear-gradient(135deg, #7030A0 0%, #00B9DA 100%); color: white; border-radius: 20px; text-align: center;">
                <h3>⭐ Upgrade to Pro</h3>
                <p style="margin: 15px 0;">Track 25 pages + Brand Visibility Index for $99/month</p>
                <button onclick="upgradeToPlan('pro', '${url}')" style="padding: 12px 30px; background: white; color: #7030A0; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; margin-top: 10px;">
                    Upgrade to Pro
                </button>
            </div>
        `;
    }
    return '';
}

// ===== UPGRADE HANDLERS =====
function upgradeToPlan(plan, url) {
    const token = getAuthToken();
    
    if (!token) {
        const redirectUrl = `checkout.html?plan=${plan}&url=${encodeURIComponent(url || '')}`;
        sessionStorage.setItem('loginRedirect', redirectUrl);
        alert('Please sign in to upgrade your plan');
        window.location.href = 'auth.html';
        return;
    }
    
    window.location.href = `checkout.html?plan=${plan}&url=${encodeURIComponent(url || '')}`;
}

// ===== UTILITY FUNCTIONS =====
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// ===== PAGE INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    renderUserMenu();
    
    // Check for URL parameters (from page selector)
    const urlParams = new URLSearchParams(window.location.search);
    const shouldScan = urlParams.get('scan');
    const url = urlParams.get('url');
    const pagesParam = urlParams.get('pages');
    
    if (shouldScan && url) {
        const pages = pagesParam ? JSON.parse(decodeURIComponent(pagesParam)) : [];
        document.getElementById('websiteUrl').value = url;
        analyzeWebsite(url, pages);
    }
});