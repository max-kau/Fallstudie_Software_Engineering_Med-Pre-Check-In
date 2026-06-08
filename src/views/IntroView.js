import { store } from '../utils/store.js';
import { renderHeader } from '../components/Header.js';

export function renderIntroView() {
  return `
    ${renderHeader()}
    <div class="view">
      <div class="container container--form">
        <div class="view-content">
          <div style="text-align: center; margin-bottom: var(--space-6);">
            <span style="font-size: 2.5rem; display: block; margin-bottom: var(--space-3);">👋</span>
            <h2>So funktioniert der Pre-Check-In</h2>
            <p class="text-muted" style="margin-top: var(--space-2);">
              In nur wenigen Minuten können Sie Ihre medizinischen Angaben vorab digital erfassen.
            </p>
          </div>

          <div class="intro-steps">
            <div class="intro-step fade-in-up">
              <div class="intro-step-icon step-1">🩺</div>
              <div>
                <div class="intro-step-title">1. Beschwerden</div>
                <div class="intro-step-desc">Beschreiben Sie Ihre aktuellen Symptome und wie stark diese sind.</div>
              </div>
            </div>
            <div class="intro-step fade-in-up">
              <div class="intro-step-icon step-2">💊</div>
              <div>
                <div class="intro-step-title">2. Medikamente</div>
                <div class="intro-step-desc">Geben Sie an, welche Medikamente Sie aktuell einnehmen.</div>
              </div>
            </div>
            <div class="intro-step fade-in-up">
              <div class="intro-step-icon step-3">⚠️</div>
              <div>
                <div class="intro-step-title">3. Allergien</div>
                <div class="intro-step-desc">Teilen Sie uns bekannte Allergien und Unverträglichkeiten mit.</div>
              </div>
            </div>
          </div>

          <div class="privacy-banner fade-in-up">
            <span class="privacy-banner-icon">🔒</span>
            <div class="privacy-banner-text">
              Ihre Angaben werden verschlüsselt gespeichert und nur Ihrem behandelnden Arzt zur Verfügung gestellt. Datenschutz hat für uns höchste Priorität.
            </div>
          </div>

          <div style="margin-top: var(--space-6);">
            <button class="btn btn-primary btn-lg btn-block" id="btn-start-form">
              Jetzt ausfüllen
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initIntroView() {
  const btn = document.getElementById('btn-start-form');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.hash = 'beschwerden';
    });
  }
}
