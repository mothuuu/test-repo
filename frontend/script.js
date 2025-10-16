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

// Add this after the existing getUser() function in script.js

// Check if user has DIY or Pro plan
function hasPaidPlan() {
    const user = getUser();
    return user && ['diy', 'pro'].includes(user.plan);
}

// Show page selector for DIY/Pro users
function showPageSelector(url) {
    window.location.href = `page-selector.html?url=${encodeURIComponent(url)}`;
}

// Update the form handler to check for DIY users
document.getElementById('urlForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('websiteUrl').value.trim();
    
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    const user = getUser();
    
    // If user has DIY or Pro plan, show page selector
    if (user && ['diy', 'pro'].includes(user.plan)) {
        const choice = confirm(
            'You have a ' + user.plan.toUpperCase() + ' plan!\n\n' +
            'Would you like to select specific pages to scan?\n\n' +
            'Click OK to choose pages, or Cancel to scan just the homepage.'
        );
        
        if (choice) {
            showPageSelector(url);
            return;
        }
    }
    
    // Sidecar submit to Google Sheets
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
    
    await analyzeWebsite(url);
});

// Check for scan parameter from page selector
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldScan = urlParams.get('scan');
    const url = urlParams.get('url');
    const pagesParam = urlParams.get('pages');
    
    if (shouldScan && url) {
        const pages = pagesParam ? JSON.parse(pagesParam) : [];
        
        // Pre-fill URL
        const urlInput = document.getElementById('websiteUrl');
        if (urlInput) {
            urlInput.value = url;
        }
        
        // Start analysis with selected pages
        analyzeWebsite(url, pages);
    }
});

// Updated analyzeWebsite function with pages parameter
async function analyzeWebsite(url, selectedPages = []) {
    showLoading();
    
    // Mark that user has scanned
    try {
        localStorage.setItem('hasScanned', 'true');
    } catch (e) {
        console.warn('Could not set hasScanned flag:', e);
    }
    
    try {
        // Step 1: Analyze website with selected pages
        updateProgress('Analyzing website structure...', 25);
        const analysisData = await fetchTechnicalAnalysis(url, selectedPages);
        
        if (!analysisData) {
            return;
        }
        
        // Step 2: Test AI visibility (if needed)
        updateProgress('Testing AI assistant visibility...', 75);
        let aiVisibilityData = null;
        try {
            aiVisibilityData = await testAIVisibility(url, analysisData.industry);
        } catch (error) {
            console.log('AI visibility testing failed, continuing without it:', error);
        }
        
        // Step 3: Combine results
        updateProgress('Finalizing results...', 100);
        
        const results = {
            ...analysisData,
            aiVisibilityResults: aiVisibilityData
        };
        
        // Display results
        setTimeout(() => {
            showResults(results);
        }, 1000);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        showError(error.message || 'Analysis failed. Please try again.');
    }
}

// Updated API call with pages parameter
async function fetchTechnicalAnalysis(url, pages = []) {
    const token = getAuthToken();
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/analyze-website`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            url, 
            pages: pages.length > 0 ? pages : undefined 
        })
    });
    
    if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        if (data.error === 'Scan limit reached') {
            alert(data.message + '\n\n' + (data.upgrade || 'Please upgrade your plan.'));
            window.location.href = 'auth.html?reason=limit';
        }
        return null;
    }
    
    if (!response.ok) {
        throw new Error(`Technical analysis failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
}

// Add user menu with plan badge
document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (user) {
        const header = document.querySelector('.header');
        if (header) {
            const planBadge = user.plan === 'diy' ? '🎯 DIY' : 
                            user.plan === 'pro' ? '⭐ PRO' : 
                            '🆓 Free';
            
            const userMenu = document.createElement('div');
            userMenu.style.cssText = 'position: absolute; top: 20px; right: 20px; color: white; display: flex; align-items: center; gap: 15px;';
            userMenu.innerHTML = `
                <div style="text-align: right;">
                    <div style="font-weight: 600;">${user.email}</div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        ${planBadge} • ${user.scans_used_this_month || 0} scans used
                    </div>
                </div>
                <button onclick="logout()" style="padding: 8px 20px; border: 2px solid white; background: transparent; color: white; border-radius: 20px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    Logout
                </button>
            `;
            header.style.position = 'relative';
            header.appendChild(userMenu);
        }
    }
});

