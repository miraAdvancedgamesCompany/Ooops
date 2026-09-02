// ==========================================
// Oops:) — Firebase Configuration & Helpers
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, push, set, get, onValue, remove, update, query, orderByChild, limitToLast, equalTo } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxSCsufdqcZyBiBQeFVw4JYObeQAl7zsw",
    authDomain: "its116so.firebaseapp.com",
    databaseURL: "https://its116so-default-rtdb.firebaseio.com",
    projectId: "its116so",
    storageBucket: "its116so.firebasestorage.app",
    messagingSenderId: "420035063931",
    appId: "1:420035063931:web:9dced5c8c5429ef45172de",
    measurementId: "G-JH9FBWWKXZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider, ref, push, set, get, onValue, remove, update, query, orderByChild, limitToLast, equalTo, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile };

// ---- Default Built-in Seed Data (for instant viewing & fallback) ----
export const DEFAULT_CONTENT = [
    {
        id: 'seed_01', type: 'video',
        title: 'Neon City Lights & Night Vibes ✨',
        description: 'Late night drives through Tokyo streets. The neon reflections in the rain are magical #nightvibes #tokyo #cinematic',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-neon-sign-on-a-building-42537-large.mp4',
        likes: 14200, views: 85000, comments: 384, timestamp: Date.now() - 1000 * 60 * 30,
        category: 'nightlife'
    },
    {
        id: 'seed_02', type: 'video',
        title: 'Sunset Skatepark Session 🛹',
        description: 'Golden hour lines at Venice Beach. Never stop rolling 🌅 #skate #goldenhour #reels #sunset',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-skatepark-at-sunset-42516-large.mp4',
        likes: 9820, views: 52400, comments: 215, timestamp: Date.now() - 1000 * 60 * 90,
        category: 'sports'
    },
    {
        id: 'seed_03', type: 'video',
        title: 'DJ Club Energy 🔥',
        description: 'Weekend festival vibes! The drop was unreal 🎧🔊 #dj #edm #club #party #music',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-a-dj-playing-music-in-a-club-42544-large.mp4',
        likes: 23400, views: 142000, comments: 612, timestamp: Date.now() - 1000 * 60 * 180,
        category: 'music'
    },
    {
        id: 'seed_04', type: 'video',
        title: 'Dancing in the Golden Wildflower Field 🌾',
        description: 'Pure joy and freedom. Nature heals everything 💛 #dance #nature #freedom #aesthetic',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-woman-dancing-in-a-field-42526-large.mp4',
        likes: 18750, views: 98000, comments: 430, timestamp: Date.now() - 1000 * 60 * 300,
        category: 'dance'
    },
    {
        id: 'seed_05', type: 'video',
        title: 'Hidden Forest Waterfall 🌿🌊',
        description: 'Found this secret paradise deep in the rainforest #waterfall #travel #naturelovers #explore',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-waterfall-in-a-lush-forest-42512-large.mp4',
        likes: 31200, views: 180000, comments: 780, timestamp: Date.now() - 1000 * 60 * 450,
        category: 'nature'
    },
    {
        id: 'seed_06', type: 'video',
        title: 'City Highway Speed Light Trails 🚗💨',
        description: 'Long exposure speed lapse over the metropolitan bridge #cyberpunk #timelapse #citylights',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-city-at-night-with-light-trails-42539-large.mp4',
        likes: 12500, views: 67000, comments: 198, timestamp: Date.now() - 1000 * 60 * 600,
        category: 'nightlife'
    },
    {
        id: 'seed_07', type: 'video',
        title: 'Ocean Waves Crashing in 4K 🌊',
        description: 'Listen to the rhythm of the waves. Instant peace of mind #ocean #relax #meditation #waves',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
        likes: 27800, views: 156000, comments: 540, timestamp: Date.now() - 1000 * 60 * 800,
        category: 'nature'
    },
    {
        id: 'seed_08', type: 'video',
        title: 'Breeze Through the Cherry Blossoms 🌸',
        description: 'Spring in Kyoto is a dream come true #sakura #spring #japan #calm',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-branches-in-the-breeze-1188-large.mp4',
        likes: 15600, views: 89000, comments: 312, timestamp: Date.now() - 1000 * 60 * 1200,
        category: 'nature'
    },
    {
        id: 'seed_09', type: 'image',
        title: 'Cozy Coffee & Minimalist Aesthetics ☕',
        description: 'Morning rituals. Slow down and enjoy the simple moments #coffee #aesthetic #morning #minimal',
        url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=80',
        likes: 8420, views: 41000, comments: 120, timestamp: Date.now() - 1000 * 60 * 1500,
        category: 'lifestyle'
    },
    {
        id: 'seed_10', type: 'image',
        title: 'Moody Mountain Fog Peak 🏔️',
        description: 'Above the clouds in the Swiss Alps. Silence is golden #mountains #wanderlust #hiking',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
        likes: 19300, views: 112000, comments: 450, timestamp: Date.now() - 1000 * 60 * 2000,
        category: 'travel'
    },
    {
        id: 'seed_11', type: 'image',
        title: 'Cyberpunk Neon Alleyways 🏮',
        description: 'Lost in the glowing backstreets of Shinjuku #tokyo #cyberpunk #streetphotography',
        url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80',
        likes: 22100, views: 134000, comments: 510, timestamp: Date.now() - 1000 * 60 * 2500,
        category: 'nightlife'
    }
];

