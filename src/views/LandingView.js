import { navigate } from '../utils/router.js';
import { auth } from '../utils/auth.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { praxen } from '../data/praxen.js';

function getPraxisInfo(praxisName) {
  const nameToMatch = praxisName || '';
  const p = praxen.find(item => 
    item.name.toLowerCase().includes(nameToMatch.toLowerCase()) || 
    nameToMatch.toLowerCase().includes(item.name.toLowerCase())
  );
  return p || { logo: '🩺', color: '#0063BE', gradient: 'linear-gradient(135deg, #0063BE, #004B93)' };
}

function getStepLabel(step) {
  switch (step) {
    case 'beschwerden': return 'Beschwerden (Schritt 1 von 3)';
    case 'medikamente': return 'Medikamente (Schritt 2 von 3)';
    case 'allergien': return 'Allergien (Schritt 3 von 3)';
    case 'zusammenfassung': return 'Zusammenfassung (Schritt 3 von 3)';
    default: return 'Einleitung';
  }
}

export function renderLandingView() {
  return `
    ${renderDlNav()}

    <!-- Page Content -->
    <div class="dl-page">
      <div class="dl-page-inner">
        
        <!-- Header Profile Title -->
        <div class="landing-header fade-in-up" style="margin-bottom: var(--space-8);">
          <span style="font-weight: 700; font-size: var(--font-size-sm); color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Mein Konto</span>
          <h1 style="font-size: var(--font-size-3xl); font-weight: 800; color: var(--gray-800); letter-spacing: -0.02em;">Meine Termine & Vorsorge</h1>
          <p class="text-muted" style="margin-top: 4px; font-size: var(--font-size-sm);">Verwalten Sie Ihre Arzttermine und bereiten Sie sich digital auf Ihre Behandlungen vor.</p>
        </div>

        <!-- Dynamic Content Container -->
        <div id="landing-content-container">
          <div style="text-align: center; padding: var(--space-12) 0;">
            <div class="dl-auth-spinner" style="display: inline-block; width: 40px; height: 40px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-4); font-size: var(--font-size-sm);">Ihre Termine werden sicher geladen...</p>
          </div>
        </div>

      </div>
    </div>
  `;
}