// Add page-level recommendations display for DIY/Pro
function displayPageRecommendations(scanData) {
    if (!scanData.scannedPages || scanData.scannedPages.length <= 1) {
        return; // Only homepage scanned
    }
    
    const recommendationsSection = document.querySelector('.recommendations');
    if (!recommendationsSection) return;
    
    const pageRecSection = document.createElement('div');
    pageRecSection.className = 'page-recommendations';
    pageRecSection.style.cssText = 'margin-top: 30px; padding: 30px; background: white; border-radius: 15px;';
    
    pageRecSection.innerHTML = `
        <h3>📄 Page-by-Page Recommendations</h3>
        <p style="color: #666; margin-bottom: 20px;">Specific improvements for each scanned page</p>
        <div id="pageRecList"></div>
    `;
    
    recommendationsSection.appendChild(pageRecSection);
    
    const pageRecList = document.getElementById('pageRecList');
    
    scanData.scannedPages.forEach(pageUrl => {
        const pageDiv = document.createElement('div');
        pageDiv.style.cssText = 'margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px;';
        
        pageDiv.innerHTML = `
            <h4 style="margin-bottom: 10px;">${pageUrl}</h4>
            <ul style="list-style: none; padding: 0;">
                <li style="padding: 8px 0;">✅ Add FAQ schema for voice search</li>
                <li style="padding: 8px 0;">⚡ Optimize images for faster loading</li>
                <li style="padding: 8px 0;">🎯 Add clear CTAs for AI assistants</li>
            </ul>
        `;
        
        pageRecList.appendChild(pageDiv);
    });
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

// ===== ADD USER MENU TO PAGE =====
document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (user) {
        const header = document.querySelector('.header');
        if (header) {
            const userMenu = document.createElement('div');
            userMenu.style.cssText = 'position: absolute; top: 20px; right: 20px; color: white; display: flex; align-items: center; gap: 15px;';
            userMenu.innerHTML = `
                <div style="text-align: right;">
                    <div style="font-weight: 600;">${user.email}</div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">${user.plan} plan • ${user.scans_used_this_month || 0} scans used</div>
                </div>
                <button onclick="logout()" style="padding: 8px 20px; border: 2px solid white; background: transparent; color: white; border-radius: 20px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    Logout
                </button>
            `;
            header.style.position = 'relative';
            header.appendChild(userMenu);
        }
    }
});

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

// Industry-specific test queries
const TEST_QUERIES = {
    msp: [
        "Best managed service providers for cybersecurity",
        "Top IT support companies for small business",
        "Reliable MSP for remote work solutions"
    ],
    telecom: [
        "Best internet service providers in Ontario",
        "Reliable fiber internet companies",
        "Top telecommunications providers for business"
    ],
    startup: [
        "AI automation solutions for startups",
        "Best technology platforms for scaling",
        "Startup-friendly software solutions"
    ],
    professional_services: [
        "Best consulting firms for business strategy",
        "Top professional service providers",
        "Business advisory services near me"
    ]
};

// Main form handler
document.getElementById('urlForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('websiteUrl').value.trim();
    
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    // --- Sidecar submit to Google Sheets ---
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
    // ---------------------------------------------------------------------------
    
    await analyzeWebsite(url);
});

