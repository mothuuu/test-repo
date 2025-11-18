// Sample data
const recommendations = [
    {
        id: 1,
        title: "Added Organization Schema Markup",
        status: "completed",
        priority: "critical",
        impact: 45,
        estimatedTime: "18 minutes",
        completedDate: "Nov 10, 2025",
        actualTime: "18 minutes",
        scoreBefore: 623,
        scoreAfter: 668,
        notes: [
            {
                date: "Nov 10, 2025",
                text: "Added Organization schema to homepage. Validated with Schema.org validator and Google Rich Results Test. All fields populated including address, phone, and social media links."
            }
        ],
        verified: true
    },
    {
        id: 2,
        title: "No FAQ Schema (60+ Question Opportunities)",
        status: "in-progress",
        priority: "critical",
        impact: 40,
        estimatedTime: "30 minutes",
        startedDate: "Nov 12, 2025",
        notes: [
            {
                date: "Nov 15, 2025",
                text: "Identified 8 FAQs on services page. Now need to add schema markup and validate. Will do this tomorrow."
            },
            {
                date: "Nov 13, 2025",
                text: "Started reviewing which FAQs should get schema. Focusing on services page first."
            }
        ]
    },
    {
        id: 3,
        title: "Add Contact Information Schema",
        status: "skipped",
        priority: "high",
        impact: 14,
        estimatedTime: "8 minutes",
        skippedDate: "Nov 13, 2025",
        skipReasons: ["Will do later"],
        skipNotes: "Will implement after redesigning contact page in Q1 2026",
        reminderDate: "2026-01-01"
    },
    {
        id: 4,
        title: "Optimize Meta Descriptions for 15 Pages",
        status: "completed",
        priority: "high",
        impact: 25,
        estimatedTime: "45 minutes",
        completedDate: "Nov 8, 2025",
        actualTime: "52 minutes",
        scoreBefore: 598,
        scoreAfter: 623,
        notes: [
            {
                date: "Nov 8, 2025",
                text: "Updated meta descriptions for all 15 pages. Focused on compelling CTAs and keyword optimization while staying under 160 characters."
            }
        ],
        verified: true
    },
    {
        id: 5,
        title: "Add Alt Text to Product Images",
        status: "completed",
        priority: "medium",
        impact: 18,
        estimatedTime: "25 minutes",
        completedDate: "Nov 5, 2025",
        actualTime: "30 minutes",
        scoreBefore: 580,
        scoreAfter: 598,
        notes: [
            {
                date: "Nov 5, 2025",
                text: "Added descriptive alt text to 47 product images. Used format: 'ProductName - key feature - brand name' for consistency."
            }
        ],
        verified: true
    },
    {
        id: 6,
        title: "Implement Breadcrumb Schema",
        status: "in-progress",
        priority: "high",
        impact: 22,
        estimatedTime: "20 minutes",
        startedDate: "Nov 14, 2025",
        notes: [
            {
                date: "Nov 14, 2025",
                text: "Added breadcrumb markup to product pages. Still need to add to blog and category pages."
            }
        ]
    },
    {
        id: 7,
        title: "Fix Broken Internal Links (12 Found)",
        status: "completed",
        priority: "critical",
        impact: 30,
        estimatedTime: "15 minutes",
        completedDate: "Nov 7, 2025",
        actualTime: "12 minutes",
        scoreBefore: 568,
        scoreAfter: 598,
        notes: [
            {
                date: "Nov 7, 2025",
                text: "Fixed all 12 broken links. Most were from old blog posts pointing to renamed product pages. Updated all references."
            }
        ],
        verified: true
    },
    {
        id: 8,
        title: "Add OpenGraph Images to All Pages",
        status: "not-started",
        priority: "medium",
        impact: 12,
        estimatedTime: "40 minutes",
        // Example: User clicked Skip 2 days ago
        firstSkipAttempt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
        id: 9,
        title: "Optimize H1 Tags (8 Pages Missing)",
        status: "completed",
        priority: "critical",
        impact: 35,
        estimatedTime: "20 minutes",
        completedDate: "Nov 9, 2025",
        actualTime: "18 minutes",
        scoreBefore: 623,
        scoreAfter: 658,
        notes: [
            {
                date: "Nov 9, 2025",
                text: "Added H1 tags to 8 pages that were missing them. Ensured each page has exactly one H1 that matches primary keyword."
            }
        ],
        verified: true
    },
    {
        id: 10,
        title: "Improve Page Load Speed (Enable Compression)",
        status: "skipped",
        priority: "high",
        impact: 28,
        estimatedTime: "10 minutes",
        skippedDate: "Nov 11, 2025",
        skipReasons: ["Need developer help"],
        skipNotes: "Requires server configuration changes. Will ask our hosting provider to enable Gzip compression.",
        reminderDate: "2025-12-01"
    },
    {
        id: 11,
        title: "Add Twitter Card Markup",
        status: "not-started",
        priority: "low",
        impact: 8,
        estimatedTime: "15 minutes",
        // Example: User clicked Skip 6 days ago - should be able to skip now
        firstSkipAttempt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
        id: 12,
        title: "Create XML Sitemap",
        status: "completed",
        priority: "critical",
        impact: 32,
        estimatedTime: "25 minutes",
        completedDate: "Nov 3, 2025",
        actualTime: "28 minutes",
        scoreBefore: 548,
        scoreAfter: 580,
        notes: [
            {
                date: "Nov 3, 2025",
                text: "Generated XML sitemap with all pages. Submitted to Google Search Console and Bing Webmaster Tools. Both confirmed receipt."
            }
        ],
        verified: true
    }
];

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    renderRecommendations('all');
    setupFilterTabs();
    setupSortControls();
    updateOverallStats();
    setupReminderButtons();
    setupModalOverlayClose();
    setupMobileMenu();
});

