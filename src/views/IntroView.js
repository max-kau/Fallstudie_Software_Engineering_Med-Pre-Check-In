import { store } from '../utils/store.js';
import { renderHeader } from '../components/Header.js';

export function renderIntroView() {
  const currentConsent = store.get('aiConsent');
  const useAi = currentConsent !== false; // Defaults to true if null/undefined

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
            ${store.getCustomQuestions().length > 0 ? `
            <div class="intro-step fade-in-up">
              <div class="intro-step-icon" style="background-color: rgba(245, 158, 11, 0.1); color: rgb(245, 158, 11); display: flex; align-items: center; justify-content: center; font-size: var(--font-size-lg); font-weight: 700; width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-right: var(--space-4);">❓</div>
              <div>
                <div class="intro-step-title">Zusatzfragen der Praxis</div>
                <div class="intro-step-desc">Beantworten Sie individuelle, von dieser Praxis konfigurierte Zusatzfragen.</div>
              </div>
            </div>
            ` : ''}
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

          <!-- KI-Zustimmung Sektion -->
          <div class="fade-in-up" style="margin-top: var(--space-6); margin-bottom: var(--space-6); background: #f8fafc; border: 1px solid var(--gray-200); padding: var(--space-5); border-radius: var(--radius-xl); text-align: left;">
            <h3 style="font-size: var(--font-size-md); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 8px;">
              🤖 KI-gestützte Datenverarbeitung
            </h3>
            <p class="text-muted" style="font-size: var(--font-size-xs); line-height: 1.5; margin-bottom: var(--space-4);">
              Für eine optimale Vorbereitung Ihres Termins nutzen wir eine sichere, datenschutzkonforme künstliche Intelligenz (KI). Diese analysiert Ihre Angaben zu Beschwerden, Medikamenten und Allergien, um individuelle Folgefragen zu generieren und Ihrem Arzt eine medizinische Ersteinschätzung bereitzustellen.
            </p>
            
            <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-3);">
              <!-- Option 1: Mit KI -->
              <label class="ai-consent-card" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 2px solid ${useAi ? 'var(--primary)' : 'var(--gray-200)'}; background: ${useAi ? '#eff6ff' : 'white'}; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s; box-shadow: ${useAi ? '0 0 0 3px rgba(16, 122, 202, 0.15)' : 'none'};">
                <input type="radio" name="ai-consent-choice" value="true" ${useAi ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
                <div>
                  <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block; margin-bottom: 2px;">Mit KI-Unterstützung ausfüllen (empfohlen)</strong>
                  <span style="font-size: var(--font-size-xs); color: var(--gray-500);">Symptombezogene, personalisierte Folgefragen zur optimalen Behandlungsplanung.</span>
                </div>
              </label>
              
              <!-- Option 2: Standardisiert -->
              <label class="ai-consent-card" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 2px solid ${!useAi ? 'var(--primary)' : 'var(--gray-200)'}; background: ${!useAi ? '#eff6ff' : 'white'}; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s; box-shadow: ${!useAi ? '0 0 0 3px rgba(16, 122, 202, 0.15)' : 'none'};">
                <input type="radio" name="ai-consent-choice" value="false" ${!useAi ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
                <div>
                  <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block; margin-bottom: 2px;">Ohne KI ausfüllen (standardisiert)</strong>
                  <span style="font-size: var(--font-size-xs); color: var(--gray-500);">Verwendung eines allgemeinen, statischen Fragenkatalogs ohne automatisierte Auswertung.</span>
                </div>
              </label>
            </div>
            
            <div style="font-size: 10px; color: var(--gray-400); line-height: 1.3; margin-top: var(--space-3);">
              💡 <em>Hinweis: Sie können Ihre Entscheidung jederzeit im Patientenbereich oben rechts bei den Termindetails über das Menü ändern oder Ihre Zustimmung widerrufen.</em>
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
      const isConsentChecked = document.querySelector('input[name="ai-consent-choice"]:checked')?.value === 'true';
      store.set('aiConsent', isConsentChecked);
      
      // Clear generated AI questions if consent is withdrawn
      if (!isConsentChecked) {
        store.set('aiQuestions', []);
      }
      
      window.location.hash = 'beschwerden';
    });
  }

  // Interactivity for option cards
  const choiceRadios = document.querySelectorAll('input[name="ai-consent-choice"]');
  choiceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      choiceRadios.forEach(r => {
        const card = r.closest('.ai-consent-card');
        if (card) {
          if (r.checked) {
            card.style.borderColor = 'var(--primary)';
            card.style.background = '#eff6ff';
            card.style.boxShadow = '0 0 0 3px rgba(16, 122, 202, 0.15)';
          } else {
            card.style.borderColor = 'var(--gray-200)';
            card.style.background = 'white';
            card.style.boxShadow = 'none';
          }
        }
      });
    });
  });
}
