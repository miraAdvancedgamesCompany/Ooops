// ==========================================
// Oops:) — Reels Full-Screen Viewer Logic
// TikTok-style: Scrubber, ±5s double-tap, ×2 long-press, fixed like state
// Real aspect-ratio video with letterboxing/borders
// No publisher profiles, no follow buttons
// Infinite load: 13 reels at a time, highly randomized
// ==========================================

import { getAllContent, formatNumber, isLiked, isSaved, getLikeCount, incrementViewCount } from './firebase.js';
import { handleLikeClick, handleSaveClick, openCommentsModal, INTERACTION_ICONS } from './interactions.js';
import { getCurrentUser } from './auth.js';
import { rankContentForUser, recordWatchSession, markWatched, clearWatched } from './recommendation.js';

const REELS_BATCH_SIZE = 13;

let reelsUnsubscribe = null;
let reelsObserver = null;
let currentReelIndex = 0;
let allReelsItems = [];
let currentReelsPool = [];
let renderedReelsCount = 0;
let lastKnownReelsPoolSize = 0;

// Per-reel Firebase listener cleanup map (prevents like/save state disappearing)
const reelListenerCleanup = new Map();

export const REEL_ICONS = {
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    heartFilled: `<svg viewBox="0 0 24 24" fill="#ed4956" stroke="#ed4956" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    bookmarkFilled: `<svg viewBox="0 0 24 24" fill="white" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    music: `<svg viewBox="0 0 24 24" fill="white"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    volumeOff: `<svg viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
    volumeOn: `<svg viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`
};

const musicTracks = [
    'Original Audio — Viral Sound',
    'Night Vibes — Lo-Fi Chill',
    'Golden Wave — Summer Beat',
    'Ultra Club — Bass Drop',
    'Peaceful Studio — Acoustic Flow'
];

function getRandomMusic(seed) {
    let h = 0;
    const str = String(seed || '');
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    return musicTracks[Math.abs(h) % musicTracks.length];
}

function renderReel(item, index) {
    const isVideo = item.type === 'video';
    const music = getRandomMusic(item.id);
    const category = item.category || 'general';

    return `
        <div class="reel-item" data-index="${index}" data-id="${item.id}" data-category="${category}">
            <!-- Video Container with real aspect ratio & borders -->
            <div class="reel-video-wrapper">
                <div class="reel-video-stage">
                    ${isVideo ? `
                        <video src="${item.url}" loop playsinline muted preload="auto"></video>
                    ` : `
                        <img src="${item.url}" alt="${escapeHtml(item.title || '')}">
                    `}
                </div>
            </div>

            <!-- Three invisible tap zones: left | center | right -->
            <div class="reel-tap-zones">
                <div class="reel-zone reel-zone-left"></div>
                <div class="reel-zone reel-zone-center"></div>
                <div class="reel-zone reel-zone-right"></div>
            </div>

            <!-- Double-tap flash overlays for seek -->
            <div class="reel-seek-flash reel-seek-left">
                <div class="reel-seek-ripple"></div>
                <span class="reel-seek-label">-5s</span>
            </div>
            <div class="reel-seek-flash reel-seek-right">
                <div class="reel-seek-ripple"></div>
                <span class="reel-seek-label">+5s</span>
            </div>

            <!-- 2x Speed badge -->
            <div class="reel-speed-badge">2×</div>

            <!-- Play/Pause icon flash -->
            <div class="reel-play-icon">${REEL_ICONS.play}</div>

            <!-- Heart burst on double-tap like -->
            <div class="heart-burst" style="z-index:15;">${INTERACTION_ICONS.heartFilled}</div>

            <div class="reel-gradient"></div>

            <!-- Reel Info (Clean: No publisher profile/avatar/follow) -->
            <div class="reel-info">
                ${item.title ? `
                    <div class="reel-title">${escapeHtml(item.title)}</div>
                ` : ''}
                ${item.description ? `
                    <div class="reel-description">${escapeHtml(item.description)}</div>
                ` : ''}
                <div class="reel-music">
                    ${REEL_ICONS.music}
                    <div class="reel-music-text">
                        <span class="reel-music-marquee">${music} &nbsp;&nbsp;&nbsp; ${music}</span>
                    </div>
                </div>
            </div>

            <!-- Side Action Controls: Sound, Like, Comment, Save -->
            <div class="reel-actions">
                <div class="reel-action-item reel-sound-toggle" data-muted="true" title="Toggle Sound">
                    <div class="reel-action-icon sound-icon">${REEL_ICONS.volumeOff}</div>
                    <span class="reel-action-count">Sound</span>
                </div>

                <div class="reel-action-item reel-like-action" data-liked="false" title="Like">
                    <div class="reel-action-icon like-icon">${REEL_ICONS.heart}</div>
                    <span class="reel-action-count reel-like-num">0</span>
                </div>

                <div class="reel-action-item reel-comment-action" title="Comments">
                    <div class="reel-action-icon">${REEL_ICONS.comment}</div>
                    <span class="reel-action-count">Chat</span>
                </div>

                <div class="reel-action-item reel-save-action" data-saved="false" title="Save">
                    <div class="reel-action-icon save-icon">${REEL_ICONS.bookmark}</div>
                    <span class="reel-action-count">Save</span>
                </div>

                <div class="reel-music-disc" title="Audio">
                    <div class="reel-music-disc-inner"></div>
                </div>
            </div>

            <!-- Draggable scrubber bar at bottom -->
            <div class="reel-scrubber-wrap">
                <input type="range" class="reel-scrubber" min="0" max="100" value="0" step="0.1">
            </div>
        </div>
    `;
}

