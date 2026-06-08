import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

export function renderAuthView() {
  return `
    ${renderDlNav()}

    <!-- Auth Card -->
    <div class="dl-auth-page">
      <div class="dl-auth-card fade-in-up">

        <!-- Role Selector -->
        <div class="dl-auth-role-selector">
          <button class="dl-auth-role-btn active" data-role="patient" id="role-patient">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Als Patient
          </button>
          <button class="dl-auth-role-btn" data-role="praxis" id="role-praxis">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Als Praxis
          </button>
        </div>

        <!-- Tabs -->
        <div class="dl-auth-tabs">
          <button class="dl-auth-tab active" data-tab="login" id="tab-login">Anmelden</button>
          <button class="dl-auth-tab" data-tab="register" id="tab-register">Registrieren</button>
        </div>

        <!-- Login Form (same for both roles) -->
        <form class="dl-auth-form" id="form-login">
          <div class="dl-auth-form-inner">
            <div class="form-group">
              <label class="form-label" for="login-email">E-Mail-Adresse</label>
              <input type="email" id="login-email" class="form-input" placeholder="ihre@email.de" autocomplete="email" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">Passwort</label>
              <div class="dl-auth-password-wrapper">
                <input type="password" id="login-password" class="form-input" placeholder="Ihr Passwort" autocomplete="current-password" required />
                <button type="button" class="dl-auth-toggle-pw" id="toggle-login-pw" tabindex="-1">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>

            <div class="dl-auth-error" id="login-error" style="display:none;"></div>

            <button type="submit" class="dl-auth-submit" id="btn-login">
              <span class="dl-auth-submit-text">Anmelden</span>
              <div class="dl-auth-spinner" style="display:none;"></div>
            </button>
          </div>
        </form>

        <!-- Register Form: Patient -->
        <form class="dl-auth-form" id="form-register" style="display:none;">
          <div class="dl-auth-form-inner">
            <div class="dl-auth-name-row">
              <div class="form-group">
                <label class="form-label" for="register-vorname">Vorname *</label>
                <input type="text" id="register-vorname" class="form-input" placeholder="Max" autocomplete="given-name" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="register-nachname">Nachname *</label>
                <input type="text" id="register-nachname" class="form-input" placeholder="Mustermann" autocomplete="family-name" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-geburtsdatum">Geburtsdatum *</label>
              <input type="date" id="register-geburtsdatum" class="form-input" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-versicherung">Krankenversicherung *</label>
              <select id="register-versicherung" class="form-input" required style="height: 42px;">
                <option value="">Bitte wählen...</option>
                <option value="gesetzlich">Gesetzlich versichert</option>
                <option value="privat">Privat versichert</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-email">E-Mail-Adresse *</label>
              <input type="email" id="register-email" class="form-input" placeholder="ihre@email.de" autocomplete="email" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-password">Passwort *</label>
              <input type="password" id="register-password" class="form-input" placeholder="Mind. 6 Zeichen" autocomplete="new-password" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-password2">Passwort wiederholen *</label>
              <input type="password" id="register-password2" class="form-input" placeholder="Passwort bestätigen" autocomplete="new-password" required />
            </div>

            <div class="dl-auth-error" id="register-error" style="display:none;"></div>

            <button type="submit" class="dl-auth-submit" id="btn-register">
              <span class="dl-auth-submit-text">Konto erstellen</span>
              <div class="dl-auth-spinner" style="display:none;"></div>
            </button>
          </div>
        </form>

        <!-- Register Form: Praxis -->
        <form class="dl-auth-form" id="form-register-praxis" style="display:none;">
          <div class="dl-auth-form-inner">
            <div class="form-group">
              <label class="form-label" for="register-praxis-name">Praxisname *</label>
              <input type="text" id="register-praxis-name" class="form-input" placeholder="Praxis am Stadtpark" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-fachbereich">Fachbereich *</label>
              <select id="register-praxis-fachbereich" class="form-input" required style="height: 42px;">
                <option value="">Bitte wählen...</option>
                <option value="Allgemeinmedizin">Allgemeinmedizin</option>
                <option value="Dermatologie">Dermatologie</option>
                <option value="Orthopädie">Orthopädie</option>
                <option value="Kinder- und Jugendmedizin">Kinder- und Jugendmedizin</option>
                <option value="Gynäkologie">Gynäkologie</option>
                <option value="HNO-Heilkunde">HNO-Heilkunde</option>
                <option value="Zahnmedizin">Zahnmedizin</option>
                <option value="Kardiologie">Kardiologie</option>
                <option value="Augenheilkunde">Augenheilkunde</option>
                <option value="Psychotherapie">Psychotherapie</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-adresse">Adresse</label>
              <input type="text" id="register-praxis-adresse" class="form-input" placeholder="Musterstraße 1, 40210 Düsseldorf" />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-telefon">Telefon</label>
              <input type="tel" id="register-praxis-telefon" class="form-input" placeholder="0211 / 123456" />
            </div>

            <div style="border-top: 1px solid var(--gray-200); margin: var(--space-4) 0; padding-top: var(--space-4);">
              <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-3);">Kontaktperson der Praxis</p>
            </div>

            <div class="dl-auth-name-row">
              <div class="form-group">
                <label class="form-label" for="register-praxis-vorname">Vorname *</label>
                <input type="text" id="register-praxis-vorname" class="form-input" placeholder="Anna" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="register-praxis-nachname">Nachname *</label>
                <input type="text" id="register-praxis-nachname" class="form-input" placeholder="Hartmann" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-email">E-Mail-Adresse *</label>
              <input type="email" id="register-praxis-email" class="form-input" placeholder="praxis@email.de" autocomplete="email" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-password">Passwort *</label>
              <input type="password" id="register-praxis-password" class="form-input" placeholder="Mind. 6 Zeichen" autocomplete="new-password" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-praxis-password2">Passwort wiederholen *</label>
              <input type="password" id="register-praxis-password2" class="form-input" placeholder="Passwort bestätigen" autocomplete="new-password" required />
            </div>

            <div class="dl-auth-error" id="register-praxis-error" style="display:none;"></div>

            <button type="submit" class="dl-auth-submit" id="btn-register-praxis">
              <span class="dl-auth-submit-text">Praxis-Konto erstellen</span>
              <div class="dl-auth-spinner" style="display:none;"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initAuthView() {
  initDlNav();

  let currentRole = 'patient';

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const formRegisterPraxis = document.getElementById('form-register-praxis');
  const rolePatient = document.getElementById('role-patient');
  const rolePraxis = document.getElementById('role-praxis');

  // --- Role switching ---
  function setRole(role) {
    currentRole = role;
    rolePatient.classList.toggle('active', role === 'patient');
    rolePraxis.classList.toggle('active', role === 'praxis');

    // Update register form visibility if on register tab
    if (tabRegister.classList.contains('active')) {
      formRegister.style.display = role === 'patient' ? '' : 'none';
      formRegisterPraxis.style.display = role === 'praxis' ? '' : 'none';
    }
  }
  setRole('patient'); // init styles

  rolePatient?.addEventListener('click', () => setRole('patient'));
  rolePraxis?.addEventListener('click', () => setRole('praxis'));

  // --- Tab switching ---
  function switchTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = '';
      formRegister.style.display = 'none';
      formRegisterPraxis.style.display = 'none';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formLogin.style.display = 'none';
      formRegister.style.display = currentRole === 'patient' ? '' : 'none';
      formRegisterPraxis.style.display = currentRole === 'praxis' ? '' : 'none';
    }
  }

  tabLogin?.addEventListener('click', () => switchTab('login'));
  tabRegister?.addEventListener('click', () => switchTab('register'));

  // Password toggle
  const toggleLoginPw = document.getElementById('toggle-login-pw');
  const loginPwInput = document.getElementById('login-password');
  toggleLoginPw?.addEventListener('click', () => {
    loginPwInput.type = loginPwInput.type === 'password' ? 'text' : 'password';
  });

  // Redirect helper based on role
  function redirectAfterAuth(user) {
    if (user.role === 'praxis') {
      navigate('praxis-dashboard');
    } else {
      navigate('landing');
    }
  }

  // --- Login form ---
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    errorEl.style.display = 'none';
    btn.querySelector('.dl-auth-submit-text').textContent = 'Wird angemeldet…';
    btn.querySelector('.dl-auth-spinner').style.display = 'inline-block';
    btn.disabled = true;

    try {
      const user = await auth.login(email, password);
      redirectAfterAuth(user);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      btn.querySelector('.dl-auth-submit-text').textContent = 'Anmelden';
      btn.querySelector('.dl-auth-spinner').style.display = 'none';
      btn.disabled = false;
    }
  });

  // --- Patient Register form ---
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vorname = document.getElementById('register-vorname').value.trim();
    const nachname = document.getElementById('register-nachname').value.trim();
    const geburtsdatum = document.getElementById('register-geburtsdatum').value;
    const krankenversicherung = document.getElementById('register-versicherung').value;
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const errorEl = document.getElementById('register-error');
    const btn = document.getElementById('btn-register');

    errorEl.style.display = 'none';

    if (!geburtsdatum || !krankenversicherung) {
      errorEl.textContent = 'Bitte füllen Sie alle Pflichtfelder aus.';
      errorEl.style.display = '';
      return;
    }
    if (password !== password2) {
      errorEl.textContent = 'Die Passwörter stimmen nicht überein.';
      errorEl.style.display = '';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
      errorEl.style.display = '';
      return;
    }

    btn.querySelector('.dl-auth-submit-text').textContent = 'Wird registriert…';
    btn.querySelector('.dl-auth-spinner').style.display = 'inline-block';
    btn.disabled = true;

    try {
      const user = await auth.register(vorname, nachname, email, password, 'patient', { geburtsdatum, krankenversicherung });
      redirectAfterAuth(user);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      btn.querySelector('.dl-auth-submit-text').textContent = 'Konto erstellen';
      btn.querySelector('.dl-auth-spinner').style.display = 'none';
      btn.disabled = false;
    }
  });

  // --- Praxis Register form ---
  formRegisterPraxis?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const praxisName = document.getElementById('register-praxis-name').value.trim();
    const fachbereich = document.getElementById('register-praxis-fachbereich').value;
    const adresse = document.getElementById('register-praxis-adresse').value.trim();
    const telefon = document.getElementById('register-praxis-telefon').value.trim();
    const vorname = document.getElementById('register-praxis-vorname').value.trim();
    const nachname = document.getElementById('register-praxis-nachname').value.trim();
    const email = document.getElementById('register-praxis-email').value.trim();
    const password = document.getElementById('register-praxis-password').value;
    const password2 = document.getElementById('register-praxis-password2').value;
    const errorEl = document.getElementById('register-praxis-error');
    const btn = document.getElementById('btn-register-praxis');

    errorEl.style.display = 'none';

    if (!praxisName || !fachbereich) {
      errorEl.textContent = 'Praxisname und Fachbereich sind erforderlich.';
      errorEl.style.display = '';
      return;
    }
    if (password !== password2) {
      errorEl.textContent = 'Die Passwörter stimmen nicht überein.';
      errorEl.style.display = '';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
      errorEl.style.display = '';
      return;
    }

    btn.querySelector('.dl-auth-submit-text').textContent = 'Wird registriert…';
    btn.querySelector('.dl-auth-spinner').style.display = 'inline-block';
    btn.disabled = true;

    try {
      const user = await auth.register(vorname, nachname, email, password, 'praxis', {
        praxis_name: praxisName,
        praxis_fachbereich: fachbereich,
        praxis_adresse: adresse,
        praxis_telefon: telefon
      });
      redirectAfterAuth(user);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      btn.querySelector('.dl-auth-submit-text').textContent = 'Praxis-Konto erstellen';
      btn.querySelector('.dl-auth-spinner').style.display = 'none';
      btn.disabled = false;
    }
  });
}