export async function initLandingView() {
  initDlNav();

  const container = document.getElementById('landing-content-container');
  if (!container) return;

  try {
    const res = await fetch('/api/user/termine');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Fehler beim Laden der Termine');

    const appointments = data.appointments || [];

    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-10) var(--space-6); background: white; border-radius: var(--radius-xl); border: 1px dashed var(--gray-300);">
          <div style="font-size: var(--font-size-4xl); margin-bottom: var(--space-4);">📅</div>
          <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2);">Keine Termine gebucht</h3>
          <p class="text-muted" style="max-width: 420px; margin: 0 auto var(--space-6) auto; font-size: var(--font-size-sm); line-height: 1.5;">
            Sie haben aktuell keine anstehenden Arzttermine. Suchen Sie jetzt nach einer Praxis in Ihrer Nähe, um einen Termin zu vereinbaren.
          </p>
          <button class="dl-home-search-btn" id="btn-landing-go-home" style="margin: 0 auto;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: var(--space-2);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Praxis finden & Termin buchen
          </button>
        </div>
      `;

      document.getElementById('btn-landing-go-home')?.addEventListener('click', () => {
        navigate('home');
      });
      return;
    }

    // Format and render appointments list
    let listHtml = `<div style="display: flex; flex-direction: column; gap: var(--space-6);">`;

    appointments.forEach((appt, idx) => {
      const pInfo = getPraxisInfo(appt.praxis);
      const tagsHtml = (appt.tags || []).map(t => `<span class="dl-tag">${t}</span>`).join('');
      
      // Check precheck status
      const isSubmitted = appt.precheck_submitted;
      const currentStep = appt.precheck_step;
      const hasProgress = currentStep && currentStep !== 'intro';

      let precheckBadgeHtml = '';
      let precheckTitle = '';
      let precheckDesc = '';
      let precheckBtnHtml = '';

      if (isSubmitted) {
        precheckBadgeHtml = `
          <span class="dl-precheck-badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg>
            PRE-CHECK-IN ABGESCHLOSSEN
          </span>
        `;
        precheckTitle = 'Ihre Angaben wurden übermittelt';
        precheckDesc = 'Ihr Arzt hat alle wichtigen Informationen vorliegen. Sie können die Zusammenfassung jederzeit einsehen.';
        precheckBtnHtml = `
          <button class="dl-precheck-btn btn-go-precheck" data-code="${appt.code}" data-target="zusammenfassung" style="border: 2px solid #10B981; color: #10B981; background: transparent;">
            Zusammenfassung ansehen
          </button>
        `;
      } else if (hasProgress) {
        precheckBadgeHtml = `
          <span class="dl-precheck-badge" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.2);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            LAUFENDER PRE-CHECK
          </span>
        `;
        precheckTitle = 'Setzen Sie Ihre Vorbereitung fort';
        precheckDesc = `Fortfahren bei: ${getStepLabel(currentStep)}. Bereiten Sie Ihren Termin weiter digital vor.`;
        precheckBtnHtml = `
          <button class="dl-precheck-btn btn-go-precheck" data-code="${appt.code}" data-target="${currentStep}" style="border: 2px solid #3B82F6; color: #3B82F6; background: transparent;">
            Pre-Check fortsetzen
          </button>
        `;
      } else {
        precheckBadgeHtml = `
          <span class="dl-precheck-badge" style="background: rgba(245, 158, 11, 0.15); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.2);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PRE-CHECK VERFÜGBAR
          </span>
        `;
        precheckTitle = 'Bereiten Sie Ihren Termin online vor';
        precheckDesc = 'Erfassen Sie vorab Ihre Beschwerden, Medikamente und Allergien online. So bleibt mehr Behandlungszeit.';
        precheckBtnHtml = `
          <button class="dl-precheck-btn btn-go-precheck" data-code="${appt.code}" data-target="confirm">
            Pre-Check starten
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        `;
      }

      listHtml += `
        <div class="dl-profile-card fade-in-up" style="animation-delay: ${idx * 0.1}s; display: flex; flex-direction: column; overflow: hidden; padding: 0; background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-md); border: 1px solid var(--gray-200);">
          
          <!-- Appointment Header Card -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6); border-bottom: 1px solid var(--gray-100);">
            <div style="display: flex; gap: var(--space-4);">
              <div style="background: white; border: 1px solid var(--gray-200); width: 50px; height: 50px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: var(--font-size-2xl); flex-shrink: 0; overflow: hidden; padding: 2px;">
                ${pInfo.logo.includes('.') ? `<img src="${pInfo.logo}" style="width: 100%; height: 100%; object-fit: contain;" />` : pInfo.logo}
              </div>
              <div>
                <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em;">${appt.praxis.toUpperCase()}</span>
                <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin: 2px 0 6px 0;">${appt.doctor}</h3>
                <p class="text-muted" style="font-size: var(--font-size-sm); line-height: 1.4;">${appt.fachrichtung} · ${appt.adresse}</p>
                <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap;">
                  ${tagsHtml}
                </div>
              </div>
            </div>
            
            <div style="background: var(--bg-gray); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); text-align: right; border: 1px solid var(--gray-200); min-width: 170px;">
              <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Termin</span>
              <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block;">${appt.date}</strong>
              <span style="font-size: var(--font-size-xs); color: var(--gray-500); display: block; margin-top: 2px;">${appt.time} Uhr · ${appt.art}</span>
            </div>
          </div>

          <!-- Precheckin Banner Section inside Card -->
          <div style="background: linear-gradient(135deg, var(--primary-dark), var(--primary)); color: white; padding: var(--space-5) var(--space-6); display: flex; justify-content: space-between; align-items: center; gap: var(--space-6); flex-wrap: wrap;">
            <div style="flex: 1; min-width: 280px;">
              <div style="margin-bottom: 6px;">
                ${precheckBadgeHtml}
              </div>
              <h4 style="font-size: var(--font-size-md); font-weight: 700; margin-bottom: 2px;">${precheckTitle}</h4>
              <p style="font-size: var(--font-size-xs); opacity: 0.85; line-height: 1.4; margin: 0;">${precheckDesc}</p>
            </div>
            <div style="flex-shrink: 0;">
              ${precheckBtnHtml}
            </div>
          </div>

        </div>
      `;
    });

    listHtml += `</div>`;
    container.innerHTML = listHtml;

    // Attach click events to start/resume precheck
    container.querySelectorAll('.btn-go-precheck').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const target = e.currentTarget.getAttribute('data-target');
        
        // Force complete client refresh to update store parameters cleanly
        window.location.href = `?termin=${code}#${target}`;
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-8) var(--space-6); border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-xl);">
        <h3 style="color: var(--danger); font-weight: 700; margin-bottom: var(--space-2);">Ladefehler</h3>
        <p class="text-muted" style="margin-bottom: var(--space-4); font-size: var(--font-size-sm);">${err.message}</p>
        <button class="btn btn-outline" onclick="window.location.reload()">Erneut versuchen</button>
      </div>
    `;
  }
}