// Update overall statistics
function updateOverallStats() {
    const completed = recommendations.filter(r => r.status === 'completed');
    const total = recommendations.length;
    const percentage = Math.round((completed.length / total) * 100);

    // Calculate total points gained
    const pointsGained = completed.reduce((sum, rec) => sum + rec.impact, 0);

    // Calculate potential remaining
    const remaining = recommendations.filter(r => r.status !== 'completed');
    const potentialRemaining = remaining.reduce((sum, rec) => sum + rec.impact, 0);

    // Calculate time invested
    const timeMinutes = completed.reduce((sum, rec) => {
        if (rec.actualTime) {
            const minutes = parseInt(rec.actualTime);
            return sum + minutes;
        }
        return sum;
    }, 0);
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;

    // Update DOM
    document.getElementById('overallProgressBar').style.width = percentage + '%';
    document.getElementById('overallProgressBar').querySelector('.progress-bar-text').textContent = percentage + '% Complete';
    document.getElementById('completedStat').textContent = `${completed.length} of ${total}`;
    document.getElementById('pointsGained').textContent = `+${pointsGained}`;
    document.getElementById('potentialRemaining').textContent = `+${potentialRemaining} points`;
    document.getElementById('timeInvested').textContent = `${hours}h ${minutes}m`;
}

