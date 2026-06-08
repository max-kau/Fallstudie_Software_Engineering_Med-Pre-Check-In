import { navigate } from '../utils/router.js';
import { auth } from '../utils/auth.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { praxen } from '../data/praxen.js';
import { openRescheduleModal } from '../components/RescheduleModal.js';

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

/**
 * Parse a German date string like "Do, 04. Jun" or "Di, 02. Jun" into a real Date object.
 * We assume the current year. Month mapping: Jan=0, Feb=1, Mär=2, Apr=3, Mai=4, Jun=5, Jul=6, Aug=7, Sep=8, Okt=9, Nov=10, Dez=11
 */
function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }

  const monthMap = {
    'jan': 0, 'feb': 1, 'mär': 2, 'mar': 2, 'apr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
  };

  // Try to extract day number and month abbreviation
  // Pattern: optional weekday prefix, then DD. Mon or DD Mon
  const match = dateStr.match(/(\d{1,2})\.\s*(\w{3})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthAbbr = match[2].toLowerCase();
  const month = monthMap[monthAbbr];

  if (month === undefined || isNaN(day)) return null;

  const now = new Date();
  const year = now.getFullYear();
  return new Date(year, month, day);
}

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

/**
 * Subtract N business days from a date (Mon-Fri only).
 * Returns a new Date that is N business days before the given date.
 */
function subtractBusinessDays(date, n) {
  const result = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return result;
}

/**
 * Parse a German date and time string into a real Date object.
 */
function parseGermanDateTime(dateStr, timeStr) {
  const dateObj = parseGermanDate(dateStr);
  if (!dateObj) return null;

  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      dateObj.setHours(hours, minutes, 0, 0);
    } else {
      dateObj.setHours(0, 0, 0, 0);
    }
  } else {
    dateObj.setHours(0, 0, 0, 0);
  }
  return dateObj;
}

/**
 * Check if the Pre-Check-In is available for a given appointment date and time string.
 * Available = current time is exactly 48 business hours or less before the appointment.
 */
function isPrecheckAvailable(dateStr, timeStr) {
  const appointmentDateTime = parseGermanDateTime(dateStr, timeStr);
  if (!appointmentDateTime) return true; // If we can't parse, default to available

  const now = new Date();
  const openDate = subtractBusinessDays(appointmentDateTime, 2);

  return now >= openDate;
}

/**
 * Get the date when the Pre-Check-In becomes available (2 business days / 48 business hours before appointment).
 */
function getPrecheckOpenDate(dateStr, timeStr) {
  const appointmentDateTime = parseGermanDateTime(dateStr, timeStr);
  if (!appointmentDateTime) return null;
  return subtractBusinessDays(appointmentDateTime, 2);
}

/**
 * Format a Date as a readable German string including time, e.g. "Mo, 02. Jun um 14:00 Uhr"
 */
