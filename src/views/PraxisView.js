import { praxen } from '../data/praxen.js';
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

let selectedDate = null;
let selectedTime = null;
let bookingSuccess = false;
let blockedSlots = [];
let currentMonth = new Date();
let openingHours = null;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextAvailableDate() {
  const d = new Date(); // Start with TODAY
  
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const defaultHours = {
    "Montag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Dienstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Mittwoch": { "closed": false, "start": "08:00", "end": "18:00" },
    "Donnerstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Freitag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Samstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Sonntag": { "closed": false, "start": "08:00", "end": "18:00" }
  };
  
  const oh = openingHours || defaultHours;
  
  for (let i = 0; i < 30; i++) {
    const dayName = dayNames[d.getDay()];
    const isDayClosed = oh[dayName] ? oh[dayName].closed : false;
    if (!isDayClosed) {
      break;
    }
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

function getAvailableTimeslotsForDate(dateStr) {
  if (!dateStr) return [];
  
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  let dayIndex;
  try {
    dayIndex = new Date(dateStr + 'T00:00:00').getDay();
  } catch (err) {
    return [];
  }
  const dayName = dayNames[dayIndex];

  const defaultHours = {
    "Montag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Dienstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Mittwoch": { "closed": false, "start": "08:00", "end": "18:00" },
    "Donnerstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Freitag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Samstag": { "closed": false, "start": "08:00", "end": "18:00" },
    "Sonntag": { "closed": false, "start": "08:00", "end": "18:00" }
  };

  const oh = openingHours || defaultHours;
  const todayHours = oh[dayName] || defaultHours[dayName] || { closed: false };

  if (todayHours.closed) {
    return [];
  }

  const { start, end } = todayHours;
  if (!start || !end) return [];

  const parseTimeToMins = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    if (h === 0 && m === 0) return 24 * 60; // 00:00 = 24:00 midnight (1440 min)
    return h * 60 + m;
  };

  const startMin = parseTimeToMins(start);
  let endMin = parseTimeToMins(end);
  if (end === '00:00' || end === '0:00' || end === '24:00' || endMin <= startMin) {
    endMin = 24 * 60;
  }

  const slots = [];
  for (let min = startMin; min + 30 <= endMin; min += 30) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  return slots;
}

async function fetchBlockedSlots(praxisName) {
  if (!selectedDate) return;
  try {
    const res = await fetch(`/api/termine/blocked?date=${selectedDate}&praxis=${encodeURIComponent(praxisName)}&_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    blockedSlots = data.blocked || [];
  } catch (err) {
    console.error('Error fetching blocked slots:', err);
    blockedSlots = [];
  }
}

function renderCalendarHtml() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed
  
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  
  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Get day of week for first day (0 = Sun, 1 = Mon, ..., 6 = Sat)
  let startDayOfWeek = firstDay.getDay();
  // Adjust so Monday is 0 and Sunday is 6
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  
  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Today's date to disable past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let daysHtml = '';
  
  // Render empty day placeholders for start of month alignment
  for (let i = 0; i < startDayOfWeek; i++) {
    daysHtml += `<div class="dl-calendar-day-empty"></div>`;
  }
  
  // Render month days
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const currentDayDate = new Date(year, month, dayNum);
    currentDayDate.setHours(0, 0, 0, 0);
    
    const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    // Disable past dates and closed days
    const isPast = currentDayDate < today;
    const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const dayName = dayNames[currentDayDate.getDay()];
    const defaultHours = {
      "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
      "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
      "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
      "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
      "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
      "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
      "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
    };
    const oh = openingHours || defaultHours;
    const isDayClosed = oh[dayName] ? oh[dayName].closed : defaultHours[dayName].closed;
    const isDisabled = isPast || isDayClosed;
    
    const activeClass = selectedDate === isoDate ? 'active' : '';
    const todayClass = (today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year) ? 'today' : '';
    const disabledAttr = isDisabled ? 'disabled' : '';
    let titleAttr = '';
    if (isPast) {
      titleAttr = 'title="In der Vergangenheit"';
    } else if (isDayClosed) {
      titleAttr = `title="${dayName}s geschlossen"`;
    }
    
    daysHtml += `
      <button class="dl-calendar-day ${activeClass} ${todayClass}" data-date="${isoDate}" ${disabledAttr} ${titleAttr}>
        ${dayNum}
      </button>
    `;
  }
  
  const isCurrentMonth = (month === today.getMonth() && year === today.getFullYear());
  const prevDisabled = isCurrentMonth ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : '';
  
  return `
    <div class="dl-calendar">
      <div class="dl-calendar-header">
        <button type="button" class="dl-calendar-btn" id="btn-prev-month" ${prevDisabled}>&lt;</button>
        <span class="dl-calendar-month-year">${monthNames[month]} ${year}</span>
        <button type="button" class="dl-calendar-btn" id="btn-next-month">&gt;</button>
      </div>
      <div class="dl-calendar-weekdays">
        <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
      </div>
      <div class="dl-calendar-days">
        ${daysHtml}
      </div>
    </div>
  `;
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

  // Always default to today's date initially
  selectedDate = getTodayStr();
  currentMonth = new Date(selectedDate);

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
                <div style="display: flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2); flex-wrap: wrap;">
                  <span class="dl-tag" style="background: rgba(0, 99, 190, 0.1); color: var(--primary); font-weight: 600; display: inline-block; margin: 0;">
                    ${praxis.fachbereich}
                  </span>
                  <span class="dl-tag" style="background: var(--gray-100); color: var(--gray-600); border: 1px solid var(--gray-200); font-weight: 600; display: inline-block; margin: 0;">
                    ⚠️ Demo-Praxis
                  </span>
                </div>
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
                      <div id="calendar-container"></div>
                    </div>

                    <!-- Time Selection -->
                    <div class="booking-section" style="margin-top: var(--space-4);">
                      <label class="booking-section-label">2. Uhrzeit wählen</label>
                      <div class="booking-time-grid" id="time-grid-container"></div>
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

  const loggedIn = auth.isLoggedIn();
  if (!loggedIn) return;

  openingHours = null; // reset
  selectedDate = getTodayStr();
  currentMonth = new Date(selectedDate);

  async function loadData() {
    try {
      const ohRes = await fetch(`/api/praxis/opening-hours?praxis=${encodeURIComponent(praxis.name)}&_t=${Date.now()}`, { cache: 'no-store' });
      const ohData = await ohRes.json();
      if (ohData.success && ohData.opening_hours) {
        openingHours = ohData.opening_hours;
        
        // If today is closed for this praxis, find the next available open date
        const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
        const dayName = dayNames[new Date(selectedDate + 'T00:00:00').getDay()];
        if (openingHours[dayName]?.closed) {
          selectedDate = getNextAvailableDate();
          currentMonth = new Date(selectedDate);
        }
      }
    } catch (err) {
      console.error('Error fetching opening hours:', err);
    }
    
    updateCalendar();
    updateTimeSlots();
  }

  loadData();

  function updateCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = renderCalendarHtml();
    
    // Bind navigation buttons
    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      updateCalendar();
    });
    
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      updateCalendar();
    });
    
    // Bind day buttons
    container.querySelectorAll('.dl-calendar-day:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDate = btn.getAttribute('data-date');
        selectedTime = null; // Reset time when date changes
        
        container.querySelectorAll('.dl-calendar-day').forEach(d => d.classList.remove('active'));
        btn.classList.add('active');
        
        updateConfirmButtonState();
        updateTimeSlots();
      });
    });
  }

  async function updateTimeSlots() {
    const container = document.getElementById('time-grid-container');
    if (!container) return;
    
    container.innerHTML = `
      <div style="grid-column: span 3; text-align: center; padding: var(--space-4) 0;">
        <div class="dl-auth-spinner" style="display: inline-block;"></div>
      </div>
    `;
    
    await fetchBlockedSlots(praxis.name);
    
    const slots = getAvailableTimeslotsForDate(selectedDate);

    if (slots.length === 0) {
      const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
      const dayName = dayNames[new Date(selectedDate + 'T00:00:00').getDay()];
      const defaultHours = {
        "Montag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Dienstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Mittwoch": { "closed": false, "start": "08:00", "end": "16:00" },
        "Donnerstag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Freitag": { "closed": false, "start": "08:00", "end": "16:00" },
        "Samstag": { "closed": true, "start": "08:00", "end": "16:00" },
        "Sonntag": { "closed": true, "start": "08:00", "end": "16:00" }
      };
      const oh = openingHours || defaultHours;
      const todayHours = oh[dayName] || defaultHours[dayName] || { closed: true };

      if (todayHours.closed) {
        container.innerHTML = `
          <div style="grid-column: span 3; text-align: center; padding: var(--space-4) 0;">
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid var(--danger); color: var(--danger); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 600;">
              Praxis geschlossen
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="grid-column: span 3; text-align: center; font-size: var(--font-size-xs); color: var(--gray-400); padding: var(--space-4) 0;">
            Keine Termine verfügbar
          </div>
        `;
      }
      return;
    }
    
    container.innerHTML = slots.map(time => {
      const blocked = blockedSlots.includes(time);
      const activeClass = selectedTime === time ? 'active' : '';
      const disabledAttr = blocked ? 'disabled title="Bereits belegt"' : '';
      return `
        <button class="booking-time-slot ${activeClass}" data-time="${time}" ${disabledAttr}>
          ${time}
        </button>
      `;
    }).join('');
    
    // Bind time slot buttons
    container.querySelectorAll('.booking-time-slot:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTime = btn.getAttribute('data-time');
        
        container.querySelectorAll('.booking-time-slot').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        
        updateConfirmButtonState();
      });
    });
  }

  function updateConfirmButtonState() {
    const btnConfirm = document.getElementById('btn-booking-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = (!selectedDate || !selectedTime);
    }
  }

  // Initial load of calendar and time slots is handled asynchronously inside loadData()

  // Handle Confirm Click
  const btnConfirm = document.getElementById('btn-booking-confirm');
  btnConfirm?.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime) return;

    const errorEl = document.getElementById('booking-error');
    if (errorEl) errorEl.style.display = 'none';

    btnConfirm.disabled = true;
    btnConfirm.querySelector('.btn-text').textContent = 'Wird gebucht…';
    btnConfirm.querySelector('.dl-auth-spinner').style.display = 'inline-block';

    try {
      const res = await fetch('/api/termine/buchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor: `Dr. med. ${praxis.name.split(' ').slice(1).join(' ')}`,
          fachrichtung: praxis.fachbereich,
          adresse: praxis.adresse,
          date: selectedDate,
          time: selectedTime,
          art: 'Allgemeine Untersuchung',
          praxis: praxis.name,
          tags: praxis.behandlungsarten.split(' und ').map(t => t.trim())
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Der Server hat keine gültige Antwort gesendet.');
      }
      
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