// Website analysis function
async function analyzeWebsite(url) {
    showLoading();
    
    // Mark that user has scanned
    try {
        localStorage.setItem('hasScanned', 'true');
    } catch (e) {
        console.warn('Could not set hasScanned flag:', e);
    }
    
    try {
        // Step 1: Analyze website with the new backend
        updateProgress('Analyzing website structure...', 25);
        const analysisData = await fetchTechnicalAnalysis(url);
        
        // If no data returned (auth issue), stop here
        if (!analysisData) {
            return;
        }
        
        // Step 2: Test AI visibility (if needed)
        updateProgress('Testing AI assistant visibility...', 75);
        let aiVisibilityData = null;
        try {
            aiVisibilityData = await testAIVisibility(url, analysisData.industry);
        } catch (error) {
            console.log('AI visibility testing failed, continuing without it:', error);
        }
        
        // Step 3: Combine results
        updateProgress('Finalizing results...', 100);
        
        const results = {
            ...analysisData,
            aiVisibilityResults: aiVisibilityData
        };
        
        // Display results
        setTimeout(() => {
            showResults(results);
        }, 1000);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        showError(error.message || 'Analysis failed. Please try again.');
    }
}

// Updated API call function - ALLOWS ANONYMOUS USERS
async function fetchTechnicalAnalysis(url) {
    const token = getAuthToken();
    
    // Build headers - include token only if user is logged in
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/analyze-website`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ url })
    });
    
    if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        if (data.error === 'Scan limit reached') {
            alert(data.message + '\n\n' + (data.upgrade || 'Please upgrade your plan.'));
            window.location.href = 'auth.html?reason=limit';
        }
        return null;
    }
    
    if (!response.ok) {
        throw new Error(`Technical analysis failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
}

