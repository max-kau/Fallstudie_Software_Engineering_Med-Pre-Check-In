import { auth } from '../utils/auth.js';
import { navigate, handleRoute } from '../utils/router.js';
import { t, getLanguage, setLanguage } from '../utils/i18n.js';

export function renderDlNav() {
  const loggedIn = auth.isLoggedIn();
  const user = auth.getUser();
  const currentLang = getLanguage();
  
  return `
    <nav class="dl-nav">
      <div class="dl-nav-inner">
        <div class="dl-nav-brand" style="cursor: pointer;" id="dl-nav-logo-btn">
          <svg class="dl-nav-logo" width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#0063BE" stroke-width="2"/>
            <path d="M10 16.5C10 13.5 12.5 11 16 11C19.5 11 22 13.5 22 16.5C22 19.5 19.5 22 16 22" stroke="#0063BE" stroke-width="2" stroke-linecap="round"/>
            <circle cx="16" cy="16.5" r="2" fill="#0063BE"/>
          </svg>
          <span class="dl-nav-name">Doctolib</span>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-3);">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <!-- Language Switcher Dropdown -->
          <div class="dl-nav-dropdown-wrapper" id="dl-lang-wrapper" style="position: relative;">
            <button class="dl-lang-switch-btn" id="btn-lang-toggle" title="${t('common.select_lang')}" style="background: var(--gray-100); border: 1px solid var(--gray-200); border-radius: var(--radius-full); padding: 5px 12px; font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--gray-700); transition: all 0.2s ease;">
              <span>${currentLang === 'de' ? '🇩🇪 DE' : '🇬🇧 EN'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="dl-nav-dropdown-menu" id="lang-dropdown-menu" style="display: none; min-width: 140px; right: 0; top: calc(100% + 6px);">
              <button class="dl-dropdown-item ${currentLang === 'de' ? 'active' : ''}" id="btn-lang-select-de" style="display: flex; align-items: center; gap: 8px; font-weight: ${currentLang === 'de' ? '700' : '500'}; color: ${currentLang === 'de' ? 'var(--primary)' : 'inherit'}; cursor: pointer;">
                <span>🇩🇪</span> Deutsch
              </button>
              <button class="dl-dropdown-item ${currentLang === 'en' ? 'active' : ''}" id="btn-lang-select-en" style="display: flex; align-items: center; gap: 8px; font-weight: ${currentLang === 'en' ? '700' : '500'}; color: ${currentLang === 'en' ? 'var(--primary)' : 'inherit'}; cursor: pointer;">
                <span>🇬🇧</span> English
              </button>
            </div>
          </div>

          <div class="dl-nav-links">
            ${loggedIn ? `
              <div style="display: flex; align-items: center; gap: var(--space-5);">
                ${user.role === 'patient' ? `
                <a href="#home" class="dl-nav-search-link" style="color: var(--gray-600); font-weight: 600; font-size: var(--font-size-sm); display: flex; align-items: center; gap: 6px; text-decoration: none; transition: color var(--transition-fast);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  ${t('nav.search_praxis')}
                </a>
                ` : ''}
                <div class="dl-nav-dropdown-wrapper">
                  <button class="dl-nav-dropdown-trigger" id="btn-user-dropdown">
                    <div class="dl-nav-user-avatar">${user.role === 'admin' ? '🛡️' : (user.role === 'praxis' ? '🏥' : `${(user.vorname || '')[0] || ''}${(user.nachname || '')[0] || ''}`)}</div>
                    <span class="dl-nav-user-name">${user.role === 'admin' ? t('nav.system_admin') : (user.role === 'praxis' ? (user.praxis_name || 'Praxis') : `${user.vorname} ${user.nachname}`)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                <div class="dl-nav-dropdown-menu" id="user-dropdown-menu" style="display: none;">
                  <button class="dl-dropdown-item" id="btn-menu-appointments">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${user.role === 'admin' ? t('nav.test_dashboard') : (user.role === 'praxis' ? t('nav.dashboard') : t('nav.my_appointments'))}
                  </button>
                  <div class="dl-dropdown-divider"></div>
                  <button class="dl-dropdown-item" id="btn-menu-profile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${t('nav.profile_data')}
                  </button>
                  <div class="dl-dropdown-divider"></div>
                  <button class="dl-dropdown-item dl-dropdown-item--logout" id="btn-menu-logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    ${t('nav.logout')}
                  </button>
                </div>
              </div>
              </div>
            ` : `
              <button class="dl-nav-auth-btn" id="btn-nav-login">${t('nav.login')}</button>
            `}
          </div>
        </div>
      </div>
    </nav>
  `;
}

export function initDlNav() {
  // Logo redirect
  const logoBtn = document.getElementById('dl-nav-logo-btn');
  if (logoBtn) {
    const newLogoBtn = logoBtn.cloneNode(true);
    logoBtn.replaceWith(newLogoBtn);
    newLogoBtn.addEventListener('click', () => {
      navigate('home');
    });
  }

  // Language Dropdown Logic (Independent of auth status)
  const langWrapper = document.getElementById('dl-lang-wrapper');
  if (langWrapper) {
    const newLangWrapper = langWrapper.cloneNode(true);
    langWrapper.replaceWith(newLangWrapper);

    const langBtn = newLangWrapper.querySelector('#btn-lang-toggle');
    const langMenu = newLangWrapper.querySelector('#lang-dropdown-menu');

    if (langBtn) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (langMenu) {
          const isHidden = langMenu.style.display === 'none';
          langMenu.style.display = isHidden ? 'block' : 'none';
        }
      });
    }

    newLangWrapper.querySelector('#btn-lang-select-de')?.addEventListener('click', () => {
      setLanguage('de');
    });

    newLangWrapper.querySelector('#btn-lang-select-en')?.addEventListener('click', () => {
      setLanguage('en');
    });
  }

  // Close language menu on outside click
  document.addEventListener('click', () => {
    const langMenu = document.getElementById('lang-dropdown-menu');
    if (langMenu) langMenu.style.display = 'none';
  });

  // Login button
  const loginBtn = document.getElementById('btn-nav-login');
  if (loginBtn) {
    const newLoginBtn = loginBtn.cloneNode(true);
    loginBtn.replaceWith(newLoginBtn);
    newLoginBtn.addEventListener('click', () => {
      navigate('auth');
    });
  }

  // Dropdown wrapper (strips duplicate listeners on trigger and menu items!)
  const wrapper = document.querySelector('.dl-nav-dropdown-wrapper:not(#dl-lang-wrapper)');
  if (wrapper) {
    const newWrapper = wrapper.cloneNode(true);
    wrapper.replaceWith(newWrapper);

    const trigger = newWrapper.querySelector('#btn-user-dropdown');
    const menu = newWrapper.querySelector('#user-dropdown-menu');

    if (trigger && menu) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = menu.style.display === 'none';
        menu.style.display = show ? 'block' : 'none';
        trigger.classList.toggle('active', show);
      });

      if (window._dlNavClickOutsideHandler) {
        document.removeEventListener('click', window._dlNavClickOutsideHandler);
      }
      window._dlNavClickOutsideHandler = () => {
        const activeMenu = document.getElementById('user-dropdown-menu');
        const activeTrigger = document.getElementById('btn-user-dropdown');
        if (activeMenu) activeMenu.style.display = 'none';
        if (activeTrigger) activeTrigger.classList.remove('active');
      };
      document.addEventListener('click', window._dlNavClickOutsideHandler);
    }

    // Logout button in dropdown
    newWrapper.querySelector('#btn-menu-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.logout();
      // Remove profile modal from DOM
      document.getElementById('profile-modal')?.remove();
      navigate('home');
      handleRoute();
    });

    // Appointments / Dashboard button in dropdown
    newWrapper.querySelector('#btn-menu-appointments')?.addEventListener('click', () => {
      if (auth.isAdmin()) {
        navigate('test-dashboard');
      } else if (auth.isPraxis()) {
        navigate('praxis-dashboard');
      } else {
        navigate('landing');
      }
    });

    // Profile data button in dropdown
    newWrapper.querySelector('#btn-menu-profile')?.addEventListener('click', () => {
      openProfileModal();
    });
  }
}

