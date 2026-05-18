import { store } from '../utils/store.js';

export function renderLandingView() {
  const termin = store.getTerminInfo();

  const tagsHtml = termin.tags.map(t => `<span class="dl-tag">${t}</span>`).join('');

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
          <a href="#" class="dl-nav-link">Meine Termine</a>
          <a href="#" class="dl-nav-link">Anmelden</a>
        </div>
      </div>
    </nav>

    <!-- Page Content -->
    <div class="dl-page">
      <div class="dl-page-inner">

        <!-- Doctor Profile Card -->
        <div class="dl-profile-card fade-in-up">
          <div class="dl-profile-main">
            <div class="dl-profile-info">
              <span class="dl-profile-type">${termin.praxis.toUpperCase()}</span>
              <h1 class="dl-profile-name">${termin.doctor}</h1>
              <p class="dl-profile-details">${termin.fachrichtung} · ${termin.adresse}</p>
              <div class="dl-profile-tags">${tagsHtml}</div>
            </div>
            <div class="dl-termin-badge fade-in-up">
              <span class="dl-termin-label">IHR NÄCHSTER TERMIN</span>
              <span class="dl-termin-datetime">${termin.date} · ${termin.time}</span>
              <span class="dl-termin-art">${termin.art}</span>
            </div>
          </div>
        </div>

        <!-- Pre-Check Banner -->
        <div class="dl-precheck-banner fade-in-up" style="animation-delay: 0.15s">
          <div class="dl-precheck-content">
            <div class="dl-precheck-left">
              <span class="dl-precheck-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                PRE-CHECK VERFÜGBAR
              </span>
              <h2 class="dl-precheck-title">Bereiten Sie Ihren Termin in 5 Minuten vor</h2>
              <p class="dl-precheck-desc">Geben Sie vorab Ihre Beschwerden, Medikamente und Allergien an. So bleibt mehr Zeit für das Wesentliche – Ihre Behandlung.</p>
            </div>
            <div class="dl-precheck-right">
              <button class="dl-precheck-btn" id="btn-start-precheck">
                Pre-Check starten
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
          <div class="dl-precheck-features">
            <div class="dl-precheck-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ca. 5 Minuten
            </div>
            <div class="dl-precheck-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              DSGVO-konform & verschlüsselt
            </div>
            <div class="dl-precheck-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Direkt mit Ihrem Termin verknüpft
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

export function initLandingView() {
  const btn = document.getElementById('btn-start-precheck');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.hash = 'intro';
    });
  }
}