// Render recommendations based on filter
function renderRecommendations(filter) {
    const container = document.getElementById('recommendations-container');
    let filteredRecs = recommendations;

    if (filter !== 'all') {
        filteredRecs = recommendations.filter(rec => rec.status === filter);
    }

    container.innerHTML = '';

    if (filteredRecs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-text">No ${filter === 'all' ? '' : filter + ' '}recommendations found</div>
            </div>
        `;
        return;
    }

    filteredRecs.forEach(rec => {
        const card = createRecommendationCard(rec);
        container.appendChild(card);
    });

    // Update filter tabs counts
    updateFilterCounts();
}

// Update filter tab counts
function updateFilterCounts() {
    const counts = {
        all: recommendations.length,
        completed: recommendations.filter(r => r.status === 'completed').length,
        'in-progress': recommendations.filter(r => r.status === 'in-progress').length,
        skipped: recommendations.filter(r => r.status === 'skipped').length,
        'not-started': recommendations.filter(r => r.status === 'not-started').length
    };

    document.querySelectorAll('.filter-tab').forEach(tab => {
        const filter = tab.getAttribute('data-filter');
        const count = counts[filter] || 0;
        const emoji = tab.textContent.match(/[^\w\s]/)?.[0] || '';
        const label = filter === 'all' ? 'All' :
                     filter === 'completed' ? 'Completed' :
                     filter === 'in-progress' ? 'In Progress' :
                     filter === 'skipped' ? 'Skipped' :
                     'Not Started';
        tab.textContent = `${emoji} ${emoji ? '' : ''}${label} (${count})`.trim();
    });
}

// Create recommendation card HTML
function createRecommendationCard(rec) {
    const card = document.createElement('div');
    card.className = `recommendation-card ${rec.status}`;
    card.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-left: 4px solid ${getPriorityColor(rec.priority)};
    `;

    let cardHTML = `
        <div class="rec-card-header">
            <div class="rec-card-title-row" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <h3 class="rec-card-title" style="font-size: 1.125rem; font-weight: 600; color: var(--gray-900);">
                    ${getStatusIcon(rec.status)} ${rec.title}
                </h3>
                <span class="rec-priority-badge ${rec.priority}" style="
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    background: ${getPriorityBg(rec.priority)};
                    color: ${getPriorityColor(rec.priority)};
                ">${rec.priority}</span>
            </div>
        </div>
    `;

    // Add status-specific content
    if (rec.status === 'completed') {
        cardHTML += createCompletedCardContent(rec);
    } else if (rec.status === 'in-progress') {
        cardHTML += createInProgressCardContent(rec);
    } else if (rec.status === 'skipped') {
        cardHTML += createSkippedCardContent(rec);
    } else if (rec.status === 'not-started') {
        cardHTML += createNotStartedCardContent(rec);
    }

    card.innerHTML = cardHTML;
    return card;
}

// Get status icon
function getStatusIcon(status) {
    const icons = {
        'completed': '✅',
        'in-progress': '🔄',
        'skipped': '⏸️',
        'not-started': '📋'
    };
    return icons[status] || '📋';
}

// Get priority color
function getPriorityColor(priority) {
    const colors = {
        'critical': '#EF4444',
        'high': '#F59E0B',
        'medium': '#3B82F6',
        'low': '#6B7280'
    };
    return colors[priority] || '#6B7280';
}

// Get priority background
function getPriorityBg(priority) {
    const colors = {
        'critical': '#FEE2E2',
        'high': '#FEF3C7',
        'medium': '#DBEAFE',
        'low': '#F3F4F6'
    };
    return colors[priority] || '#F3F4F6';
}

// Create completed card content
function createCompletedCardContent(rec) {
    let html = `
        <div class="rec-card-meta" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Completed:</strong> ${rec.completedDate}
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Impact:</strong> <span style="color: var(--good-green);">+${rec.impact} points</span>
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Time:</strong> ${rec.actualTime}
            </div>
        </div>

        <div class="score-visualization" style="background: var(--gray-50); border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
            <div class="score-before-after" style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.75rem;">
                <span class="score-box" style="font-weight: 600; color: var(--gray-700);">Before: ${rec.scoreBefore}/1000</span>
                <span class="score-arrow" style="color: var(--cyan); font-size: 1.5rem;">→</span>
                <span class="score-box" style="font-weight: 600; color: var(--good-green);">After: ${rec.scoreAfter}/1000</span>
            </div>
            <div class="score-progress-bar" style="width: 100%; height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden;">
                <div class="score-progress-fill" style="height: 100%; background: linear-gradient(90deg, var(--cyan) 0%, var(--pink) 100%); width: ${(rec.scoreAfter/1000)*100}%"></div>
            </div>
        </div>
    `;

    if (rec.notes && rec.notes.length > 0) {
        html += `
            <div class="rec-notes" style="background: #f0f9ff; border-left: 3px solid var(--cyan); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div class="rec-notes-header" style="font-weight: 600; color: var(--gray-700); margin-bottom: 0.5rem;">Implementation Notes:</div>
                ${rec.notes.map(note => `
                    <div class="rec-note-item" style="margin-bottom: 0.5rem;">
                        <div class="rec-note-date" style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">${note.date} - You wrote:</div>
                        <div class="rec-note-text" style="font-size: 0.875rem; color: var(--gray-700); font-style: italic;">"${note.text}"</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (rec.verified) {
        html += `
            <div class="verification-status verified" style="background: #d1fae5; color: var(--good-green); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; margin-bottom: 1rem;">
                ✅ Verified in latest scan
            </div>
        `;
    }

    html += `
        <div class="rec-card-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn-secondary-small" onclick="viewDetails(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">View Original Recommendation</button>
            <button class="btn-secondary-small" onclick="undoComplete(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Undo Mark as Complete</button>
        </div>
    `;

    return html;
}

// Create in-progress card content
function createInProgressCardContent(rec) {
    let html = `
        <div class="rec-card-meta" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Started:</strong> ${rec.startedDate}
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Impact:</strong> <span style="color: var(--cyan);">+${rec.impact} points</span>
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Est:</strong> ${rec.estimatedTime}
            </div>
        </div>
    `;

    if (rec.notes && rec.notes.length > 0) {
        html += `
            <div class="rec-notes" style="background: #fef3c7; border-left: 3px solid var(--warning-yellow); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div class="rec-notes-header" style="font-weight: 600; color: var(--gray-700); margin-bottom: 0.5rem;">Progress Notes:</div>
                ${rec.notes.map(note => `
                    <div class="rec-note-item" style="margin-bottom: 0.5rem;">
                        <div class="rec-note-date" style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">${note.date} - You wrote:</div>
                        <div class="rec-note-text" style="font-size: 0.875rem; color: var(--gray-700); font-style: italic;">"${note.text}"</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += `
        <div class="rec-card-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn-primary-small" onclick="openCompleteModal(${rec.id}, '${rec.title}', '+${rec.impact} points')" style="padding: 0.5rem 1rem; background: linear-gradient(135deg, var(--cyan) 0%, var(--pink) 100%); color: white; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 600;">Mark Complete</button>
            <button class="btn-secondary-small" onclick="addProgressNote(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Add Progress Note</button>
            <button class="btn-secondary-small" onclick="viewDetails(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">View Fix Instructions</button>
            <button class="btn-secondary-small" onclick="openSkipModal(${rec.id}, '${rec.title}', '+${rec.impact} points')" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Move to Skipped</button>
        </div>
    `;

    return html;
}

// Create skipped card content
function createSkippedCardContent(rec) {
    let html = `
        <div class="rec-card-meta" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Skipped:</strong> ${rec.skippedDate}
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Impact:</strong> <span style="color: var(--gray-500);">+${rec.impact} points</span>
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Est:</strong> ${rec.estimatedTime}
            </div>
        </div>

        <div class="rec-notes" style="background: #f3f4f6; border-left: 3px solid var(--gray-400); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="rec-notes-header" style="font-weight: 600; color: var(--gray-700); margin-bottom: 0.5rem;">Why you skipped this:</div>
            <div class="rec-note-item" style="margin-bottom: 0.5rem;">
                <div class="rec-note-text" style="font-size: 0.875rem; color: var(--gray-700);">${rec.skipReasons.join(', ')}</div>
            </div>
            ${rec.skipNotes ? `
                <div class="rec-note-item">
                    <div class="rec-note-date" style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Notes:</div>
                    <div class="rec-note-text" style="font-size: 0.875rem; color: var(--gray-700); font-style: italic;">"${rec.skipNotes}"</div>
                </div>
            ` : ''}
        </div>
    `;

    if (rec.reminderDate) {
        html += `
            <div class="reminder-badge" style="background: #fef3c7; color: var(--warning-yellow); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; margin-bottom: 1rem; display: inline-block;">
                ⏰ Reminder Set: ${rec.reminderDate}
            </div>
        `;
    }

    html += `
        <div class="rec-card-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn-primary-small" onclick="resumeRecommendation(${rec.id})" style="padding: 0.5rem 1rem; background: linear-gradient(135deg, var(--cyan) 0%, var(--pink) 100%); color: white; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 600;">Resume</button>
            <button class="btn-secondary-small" onclick="viewDetails(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">View Details</button>
            <button class="btn-secondary-small" onclick="editReminder(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Edit Reminder</button>
            <button class="btn-secondary-small" onclick="dismiss(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--critical-red); color: var(--critical-red); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Permanently Dismiss</button>
        </div>
    `;

    return html;
}

// Create not-started card content
function createNotStartedCardContent(rec) {
    let html = `
        <div class="rec-card-meta" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Impact:</strong> <span style="color: var(--cyan);">+${rec.impact} points</span>
            </div>
            <div class="rec-meta-item" style="font-size: 0.875rem; color: var(--gray-600);">
                <strong>Estimated Time:</strong> ${rec.estimatedTime}
            </div>
        </div>

        <div class="rec-card-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn-primary-small" onclick="startRecommendation(${rec.id})" style="padding: 0.5rem 1rem; background: linear-gradient(135deg, var(--cyan) 0%, var(--pink) 100%); color: white; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 600;">Start Working</button>
            <button class="btn-secondary-small" onclick="viewDetails(${rec.id})" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">View Details</button>
            <button class="btn-secondary-small" onclick="openSkipModal(${rec.id}, '${rec.title}', '+${rec.impact} points')" style="padding: 0.5rem 1rem; border: 2px solid var(--gray-300); background: white; border-radius: 8px; font-size: 0.875rem; cursor: pointer; font-weight: 500;">Skip</button>
        </div>
    `;

    return html;
}

// Setup filter tabs
function setupFilterTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            renderRecommendations(filter);

            // Show/hide achievements and sort for completed tab
            const achievementsBanner = document.getElementById('achievements-banner');
            const sortControls = document.getElementById('sort-controls');

            if (filter === 'completed') {
                achievementsBanner.style.display = 'block';
                sortControls.style.display = 'block';
            } else {
                achievementsBanner.style.display = 'none';
                sortControls.style.display = 'none';
            }
        });
    });
}

