import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';

export function renderHomeView() {
  return `
    <!-- Doctolib Top Navigation -->
    <nav class="dl-nav">
      <div class="dl-nav-inner">
        <div class="dl-nav-brand">
          <svg class="dl-nav-logo" width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#0063BE" stroke-width="2"/>
            <path d="M10 16.5C10 13.5 12.5 11 16 11C19.5 11 22 13.5 22 16.5C22 19.5 19.5 22 16 22" stroke="#0063BE" stroke-width="2" stroke-linecap="round"/>
            <circle cx="16" cy="16.5" r="2" fill="#0063BE"/>
          </svg>
          <span class="dl-nav-name">Doctolib</span>
        </div>
        <div class="dl-nav-links">
          <a href="#" class="dl-nav-link">Suchen</a>
          <a href="#" class="dl-nav-link">Hilfe</a>
          <button class="dl-nav-auth-btn" id="btn-nav-login">Anmelden</button>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <div class="dl-home">
      <div class="dl-home-hero">
        <div class="dl-home-hero-inner">
          <h1 class="dl-home-title">Buchen Sie Ihren <span class="dl-home-highlight">Arzttermin</span> online</h1>
          <p class="dl-home-subtitle">Einfach. Sicher. Kostenlos.</p>

          <!-- Search bar mockup -->
          <div class="dl-home-search">
            <div class="dl-home-search-field">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Arzt, Praxis, Fachrichtung..." class="dl-home-search-input" disabled />
            </div>
            <div class="dl-home-search-field">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input type="text" placeholder="Adresse oder Ort" class="dl-home-search-input" disabled />
            </div>
            <button class="dl-home-search-btn" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Suchen
            </button>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="dl-home-features">
        <div class="dl-home-features-inner">
          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.1s">
            <div class="dl-home-feature-icon" style="background: #EBF5FF; color: #0063BE;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Termine online buchen</h3>
            <p class="dl-home-feature-desc">Buchen Sie rund um die Uhr Termine bei Ihrem Arzt – ohne Wartezeit am Telefon.</p>
          </div>

          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.2s">
            <div class="dl-home-feature-icon" style="background: #ECFDF5; color: #059669;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Digitaler Pre-Check-In</h3>
            <p class="dl-home-feature-desc">Bereiten Sie Ihren Termin vorab vor – Beschwerden, Medikamente und Allergien digital erfassen.</p>
          </div>

          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.3s">
            <div class="dl-home-feature-icon" style="background: #FEF3C7; color: #D97706;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Erinnerungen & Benachrichtigungen</h3>
            <p class="dl-home-feature-desc">Erhalten Sie automatische Erinnerungen per E-Mail oder SMS, damit Sie keinen Termin verpassen.</p>
          </div>
        </div>
      </div>

      <!-- Trust Banner -->
      <div class="dl-home-trust">
        <div class="dl-home-trust-inner">
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            DSGVO-konform
          </div>
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Über 80 Mio. Nutzer in Europa
          </div>
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Ende-zu-Ende-Verschlüsselung
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="dl-home-footer">
        <div class="dl-home-footer-inner">
          <div class="dl-home-footer-brand">
            <span class="dl-nav-name" style="color: var(--gray-400);">Doctolib</span>
            <span class="dl-home-footer-copy">© 2026 – Demo für Studienzwecke</span>
          </div>
          <div class="dl-home-footer-links">
            <a href="#">Impressum</a>
            <a href="#">Datenschutz</a>
            <a href="#">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}

export function initHomeView() {
  const btnLogin = document.getElementById('btn-nav-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      navigate('auth');
    });
  }
}
