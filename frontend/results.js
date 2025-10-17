const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://your-production-domain.com';

let scanData = null;

// Pillar display configuration
const PILLAR_CONFIG = {
    schema: {
        name: 'Schema Markup',
        description: 'Structured data that helps AI understand your content'
    },
    entities: {
        name: 'Entity Recognition',
        description: 'Clear identification of people, places, and things'
    },
    faqs: {
        name: 'FAQ Content',
        description: 'Question-answer format that AI models prefer'
    },
    citations: {
        name: 'Citations & Sources',
        description: 'Credible references and authoritative links'
    },
    crawlability: {
        name: 'Crawlability',
        description: 'Technical accessibility for AI crawlers'
    },
    speed: {
        name: 'Page Speed',
        description: 'Fast loading times for better AI indexing'
    },
    trust: {
        name: 'Trust Signals',
        description: 'Security and credibility indicators'
    },
    aeo: {
        name: 'AEO Content',
        description: 'Answer Engine Optimized content structure'
    }
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
        alert('Please log in to view results');
        window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
    }
    
    // Get scan ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');
    
    if (!scanId) {
        showError('No scan ID provided');
        return;
    }
    
    // Load scan results
    await loadResults(scanId);
});

// Check authentication
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
            alert('Please verify your email first');
            window.location.href = 'verify.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Load scan results
async function loadResults(scanId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai-testing/scan/${scanId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load scan results');
        }
        
        scanData = await response.json();
        
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
    document.getElementById('scanDomain').textContent = data.domain || data.url || 'Unknown domain';
    
    if (data.created_at || data.scan_date) {
        const scanDate = new Date(data.created_at || data.scan_date);
        document.getElementById('scanDate').textContent = `Scanned on: ${scanDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`;
    }
    
    // Display overall score
    const overallScore = data.overall_score || calculateOverallScore(data);
    document.getElementById('overallScore').textContent = Math.round(overallScore);
    
    // Display score message
    const scoreMessage = getScoreMessage(overallScore);
    document.getElementById('scoreMessage').textContent = scoreMessage;
    
    // Display pillar breakdown
    displayPillars(data);
}

// Calculate overall score from pillars (if not provided)
function calculateOverallScore(data) {
    const results = data.results || data.pillar_scores || {};
    let total = 0;
    let count = 0;
    
    Object.keys(PILLAR_CONFIG).forEach(pillarKey => {
        const score = results[pillarKey]?.score || results[pillarKey] || 0;
        total += score;
        count++;
    });
    
    return count > 0 ? total : 0;
}

// Get score message based on overall score
function getScoreMessage(score) {
    if (score >= 900) return '🎉 Excellent! Your site is highly optimized for AI discovery';
    if (score >= 750) return '👍 Great job! Your site is well-optimized for AI search';
    if (score >= 600) return '👌 Good start! Some improvements will boost your AI visibility';
    if (score >= 450) return '💡 Room for growth. Follow the recommendations below';
    if (score >= 300) return '⚠️ Needs attention. Prioritize the key recommendations';
    return '🚨 Critical issues detected. Start with the fundamentals';
}

// Display pillar cards
function displayPillars(data) {
    const pillarsGrid = document.getElementById('pillarsGrid');
    pillarsGrid.innerHTML = '';
    
    const results = data.results || data.pillar_scores || {};
    
    Object.keys(PILLAR_CONFIG).forEach(pillarKey => {
        const pillarData = results[pillarKey] || {};
        const pillarInfo = PILLAR_CONFIG[pillarKey];
        
        // Extract score
        const score = typeof pillarData === 'object' ? (pillarData.score || 0) : pillarData;
        
        // Extract recommendations
        const recommendations = pillarData.recommendations || pillarData.issues || [];
        
        // Create pillar card
        const card = createPillarCard(
            pillarInfo.name,
            pillarInfo.description,
            score,
            recommendations
        );
        
        pillarsGrid.appendChild(card);
    });
}

// Create individual pillar card
function createPillarCard(name, description, score, recommendations) {
    const card = document.createElement('div');
    card.className = 'pillar-card';
    
    // Determine score class
    const scoreClass = getScoreClass(score);
    
    // Calculate percentage for progress bar
    const percentage = (score / 125) * 100;
    
    card.innerHTML = `
        <div class="pillar-header">
            <div class="pillar-title">${name}</div>
            <div class="pillar-score ${scoreClass}">${Math.round(score)}/125</div>
        </div>
        
        <div class="pillar-progress">
            <div class="pillar-progress-bar" style="width: ${percentage}%"></div>
        </div>
        
        <div class="pillar-description">${description}</div>
        
        ${recommendations && recommendations.length > 0 ? `
            <div class="pillar-recommendations">
                <h4>💡 Recommendations:</h4>
                <ul>
                    ${recommendations.slice(0, 3).map(rec => `
                        <li>${typeof rec === 'string' ? rec : rec.message || rec.text || 'Improve this area'}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Get score class for color coding
function getScoreClass(score) {
    const percentage = (score / 125) * 100;
    
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 50) return 'fair';
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
    // Check if user has DIY plan
    if (scanData && scanData.plan === 'diy') {
        // Go to page selector
        const domain = scanData.domain || scanData.url;
        if (domain) {
            window.location.href = `page-selector.html?domain=${encodeURIComponent(domain)}`;
        } else {
            window.location.href = 'dashboard.html';
        }
    } else {
        // Free user - go to dashboard to start new scan
        window.location.href = 'dashboard.html';
    }
}