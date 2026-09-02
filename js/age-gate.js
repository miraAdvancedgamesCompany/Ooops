// ==========================================
// Oops:) — Age Verification Gate
// ==========================================

import { t, getCurrentLang } from './i18n.js';

export function checkAgeGate() {
    // If already verified in this session, skip
    if (sessionStorage.getItem('oops_age_verified') === 'true') return true;

    showAgeGateModal();
    return false;
}

function showAgeGateModal() {
    // Remove any existing gate
    const existing = document.getElementById('ageGateOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ageGateOverlay';
    overlay.className = 'age-gate-overlay';
    overlay.innerHTML = `
        <div class="age-gate-card">
            <div class="age-gate-logo">Oops:)</div>
            <div class="age-gate-icon">🔞</div>
            <h1 class="age-gate-title" data-i18n="age_title">${t('age_title')}</h1>
            <p class="age-gate-message" data-i18n="age_message">${t('age_message')}</p>
            <p class="age-gate-disclaimer" data-i18n="age_disclaimer">${t('age_disclaimer')}</p>
            <div class="age-gate-actions">
                <button class="age-gate-btn age-gate-enter" id="ageGateEnter" data-i18n="age_over18">${t('age_over18')}</button>
                <button class="age-gate-btn age-gate-leave" id="ageGateLeave" data-i18n="age_under18">${t('age_under18')}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Block all interaction with the app
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.filter = 'blur(20px)';

    document.getElementById('ageGateEnter').addEventListener('click', () => {
        sessionStorage.setItem('oops_age_verified', 'true');
        overlay.classList.add('closing');
        if (appContainer) appContainer.style.filter = '';
        setTimeout(() => overlay.remove(), 400);
        // Dispatch event for app to continue initialization
        window.dispatchEvent(new CustomEvent('ageVerified'));
    });

    document.getElementById('ageGateLeave').addEventListener('click', () => {
        // Redirect away
        window.location.href = 'https://www.google.com';
    });
}