function attachReelEvents(elements) {
    const user = getCurrentUser();

    elements.forEach(reelItem => {
        const contentId = reelItem.dataset.id;
        const category = reelItem.dataset.category || 'general';

        const likeAction  = reelItem.querySelector('.reel-like-action');
        const likeIcon    = likeAction ? likeAction.querySelector('.like-icon') : null;
        const likeNum     = reelItem.querySelector('.reel-like-num');
        const commentAction = reelItem.querySelector('.reel-comment-action');
        const saveAction  = reelItem.querySelector('.reel-save-action');
        const saveIcon    = saveAction ? saveAction.querySelector('.save-icon') : null;
        const soundBtn    = reelItem.querySelector('.reel-sound-toggle');
        const video       = reelItem.querySelector('video');
        const scrubber    = reelItem.querySelector('.reel-scrubber');
        const playIcon    = reelItem.querySelector('.reel-play-icon');
        const heartBurst  = reelItem.querySelector('.heart-burst');
        const speedBadge  = reelItem.querySelector('.reel-speed-badge');
        const seekFlashL  = reelItem.querySelector('.reel-seek-left');
        const seekFlashR  = reelItem.querySelector('.reel-seek-right');
        const zoneLeft    = reelItem.querySelector('.reel-zone-left');
        const zoneCenter  = reelItem.querySelector('.reel-zone-center');
        const zoneRight   = reelItem.querySelector('.reel-zone-right');

        // Cleanup any previous Firebase listeners for this reel (prevents state disappearing)
        if (reelListenerCleanup.has(contentId)) {
            reelListenerCleanup.get(contentId).forEach(fn => { try { fn(); } catch(e) {} });
            reelListenerCleanup.delete(contentId);
        }
        const cleanupFns = [];

        // Like & Save: persistent real-time state, never resets
        if (user) {
            const unsubLike = isLiked(contentId, user.uid, (liked) => {
                if (!likeAction) return;
                likeAction.dataset.liked = liked.toString();
                likeAction.classList.toggle('liked', liked);
                if (likeIcon) likeIcon.innerHTML = liked ? REEL_ICONS.heartFilled : REEL_ICONS.heart;
            });
            cleanupFns.push(unsubLike);

            const unsubSave = isSaved(contentId, user.uid, (saved) => {
                if (!saveAction) return;
                saveAction.dataset.saved = saved.toString();
                saveAction.classList.toggle('saved', saved);
                if (saveIcon) saveIcon.innerHTML = saved ? REEL_ICONS.bookmarkFilled : REEL_ICONS.bookmark;
            });
            cleanupFns.push(unsubSave);
        }

        const unsubCount = getLikeCount(contentId, (count) => {
            if (likeNum) likeNum.textContent = count > 0 ? formatNumber(count) : '0';
        });
        cleanupFns.push(unsubCount);
        reelListenerCleanup.set(contentId, cleanupFns);

        // Like click
        if (likeAction) likeAction.addEventListener('click', (e) => { e.stopPropagation(); handleLikeClick(contentId, category, likeAction, likeNum); });
        // Comment click
        if (commentAction) commentAction.addEventListener('click', (e) => { e.stopPropagation(); openCommentsModal(contentId, category); });
        // Sound toggle
        if (soundBtn && video) {
            soundBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                video.muted = !video.muted;
                const iconEl = soundBtn.querySelector('.sound-icon');
                if (iconEl) iconEl.innerHTML = video.muted ? REEL_ICONS.volumeOff : REEL_ICONS.volumeOn;
                soundBtn.dataset.muted = video.muted.toString();
            });
        }

        // Helper: trigger seek flash animation
        function triggerSeekFlash(el) {
            if (!el) return;
            el.classList.remove('active');
            void el.offsetWidth;
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 700);
        }

        // Helper: attach long-press (500ms) handler to a zone
        function attachLongPress(zone, onStart, onEnd) {
            if (!zone) return;
            let timer = null;
            let active = false;
            const start = () => { active = false; timer = setTimeout(() => { active = true; onStart(); }, 500); };
            const end   = () => { clearTimeout(timer); if (active) { onEnd(); active = false; } };
            zone._lpActive = () => active;
            zone.addEventListener('touchstart', start, { passive: true });
            zone.addEventListener('touchend',   end,   { passive: true });
            zone.addEventListener('mousedown',  start);
            zone.addEventListener('mouseup',    end);
            zone.addEventListener('mouseleave', end);
        }

        // CENTER: single tap = play/pause, double-tap = like + heart burst
        if (zoneCenter && video) {
            let lastCenterTap = 0;
            let centerTimer = null;
            zoneCenter.addEventListener('click', () => {
                const now = Date.now();
                if (now - lastCenterTap < 320) {
                    clearTimeout(centerTimer);
                    if (heartBurst) {
                        heartBurst.classList.remove('active');
                        void heartBurst.offsetWidth;
                        heartBurst.classList.add('active');
                        setTimeout(() => heartBurst.classList.remove('active'), 800);
                    }
                    handleLikeClick(contentId, category, likeAction, likeNum);
                } else {
                    centerTimer = setTimeout(() => {
                        if (video.paused) {
                            video.play().catch(() => {});
                            if (playIcon) playIcon.innerHTML = REEL_ICONS.pause;
                        } else {
                            video.pause();
                            if (playIcon) playIcon.innerHTML = REEL_ICONS.play;
                        }
                        if (playIcon) {
                            playIcon.classList.remove('show');
                            void playIcon.offsetWidth;
                            playIcon.classList.add('show');
                        }
                    }, 230);
                }
                lastCenterTap = now;
            });
        }

        // LEFT: double-tap = -5s | long-press = 2x speed
        if (zoneLeft && video) {
            attachLongPress(zoneLeft,
                () => { video.playbackRate = 2.0; if (speedBadge) speedBadge.classList.add('active'); },
                () => { video.playbackRate = 1.0; if (speedBadge) speedBadge.classList.remove('active'); }
            );
            let lastLeftTap = 0;
            zoneLeft.addEventListener('click', () => {
                if (zoneLeft._lpActive && zoneLeft._lpActive()) return;
                const now = Date.now();
                if (now - lastLeftTap < 320) {
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    triggerSeekFlash(seekFlashL);
                }
                lastLeftTap = now;
            });
        }

        // RIGHT: double-tap = +5s | long-press = 2x speed
        if (zoneRight && video) {
            attachLongPress(zoneRight,
                () => { video.playbackRate = 2.0; if (speedBadge) speedBadge.classList.add('active'); },
                () => { video.playbackRate = 1.0; if (speedBadge) speedBadge.classList.remove('active'); }
            );
            let lastRightTap = 0;
            zoneRight.addEventListener('click', () => {
                if (zoneRight._lpActive && zoneRight._lpActive()) return;
                const now = Date.now();
                if (now - lastRightTap < 320) {
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
                    triggerSeekFlash(seekFlashR);
                }
                lastRightTap = now;
            });
        }

        // Draggable scrubber
        if (scrubber && video) {
            let isScrubbing = false;
            scrubber.addEventListener('mousedown',  () => { isScrubbing = true; });
            scrubber.addEventListener('touchstart', () => { isScrubbing = true; }, { passive: true });
            scrubber.addEventListener('input', (e) => {
                e.stopPropagation();
                if (video.duration) video.currentTime = (parseFloat(e.target.value) / 100) * video.duration;
            });
            scrubber.addEventListener('mouseup',  () => { isScrubbing = false; });
            scrubber.addEventListener('touchend', () => { isScrubbing = false; }, { passive: true });
            video.addEventListener('timeupdate', () => {
                if (!isScrubbing && video.duration) {
                    scrubber.value = (video.currentTime / video.duration) * 100;
                }
            });
        }

        if (reelsObserver) reelsObserver.observe(reelItem);
    });
}