// Setup sort controls
function setupSortControls() {
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            sortRecommendations(this.value);
        });
    }
}

// Sort recommendations
function sortRecommendations(sortBy) {
    const completedRecs = recommendations.filter(r => r.status === 'completed');

    if (sortBy === 'recent') {
        completedRecs.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
    } else if (sortBy === 'impact') {
        completedRecs.sort((a, b) => b.impact - a.impact);
    } else if (sortBy === 'oldest') {
        completedRecs.sort((a, b) => new Date(a.completedDate) - new Date(b.completedDate));
    } else if (sortBy === 'time') {
        completedRecs.sort((a, b) => parseInt(a.actualTime) - parseInt(b.actualTime));
    }

    // Re-render
    const container = document.getElementById('recommendations-container');
    container.innerHTML = '';
    completedRecs.forEach(rec => {
        const card = createRecommendationCard(rec);
        container.appendChild(card);
    });
}

// Other action functions
function viewDetails(id) {
    console.log('View details for:', id);
    alert('View Details functionality - This would show the full recommendation details, fix instructions, and resources.');
}

function undoComplete(id) {
    if (confirm('Are you sure you want to undo this completion? This will move the recommendation back to "Not Started".')) {
        const rec = recommendations.find(r => r.id === id);
        if (rec) {
            rec.status = 'not-started';
            rec.completedDate = null;
            rec.actualTime = null;
            rec.scoreBefore = null;
            rec.scoreAfter = null;
            rec.notes = [];
            rec.verified = false;

            // Re-render current filter
            const activeTab = document.querySelector('.filter-tab.active');
            const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            renderRecommendations(currentFilter);
            updateOverallStats();
        }
    }
}

