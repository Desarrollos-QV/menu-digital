/**
 * FudiApp - Cookie Consent Manager
 * Standalone module (no Vue dependency) — works on all pages.
 * Stores preference in localStorage under key 'fudi_cookie_consent'.
 * 
 * Consent values:
 *   'accepted'  — all cookies allowed
 *   'essential' — only essential cookies (analytics/marketing disabled)
 *   (absent)    — not yet decided → banner is shown
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'fudi_cookie_consent';
    const PREF_KEY    = 'fudi_cookie_prefs';

    // ─── Helpers ────────────────────────────────────────────────────────────────

    const getConsent  = () => localStorage.getItem(STORAGE_KEY);
    const isDarkMode  = () => document.documentElement.classList.contains('dark');

    function setConsent(value, prefs) {
        localStorage.setItem(STORAGE_KEY, value);
        if (prefs) localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
        hideBanner();
        hideModal();
        // Dispatch event so other scripts can react
        window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: { consent: value, prefs } }));
    }

    // ─── Banner HTML ─────────────────────────────────────────────────────────────

    const BANNER_ID = 'fudi-cookie-banner';
    const MODAL_ID  = 'fudi-cookie-modal';

    function createBanner() {
        const banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Aviso de cookies');
        banner.style.cssText = `
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 99999;
            padding: 16px;
            animation: cookieBannerIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        `;

        const dark = isDarkMode();

        banner.innerHTML = `
            <div style="
                max-width: 680px;
                margin: 0 auto;
                background: ${dark ? '#1e293b' : '#ffffff'};
                border: 1px solid ${dark ? '#334155' : '#e2e8f0'};
                border-radius: 20px;
                padding: 20px 24px;
                box-shadow: 0 -4px 32px rgba(0,0,0,${dark ? '0.4' : '0.12'});
                display: flex;
                flex-direction: column;
                gap: 14px;
            ">
                <!-- Header -->
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="
                        width: 36px; height: 36px; border-radius: 10px;
                        background: linear-gradient(135deg, #f97316, #ea580c);
                        display: flex; align-items: center; justify-content: center;
                        flex-shrink: 0; box-shadow: 0 4px 12px rgba(249,115,22,0.3);
                    ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/>
                        </svg>
                    </div>
                    <h2 style="margin:0; font-size:16px; font-weight:800; color:${dark ? '#f1f5f9' : '#0f172a'}; font-family:inherit;">
                        Usamos cookies
                    </h2>
                </div>

                <!-- Body -->
                <p style="margin:0; font-size:13px; line-height:1.6; color:${dark ? '#94a3b8' : '#475569'}; font-family:inherit;">
                    Usamos cookies para mejorar tu experiencia, recordar tu ubicación y personalizar el contenido.
                    Puedes aceptar todas las cookies o configurar tus preferencias.
                    Consulta nuestra <a href="/privacy" style="color:#f97316; text-decoration:underline; font-weight:600;">política de privacidad</a>.
                </p>

                <!-- Buttons -->
                <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
                    <button id="fudi-cookie-config" style="
                        flex: 1 1 140px;
                        padding: 9px 16px;
                        border-radius: 10px;
                        border: 1.5px solid ${dark ? '#475569' : '#cbd5e1'};
                        background: transparent;
                        color: ${dark ? '#94a3b8' : '#64748b'};
                        font-size: 13px; font-weight: 700; cursor: pointer;
                        font-family: inherit; transition: all 0.15s;
                    " onmouseover="this.style.borderColor='#f97316';this.style.color='#f97316'" 
                       onmouseout="this.style.borderColor='${dark ? '#475569' : '#cbd5e1'}';this.style.color='${dark ? '#94a3b8' : '#64748b'}'">
                        ⚙️ Configuración
                    </button>
                    <button id="fudi-cookie-reject" style="
                        flex: 1 1 90px;
                        padding: 9px 16px;
                        border-radius: 10px;
                        border: 1.5px solid ${dark ? '#475569' : '#cbd5e1'};
                        background: ${dark ? '#334155' : '#f1f5f9'};
                        color: ${dark ? '#94a3b8' : '#475569'};
                        font-size: 13px; font-weight: 700; cursor: pointer;
                        font-family: inherit; transition: all 0.15s;
                    " onmouseover="this.style.background='${dark ? '#475569' : '#e2e8f0'}'"
                       onmouseout="this.style.background='${dark ? '#334155' : '#f1f5f9'}'">
                        Rechazar
                    </button>
                    <button id="fudi-cookie-accept" style="
                        flex: 1 1 90px;
                        padding: 9px 16px;
                        border-radius: 10px;
                        border: none;
                        background: linear-gradient(135deg, #f97316, #ea580c);
                        color: white;
                        font-size: 13px; font-weight: 800; cursor: pointer;
                        font-family: inherit; transition: all 0.15s;
                        box-shadow: 0 4px 12px rgba(249,115,22,0.35);
                    " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(249,115,22,0.45)'"
                       onmouseout="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(249,115,22,0.35)'">
                        Aceptar
                    </button>
                </div>
            </div>
        `;

        return banner;
    }

    // ─── Config Modal HTML ───────────────────────────────────────────────────────

    function createModal() {
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 16px;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            animation: cookieBannerIn 0.3s ease both;
        `;

        const dark = isDarkMode();

        // Saved prefs or defaults
        const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
        const prefs = {
            analytics: saved.analytics !== undefined ? saved.analytics : true,
            marketing: saved.marketing !== undefined ? saved.marketing : false,
            functional: saved.functional !== undefined ? saved.functional : true,
        };

        const toggle = (id, checked, disabled) => `
            <label style="display:flex;align-items:center;gap:10px;cursor:${disabled ? 'default' : 'pointer'};">
                <div style="position:relative;width:44px;height:24px;flex-shrink:0;">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="
                        position:absolute;opacity:0;width:0;height:0;
                    " onchange="window._fudiTogglePref('${id}', this.checked)">
                    <div id="${id}-track" style="
                        position:absolute;inset:0;border-radius:12px;transition:background 0.2s;
                        background:${checked ? '#f97316' : (dark ? '#475569' : '#cbd5e1')};
                        ${disabled ? 'opacity:0.5;' : ''}
                    "></div>
                    <div id="${id}-thumb" style="
                        position:absolute;top:3px;left:${checked ? '23px' : '3px'};
                        width:18px;height:18px;border-radius:50%;background:white;
                        transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.2);
                    "></div>
                </div>
            </label>
        `;

        modal.innerHTML = `
            <div style="
                width:100%;max-width:520px;
                background:${dark ? '#1e293b' : '#ffffff'};
                border:1px solid ${dark ? '#334155' : '#e2e8f0'};
                border-radius:20px;padding:24px;
                box-shadow:0 -4px 40px rgba(0,0,0,${dark ? '0.5' : '0.15'});
                max-height:90vh;overflow-y:auto;
                font-family:inherit;
            ">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                    <h2 style="margin:0;font-size:17px;font-weight:800;color:${dark ? '#f1f5f9' : '#0f172a'};">
                        ⚙️ Configuración de cookies
                    </h2>
                    <button id="fudi-cookie-modal-close" style="
                        width:30px;height:30px;border-radius:50%;border:none;
                        background:${dark ? '#334155' : '#f1f5f9'};cursor:pointer;
                        font-size:16px;color:${dark ? '#94a3b8' : '#64748b'};
                        display:flex;align-items:center;justify-content:center;
                    ">✕</button>
                </div>

                <!-- Categorías -->
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                    
                    <!-- Esenciales -->
                    <div style="
                        padding:14px;border-radius:12px;
                        background:${dark ? '#0f172a' : '#f8fafc'};
                        border:1px solid ${dark ? '#1e293b' : '#e2e8f0'};
                        display:flex;justify-content:space-between;align-items:flex-start;gap:12px;
                    ">
                        <div>
                            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${dark ? '#f1f5f9' : '#0f172a'};">
                                🔒 Cookies Esenciales
                            </p>
                            <p style="margin:0;font-size:11px;color:${dark ? '#64748b' : '#94a3b8'};line-height:1.5;">
                                Necesarias para el funcionamiento básico del sitio. Sesión, carrito, preferencias.
                            </p>
                        </div>
                        ${toggle('pref-essential', true, true)}
                    </div>

                    <!-- Funcionales -->
                    <div style="
                        padding:14px;border-radius:12px;
                        background:${dark ? '#0f172a' : '#f8fafc'};
                        border:1px solid ${dark ? '#1e293b' : '#e2e8f0'};
                        display:flex;justify-content:space-between;align-items:flex-start;gap:12px;
                    ">
                        <div>
                            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${dark ? '#f1f5f9' : '#0f172a'};">
                                🎯 Cookies Funcionales
                            </p>
                            <p style="margin:0;font-size:11px;color:${dark ? '#64748b' : '#94a3b8'};line-height:1.5;">
                                Recuerdan tu ubicación, tema visual y preferencias de pedido.
                            </p>
                        </div>
                        ${toggle('pref-functional', prefs.functional, false)}
                    </div>

                    <!-- Analytics -->
                    <div style="
                        padding:14px;border-radius:12px;
                        background:${dark ? '#0f172a' : '#f8fafc'};
                        border:1px solid ${dark ? '#1e293b' : '#e2e8f0'};
                        display:flex;justify-content:space-between;align-items:flex-start;gap:12px;
                    ">
                        <div>
                            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${dark ? '#f1f5f9' : '#0f172a'};">
                                📊 Cookies de Analítica
                            </p>
                            <p style="margin:0;font-size:11px;color:${dark ? '#64748b' : '#94a3b8'};line-height:1.5;">
                                Nos ayudan a entender cómo usas el sitio para mejorar tu experiencia.
                            </p>
                        </div>
                        ${toggle('pref-analytics', prefs.analytics, false)}
                    </div>

                    <!-- Marketing -->
                    <div style="
                        padding:14px;border-radius:12px;
                        background:${dark ? '#0f172a' : '#f8fafc'};
                        border:1px solid ${dark ? '#1e293b' : '#e2e8f0'};
                        display:flex;justify-content:space-between;align-items:flex-start;gap:12px;
                    ">
                        <div>
                            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${dark ? '#f1f5f9' : '#0f172a'};">
                                📣 Cookies de Marketing
                            </p>
                            <p style="margin:0;font-size:11px;color:${dark ? '#64748b' : '#94a3b8'};line-height:1.5;">
                                Permiten mostrar contenido y promociones personalizadas.
                            </p>
                        </div>
                        ${toggle('pref-marketing', prefs.marketing, false)}
                    </div>
                </div>

                <!-- Actions -->
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button id="fudi-cookie-save-prefs" style="
                        flex:1;padding:11px 16px;border-radius:10px;
                        border:none;background:linear-gradient(135deg,#f97316,#ea580c);
                        color:white;font-size:13px;font-weight:800;cursor:pointer;
                        font-family:inherit;box-shadow:0 4px 12px rgba(249,115,22,0.35);
                    ">Guardar mis preferencias</button>
                    <button id="fudi-cookie-accept-all-modal" style="
                        flex:1;padding:11px 16px;border-radius:10px;
                        border:1.5px solid ${dark ? '#475569' : '#cbd5e1'};
                        background:transparent;color:${dark ? '#94a3b8' : '#64748b'};
                        font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
                    ">Aceptar todas</button>
                </div>
            </div>
        `;

        return modal;
    }

    // ─── Toggle global para inputs del modal ─────────────────────────────────────

    window._fudiTogglePref = function(id, checked) {
        const track = document.getElementById(id + '-track');
        const thumb = document.getElementById(id + '-thumb');
        if (track) track.style.background = checked ? '#f97316' : (isDarkMode() ? '#475569' : '#cbd5e1');
        if (thumb) thumb.style.left = checked ? '23px' : '3px';
    };

    // ─── Show / Hide ─────────────────────────────────────────────────────────────

    function showBanner() {
        if (document.getElementById(BANNER_ID)) return;
        const banner = createBanner();
        document.body.appendChild(banner);

        document.getElementById('fudi-cookie-accept').onclick = () => setConsent('accepted', { analytics: true, marketing: true, functional: true });
        document.getElementById('fudi-cookie-reject').onclick = () => setConsent('essential', { analytics: false, marketing: false, functional: false });
        document.getElementById('fudi-cookie-config').onclick = showConfigModal;
    }

    function hideBanner() {
        const el = document.getElementById(BANNER_ID);
        if (el) {
            el.style.animation = 'cookieBannerOut 0.3s ease forwards';
            setTimeout(() => el.remove(), 320);
        }
    }

    function showConfigModal() {
        if (document.getElementById(MODAL_ID)) return;
        const modal = createModal();
        document.body.appendChild(modal);

        document.getElementById('fudi-cookie-modal-close').onclick = hideModal;
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

        document.getElementById('fudi-cookie-save-prefs').onclick = () => {
            const prefs = {
                essential: true,
                functional: document.getElementById('pref-functional')?.checked ?? true,
                analytics:  document.getElementById('pref-analytics')?.checked  ?? true,
                marketing:  document.getElementById('pref-marketing')?.checked  ?? false,
            };
            const allOn = prefs.functional && prefs.analytics && prefs.marketing;
            setConsent(allOn ? 'accepted' : 'essential', prefs);
        };

        document.getElementById('fudi-cookie-accept-all-modal').onclick = () => {
            setConsent('accepted', { analytics: true, marketing: true, functional: true });
        };
    }

    function hideModal() {
        const el = document.getElementById(MODAL_ID);
        if (el) {
            el.style.animation = 'cookieBannerOut 0.25s ease forwards';
            setTimeout(() => el.remove(), 280);
        }
    }

    // ─── CSS Animations ──────────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('fudi-cookie-styles')) return;
        const style = document.createElement('style');
        style.id = 'fudi-cookie-styles';
        style.textContent = `
            @keyframes cookieBannerIn {
                from { opacity: 0; transform: translateY(20px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes cookieBannerOut {
                from { opacity: 1; transform: translateY(0); }
                to   { opacity: 0; transform: translateY(20px); }
            }
            #fudi-cookie-banner *,
            #fudi-cookie-modal * {
                box-sizing: border-box;
                font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Public API ──────────────────────────────────────────────────────────────

    window.FudiCookies = {
        /** Show the config modal manually (e.g. from footer link) */
        openSettings: showConfigModal,
        /** Get current consent value */
        getConsent,
        /** Check if a specific category is allowed */
        isAllowed(category) {
            const consent = getConsent();
            if (consent === 'accepted') return true;
            if (!consent || consent === 'essential') {
                if (category === 'essential') return true;
                const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
                return prefs[category] === true;
            }
            return false;
        }
    };

    // ─── Init ────────────────────────────────────────────────────────────────────

    function init() {
        injectStyles();
        // Only show if no consent stored yet
        if (!getConsent()) {
            // Small delay so the page renders first
            setTimeout(showBanner, 800);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
