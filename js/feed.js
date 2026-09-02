// ==========================================
// Oops:) — Feed Page Logic (Clean Video Showcase)
// No publisher profiles, no fake views/stats
// Highly randomized by user preference
// Infinite scroll: 13 videos per batch
// ==========================================

import { getAllContent, timeAgo, formatNumber, isLiked, isSaved, getLikeCount, incrementViewCount } from './firebase.js';
import { handleLikeClick, handleSaveClick, openCommentsModal, INTERACTION_ICONS } from './interactions.js';
import { getCurrentUser } from './auth.js';
import { rankContentForUser, recordWatchSession, markWatched, clearWatched } from './recommendation.js';

const BATCH_SIZE = 13;

let feedUnsubscribe = null;
let activePostObservers = [];
let feedScrollSentinelObserver = null;
let allFeedItems = [];
let currentFeedPool = [];
let renderedCount = 0;
let lastKnownFeedPoolSize = 0;

function renderSkeletons(count = 2) {
    return Array(count).fill('').map(() => `
        <div class="feed-skeleton">
            <div class="skeleton feed-skeleton-media"></div>
            <div class="feed-skeleton-actions">
                <div class="skeleton feed-skeleton-action"></div>
                <div class="skeleton feed-skeleton-action"></div>
                <div class="skeleton feed-skeleton-action" style="margin-left:auto;"></div>
            </div>
            <div class="skeleton skeleton-text" style="width:75%"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    `).join('');
}

function renderPost(item) {
    const isVideo = item.type === 'video';
    const category = item.category || 'general';

    return `
        <article class="feed-post" data-id="${item.id}" data-category="${category}">
            <!-- Media Area: Clean, No publisher avatar/username header -->
            <div class="post-media" data-type="${item.type}" data-url="${item.url}">
                ${isVideo ? `
                    <video src="${item.url}" loop playsinline muted preload="metadata"></video>
                ` : `
                    <img src="${item.url}" alt="${escapeHtml(item.title || '')}" loading="lazy">
                `}
                <div class="heart-burst">${INTERACTION_ICONS.heartFilled}</div>
                ${isVideo ? `
                    <div class="play-pause-indicator">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                    <button class="mute-btn" data-muted="true" aria-label="Toggle Mute">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                    </button>
                    <button class="fullscreen-btn" aria-label="Fullscreen">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                    </button>
                    <div class="feed-scrubber-wrap">
                        <input type="range" class="feed-scrubber" min="0" max="100" value="0" step="0.1">
                    </div>
                ` : ''}
            </div>

            <!-- Action Bar: Like, Comment, Save -->
            <div class="post-actions">
                <div class="post-actions-left">
                    <button class="action-btn like-btn" data-liked="false" aria-label="Like">
                        <span class="icon-slot">${INTERACTION_ICONS.heart}</span>
                        <span class="action-count like-count"></span>
                    </button>
                    <button class="action-btn comment-btn" aria-label="Comment">
                        <span class="icon-slot">${INTERACTION_ICONS.comment}</span>
                    </button>
                </div>
                <div class="post-actions-right">
                    <button class="action-btn save-btn" data-saved="false" aria-label="Save">
                        <span class="icon-slot">${INTERACTION_ICONS.bookmark}</span>
                    </button>
                </div>
            </div>

            <!-- Caption / Details -->
            ${item.title || item.description ? `
                <div class="post-caption">
                    <span class="caption-title">${escapeHtml(item.title || '')}</span>
                    ${item.description && item.description !== item.title ? `
                        <span class="caption-text">${escapeHtml(item.description)}</span>
                    ` : ''}
                </div>
            ` : ''}

            <div class="post-timestamp">${timeAgo(item.timestamp)}</div>
        </article>
    `;
}