async function testAIVisibility(url, industry) {
    const queries = TEST_QUERIES[industry?.key] || TEST_QUERIES.professional_services;
    
    const response = await fetch(`${API_BASE_URL}/test-ai-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, industry, queries })
    });
    
    if (!response.ok) {
        throw new Error(`AI visibility testing failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
}

// Utility functions
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

// UI functions
function showLoading() {
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorSection = document.getElementById('errorSection');
    const resultsSection = document.getElementById('resultsSection');
    
    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'block';
    if (errorSection) errorSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
}

function updateProgress(text, percentage) {
    const loadingText = document.getElementById('loadingText');
    const progressFill = document.getElementById('progressFill');
    
    if (loadingText) loadingText.textContent = text;
    if (progressFill) progressFill.style.width = percentage + '%';
}

function showError(message) {
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorSection = document.getElementById('errorSection');
    const resultsSection = document.getElementById('resultsSection');
    const errorMessage = document.getElementById('errorMessage');
    
    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
    if (errorMessage) errorMessage.textContent = message;
}

function showResults(results) {
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorSection = document.getElementById('errorSection');
    const resultsSection = document.getElementById('resultsSection');
    
    if (inputSection) inputSection.style.display = 'none';
    if (loadingSection) loadingSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    
    displayResults(results);
}

function displayResults(results) {
    if (!results) {
        showError('No results to display');
        return;
    }
    
    // Check if user is freemium (anonymous)
    const isFreemium = results.isFreemium || !getUser();
    
    // Update industry detection
    const detectedIndustry = document.getElementById('detectedIndustry');
    const websiteStats = document.getElementById('websiteStats');
    
    if (detectedIndustry) {
        detectedIndustry.textContent = results.industry?.name || 'Professional Services';
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
    
    // Update total score
    const totalScore = Math.round(results.scores?.total || 0);
    const totalScoreElement = document.getElementById('totalScore');
    if (totalScoreElement) {
        totalScoreElement.textContent = totalScore;
    }
    
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreTitle = document.getElementById('scoreTitle');
    const scoreDescription = document.getElementById('scoreDescription');
    
    // Update score styling and messages based on total score
    if (totalScore < 30) {
        if (scoreCircle) scoreCircle.className = 'score-circle score-poor';
        if (scoreTitle) scoreTitle.textContent = 'Critical AI Visibility Issues';
        if (scoreDescription) scoreDescription.textContent = 'Your website has significant barriers preventing AI systems from finding and recommending you.';
    } else if (totalScore < 60) {
        if (scoreCircle) scoreCircle.className = 'score-circle score-fair';
        if (scoreTitle) scoreTitle.textContent = 'Moderate AI Visibility';
        if (scoreDescription) scoreDescription.textContent = 'Your website appears in some AI results but has room for substantial improvement.';
    } else {
        if (scoreCircle) scoreCircle.className = 'score-circle score-good';
        if (scoreTitle) scoreTitle.textContent = 'Strong AI Visibility';
        if (scoreDescription) scoreDescription.textContent = 'Your website is well-optimized for AI discovery with minor optimization opportunities.';
    }
    
    // FREEMIUM LOGIC: Show limited or full results
    if (isFreemium) {
        displayFreemiumResults(results);
    } else {
        displayFullResults(results);
    }
}

// Display limited results for freemium users
function displayFreemiumResults(results) {
    // Show locked categories with upgrade CTA
    const categoriesContainer = document.getElementById('scoreCategories');
    if (categoriesContainer) {
        categoriesContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(0,185,218,0.1) 0%, rgba(112,48,160,0.1) 100%); border-radius: 15px; border: 2px dashed #00B9DA;">
                <h3 style="margin-bottom: 15px; color: #333;">🔒 See Your Detailed Breakdown</h3>
                <p style="color: #666; margin-bottom: 25px;">
                    Sign up free to see your scores across all 8 AI readiness categories
                </p>
                <button class="analyze-btn" onclick="window.location.href='auth.html'" style="margin: 0 auto;">
                    Sign Up Free - No Credit Card
                </button>
            </div>
        `;
    }
    
    // Hide AI visibility results
    const aiVisibilityResults = document.getElementById('aiVisibilityResults');
    if (aiVisibilityResults) {
        aiVisibilityResults.innerHTML = '';
    }
    
    // Show only top 3 recommendations
    displayRecommendations(results, 3);
    
    // Add upgrade banner
    const resultsSection = document.getElementById('resultsSection');
    const existingBanner = document.getElementById('freemiumUpgradeBanner');
    
    if (resultsSection && !existingBanner) {
        const tierComparisonHTML = `
            <div id="freemiumUpgradeBanner" class="tier-comparison-card" style="margin: 40px 0; padding: 40px; background: linear-gradient(135deg, rgba(0,185,218,0.05) 0%, rgba(112,48,160,0.05) 100%); border-radius: 20px; border: 2px solid #00B9DA;">
                <h3 style="text-align: center; margin-bottom: 15px;">🚀 Get Your Full AI Visibility Report</h3>
                <p style="text-align: center; color: #666; margin-bottom: 30px;">Choose the plan that fits your needs</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; margin-bottom: 30px;">
                    <!-- FREE TIER -->
                    <div style="background: white; padding: 30px; border-radius: 15px; border: 2px solid #e0e0e0;">
                        <h4 style="margin-bottom: 10px;">Free</h4>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #00B9DA; margin-bottom: 20px;">$0<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                        <div style="margin-bottom: 25px;">
                            <div style="margin-bottom: 12px;">✓ 2 scans per month</div>
                            <div style="margin-bottom: 12px;">✓ Homepage only (1 page)</div>
                            <div style="margin-bottom: 12px;">✓ Detailed category breakdowns</div>
                            <div style="margin-bottom: 12px;">✓ Full recommendations list</div>
                            <div style="margin-bottom: 12px;">✓ Progress tracking</div>
                        </div>
                        <button onclick="upgradeToFreePlan()" style="width: 100%; padding: 12px 24px; background: #f5f5f5; color: #333; border: 2px solid #00B9DA; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                            Sign Up Free
                        </button>
                    </div>
                    
                    <!-- DIY/STARTER TIER -->
                    <div style="background: white; padding: 30px; border-radius: 15px; border: 3px solid #00B9DA; position: relative;">
                        <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #00B9DA; color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">MOST POPULAR</div>
                        <h4 style="margin-bottom: 10px;">DIY / Starter</h4>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #00B9DA; margin-bottom: 20px;">$29<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                        <div style="margin-bottom: 25px;">
                            <div style="margin-bottom: 12px;"><strong>✓ Homepage + 4 pages YOU choose</strong></div>
                            <div style="margin-bottom: 12px;">✓ Pick any 4 additional pages to scan</div>
                            <div style="margin-bottom: 12px;">✓ Page-level TODO lists</div>
                            <div style="margin-bottom: 12px;">✓ Progress tracking over time</div>
                            <div style="margin-bottom: 12px;">✓ Basic JSON-LD export</div>
                            <div style="margin-bottom: 12px;">✓ Combined recommendations</div>
                        </div>
                        <button onclick="upgradeToPlan('diy', '${results.url || ''}')" style="width: 100%; padding: 12px 24px; background: #00B9DA; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                            Get Started
                        </button>
                    </div>
                    
                    <!-- PRO TIER -->
                    <div style="background: white; padding: 30px; border-radius: 15px; border: 2px solid #7030A0;">
                        <h4 style="margin-bottom: 10px;">Pro</h4>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #7030A0; margin-bottom: 20px;">$99<span style="font-size: 1rem; font-weight: normal;">/mo</span></div>
                        <div style="margin-bottom: 25px;">
                            <div style="margin-bottom: 12px;"><strong>✓ Up to 25 pages</strong> per scan</div>
                            <div style="margin-bottom: 12px;"><strong>✓ Brand Visibility Index</strong></div>
                            <div style="margin-bottom: 12px;"><strong>✓ Competitor benchmarking</strong> (3 domains)</div>
                            <div style="margin-bottom: 12px;">✓ Knowledge Graph fields</div>
                            <div style="margin-bottom: 12px;">✓ Advanced JSON-LD pack (5+ schemas)</div>
                            <div style="margin-bottom: 12px;">✓ Outside-in crawl (PR, reviews, social)</div>
                            <div style="margin-bottom: 12px;">✓ Live dashboard & analytics</div>
                        </div>
                        <button onclick="upgradeToPlan('pro', '${results.url || ''}')" style="width: 100%; padding: 12px 24px; background: #7030A0; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                            Upgrade to Pro
                        </button>
                    </div>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 0.9rem;">
                    <p>💳 All plans include secure Stripe checkout • Cancel anytime</p>
                </div>
            </div>
        `;
        
        const ctaSection = document.querySelector('.cta-section');
        if (ctaSection && ctaSection.parentNode) {
            ctaSection.parentNode.insertBefore(
                createElementFromHTML(tierComparisonHTML),
                ctaSection
            );
        } else {
            resultsSection.insertAdjacentHTML('beforeend', tierComparisonHTML);
        }
    }
}

// Display full results for logged-in users
function displayFullResults(results) {
    // Display full category analysis
    displayCategoryAnalysis(results);
    
    // Display AI visibility results if available
    if (results.aiVisibilityResults) {
        displayAIVisibilityResults(results.aiVisibilityResults);
    }
    
    // Display all recommendations
    displayRecommendations(results);
    
    // Remove freemium banner if it exists
    const banner = document.getElementById('freemiumUpgradeBanner');
    if (banner) banner.remove();
}

// V5 CATEGORY DISPLAY FUNCTION
function displayCategoryAnalysis(results) {
    const scores = results.scores || {};
    const analysis = results.analysis || {};
    
    // V5 Categories with proper names and contribution percentages
    const categories = [
        {
            key: 'aiReadabilityMultimodal',
            name: 'AI Readability & Multimodal Access',
            icon: '👁️',
            description: 'How well AI can process your images, videos, and multimedia content',
            maxContribution: 10
        },
        {
            key: 'aiSearchReadiness', 
            name: 'AI Search Readiness & Content Depth',
            icon: '🎯',
            description: 'Content structure and depth for AI search optimization',
            maxContribution: 20
        },
        {
            key: 'contentFreshness',
            name: 'Content Freshness & Maintenance', 
            icon: '🔄',
            description: 'Content currency and maintenance indicators for AI trust',
            maxContribution: 8
        },
        {
            key: 'contentStructure',
            name: 'Content Structure & Entity Recognition',
            icon: '🗂️', 
            description: 'Semantic structure and entity clarity for AI understanding',
            maxContribution: 15
        },
        {
            key: 'speedUX',
            name: 'Speed & User Experience',
            icon: '⚡',
            description: 'Core Web Vitals and performance metrics for AI crawlers',
            maxContribution: 5
        },
        {
            key: 'technicalSetup',
            name: 'Technical Setup & Structured Data',
            icon: '⚙️',
            description: 'Technical infrastructure for AI crawler access and understanding', 
            maxContribution: 18
        },
        {
            key: 'trustAuthority',
            name: 'Trust, Authority & Verification',
            icon: '🛡️',
            description: 'E-E-A-T signals and credibility indicators for AI systems',
            maxContribution: 12
        },
        {
            key: 'voiceOptimization',
            name: 'Voice & Conversational Optimization', 
            icon: '🎤',
            description: 'Natural language and conversational query optimization',
            maxContribution: 12
        }
    ];
    
    const categoriesContainer = document.getElementById('scoreCategories');
    if (!categoriesContainer) return;
    
    categoriesContainer.innerHTML = '';
    
    categories.forEach(category => {
        // Get the category analysis from backend response
        const categoryResult = analysis[category.key];
        let categoryPercentage = 0;
        
        // Handle both V5 and V4 response formats
        if (categoryResult && typeof categoryResult.total === 'number') {
            categoryPercentage = categoryResult.total;
        } else if (scores[category.key] && typeof scores[category.key] === 'number') {
            categoryPercentage = scores[category.key];
        }
        
        // Calculate actual contribution to final score
        const actualContribution = (categoryPercentage / 100) * category.maxContribution;
        
        let categoryClass, statusEmoji;
        const contributionPercentage = (actualContribution / category.maxContribution) * 100;
        
        if (contributionPercentage >= 70) {
            categoryClass = 'category-good';
            statusEmoji = '✅';
        } else if (contributionPercentage >= 40) {
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
                <span class="category-score">${actualContribution.toFixed(1)}/${category.maxContribution} pts ${statusEmoji}</span>
            </h4>
            <p>${category.description}</p>
            <div class="category-progress">
                <div class="progress-bar-small">
                    <div class="progress-fill-small" style="width: ${Math.min(100, contributionPercentage)}%"></div>
                </div>
                <span class="progress-text">${categoryPercentage.toFixed(0)}% optimized</span>
            </div>
        `;
        
        categoriesContainer.appendChild(categoryDiv);
    });
}