function formatGermanDateTime(date) {
  if (!date) return '';
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const dow = days[date.getDay()];
  const d = String(date.getDate()).padStart(2, '0');
  const m = months[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dow}, ${d}. ${m} um ${hours}:${minutes} Uhr`;
}

/**
 * Calculate how many calendar days until a date.
 */
function daysUntil(dateStr) {
  const target = parseGermanDate(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
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

        <!-- Footnote Disclaimer -->
        <div style="margin-top: var(--space-16); padding-top: var(--space-6); border-top: 1px solid var(--gray-200); text-align: center;">
          <p style="font-size: var(--font-size-xs); color: var(--gray-400); line-height: 1.5; max-width: 600px; margin: 0 auto;">
            * Hinweis zur Demonstration: Dotolib Pre-Check-In ist ein studentisches Projekt zu Fallstudien-Zwecken. Alle angezeigten Praxen, Ärzte und Termine sind fiktiv. Es findet keine echte medizinische Vermittlung oder Behandlung statt.
          </p>
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

    let appointments = data.appointments || [];

    // Load hints for each appointment
    appointments = await Promise.all(
      appointments.map(async (appt) => {
        try {
          const hintsRes = await fetch(`/api/precheckin/${appt.code}/hints`);
          const hintsData = await hintsRes.json();
          return {
            ...appt,
            hints: hintsData.success ? hintsData.hints : []
          };
        } catch (err) {
          console.error(`Error loading hints for ${appt.code}:`, err);
          return { ...appt, hints: [] };
        }
      })
    );

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
      const tagsHtml = [
        ...(appt.tags || []).map(t => `<span class="dl-tag">${t}</span>`),
        `<span class="dl-tag" style="background: var(--gray-100); color: var(--gray-600); border: 1px solid var(--gray-200); font-weight: 600;">⚠️ Demo-Praxis</span>`
      ].join('');

      // Check precheck status
      const isSubmitted = appt.precheck_submitted;
      const currentStep = appt.precheck_step;
      const hasProgress = currentStep && currentStep !== 'intro';

      // Check if appointment is in the past
      const appointmentDateTime = parseGermanDateTime(appt.date, appt.time);
      const isPast = appointmentDateTime && appointmentDateTime < new Date();

      // Check availability (2 business days rule with exact 48 business hours match)
      const available = isPrecheckAvailable(appt.date, appt.time);
      const openDate = getPrecheckOpenDate(appt.date, appt.time);
      const daysLeft = daysUntil(appt.date);

      let precheckBannerHtml = '';

      if (isSubmitted) {
        // Check if there are hints from the doctor
        const latestHint = appt.hints && appt.hints.length > 0 ? appt.hints[0] : null;
        let hintSectionHtml = '';
        if (latestHint) {
          const hintList = Array.isArray(latestHint.hints) ? latestHint.hints : (typeof latestHint.hints === 'string' ? JSON.parse(latestHint.hints) : []);
          const listItems = hintList.map(h => `<li style="margin-bottom: 4px;">${h}</li>`).join('');
          hintSectionHtml = `
            <div class="patient-hint-banner-alert" style="margin-top: var(--space-4); background: #FFFBEB; border: 1px solid #FEF3C7; border-left: 4px solid #F59E0B; padding: var(--space-4); border-radius: var(--radius-lg); text-align: left; width: 100%;">
              <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-sm); color: #B45309; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                💡 Wichtige Hinweise Ihrer Praxis:
              </h5>
              ${hintList.length > 0 ? `<ul style="margin: 0; padding-left: 20px; font-size: var(--font-size-sm); color: #92400E;">${listItems}</ul>` : ''}
              ${latestHint.custom_text ? `<div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: #92400E; font-style: italic;">${latestHint.custom_text}</div>` : ''}
            </div>
          `;
        }

        // ---- SUBMITTED STATE ----
        precheckBannerHtml = `
          <div class="precheck-banner precheck-banner--submitted">
            <div class="precheck-banner__content" style="flex-wrap: wrap;">
              <div class="precheck-banner__info" style="flex: 1; min-width: 250px;">
                <span class="precheck-banner__badge precheck-banner__badge--success">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  PRE-CHECK-IN ABGESCHLOSSEN
                </span>
                <h4 class="precheck-banner__title">Ihre Angaben wurden übermittelt</h4>
                <p class="precheck-banner__desc">Ihr Arzt hat alle wichtigen Informationen vorliegen. Sie können die Zusammenfassung jederzeit einsehen.</p>
                ${hintSectionHtml}
              </div>
              <div class="precheck-banner__action" style="align-self: flex-start;">
                <button class="precheck-banner__btn precheck-banner__btn--outline-success btn-go-precheck" data-code="${appt.code}" data-target="zusammenfassung">
                  Zusammenfassung ansehen
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (isPast) {
        // ---- PAST APPOINTMENT STATE (NOT SUBMITTED) ----
        precheckBannerHtml = `
          <div class="precheck-banner precheck-banner--locked" style="background: #F3F4F6; border-left: 4px solid #9CA3AF; position: relative;">
            <div class="precheck-banner__content">
              <div class="precheck-banner__info">
                <span class="precheck-banner__badge" style="background: #E5E7EB; color: #4B5563; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-bottom: var(--space-2);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  ABGELAUFEN
                </span>
                <h4 class="precheck-banner__title" style="color: #374151; font-weight: 700; font-size: var(--font-size-md); margin-bottom: 2px;">Pre-Check-In abgelaufen</h4>
                <p class="precheck-banner__desc" style="color: #6B7280; font-size: var(--font-size-sm); line-height: 1.4;">Dieser Termin liegt in der Vergangenheit. Ein Pre-Check-In kann nachträglich nicht mehr ausgefüllt oder fortgesetzt werden.</p>
              </div>
            </div>
            <div class="precheck-banner__locked-overlay" style="background: rgba(243, 244, 246, 0.05); pointer-events: none;"></div>
          </div>
        `;
      } else if (hasProgress && available) {
        // ---- IN PROGRESS STATE ----
        precheckBannerHtml = `
          <div class="precheck-banner precheck-banner--progress">
            <div class="precheck-banner__content">
              <div class="precheck-banner__info">
                <span class="precheck-banner__badge precheck-banner__badge--progress">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  LAUFENDER PRE-CHECK-IN
                </span>
                <h4 class="precheck-banner__title">Setzen Sie Ihre Vorbereitung fort</h4>
                <p class="precheck-banner__desc">Fortfahren bei: ${getStepLabel(currentStep)}. Bereiten Sie Ihren Termin weiter digital vor.</p>
              </div>
              <div class="precheck-banner__action">
                <button class="precheck-banner__btn precheck-banner__btn--outline-progress btn-go-precheck" data-code="${appt.code}" data-target="${currentStep}">
                  Pre-Check-In fortsetzen
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (available) {
        // ---- AVAILABLE – READY TO START ----
        precheckBannerHtml = `
          <div class="precheck-banner precheck-banner--available">
            <div class="precheck-banner__content">
              <div class="precheck-banner__info">
                <span class="precheck-banner__badge precheck-banner__badge--available">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  PRE-CHECK-IN VERFÜGBAR
                </span>
                <h4 class="precheck-banner__title">Bereiten Sie Ihren Termin online vor</h4>
                <p class="precheck-banner__desc">Erfassen Sie vorab Ihre Beschwerden, Medikamente und Allergien online. So bleibt mehr Behandlungszeit.</p>
              </div>
              <div class="precheck-banner__action">
                <button class="precheck-banner__btn precheck-banner__btn--start btn-go-precheck" data-code="${appt.code}" data-target="confirm">
                  Pre-Check-In starten
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        // ---- NOT YET AVAILABLE – GREYED OUT ----
        const openDateStr = openDate ? formatGermanDateTime(openDate) : '–';
        const daysText = daysLeft !== null ? `Noch ${daysLeft} Tag${daysLeft !== 1 ? 'e' : ''} bis zum Termin` : '';

        precheckBannerHtml = `
          <div class="precheck-banner precheck-banner--locked">
            <div class="precheck-banner__content">
              <div class="precheck-banner__info">
                <span class="precheck-banner__badge precheck-banner__badge--locked">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  NOCH NICHT VERFÜGBAR
                </span>
                <h4 class="precheck-banner__title precheck-banner__title--locked">Pre-Check-In wird freigeschaltet am ${openDateStr}</h4>
                <p class="precheck-banner__desc precheck-banner__desc--locked">
                  ${daysText ? `<span class="precheck-banner__countdown">${daysText}</span> · ` : ''}Der Pre-Check-In wird 2 Werktage vor Ihrem Termin automatisch verfügbar.
                </p>
              </div>
              <div class="precheck-banner__action">
                <button class="precheck-banner__btn precheck-banner__btn--notify btn-notify-email" data-code="${appt.code}" data-open-date="${openDateStr}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Per E-Mail benachrichtigen
                </button>
              </div>
            </div>
            <div class="precheck-banner__locked-overlay"></div>
          </div>
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
              <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block;">${formatGermanDate(appt.date)}</strong>
              <span style="font-size: var(--font-size-xs); color: var(--gray-500); display: block; margin-top: 2px;">${appt.time} Uhr · ${appt.art}</span>
            </div>
          </div>

          <!-- Precheckin Banner Section inside Card -->
          ${precheckBannerHtml}

          <!-- Card Action Footer -->
          ${!isPast ? `
          <div class="dl-card-action-footer" style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); background: var(--bg-gray); border-top: 1px solid var(--gray-100); flex-wrap: wrap;">
            <button class="btn btn-outline btn-reschedule" data-code="${appt.code}" data-praxis="${appt.praxis}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px;">
              📅 Termin verschieben
            </button>
            <button class="btn btn-outline-danger btn-cancel-appt" data-code="${appt.code}" data-date="${formatGermanDate(appt.date)}" data-time="${appt.time}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px;">
              ❌ Termin absagen
            </button>
          </div>
          ` : ''}

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

    // Attach click events for rescheduling
    container.querySelectorAll('.btn-reschedule').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const praxis = e.currentTarget.getAttribute('data-praxis');
        openRescheduleModal(code, praxis, (newDate, newTime) => {
          showRescheduleSuccessToast(newDate, newTime);
          initLandingView();
        });
      });
    });

    container.querySelectorAll('.btn-cancel-appt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const code = button.getAttribute('data-code');
        const dateStr = button.getAttribute('data-date');
        const timeStr = button.getAttribute('data-time');
        
        openCancelConfirmModal(code, dateStr, timeStr, async () => {
          button.disabled = true;
          try {
            const res = await fetch(`/api/termine/${code}`, { method: 'DELETE' });
            let data = {};
            try {
              data = await res.json();
            } catch (jsonErr) {
              throw new Error('Der Server hat keine gültige Antwort gesendet.');
            }
            
            if (!res.ok) throw new Error(data.error || 'Fehler beim Absagen des Termins');
            
            showCancelSuccessToast(dateStr, timeStr);
            initLandingView();
          } catch (err) {
            console.error(err);
            alert(err.message || 'Verbindung fehlgeschlagen.');
            button.disabled = false;
          }
        });
      });
    });

    // Attach click events to email notification buttons
    container.querySelectorAll('.btn-notify-email').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const code = button.getAttribute('data-code');
        const openDate = button.getAttribute('data-open-date');

        button.disabled = true;

        try {
          const res = await fetch(`/api/termine/${code}/notify`, { method: 'POST' });
          if (!res.ok) throw new Error('API Error');

          // Show success confirmation
          button.classList.add('precheck-banner__btn--notified');
          button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            E-Mail-Erinnerung aktiviert
          `;

          // Show a toast message
          showNotificationToast(openDate);
        } catch (err) {
          console.error('Error enabling notification:', err);
          button.disabled = false;
          alert('Die Aktivierung der E-Mail-Benachrichtigung ist fehlgeschlagen. Bitte versuchen Sie es erneut.');
        }
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