function attachPostEvents(elements) {
    const user = getCurrentUser();

    elements.forEach(post => {
        const contentId = post.dataset.id;
        const category = post.dataset.category || 'general';

        const likeBtn = post.querySelector('.like-btn');
        const likeCountEl = post.querySelector('.like-count');
        const commentBtn = post.querySelector('.comment-btn');
        const saveBtn = post.querySelector('.save-btn');
        const media = post.querySelector('.post-media');
        const video = post.querySelector('video');

        // Check if current user has liked/saved this item
        if (user) {
            isLiked(contentId, user.uid, (liked) => {
                if (!likeBtn) return;
                likeBtn.dataset.liked = liked.toString();
                likeBtn.classList.toggle('liked', liked);
                likeBtn.querySelector('.icon-slot').innerHTML = liked ? INTERACTION_ICONS.heartFilled : INTERACTION_ICONS.heart;
            });

            isSaved(contentId, user.uid, (saved) => {
                if (!saveBtn) return;
                saveBtn.dataset.saved = saved.toString();
                saveBtn.classList.toggle('saved', saved);
                saveBtn.querySelector('.icon-slot').innerHTML = saved ? INTERACTION_ICONS.bookmarkFilled : INTERACTION_ICONS.bookmark;
            });
        }

        // Realtime like count
        getLikeCount(contentId, (count) => {
            if (likeCountEl) {
                likeCountEl.textContent = count > 0 ? formatNumber(count) : '';
            }
        });

        // Like button click
        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleLikeClick(contentId, category, likeBtn, likeCountEl);
            });
        }

        // Comment button click
        if (commentBtn) {
            commentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCommentsModal(contentId, category);
            });
        }

        // Save button click
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSaveClick(contentId, category, saveBtn);
            });
        }

        // Double tap on media to like + single tap to play/pause
        if (media) {
            let lastTap = 0;
            media.addEventListener('click', (e) => {
                if (e.target.closest('.mute-btn')) return;

                const now = Date.now();
                if (now - lastTap < 300) {
                    // Double tap like
                    const heartBurst = media.querySelector('.heart-burst');
                    if (heartBurst) {
                        heartBurst.classList.remove('active');
                        void heartBurst.offsetWidth;
                        heartBurst.classList.add('active');
                        setTimeout(() => heartBurst.classList.remove('active'), 800);
                    }
                    handleLikeClick(contentId, category, likeBtn, likeCountEl);
                } else {
                    // Single tap play/pause
                    if (video) {
                        const indicator = media.querySelector('.play-pause-indicator');
                        if (video.paused) {
                            video.play().catch(() => {});
                        } else {
                            video.pause();
                        }
                        if (indicator) {
                            indicator.classList.remove('show');
                            void indicator.offsetWidth;
                            indicator.classList.add('show');
                        }
                    }
                }
                lastTap = now;
            });
        }

        // Mute button
        const muteBtn = post.querySelector('.mute-btn');
        if (muteBtn && video) {
            muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                video.muted = !video.muted;
                muteBtn.dataset.muted = video.muted.toString();
                muteBtn.innerHTML = video.muted ?
                    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>` :
                    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
            });
        }

        // Fullscreen button
        const fullscreenBtn = post.querySelector('.fullscreen-btn');
        if (fullscreenBtn && video) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (video.requestFullscreen) video.requestFullscreen();
                else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
            });
        }

        // Feed scrubber
        const feedScrubber = post.querySelector('.feed-scrubber');
        if (feedScrubber && video) {
            let isScrubbing = false;
            feedScrubber.addEventListener('mousedown', () => { isScrubbing = true; });
            feedScrubber.addEventListener('touchstart', () => { isScrubbing = true; }, { passive: true });
            feedScrubber.addEventListener('input', (e) => {
                e.stopPropagation();
                if (video.duration) video.currentTime = (parseFloat(e.target.value) / 100) * video.duration;
            });
            feedScrubber.addEventListener('mouseup', () => { isScrubbing = false; });
            feedScrubber.addEventListener('touchend', () => { isScrubbing = false; }, { passive: true });
            video.addEventListener('timeupdate', () => {
                if (!isScrubbing && video.duration) feedScrubber.value = (video.currentTime / video.duration) * 100;
            });
        }

        // Watch session measurement for recommendation & marking as watched
        if (video) {
            let sessionStartTime = 0;
            let totalWatched = 0;
            let viewCounted = false;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        video.play().catch(() => {});
                        sessionStartTime = Date.now();
                        markWatched(contentId);
                        // Count real view after 3 seconds in viewport
                        if (!viewCounted) {
                            setTimeout(() => {
                                if (sessionStartTime > 0) {
                                    incrementViewCount(contentId);
                                    viewCounted = true;
                                }
                            }, 3000);
                        }
                    } else {
                        video.pause();
                        if (sessionStartTime > 0) {
                            totalWatched += (Date.now() - sessionStartTime) / 1000;
                            sessionStartTime = 0;
                            recordWatchSession(contentId, category, totalWatched, video.duration);
                        }
                    }
                });
            }, { threshold: 0.55 });

            observer.observe(post);
            activePostObservers.push(observer);
        }
    });
}

function loadNextFeedBatch() {
    const feedContainer = document.getElementById('feedContainer');
    const sentinel = document.getElementById('feedScrollSentinel');
    if (!feedContainer || allFeedItems.length === 0) return;

    // If reached end of current pool, recycle watched history and append new randomized batch
    if (renderedCount >= currentFeedPool.length) {
        clearWatched();
        const recycled = rankContentForUser(allFeedItems);
        currentFeedPool = currentFeedPool.concat(recycled);
    }

    const nextBatch = currentFeedPool.slice(renderedCount, renderedCount + BATCH_SIZE);
    if (nextBatch.length === 0) return;

    if (sentinel) {
        sentinel.style.display = 'block';
    }

    // Loading indicator delay ("l'ording")
    setTimeout(() => {
        renderedCount += nextBatch.length;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nextBatch.map(item => renderPost(item)).join('');

        const newPosts = Array.from(tempDiv.children);
        newPosts.forEach(p => {
            if (sentinel) {
                feedContainer.insertBefore(p, sentinel);
            } else {
                feedContainer.appendChild(p);
            }
        });

        attachPostEvents(newPosts);
    }, 300);
}

function setupInfiniteScroll() {
    const feedContainer = document.getElementById('feedContainer');
    if (!feedContainer) return;

    let sentinel = document.getElementById('feedScrollSentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'feedScrollSentinel';
        sentinel.className = 'feed-scroll-sentinel';
        sentinel.innerHTML = `
            <div class="loading-spinner" style="width:22px;height:22px;margin:20px auto;"></div>
        `;
        feedContainer.appendChild(sentinel);
    }

    if (feedScrollSentinelObserver) {
        feedScrollSentinelObserver.disconnect();
    }

    feedScrollSentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadNextFeedBatch();
            }
        });
    }, { rootMargin: '400px' });

    feedScrollSentinelObserver.observe(sentinel);
}

export function initFeed() {
    const container = document.getElementById('feedView');
    if (!container) return;

    container.innerHTML = `<div class="feed-container" id="feedContainer">${renderSkeletons(3)}</div>`;

    if (feedUnsubscribe) feedUnsubscribe();

    feedUnsubscribe = getAllContent((items) => {
        const feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;

        allFeedItems = items;

        // Guard: only re-rank if pool size changed (fixes Firebase onValue re-trigger bug)
        if (items.length === lastKnownFeedPoolSize && renderedCount > 0) return;
        lastKnownFeedPoolSize = items.length;

        currentFeedPool = rankContentForUser(items);
        renderedCount = 0;
        feedContainer.innerHTML = '';

        const initialBatch = currentFeedPool.slice(0, BATCH_SIZE);
        renderedCount = initialBatch.length;
        feedContainer.innerHTML = initialBatch.map(item => renderPost(item)).join('');

        const renderedPosts = Array.from(feedContainer.querySelectorAll('.feed-post'));
        attachPostEvents(renderedPosts);
        setupInfiniteScroll();
    });
}

export function destroyFeed() {
    if (feedUnsubscribe) { feedUnsubscribe(); feedUnsubscribe = null; }
    if (feedScrollSentinelObserver) { feedScrollSentinelObserver.disconnect(); feedScrollSentinelObserver = null; }
    activePostObservers.forEach(obs => obs.disconnect());
    activePostObservers = [];
    lastKnownFeedPoolSize = 0;
    renderedCount = 0;

    document.querySelectorAll('#feedView video').forEach(v => {
        try { v.pause(); } catch (e) {}
    });
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
