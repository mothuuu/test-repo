/**
 * Recommendation Feedback Widget
 * Collects user feedback on recommendation quality
 */

// Track feedback state per recommendation
const feedbackState = {};

/**
 * Create feedback widget HTML
 * @param {string} recommendationId - Unique identifier for the recommendation
 * @param {string} subfactor - The subfactor being recommended (e.g., "scannabilityScore")
 * @param {number} scanId - The scan ID
 * @returns {string} HTML string for the feedback widget
 */
function createFeedbackWidget(recommendationId, subfactor, scanId) {
    const widgetId = `feedback-${recommendationId}`;

    return `
        <div id="${widgetId}" class="feedback-widget mt-6 pt-4 border-t border-gray-200">
            <!-- Initial Prompt -->
            <div id="${widgetId}-prompt" class="feedback-prompt">
                <p class="text-sm text-gray-600 mb-3 font-medium">Was this recommendation helpful?</p>
                <div class="flex gap-3">
                    <button
                        onclick="handleFeedback('${recommendationId}', '${subfactor}', ${scanId}, true)"
                        class="feedback-btn feedback-btn-helpful flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-300 rounded-lg hover:bg-green-100 transition-colors text-sm font-semibold">
                        <span>👍</span>
                        <span>Helpful</span>
                    </button>
                    <button
                        onclick="handleFeedback('${recommendationId}', '${subfactor}', ${scanId}, false)"
                        class="feedback-btn feedback-btn-not-helpful flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold">
                        <span>👎</span>
                        <span>Not helpful</span>
                    </button>
                </div>
            </div>

            <!-- Expanded Feedback Form (hidden initially) -->
            <div id="${widgetId}-form" class="feedback-form hidden">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-sm font-semibold text-gray-700 mb-3">Thanks for your feedback! Help us improve further:</p>

                    <!-- Rating Stars -->
                    <div class="mb-4">
                        <label class="text-sm text-gray-600 block mb-2">Rate this recommendation:</label>
                        <div class="rating-stars flex gap-2">
                            ${[1, 2, 3, 4, 5].map(rating => `
                                <button
                                    onclick="setRating('${recommendationId}', ${rating})"
                                    class="rating-star text-2xl hover:scale-110 transition-transform"
                                    data-rating="${rating}"
                                    data-rec-id="${recommendationId}">
                                    ⭐
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="${widgetId}-rating" value="">
                    </div>

                    <!-- Implemented Checkbox -->
                    <div class="mb-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                id="${widgetId}-implemented"
                                class="w-4 h-4 text-green-600 rounded focus:ring-green-500">
                            <span class="text-sm text-gray-700">I implemented this recommendation</span>
                        </label>
                    </div>

                    <!-- Comment Box -->
                    <div class="mb-4">
                        <label class="text-sm text-gray-600 block mb-2">
                            What could make this better? (optional)
                        </label>
                        <textarea
                            id="${widgetId}-comment"
                            rows="3"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="E.g., Too vague, needs more examples, wrong for my industry..."></textarea>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex gap-3">
                        <button
                            onclick="submitDetailedFeedback('${recommendationId}', '${subfactor}', ${scanId})"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                            Submit Feedback
                        </button>
                        <button
                            onclick="skipDetailedFeedback('${recommendationId}')"
                            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                            Skip
                        </button>
                    </div>
                </div>
            </div>

            <!-- Thank You Message (hidden initially) -->
            <div id="${widgetId}-thanks" class="feedback-thanks hidden">
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <span class="text-2xl">✅</span>
                    <div>
                        <p class="text-sm font-semibold text-green-800">Thank you for your feedback!</p>
                        <p class="text-xs text-green-700">Your input helps us improve recommendations for everyone.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Handle initial helpful/not helpful feedback
 */
async function handleFeedback(recommendationId, subfactor, scanId, helpful) {
    const widgetId = `feedback-${recommendationId}`;

    // Store initial feedback
    feedbackState[recommendationId] = { helpful, subfactor, scanId };

    // Hide prompt, show detailed form
    document.getElementById(`${widgetId}-prompt`).classList.add('hidden');
    document.getElementById(`${widgetId}-form`).classList.remove('hidden');

    // Track interaction (implicit signal that they expanded the recommendation)
    trackInteraction(recommendationId, scanId, { expanded: true });
}

/**
 * Set rating (star selection)
 */
function setRating(recommendationId, rating) {
    const widgetId = `feedback-${recommendationId}`;
    document.getElementById(`${widgetId}-rating`).value = rating;

    // Visual feedback: fill stars up to selected rating
    const stars = document.querySelectorAll(`[data-rec-id="${recommendationId}"].rating-star`);
    stars.forEach((star, index) => {
        if (index < rating) {
            star.style.opacity = '1';
            star.style.filter = 'grayscale(0%)';
        } else {
            star.style.opacity = '0.3';
            star.style.filter = 'grayscale(100%)';
        }
    });
}

/**
 * Submit detailed feedback
 */
async function submitDetailedFeedback(recommendationId, subfactor, scanId) {
    const widgetId = `feedback-${recommendationId}`;
    const initialFeedback = feedbackState[recommendationId] || {};

    const rating = parseInt(document.getElementById(`${widgetId}-rating`).value) || null;
    const implemented = document.getElementById(`${widgetId}-implemented`).checked;
    const comment = document.getElementById(`${widgetId}-comment`).value.trim();

    const feedbackData = {
        scanId,
        recommendationId,
        subfactor,
        helpful: initialFeedback.helpful,
        rating,
        implemented,
        comment: comment || null,
        variant: null,  // Can be used for A/B testing
        industry: null,  // Could extract from scan data
        pageUrl: document.getElementById('scanUrl')?.textContent || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/feedback/recommendation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify(feedbackData)
        });

        const result = await response.json();

        if (result.success) {
            // Hide form, show thank you
            document.getElementById(`${widgetId}-form`).classList.add('hidden');
            document.getElementById(`${widgetId}-thanks`).classList.remove('hidden');

            console.log('✅ Feedback submitted successfully:', result);
        } else {
            throw new Error(result.error || 'Failed to submit feedback');
        }
    } catch (error) {
        console.error('❌ Error submitting feedback:', error);
        alert('Failed to submit feedback. Please try again.');
    }
}