// ---- Content CRUD ----

export function addContent(contentData) {
    const contentRef = ref(db, 'content');
    const newRef = push(contentRef);
    return set(newRef, {
        ...contentData,
        timestamp: Date.now(),
        likes: 0,
        views: 0,
        comments: 0
    });
}

export function seedAllDefaultData() {
    const promises = DEFAULT_CONTENT.map(item => {
        const contentRef = ref(db, 'content');
        const newRef = push(contentRef);
        return set(newRef, {
            type: item.type,
            title: item.title,
            description: item.description,
            url: item.url,
            likes: item.likes,
            views: item.views,
            comments: item.comments,
            timestamp: item.timestamp,
            category: item.category || 'general'
        });
    });
    return Promise.all(promises);
}

export function getAllContent(callback) {
    const contentRef = ref(db, 'content');
    return onValue(contentRef, (snapshot) => {
        const data = snapshot.val();
        if (data && Object.keys(data).length > 0) {
            const items = Object.entries(data).map(([id, val]) => ({ id, ...val }));
            callback(items);
        } else {
            callback(DEFAULT_CONTENT);
        }
    }, (error) => {
        console.warn('Firebase error/permission note, using fallback content:', error);
        callback(DEFAULT_CONTENT);
    });
}

export function deleteContent(id) {
    return remove(ref(db, `content/${id}`));
}

export function updateContent(id, data) {
    return update(ref(db, `content/${id}`), data);
}

// ---- User CRUD ----

export function createUserProfile(uid, profileData) {
    return set(ref(db, `users/${uid}`), {
        ...profileData,
        createdAt: Date.now(),
        role: 'user',
        banned: false
    });
}

export function getUserProfile(uid) {
    return get(ref(db, `users/${uid}`));
}

export function updateUserProfile(uid, data) {
    return update(ref(db, `users/${uid}`), data);
}

export function getAllUsers(callback) {
    return onValue(ref(db, 'users'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const users = Object.entries(data).map(([uid, val]) => ({ uid, ...val }));
            callback(users);
        } else {
            callback([]);
        }
    });
}

export async function isUsernameTaken(username) {
    const snapshot = await get(ref(db, 'usernames'));
    const data = snapshot.val();
    if (!data) return false;
    return Object.values(data).includes(username.toLowerCase());
}