function openProfileModal() {
  document.getElementById('profile-modal')?.remove();

  const modalHtml = `
    <div class="dl-modal-backdrop" id="profile-modal">
      <div class="dl-modal-card fade-in-up" style="max-height: 90vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">${t('profile.title')}</h3>
          <button class="dl-modal-close" id="btn-close-profile">&times;</button>
        </div>
        <div id="profile-modal-content" style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
          <!-- Content rendered dynamically -->
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('profile-modal');
  const closeBtn = document.getElementById('btn-close-profile');
  const contentContainer = document.getElementById('profile-modal-content');

  const closeModal = () => modal.remove();

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function showOverview() {
    const u = auth.getUser() || {};
    
    if (u.role === 'praxis') {
      const addressFormatted = u.praxis_adresse || '—';
      const defaultHours = {
        "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
        "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
        "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
      };
      const oh = u.opening_hours || defaultHours;

      let hoursHtml = '';
      const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
      days.forEach(d => {
        const dayHours = oh[d] || defaultHours[d];
        const timeText = dayHours.closed ? '<span style="color: var(--danger); font-weight: 600;">Geschlossen</span>' : `${dayHours.start} - ${dayHours.end} Uhr`;
        hoursHtml += `
          <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--gray-100);">
            <span style="font-weight: 500; color: var(--gray-700);">${d}</span>
            <span style="color: var(--gray-900);">${timeText}</span>
          </div>
        `;
      });

      contentContainer.innerHTML = `
        <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
          <p class="text-muted" style="margin-bottom: var(--space-5); font-size: var(--font-size-sm); line-height: 1.4; color: var(--gray-500);">
            Hier finden Sie die in Ihrem Doctolib-Konto hinterlegten Praxisdaten und Öffnungszeiten.
          </p>

          <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-bottom: var(--space-6);">
            <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
              <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Ansprechpartner</div>
              <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.vorname || '—'} ${u.nachname || '—'}</div>
            </div>

            <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
              <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Praxisname</div>
              <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.praxis_name || '—'}</div>
            </div>

            <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
              <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Fachbereich</div>
              <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.praxis_fachbereich || '—'}</div>
            </div>

            <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
              <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Adresse</div>
              <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${addressFormatted || '—'}</div>
            </div>

            <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
              <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Telefonnummer</div>
              <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.praxis_telefon || '—'}</div>
            </div>
          </div>

          <h4 style="margin-bottom: var(--space-3); color: var(--gray-800); border-bottom: 2px solid var(--primary); padding-bottom: 4px; display: inline-block;">Öffnungszeiten</h4>
          <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--gray-200);">
            ${hoursHtml}
          </div>
        </div>
        <div class="dl-modal-footer" style="flex-shrink: 0;">
          <button type="button" class="btn btn-outline" id="btn-close-overview" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Schließen</button>
          <button type="button" class="btn btn-primary" id="btn-edit-profile" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Ändern</button>
        </div>
      `;

      document.getElementById('btn-close-overview')?.addEventListener('click', closeModal);
      document.getElementById('btn-edit-profile')?.addEventListener('click', showEditForm);
      return;
    }

    const versicherungText = u.krankenversicherung === 'privat' ? t('auth.privat') : t('auth.gesetzlich');
    const addressFormatted = [u.strasse_hnr, u.plz_ort].filter(Boolean).join(', ');

    contentContainer.innerHTML = `
      <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
        
        <!-- Language Settings Card -->
        <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 14px; margin-bottom: var(--space-5);">
          <div style="font-weight: 700; font-size: var(--font-size-xs); color: var(--gray-700); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            🌐 ${t('profile.lang_setting')}
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-modal-lang-de" class="btn btn-sm ${getLanguage() === 'de' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.82rem; border-radius: 8px; cursor: pointer;">
              🇩🇪 Deutsch
            </button>
            <button type="button" id="btn-modal-lang-en" class="btn btn-sm ${getLanguage() === 'en' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.82rem; border-radius: 8px; cursor: pointer;">
              🇬🇧 English
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-bottom: var(--space-2);">
          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${t('profile.name')}</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.vorname || '—'} ${u.nachname || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${t('profile.dob')}</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.geburtsdatum || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${t('profile.phone')}</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.telefonnummer || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${t('profile.address')}</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${addressFormatted || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${t('profile.insurance')}</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${versicherungText} ${u.krankenkasse ? `(${u.krankenkasse})` : ''}</div>
          </div>
        </div>
      </div>
      <div class="dl-modal-footer" style="flex-shrink: 0;">
        <button type="button" class="btn btn-outline" id="btn-close-overview" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">${t('common.close')}</button>
        <button type="button" class="btn btn-primary" id="btn-edit-profile" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">${t('common.edit')}</button>
      </div>
    `;

    document.getElementById('btn-modal-lang-de')?.addEventListener('click', () => {
      setLanguage('de');
      showOverview();
    });
    document.getElementById('btn-modal-lang-en')?.addEventListener('click', () => {
      setLanguage('en');
      showOverview();
    });

    document.getElementById('btn-close-overview')?.addEventListener('click', closeModal);
    document.getElementById('btn-edit-profile')?.addEventListener('click', showEditForm);
  }

  function showEditForm() {
    const u = auth.getUser() || {};

    if (u.role === 'praxis') {
      const defaultHours = {
        "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
        "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
        "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
      };
      const oh = u.opening_hours || defaultHours;
      const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

      let hoursFormHtml = '';
      days.forEach(d => {
        const dayHours = oh[d] || defaultHours[d];
        const isChecked = !dayHours.closed;
        hoursFormHtml += `
          <div class="opening-hour-row" style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); flex-wrap: wrap;">
            <div style="min-width: 100px; font-weight: 600; color: var(--gray-700);">${d}</div>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-size-sm); color: var(--gray-600); margin: 0; user-select: none;">
              <input type="checkbox" class="oh-toggle" data-day="${d}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
              Geöffnet
            </label>
            <div class="time-inputs-container" style="display: flex; align-items: center; gap: 8px;">
              <input type="time" class="oh-start" data-day="${d}" value="${dayHours.start || '08:00'}" ${!isChecked ? 'disabled' : ''} style="border: 1px solid var(--gray-300); padding: 4px var(--space-2); border-radius: var(--radius-md); font-size: var(--font-size-sm);" />
              <span style="font-size: var(--font-size-xs); color: var(--gray-400);">bis</span>
              <input type="time" class="oh-end" data-day="${d}" value="${dayHours.end || '16:00'}" ${!isChecked ? 'disabled' : ''} style="border: 1px solid var(--gray-300); padding: 4px var(--space-2); border-radius: var(--radius-md); font-size: var(--font-size-sm);" />
            </div>
          </div>
        `;
      });

      contentContainer.innerHTML = `
        <form id="form-profile-update" style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; margin: 0;">
          <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
            <p class="text-muted" style="margin-bottom: var(--space-4); font-size: var(--font-size-sm); line-height: 1.4; color: var(--gray-500);">
              Nehmen Sie hier Ihre gewünschten Änderungen vor und speichern Sie diese ab.
            </p>

            <h5 style="font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-3);">Ansprechpartner</h5>
            <div class="dl-auth-name-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4);">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Vorname</label>
                <input type="text" id="profile-vorname" class="form-input" value="${u.vorname || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Nachname</label>
                <input type="text" id="profile-nachname" class="form-input" value="${u.nachname || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
              </div>
            </div>

            <h5 style="font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-3); border-top: 1px solid var(--gray-200); padding-top: var(--space-4);">Praxis-Details</h5>
            <div class="form-group" style="margin-bottom: var(--space-3);">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Praxisname</label>
              <input type="text" id="profile-praxis-name" class="form-input" value="${u.praxis_name || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>

            <div class="form-group" style="margin-bottom: var(--space-3);">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Fachbereich</label>
              <input type="text" id="profile-praxis-fachbereich" class="form-input" value="${u.praxis_fachbereich || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>

            <div class="form-group" style="margin-bottom: var(--space-3);">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Adresse</label>
              <input type="text" id="profile-praxis-adresse" class="form-input" value="${u.praxis_adresse || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>

            <div class="form-group" style="margin-bottom: var(--space-4);">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Telefonnummer</label>
              <input type="tel" id="profile-praxis-telefon" class="form-input" value="${u.praxis_telefon || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>

            <h5 style="font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-3); border-top: 1px solid var(--gray-200); padding-top: var(--space-4);">Öffnungszeiten</h5>
            <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--gray-200); margin-bottom: var(--space-3);">
              ${hoursFormHtml}
            </div>

            <div class="dl-auth-error" id="profile-error" style="display:none; color: var(--danger); font-size: var(--font-size-xs); margin-top: var(--space-2); font-weight: 600;"></div>
          </div>
          <div class="dl-modal-footer" style="flex-shrink: 0;">
            <button type="button" class="btn btn-outline" id="btn-cancel-edit" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Abbrechen</button>
            <button type="submit" class="btn btn-primary" id="btn-save-profile" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Speichern</button>
          </div>
        </form>
      `;

      // Enable/disable times based on toggle
      contentContainer.querySelectorAll('.oh-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const day = chk.getAttribute('data-day');
          const startInput = contentContainer.querySelector(`.oh-start[data-day="${day}"]`);
          const endInput = contentContainer.querySelector(`.oh-end[data-day="${day}"]`);
          if (startInput && endInput) {
            startInput.disabled = !e.target.checked;
            endInput.disabled = !e.target.checked;
          }
        });
      });

      document.getElementById('btn-cancel-edit')?.addEventListener('click', showOverview);

      const form = document.getElementById('form-profile-update');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-profile');
        const errorEl = document.getElementById('profile-error');
        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Wird gespeichert…';

        // Gather opening hours
        const opening_hours = {};
        days.forEach(d => {
          const chk = form.querySelector(`.oh-toggle[data-day="${d}"]`);
          const start = form.querySelector(`.oh-start[data-day="${d}"]`).value;
          const end = form.querySelector(`.oh-end[data-day="${d}"]`).value;
          opening_hours[d] = {
            closed: !chk.checked,
            start: start,
            end: end
          };
        });

        const payload = {
          vorname: document.getElementById('profile-vorname').value.trim(),
          nachname: document.getElementById('profile-nachname').value.trim(),
          praxis_name: document.getElementById('profile-praxis-name').value.trim(),
          praxis_fachbereich: document.getElementById('profile-praxis-fachbereich').value.trim(),
          praxis_adresse: document.getElementById('profile-praxis-adresse').value.trim(),
          praxis_telefon: document.getElementById('profile-praxis-telefon').value.trim(),
          opening_hours: opening_hours
        };

        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Profil konnte nicht gespeichert werden');
          
          await auth.checkSession(true);
          
          window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: auth.getUser() } }));
          
          showOverview();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Speichern';
        }
      });
      return;
    }

    contentContainer.innerHTML = `
      <form id="form-profile-update" style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; margin: 0;">
        <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
          <p class="text-muted" style="margin-bottom: var(--space-4); font-size: var(--font-size-sm); line-height: 1.4; color: var(--gray-500);">
            Nehmen Sie hier Ihre gewünschten Änderungen vor und speichern Sie diese ab.
          </p>

          <div class="dl-auth-name-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Vorname</label>
              <input type="text" id="profile-vorname" class="form-input" value="${u.vorname || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Nachname</label>
              <input type="text" id="profile-nachname" class="form-input" value="${u.nachname || ''}" required style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Geburtsdatum</label>
            <input type="text" id="profile-geburtsdatum" class="form-input" placeholder="TT.MM.JJJJ" value="${u.geburtsdatum || ''}" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Telefonnummer</label>
            <input type="tel" id="profile-telefonnummer" class="form-input" placeholder="+49 170 1234567" value="${u.telefonnummer || ''}" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Straße & Hausnummer</label>
            <input type="text" id="profile-strasse-hnr" class="form-input" placeholder="Musterstraße 42" value="${u.strasse_hnr || ''}" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">PLZ & Ort</label>
            <input type="text" id="profile-plz-ort" class="form-input" placeholder="12345 Musterstadt" value="${u.plz_ort || ''}" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
          </div>

          <div class="dl-auth-name-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Versicherungsart</label>
              <select id="profile-vers-art" class="form-input" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md); height: 38px;">
                <option value="gesetzlich" ${u.krankenversicherung === 'gesetzlich' ? 'selected' : ''}>Gesetzlich</option>
                <option value="privat" ${u.krankenversicherung === 'privat' ? 'selected' : ''}>Privat</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-600); margin-bottom: var(--space-1); display: block;">Krankenkasse</label>
              <input type="text" id="profile-krankenkasse" class="form-input" placeholder="AOK, Techniker..." value="${u.krankenkasse || ''}" style="width: 100%; border: 1px solid var(--gray-300); padding: var(--space-2); border-radius: var(--radius-md);" />
            </div>
          </div>

          <div class="dl-auth-error" id="profile-error" style="display:none; color: var(--danger); font-size: var(--font-size-xs); margin-top: var(--space-2); font-weight: 600;"></div>
        </div>
        <div class="dl-modal-footer" style="flex-shrink: 0;">
          <button type="button" class="btn btn-outline" id="btn-cancel-edit" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Abbrechen</button>
          <button type="submit" class="btn btn-primary" id="btn-save-profile" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Speichern</button>
        </div>
      </form>
    `;

    document.getElementById('btn-cancel-edit')?.addEventListener('click', showOverview);

    const form = document.getElementById('form-profile-update');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-profile');
      const errorEl = document.getElementById('profile-error');
      errorEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Wird gespeichert…';

      const payload = {
        vorname: document.getElementById('profile-vorname').value.trim(),
        nachname: document.getElementById('profile-nachname').value.trim(),
        geburtsdatum: document.getElementById('profile-geburtsdatum').value.trim(),
        telefonnummer: document.getElementById('profile-telefonnummer').value.trim(),
        strasse_hnr: document.getElementById('profile-strasse-hnr').value.trim(),
        plz_ort: document.getElementById('profile-plz-ort').value.trim(),
        krankenversicherung: document.getElementById('profile-vers-art').value,
        krankenkasse: document.getElementById('profile-krankenkasse').value.trim(),
      };

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Profil konnte nicht gespeichert werden');
        
        await auth.checkSession(true);
        
        window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: auth.getUser() } }));
        
        showOverview();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Speichern';
      }
    });
  }

  showOverview();
}