function addProgressNote(id) {
    const note = prompt('Add a progress note:');
    if (note) {
        const rec = recommendations.find(r => r.id === id);
        if (rec) {
            if (!rec.notes) rec.notes = [];
            rec.notes.unshift({
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                text: note
            });

            // Re-render
            const activeTab = document.querySelector('.filter-tab.active');
            const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            renderRecommendations(currentFilter);
        }
    }
}

function resumeRecommendation(id) {
    const rec = recommendations.find(r => r.id === id);
    if (rec) {
        rec.status = 'in-progress';
        rec.startedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        rec.skippedDate = null;
        rec.skipReasons = [];
        rec.skipNotes = null;
        rec.reminderDate = null;

        // Re-render
        const activeTab = document.querySelector('.filter-tab.active');
        const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
        renderRecommendations(currentFilter);
        updateOverallStats();
    }
}

function startRecommendation(id) {
    const rec = recommendations.find(r => r.id === id);
    if (rec) {
        rec.status = 'in-progress';
        rec.startedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Re-render
        const activeTab = document.querySelector('.filter-tab.active');
        const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
        renderRecommendations(currentFilter);
        updateOverallStats();
    }
}

function editReminder(id) {
    alert('Edit Reminder functionality - This would open a modal to modify the reminder date.');
}

