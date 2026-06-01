import { praxen } from '../data/praxen.js';
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

let selectedDate = null;
let selectedTime = null;
let bookingSuccess = false;

// Generate next 7 days starting tomorrow
function getAvailableDates() {
  const dates = [];
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    
    // We skip Sundays for medical practices
    if (d.getDay() === 0) continue;

    const formatted = `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]}`;
    dates.push({
      iso: d.toISOString().split('T')[0],
      label: formatted
    });
  }
  return dates;
}

const timeslots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
];

// Deterministic block logic per date to make it look realistic yet stable
function isSlotBlocked(dateIso, time) {
  if (!dateIso) return false;
  // A simple hash function to block 4-5 random slots per day
  const charSum = dateIso.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeVal = parseInt(time.replace(':', ''), 10);
  return (charSum + timeVal) % 4 === 0;
}

export function renderPraxisView() {
  const slug = window.location.hash.split('/')[1];
  const praxis = praxen.find(p => p.slug === slug);

  if (!praxis) {
    return `
      ${renderDlNav()}
      <div class="dl-page">
        <div class="dl-page-inner" style="text-align: center; padding: var(--space-12) 0;">
          <h2 style="color: var(--danger); margin-bottom: var(--space-4);">Praxis nicht gefunden</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Die gesuchte Praxis existiert leider nicht oder die Adresse ist fehlerhaft.</p>
          <button class="btn btn-primary" id="btn-error-back">Zurück zur Startseite</button>
        </div>
      </div>
    `;
  }

  const loggedIn = auth.isLoggedIn();
  const dates = getAvailableDates();

  // If date is not selected yet, auto-select tomorrow's date
  if (!selectedDate && dates.length > 0) {
    selectedDate = dates[0].iso;
  }

  // Pre-generate chips for Date Selection
  const dateChipsHtml = dates.map(d => {
    const activeClass = selectedDate === d.iso ? 'active' : '';
    return `
      <button class="booking-date-chip ${activeClass}" data-date="${d.iso}">
        ${d.label}
      </button>
    `;
  }).join('');

  // Pre-generate chips for Time Slots
  const timeChipsHtml = timeslots.map(time => {
    const blocked = isSlotBlocked(selectedDate, time);
    const activeClass = selectedTime === time ? 'active' : '';
    const disabledAttr = blocked ? 'disabled title="Bereits belegt"' : '';
    return `
      <button class="booking-time-slot ${activeClass}" data-time="${time}" ${disabledAttr}>
        ${time}
      </button>
    `;
  }).join('');

  return `
    ${renderDlNav()}

    <div class="dl-praxis-view">
      <!-- Praxis Banner -->
      <div class="praxis-banner" style="background: ${praxis.gradient};">
        <div class="praxis-banner-inner">
          <div class="praxis-logo-badge">
            ${praxis.logo.includes('.') ? `<img src="${praxis.logo}" style="width: 100%; height: 100%; object-fit: contain; border-radius: inherit;" />` : praxis.logo}
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="dl-page" style="margin-top: -60px; position: relative; z-index: 10;">
        <div class="dl-page-inner">
          <div class="praxis-grid">
            
            <!-- Left Column: Details -->
            <div class="praxis-main-card fade-in-up">
              <div class="praxis-header">
                <span class="dl-tag" style="background: rgba(0, 99, 190, 0.1); color: var(--primary); font-weight: 600; margin-bottom: var(--space-2); display: inline-block;">
                  ${praxis.fachbereich}
                </span>
                <h1 class="praxis-title">${praxis.name}</h1>
              </div>

              <div class="praxis-body">
                <div class="praxis-info-section">
                  <h3>Über uns</h3>
                  <p class="praxis-desc">${praxis.beschreibung}</p>
                </div>

                <div class="praxis-details-grid">
                  <div class="praxis-detail-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div>
                      <strong>Adresse</strong>
                      <span>${praxis.adresse}</span>
                    </div>
                  </div>

                  <div class="praxis-detail-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <div>
                      <strong>Telefon</strong>
                      <span>${praxis.telefon}</span>
                    </div>
                  </div>

                  <div class="praxis-detail-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <div>
                      <strong>Versicherung</strong>
                      <span>${praxis.behandlungsarten}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Booking Widget -->
            <div class="praxis-sidebar fade-in-up" style="animation-delay: 0.1s;">
              <div class="booking-widget">
                ${bookingSuccess ? `
                  <div class="booking-success-animation" style="text-align: center; padding: var(--space-6) 0;">
                    <div style="background: rgba(16, 185, 129, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-4) auto; color: #10B981;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h3 style="color: #10B981; font-weight: 700; margin-bottom: var(--space-2);">Termin gebucht!</h3>
                    <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.4;">
                      Ihr Termin wurde erfolgreich gespeichert. Sie werden nun zu Ihrem Profil weitergeleitet...
                    </p>
                  </div>
                ` : `
                  <h3 class="booking-widget-title">Termin buchen</h3>

                  ${!loggedIn ? `
                    <div class="booking-login-teaser" style="text-align: center; padding: var(--space-4) 0;">
                      <p class="text-muted" style="font-size: var(--font-size-sm); line-height: 1.4; margin-bottom: var(--space-4);">
                        Um einen Termin bei <strong>${praxis.name}</strong> zu buchen, müssen Sie in Ihrem Doctolib-Konto angemeldet sein.
                      </p>
                      <button class="dl-home-search-btn" id="btn-booking-login" style="width: 100%; justify-content: center; height: 42px;">
                        Jetzt anmelden
                      </button>
                    </div>
                  ` : `
                    <!-- Date Selection -->
                    <div class="booking-section">
                      <label class="booking-section-label">1. Datum wählen</label>
                      <div class="booking-date-grid">
                        ${dateChipsHtml}
                      </div>
                    </div>

                    <!-- Time Selection -->
                    <div class="booking-section" style="margin-top: var(--space-4);">
                      <label class="booking-section-label">2. Uhrzeit wählen</label>
                      <div class="booking-time-grid">
                        ${timeChipsHtml}
                      </div>
                    </div>

                    <!-- Confirm Button -->
                    <div class="booking-action-section" style="margin-top: var(--space-6);">
                      <div class="dl-auth-error" id="booking-error" style="display:none; margin-bottom: var(--space-3); color: var(--danger); font-size: var(--font-size-xs);"></div>
                      <button class="dl-home-search-btn" id="btn-booking-confirm" style="width: 100%; justify-content: center; height: 46px;" ${(!selectedDate || !selectedTime) ? 'disabled' : ''}>
                        <span class="btn-text">Termin bestätigen</span>
                        <div class="dl-auth-spinner" style="display:none; margin-left: 8px;"></div>
                      </button>
                    </div>
                  `}
                `}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;
}

export function initPraxisView() {
  initDlNav();

  const slug = window.location.hash.split('/')[1];
  const praxis = praxen.find(p => p.slug === slug);

  if (!praxis) {
    document.getElementById('btn-error-back')?.addEventListener('click', () => {
      navigate('home');
    });
    return;
  }

  // Handle Login redirection teaser
  document.getElementById('btn-booking-login')?.addEventListener('click', () => {
    sessionStorage.setItem('login_redirect', `praxis/${praxis.slug}`);
    navigate('auth');
  });

  // Handle Date Chip Click
  const dateGrid = document.querySelector('.booking-date-grid');
  dateGrid?.addEventListener('click', (e) => {
    const chip = e.target.closest('.booking-date-chip');
    if (!chip) return;

    selectedDate = chip.getAttribute('data-date');
    selectedTime = null; // Reset selected time when date changes

    // Re-render only the hash view
    const app = document.getElementById('app');
    app.innerHTML = renderPraxisView();
    initPraxisView();
  });

  // Handle Time Slot Click
  const timeGrid = document.querySelector('.booking-time-grid');
  timeGrid?.addEventListener('click', (e) => {
    const slot = e.target.closest('.booking-time-slot');
    if (!slot || slot.disabled) return;

    selectedTime = slot.getAttribute('data-time');

    // Re-render
    const app = document.getElementById('app');
    app.innerHTML = renderPraxisView();
    initPraxisView();
  });

  // Handle Confirm Click
  const btnConfirm = document.getElementById('btn-booking-confirm');
  btnConfirm?.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime) return;

    const errorEl = document.getElementById('booking-error');
    if (errorEl) errorEl.style.display = 'none';

    btnConfirm.disabled = true;
    btnConfirm.querySelector('.btn-text').textContent = 'Wird gebucht…';
    btnConfirm.querySelector('.dl-auth-spinner').style.display = 'inline-block';

    const formattedDate = formatDateLabel(selectedDate);

    try {
      const res = await fetch('/api/termine/buchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor: `Dr. med. ${praxis.name.split(' ').slice(1).join(' ')}`, // e.g. Dr. med. am Stadtpark or similar
          fachrichtung: praxis.fachbereich,
          adresse: praxis.adresse,
          date: formattedDate,
          time: selectedTime,
          art: 'Allgemeine Untersuchung',
          praxis: praxis.name,
          tags: praxis.behandlungsarten.split(' und ').map(t => t.trim())
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Termin konnte nicht gebucht werden');

      bookingSuccess = true;
      
      // Re-render to show success animation
      const app = document.getElementById('app');
      app.innerHTML = renderPraxisView();
      initPraxisView();

      // Redirect to Landing/Profile page after 2 seconds
      setTimeout(() => {
        bookingSuccess = false;
        selectedDate = null;
        selectedTime = null;
        navigate('landing');
      }, 2000);

    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
      btnConfirm.disabled = false;
      btnConfirm.querySelector('.btn-text').textContent = 'Termin bestätigen';
      btnConfirm.querySelector('.dl-auth-spinner').style.display = 'none';
    }
  });
}

// Convert "2026-06-03" -> "Mi, 03. Jun"
function formatDateLabel(dateIso) {
  const d = new Date(dateIso);
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]}`;
}
