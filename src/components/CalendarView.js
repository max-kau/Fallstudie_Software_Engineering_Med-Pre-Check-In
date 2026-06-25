/**
 * CalendarView Component
 * Outlook-style calendar for the Praxis Dashboard.
 * Supports day and week views with drag-to-resize appointment blocks.
 */

const CALENDAR_START_HOUR = 7;
const CALENDAR_END_HOUR = 17;
const HOUR_HEIGHT_PX = 64; // pixels per hour
const SLOT_HEIGHT_PX = HOUR_HEIGHT_PX / 2; // 30-minute slots
const DEFAULT_DURATION = 30;

// ── Date parsing utilities (matching existing code patterns) ────────

const MONTH_MAP = {
  'jan': 0, 'feb': 1, 'mär': 2, 'mar': 2, 'apr': 3, 'mai': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
};

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  const match = dateStr.match(/(\d{1,2})\.\s*(\w{3})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthAbbr = match[2].toLowerCase();
  const month = MONTH_MAP[monthAbbr];
  if (month === undefined || isNaN(day)) return null;
  const now = new Date();
  return new Date(now.getFullYear(), month, day);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatDateHeader(date) {
  const d = new Date(date);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWeekHeader(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);
  return `${String(startDate.getDate()).padStart(2, '0')}. ${MONTH_NAMES[startDate.getMonth()]} – ${String(end.getDate()).padStart(2, '0')}. ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subtractBusinessDays(date, n) {
  const result = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function isPrecheckAvailable(dateStr, timeStr) {
  const dateObj = parseGermanDate(dateStr);
  if (!dateObj) return true;
  if (timeStr) {
    const tm = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (tm) dateObj.setHours(parseInt(tm[1], 10), parseInt(tm[2], 10));
  }
  const now = new Date();
  const openDate = subtractBusinessDays(dateObj, 2);
  return now >= openDate;
}

// ── Render functions ────────

function getAppointmentColor(termin) {
  if (termin.precheck_submitted) return 'green';
  if (isPrecheckAvailable(termin.date, termin.time) && !termin.precheck_submitted) return 'red';
  return 'gray';
}

function getAppointmentColorVars(color) {
  switch (color) {
    case 'green': return { bg: '#ECFDF5', border: '#059669', text: '#065F46', badge: '#D1FAE5' };
    case 'red': return { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B', badge: '#FEE2E2' };
    default: return { bg: '#F1F5F9', border: '#94A3B8', text: '#475569', badge: '#E2E8F0' };
  }
}

export function renderCalendarView() {
  const totalHours = CALENDAR_END_HOUR - CALENDAR_START_HOUR;
  const timeSlots = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
  }

  return `
    <div class="cal-container" id="calendar-container">
      <!-- Calendar Header -->
      <div class="cal-header">
        <div class="cal-nav">
          <button class="cal-nav-btn" id="cal-prev" title="Zurück">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="cal-nav-btn cal-today-btn" id="cal-today">Heute</button>
          <button class="cal-nav-btn" id="cal-next" title="Vor">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <h2 class="cal-title" id="cal-title"></h2>
        <div class="cal-view-toggle">
          <button class="cal-toggle-btn active" id="cal-view-day" data-view="day">Tag</button>
          <button class="cal-toggle-btn" id="cal-view-week" data-view="week">Woche</button>
        </div>
      </div>

      <!-- Legend -->
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#059669;"></span>Pre-Check-In erledigt</span>
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#DC2626;"></span>Pre-Check-In offen</span>
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#94A3B8;"></span>Nicht freigeschaltet</span>
      </div>

      <!-- Calendar Body -->
      <div class="cal-body" id="cal-body">
        <!-- Dynamically rendered -->
      </div>
    </div>
  `;
}

function renderShadingBlocks(date, openingHours) {
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const dayName = dayNames[date.getDay()];
  
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

  const calStartMin = CALENDAR_START_HOUR * 60;
  const calEndMin = CALENDAR_END_HOUR * 60;

  const buildBlock = (startMin, endMin) => {
    if (endMin <= startMin) return '';
    const topPx = ((startMin - calStartMin) / 60) * HOUR_HEIGHT_PX;
    const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT_PX;
    return `
      <div class="cal-shading-block" 
           style="position: absolute; left: 0; right: 0; top: ${topPx}px; height: ${heightPx}px; background-color: rgba(0, 99, 190, 0.06); pointer-events: none; z-index: 1;">
      </div>
    `;
  };

  if (todayHours.closed) {
    return buildBlock(calStartMin, calEndMin);
  }

  const openStart = parseTimeToMinutes(todayHours.start);
  const openEnd = parseTimeToMinutes(todayHours.end);

  let html = '';
  if (openStart > calStartMin) {
    html += buildBlock(calStartMin, Math.min(calEndMin, openStart));
  }
  if (openEnd < calEndMin) {
    html += buildBlock(Math.max(calStartMin, openEnd), calEndMin);
  }

  return html;
}

function renderDayView(date, appointments, openingHours) {
  const dayAppts = filterAppointmentsByDate(appointments, date);
  const isToday = isSameDay(date, new Date());

  return `
    <div class="cal-grid cal-grid--day">
      <div class="cal-day-col">
        <div class="cal-day-header ${isToday ? 'cal-day-header--today' : ''}">
          <span class="cal-day-name">${WEEKDAY_NAMES[date.getDay()]}</span>
          <span class="cal-day-num ${isToday ? 'cal-day-num--today' : ''}">${date.getDate()}</span>
        </div>
        <div class="cal-day-body" style="position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX}px;">
          ${renderShadingBlocks(date, openingHours)}
          ${renderTimeGridLines()}
          ${dayAppts.map(appt => renderAppointmentBlock(appt)).join('')}
        </div>
      </div>
      <div class="cal-time-gutter">
        ${renderTimeLabels()}
      </div>
    </div>
  `;
}

function renderWeekView(mondayDate, appointments, openingHours) {
  const today = new Date();
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    const dayAppts = filterAppointmentsByDate(appointments, d);
    const isToday = isSameDay(d, today);
    cols += `
      <div class="cal-day-col cal-week-col">
        <div class="cal-day-header ${isToday ? 'cal-day-header--today' : ''}">
          <span class="cal-day-name">${WEEKDAY_NAMES[d.getDay()]}</span>
          <span class="cal-day-num ${isToday ? 'cal-day-num--today' : ''}">${d.getDate()}</span>
        </div>
        <div class="cal-day-body" style="position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX}px;">
          ${renderShadingBlocks(d, openingHours)}
          ${renderTimeGridLines()}
          ${dayAppts.map(appt => renderAppointmentBlock(appt)).join('')}
        </div>
      </div>
    `;
  }
  return `
    <div class="cal-grid cal-grid--week">
      ${cols}
      <div class="cal-time-gutter">
        ${renderTimeLabels()}
      </div>
    </div>
  `;
}

function renderTimeLabels() {
  let html = '';
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    html += `<div class="cal-time-label" style="height:${HOUR_HEIGHT_PX}px;">${String(h).padStart(2, '0')}:00</div>`;
  }
  return html;
}

function renderTimeGridLines() {
  let html = '';
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) {
    const top = (h - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX;
    html += `<div class="cal-grid-line" style="top:${top}px;"></div>`;
    html += `<div class="cal-grid-line cal-grid-line--half" style="top:${top + HOUR_HEIGHT_PX / 2}px;"></div>`;
  }
  return html;
}

function renderAppointmentBlock(appt) {
  const startMin = parseTimeToMinutes(appt.time);
  const duration = appt.duration || DEFAULT_DURATION;
  const calStartMin = CALENDAR_START_HOUR * 60;
  const topPx = ((startMin - calStartMin) / 60) * HOUR_HEIGHT_PX;
  const heightPx = (duration / 60) * HOUR_HEIGHT_PX;
  const color = getAppointmentColor(appt);
  const cv = getAppointmentColorVars(color);
  const name = `${appt.patient_vorname || ''} ${appt.patient_nachname || ''}`.trim() || 'Patient';
  const timeLabel = appt.time ? `${appt.time} Uhr` : '';

  // Check for conflicts
  const hasConflict = appt._hasConflict || false;

  return `
    <div class="cal-event cal-event--${color}" 
         data-code="${appt.code}" 
         data-duration="${duration}"
         style="top:${topPx}px; height:${heightPx}px; --ev-bg:${cv.bg}; --ev-border:${cv.border}; --ev-text:${cv.text};"
         title="${name} · ${timeLabel} · ${appt.art || ''}">
      <div class="cal-event-content">
        <span class="cal-event-time">${timeLabel}</span>
        <span class="cal-event-name">${name}</span>
      </div>
      ${hasConflict ? '<div class="cal-event-conflict" title="Terminkonflikt!">⚠️</div>' : ''}
      <div class="cal-event-resize" data-code="${appt.code}" title="Ziehen um Dauer zu ändern"></div>
    </div>
  `;
}

function filterAppointmentsByDate(appointments, date) {
  return appointments.filter(appt => {
    const apptDate = parseGermanDate(appt.date);
    if (!apptDate) return false;
    return isSameDay(apptDate, date);
  });
}

function markConflicts(appointments) {
  // Group by date
  const byDate = {};
  for (const appt of appointments) {
    const d = parseGermanDate(appt.date);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(appt);
  }
  // Check overlaps within each date
  for (const key of Object.keys(byDate)) {
    const dayAppts = byDate[key];
    for (let i = 0; i < dayAppts.length; i++) {
      const a = dayAppts[i];
      const aStart = parseTimeToMinutes(a.time);
      const aEnd = aStart + (a.duration || DEFAULT_DURATION);
      for (let j = i + 1; j < dayAppts.length; j++) {
        const b = dayAppts[j];
        const bStart = parseTimeToMinutes(b.time);
        const bEnd = bStart + (b.duration || DEFAULT_DURATION);
        if (aEnd > bStart && aStart < bEnd) {
          // The appointment that starts later is the one being collided with (delayed/displaced)
          if (aStart < bStart) {
            b._hasConflict = true;
          } else if (bStart < aStart) {
            a._hasConflict = true;
          } else {
            // If they start at the exact same time, both are in conflict
            a._hasConflict = true;
            b._hasConflict = true;
          }
        }
      }
    }
  }
}

// ── Calendar Controller ────────

export function initCalendarView(appointments, onAppointmentClick, openingHours) {
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  let viewMode = 'day'; // 'day' | 'week'
  let allAppointments = appointments || [];
  let currentOpeningHours = openingHours || null;

  // Mark conflicts
  markConflicts(allAppointments);

  const calBody = document.getElementById('cal-body');
  const calTitle = document.getElementById('cal-title');
  if (!calBody || !calTitle) return;

  function render() {
    if (viewMode === 'day') {
      calTitle.textContent = formatDateHeader(currentDate);
      calBody.innerHTML = renderDayView(currentDate, allAppointments, currentOpeningHours);
    } else {
      const monday = getMonday(currentDate);
      calTitle.textContent = formatWeekHeader(monday);
      calBody.innerHTML = renderWeekView(monday, allAppointments, currentOpeningHours);
    }
    attachEventListeners();
  }

  function attachEventListeners() {
    // Click on appointment
    calBody.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.cal-event-resize')) return;
        const code = el.dataset.code;
        const appt = allAppointments.find(a => a.code === code);
        if (appt && onAppointmentClick) {
          onAppointmentClick(appt);
        }
      });

      // Click on conflict icon
      const conflictIcon = el.querySelector('.cal-event-conflict');
      if (conflictIcon) {
        conflictIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          const code = el.dataset.code;
          const appt = allAppointments.find(a => a.code === code);
          if (appt) showConflictPrompt(appt);
        });
      }
    });

    // Drag-to-resize
    calBody.querySelectorAll('.cal-event-resize').forEach(handle => {
      handle.addEventListener('mousedown', startResize);
      handle.addEventListener('touchstart', startResize, { passive: false });
    });
  }

  // ── Drag-to-resize logic ────────
  let resizeState = null;

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const eventEl = e.target.closest('.cal-event');
    if (!eventEl) return;

    const code = eventEl.dataset.code;
    const startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const startHeight = eventEl.offsetHeight;

    resizeState = { code, eventEl, startY, startHeight };

    const onMove = (ev) => {
      if (!resizeState) return;
      const clientY = ev.type === 'touchmove' ? ev.touches[0].clientY : ev.clientY;
      const diff = clientY - resizeState.startY;
      const newHeight = Math.max(SLOT_HEIGHT_PX, resizeState.startHeight + diff);
      // Snap to 15-minute increments
      const snappedHeight = Math.round(newHeight / (HOUR_HEIGHT_PX / 4)) * (HOUR_HEIGHT_PX / 4);
      resizeState.eventEl.style.height = snappedHeight + 'px';
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);

      if (!resizeState) return;
      const finalHeight = resizeState.eventEl.offsetHeight;
      const newDuration = Math.round((finalHeight / HOUR_HEIGHT_PX) * 60);
      const code = resizeState.code;
      resizeState = null;

      // Save to server
      try {
        const res = await fetch(`/api/praxis/termin/${code}/duration`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: newDuration })
        });
        const data = await res.json();
        if (data.success) {
          // Update local data
          const appt = allAppointments.find(a => a.code === code);
          if (appt) appt.duration = newDuration;

          // Re-mark conflicts
          allAppointments.forEach(a => { a._hasConflict = false; });
          markConflicts(allAppointments);

          // Check if there are conflicts
          if (data.conflicts && data.conflicts.length > 0) {
            render();
            // Show conflict prompt for each conflicting appointment
            for (const conflict of data.conflicts) {
              showConflictPrompt(allAppointments.find(a => a.code === conflict.code) || conflict);
            }
          } else {
            render();
          }
        }
      } catch (err) {
        console.error('Failed to update duration:', err);
        render(); // Re-render to reset
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  // ── Conflict prompt ────────
  function showConflictPrompt(appt) {
    // Remove existing prompt
    document.getElementById('conflict-prompt-modal')?.remove();

    const name = `${appt.patient_vorname || appt.patient || ''} ${appt.patient_nachname || ''}`.trim() || 'Patient';
    const html = `
      <div class="dl-modal-backdrop" id="conflict-prompt-modal" style="z-index: 10000;">
        <div class="dl-modal-card fade-in-up" style="max-width: 440px;">
          <div class="dl-modal-header">
            <h3 class="dl-modal-title" style="display: flex; align-items: center; gap: 8px;">
              ⚠️ Terminkonflikt
            </h3>
            <button class="dl-modal-close" id="btn-close-conflict">&times;</button>
          </div>
          <div class="dl-modal-body" style="padding: var(--space-6);">
            <p style="font-size: var(--font-size-sm); color: var(--gray-700); line-height: 1.6; margin-bottom: var(--space-4);">
              Der Termin von <strong>${name}</strong> um <strong>${appt.time || ''} Uhr</strong> kollidiert mit einem anderen Termin.
            </p>
            <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.6;">
              Möchten Sie dem Patienten eine E-Mail über eine mögliche Verspätung senden?
            </p>
            <div style="margin-top: var(--space-4);">
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Geschätzte Verspätung (Minuten)</label>
              <input type="number" id="conflict-delay-minutes" value="15" min="5" step="5" 
                     style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm);">
            </div>
          </div>
          <div class="dl-modal-footer" style="display: flex; gap: var(--space-3); justify-content: flex-end;">
            <button type="button" class="btn btn-outline" id="btn-conflict-skip" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Nein, danke</button>
            <button type="button" class="btn btn-primary" id="btn-conflict-send" style="padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer; background: #D97706; border-color: #D97706;">
              📧 Verspätung melden
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('conflict-prompt-modal');
    const close = () => modal?.remove();

    document.getElementById('btn-close-conflict')?.addEventListener('click', close);
    document.getElementById('btn-conflict-skip')?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('btn-conflict-send')?.addEventListener('click', async () => {
      const delayMin = parseInt(document.getElementById('conflict-delay-minutes')?.value || '15', 10);
      const btn = document.getElementById('btn-conflict-send');
      btn.disabled = true;
      btn.textContent = 'Wird gesendet...';
      try {
        await fetch(`/api/praxis/termin/${appt.code}/delay-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delay_minutes: delayMin })
        });
        btn.textContent = '✓ Gesendet';
        btn.style.background = '#059669';
        setTimeout(close, 1500);
      } catch (err) {
        console.error('Failed to send delay notification:', err);
        btn.textContent = 'Fehler';
        btn.disabled = false;
      }
    });
  }

  // ── Navigation ────────

  document.getElementById('cal-prev')?.addEventListener('click', () => {
    if (viewMode === 'day') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
    }
    render();
  });

  document.getElementById('cal-next')?.addEventListener('click', () => {
    if (viewMode === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
    }
    render();
  });

  document.getElementById('cal-today')?.addEventListener('click', () => {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    render();
  });

  // View toggle
  document.querySelectorAll('.cal-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.view;
      render();
    });
  });

  // Initial render
  render();

  // Return update function
  return {
    updateAppointments(newAppts) {
      allAppointments = newAppts;
      allAppointments.forEach(a => { a._hasConflict = false; });
      markConflicts(allAppointments);
      render();
    }
  };
}