function loadNextReelsBatch() {
    const scrollContainer = document.getElementById('reelsScroll');
    if (!scrollContainer || allReelsItems.length === 0) return;

    // If user has reached the end of current pool, recycle watched history and re-rank
    if (renderedReelsCount >= currentReelsPool.length) {
        clearWatched();
        const recycled = rankContentForUser(allReelsItems);
        currentReelsPool = currentReelsPool.concat(recycled);
    }

    const nextBatch = currentReelsPool.slice(renderedReelsCount, renderedReelsCount + REELS_BATCH_SIZE);
    if (nextBatch.length === 0) return;

    // Loading indicator ("l'ording")
    const loadingSlide = document.createElement('div');
    loadingSlide.className = 'reel-item reel-batch-loading';
    loadingSlide.innerHTML = `<div class="loading-spinner"></div>`;
    scrollContainer.appendChild(loadingSlide);

    setTimeout(() => {
        if (loadingSlide.parentNode) loadingSlide.remove();
        const startIndex = renderedReelsCount;
        renderedReelsCount += nextBatch.length;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nextBatch.map((item, i) => renderReel(item, startIndex + i)).join('');
        const newReelElements = Array.from(tempDiv.children);
        newReelElements.forEach(el => scrollContainer.appendChild(el));
        attachReelEvents(newReelElements);
    }, 350);
}

