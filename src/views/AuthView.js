import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

export function renderAuthView() {
  return `
    ${renderDlNav()}

    <!-- Auth Card -->
    <div class="dl-auth-page">
      <div class="dl-auth-card fade-in-up">
        <!-- Tabs -->
        <div class="dl-auth-tabs">
          <button class="dl-auth-tab active" data-tab="login" id="tab-login">Anmelden</button>
          <button class="dl-auth-tab" data-tab="register" id="tab-register">Registrieren</button>
        </div>

        <!-- Login Form -->
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

            <div class="dl-auth-hint">
              <span>Demo-Zugangsdaten:</span> max@doctolib.de / passwort123
            </div>
          </div>
        </form>

        <!-- Register Form -->
        <form class="dl-auth-form" id="form-register" style="display:none;">
          <div class="dl-auth-form-inner">
            <div class="dl-auth-name-row">
              <div class="form-group">
                <label class="form-label" for="register-vorname">Vorname</label>
                <input type="text" id="register-vorname" class="form-input" placeholder="Max" autocomplete="given-name" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="register-nachname">Nachname</label>
                <input type="text" id="register-nachname" class="form-input" placeholder="Mustermann" autocomplete="family-name" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-email">E-Mail-Adresse</label>
              <input type="email" id="register-email" class="form-input" placeholder="ihre@email.de" autocomplete="email" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-password">Passwort</label>
              <input type="password" id="register-password" class="form-input" placeholder="Mind. 6 Zeichen" autocomplete="new-password" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="register-password2">Passwort wiederholen</label>
              <input type="password" id="register-password2" class="form-input" placeholder="Passwort bestätigen" autocomplete="new-password" required />
            </div>

            <div class="dl-auth-error" id="register-error" style="display:none;"></div>

            <button type="submit" class="dl-auth-submit" id="btn-register">
              <span class="dl-auth-submit-text">Konto erstellen</span>
              <div class="dl-auth-spinner" style="display:none;"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initAuthView() {
  // Tab switching
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  function switchTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = '';
      formRegister.style.display = 'none';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = '';
      formLogin.style.display = 'none';
    }
  }

  tabLogin?.addEventListener('click', () => switchTab('login'));
  tabRegister?.addEventListener('click', () => switchTab('register'));

  initDlNav();

  // Password toggle
  const toggleLoginPw = document.getElementById('toggle-login-pw');
  const loginPwInput = document.getElementById('login-password');
  toggleLoginPw?.addEventListener('click', () => {
    const type = loginPwInput.type === 'password' ? 'text' : 'password';
    loginPwInput.type = type;
  });

  // Login form
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
      await auth.login(email, password);
      navigate('landing');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      btn.querySelector('.dl-auth-submit-text').textContent = 'Anmelden';
      btn.querySelector('.dl-auth-spinner').style.display = 'none';
      btn.disabled = false;
    }
  });

  // Register form
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vorname = document.getElementById('register-vorname').value.trim();
    const nachname = document.getElementById('register-nachname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const errorEl = document.getElementById('register-error');
    const btn = document.getElementById('btn-register');

    errorEl.style.display = 'none';

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
      await auth.register(vorname, nachname, email, password);
      navigate('landing');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      btn.querySelector('.dl-auth-submit-text').textContent = 'Konto erstellen';
      btn.querySelector('.dl-auth-spinner').style.display = 'none';
      btn.disabled = false;
    }
  });
}