export function reserveUsername(uid, username) {
    return set(ref(db, `usernames/${uid}`), username.toLowerCase());
}

// ---- Interaction Helpers ----

export function toggleLike(contentId, userId) {
    const likeRef = ref(db, `likes/${contentId}/${userId}`);
    return get(likeRef).then(snapshot => {
        if (snapshot.exists()) {
            remove(likeRef);
            remove(ref(db, `userLikes/${userId}/${contentId}`));
            return false;
        } else {
            set(likeRef, { timestamp: Date.now() });
            set(ref(db, `userLikes/${userId}/${contentId}`), { timestamp: Date.now() });
            return true;
        }
    });
}

export function isLiked(contentId, userId, callback) {
    return onValue(ref(db, `likes/${contentId}/${userId}`), (snap) => {
        callback(snap.exists());
    });
}

export function getLikeCount(contentId, callback) {
    return onValue(ref(db, `likes/${contentId}`), (snap) => {
        const data = snap.val();
        callback(data ? Object.keys(data).length : 0);
    });
}

export function addComment(contentId, userId, displayName, text) {
    const commentRef = push(ref(db, `comments/${contentId}`));
    return set(commentRef, {
        userId,
        displayName,
        text,
        timestamp: Date.now()
    });
}

export function getComments(contentId, callback) {
    return onValue(ref(db, `comments/${contentId}`), (snap) => {
        const data = snap.val();
        if (data) {
            const comments = Object.entries(data).map(([id, val]) => ({ id, ...val }));
            comments.sort((a, b) => b.timestamp - a.timestamp);
            callback(comments);
        } else {
            callback([]);
        }
    });
}

export function toggleSave(contentId, userId) {
    const saveRef = ref(db, `saves/${userId}/${contentId}`);
    return get(saveRef).then(snapshot => {
        if (snapshot.exists()) {
            remove(saveRef);
            return false;
        } else {
            set(saveRef, { timestamp: Date.now() });
            return true;
        }
    });
}

export function isSaved(contentId, userId, callback) {
    return onValue(ref(db, `saves/${userId}/${contentId}`), (snap) => {
        callback(snap.exists());
    });
}

export function getUserSaves(userId, callback) {
    return onValue(ref(db, `saves/${userId}`), (snap) => {
        const data = snap.val();
        if (data) {
            const saves = Object.entries(data).map(([contentId, val]) => ({ contentId, ...val }));
            saves.sort((a, b) => b.timestamp - a.timestamp);
            callback(saves);
        } else {
            callback([]);
        }
    });
}

export function getUserLikes(userId, callback) {
    return onValue(ref(db, `userLikes/${userId}`), (snap) => {
        const data = snap.val();
        if (data) {
            const likes = Object.entries(data).map(([contentId, val]) => ({ contentId, ...val }));
            likes.sort((a, b) => b.timestamp - a.timestamp);
            callback(likes);
        } else {
            callback([]);
        }
    });
}

// ---- User Interests / Recommendation ----

export function trackInteraction(userId, contentId, category, type) {
    // type: 'like', 'save', 'comment', 'watch', 'skip', 'replay'
    const weights = { like: 3, save: 5, comment: 4, watch: 1, skip: -1, replay: 4 };
    const weight = weights[type] || 1;

    const interestRef = ref(db, `userInterests/${userId}/${category}`);
    return get(interestRef).then(snap => {
        const current = snap.val() || 0;
        return set(interestRef, Math.max(0, current + weight));
    });
}

export function getUserInterests(userId, callback) {
    return onValue(ref(db, `userInterests/${userId}`), (snap) => {
        callback(snap.val() || {});
    });
}

// ---- Admin Helpers ----

export function banUser(uid) {
    return update(ref(db, `users/${uid}`), { banned: true });
}

export function unbanUser(uid) {
    return update(ref(db, `users/${uid}`), { banned: false });
}