function setupReelsObserver() {
    if (reelsObserver) reelsObserver.disconnect();

    reelsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.target.classList.contains('reel-batch-loading')) return;
            const video      = entry.target.querySelector('video');
            const disc       = entry.target.querySelector('.reel-music-disc');
            const contentId  = entry.target.dataset.id;
            const category   = entry.target.dataset.category || 'general';
            const index      = parseInt(entry.target.dataset.index || '0');

            if (entry.isIntersecting) {
                if (video) {
                    video.play().catch(() => {});
                    entry.target._startTime = Date.now();
                    markWatched(contentId);
                    incrementViewCount(contentId);
                }
                if (disc) disc.style.animationPlayState = 'running';
                currentReelIndex = index;
                if (currentReelIndex >= renderedReelsCount - 3) {
                    loadNextReelsBatch();
                }
            } else {
                if (video) {
                    video.pause();
                    video.playbackRate = 1.0;
                    if (entry.target._startTime) {
                        const dur = (Date.now() - entry.target._startTime) / 1000;
                        recordWatchSession(contentId, category, dur, video.duration);
                        entry.target._startTime = 0;
                    }
                }
                if (disc) disc.style.animationPlayState = 'paused';
            }
        });
    }, { threshold: 0.65 });
}

export function initReels() {
    const container = document.getElementById('reelsView');
    if (!container) return;

    container.innerHTML = `
        <div class="reels-container" id="reelsScroll">
            <div class="reels-loading">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;

    document.querySelector('.app-header')?.classList.add('hidden');
    document.querySelector('.main-content')?.classList.add('reels-mode');
    document.querySelector('.bottom-nav')?.classList.add('transparent');

    if (reelsUnsubscribe) reelsUnsubscribe();

    reelsUnsubscribe = getAllContent((items) => {
        const scrollContainer = document.getElementById('reelsScroll');
        if (!scrollContainer) return;

        const videoItems = items.filter(i => i.type === 'video');
        const displayItems = videoItems.length > 0 ? videoItems : items;

        allReelsItems = displayItems;

        // Guard: only re-rank if pool size changed (fixes Firebase onValue re-trigger bug)
        if (displayItems.length === lastKnownReelsPoolSize && renderedReelsCount > 0) return;
        lastKnownReelsPoolSize = displayItems.length;

        currentReelsPool = rankContentForUser(displayItems);
        renderedReelsCount = 0;
        scrollContainer.innerHTML = '';

        setupReelsObserver();

        const initialBatch = currentReelsPool.slice(0, REELS_BATCH_SIZE);
        renderedReelsCount = initialBatch.length;
        scrollContainer.innerHTML = initialBatch.map((item, i) => renderReel(item, i)).join('');
        const initialElements = Array.from(scrollContainer.querySelectorAll('.reel-item'));
        attachReelEvents(initialElements);
    });
}

export function destroyReels() {
    if (reelsUnsubscribe) { reelsUnsubscribe(); reelsUnsubscribe = null; }
    if (reelsObserver)   { reelsObserver.disconnect(); reelsObserver = null; }

    // Cleanup all Firebase listeners
    reelListenerCleanup.forEach((fns) => fns.forEach(fn => { try { fn(); } catch(e) {} }));
    reelListenerCleanup.clear();

    lastKnownReelsPoolSize = 0;
    renderedReelsCount = 0;

    document.querySelectorAll('#reelsView video').forEach(v => {
        try { v.pause(); v.playbackRate = 1.0; } catch (e) {}
    });

    document.querySelector('.app-header')?.classList.remove('hidden');
    document.querySelector('.main-content')?.classList.remove('reels-mode');
    document.querySelector('.bottom-nav')?.classList.remove('transparent');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}