function displayAIVisibilityResults(aiResults) {
    const aiResultsContainer = document.getElementById('aiVisibilityResults');
    if (!aiResultsContainer) return;
    
    if (!aiResults || !aiResults.overall) {
        aiResultsContainer.innerHTML = `
            <h3>AI Visibility Testing</h3>
            <p>AI assistant testing was not available for this analysis.</p>
        `;
        return;
    }
    
    aiResultsContainer.innerHTML = `
        <h3>Live AI Assistant Testing Results</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
            <div style="text-align: center; background: white; padding: 20px; border-radius: 10px;">
                <div style="font-size: 2rem; font-weight: bold; color: #00B9DA;">${Math.round(aiResults.overall.mentionRate)}%</div>
                <div>Mention Rate</div>
                <small>How often you're mentioned</small>
            </div>
            <div style="text-align: center; background: white; padding: 20px; border-radius: 10px;">
                <div style="font-size: 2rem; font-weight: bold; color: #4DACA6;">${Math.round(aiResults.overall.recommendationRate)}%</div>
                <div>Recommendation Rate</div>
                <small>How often you're recommended</small>
            </div>
            <div style="text-align: center; background: white; padding: 20px; border-radius: 10px;">
                <div style="font-size: 2rem; font-weight: bold; color: #7030A0;">${Math.round(aiResults.overall.citationRate)}%</div>
                <div>Citation Rate</div>
                <small>How often you're cited</small>
            </div>
        </div>
        <p><strong>Queries tested:</strong> ${aiResults.testedQueries}</p>
    `;
}

