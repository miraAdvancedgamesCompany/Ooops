// ==========================================
// Oops:) — Profile Page Logic
// User Information, Saved Content, Last 15 Liked Content, Settings & Language
// ==========================================

import { getUserProfileData, getCurrentUser, isLoggedIn, showLoginModal, logout } from './auth.js';
import { getUserSaves, getUserLikes, getAllContent } from './firebase.js';
import { t, getCurrentLang, setLanguage, getLanguageNames } from './i18n.js';
import { openCommentsModal } from './interactions.js';

let activeTab = 'saved'; // 'saved' | 'liked'
let allContentMap = {};
let savesList = [];
let likesList = [];
let savesUnsub = null;
let likesUnsub = null;
let contentUnsub = null;

export function initProfile() {
    const container = document.getElementById('profileView');
    if (!container) return;

    if (!isLoggedIn()) {
        renderUnauthenticatedState(container);
        return;
    }

    renderAuthenticatedState(container);
    loadProfileData();
}

function renderUnauthenticatedState(container) {
    container.innerHTML = `
        <div class="profile-guest-container">
            <div class="profile-guest-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <h2 data-i18n="profile_login_prompt">${t('profile_login_prompt')}</h2>
            <p>Save your favorite videos, like reels, and personalize your experience.</p>
            <button class="profile-login-cta-btn" id="profileLoginBtn" data-i18n="auth_login">
                ${t('auth_login')}
            </button>

            <div class="profile-guest-settings">
                <div class="profile-setting-item">
                    <span data-i18n="profile_language">${t('profile_language')}</span>
                    ${renderLanguageSelect()}
                </div>
            </div>
        </div>
    `;

    container.querySelector('#profileLoginBtn').addEventListener('click', () => {
        showLoginModal();
    });

    setupLanguageSelector(container);
}

function renderAuthenticatedState(container) {
    const user = getCurrentUser();
    const profile = getUserProfileData() || {};
    const displayName = profile.displayName || user.displayName || 'User';
    const username = profile.username ? `@${profile.username}` : (user.email ? user.email.split('@')[0] : '');
    const initial = displayName.charAt(0).toUpperCase();

    container.innerHTML = `
        <div class="profile-container">
            <!-- Profile Header -->
            <div class="profile-header">
                <div class="profile-avatar-wrap">
                    ${profile.photoURL ? `
                        <img src="${profile.photoURL}" alt="" class="profile-avatar-img">
                    ` : `
                        <div class="profile-avatar-initial">${initial}</div>
                    `}
                </div>
                <div class="profile-names">
                    <h2 class="profile-display-name">${escapeHtml(displayName)}</h2>
                    <span class="profile-username">${escapeHtml(username)}</span>
                </div>
                <button class="profile-settings-btn" id="profileSettingsBtn" aria-label="Settings" title="${t('profile_settings')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>

            <!-- Settings Drawer (Hidden by default) -->
            <div class="profile-settings-panel" id="profileSettingsPanel">
                <div class="settings-row">
                    <span data-i18n="profile_language">${t('profile_language')}</span>
                    ${renderLanguageSelect()}
                </div>
                <button class="settings-logout-btn" id="profileLogoutBtn" data-i18n="auth_logout">
                    ${t('auth_logout')}
                </button>
            </div>

            <!-- Profile Tabs: Saved & Last 15 Liked -->
            <div class="profile-tabs">
                <button class="profile-tab-btn ${activeTab === 'saved' ? 'active' : ''}" data-tab="saved">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span data-i18n="profile_saved">${t('profile_saved')}</span>
                </button>
                <button class="profile-tab-btn ${activeTab === 'liked' ? 'active' : ''}" data-tab="liked">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span data-i18n="profile_liked">${t('profile_liked')} (15)</span>
                </button>
            </div>

            <!-- Content Grid Container -->
            <div class="profile-grid" id="profileGridContainer">
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;

    // Toggle Settings panel
    const settingsBtn = container.querySelector('#profileSettingsBtn');
    const settingsPanel = container.querySelector('#profileSettingsPanel');
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('open');
    });

    // Logout
    container.querySelector('#profileLogoutBtn').addEventListener('click', async () => {
        await logout();
        initProfile();
    });

    // Tab buttons
    container.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            container.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActiveTabContent();
        });
    });

    setupLanguageSelector(container);
}

function renderLanguageSelect() {
    const current = getCurrentLang();
    const names = getLanguageNames();
    const options = Object.entries(names).map(([code, name]) => `
        <option value="${code}" ${code === current ? 'selected' : ''}>${name}</option>
    `).join('');

    return `
        <select class="profile-lang-select" id="profileLangSelect">
            ${options}
        </select>
    `;
}

function setupLanguageSelector(container) {
    const select = container.querySelector('#profileLangSelect');
    if (select) {
        select.addEventListener('change', (e) => {
            const newLang = e.target.value;
            setLanguage(newLang);
            // Reload the page as requested: "عند إختيار للغة معينة يتم إعادة تحميل الصفحة وتغير إلي اللغة المختارة"
            window.location.reload();
        });
    }
}

function loadProfileData() {
    const user = getCurrentUser();
    if (!user) return;

    // 1. Get all content to lookup details
    if (contentUnsub) contentUnsub();
    contentUnsub = getAllContent((items) => {
        allContentMap = {};
        items.forEach(it => { allContentMap[it.id] = it; });

        // 2. Get User Saves
        if (savesUnsub) savesUnsub();
        savesUnsub = getUserSaves(user.uid, (saves) => {
            savesList = saves;
            if (activeTab === 'saved') renderActiveTabContent();
        });

        // 3. Get User Likes (capped to last 15)
        if (likesUnsub) likesUnsub();
        likesUnsub = getUserLikes(user.uid, (likes) => {
            likesList = likes.slice(0, 15);
            if (activeTab === 'liked') renderActiveTabContent();
        });
    });
}

function renderActiveTabContent() {
    const grid = document.getElementById('profileGridContainer');
    if (!grid) return;

    const list = activeTab === 'saved' ? savesList : likesList;

    if (list.length === 0) {
        const isSaved = activeTab === 'saved';
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 50px 20px;">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isSaved ?
                            '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' :
                            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
                        }
                    </svg>
                </div>
                <h3>${isSaved ? t('profile_no_saved') : t('profile_no_liked')}</h3>
                <p>${isSaved ? t('profile_no_saved_hint') : t('profile_no_liked_hint')}</p>
            </div>
        `;
        return;
    }

    const itemsToRender = list.map(entry => {
        const item = allContentMap[entry.contentId];
        return item ? { ...item, actionTime: entry.timestamp } : null;
    }).filter(Boolean);

    grid.innerHTML = itemsToRender.map(item => `
        <div class="profile-grid-card" data-id="${item.id}" data-url="${item.url}" data-type="${item.type}">
            ${item.type === 'video' ? `
                <video src="${item.url}" muted preload="metadata" playsinline></video>
                <div class="grid-card-type-icon">▶</div>
            ` : `
                <img src="${item.url}" alt="" loading="lazy">
            `}
            <div class="profile-card-overlay">
                <span>❤️ ${item.likes || 0}</span>
            </div>
        </div>
    `).join('');

    // Attach click to preview/play
    grid.querySelectorAll('.profile-grid-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const item = allContentMap[id];
            if (item) openProfileMediaModal(item);
        });
    });
}

