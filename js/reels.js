// ==========================================
// Oops:) — Reels Full-Screen Viewer Logic
// Real aspect-ratio video sizing with letterboxing/borders
// No publisher profiles, no follow buttons
// Interactive like, comment, and save (auth required)
// ==========================================

import { getAllContent, formatNumber, isLiked, isSaved, getLikeCount } from './firebase.js';
import { handleLikeClick, handleSaveClick, openCommentsModal, INTERACTION_ICONS } from './interactions.js';
import { getCurrentUser } from './auth.js';
import { rankContentForUser, recordWatchSession } from './recommendation.js';

let reelsUnsubscribe = null;
let reelsObserver = null;
let currentReelIndex = 0;

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
    'Original Audio — Oops:) Viral Sound',
    'Night Vibes — Lo-Fi Chill',
    'Summer Beat — Golden Wave',
    'Bass Drop — Ultra Club',
    'Acoustic Flow — Peaceful Studio'
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
                        <video src="${item.url}" loop playsinline muted preload="auto" autoplay></video>
                    ` : `
                        <img src="${item.url}" alt="${item.title || ''}">
                    `}
                </div>
            </div>

            <div class="reel-tap-area"></div>
            <div class="reel-play-icon">${REEL_ICONS.play}</div>

            <div class="reel-progress">
                <div class="reel-progress-bar"></div>
            </div>

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
                    <span class="reel-action-count reel-like-num"></span>
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

            <div class="heart-burst" style="z-index:15;">${INTERACTION_ICONS.heartFilled}</div>
        </div>
    `;
}

function attachReelEvents(container) {
    const user = getCurrentUser();

    container.querySelectorAll('.reel-item').forEach(reelItem => {
        const contentId = reelItem.dataset.id;
        const category = reelItem.dataset.category || 'general';

        const likeAction = reelItem.querySelector('.reel-like-action');
        const likeIcon = reelItem.querySelector('.like-icon');
        const likeNum = reelItem.querySelector('.reel-like-num');
        const commentAction = reelItem.querySelector('.reel-comment-action');
        const saveAction = reelItem.querySelector('.reel-save-action');
        const saveIcon = reelItem.querySelector('.save-icon');
        const soundBtn = reelItem.querySelector('.reel-sound-toggle');
        const video = reelItem.querySelector('video');

        // Check if user has liked / saved
        if (user) {
            isLiked(contentId, user.uid, (liked) => {
                if (!likeAction) return;
                likeAction.dataset.liked = liked.toString();
                likeAction.classList.toggle('liked', liked);
                likeIcon.innerHTML = liked ? REEL_ICONS.heartFilled : REEL_ICONS.heart;
            });

            isSaved(contentId, user.uid, (saved) => {
                if (!saveAction) return;
                saveAction.dataset.saved = saved.toString();
                saveAction.classList.toggle('saved', saved);
                saveIcon.innerHTML = saved ? REEL_ICONS.bookmarkFilled : REEL_ICONS.bookmark;
            });
        }

        // Live like count
        getLikeCount(contentId, (count) => {
            if (likeNum) {
                likeNum.textContent = count > 0 ? formatNumber(count) : '0';
            }
        });

        // Like button click
        if (likeAction) {
            likeAction.addEventListener('click', (e) => {
                e.stopPropagation();
                handleLikeClick(contentId, category, likeAction, likeNum);
            });
        }

        // Comment button click
        if (commentAction) {
            commentAction.addEventListener('click', (e) => {
                e.stopPropagation();
                openCommentsModal(contentId, category);
            });
        }

        // Save button click
        if (saveAction) {
            saveAction.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSaveClick(contentId, category, saveAction);
            });
        }

        // Sound toggle
        if (soundBtn && video) {
            soundBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                video.muted = !video.muted;
                const iconEl = soundBtn.querySelector('.sound-icon');
                if (iconEl) {
                    iconEl.innerHTML = video.muted ? REEL_ICONS.volumeOff : REEL_ICONS.volumeOn;
                }
                soundBtn.dataset.muted = video.muted.toString();
            });
        }

        // Tap area: Double tap like, single tap play/pause
        const tapArea = reelItem.querySelector('.reel-tap-area');
        if (tapArea) {
            let lastTap = 0;
            let singleTapTimer = null;

            tapArea.addEventListener('click', () => {
                const now = Date.now();
                if (now - lastTap < 300) {
                    // Double tap like
                    clearTimeout(singleTapTimer);
                    const heartBurst = reelItem.querySelector('.heart-burst');
                    if (heartBurst) {
                        heartBurst.classList.remove('active');
                        void heartBurst.offsetWidth;
                        heartBurst.classList.add('active');
                        setTimeout(() => heartBurst.classList.remove('active'), 800);
                    }
                    handleLikeClick(contentId, category, likeAction, likeNum);
                } else {
                    // Single tap
                    singleTapTimer = setTimeout(() => {
                        if (video) {
                            const playIcon = reelItem.querySelector('.reel-play-icon');
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
                        }
                    }, 220);
                }
                lastTap = now;
            });
        }

        // Progress bar
        if (video) {
            video.addEventListener('timeupdate', () => {
                const progressBar = reelItem.querySelector('.reel-progress-bar');
                if (progressBar && video.duration) {
                    const percent = (video.currentTime / video.duration) * 100;
                    progressBar.style.width = percent + '%';
                }
            });
        }
    });

    // Auto-play active reel with IntersectionObserver & measure watch time
    reelsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            const disc = entry.target.querySelector('.reel-music-disc');
            const contentId = entry.target.dataset.id;
            const category = entry.target.dataset.category || 'general';

            if (entry.isIntersecting) {
                if (video) {
                    video.play().catch(() => {});
                    entry.target._startTime = Date.now();
                }
                if (disc) disc.style.animationPlayState = 'running';
                currentReelIndex = parseInt(entry.target.dataset.index || '0');
            } else {
                if (video) {
                    video.pause();
                    if (entry.target._startTime) {
                        const duration = (Date.now() - entry.target._startTime) / 1000;
                        recordWatchSession(contentId, category, duration, video.duration);
                        entry.target._startTime = 0;
                    }
                }
                if (disc) disc.style.animationPlayState = 'paused';
            }
        });
    }, { threshold: 0.65 });

    container.querySelectorAll('.reel-item').forEach(item => {
        reelsObserver.observe(item);
    });
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

        // Rank reels based on recommendation engine
        const ranked = rankContentForUser(displayItems);

        scrollContainer.innerHTML = ranked.map((item, i) => renderReel(item, i)).join('');
        attachReelEvents(scrollContainer);
    });
}

export function destroyReels() {
    if (reelsUnsubscribe) {
        reelsUnsubscribe();
        reelsUnsubscribe = null;
    }
    if (reelsObserver) {
        reelsObserver.disconnect();
        reelsObserver = null;
    }

    document.querySelectorAll('#reelsView video').forEach(v => {
        try { v.pause(); } catch (e) {}
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