/**
 * Show a small toast notification for email reminder confirmation.
 */
function showNotificationToast(openDate) {
  // Remove any existing toast
  document.querySelector('.notify-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'notify-toast';
  toast.innerHTML = `
    <div class="notify-toast__icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    </div>
    <div class="notify-toast__text">
      <strong>Erinnerung aktiviert</strong>
      <span>Sie erhalten eine E-Mail, sobald Ihr Pre-Check-In${openDate ? ` am ${openDate}` : ''} verfügbar ist.</span>
    </div>
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('notify-toast--visible');
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('notify-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function showRescheduleSuccessToast(newDate, newTime) {
  document.querySelector('.notify-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'notify-toast';
  toast.innerHTML = `
    <div class="notify-toast__icon" style="color: #10B981;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div class="notify-toast__text">
      <strong>Termin verschoben</strong>
      <span>Ihr Termin wurde erfolgreich auf den ${formatGermanDate(newDate)} um ${newTime} Uhr verschoben.</span>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('notify-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('notify-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function showCancelSuccessToast(dateStr, timeStr) {
  document.querySelector('.notify-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'notify-toast';
  toast.innerHTML = `
    <div class="notify-toast__icon" style="color: #EF4444;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </div>
    <div class="notify-toast__text">
      <strong>Termin abgesagt</strong>
      <span>Ihr Termin am ${dateStr} um ${timeStr} Uhr wurde erfolgreich storniert.</span>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('notify-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('notify-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function openCancelConfirmModal(code, dateStr, timeStr, onConfirmed) {
  document.getElementById('cancel-confirm-modal')?.remove();

  const html = `
    <div class="dl-modal-backdrop" id="cancel-confirm-modal" style="z-index: 9200;">
      <div class="dl-modal-card fade-in-up" style="max-width: 400px; padding: var(--space-6); text-align: center; border-radius: var(--radius-xl); background: white;">
        <div style="font-size: 48px; margin-bottom: var(--space-4);">⚠️</div>
        <h3 style="font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); font-size: var(--font-size-lg);">Termin absagen?</h3>
        <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.5; margin-bottom: var(--space-6);">
          Möchten Sie Ihren Termin am <strong>${dateStr}</strong> um <strong>${timeStr} Uhr</strong> wirklich absagen? Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div style="display: flex; gap: var(--space-3); justify-content: center;">
          <button class="btn btn-outline" id="btn-cancel-abort" style="flex: 1; padding: var(--space-2) 0; font-weight: 600;">Abbrechen</button>
          <button class="btn btn-outline-danger" id="btn-cancel-confirm" style="flex: 1; padding: var(--space-2) 0; font-weight: 600;">Ja, absagen</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('cancel-confirm-modal');
  const close = () => modal?.remove();

  document.getElementById('btn-cancel-abort')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  document.getElementById('btn-cancel-confirm')?.addEventListener('click', () => {
    close();
    onConfirmed();
  });
}