function displayRecommendations(results, limit = null) {
    let recommendations = results.recommendations || [];
    
    // Apply limit if specified
    if (limit && limit > 0) {
        recommendations = recommendations.slice(0, limit);
    }
    
    const quickWinsContainer = document.getElementById('quickWins');
    if (!quickWinsContainer) return;
    
    quickWinsContainer.innerHTML = '';
    
    if (recommendations.length === 0) {
        quickWinsContainer.innerHTML = `
            <div class="quick-win">
                <h4>Excellent Optimization!</h4>
                <p>Your website is well-optimized for AI visibility. Continue monitoring for new opportunities.</p>
            </div>
        `;
        return;
    }
    
    // Display the recommendations from the backend
    recommendations.forEach(rec => {
        const colors = { 
            'Critical': '#F31C7E', 
            'High': '#FF6B35', 
            'Medium': '#FFA726', 
            'Low': '#4DACA6' 
        };
        
        const recDiv = document.createElement('div');
        recDiv.className = 'quick-win';
        recDiv.innerHTML = `
            <h4 style="display: flex; justify-content: space-between; align-items: center;">
                ${rec.title}
                <span style="background: ${colors[rec.impact] || '#4DACA6'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">
                    ${rec.impact}
                </span>
            </h4>
            <p>${rec.description}</p>
            ${rec.quickWin ? `<p><strong>Quick Win:</strong> ${rec.quickWin}</p>` : ''}
        `;
        quickWinsContainer.appendChild(recDiv);
    });
}

