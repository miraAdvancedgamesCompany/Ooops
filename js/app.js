// ==========================================
// Oops:) — Main App Router & Initialization
// Multi-page navigation, Auth, i18n, Age-Gate & Recommendation
// ==========================================

import { initFeed, destroyFeed } from './feed.js';
import { initReels, destroyReels } from './reels.js';
import { initExplore, destroyExplore } from './explore.js';
import { initProfile, destroyProfile } from './profile.js';
import { initI18n, setLanguage, getCurrentLang, getLanguageNames } from './i18n.js';
import { checkAgeGate } from './age-gate.js';
import { initAuth, onAuthChange } from './auth.js';
import { initRecommendation } from './recommendation.js';

// SVG Icons for 4 navigation tabs
export const NAV_ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    homeFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    exploreFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke-width="3"/></svg>`,
    reels: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M2 8h20"/><path d="M8 2l2 6"/><path d="M14 2l2 6"/><polygon points="10 12 16 15.5 10 19 10 12" fill="currentColor" stroke="none"/></svg>`,
    reelsFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="currentColor"/><path d="M2 8h20" stroke="black" stroke-width="2"/><path d="M8 2l2 6" stroke="black" stroke-width="2"/><path d="M14 2l2 6" stroke="black" stroke-width="2"/><polygon points="10 12 16 15.5 10 19 10 12" fill="black" stroke="none"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    profileFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
};

let currentPage = null;

const destroyFunctions = {
    feed: destroyFeed,
    explore: destroyExplore,
    reels: destroyReels,
    profile: destroyProfile,
};

const initFunctions = {
    feed: initFeed,
    explore: initExplore,
    reels: initReels,
    profile: initProfile,
};

export function navigateTo(page) {
    if (page === currentPage) return;

    // Clean up previous page
    if (currentPage && destroyFunctions[currentPage]) {
        try {
            destroyFunctions[currentPage]();
        } catch (e) {
            console.error('Error destroying page:', e);
        }
    }

    // Hide all views
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.remove('active');
    });

    // Reset header state if leaving reels
    if (currentPage === 'reels' && page !== 'reels') {
        document.querySelector('.app-header')?.classList.remove('hidden');
        document.querySelector('.main-content')?.classList.remove('reels-mode');
        document.querySelector('.bottom-nav')?.classList.remove('transparent');
    }

    // Update bottom nav active state & icons
    document.querySelectorAll('.nav-item').forEach(item => {
        const navPage = item.dataset.page;
        if (!navPage) return;
        const iconSpan = item.querySelector('.nav-icon-slot');

        if (navPage === page) {
            item.classList.add('active');
            if (iconSpan && !iconSpan.querySelector('img') && !iconSpan.querySelector('.nav-avatar-circle')) {
                if (page === 'feed') iconSpan.innerHTML = NAV_ICONS.homeFilled;
                if (page === 'explore') iconSpan.innerHTML = NAV_ICONS.exploreFilled;
                if (page === 'reels') iconSpan.innerHTML = NAV_ICONS.reelsFilled;
                if (page === 'profile') iconSpan.innerHTML = NAV_ICONS.profileFilled;
            }
        } else {
            item.classList.remove('active');
            if (iconSpan && !iconSpan.querySelector('img') && !iconSpan.querySelector('.nav-avatar-circle')) {
                if (navPage === 'feed') iconSpan.innerHTML = NAV_ICONS.home;
                if (navPage === 'explore') iconSpan.innerHTML = NAV_ICONS.explore;
                if (navPage === 'reels') iconSpan.innerHTML = NAV_ICONS.reels;
                if (navPage === 'profile') iconSpan.innerHTML = NAV_ICONS.profile;
            }
        }
    });

    // Show target view
    const targetView = document.getElementById(`${page}View`);
    if (targetView) {
        targetView.classList.add('active');
    }

    currentPage = page;

    // Initialize new view
    if (initFunctions[page]) {
        try {
            initFunctions[page]();
        } catch (e) {
            console.error('Error initializing page:', e);
        }
    }

    // Update URL hash
    if (window.location.hash !== `#${page}`) {
        window.history.replaceState(null, '', `#${page}`);
    }
}

export function showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
}

function setupHeaderLanguagePicker() {
    const langBtn = document.getElementById('headerLangBtn');
    if (!langBtn) return;

    langBtn.addEventListener('click', () => {
        const existing = document.getElementById('langPickerModal');
        if (existing) {
            existing.remove();
            return;
        }

        const current = getCurrentLang();
        const names = getLanguageNames();

        const modal = document.createElement('div');
        modal.id = 'langPickerModal';
        modal.className = 'lang-picker-dropdown';
        modal.innerHTML = Object.entries(names).map(([code, name]) => `
            <button class="lang-option-btn ${code === current ? 'active' : ''}" data-lang="${code}">
                ${name}
            </button>
        `).join('');

        document.body.appendChild(modal);

        modal.querySelectorAll('.lang-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setLanguage(btn.dataset.lang);
                modal.remove();
                showToast('Language updated');
            });
        });

        const closeOnClickOutside = (e) => {
            if (!modal.contains(e.target) && e.target !== langBtn) {
                modal.remove();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOnClickOutside), 10);
    });
}

function initApp() {
    // 1. Initialize Internationalization
    initI18n();

    // 2. Initialize Firebase Authentication & Recommendation
    initAuth();
    initRecommendation();

    onAuthChange(() => {
        initRecommendation();
        if (currentPage === 'profile') {
            initProfile();
        }
    });

    // 3. Setup bottom nav click handlers
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
        });
    });

    // 4. Logo click goes to feed
    const logo = document.getElementById('headerLogo');
    if (logo) {
        logo.addEventListener('click', () => {
            navigateTo('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 5. Header language quick picker
    setupHeaderLanguagePicker();

    // 6. Check Age Gate Verification
    checkAgeGate();

    // 7. Route to initial page
    const hash = (window.location.hash || '').replace('#', '').trim();
    const validPages = ['feed', 'explore', 'reels', 'profile'];
    const initialPage = validPages.includes(hash) ? hash : 'feed';

    navigateTo(initialPage);

    // Support browser Back/Forward
    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '').trim();
        if (validPages.includes(newHash) && newHash !== currentPage) {
            navigateTo(newHash);
        }
    });

    document.querySelector('.app-container')?.classList.add('loaded');
}

// Reliable bootloader
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
