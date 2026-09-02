// ==========================================
// Oops:) — TikTok & Instagram Style Recommendation Engine
// High Randomness Weighted by User Preferences & Watched History
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

// ---- Watched History Management ----
function getStorageKey() {
    const user = getCurrentUser();
    return user ? `oops_watched_${user.uid}` : 'oops_watched_guest';
}

export function getWatchedIds() {
    try {
        const raw = localStorage.getItem(getStorageKey());
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export function markWatched(contentId) {
    if (!contentId) return;
    try {
        const key = getStorageKey();
        const list = getWatchedIds();
        if (!list.includes(contentId)) {
            list.push(contentId);
            localStorage.setItem(key, JSON.stringify(list));
        }
    } catch (e) {
        console.error('Error saving watched status:', e);
    }
}

export function clearWatched() {
    try {
        localStorage.removeItem(getStorageKey());
    } catch (e) {}
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

    // Also mark as watched
    markWatched(contentId);
}

// ---- Highly Randomized Recommendation with Preference Bias ----
// User requirement:
// "أريد الفيديوهات التي تظهر للمستخدم تكون عشوائية جدًا حسب المحتوي المفضل.
// لاتظهر بالترتيب في الصفحة الرئيسية، وفيديوهات شافه المستخدم لا يتم عرضه مجددا له إلا إذا خلصت الفيديوهات كلها وقام بمشاهدتها كاملة"
export function rankContentForUser(items) {
    if (!items || items.length === 0) return [];

    // 1. Filter out videos the user has already watched
    const watchedIds = new Set(getWatchedIds());
    let unwatched = items.filter(it => !watchedIds.has(it.id));

    // If user has watched all videos, reset watched history so they cycle again!
    if (unwatched.length === 0) {
        clearWatched();
        unwatched = [...items];
    }

    // 2. High Randomness Weighted by Preference (Weighted Reservoir Random Permutation)
    // Efraimidis-Spirakis Weighted Random Sampling Algorithm:
    // key = Math.pow(Math.random(), 1 / weight)
    // Sorting by key descending produces a truly random order, where items with higher preference
    // have a mathematically higher probability of appearing earlier, but NEVER in static order!
    const scoredPool = unwatched.map(item => {
        const category = item.category || detectCategory(item.title, item.description);
        item.category = category;

        // Base affinity from user activity (likes, saves, watch-time)
        const affinity = userAffinityMap[category] || 0;
        
        // Weight: higher if preferred, but always positive
        const preferenceWeight = 1.0 + Math.min(15, affinity * 2.5);

        // Stochastic random key (generates high randomness on every single call)
        const randomScore = Math.pow(Math.random(), 1.0 / preferenceWeight);

        return {
            item,
            randomScore
        };
    });

    // Sort by stochastic key descending
    scoredPool.sort((a, b) => b.randomScore - a.randomScore);

    return scoredPool.map(entry => entry.item);
}
