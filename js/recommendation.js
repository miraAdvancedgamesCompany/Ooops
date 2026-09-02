// ==========================================
// Oops:) — TikTok & Instagram Style Recommendation Engine
// Personalized Content Ranking & Affinity Modeling
// ==========================================

import { getUserInterests, trackInteraction, detectCategory } from './firebase.js';
import { getCurrentUser, isLoggedIn } from './auth.js';

// Local cache of user interests
let userAffinityMap = {};
let activeInterestsUnsub = null;

// Initialize recommendation listener for user
export function initRecommendation() {
    const user = getCurrentUser();
    if (user) {
        if (activeInterestsUnsub) activeInterestsUnsub();
        activeInterestsUnsub = getUserInterests(user.uid, (interests) => {
            userAffinityMap = interests || {};
        });
    } else {
        userAffinityMap = {};
        if (activeInterestsUnsub) {
            activeInterestsUnsub();
            activeInterestsUnsub = null;
        }
    }
}

// Track video watch time & engagement
export function recordWatchSession(contentId, category, durationWatchedSec, totalDurationSec, loopedCount = 0) {
    if (!isLoggedIn() || !category) return;
    const user = getCurrentUser();

    if (!totalDurationSec || totalDurationSec <= 0) return;

    const completionRate = durationWatchedSec / totalDurationSec;

    if (loopedCount > 0 || completionRate >= 1.2) {
        // Replayed / looped multiple times — very high interest
        trackInteraction(user.uid, contentId, category, 'replay');
    } else if (completionRate >= 0.7) {
        // Completed most of the video
        trackInteraction(user.uid, contentId, category, 'watch');
    } else if (durationWatchedSec < 2.0 && totalDurationSec > 5.0) {
        // Quick swipe away / skipped
        trackInteraction(user.uid, contentId, category, 'skip');
    }
}

// Compute personalized score for a content item
function computeContentScore(item) {
    const category = item.category || detectCategory(item.title, item.description);
    item.category = category; // cache it

    // 1. User Affinity Score (0 - 100)
    const affinity = userAffinityMap[category] || 0;
    const normalizedAffinity = Math.min(100, affinity * 8);

    // 2. Popularity Score (based on likes/comments/views)
    const rawLikes = item.likes || 0;
    const rawComments = item.comments || 0;
    const popularityScore = Math.min(50, Math.log10(rawLikes + rawComments * 2 + 1) * 12);

    // 3. Recency Score (boost newer items)
    const now = Date.now();
    const itemTime = item.timestamp || now;
    const hoursOld = (now - itemTime) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 30 - Math.min(30, hoursOld * 0.5));

    // 4. Random Discovery / Exploration Factor (to prevent echo chambers like TikTok does)
    const explorationNoise = (Math.random() - 0.5) * 20;

    // Final weighted score
    return (normalizedAffinity * 0.5) + (popularityScore * 0.25) + (recencyScore * 0.15) + explorationNoise;
}

// Sort items according to algorithmic recommendation
export function rankContentForUser(items) {
    if (!items || items.length === 0) return [];

    // If anonymous, return a balanced shuffle with trending bias
    if (!isLoggedIn() || Object.keys(userAffinityMap).length === 0) {
        return [...items].sort((a, b) => {
            const scoreA = (a.likes || 0) * 0.7 + Math.random() * 5000;
            const scoreB = (b.likes || 0) * 0.7 + Math.random() * 5000;
            return scoreB - scoreA;
        });
    }

    // Clone and score items
    const scored = items.map(item => ({
        item,
        score: computeContentScore(item)
    }));

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Inject 15% exploration items from untouched categories
    const rankedList = [];
    const highInterest = scored.slice(0, Math.floor(scored.length * 0.8));
    const discoveryPool = scored.slice(Math.floor(scored.length * 0.8));

    let highIdx = 0;
    let discIdx = 0;

    for (let i = 0; i < scored.length; i++) {
        // Every 5th or 6th item, inject discovery content
        if (i % 5 === 4 && discIdx < discoveryPool.length) {
            rankedList.push(discoveryPool[discIdx++].item);
        } else if (highIdx < highInterest.length) {
            rankedList.push(highInterest[highIdx++].item);
        } else if (discIdx < discoveryPool.length) {
            rankedList.push(discoveryPool[discIdx++].item);
        }
    }

    return rankedList;
}
