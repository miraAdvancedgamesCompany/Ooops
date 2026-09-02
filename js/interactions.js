// ==========================================
// Oops:) — Interactions Module
// Likes, Comments, Saves with Realtime Firebase
// ==========================================

import {
    toggleLike, isLiked, getLikeCount,
    toggleSave, isSaved,
    addComment, getComments,
    trackInteraction
} from './firebase.js';
import { isLoggedIn, getCurrentUser, showLoginModal } from './auth.js';
import { t } from './i18n.js';

// SVG Icons for Interactions
export const INTERACTION_ICONS = {
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    heartFilled: `<svg viewBox="0 0 24 24" fill="#ed4956" stroke="#ed4956" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    bookmarkFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
};

// Check auth before action, opens login modal if not logged in
export function requireAuth(actionName = 'interact') {
    if (!isLoggedIn()) {
        showLoginModal();
        return false;
    }
    return true;
}

// Handle Like Action
export async function handleLikeClick(contentId, category = 'general', buttonEl = null, countEl = null) {
    if (!requireAuth(t('interaction_like'))) return;

    const user = getCurrentUser();
    try {
        const liked = await toggleLike(contentId, user.uid);
        if (buttonEl) {
            buttonEl.classList.toggle('liked', liked);
            buttonEl.dataset.liked = liked.toString();
            const iconWrap = buttonEl.querySelector('.icon-slot') || buttonEl.querySelector('.like-icon');
            if (iconWrap) {
                iconWrap.innerHTML = liked ? INTERACTION_ICONS.heartFilled : INTERACTION_ICONS.heart;
            }
        }

        if (countEl) {
            const currentCount = parseInt(countEl.textContent.replace(/[^0-9]/g, '')) || 0;
            const newCount = liked ? currentCount + 1 : Math.max(0, currentCount - 1);
            countEl.textContent = newCount > 0 ? `${newCount}` : '0';
        }

        if (liked) {
            trackInteraction(user.uid, contentId, category, 'like');
        }
        return liked;
    } catch (e) {
        console.error('Error toggling like:', e);
    }
}

// Handle Save Action
export async function handleSaveClick(contentId, category = 'general', buttonEl = null) {
    if (!requireAuth(t('interaction_save'))) return;

    const user = getCurrentUser();
    try {
        const saved = await toggleSave(contentId, user.uid);
        if (buttonEl) {
            buttonEl.classList.toggle('saved', saved);
            buttonEl.dataset.saved = saved.toString();
            const iconWrap = buttonEl.querySelector('.icon-slot') || buttonEl.querySelector('.save-icon');
            if (iconWrap) {
                iconWrap.innerHTML = saved ? INTERACTION_ICONS.bookmarkFilled : INTERACTION_ICONS.bookmark;
            }
        }
        if (saved) {
            trackInteraction(user.uid, contentId, category, 'save');
        }
        return saved;
    } catch (e) {
        console.error('Error toggling save:', e);
    }
}

// Open Comments Modal
let activeCommentsUnsub = null;
export function openCommentsModal(contentId, category = 'general') {
    if (!requireAuth(t('interaction_comment'))) return;

    const existing = document.getElementById('commentsSheetOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'commentsSheetOverlay';
    overlay.className = 'comments-sheet-overlay';
    overlay.innerHTML = `
        <div class="comments-sheet">
            <div class="comments-sheet-header">
                <div class="comments-drag-handle"></div>
                <div class="comments-title-row">
                    <h3 data-i18n="interaction_comments_title">${t('interaction_comments_title')}</h3>
                    <button class="comments-close-btn" id="commentsCloseBtn">${INTERACTION_ICONS.close}</button>
                </div>
            </div>

            <div class="comments-list" id="commentsListContainer">
                <div class="comments-loading">
                    <div class="loading-spinner"></div>
                </div>
            </div>

            <form class="comments-input-bar" id="commentsInputForm">
                <input
                    type="text"
                    id="commentTextInput"
                    class="comment-input"
                    placeholder="${t('interaction_comment_placeholder')}"
                    autocomplete="off"
                    maxlength="300"
                    required
                >
                <button type="submit" class="comment-send-btn" id="commentSendBtn" aria-label="Send">
                    ${INTERACTION_ICONS.send}
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeComments = () => {
        if (activeCommentsUnsub) {
            activeCommentsUnsub();
            activeCommentsUnsub = null;
        }
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector('#commentsCloseBtn').addEventListener('click', closeComments);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeComments();
    });

    const listContainer = overlay.querySelector('#commentsListContainer');
    const form = overlay.querySelector('#commentsInputForm');
    const input = overlay.querySelector('#commentTextInput');

    // Subscribe to live comments
    activeCommentsUnsub = getComments(contentId, (comments) => {
        if (!listContainer) return;
        if (comments.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-comments">
                    <div class="empty-comments-icon">💬</div>
                    <p data-i18n="interaction_no_comments">${t('interaction_no_comments')}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = comments.map(c => {
            const initial = (c.displayName || 'U').charAt(0).toUpperCase();
            const timeFormatted = formatTimeShort(c.timestamp);
            return `
                <div class="comment-item">
                    <div class="comment-avatar">${initial}</div>
                    <div class="comment-body">
                        <div class="comment-header-row">
                            <span class="comment-author">${escapeHtml(c.displayName || 'Anonymous')}</span>
                            <span class="comment-time">${timeFormatted}</span>
                        </div>
                        <div class="comment-text">${escapeHtml(c.text)}</div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.scrollTop = listContainer.scrollHeight;
    });

    // Handle comment submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        const user = getCurrentUser();
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';

        input.value = '';
        try {
            await addComment(contentId, user.uid, displayName, text);
            trackInteraction(user.uid, contentId, category, 'comment');
        } catch (err) {
            console.error('Error posting comment:', err);
        }
    });

    setTimeout(() => input.focus(), 300);
}

function formatTimeShort(timestamp) {
    if (!timestamp) return 'now';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
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