function dismiss(id) {
    if (confirm('Are you sure you want to permanently dismiss this recommendation? This action cannot be undone.')) {
        const index = recommendations.findIndex(r => r.id === id);
        if (index > -1) {
            recommendations.splice(index, 1);

            // Re-render
            const activeTab = document.querySelector('.filter-tab.active');
            const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            renderRecommendations(currentFilter);
            updateOverallStats();
        }
    }
}

// Modal Functions
let currentSkipRecommendation = null;
let currentCompleteRecommendation = null;

// Helper function to calculate days between two dates
function daysSince(dateString) {
    if (!dateString) return null;
    const startDate = new Date(dateString);
    const today = new Date();
    const diffTime = today - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Function to check if a recommendation can be skipped
function canSkipRecommendation(rec) {
    // Check if user has clicked skip before - use firstSkipAttempt date
    // If not, we'll set it when they click Skip for the first time
    if (!rec.firstSkipAttempt) {
        // First time clicking Skip - start the 5-day countdown
        return {
            canSkip: false,
            daysRemaining: 5,
            isFirstAttempt: true
        };
    }

    // User has clicked Skip before, check how many days have passed
    const days = daysSince(rec.firstSkipAttempt);
    const daysRemaining = 5 - days;

    if (daysRemaining > 0) {
        // Still need to wait more days
        const availableDate = new Date(rec.firstSkipAttempt);
        availableDate.setDate(availableDate.getDate() + 5);

        return {
            canSkip: false,
            daysRemaining: daysRemaining,
            availableDate: availableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    }

    // 5 days have passed, user can now skip
    return { canSkip: true };
}

function openSkipModal(recommendationId, title, impact) {
    const rec = recommendations.find(r => r.id === recommendationId);
    if (!rec) return;

    // Set firstSkipAttempt if this is the first time user clicks Skip
    if (!rec.firstSkipAttempt) {
        rec.firstSkipAttempt = new Date().toISOString().split('T')[0]; // Store as YYYY-MM-DD
    }

    const skipCheck = canSkipRecommendation(rec);

    if (!skipCheck.canSkip) {
        // Show "cannot skip yet" modal with countdown
        document.getElementById('cannot-skip-modal-title').textContent = title;
        const daysText = skipCheck.daysRemaining === 1 ? '1 day' : `${skipCheck.daysRemaining} days`;
        document.getElementById('days-remaining').textContent = daysText;

        // Calculate and show the available date if not first attempt
        if (!skipCheck.isFirstAttempt && skipCheck.availableDate) {
            document.getElementById('skip-available-date').textContent = skipCheck.availableDate;
        } else {
            // First attempt - calculate date
            const availableDate = new Date();
            availableDate.setDate(availableDate.getDate() + 5);
            document.getElementById('skip-available-date').textContent = availableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        document.getElementById('cannot-skip-modal').style.display = 'flex';
        return;
    }

    // 5 days have passed - show regular skip modal
    currentSkipRecommendation = recommendationId;
    document.getElementById('skip-modal-title').textContent = title;
    document.getElementById('skip-modal-impact').textContent = impact;
    document.getElementById('skip-modal').style.display = 'flex';
}

function closeCannotSkipModal() {
    document.getElementById('cannot-skip-modal').style.display = 'none';
}

function closeSkipModal() {
    document.getElementById('skip-modal').style.display = 'none';
    currentSkipRecommendation = null;
    // Reset form
    document.querySelectorAll('#skip-modal input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('skip-notes').value = '';
}

function confirmSkip() {
    const reasons = [];
    document.querySelectorAll('#skip-modal input[type="checkbox"]:checked').forEach(cb => {
        reasons.push(cb.value);
    });

    const notes = document.getElementById('skip-notes').value;
    const activeReminder = document.querySelector('.reminder-btn.active');
    const reminderDays = activeReminder ? activeReminder.dataset.days : '30';

    // Find the recommendation and update it
    const rec = recommendations.find(r => r.id === currentSkipRecommendation);
    if (rec) {
        rec.status = 'skipped';
        rec.skippedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        rec.skipReasons = reasons.length > 0 ? reasons : ['Not specified'];
        rec.skipNotes = notes;

        // Calculate reminder date
        if (reminderDays !== 'never' && reminderDays !== 'custom') {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + parseInt(reminderDays));
            rec.reminderDate = reminderDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        // Re-render
        const activeTab = document.querySelector('.filter-tab.active');
        const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
        renderRecommendations(currentFilter);
        updateOverallStats();
    }

    closeSkipModal();
}

function openCompleteModal(recommendationId, title, impact) {
    currentCompleteRecommendation = recommendationId;
    document.getElementById('complete-modal-title').textContent = title;
    document.getElementById('complete-modal-impact').textContent = impact;
    document.getElementById('complete-modal').style.display = 'flex';
}

function closeCompleteModal() {
    document.getElementById('complete-modal').style.display = 'none';
    currentCompleteRecommendation = null;
    // Reset form
    document.getElementById('confirm-implemented').checked = false;
    document.getElementById('confirm-tested').checked = false;
    document.getElementById('confirm-validated').checked = false;
    document.getElementById('complete-notes').value = '';
}

function confirmComplete() {
    // Validate required checkboxes
    const implemented = document.getElementById('confirm-implemented').checked;
    const tested = document.getElementById('confirm-tested').checked;

    if (!implemented || !tested) {
        alert('Please confirm you have implemented and tested this recommendation before marking it as complete.');
        return;
    }

    const validated = document.getElementById('confirm-validated').checked;
    const notes = document.getElementById('complete-notes').value;

    // Find the recommendation and update it
    const rec = recommendations.find(r => r.id === currentCompleteRecommendation);
    if (rec) {
        // Calculate score improvement
        const currentScore = parseInt(document.getElementById('currentScore').textContent.split('/')[0]) || 680;
        rec.scoreBefore = currentScore;
        rec.scoreAfter = currentScore + rec.impact;

        rec.status = 'completed';
        rec.completedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        rec.actualTime = rec.estimatedTime; // For now, use estimated time
        rec.verified = false; // Will be verified in next scan

        if (notes) {
            if (!rec.notes) rec.notes = [];
            rec.notes.push({
                date: rec.completedDate,
                text: notes
            });
        }

        // Update current score
        document.getElementById('currentScore').textContent = `${rec.scoreAfter}/1000`;

        // Re-render
        const activeTab = document.querySelector('.filter-tab.active');
        const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
        renderRecommendations(currentFilter);
        updateOverallStats();
    }

    closeCompleteModal();
}

// Setup reminder button selection
function setupReminderButtons() {
    const reminderButtons = document.querySelectorAll('.reminder-btn');
    reminderButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            reminderButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update preview text
            const days = this.dataset.days;
            let previewText = '';

            if (days === 'never') {
                previewText = 'Never';
            } else if (days === 'custom') {
                previewText = 'Custom date (please select)';
            } else {
                const timeText = days === '7' ? '1 week' : days === '14' ? '2 weeks' : days === '30' ? '1 month' : '3 months';
                previewText = `${timeText}`;
            }

            const previewElement = document.querySelector('.reminder-preview strong');
            if (previewElement) {
                previewElement.textContent = previewText;
            }
        });
    });
}

// Setup modal overlay click to close
function setupModalOverlayClose() {
    document.querySelectorAll('.xeo-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
}

// Setup mobile menu toggle
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

// Show analytics modal
function showAnalytics() {
    document.getElementById('analytics-modal').style.display = 'flex';
}

// Logout function
function logout() {
    window.location.href = 'auth.html';
}