function upgradeToFreePlan() {
    window.location.href = 'auth.html';
}

function upgradeToPlan(plan, url) {
    const token = getAuthToken();
    if (!token) {
        // Store intended destination
        sessionStorage.setItem('loginRedirect', `checkout.html?plan=${plan}&url=${encodeURIComponent(url || '')}`);
        window.location.href = 'auth.html';
    } else {
        window.location.href = `checkout.html?plan=${plan}&url=${encodeURIComponent(url || '')}`;
    }
}

function resetForm() {
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const errorSection = document.getElementById('errorSection');
    const resultsSection = document.getElementById('resultsSection');
    const websiteUrl = document.getElementById('websiteUrl');
    const progressFill = document.getElementById('progressFill');
    
    if (inputSection) inputSection.style.display = 'block';
    if (loadingSection) loadingSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (websiteUrl) websiteUrl.value = '';
    if (progressFill) progressFill.style.width = '0%';
}

// CTA handlers
document.addEventListener('DOMContentLoaded', function() {
    const getReportBtn = document.getElementById('getFullReportBtn');
    const bookCallBtn = document.getElementById('bookCallBtn');
    
    if (getReportBtn) {
        getReportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('mailto:info@xeomarketing.com?subject=AI Visibility Report Request&body=Hi, I would like to request a detailed AI visibility analysis for my website. Here are my details:', '_blank');
        });
    }
    
    if (bookCallBtn) {
        bookCallBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://calendly.com/xeo-marketing/schedule-a-callback', '_blank');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const urlField = document.getElementById('page_url');
    if (urlField) {
        urlField.value = window.location.href;
    }
});