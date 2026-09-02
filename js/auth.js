// ==========================================
// Oops:) — Authentication Module
// Google Sign-In + Email/Password + Profile Setup
// ==========================================

import {
    auth, googleProvider, db,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile,
    getUserProfile, createUserProfile, updateUserProfile,
    isUsernameTaken, reserveUsername, ref, get
} from './firebase.js';
import { t } from './i18n.js';

let currentUser = null;
let userProfile = null;
let authListeners = [];

export function getCurrentUser() { return currentUser; }
export function getUserProfileData() { return userProfile; }
export function isLoggedIn() { return !!currentUser; }

export function onAuthChange(callback) {
    authListeners.push(callback);
    // Immediately call with current state
    callback(currentUser, userProfile);
}

function notifyListeners() {
    authListeners.forEach(cb => cb(currentUser, userProfile));
}

// ---- Initialize Auth ----
export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Check if profile exists
            const profileSnap = await getUserProfile(user.uid);
            if (profileSnap.exists()) {
                userProfile = profileSnap.val();
                if (userProfile.banned) {
                    await signOut(auth);
                    showToast('Your account has been suspended.');
                    return;
                }
                notifyListeners();
                updateNavAvatar();
            } else {
                // First-time user — show profile setup
                userProfile = null;
                showProfileSetup(user);
            }
        } else {
            currentUser = null;
            userProfile = null;
            notifyListeners();
            updateNavAvatar();
        }
    });
}