/**
 * Skip detailed feedback (just submit the helpful/not helpful)
 */
async function skipDetailedFeedback(recommendationId) {
    const widgetId = `feedback-${recommendationId}`;
    const initialFeedback = feedbackState[recommendationId] || {};

    const feedbackData = {
        scanId: initialFeedback.scanId,
        recommendationId,
        subfactor: initialFeedback.subfactor,
        helpful: initialFeedback.helpful,
        rating: null,
        implemented: false,
        comment: null,
        pageUrl: document.getElementById('scanUrl')?.textContent || null
    };

    try {
        await fetch(`${API_BASE_URL}/feedback/recommendation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify(feedbackData)
        });

        // Hide form, show thank you
        document.getElementById(`${widgetId}-form`).classList.add('hidden');
        document.getElementById(`${widgetId}-thanks`).classList.remove('hidden');
    } catch (error) {
        console.error('Error submitting basic feedback:', error);
        // Still show thank you to avoid frustrating user
        document.getElementById(`${widgetId}-form`).classList.add('hidden');
        document.getElementById(`${widgetId}-thanks`).classList.remove('hidden');
    }
}

/**
 * Track implicit user interactions
 */
async function trackInteraction(recommendationId, scanId, interactions) {
    try {
        await fetch(`${API_BASE_URL}/feedback/interaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({
                scanId,
                recommendationId,
                ...interactions
            })
        });
    } catch (error) {
        console.error('Error tracking interaction:', error);
        // Silent fail - don't disrupt user experience
    }
}

/**
 * Track when user copies code (call this from existing copyCode function)
 */
function trackCodeCopy(recommendationId, scanId) {
    trackInteraction(recommendationId, scanId, { copiedCode: true });
}

/**
 * Track time spent on recommendation (call when expanding/collapsing)
 */
let recommendationTimers = {};

function startTrackingTime(recommendationId) {
    recommendationTimers[recommendationId] = Date.now();
}

function stopTrackingTime(recommendationId, scanId) {
    if (recommendationTimers[recommendationId]) {
        const timeSpent = Math.floor((Date.now() - recommendationTimers[recommendationId]) / 1000);
        trackInteraction(recommendationId, scanId, { timeSpent });
        delete recommendationTimers[recommendationId];
    }
}
