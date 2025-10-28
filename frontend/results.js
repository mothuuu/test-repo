// Enhanced results.js - FIXED to match actual API response structure

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

// Get scan ID from URL
const urlParams = new URLSearchParams(window.location.search);
const scanId = urlParams.get('scanId');

// Check authentication
const authToken = localStorage.getItem('authToken');
const userData = JSON.parse(localStorage.getItem('user') || '{}');

if (!scanId) {
    window.location.href = 'dashboard.html';
}

// Priority color mapping
const priorityColors = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' }
};

// Category icons mapping
const categoryIcons = {
    aiReadability: '📖',
    aiSearchReadiness: '🔍',
    technicalSetup: '⚙️',
    contentStructure: '📋',
    entityStrength: '🏢',
    trustAuthority: '⭐',
    voiceOptimization: '👥',
    contentFreshness: '🎯',
    speedUX: '⚡'
};

// Category name mapping
const categoryNames = {
    aiReadability: 'AI Readability',
    aiSearchReadiness: 'AI Search Readiness',
    technicalSetup: 'Technical Setup',
    contentStructure: 'Content Structure',
    entityStrength: 'Entity Strength',
    trustAuthority: 'Trust Authority',
    voiceOptimization: 'Voice Optimization',
    contentFreshness: 'Content Freshness',
    speedUX: 'Speed UX'
};