// ---- Show Login Modal ----
export function showLoginModal() {
    const existing = document.getElementById('authModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'authModalOverlay';
    overlay.className = 'auth-modal-overlay';
    overlay.innerHTML = `
        <div class="auth-modal">
            <button class="auth-modal-close" id="authCloseBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div class="auth-modal-header">
                <div class="auth-logo">Oops:)</div>
                <p class="auth-subtitle" data-i18n="auth_quick_login">${t('auth_quick_login')}</p>
            </div>

            <!-- Quick Login Form -->
            <form class="auth-form" id="quickLoginForm">
                <div class="auth-field">
                    <input type="text" id="authEmailInput" class="auth-input" placeholder="${t('auth_email_placeholder')}" data-i18n="auth_email_placeholder" required>
                </div>
                <div class="auth-field">
                    <input type="password" id="authPasswordInput" class="auth-input" placeholder="${t('auth_password_placeholder')}" data-i18n="auth_password_placeholder" required>
                </div>
                <button type="submit" class="auth-submit-btn" data-i18n="auth_login_btn">${t('auth_login_btn')}</button>
            </form>

            <div class="auth-divider">
                <span data-i18n="auth_or">${t('auth_or')}</span>
            </div>

            <!-- Google Sign-In -->
            <button class="auth-google-btn" id="googleSignInBtn">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span data-i18n="auth_google_btn">${t('auth_google_btn')}</span>
            </button>

            <div class="auth-footer-text">
                <span data-i18n="auth_forgot_password">${t('auth_forgot_password')}</span>
            </div>

            <div id="authErrorMsg" class="auth-error-msg"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close button
    document.getElementById('authCloseBtn').addEventListener('click', () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 300);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 300);
        }
    });

    // Quick Login
    document.getElementById('quickLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailOrUsername = document.getElementById('authEmailInput').value.trim();
        const password = document.getElementById('authPasswordInput').value;
        const errorEl = document.getElementById('authErrorMsg');

        if (!emailOrUsername || !password) return;

        try {
            let email = emailOrUsername;
            // If it doesn't look like an email, try to resolve username → email
            if (!emailOrUsername.includes('@')) {
                const usernamesSnap = await get(ref(db, 'usernames'));
                const usernames = usernamesSnap.val() || {};
                const uid = Object.keys(usernames).find(k => usernames[k] === emailOrUsername.toLowerCase());
                if (uid) {
                    const profileSnap = await getUserProfile(uid);
                    if (profileSnap.exists()) {
                        email = profileSnap.val().email;
                    }
                }
                if (!email || !email.includes('@')) {
                    errorEl.textContent = 'User not found. Try using your email address.';
                    errorEl.style.display = 'block';
                    return;
                }
            }

            await signInWithEmailAndPassword(auth, email, password);
            overlay.remove();
        } catch (err) {
            console.error('Login error:', err);
            let msg = 'Login failed. Please check your credentials.';
            if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
            if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
            if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials. Please try again.';
            if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later.';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
    });

    // Google Sign-In
    document.getElementById('googleSignInBtn').addEventListener('click', async () => {
        const errorEl = document.getElementById('authErrorMsg');
        try {
            await signInWithPopup(auth, googleProvider);
            overlay.remove();
        } catch (err) {
            console.error('Google sign-in error:', err);
            let msg = 'Google sign-in failed. Please try again.';
            if (err.code === 'auth/popup-closed-by-user') msg = 'Sign-in popup was closed.';
            if (err.code === 'auth/popup-blocked') msg = 'Pop-up was blocked. Please allow pop-ups.';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
    });
}

// ---- Profile Setup (First-time users) ----
function showProfileSetup(user) {
    const existing = document.getElementById('profileSetupOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'profileSetupOverlay';
    overlay.className = 'auth-modal-overlay';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <div class="auth-modal setup-modal">
            <div class="auth-modal-header">
                <div class="auth-logo">Oops:)</div>
                <h2 class="setup-title" data-i18n="setup_title">${t('setup_title')}</h2>
                <p class="auth-subtitle" data-i18n="setup_subtitle">${t('setup_subtitle')}</p>
            </div>

            <form class="auth-form" id="profileSetupForm">
                <div class="auth-field">
                    <label data-i18n="setup_name">${t('setup_name')}</label>
                    <input type="text" id="setupName" class="auth-input" placeholder="${t('setup_name_placeholder')}" value="${user.displayName || ''}" required>
                </div>

                <div class="auth-field">
                    <label data-i18n="setup_username">${t('setup_username')}</label>
                    <input type="text" id="setupUsername" class="auth-input" placeholder="${t('setup_username_placeholder')}" required>
                    <span class="auth-hint" data-i18n="setup_username_hint">${t('setup_username_hint')}</span>
                    <span class="username-status" id="usernameStatus"></span>
                </div>

                <div class="auth-field">
                    <label data-i18n="setup_dob">${t('setup_dob')}</label>
                    <input type="date" id="setupDob" class="auth-input" required>
                    <span class="auth-hint" data-i18n="setup_dob_hint">${t('setup_dob_hint')}</span>
                </div>

                <div class="auth-field">
                    <label data-i18n="setup_password">${t('setup_password')}</label>
                    <input type="password" id="setupPassword" class="auth-input" placeholder="${t('setup_password_placeholder')}" required>
                </div>

                <div id="setupErrorMsg" class="auth-error-msg"></div>

                <button type="submit" class="auth-submit-btn setup-submit" data-i18n="setup_save">${t('setup_save')}</button>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    // Username live validation
    const usernameInput = document.getElementById('setupUsername');
    const usernameStatus = document.getElementById('usernameStatus');
    let usernameTimer = null;

    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value.trim();
        // Auto-lowercase
        usernameInput.value = val.toLowerCase().replace(/[^a-z0-9_]/g, '');

        clearTimeout(usernameTimer);
        if (val.length < 3) {
            usernameStatus.textContent = '';
            usernameStatus.className = 'username-status';
            return;
        }

        usernameStatus.textContent = '⏳ Checking...';
        usernameStatus.className = 'username-status checking';

        usernameTimer = setTimeout(async () => {
            const taken = await isUsernameTaken(usernameInput.value.trim());
            if (taken) {
                usernameStatus.textContent = '❌ Taken';
                usernameStatus.className = 'username-status taken';
            } else {
                usernameStatus.textContent = '✅ Available';
                usernameStatus.className = 'username-status available';
            }
        }, 500);
    });

    // Form submission
    document.getElementById('profileSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('setupErrorMsg');
        errorEl.style.display = 'none';

        const name = document.getElementById('setupName').value.trim();
        const username = document.getElementById('setupUsername').value.trim();
        const dob = document.getElementById('setupDob').value;
        const password = document.getElementById('setupPassword').value;

        // Validate
        if (!name) { showSetupError(t('setup_error_name')); return; }
        if (!/^[a-z0-9_]{3,20}$/.test(username)) { showSetupError(t('setup_error_username')); return; }
        if (!dob) { showSetupError(t('setup_error_dob')); return; }

        // Age check (must be 18+)
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
        if (age < 18) { showSetupError(t('setup_error_age')); return; }

        if (password.length < 6) { showSetupError(t('setup_error_password')); return; }

        // Check username availability
        const taken = await isUsernameTaken(username);
        if (taken) { showSetupError(t('setup_error_username_taken')); return; }

        const submitBtn = overlay.querySelector('.setup-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Creating...';

        try {
            // Link email/password credential for quick login
            const email = user.email;
            try {
                // Create email/password link — this may fail if user already has email provider
                // We use createUserWithEmailAndPassword indirectly by updating password
                const { EmailAuthProvider, linkWithCredential } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js");
                const credential = EmailAuthProvider.credential(email, password);
                await linkWithCredential(user, credential);
            } catch (linkErr) {
                // If linking fails (e.g., credential already in use), just log it
                console.warn('Password linking note:', linkErr.message);
            }

            // Update display name
            await updateProfile(user, { displayName: name });

            // Save profile to database
            await createUserProfile(user.uid, {
                displayName: name,
                username: username,
                email: email,
                photoURL: user.photoURL || '',
                dateOfBirth: dob,
                provider: user.providerData[0]?.providerId || 'google.com'
            });

            // Reserve username
            await reserveUsername(user.uid, username);

            // Reload profile
            const profileSnap = await getUserProfile(user.uid);
            userProfile = profileSnap.val();
            notifyListeners();
            updateNavAvatar();

            overlay.remove();
            showToast('🎉 Welcome to Oops:), ' + name + '!');
        } catch (err) {
            console.error('Profile setup error:', err);
            showSetupError('Failed to create profile. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = t('setup_save');
        }
    });

    function showSetupError(msg) {
        const errorEl = document.getElementById('setupErrorMsg');
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }
}

// ---- Logout ----
export async function logout() {
    try {
        await signOut(auth);
        showToast('Logged out successfully.');
    } catch (err) {
        console.error('Logout error:', err);
    }
}

// ---- Update Nav Avatar ----
function updateNavAvatar() {
    const navProfileBtn = document.querySelector('.nav-item[data-page="profile"]');
    if (!navProfileBtn) return;
    const iconSlot = navProfileBtn.querySelector('.nav-icon-slot');
    if (!iconSlot) return;

    if (currentUser && userProfile) {
        const initial = (userProfile.displayName || userProfile.username || 'U').charAt(0).toUpperCase();
        const color = userProfile.photoURL ? '' : '#833ab4';
        if (userProfile.photoURL) {
            iconSlot.innerHTML = `<img src="${userProfile.photoURL}" alt="" class="nav-avatar-img" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:2px solid var(--text-primary);">`;
        } else {
            iconSlot.innerHTML = `<div class="nav-avatar-circle" style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;border:2px solid var(--text-primary);">${initial}</div>`;
        }
    } else {
        iconSlot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
}

// ---- Toast helper ----
function showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
