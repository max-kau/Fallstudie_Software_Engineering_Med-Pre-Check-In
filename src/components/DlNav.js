import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';

export function renderDlNav() {
  const loggedIn = auth.isLoggedIn();
  const user = auth.getUser();
  
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
        <div class="dl-nav-links">
          ${loggedIn ? `
            <div class="dl-nav-dropdown-wrapper">
              <button class="dl-nav-dropdown-trigger" id="btn-user-dropdown">
                <div class="dl-nav-user-avatar">${(user.vorname || '')[0] || ''}${(user.nachname || '')[0] || ''}</div>
                <span class="dl-nav-user-name">${user.vorname} ${user.nachname}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="dl-nav-dropdown-menu" id="user-dropdown-menu" style="display: none;">
                <button class="dl-dropdown-item" id="btn-menu-profile">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profildaten hinzufügen
                </button>
                <div class="dl-dropdown-divider"></div>
                <button class="dl-dropdown-item dl-dropdown-item--logout" id="btn-menu-logout">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Abmelden
                </button>
              </div>
            </div>
          ` : `
            <button class="dl-nav-auth-btn" id="btn-nav-login">Anmelden</button>
          `}
        </div>
      </div>
    </nav>
  `;
}

export function initDlNav() {
  // Logo redirect
  document.getElementById('dl-nav-logo-btn')?.addEventListener('click', () => {
    navigate(auth.isLoggedIn() ? 'landing' : 'home');
  });

  // Login button
  document.getElementById('btn-nav-login')?.addEventListener('click', () => {
    navigate('auth');
  });

  // Dropdown toggle
  const trigger = document.getElementById('btn-user-dropdown');
  const menu = document.getElementById('user-dropdown-menu');

  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const show = menu.style.display === 'none';
      menu.style.display = show ? 'block' : 'none';
      trigger.classList.toggle('active', show);
    });

    // Close on click outside
    document.addEventListener('click', () => {
      menu.style.display = 'none';
      trigger.classList.remove('active');
    });
  }

  // Logout button in dropdown
  document.getElementById('btn-menu-logout')?.addEventListener('click', async () => {
    await auth.logout();
    navigate('home');
  });

  // Profile data button in dropdown
  document.getElementById('btn-menu-profile')?.addEventListener('click', () => {
    openProfileModal();
  });
}

function openProfileModal() {
  document.getElementById('profile-modal')?.remove();

  const modalHtml = `
    <div class="dl-modal-backdrop" id="profile-modal">
      <div class="dl-modal-card fade-in-up" style="max-height: 90vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">Meine Profildaten</h3>
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
    const versicherungText = u.krankenversicherung === 'privat' ? 'Privat' : 'Gesetzlich';
    const addressFormatted = [u.strasse_hnr, u.plz_ort].filter(Boolean).join(', ');

    contentContainer.innerHTML = `
      <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
        <p class="text-muted" style="margin-bottom: var(--space-5); font-size: var(--font-size-sm); line-height: 1.4; color: var(--gray-500);">
          Hier finden Sie die in Ihrem Doctolib-Konto hinterlegten Profildaten. Diese werden automatisch für den Pre-Check-In verwendet.
        </p>

        <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-bottom: var(--space-2);">
          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Name</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.vorname || '—'} ${u.nachname || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Geburtsdatum</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.geburtsdatum || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Telefonnummer</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${u.telefonnummer || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Adresse</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${addressFormatted || '—'}</div>
          </div>

          <div style="border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-2);">
            <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Krankenversicherung</div>
            <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-weight: 500;">${versicherungText} ${u.krankenkasse ? `(${u.krankenkasse})` : ''}</div>
          </div>
        </div>
      </div>
      <div class="dl-modal-footer" style="flex-shrink: 0;">
        <button type="button" class="btn btn-outline" id="btn-close-overview" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Schließen</button>
        <button type="button" class="btn btn-primary" id="btn-edit-profile" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Ändern</button>
      </div>
    `;

    document.getElementById('btn-close-overview')?.addEventListener('click', closeModal);
    document.getElementById('btn-edit-profile')?.addEventListener('click', showEditForm);
  }

  function showEditForm() {
    const u = auth.getUser() || {};

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
