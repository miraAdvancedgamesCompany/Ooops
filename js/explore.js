// ==========================================
// Oops:) — Explore / Search Page Logic
// 7 items per batch, infinite scroll with loading spinner
// Advanced multi-token and character-level search
// Real view counting and watched history support
// ==========================================

import { getAllContent, shuffleArray, formatNumber, incrementViewCount } from './firebase.js';
import { handleLikeClick, handleSaveClick, openCommentsModal, INTERACTION_ICONS } from './interactions.js';
import { rankContentForUser, markWatched, clearWatched } from './recommendation.js';
import { t } from './i18n.js';

const EXPLORE_BATCH_SIZE = 7;

let exploreUnsubscribe = null;
let allItems = [];
let filteredPool = [];
let renderedExploreCount = 0;
let activeFilter = 'all';
let currentSearchQuery = '';
let exploreSentinelObserver = null;
let searchDebounceTimer = null;
let lastKnownExplorePoolSize = 0;

export const EXPLORE_ICONS = {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

function renderSearchBar() {
    return `
        <div class="explore-search">
            <div class="search-input-wrapper">
                ${EXPLORE_ICONS.search}
                <input type="text" class="search-input" id="exploreSearchInput" placeholder="${t('explore_search')}" data-i18n="explore_search" autocomplete="off">
            </div>
        </div>
        <div class="explore-filters" id="exploreFilters">
            <button class="filter-chip active" data-filter="all" data-i18n="explore_all">${t('explore_all')}</button>
            <button class="filter-chip" data-filter="video" data-i18n="explore_videos">${t('explore_videos')}</button>
            <button class="filter-chip" data-filter="image" data-i18n="explore_photos">${t('explore_photos')}</button>
            <button class="filter-chip" data-filter="trending" data-i18n="explore_trending">${t('explore_trending')}</button>
            <button class="filter-chip" data-filter="recent" data-i18n="explore_recent">${t('explore_recent')}</button>
        </div>
    `;
}

function renderGridItem(item, index) {
    const isVideo = item.type === 'video';
    const isLarge = (index % 10 === 0) || (index % 10 === 5);

    return `
        <div class="explore-grid-item ${isLarge ? 'large' : ''}" data-id="${item.id}" data-type="${item.type}" data-url="${item.url}">
            ${isVideo ? `
                <video src="${item.url}" muted loop playsinline preload="metadata"></video>
            ` : `
                <img src="${item.url}" alt="${escapeHtml(item.title || '')}" loading="lazy">
            `}
            ${isVideo ? `
                <div class="grid-item-indicator">${EXPLORE_ICONS.play}</div>
            ` : ''}
            <div class="grid-item-overlay">
                <div class="grid-item-stat">
                    ${EXPLORE_ICONS.heart}
                    ${formatNumber(item.likes || 0)}
                </div>
            </div>
        </div>
    `;
}

function renderSkeletonGrid() {
    return Array(7).fill('').map((_, i) => {
        const isLarge = i === 0 || i === 5;
        return `<div class="explore-grid-item ${isLarge ? 'large' : ''} skeleton explore-skeleton-item"></div>`;
    }).join('');
}

function attachGridEvents(elements) {
    elements.forEach(item => {
        item.addEventListener('click', () => {
            openMediaModal(item.dataset);
        });

        const video = item.querySelector('video');
        if (video) {
            item.addEventListener('mouseenter', () => {
                video.play().catch(() => {});
            });
            item.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });
}

function openMediaModal(data) {
    const existing = document.querySelector('.video-modal-overlay');
    if (existing) existing.remove();

    const isVideo = data.type === 'video';
    const item = allItems.find(i => i.id === data.id);
    const category = item?.category || 'general';

    // Track real view & mark as watched
    if (item) {
        incrementViewCount(item.id);
        markWatched(item.id);
    }

    const modal = document.createElement('div');
    modal.className = 'video-modal-overlay';
    modal.innerHTML = `
        <div class="video-modal" style="background:#121216; border-radius:18px; overflow:hidden; border:1px solid #282838; max-width:440px; width:92%;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #20202c;">
                <span style="font-weight:700; font-size:14px; color:#fff;">${escapeHtml(item?.title || 'Oops:) Media')}</span>
                <button class="video-modal-close" style="width:30px; height:30px; border-radius:50%; background:#20202e; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; color:#aaa;">
                    ${EXPLORE_ICONS.close}
                </button>
            </div>
            
            <div style="background:#000; display:flex; align-items:center; justify-content:center; min-height:280px; max-height:60vh;">
                ${isVideo ? `
                    <video src="${data.url}" autoplay loop controls playsinline style="width:100%; max-height:60vh; object-fit:contain;"></video>
                ` : `
                    <img src="${data.url}" alt="" style="width:100%; max-height:60vh; object-fit:contain;">
                `}
            </div>

            ${item ? `
                <div style="padding:14px 16px; background:#121216;">
                    ${item.description ? `
                        <div style="color:#aaa; font-size:13px; line-height:1.4; margin-bottom:12px;">${escapeHtml(item.description)}</div>
                    ` : ''}
                    <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid #1c1c28;">
                        <button class="modal-like-btn" id="modalLikeBtn" style="display:flex; align-items:center; gap:6px; background:none; border:none; color:#f0f0f0; font-size:13px; font-weight:600; cursor:pointer;">
                            ${INTERACTION_ICONS.heart}
                            <span id="modalLikeCount">${formatNumber(item.likes || 0)}</span>
                        </button>
                        <button class="modal-comment-btn" id="modalCommentBtn" style="display:flex; align-items:center; gap:6px; background:none; border:none; color:#f0f0f0; font-size:13px; font-weight:600; cursor:pointer;">
                            ${INTERACTION_ICONS.comment}
                            <span>Chat</span>
                        </button>
                        <button class="modal-save-btn" id="modalSaveBtn" style="display:flex; align-items:center; gap:6px; background:none; border:none; color:#f0f0f0; font-size:13px; font-weight:600; cursor:pointer;">
                            ${INTERACTION_ICONS.bookmark}
                            <span>Save</span>
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    if (item) {
        const likeBtn = modal.querySelector('#modalLikeBtn');
        const likeCount = modal.querySelector('#modalLikeCount');
        const commentBtn = modal.querySelector('#modalCommentBtn');
        const saveBtn = modal.querySelector('#modalSaveBtn');

        likeBtn.addEventListener('click', () => {
            handleLikeClick(item.id, category, likeBtn, likeCount);
        });

        commentBtn.addEventListener('click', () => {
            const video = modal.querySelector('video');
            if (video) video.pause();
            modal.remove();
            openCommentsModal(item.id, category);
        });

        saveBtn.addEventListener('click', () => {
            handleSaveClick(item.id, category, saveBtn);
        });
    }

    modal.querySelector('.video-modal-close').addEventListener('click', () => {
        const video = modal.querySelector('video');
        if (video) video.pause();
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            const video = modal.querySelector('video');
            if (video) video.pause();
            modal.remove();
        }
    });

    document.body.appendChild(modal);
}

// Compute the pool of items based on activeFilter and currentSearchQuery
function computeFilteredPool() {
    let pool = [...allItems];

    // 1. Search Query Filter (Advanced multi-token + character matching)
    if (currentSearchQuery) {
        const tokens = currentSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        pool = pool.filter(item => {
            const text = ((item.title || '') + ' ' + (item.description || '') + ' ' + (item.category || '')).toLowerCase();
            return tokens.every(token => text.includes(token));
        });
    }

    // 2. Tab Filter
    switch (activeFilter) {
        case 'video':
            pool = pool.filter(i => i.type === 'video');
            break;
        case 'image':
            pool = pool.filter(i => i.type === 'image');
            break;
        case 'trending':
            pool = pool.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            break;
        case 'recent':
            pool = pool.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            break;
        default:
            // "all": If no search, use recommendation engine ranking
            if (!currentSearchQuery) {
                pool = rankContentForUser(pool);
            }
    }

    return pool;
}

function loadNextExploreBatch() {
    const grid = document.getElementById('exploreGrid');
    const sentinel = document.getElementById('exploreScrollSentinel');
    if (!grid) return;

    // If reached end of current pool
    if (renderedExploreCount >= filteredPool.length) {
        // If not searching, recycle videos so infinite scroll never gets stuck
        if (!currentSearchQuery && allItems.length > 0) {
            clearWatched();
            const recycled = rankContentForUser(allItems);
            filteredPool = filteredPool.concat(recycled);
        } else {
            if (sentinel) sentinel.style.display = 'none';
            return;
        }
    }

    // Show loading indicator in sentinel
    if (sentinel) {
        sentinel.style.display = 'flex';
        sentinel.innerHTML = `<div class="loading-spinner" style="width:24px;height:24px;"></div>`;
    }

    setTimeout(() => {
        const nextBatch = filteredPool.slice(renderedExploreCount, renderedExploreCount + EXPLORE_BATCH_SIZE);
        const startIndex = renderedExploreCount;
        renderedExploreCount += nextBatch.length;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nextBatch.map((item, i) => renderGridItem(item, startIndex + i)).join('');

        const newElements = Array.from(tempDiv.children);
        newElements.forEach(el => {
            if (sentinel) {
                grid.insertBefore(el, sentinel);
            } else {
                grid.appendChild(el);
            }
        });

        attachGridEvents(newElements);

        if (renderedExploreCount >= filteredPool.length && currentSearchQuery && sentinel) {
            sentinel.style.display = 'none';
        }
    }, 280);
}

function renderInitialExploreGrid() {
    const grid = document.getElementById('exploreGrid');
    if (!grid) return;

    filteredPool = computeFilteredPool();
    renderedExploreCount = 0;
    grid.innerHTML = '';

    if (filteredPool.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 40px 16px; text-align: center;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        ${EXPLORE_ICONS.search}
                    </div>
                    <h3 data-i18n="explore_no_results">${t('explore_no_results')}</h3>
                    <p data-i18n="explore_no_results_hint">${t('explore_no_results_hint')}</p>
                </div>
            </div>
        `;
        return;
    }

    // Initial batch of 7 items
    const initialBatch = filteredPool.slice(0, EXPLORE_BATCH_SIZE);
    renderedExploreCount = initialBatch.length;

    grid.innerHTML = initialBatch.map((item, i) => renderGridItem(item, i)).join('');

    // Append sentinel for loading next 7 items
    const sentinel = document.createElement('div');
    sentinel.id = 'exploreScrollSentinel';
    sentinel.className = 'explore-scroll-sentinel';
    sentinel.innerHTML = `<div class="loading-spinner" style="width:24px;height:24px;"></div>`;
    grid.appendChild(sentinel);

    const initialElements = Array.from(grid.querySelectorAll('.explore-grid-item'));
    attachGridEvents(initialElements);

    setupExploreSentinelObserver();
}

function setupExploreSentinelObserver() {
    if (exploreSentinelObserver) {
        exploreSentinelObserver.disconnect();
    }

    const sentinel = document.getElementById('exploreScrollSentinel');
    if (!sentinel) return;

    exploreSentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadNextExploreBatch();
            }
        });
    }, { rootMargin: '300px' });

    exploreSentinelObserver.observe(sentinel);
}

function applyFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === filter);
    });
    renderInitialExploreGrid();
}

export function initExplore() {
    const container = document.getElementById('exploreView');
    if (!container) return;

    container.innerHTML = renderSearchBar() + `<div class="explore-grid" id="exploreGrid">${renderSkeletonGrid()}</div>`;

    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            applyFilter(chip.dataset.filter);
        });
    });

    const searchInput = document.getElementById('exploreSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                currentSearchQuery = (e.target.value || '').trim();
                renderInitialExploreGrid();
            }, 200);
        });
    }

    if (exploreUnsubscribe) exploreUnsubscribe();

    exploreUnsubscribe = getAllContent((items) => {
        // Guard against duplicate triggers
        if (items.length === lastKnownExplorePoolSize && renderedExploreCount > 0) return;
        lastKnownExplorePoolSize = items.length;

        allItems = items;
        renderInitialExploreGrid();
    });
}

export function destroyExplore() {
    if (exploreUnsubscribe) {
        exploreUnsubscribe();
        exploreUnsubscribe = null;
    }
    if (exploreSentinelObserver) {
        exploreSentinelObserver.disconnect();
        exploreSentinelObserver = null;
    }
    clearTimeout(searchDebounceTimer);
    document.querySelectorAll('.video-modal-overlay').forEach(m => m.remove());
    lastKnownExplorePoolSize = 0;
    renderedExploreCount = 0;
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