// Load and display scan results
async function loadScanResults() {
    try {
        const headers = authToken 
            ? { 'Authorization': `Bearer ${authToken}` }
            : {};

        const response = await fetch(`${API_BASE_URL}/scan/${scanId}`, { headers });
        
        if (!response.ok) {
            throw new Error('Failed to load scan results');
        }

        const data = await response.json();
        
        if (data.success) {
            displayResults(data.scan, data.quota);
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error loading results:', error);
        showError('Failed to load scan results. Please try again.');
    }
}

function displayResults(scan, quota) {
    console.log('Scan data:', scan); // Debug log

    // Determine user tier (guest, free, diy, pro)
    const userTier = authToken ? (userData.plan || 'free') : 'guest';

    // Update header info
    document.getElementById('scanUrl').textContent = scan.url;
    document.getElementById('scanDate').textContent = new Date(scan.created_at).toLocaleDateString();

    // Display overall score (convert 0-100 to 0-1000)
    const displayScore = Math.round(scan.total_score * 10);
    document.getElementById('overallScore').textContent = displayScore;

    // Update score circle color
    const scoreCircle = document.getElementById('scoreCircle');
    if (displayScore >= 750) {
        scoreCircle.classList.add('text-green-600');
    } else if (displayScore >= 500) {
        scoreCircle.classList.add('text-yellow-600');
    } else {
        scoreCircle.classList.add('text-red-600');
    }

    // Display user plan and quota
    if (userData.plan) {
        document.getElementById('userPlan').textContent = userData.plan.toUpperCase();
        if (quota) {
            document.getElementById('scanQuota').textContent = `${quota.used}/${quota.limit} scans used`;
        }
    }

    // Display category scores
    if (scan.categoryBreakdown) {
        displayCategoryScores(scan.categoryBreakdown, scan.recommendations || []);
    }

    // Display recommendations based on tier and scan type
    if (scan.is_competitor || scan.domain_type === 'competitor') {
        // Competitor scan - show info message instead of recommendations
        displayCompetitorScanMessage(scan);
    } else if (userTier === 'guest') {
        // Guest: Show NO recommendations, only signup CTA
        displayGuestRecommendations(scan);
    } else if (scan.recommendations && scan.recommendations.length > 0) {
        // Authenticated: Show recommendations based on plan
        displayRecommendations(scan.recommendations, userTier, scan.userProgress, scan.nextBatchUnlock, scan.batchesUnlocked);
    } else {
        document.getElementById('recommendationsList').innerHTML = '<p class="text-gray-500 text-center py-8">No recommendations available for this scan.</p>';
    }

    // Display FAQ section (DIY+ only)
    if (scan.faq && userTier !== 'free' && userTier !== 'guest') {
        displayFAQSection(scan.faq);
    }

    // Display upgrade CTA based on tier
    displayUpgradeCTA(userTier, scan.recommendations ? scan.recommendations.length : 0);

    // Show export options for DIY+
    if (userTier !== 'free' && userTier !== 'guest') {
        document.getElementById('exportSection')?.classList.remove('hidden');
    }
}

function displayCategoryScores(categories, recommendations) {
    const container = document.getElementById('categoryScores');
    container.innerHTML = '';

    Object.entries(categories).forEach(([categoryKey, score]) => {
        const displayScore = Math.round(score * 10); // Convert to 0-1000
        const categoryName = categoryNames[categoryKey] || formatCategoryName(categoryKey);
        const icon = categoryIcons[categoryKey] || '📊';
        
        // Get top 3 recommendations for this category
        const categoryRecs = recommendations
            .filter(rec => rec.category === categoryKey)
            .slice(0, 3);

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">${icon}</span>
                    <h3 class="font-bold text-lg">${categoryName}</h3>
                </div>
                <span class="text-2xl font-bold ${getScoreColor(displayScore)}">${displayScore}/1000</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div class="h-2 rounded-full ${getScoreBarColor(displayScore)}" style="width: ${score}%"></div>
            </div>
            ${categoryRecs.length > 0 ? `
                <div class="mt-3 space-y-2">
                    <p class="text-sm font-semibold text-gray-700">Top Priorities:</p>
                    ${categoryRecs.map(rec => `
                        <div class="text-sm text-gray-600 pl-2 border-l-2 ${priorityColors[rec.priority]?.border || 'border-gray-300'}">
                            • ${rec.recommendation_text || rec.title || 'Recommendation'}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

// Guest recommendations - show signup CTA instead of recommendations
function displayCompetitorScanMessage(scan) {
    const container = document.getElementById('recommendationsList');
    container.innerHTML = `
        <div class="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-12 text-center border-2 border-orange-300">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">Competitor Scan Complete</h3>
            <p class="text-gray-700 mb-6 max-w-2xl mx-auto">
                This is a <span class="font-bold text-orange-600">competitor domain scan</span>.
                Your primary domain is <span class="font-bold text-blue-600">${scan.primary_domain}</span>.
            </p>
            <div class="bg-white rounded-lg p-6 mb-6 max-w-xl mx-auto border border-orange-200">
                <h4 class="font-bold text-lg mb-3 text-gray-900">Competitor Scan Includes:</h4>
                <div class="text-left mx-auto" style="max-width: 300px;">
                    <div class="flex items-center gap-2 text-green-600 font-semibold mb-2">
                        <span>✅</span> <span>AI Visibility Score</span>
                    </div>
                    <div class="flex items-center gap-2 text-green-600 font-semibold mb-2">
                        <span>✅</span> <span>8 Category Scores</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-400 font-semibold mb-2 line-through">
                        <span>❌</span> <span>Recommendations</span>
                    </div>
                    <div class="flex items-center gap-2 text-gray-400 font-semibold line-through">
                        <span>❌</span> <span>Implementation Guidance</span>
                    </div>
                </div>
            </div>
            <p class="text-sm text-gray-600 mb-4">
                To get recommendations and implementation guidance, scan your primary domain:
                <span class="font-bold text-blue-600">${scan.primary_domain}</span>
            </p>
            <a href="dashboard.html"
               class="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-full text-lg hover:shadow-xl transition-all transform hover:scale-105">
                ← Back to Dashboard
            </a>
        </div>
    `;
}

function displayGuestRecommendations(scan) {
    const container = document.getElementById('recommendationsList');
    container.innerHTML = `
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-12 text-center border-2 border-blue-200">
            <div class="text-6xl mb-4">🔒</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-4">Sign Up to Unlock Your Top 3 Recommendations</h3>
            <p class="text-gray-600 mb-6 max-w-2xl mx-auto">
                Your AI Visibility Score is <span class="font-bold text-purple-600">${Math.round(scan.total_score * 10)}/1000</span>.
                Sign up for free to see exactly what to fix and how to improve your ranking in AI search engines.
            </p>
            <div class="flex justify-center gap-4 mb-6">
                <div class="text-left">
                    <div class="flex items-center gap-2 text-green-600 font-semibold mb-2">
                        <span>✓</span> <span>Top 3 Priority Recommendations</span>
                    </div>
                    <div class="flex items-center gap-2 text-green-600 font-semibold mb-2">
                        <span>✓</span> <span>Detailed Action Steps</span>
                    </div>
                    <div class="flex items-center gap-2 text-green-600 font-semibold">
                        <span>✓</span> <span>Track Progress Over Time</span>
                    </div>
                </div>
            </div>
            <a href="auth.html?mode=signup&scanId=${scanId}"
               class="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-full text-lg hover:shadow-xl transition-all transform hover:scale-105">
                Sign Up Free - No Credit Card Required →
            </a>
            <p class="text-sm text-gray-500 mt-4">Already have an account? <a href="auth.html?mode=login" class="text-purple-600 font-semibold hover:underline">Sign In</a></p>
        </div>
    `;
}

function displayRecommendations(recommendations, userTier, userProgress, nextBatchUnlock, batchesUnlocked) {
    const container = document.getElementById('recommendationsList');
    container.innerHTML = '';

    console.log('Displaying recommendations:', recommendations); // Debug log
    console.log('User tier:', userTier);
    console.log('User progress:', userProgress);
    console.log('Next batch unlock:', nextBatchUnlock);
    console.log('Batches just unlocked:', batchesUnlocked);

    // Show batch unlock notification if batches were just unlocked
    if (batchesUnlocked && batchesUnlocked > 0) {
        const notification = document.createElement('div');
        notification.className = 'mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-300';
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-4xl">🎉</span>
                <div>
                    <h3 class="text-xl font-bold text-gray-900 mb-1">New Recommendations Unlocked!</h3>
                    <p class="text-gray-700">
                        Batch ${batchesUnlocked} has been automatically unlocked.
                        ${nextBatchUnlock ? `Next batch unlocks in ${nextBatchUnlock.daysRemaining} day${nextBatchUnlock.daysRemaining !== 1 ? 's' : ''}.` : 'All batches unlocked!'}
                    </p>
                </div>
            </div>
        `;
        container.appendChild(notification);
    }

    // Show batch countdown timer if next batch is available
    if (nextBatchUnlock && nextBatchUnlock.daysRemaining > 0) {
        const countdownTimer = document.createElement('div');
        countdownTimer.className = 'mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200';
        countdownTimer.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">⏰</span>
                    <div>
                        <h4 class="font-bold text-gray-900">Next Batch Unlock</h4>
                        <p class="text-sm text-gray-600">
                            ${nextBatchUnlock.recommendationsInBatch} more recommendations unlock in
                            <span class="font-bold text-purple-600">${nextBatchUnlock.daysRemaining} day${nextBatchUnlock.daysRemaining !== 1 ? 's' : ''}</span>
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-purple-600">${nextBatchUnlock.daysRemaining}</div>
                    <div class="text-xs text-gray-600">days left</div>
                </div>
            </div>
        `;
        container.appendChild(countdownTimer);
    }

    // Separate active and skipped recommendations
    const activeRecs = recommendations.filter(rec => !rec.skipped_at && rec.unlock_state !== 'locked');
    const skippedRecs = recommendations.filter(rec => rec.skipped_at);
    const lockedRecs = recommendations.filter(rec => rec.unlock_state === 'locked');

    // Determine how many active recommendations to show based on tier
    let displayRecs;
    if (userTier === 'free') {
        // Free: Top 3 only
        displayRecs = activeRecs.slice(0, 3);
    } else if (userTier === 'diy' && userProgress) {
        // DIY: Show based on active_recommendations count
        const activeCount = userProgress.active_recommendations || 5;
        displayRecs = activeRecs.slice(0, activeCount);
    } else {
        // Pro: All active recommendations
        displayRecs = activeRecs;
    }

    // Create tab interface if there are skipped recommendations
    if (skippedRecs.length > 0) {
        const tabsHTML = `
            <div class="mb-6 border-b border-gray-200">
                <div class="flex gap-4">
                    <button onclick="switchTab('active')" id="tab-active"
                            class="tab-button px-6 py-3 font-semibold border-b-2 border-blue-600 text-blue-600">
                        Active (${displayRecs.length})
                    </button>
                    <button onclick="switchTab('skipped')" id="tab-skipped"
                            class="tab-button px-6 py-3 font-semibold text-gray-500 hover:text-gray-700">
                        Skipped (${skippedRecs.length})
                    </button>
                </div>
            </div>
            <div id="tab-content-active" class="tab-content"></div>
            <div id="tab-content-skipped" class="tab-content hidden"></div>
        `;
        container.innerHTML = tabsHTML;
    }

    // Get containers for active and skipped
    const activeContainer = document.getElementById('tab-content-active') || container;
    const skippedContainer = document.getElementById('tab-content-skipped');

    if (displayRecs.length === 0 && skippedRecs.length === 0) {
        activeContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No recommendations available for this scan.</p>';
        return;
    }

    // Display active recommendations
    if (displayRecs.length > 0) {
        displayRecs.forEach((rec, index) => {
            const recCard = createRecommendationCard(rec, index, userTier);
            activeContainer.appendChild(recCard);
        });
    } else if (activeRecs.length === 0) {
        activeContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No active recommendations. Check the Skipped tab.</p>';
    }

    // Display skipped recommendations
    if (skippedContainer && skippedRecs.length > 0) {
        skippedRecs.forEach((rec, index) => {
            const recCard = createRecommendationCard(rec, index + displayRecs.length, userTier, true);
            skippedContainer.appendChild(recCard);
        });
    }

    // Show DIY unlock button if applicable (only in active tab)
    if (userTier === 'diy' && userProgress) {
        const activeCount = userProgress.active_recommendations || 5;
        const totalCount = userProgress.total_recommendations || recommendations.length;
        const canUnlockMore = userProgress.unlocks_today < 5 && activeCount < totalCount;

        if (activeCount < totalCount) {
            displayUnlockButton(activeCount, totalCount, canUnlockMore, userProgress);
        }
    }

    // Show upgrade message if free tier (only in active tab)
    if (userTier === 'free' && recommendations.length > 3) {
        const upgradeMsg = document.createElement('div');
        upgradeMsg.className = 'mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 text-center';
        upgradeMsg.innerHTML = `
            <h3 class="text-xl font-bold mb-2">🔒 ${recommendations.length - 5} More Recommendations Available</h3>
            <p class="text-gray-700 mb-4">Upgrade to DIY Starter to unlock all recommendations, FAQ generation, and unlimited scans.</p>
            <a href="checkout.html?url=${encodeURIComponent(document.getElementById('scanUrl').textContent)}"
               class="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all">
                Upgrade to DIY - $29/month
            </a>
        `;
        activeContainer.appendChild(upgradeMsg);
    }
}

// Tab switching function
function switchTab(tabName) {
    // Update tab button styles
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });

    const activeTabBtn = document.getElementById(`tab-${tabName}`);
    if (activeTabBtn) {
        activeTabBtn.classList.remove('text-gray-500');
        activeTabBtn.classList.add('border-blue-600', 'text-blue-600', 'border-b-2');
    }

    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Show selected tab content
    const selectedContent = document.getElementById(`tab-content-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }
}

// Display unlock button for DIY users
function displayUnlockButton(activeCount, totalCount, canUnlockMore, userProgress) {
    const container = document.getElementById('recommendationsList');
    const remaining = totalCount - activeCount;
    const toUnlock = Math.min(5, remaining);

    const unlockCard = document.createElement('div');
    unlockCard.className = 'mt-6 p-8 bg-gradient-to-r from-cyan-50 to-purple-50 rounded-lg border-2 border-cyan-300 text-center';

    if (canUnlockMore) {
        unlockCard.innerHTML = `
            <div class="text-5xl mb-4">🎁</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Unlock ${toUnlock} More Recommendations</h3>
            <p class="text-gray-700 mb-4">
                You've unlocked ${activeCount} of ${totalCount} recommendations.
                Unlock ${toUnlock} more today to keep improving your AI visibility!
            </p>
            <p class="text-sm text-gray-600 mb-4">
                Daily unlocks: ${userProgress.unlocks_today || 0}/5 used today
            </p>
            <button onclick="unlockMoreRecommendations()"
                    class="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-full text-lg hover:shadow-xl transition-all transform hover:scale-105">
                Unlock ${toUnlock} More Recommendations →
            </button>
        `;
    } else {
        // Daily limit reached
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        unlockCard.innerHTML = `
            <div class="text-5xl mb-4">⏰</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Daily Unlock Limit Reached</h3>
            <p class="text-gray-700 mb-4">
                You've unlocked ${activeCount} of ${totalCount} recommendations.
                You've used all 5 daily unlocks. Come back tomorrow to unlock more!
            </p>
            <p class="text-sm text-purple-600 font-semibold">
                Next unlock available: ${tomorrow.toLocaleDateString()} at midnight
            </p>
        `;
    }

    container.appendChild(unlockCard);
}

// Unlock more recommendations (DIY tier)
async function unlockMoreRecommendations() {
    try {
        const response = await fetch(`${API_BASE_URL}/scan/${scanId}/unlock`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            // Show success message
            alert(`✅ ${data.message}\nYou now have ${data.progress.active_recommendations} recommendations unlocked!`);
            // Reload page to show new recommendations
            window.location.reload();
        } else {
            alert(`❌ ${data.error || 'Failed to unlock recommendations'}`);
        }
    } catch (error) {
        console.error('Unlock error:', error);
        alert('❌ Failed to unlock recommendations. Please try again.');
    }
}

// Update upgrade CTA function
function displayUpgradeCTA(userTier, totalRecs) {
    const container = document.getElementById('upgradeCTA');
    if (!container) return;

    if (userTier === 'guest') {
        // Already shown in recommendations section
        return;
    }

    if (userTier === 'free') {
        container.innerHTML = `
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-8 text-center">
                <h3 class="text-2xl font-bold mb-4">Upgrade to DIY Starter</h3>
                <p class="mb-6">Get 5-page deep scans, personalized code, and daily recommendation unlocks</p>
                <a href="checkout.html?plan=diy" class="inline-block px-8 py-3 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transition-all">
                    Upgrade to DIY - $29/month →
                </a>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (userTier === 'diy') {
        container.innerHTML = `
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-8 text-center">
                <h3 class="text-2xl font-bold mb-4">Coming Soon: Pro Tier</h3>
                <p class="mb-6">Triple Score Analysis: AI Visibility + Brand Visibility + Competitive Analysis</p>
                <a href="waitlist.html?plan=pro" class="inline-block px-8 py-3 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-100 transition-all">
                    Join Pro Waitlist - $99/month →
                </a>
            </div>
        `;
        container.classList.remove('hidden');
    }
}

function createRecommendationCard(rec, index, userPlan, isSkipped = false) {
    const card = document.createElement('div');
    const cardClass = isSkipped
        ? 'bg-gray-50 rounded-lg shadow-md border-l-4 border-gray-400 overflow-hidden opacity-75'
        : `recommendation-card bg-white rounded-lg shadow-md border-l-4 ${priorityColors[rec.priority]?.border || 'border-gray-300'} overflow-hidden`;
    card.className = cardClass;
    card.id = `rec-${index}`;

    const priorityClass = priorityColors[rec.priority] || priorityColors.medium;
    const showCodeSnippet = userPlan !== 'free' && rec.code_snippet;

    // Check if implemented or skipped
    const isImplemented = rec.status === 'implemented';

    // Check if skip is enabled (5 days after unlock)
    const now = new Date();
    const skipEnabledAt = rec.skip_enabled_at ? new Date(rec.skip_enabled_at) : null;
    const canSkip = !isSkipped && !isImplemented && (!skipEnabledAt || skipEnabledAt <= now);
    const daysUntilSkip = skipEnabledAt && skipEnabledAt > now
        ? Math.ceil((skipEnabledAt - now) / (1000 * 60 * 60 * 24))
        : 0;

    // Use the correct field names from API
    const title = rec.recommendation_text || rec.title || 'Recommendation';
    const finding = rec.findings || rec.finding || '';
    const impact = rec.impact_description || rec.impact || '';
    const actionSteps = rec.action_steps || rec.actionSteps || [];
    const codeSnippet = rec.code_snippet || rec.codeSnippet || '';
    const estimatedImpact = rec.estimated_impact || rec.estimatedScoreGain || 0;
    const effort = rec.estimated_effort || rec.effort || '';

    // NEW STRUCTURED FIELDS
    const customizedImplementation = rec.customized_implementation || rec.customizedImplementation || '';
    const readyToUseContent = rec.ready_to_use_content || rec.readyToUseContent || '';
    const implementationNotes = rec.implementation_notes || rec.implementationNotes || [];
    const quickWins = rec.quick_wins || rec.quickWins || [];
    const validationChecklist = rec.validation_checklist || rec.validationChecklist || [];

    card.innerHTML = `
        <div class="p-6">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        ${isImplemented ? `
                            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border-2 border-green-500">
                                ✓ IMPLEMENTED
                            </span>
                        ` : ''}
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${priorityClass.bg} ${priorityClass.text}">
                            ${(rec.priority || 'medium').toUpperCase()}
                        </span>
                        <span class="text-sm text-gray-600">${formatCategoryName(rec.category)}</span>
                        ${effort ? `<span class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">${effort} Effort</span>` : ''}
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${title}</h3>
                    ${estimatedImpact ? `
                        <div class="flex items-center gap-2 text-green-600 font-semibold">
                            <span>📈</span>
                            <span>Potential Gain: +${Math.round(estimatedImpact * 10)} points</span>
                        </div>
                    ` : ''}
                </div>
                <button onclick="toggleRecommendation(${index})"
                        class="text-blue-600 hover:text-blue-800 font-semibold">
                    <span id="toggle-${index}">Expand ▼</span>
                </button>
            </div>

            <!-- Collapsible Content -->
            <div id="content-${index}" class="hidden mt-4 space-y-4 border-t pt-4">
                <!-- Finding -->
                ${finding ? `
                    <div>
                        <h4 class="font-bold text-gray-800 mb-2">🔍 Finding:</h4>
                        <p class="text-gray-700 leading-relaxed whitespace-pre-line">${finding}</p>
                    </div>
                ` : ''}

                <!-- Impact -->
                ${impact ? `
                    <div>
                        <h4 class="font-bold text-gray-800 mb-2">💡 Why It Matters:</h4>
                        <p class="text-gray-700 leading-relaxed whitespace-pre-line">${impact}</p>
                    </div>
                ` : ''}

                <!-- Action Steps -->
                ${actionSteps && actionSteps.length > 0 ? `
                    <div>
                        <h4 class="font-bold text-gray-800 mb-3">✅ What to Do (Apply Steps):</h4>
                        <ol class="space-y-2">
                            ${actionSteps.map(step => `
                                <li class="text-gray-700 leading-relaxed ml-2">${step}</li>
                            `).join('')}
                        </ol>
                    </div>
                ` : ''}

                <!-- Customized Implementation -->
                ${customizedImplementation && userPlan !== 'free' ? `
                    <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                        <h4 class="font-bold text-gray-800 mb-3">🎯 Customized Implementation for Your Page:</h4>
                        <div class="prose prose-sm max-w-none text-gray-700">
                            ${renderMarkdown(customizedImplementation)}
                        </div>
                    </div>
                ` : ''}

                <!-- Ready to Use Content -->
                ${readyToUseContent && userPlan !== 'free' ? `
                    <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <h4 class="font-bold text-gray-800 mb-3">📝 Ready-to-Use Content:</h4>
                        <div class="relative">
                            <pre class="bg-white border border-green-200 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap font-sans text-gray-800"><code id="ready-content-${index}">${escapeHtml(readyToUseContent)}</code></pre>
                            <button onclick="copyCode('ready-content-${index}')"
                                    class="absolute top-2 right-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                Copy Content
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Code Snippet (DIY+ only) -->
                ${showCodeSnippet ? `
                    <div>
                        <h4 class="font-bold text-gray-800 mb-2">💻 Implementation Code:</h4>
                        <div class="relative">
                            <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"><code id="code-${index}">${escapeHtml(codeSnippet)}</code></pre>
                            <button onclick="copyCode('code-${index}')"
                                    class="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                Copy Code
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Implementation Notes -->
                ${implementationNotes && implementationNotes.length > 0 && userPlan !== 'free' ? `
                    <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                        <h4 class="font-bold text-gray-800 mb-3">📌 Implementation Notes:</h4>
                        <ul class="space-y-2">
                            ${implementationNotes.map(note => `
                                <li class="text-gray-700 leading-relaxed flex items-start">
                                    <span class="text-yellow-600 mr-2">•</span>
                                    <span>${note}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Quick Wins -->
                ${quickWins && quickWins.length > 0 && userPlan !== 'free' ? `
                    <div class="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                        <h4 class="font-bold text-gray-800 mb-3">⚡ Quick Wins:</h4>
                        <ol class="space-y-2">
                            ${quickWins.map((win, idx) => `
                                <li class="text-gray-700 leading-relaxed flex items-start">
                                    <span class="text-purple-600 font-semibold mr-2">${idx + 1}.</span>
                                    <span>${win}</span>
                                </li>
                            `).join('')}
                        </ol>
                    </div>
                ` : ''}

                <!-- Validation Checklist -->
                ${validationChecklist && validationChecklist.length > 0 && userPlan !== 'free' ? `
                    <div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded">
                        <h4 class="font-bold text-gray-800 mb-3">✓ Validation Checklist:</h4>
                        <ul class="space-y-2">
                            ${validationChecklist.map(item => `
                                <li class="text-gray-700 leading-relaxed flex items-start">
                                    <input type="checkbox" class="mt-1 mr-3 w-4 h-4 text-indigo-600 rounded">
                                    <span>${item}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Action Buttons -->
                <div class="pt-4 border-t flex gap-3 flex-wrap">
                    ${isImplemented ? `
                        <div class="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold flex items-center gap-2">
                            <span>✓</span>
                            <span>Implemented on ${new Date(rec.implemented_at).toLocaleDateString()}</span>
                        </div>
                    ` : !isSkipped ? `
                        <button onclick="markImplemented(${rec.id || index})"
                                class="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors font-semibold">
                            ✓ Mark as Implemented
                        </button>
                        ${canSkip ? `
                            <button onclick="skipRecommendation(${rec.id || index})"
                                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold">
                                ⊘ Skip this recommendation
                            </button>
                        ` : daysUntilSkip > 0 ? `
                            <button disabled
                                    class="px-4 py-2 bg-gray-50 text-gray-400 rounded-lg cursor-not-allowed font-semibold"
                                    title="Skip will be available in ${daysUntilSkip} day${daysUntilSkip > 1 ? 's' : ''}">
                                ⊘ Skip (Available in ${daysUntilSkip}d)
                            </button>
                        ` : ''}
                    ` : `
                        <div class="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-semibold">
                            ⊘ Skipped on ${new Date(rec.skipped_at).toLocaleDateString()}
                        </div>
                    `}
                </div>

                <!-- Feedback Widget -->
                ${createFeedbackWidget(
                    `${rec.category || 'general'}_${rec.id || index}`,
                    rec.category || 'general',
                    scanId
                )}
            </div>
        </div>
    `;

    return card;
}

function displayFAQSection(faqData) {
    const faqSection = document.getElementById('faqSection');
    if (!faqSection) return;

    faqSection.classList.remove('hidden');
    const container = document.getElementById('faqList');
    container.innerHTML = '';

    // Display FAQ cards
    if (faqData.faqs && faqData.faqs.length > 0) {
        faqData.faqs.forEach((faq, index) => {
            const faqCard = document.createElement('div');
            faqCard.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow';
            faqCard.innerHTML = `
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">❓</span>
                    <div class="flex-1">
                        <h4 class="font-bold text-lg text-gray-900 mb-2">${faq.question}</h4>
                        <p class="text-gray-700 leading-relaxed">${faq.answer_human_friendly?.text || faq.answer}</p>
                    </div>
                </div>
            `;
            container.appendChild(faqCard);
        });
    }

    // Display schema code
    if (faqData.fullSchemaCode) {
        const schemaContainer = document.getElementById('schemaCode');
        schemaContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-lg">📋 Complete FAQ Schema Code</h4>
                    <button onclick="copySchemaCode()" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                        Copy Schema
                    </button>
                </div>
                <textarea id="schemaCodeText" readonly 
                          class="w-full h-64 p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-sm resize-none">${escapeHtml(faqData.fullSchemaCode)}</textarea>
                <div class="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p class="text-sm text-gray-700">
                        <strong>Implementation:</strong> Copy the code above and paste it into the <code class="bg-gray-200 px-2 py-1 rounded">&lt;head&gt;</code> 
                        section of your website. This structured data helps AI search engines understand your content better.
                    </p>
                </div>
            </div>
        `;
    }
}

function displayUpgradeCTA(upgradeData, userPlan) {
    const upgradeSection = document.getElementById('upgradeSection');
    if (!upgradeSection || !upgradeData.show) return;

    upgradeSection.classList.remove('hidden');
    
    let ctaContent = '';

    if (upgradeData.comingSoon) {
        // Premium/Agency - Coming Soon
        ctaContent = `
            <div class="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg p-8 border-2 border-purple-200">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <span class="inline-block px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold mb-3">
                            COMING SOON
                        </span>
                        <h3 class="text-2xl font-bold text-gray-900 mb-2">${upgradeData.title || 'Premium Plan'}</h3>
                        <p class="text-gray-700">${upgradeData.subtitle || 'Advanced AI visibility analysis for growing businesses'}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-4xl font-bold text-purple-600">$99</div>
                        <div class="text-sm text-gray-600">/month</div>
                    </div>
                </div>
                
                ${upgradeData.benefits && upgradeData.benefits.length > 0 ? `
                    <div class="mb-6">
                        <h4 class="font-bold text-gray-800 mb-3">What's Included:</h4>
                        <ul class="grid md:grid-cols-2 gap-2">
                            ${upgradeData.benefits.map(benefit => `
                                <li class="flex items-center gap-2 text-gray-700">
                                    <span class="text-green-600">✓</span>
                                    <span>${benefit}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="flex gap-4">
                    <a href="/waitlist.html?plan=premium" 
                       class="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold text-center hover:from-purple-700 hover:to-indigo-700 transition-all">
                        Join Waitlist - Get Notified
                    </a>
                    <button onclick="document.getElementById('upgradeSection').classList.add('hidden')" 
                            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                        Maybe Later
                    </button>
                </div>
            </div>
        `;
    } else {
        // DIY Upgrade (for free users)
        ctaContent = `
            <div class="bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl shadow-lg p-8 border-2 border-blue-200">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">Unlock Full AI Visibility Analysis</h3>
                <p class="text-gray-700 mb-4">Get detailed recommendations, FAQ generation, and unlimited scans</p>
                
                <div class="mb-6">
                    <div class="flex items-baseline gap-2 mb-4">
                        <span class="text-4xl font-bold text-blue-600">$29</span>
                        <span class="text-gray-600">/month</span>
                    </div>
                    <ul class="space-y-2">
                        <li class="flex items-center gap-2 text-gray-700">
                            <span class="text-green-600">✓</span>
                            <span>Track 5 specific pages with unlimited scans</span>
                        </li>
                        <li class="flex items-center gap-2 text-gray-700">
                            <span class="text-green-600">✓</span>
                            <span>15+ detailed recommendations per scan</span>
                        </li>
                        <li class="flex items-center gap-2 text-gray-700">
                            <span class="text-green-600">✓</span>
                            <span>Custom FAQ generation with schema code</span>
                        </li>
                        <li class="flex items-center gap-2 text-gray-700">
                            <span class="text-green-600">✓</span>
                            <span>PDF export and progress tracking</span>
                        </li>
                    </ul>
                </div>

                <a href="checkout.html?url=${encodeURIComponent(document.getElementById('scanUrl')?.textContent || '')}" 
                   class="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-lg font-semibold text-center hover:from-blue-700 hover:to-teal-700 transition-all">
                    Upgrade to DIY Starter - $29/month
                </a>
            </div>
        `;
    }

    upgradeSection.innerHTML = ctaContent;
}

// Helper Functions
function toggleRecommendation(index) {
    const content = document.getElementById(`content-${index}`);
    const toggle = document.getElementById(`toggle-${index}`);

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        toggle.textContent = 'Collapse ▲';

        // Track expansion (implicit engagement signal)
        if (typeof startTrackingTime === 'function') {
            startTrackingTime(`rec-${index}`);
        }
        if (typeof trackInteraction === 'function') {
            trackInteraction(`rec-${index}`, scanId, { expanded: true });
        }
    } else {
        content.classList.add('hidden');
        toggle.textContent = 'Expand ▼';

        // Track time spent when collapsing
        if (typeof stopTrackingTime === 'function') {
            stopTrackingTime(`rec-${index}`, scanId);
        }
    }
}

function copyCode(elementId) {
    const codeElement = document.getElementById(elementId);
    if (codeElement) {
        navigator.clipboard.writeText(codeElement.textContent);
        alert('Code copied to clipboard!');

        // Track code copy interaction
        const recIndex = elementId.match(/\d+/)?.[0];
        if (recIndex && typeof trackCodeCopy === 'function') {
            trackCodeCopy(`rec-${recIndex}`, scanId);
        }
    }
}

function copySchemaCode() {
    const schemaText = document.getElementById('schemaCodeText');
    if (schemaText) {
        schemaText.select();
        document.execCommand('copy');
        alert('Schema code copied to clipboard!');
    }
}

async function markImplemented(recId) {
    console.log('Marking recommendation as implemented:', recId);

    if (!authToken) {
        alert('You must be logged in to mark recommendations as implemented.');
        return;
    }

    const confirmed = await showConfirmModal(
        'Mark as Implemented',
        'Mark this recommendation as implemented? This will help track your progress and improve future recommendations.'
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scan/${scanId}/recommendation/${recId}/feedback`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'implemented'
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Great work! This recommendation has been marked as implemented.\n\nYour progress is being tracked to help improve future recommendations.');
            // Reload page to update UI
            window.location.reload();
        } else {
            alert(`❌ ${data.error || 'Failed to mark as implemented'}`);
        }
    } catch (error) {
        console.error('Mark implemented error:', error);
        alert('❌ Failed to mark recommendation as implemented. Please try again.');
    }
}

async function skipRecommendation(recId) {
    console.log('Skipping recommendation:', recId);

    if (!authToken) {
        alert('You must be logged in to skip recommendations.');
        return;
    }

    const confirmed = await showConfirmModal(
        'Skip Recommendation',
        'Are you sure you want to skip this recommendation? You can view skipped recommendations in the "Skipped" tab.'
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scan/${scanId}/recommendation/${recId}/skip`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ ' + data.message);
            // Reload page to update UI
            window.location.reload();
        } else {
            alert(`❌ ${data.error || 'Failed to skip recommendation'}\n${data.message || ''}`);
        }
    } catch (error) {
        console.error('Skip error:', error);
        alert('❌ Failed to skip recommendation. Please try again.');
    }
}

function formatCategoryName(key) {
    return categoryNames[key] || key.replace(/([A-Z])/g, ' $1').trim();
}

function getScoreColor(score) {
    if (score >= 750) return 'text-green-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-red-600';
}

function getScoreBarColor(score) {
    if (score >= 750) return 'bg-green-500';
    if (score >= 500) return 'bg-yellow-500';
    return 'bg-red-500';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple markdown renderer for customizedImplementation
function renderMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')

        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')

        // Code blocks
        .replace(/```html\n([\s\S]*?)\n```/gim, '<pre class="bg-gray-900 text-gray-100 p-3 rounded my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
        .replace(/```([\s\S]*?)```/gim, '<pre class="bg-gray-900 text-gray-100 p-3 rounded my-2 overflow-x-auto text-xs"><code>$1</code></pre>')

        // Inline code
        .replace(/`([^`]+)`/gim, '<code class="bg-gray-200 px-2 py-1 rounded text-sm">$1</code>')

        // Horizontal rules
        .replace(/^---$/gim, '<hr class="my-4 border-gray-300">')

        // Paragraphs (simple - just add breaks for double newlines)
        .replace(/\n\n/gim, '<br><br>')
        .replace(/\n/gim, '<br>');

    return html;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="font-bold">Error:</span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadScanResults);