// ==========================================
// Oops:) Studio — Secured Admin Dashboard Logic
// Full CRUD, User Management, Analytics, Master Security Gate
// ==========================================

import {
    addContent, getAllContent, deleteContent,
    timeAgo, formatNumber, seedAllDefaultData,
    getAllUsers, banUser, unbanUser, deleteUser,
    getSiteStats, CONTENT_CATEGORIES, detectCategory
} from './firebase.js';

// Master Admin Passkey (Configurable)
const MASTER_ADMIN_KEY = 'admin2026';

let libraryItems = [];
let allUsersList = [];
let activeFilter = 'all';
let contentSearchQuery = '';
let userSearchQuery = '';
let activeTab = 'analytics';

function initDashboard() {
    setupSecurityLock();
    if (checkAdminAuth()) {
        renderAuthorizedDashboard();
    }
}

// ---- 1. Master Security Lock ----
function checkAdminAuth() {
    return sessionStorage.getItem('oops_admin_auth') === 'true';
}

function setupSecurityLock() {
    const lockScreen = document.getElementById('adminLockScreen');
    const dashWrapper = document.getElementById('dashWrapper');
    const form = document.getElementById('adminLoginForm');
    const keyInput = document.getElementById('adminKeyInput');
    const errorMsg = document.getElementById('lockErrorMsg');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const entered = keyInput.value.trim();

            if (entered === MASTER_ADMIN_KEY) {
                sessionStorage.setItem('oops_admin_auth', 'true');
                keyInput.value = '';
                errorMsg.style.display = 'none';
                renderAuthorizedDashboard();
                showToast('🔓 Admin Authorized. Welcome to Studio.');
            } else {
                errorMsg.textContent = '❌ Invalid Passkey. Access Denied.';
                errorMsg.style.display = 'block';
                keyInput.value = '';
                keyInput.focus();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('oops_admin_auth');
            lockScreen.style.display = 'flex';
            dashWrapper.style.display = 'none';
            showToast('🔒 Dashboard locked.');
        });
    }
}

function renderAuthorizedDashboard() {
    const lockScreen = document.getElementById('adminLockScreen');
    const dashWrapper = document.getElementById('dashWrapper');

    if (lockScreen) lockScreen.style.display = 'none';
    if (dashWrapper) dashWrapper.style.display = 'block';

    setupNavigationTabs();
    setupUploadForm();
    setupLibraryToolbar();
    setupSeedButton();
    setupUserSearch();
    listenToFirebaseContent();
    listenToFirebaseUsers();
    listenToSiteStats();
    renderCategoryCloud();
}

// ---- 2. Tab Navigation ----
function setupNavigationTabs() {
    const tabButtons = document.querySelectorAll('.dash-tab-btn');
    const sections = {
        analytics: document.getElementById('tabSectionAnalytics'),
        users: document.getElementById('tabSectionUsers'),
        content: document.getElementById('tabSectionContent'),
        upload: document.getElementById('tabSectionUpload')
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;

            Object.values(sections).forEach(sec => {
                if (sec) sec.classList.remove('active');
            });
            if (sections[activeTab]) {
                sections[activeTab].classList.add('active');
            }
        });
    });
}

// ---- 3. User Management ----
function listenToFirebaseUsers() {
    getAllUsers((users) => {
        allUsersList = users;
        const usersCountBadge = document.getElementById('usersCountBadge');
        if (usersCountBadge) usersCountBadge.textContent = users.length;
        renderUsersTable();
    });
}

function setupUserSearch() {
    const searchInput = document.getElementById('usersSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            userSearchQuery = e.target.value.toLowerCase().trim();
            renderUsersTable();
        });
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let filtered = [...allUsersList];
    if (userSearchQuery) {
        filtered = filtered.filter(u =>
            (u.displayName || '').toLowerCase().includes(userSearchQuery) ||
            (u.username || '').toLowerCase().includes(userSearchQuery) ||
            (u.email || '').toLowerCase().includes(userSearchQuery)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    ${allUsersList.length === 0 ? 'No registered users in the database yet.' : 'No users match your search query.'}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isBanned = !!u.banned;
        const initial = (u.displayName || u.username || 'U').charAt(0).toUpperCase();
        const age = calculateAge(u.dateOfBirth);
        const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
        const provider = u.provider || (u.email ? 'google.com' : 'email');

        return `
            <tr data-uid="${u.uid}">
                <td>
                    <div class="user-row-cell">
                        <div class="user-table-avatar">${initial}</div>
                        <div>
                            <div class="user-table-name">${escapeHtml(u.displayName || 'User')}</div>
                            <div class="user-table-email">${escapeHtml(u.email || '—')}</div>
                        </div>
                    </div>
                </td>
                <td><span class="user-table-username">@${escapeHtml(u.username || '—')}</span></td>
                <td>
                    <span class="user-table-dob">${u.dateOfBirth || '—'}</span>
                    <span class="user-table-age">(${age !== null ? age + ' y/o' : '18+'})</span>
                </td>
                <td><span class="provider-pill ${provider.includes('google') ? 'google' : 'email'}">${provider.includes('google') ? 'Google' : 'Password'}</span></td>
                <td>${joinDate}</td>
                <td>
                    <span class="status-pill ${isBanned ? 'banned' : 'active'}">
                        ${isBanned ? 'Banned' : 'Active'}
                    </span>
                </td>
                <td>
                    <div class="user-action-buttons">
                        ${isBanned ? `
                            <button class="user-unban-btn" data-uid="${u.uid}" title="Unban User">Unban</button>
                        ` : `
                            <button class="user-ban-btn" data-uid="${u.uid}" title="Ban User">Ban</button>
                        `}
                        <button class="user-delete-btn" data-uid="${u.uid}" title="Delete Account">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.user-ban-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (confirm('Are you sure you want to suspend this user?')) {
                btn.disabled = true;
                await banUser(uid);
                showToast('🚫 User account suspended.');
            }
        });
    });

    tbody.querySelectorAll('.user-unban-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            btn.disabled = true;
            await unbanUser(uid);
            showToast('✅ User ban lifted.');
        });
    });

    tbody.querySelectorAll('.user-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (confirm('Permanently delete this user profile and all associated data?')) {
                btn.disabled = true;
                await deleteUser(uid);
                showToast('🗑️ User permanently deleted.');
            }
        });
    });
}

function calculateAge(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

// ---- 4. Realtime Stats ----
function listenToSiteStats() {
    getSiteStats((stats) => {
        const totalMediaEl = document.getElementById('statTotalMedia');
        const totalUsersEl = document.getElementById('statTotalUsers');
        const totalLikesEl = document.getElementById('statTotalLikes');
        const totalCommentsEl = document.getElementById('statTotalComments');

        if (totalMediaEl) totalMediaEl.textContent = formatNumber(stats.totalContent);
        if (totalUsersEl) totalUsersEl.textContent = formatNumber(stats.totalUsers);
        if (totalLikesEl) totalLikesEl.textContent = formatNumber(stats.totalLikes);
        if (totalCommentsEl) totalCommentsEl.textContent = formatNumber(stats.totalComments);
    });
}

// ---- 5. Upload Form & Live Preview ----
function setupUploadForm() {
    const form = document.getElementById('uploadForm');
    const urlInput = document.getElementById('contentUrl');
    const typeSelect = document.getElementById('contentType');
    const categorySelect = document.getElementById('contentCategory');
    const titleInput = document.getElementById('contentTitle');
    const descInput = document.getElementById('contentDesc');
    const clearUrlBtn = document.getElementById('clearUrlBtn');
    const previewBox = document.getElementById('urlPreviewBox');
    const previewMediaContainer = document.getElementById('previewMediaContainer');
    const previewBadge = document.getElementById('previewTypeBadge');
    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('uploadStatusMsg');

    if (!form || !urlInput) return;

    let previewTimer = null;

    if (clearUrlBtn) {
        clearUrlBtn.addEventListener('click', () => {
            urlInput.value = '';
            clearUrlBtn.classList.remove('show');
            previewBox.classList.remove('active');
            previewMediaContainer.innerHTML = '';
            urlInput.focus();
        });
    }

    urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();
        if (clearUrlBtn) clearUrlBtn.classList.toggle('show', url.length > 0);

        clearTimeout(previewTimer);
        if (!url) {
            previewBox.classList.remove('active');
            previewMediaContainer.innerHTML = '';
            return;
        }

        previewTimer = setTimeout(() => {
            const lower = url.toLowerCase();
            if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('video')) {
                typeSelect.value = 'video';
            } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.includes('photo')) {
                typeSelect.value = 'image';
            }
            renderLivePreview(url, typeSelect.value);
        }, 300);
    });

    typeSelect.addEventListener('change', () => {
        const url = urlInput.value.trim();
        if (url) renderLivePreview(url, typeSelect.value);
    });

    function renderLivePreview(url, type) {
        previewBox.classList.add('active');
        previewBadge.textContent = type;

        if (type === 'video') {
            previewMediaContainer.innerHTML = `
                <video src="${url}" controls autoplay muted playsinline style="width:100%;max-height:300px;object-fit:contain;background:#000;" onerror="window.handlePreviewError(this)"></video>
            `;
        } else {
            previewMediaContainer.innerHTML = `
                <img src="${url}" alt="Preview" style="width:100%;max-height:300px;object-fit:contain;background:#000;" onerror="window.handlePreviewError(this)">
            `;
        }
    }

    window.handlePreviewError = function() {
        previewMediaContainer.innerHTML = `
            <div class="preview-error">
                ⚠️ Unable to load media from this URL. Please verify that it is a direct public link.
            </div>
        `;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = urlInput.value.trim();
        const type = typeSelect.value;
        const category = categorySelect.value || detectCategory(titleInput.value, descInput.value);
        const title = titleInput.value.trim();
        const description = descInput.value.trim();

        if (!url) {
            showToast('⚠️ Please enter a valid URL.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Storing to Database...</span>';
        statusMsg.className = 'upload-status-msg';
        statusMsg.style.display = 'none';

        try {
            await addContent({
                url,
                type,
                category,
                title: title || 'Untitled Media',
                description: description || ''
            });

            form.reset();
            if (clearUrlBtn) clearUrlBtn.classList.remove('show');
            previewBox.classList.remove('active');
            previewMediaContainer.innerHTML = '';

            statusMsg.textContent = '✅ Stored successfully to Realtime Database!';
            statusMsg.className = 'upload-status-msg success';
            showToast('🎉 Content added to library!');

            setTimeout(() => {
                statusMsg.style.display = 'none';
            }, 4000);
        } catch (err) {
            console.error('Firebase save error:', err);
            statusMsg.textContent = '❌ Failed to save. Check your Firebase database rules.';
            statusMsg.className = 'upload-status-msg error';
            showToast('❌ Firebase Error. Check database rules.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Store Video in Database</span>
            `;
        }
    });
}

// ---- 6. Quick Seed Button ----
function setupSeedButton() {
    const seedBtn = document.getElementById('seedDbBtn');
    if (!seedBtn) return;

    seedBtn.addEventListener('click', async () => {
        if (!confirm('Push 11 curated high-quality sample videos & photos to your Firebase database?')) return;

        seedBtn.disabled = true;
        seedBtn.textContent = '⏳ Seeding...';

        try {
            await seedAllDefaultData();
            showToast('🚀 11 Videos added to Firebase!');
        } catch (err) {
            console.error('Seed error:', err);
            showToast('⚠️ Seeding note: Check database write rules.');
        } finally {
            seedBtn.disabled = false;
            seedBtn.textContent = '⚡ Seed 11 High-Quality Videos';
        }
    });
}

// ---- 7. Content Library Toolbar & Grid ----
function setupLibraryToolbar() {
    const searchInput = document.getElementById('librarySearchInput');
    const filterButtons = document.querySelectorAll('.lib-filter-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            contentSearchQuery = e.target.value.toLowerCase().trim();
            renderLibrary();
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.type;
            renderLibrary();
        });
    });
}

function listenToFirebaseContent() {
    getAllContent((items) => {
        libraryItems = items;
        const countBadge = document.getElementById('libraryCountBadge');
        if (countBadge) countBadge.textContent = items.length;
        renderLibrary();
    });
}

function renderLibrary() {
    const container = document.getElementById('libraryContainer');
    if (!container) return;

    let filtered = [...libraryItems];

    if (activeFilter !== 'all') {
        filtered = filtered.filter(i => i.type === activeFilter);
    }

    if (contentSearchQuery) {
        filtered = filtered.filter(i =>
            (i.title || '').toLowerCase().includes(contentSearchQuery) ||
            (i.description || '').toLowerCase().includes(contentSearchQuery) ||
            (i.category || '').toLowerCase().includes(contentSearchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span style="font-size:36px;">📭</span>
                <h3>No Items Found</h3>
                <p>Upload a new video in the "Upload New" tab or seed sample videos.</p>
            </div>
        `;
        return;
    }

    const sorted = filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    container.innerHTML = sorted.map(item => `
        <div class="lib-item-card" data-id="${item.id}">
            <div class="lib-item-media">
                <span class="lib-item-badge">${item.type}</span>
                <span class="lib-item-cat-badge">${item.category || 'general'}</span>
                ${item.type === 'video' ? `
                    <video src="${item.url}" controls muted preload="metadata" playsinline></video>
                ` : `
                    <img src="${item.url}" alt="${escapeHtml(item.title || '')}" loading="lazy">
                `}
            </div>
            <div class="lib-item-body">
                <div>
                    <div class="lib-item-title" title="${escapeHtml(item.title || 'Untitled')}">${escapeHtml(item.title || 'Untitled')}</div>
                    <div class="lib-item-desc">${escapeHtml(item.description || 'No caption')}</div>
                </div>
                <div class="lib-item-footer">
                    <span>${timeAgo(item.timestamp)}</span>
                    <button class="lib-delete-btn" data-id="${item.id}">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.lib-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Delete this item permanently from Firebase?')) {
                btn.disabled = true;
                btn.textContent = 'Deleting...';
                try {
                    await deleteContent(id);
                    showToast('🗑️ Item deleted successfully.');
                } catch (err) {
                    console.error('Delete error:', err);
                    showToast('❌ Failed to delete item.');
                }
            }
        });
    });
}

function renderCategoryCloud() {
    const cloud = document.getElementById('categoriesTagCloud');
    if (!cloud) return;

    cloud.innerHTML = CONTENT_CATEGORIES.map(cat => `
        <div class="cat-tag-pill">
            <span class="cat-tag-name">#${cat}</span>
            <span class="cat-tag-weight">Active</span>
        </div>
    `).join('');
}

function showToast(message) {
    const toast = document.getElementById('dashToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
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

// Bootloader
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