export function deleteUser(uid) {
    return Promise.all([
        remove(ref(db, `users/${uid}`)),
        remove(ref(db, `usernames/${uid}`)),
        remove(ref(db, `userLikes/${uid}`)),
        remove(ref(db, `saves/${uid}`)),
        remove(ref(db, `userInterests/${uid}`))
    ]);
}

export function getSiteStats(callback) {
    const stats = { totalContent: 0, totalUsers: 0, totalLikes: 0, totalComments: 0 };

    get(ref(db, 'content')).then(snap => {
        stats.totalContent = snap.exists() ? Object.keys(snap.val()).length : 0;
        return get(ref(db, 'users'));
    }).then(snap => {
        stats.totalUsers = snap.exists() ? Object.keys(snap.val()).length : 0;
        return get(ref(db, 'likes'));
    }).then(snap => {
        if (snap.exists()) {
            const data = snap.val();
            Object.values(data).forEach(contentLikes => {
                stats.totalLikes += Object.keys(contentLikes).length;
            });
        }
        return get(ref(db, 'comments'));
    }).then(snap => {
        if (snap.exists()) {
            const data = snap.val();
            Object.values(data).forEach(contentComments => {
                stats.totalComments += Object.keys(contentComments).length;
            });
        }
        callback(stats);
    }).catch(() => callback(stats));
}

// ---- Utility Helpers ----

export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function timeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

export function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
}

// ---- Content Categories ----
export const CONTENT_CATEGORIES = [
    'pussy', 'anime', 'hentai', 'chudai', 'pornhub',
    'teengirl', 'onlyfan', 'tiktok', 'comedy', 'cartoon', 'ass',
    'general', 'music', 'dance', 'sports', 'gaming', 'nature', 'travel', 'art'
];

export function detectCategory(title, description) {
    const text = ((title || '') + ' ' + (description || '')).toLowerCase();
    const keywords = {
        music: ['music', 'song', 'dj', 'beat', 'edm', 'guitar', 'piano', 'concert', 'festival', '🎵', '🎧', '🎶'],
        dance: ['dance', 'dancing', 'choreography', 'moves', '💃'],
        comedy: ['funny', 'comedy', 'laugh', 'joke', 'humor', 'meme', '😂', '🤣'],
        sports: ['sport', 'skate', 'football', 'basketball', 'soccer', 'workout', 'gym', 'fitness', '⚽', '🏀', '🛹'],
        gaming: ['game', 'gaming', 'gamer', 'esports', 'stream', '🎮'],
        food: ['food', 'cook', 'recipe', 'chef', 'eating', 'restaurant', '🍕', '🍔'],
        travel: ['travel', 'trip', 'adventure', 'explore', 'wander', 'mountain', 'hiking', '✈️', '🏔️'],
        fashion: ['fashion', 'style', 'outfit', 'clothing', 'dress', '👗'],
        art: ['art', 'paint', 'draw', 'creative', 'design', 'animation', 'cgi', '🎨'],
        tech: ['tech', 'code', 'programming', 'gadget', 'ai', 'robot', '💻'],
        nature: ['nature', 'forest', 'ocean', 'waterfall', 'flower', 'tree', 'blossom', 'wave', '🌿', '🌊', '🌸'],
        nightlife: ['night', 'neon', 'city', 'club', 'party', 'urban', 'cyberpunk', '🌃'],
        lifestyle: ['coffee', 'aesthetic', 'minimal', 'cozy', 'morning', 'routine', 'calm', '☕'],
        fitness: ['fitness', 'workout', 'exercise', 'gym', 'muscle', '💪'],
        beauty: ['beauty', 'makeup', 'skincare', 'glow', '💄'],
        pets: ['pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', '🐶', '🐱']
    };

    let bestCategory = 'general';
    let bestScore = 0;

    for (const [cat, words] of Object.entries(keywords)) {
        let score = 0;
        for (const word of words) {
            if (text.includes(word)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = cat;
        }
    }
    return bestCategory;
}
