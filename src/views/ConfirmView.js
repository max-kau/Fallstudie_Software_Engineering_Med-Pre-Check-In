import { store } from '../utils/store.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

function formatGermanDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return dateStr;
}

export function renderConfirmView() {
  const termin = store.getTerminInfo();
  const patient = store.getPatientInfo();

  return `
    ${renderDlNav()}

    <!-- Confirmation Page -->
    <div class="dl-page">
      <div class="dl-page-inner">
        <div class="confirm-card fade-in-up">

          <!-- Greeting -->
          <div class="confirm-greeting">
            <span class="confirm-wave">👋</span>
            <h1 class="confirm-title">Hallo, ${patient.vorname} ${patient.nachname}!</h1>
          </div>

          <!-- Question -->
          <p class="confirm-question">
            Möchten Sie den Pre-Check-In für den nachfolgenden Termin starten?
          </p>

          <!-- Appointment Details -->
          <div class="confirm-termin fade-in-up" style="animation-delay: 0.1s">
            <div class="confirm-termin-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div class="confirm-termin-details">
              <span class="confirm-termin-art">${termin.art}</span>
              <span class="confirm-termin-praxis">${termin.praxis} · ${termin.doctor}</span>
              <span class="confirm-termin-datetime">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                ${formatGermanDate(termin.date)} · ${termin.time} Uhr
              </span>
            </div>
          </div>

          <!-- Privacy Note -->
          <p class="confirm-privacy fade-in-up" style="animation-delay: 0.2s">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Ihre Daten werden vertraulich behandelt und dienen der Vorbereitung Ihres Arzttermins.
          </p>

          <!-- Action Buttons -->
          <div class="confirm-actions fade-in-up" style="animation-delay: 0.3s">
            <button class="confirm-btn confirm-btn--start" id="btn-confirm-start">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              Pre-Check-In starten
            </button>
            <button class="confirm-btn confirm-btn--cancel" id="btn-confirm-cancel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Pre-Check-In abbrechen
            </button>
          </div>

        </div>
      </div>
    </div>
  `;
}

export function initConfirmView() {
  const btnStart = document.getElementById('btn-confirm-start');
  const btnCancel = document.getElementById('btn-confirm-cancel');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      window.location.hash = 'intro';
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      window.location.hash = 'landing';
    });
  }

  initDlNav();
}