function openProfileMediaModal(item) {
    const existing = document.querySelector('.video-modal-overlay');
    if (existing) existing.remove();

    const isVideo = item.type === 'video';
    const modal = document.createElement('div');
    modal.className = 'video-modal-overlay';
    modal.innerHTML = `
        <div class="video-modal" style="background:#14141c; border-radius:18px; overflow:hidden; border:1px solid #333; max-width:440px; width:94%;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #262634;">
                <span style="font-weight:700; font-size:14px; color:#fff;">${escapeHtml(item.title || 'Oops:)')}</span>
                <button class="video-modal-close" style="width:30px; height:30px; border-radius:50%; background:#242432; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    ✕
                </button>
            </div>
            
            <div style="background:#000; display:flex; align-items:center; justify-content:center; max-height:60vh;">
                ${isVideo ? `
                    <video src="${item.url}" autoplay loop controls playsinline style="width:100%; max-height:60vh; object-fit:contain;"></video>
                ` : `
                    <img src="${item.url}" alt="" style="width:100%; max-height:60vh; object-fit:contain;">
                `}
            </div>

            <div style="padding:14px 16px; background:#14141c;">
                <div style="color:#bbb; font-size:13px; line-height:1.4;">${escapeHtml(item.description || '')}</div>
            </div>
        </div>
    `;

    modal.querySelector('.video-modal-close').addEventListener('click', () => {
        const vid = modal.querySelector('video');
        if (vid) vid.pause();
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            const vid = modal.querySelector('video');
            if (vid) vid.pause();
            modal.remove();
        }
    });

    document.body.appendChild(modal);
}

export function destroyProfile() {
    if (savesUnsub) savesUnsub();
    if (likesUnsub) likesUnsub();
    if (contentUnsub) contentUnsub();
    savesUnsub = null;
    likesUnsub = null;
    contentUnsub = null;
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
