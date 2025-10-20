const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://your-production-domain.com/api';

let scanData = null;

// V5 Category Configuration (8 categories)
const CATEGORY_CONFIG = {
    aiReadability: {
        name: 'AI Readability & Multimodal',
        description: 'Alt text, captions, and accessible content for AI',
        icon: '👁️'
    },
    aiSearchReadiness: {
        name: 'AI Search Readiness',
        description: 'Content depth, FAQs, and snippet optimization',
        icon: '🔍'
    },
    contentFreshness: {
        name: 'Content Freshness',
        description: 'Update frequency and maintenance signals',
        icon: '🔄'
    },
    contentStructure: {
        name: 'Content Structure',
        description: 'Heading hierarchy and entity recognition',
        icon: '📋'
    },
    speedUX: {
        name: 'Speed & UX',
        description: 'Page performance and user experience',
        icon: '⚡'
    },
    technicalSetup: {
        name: 'Technical Setup',
        description: 'Structured data and crawler access',
        icon: '⚙️'
    },
    trustAuthority: {
        name: 'Trust & Authority',
        description: 'E-E-A-T signals and credibility',
        icon: '🏆'
    },
    voiceOptimization: {
        name: 'Voice Optimization',
        description: 'Conversational and voice search ready',
        icon: '🎤'
    }
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = checkAuth();
    
    if (!isAuthenticated) {
        alert('Please log in to view results');
        window.location.href = 'auth.html';
        return;
    }
    
    // Get scan ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId') || urlParams.get('id');
    
    if (!scanId) {
        showError('No scan ID provided');
        return;
    }
    
    // Load scan results
    await loadResults(scanId);
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('authToken');
    return !!token;
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Load scan results
async function loadResults(scanId) {
    try {
        const token = getAuthToken();
        
        const response = await fetch(`${API_BASE_URL}/scan/${scanId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Please log in again.');
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                window.location.href = 'auth.html';
                return;
            }
            throw new Error('Failed to load scan results');
        }
        
        const result = await response.json();
        scanData = result.scan;
        
        console.log('Loaded scan data:', scanData);
        
        // Display results
        displayResults(scanData);
        
    } catch (error) {
        console.error('Error loading results:', error);
        showError(error.message || 'Failed to load scan results');
    }
}

// Display results on the page
function displayResults(data) {
    // Hide loading, show results
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('resultsState').style.display = 'block';
    
    // Display header info
    const url = data.url || 'Unknown URL';
    try {
        const domain = new URL(url).hostname;
        document.getElementById('scanDomain').textContent = domain;
    } catch (e) {
        document.getElementById('scanDomain').textContent = url;
    }
    
    if (data.created_at) {
        const scanDate = new Date(data.created_at);
        document.getElementById('scanDate').textContent = `Scanned on: ${scanDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }
    
    // Display overall score (backend: 0-100, display: 0-1000)
    const overallScore = data.total_score * 10;
    document.getElementById('overallScore').textContent = Math.round(overallScore);
    
    // Display score message
    const scoreMessage = getScoreMessage(overallScore);
    document.getElementById('scoreMessage').textContent = scoreMessage;
    
    // Display category breakdown
    displayCategories(data);
}

// Get score message based on overall score (0-1000 scale)
function getScoreMessage(score) {
    if (score >= 900) return '🎉 Excellent! Your site is highly optimized for AI discovery';
    if (score >= 750) return '👍 Great job! Your site is well-optimized for AI search';
    if (score >= 600) return '👌 Good start! Some improvements will boost your AI visibility';
    if (score >= 450) return '💡 Room for growth. Follow the recommendations below';
    if (score >= 300) return '⚠️ Needs attention. Prioritize the key recommendations';
    return '🚨 Critical issues detected. Start with the fundamentals';
}

// Display category cards
function displayCategories(data) {
    const pillarsGrid = document.getElementById('pillarsGrid');
    pillarsGrid.innerHTML = '';
    
    const categories = data.categories || {};
    
    Object.keys(CATEGORY_CONFIG).forEach(categoryKey => {
        const categoryInfo = CATEGORY_CONFIG[categoryKey];
        const score = categories[categoryKey] || 0;
        
        // Get recommendations for this category
        const recommendations = (data.recommendations || [])
            .filter(rec => rec.category === categoryKey)
            .slice(0, 3);
        
        // Create category card
        const card = createCategoryCard(
            categoryInfo.icon,
            categoryInfo.name,
            categoryInfo.description,
            score,
            recommendations
        );
        
        pillarsGrid.appendChild(card);
    });
}

// Create individual category card
function createCategoryCard(icon, name, description, score, recommendations) {
    const card = document.createElement('div');
    card.className = 'pillar-card';
    
    // Determine score class (based on 0-100 scale)
    const scoreClass = getScoreClass(score);
    
    // Display score out of 1000 (multiply backend 0-100 by 10)
    const displayScore = Math.round(score * 10);
    
    // Calculate percentage for progress bar (still use 0-100)
    const percentage = score;
    
    card.innerHTML = `
        <div class="pillar-header">
            <div class="pillar-title">${icon} ${name}</div>
            <div class="pillar-score ${scoreClass}">${displayScore}/1000</div>
        </div>
        
        <div class="pillar-progress">
            <div class="pillar-progress-bar" style="width: ${percentage}%"></div>
        </div>
        
        <div class="pillar-description">${description}</div>
        
        ${recommendations && recommendations.length > 0 ? `
            <div class="pillar-recommendations">
                <h4>💡 Top Recommendations:</h4>
                <ul>
                    ${recommendations.map(rec => `
                        <li>${rec.title || rec.recommendation_text || 'Improve this area'}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Get score class for color coding (0-100 scale)
function getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
}

// Show error state
function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

// Start new scan
function startNewScan() {
    window.location.href = 'dashboard.html';
}