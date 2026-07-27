import { t, getLanguage } from '../utils/i18n.js';

const CALENDAR_START_HOUR = 7;
const CALENDAR_END_HOUR = 24;
const HOUR_HEIGHT_PX = 64; // pixels per hour
const SLOT_HEIGHT_PX = HOUR_HEIGHT_PX / 2; // 30-minute slots
const DEFAULT_DURATION = 30;

// ── Date parsing utilities (matching existing code patterns) ────────

const MONTH_MAP = {
  'jan': 0, 'feb': 1, 'mär': 2, 'mar': 2, 'apr': 3, 'mai': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
};

function getWeekdayNames() {
  return getLanguage() === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
}

function getMonthNames() {
  return getLanguage() === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
}

function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + 'T00:00:00');
  }
  const ddmmyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    return new Date(year, month, day);
  }
  const match = str.match(/(\d{1,2})\.\s*([a-zA-ZäöüÄÖÜ]+)/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthAbbr = match[2].toLowerCase().substring(0, 3);
    const month = MONTH_MAP[monthAbbr];
    if (month !== undefined && !isNaN(day)) {
      const now = new Date();
      return new Date(now.getFullYear(), month, day);
    }
  }
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) return fallback;
  return null;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatDateHeader(date) {
  const d = new Date(date);
  const weekdays = getWeekdayNames();
  const months = getMonthNames();
  if (getLanguage() === 'en') {
    return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWeekHeader(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);
  const months = getMonthNames();
  if (getLanguage() === 'en') {
    return `${months[startDate.getMonth()]} ${startDate.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${String(startDate.getDate()).padStart(2, '0')}. ${months[startDate.getMonth()]} – ${String(end.getDate()).padStart(2, '0')}. ${months[end.getMonth()]} ${end.getFullYear()}`;
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
          <button class="cal-nav-btn" id="cal-prev" title="${t('common.back', 'Zurück')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="cal-nav-btn cal-today-btn" id="cal-today">${t('calendar.today')}</button>
          <button class="cal-nav-btn" id="cal-next" title="${t('common.next', 'Vor')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <h2 class="cal-title" id="cal-title"></h2>
        <div class="cal-view-toggle">
          <button class="cal-toggle-btn active" id="cal-view-day" data-view="day">${t('calendar.day')}</button>
          <button class="cal-toggle-btn" id="cal-view-week" data-view="week">${t('calendar.week')}</button>
          <button class="cal-toggle-btn" id="cal-view-buffer" data-view="buffer" style="border-left: 1px solid var(--gray-300);">⏸️ ${t('calendar.buffer_times')}</button>
        </div>
      </div>

      <!-- Legend -->
      <div class="cal-legend" id="cal-legend">
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#059669;"></span>${t('calendar.precheck_done')}</span>
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#DC2626;"></span>${t('calendar.precheck_open')}</span>
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#94A3B8;"></span>${t('calendar.not_unlocked')}</span>
        <span class="cal-legend-item"><span class="cal-legend-dot" style="background:#F59E0B;"></span>${t('calendar.buffer_time')}</span>
      </div>

      <!-- Calendar Body -->
      <div class="cal-body" id="cal-body">
        <!-- Dynamically rendered -->
      </div>

      <!-- Buffer Panel (hidden by default) -->
      <div class="cal-buffer-panel" id="cal-buffer-panel" style="display: none;">
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
  let openEnd = parseTimeToMinutes(todayHours.end);
  if (todayHours.end === '00:00' || todayHours.end === '0:00' || todayHours.end === '24:00' || openEnd === 0) {
    openEnd = 24 * 60; // 1440 minutes = midnight
  }

  let html = '';
  if (openStart > calStartMin) {
    html += buildBlock(calStartMin, Math.min(calEndMin, openStart));
  }
  if (openEnd < calEndMin) {
    html += buildBlock(Math.max(calStartMin, openEnd), calEndMin);
  }

  return html;
}

function renderBufferBlocks(date, bufferTimes) {
  if (!bufferTimes || bufferTimes.length === 0) return '';
  const dayOfWeek = date.getDay();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const calStartMin = CALENDAR_START_HOUR * 60;
  const calEndMin = CALENDAR_END_HOUR * 60;

  let html = '';
  for (const bt of bufferTimes) {
    let matches = false;
    if (bt.is_recurring && bt.day_of_week === dayOfWeek) {
      matches = true;
    } else if (!bt.is_recurring && bt.specific_date === dateStr) {
      matches = true;
    }
    if (!matches) continue;

    const startMin = parseTimeToMinutes(bt.start_time);
    const endMin = parseTimeToMinutes(bt.end_time);
    const clampedStart = Math.max(startMin, calStartMin);
    const clampedEnd = Math.min(endMin, calEndMin);
    if (clampedEnd <= clampedStart) continue;

    const topPx = ((clampedStart - calStartMin) / 60) * HOUR_HEIGHT_PX;
    const heightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT_PX;
    const title = bt.title || 'Pufferzeit';

    html += `
      <div class="cal-buffer-block"
           style="position: absolute; left: 0; right: 0; top: ${topPx}px; height: ${heightPx}px; z-index: 2;"
           title="${title}: ${bt.start_time} – ${bt.end_time}">
        <span class="cal-buffer-label">⏸️ ${title}</span>
      </div>
    `;
  }
  return html;
}

function renderCurrentTimeIndicator(date) {
  if (!isSameDay(date, new Date())) return '';

  const now = new Date();
  const curHours = now.getHours();
  const curMins = now.getMinutes();
  const totalMins = curHours * 60 + curMins;
  const calStartMin = CALENDAR_START_HOUR * 60;
  const calEndMin = CALENDAR_END_HOUR * 60;

  if (totalMins < calStartMin || totalMins > calEndMin) return '';

  const topPx = ((totalMins - calStartMin) / 60) * HOUR_HEIGHT_PX;
  const timeStr = `${String(curHours).padStart(2, '0')}:${String(curMins).padStart(2, '0')}`;

  return `
    <div class="cal-current-time-line"
         style="position: absolute; left: 0; right: 0; top: ${topPx}px; border-top: 2px solid #EF4444; z-index: 10; pointer-events: none;">
      <div style="position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; background: #EF4444; border-radius: 50%; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);"></div>
      <span style="position: absolute; right: 4px; top: -9px; background: #EF4444; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); letter-spacing: 0.3px;">
        📍 ${timeStr}${getLanguage() === 'en' ? '' : ' Uhr'}
      </span>
    </div>
  `;
}

function renderDayView(date, appointments, openingHours, bufferTimes) {
  const dayAppts = filterAppointmentsByDate(appointments, date);
  const isToday = isSameDay(date, new Date());
  const weekdays = getWeekdayNames();

  return `
    <div class="cal-grid cal-grid--day">
      <div class="cal-time-gutter">
        <div class="cal-day-header cal-time-gutter-header">
          <span class="cal-day-name">&nbsp;</span>
          <span class="cal-day-num">&nbsp;</span>
        </div>
        <div class="cal-time-gutter-body">
          ${renderTimeLabels()}
        </div>
      </div>
      <div class="cal-day-col">
        <div class="cal-day-header ${isToday ? 'cal-day-header--today' : ''}">
          <span class="cal-day-name">${weekdays[date.getDay()]}</span>
          <span class="cal-day-num ${isToday ? 'cal-day-num--today' : ''}">${date.getDate()}</span>
        </div>
        <div class="cal-day-body" style="position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX}px;">
          ${renderShadingBlocks(date, openingHours)}
          ${renderBufferBlocks(date, bufferTimes)}
          ${renderTimeGridLines()}
          ${renderCurrentTimeIndicator(date)}
          ${dayAppts.map(appt => renderAppointmentBlock(appt)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderWeekView(mondayDate, appointments, openingHours, bufferTimes) {
  const today = new Date();
  const weekdays = getWeekdayNames();
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    const dayAppts = filterAppointmentsByDate(appointments, d);
    const isToday = isSameDay(d, today);
    cols += `
      <div class="cal-day-col cal-week-col">
        <div class="cal-day-header ${isToday ? 'cal-day-header--today' : ''}">
          <span class="cal-day-name">${weekdays[d.getDay()]}</span>
          <span class="cal-day-num ${isToday ? 'cal-day-num--today' : ''}">${d.getDate()}</span>
        </div>
        <div class="cal-day-body" style="position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX}px;">
          ${renderShadingBlocks(d, openingHours)}
          ${renderBufferBlocks(d, bufferTimes)}
          ${renderTimeGridLines()}
          ${renderCurrentTimeIndicator(d)}
          ${dayAppts.map(appt => renderAppointmentBlock(appt)).join('')}
        </div>
      </div>
    `;
  }
  return `
    <div class="cal-grid cal-grid--week">
      <div class="cal-time-gutter">
        <div class="cal-day-header cal-time-gutter-header">
          <span class="cal-day-name">&nbsp;</span>
          <span class="cal-day-num">&nbsp;</span>
        </div>
        <div class="cal-time-gutter-body">
          ${renderTimeLabels()}
        </div>
      </div>
      ${cols}
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
  const timeLabel = appt.time ? (getLanguage() === 'en' ? appt.time : `${appt.time} Uhr`) : '';

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

function markConflicts(appointments, bufferTimes = []) {
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
    const dateObj = new Date(key + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    // Find buffer times for this date
    const dailyBuffers = bufferTimes.filter(bt => {
      if (bt.is_recurring && bt.day_of_week === dayOfWeek) return true;
      if (!bt.is_recurring && bt.specific_date === key) return true;
      return false;
    });

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

      // Check overlaps with buffer times
      for (const bt of dailyBuffers) {
        const bStart = parseTimeToMinutes(bt.start_time);
        const bEnd = parseTimeToMinutes(bt.end_time);
        if (aEnd > bStart && aStart < bEnd) {
          a._hasConflict = true;
        }
      }
    }
  }
}

// ── Calendar Controller ────────

export function initCalendarView(appointments, onAppointmentClick, openingHours, bufferTimes) {
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  let viewMode = 'day'; // 'day' | 'week' | 'buffer'
  let allAppointments = appointments || [];
  let currentOpeningHours = openingHours || null;
  let allBufferTimes = bufferTimes || [];

  // Mark conflicts
  markConflicts(allAppointments, allBufferTimes);

  const calBody = document.getElementById('cal-body');
  const calTitle = document.getElementById('cal-title');
  const calBufferPanel = document.getElementById('cal-buffer-panel');
  const calLegend = document.getElementById('cal-legend');
  if (!calBody || !calTitle) return;

  const getFullWeekdayNames = () => getLanguage() === 'en'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function render() {
    if (viewMode === 'buffer') {
      calTitle.textContent = t('calendar.manage_buffers');
      calBody.style.display = 'none';
      if (calBufferPanel) {
        calBufferPanel.style.display = 'block';
        calBufferPanel.innerHTML = renderBufferPanel();
        attachBufferPanelListeners();
      }
      if (calLegend) calLegend.style.display = 'none';
    } else {
      calBody.style.display = 'block';
      if (calBufferPanel) calBufferPanel.style.display = 'none';
      if (calLegend) calLegend.style.display = 'flex';
      if (viewMode === 'day') {
        calTitle.textContent = formatDateHeader(currentDate);
        calBody.innerHTML = renderDayView(currentDate, allAppointments, currentOpeningHours, allBufferTimes);
      } else {
        const monday = getMonday(currentDate);
        calTitle.textContent = formatWeekHeader(monday);
        calBody.innerHTML = renderWeekView(monday, allAppointments, currentOpeningHours, allBufferTimes);
      }
      attachEventListeners();
    }
  }

  // ── Buffer Panel ────────
  function renderBufferPanel() {
    const recurringBts = allBufferTimes.filter(bt => bt.is_recurring);
    const onetimeBts = allBufferTimes.filter(bt => !bt.is_recurring);
    const dayNamesFull = getFullWeekdayNames();

    const recurringHtml = recurringBts.length === 0
      ? `<p style="color: var(--gray-400); font-size: var(--font-size-sm); text-align: center; padding: var(--space-4) 0;">${t('calendar.no_recurring_buffers')}</p>`
      : recurringBts.map(bt => {
          const dayName = dayNamesFull[bt.day_of_week];
          const timeSuffix = getLanguage() === 'en' ? '' : ' Uhr';
          const everyPrefix = getLanguage() === 'en' ? 'Every' : 'Jeden';
          return `
          <div class="buffer-card">
            <div class="buffer-card-info">
              <span class="buffer-card-icon">🔁</span>
              <div class="buffer-card-details">
                <span class="buffer-card-title">${bt.title || t('calendar.buffer_time')}</span>
                <span class="buffer-card-meta">${everyPrefix} ${dayName}, ${bt.start_time} – ${bt.end_time}${timeSuffix}</span>
              </div>
            </div>
            <button class="btn-delete-buffer" data-bt-id="${bt.id}" title="${t('calendar.delete_buffer')}">🗑️</button>
          </div>
        `;
        }).join('');

    const onetimeHtml = onetimeBts.length === 0
      ? `<p style="color: var(--gray-400); font-size: var(--font-size-sm); text-align: center; padding: var(--space-4) 0;">${t('calendar.no_onetime_buffers')}</p>`
      : onetimeBts.map(bt => {
          let displayDate = bt.specific_date || '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
            const parts = displayDate.split('-');
            displayDate = getLanguage() === 'en' ? `${parts[1]}/${parts[2]}/${parts[0]}` : `${parts[2]}.${parts[1]}.${parts[0]}`;
          }
          const timeSuffix = getLanguage() === 'en' ? '' : ' Uhr';
          return `
            <div class="buffer-card">
              <div class="buffer-card-info">
                <span class="buffer-card-icon">📅</span>
                <div class="buffer-card-details">
                  <span class="buffer-card-title">${bt.title || t('calendar.buffer_time')}</span>
                  <span class="buffer-card-meta">${displayDate}, ${bt.start_time} – ${bt.end_time}${timeSuffix}</span>
                </div>
              </div>
              <button class="btn-delete-buffer" data-bt-id="${bt.id}" title="${t('calendar.delete_buffer')}">🗑️</button>
            </div>
          `;
        }).join('');

    // Generate time options from 07:00 to 17:30 in 30-min steps
    let timeOptions = '';
    for (let h = CALENDAR_START_HOUR; h <= CALENDAR_END_HOUR; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === CALENDAR_END_HOUR && m > 0) break;
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        timeOptions += `<option value="${val}">${val}</option>`;
      }
    }

    // Default date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDateStr = tomorrow.toISOString().split('T')[0];
    const isEn = getLanguage() === 'en';

    return `
      <div class="buffer-panel">
        <!-- Existing Buffer Times -->
        <div class="buffer-section">
          <h3 class="buffer-section-title">${t('calendar.recurring_buffers')}</h3>
          <div class="buffer-list">
            ${recurringHtml}
          </div>
        </div>

        <div class="buffer-section">
          <h3 class="buffer-section-title">${t('calendar.onetime_buffers')}</h3>
          <div class="buffer-list">
            ${onetimeHtml}
          </div>
        </div>

        <!-- Create New Buffer Time -->
        <div class="buffer-section buffer-create-section">
          <h3 class="buffer-section-title">${t('calendar.schedule_buffer')}</h3>

          <div class="buffer-form">
            <div class="buffer-type-toggle">
              <button class="buffer-type-btn active" id="buf-type-recurring" data-type="recurring">${t('calendar.recurring')}</button>
              <button class="buffer-type-btn" id="buf-type-onetime" data-type="onetime">${t('calendar.onetime')}</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-4);">
              <div>
                <label class="buffer-form-label">${t('calendar.title_optional')}</label>
                <input type="text" id="buf-title" placeholder="${isEn ? 'e.g. Lunch break' : 'z.B. Mittagspause'}" class="buffer-form-input">
              </div>
              <div id="buf-dow-container">
                <label class="buffer-form-label">${t('calendar.weekdays_multi')}</label>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="1" checked> ${isEn ? 'Mon' : 'Mo'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="2" checked> ${isEn ? 'Tue' : 'Di'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="3" checked> ${isEn ? 'Wed' : 'Mi'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="4" checked> ${isEn ? 'Thu' : 'Do'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="5" checked> ${isEn ? 'Fri' : 'Fr'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="6"> ${isEn ? 'Sat' : 'Sa'}
                  </label>
                  <label style="cursor: pointer; font-size: 11px; font-weight: 700; background: var(--bg-gray); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" class="buf-dow-checkbox" value="0"> ${isEn ? 'Sun' : 'So'}
                  </label>
                </div>
              </div>
              <div id="buf-date-container" style="display: none;">
                <label class="buffer-form-label">${t('calendar.date')}</label>
                <input type="date" id="buf-specific-date" value="${defaultDateStr}" class="buffer-form-input">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-4);">
              <div>
                <label class="buffer-form-label">${t('calendar.start_time')}</label>
                <select id="buf-start-time" class="buffer-form-input">
                  ${timeOptions}
                </select>
              </div>
              <div>
                <label class="buffer-form-label">${t('calendar.end_time')}</label>
                <select id="buf-end-time" class="buffer-form-input">
                  ${timeOptions}
                </select>
              </div>
            </div>

            <div style="margin-top: var(--space-5); display: flex; gap: var(--space-3); align-items: center;">
              <button class="btn btn-primary" id="buf-create-btn" style="padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm);">
                ${t('calendar.schedule_btn')}
              </button>
              <span id="buf-status-msg" style="font-size: var(--font-size-sm); font-weight: 600; display: none;"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachBufferPanelListeners() {
    // Type toggle
    const recurringBtn = document.getElementById('buf-type-recurring');
    const onetimeBtn = document.getElementById('buf-type-onetime');
    const dowContainer = document.getElementById('buf-dow-container');
    const dateContainer = document.getElementById('buf-date-container');

    let isRecurring = true;

    recurringBtn?.addEventListener('click', () => {
      isRecurring = true;
      recurringBtn.classList.add('active');
      onetimeBtn.classList.remove('active');
      if (dowContainer) dowContainer.style.display = 'block';
      if (dateContainer) dateContainer.style.display = 'none';
    });

    onetimeBtn?.addEventListener('click', () => {
      isRecurring = false;
      onetimeBtn.classList.add('active');
      recurringBtn.classList.remove('active');
      if (dowContainer) dowContainer.style.display = 'none';
      if (dateContainer) dateContainer.style.display = 'block';
    });

    // Set default end time to 1 hour after start
    const startSelect = document.getElementById('buf-start-time');
    const endSelect = document.getElementById('buf-end-time');
    if (startSelect && endSelect) {
      startSelect.value = '11:30';
      endSelect.value = '12:00';
      startSelect.addEventListener('change', () => {
        const [h, m] = startSelect.value.split(':').map(Number);
        const endMin = h * 60 + m + 30;
        const eh = Math.floor(endMin / 60);
        const em = endMin % 60;
        const endVal = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        if ([...endSelect.options].some(o => o.value === endVal)) {
          endSelect.value = endVal;
        }
      });
    }

    // Create buffer time
    document.getElementById('buf-create-btn')?.addEventListener('click', async () => {
      const title = document.getElementById('buf-title')?.value?.trim() || '';
      const selectedDays = isRecurring
        ? [...document.querySelectorAll('.buf-dow-checkbox:checked')].map(c => parseInt(c.value))
        : [null];
      const specificDate = document.getElementById('buf-specific-date')?.value || '';
      const startTime = document.getElementById('buf-start-time')?.value;
      const endTime = document.getElementById('buf-end-time')?.value;
      const statusMsg = document.getElementById('buf-status-msg');
      const createBtn = document.getElementById('buf-create-btn');

      if (!startTime || !endTime || startTime >= endTime) {
        if (statusMsg) {
          statusMsg.style.display = 'inline';
          statusMsg.style.color = '#DC2626';
          statusMsg.textContent = t('calendar.start_before_end');
        }
        return;
      }

      if (isRecurring && selectedDays.length === 0) {
        showStatusError(t('calendar.select_weekday_error'));
        return;
      }

      if (!isRecurring && !specificDate) {
        showStatusError(t('calendar.select_date_error'));
        return;
      }

      // Helper function to format errors nicely
      function showStatusError(msg) {
        if (!statusMsg) return;
        const cleanMsg = String(msg || (getLanguage() === 'en' ? 'Error creating buffer time.' : 'Fehler beim Erstellen.'))
          .replace(/[\{\}\"\[\]]/g, '')
          .replace(/^error:\s*/i, '')
          .trim();
        statusMsg.style.display = 'inline-block';
        statusMsg.style.color = '#991B1B';
        statusMsg.style.background = '#FEF2F2';
        statusMsg.style.border = '1px solid #FCA5A5';
        statusMsg.style.padding = '6px 12px';
        statusMsg.style.borderRadius = '8px';
        statusMsg.style.fontSize = '12px';
        statusMsg.style.fontWeight = '600';
        statusMsg.textContent = '⚠️ ' + cleanMsg;
      }

      // Frontend Conflict Check against allAppointments
      const apptConflicts = [];
      const newStartMin = parseTimeToMinutes(startTime);
      const newEndMin = parseTimeToMinutes(endTime);

      for (const appt of allAppointments) {
        const apptDateObj = parseGermanDate(appt.date);
        if (!apptDateObj) continue;

        let matchesDay = false;
        if (isRecurring) {
          if (selectedDays.includes(apptDateObj.getDay())) matchesDay = true;
        } else {
          const apptYear = apptDateObj.getFullYear();
          const apptMonth = String(apptDateObj.getMonth() + 1).padStart(2, '0');
          const apptDay = String(apptDateObj.getDate()).padStart(2, '0');
          const apptISO = `${apptYear}-${apptMonth}-${apptDay}`;

          if (apptISO === specificDate || appt.date === specificDate) {
            matchesDay = true;
          }
        }

        if (!matchesDay) continue;

        const apptStartMin = parseTimeToMinutes(appt.time);
        const apptEndMin = apptStartMin + (appt.duration || DEFAULT_DURATION);

        if (apptStartMin < newEndMin && apptEndMin > newStartMin) {
          const patientName = `${appt.patient_vorname || ''} ${appt.patient_nachname || ''}`.trim() || 'Patient';
          const atWord = getLanguage() === 'en' ? 'at' : 'um';
          const uhrWord = getLanguage() === 'en' ? '' : ' Uhr';
          apptConflicts.push(`${patientName} (${appt.date} ${atWord} ${appt.time}${uhrWord})`);
        }
      }

      if (apptConflicts.length > 0) {
        showStatusError(t('calendar.collision_error') + apptConflicts.join(', '));
        return;
      }

      createBtn.disabled = true;
      createBtn.innerHTML = `<div class="dl-auth-spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block;"></div> ${t('calendar.creating')}`;

      let lastError = null;
      let createdCount = 0;

      for (const dayOfWeek of selectedDays) {
        try {
          const res = await fetch('/api/praxis/buffer-times', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title || t('calendar.buffer_time'),
              isRecurring,
              dayOfWeek: isRecurring ? dayOfWeek : null,
              specificDate: !isRecurring ? specificDate : null,
              startTime,
              endTime
            })
          });
          const data = await res.json();
          if (data.success && data.bufferTime) {
            allBufferTimes.push(data.bufferTime);
            createdCount++;
          } else {
            lastError = data.error || (getLanguage() === 'en' ? 'Error creating buffer time.' : 'Fehler beim Erstellen der Pufferzeit.');
          }
        } catch (err) {
          lastError = err.message || (getLanguage() === 'en' ? 'Error creating buffer time.' : 'Fehler beim Erstellen.');
        }
      }

      if (createdCount > 0) {
        if (statusMsg) {
          statusMsg.style.display = 'inline-block';
          statusMsg.style.color = '#059669';
          statusMsg.style.background = '#ECFDF5';
          statusMsg.style.border = '1px solid #A7F3D0';
          statusMsg.style.padding = '6px 12px';
          statusMsg.style.borderRadius = '8px';
          statusMsg.style.fontSize = '12px';
          statusMsg.style.fontWeight = '600';
          statusMsg.textContent = getLanguage() === 'en' ? `✓ ${createdCount} ${t('calendar.buffers_created')}` : `✓ ${createdCount} Pufferzeit(en) erstellt!`;
          setTimeout(() => { statusMsg.style.display = 'none'; }, 2500);
        }
        allAppointments.forEach(a => { a._hasConflict = false; });
        markConflicts(allAppointments, allBufferTimes);
        render(); // Re-render panel
      } else {
        showStatusError(lastError);
        createBtn.disabled = false;
        createBtn.innerHTML = t('calendar.schedule_btn');
      }
    });

    // Delete buffer time
    document.querySelectorAll('.btn-delete-buffer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const btId = parseInt(btn.dataset.btId);
        if (!confirm(t('calendar.confirm_delete_buffer'))) return;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const res = await fetch(`/api/praxis/buffer-times/${btId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            allBufferTimes = allBufferTimes.filter(bt => bt.id !== btId);
            allAppointments.forEach(a => { a._hasConflict = false; });
            markConflicts(allAppointments, allBufferTimes);
            render();
          }
        } catch (err) {
          console.error('Error deleting buffer time:', err);
          btn.disabled = false;
          btn.textContent = '🗑️';
        }
      });
    });
  }

  // ── Drag-to-resize logic ────────
  let resizeState = null;
  let justResized = false;

  function attachEventListeners() {
    // Click on appointment
    calBody.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', (e) => {
        if (justResized) return;
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
      justResized = true;
      setTimeout(() => { justResized = false; }, 300);
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
          markConflicts(allAppointments, allBufferTimes);

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

  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  const todayBtn = document.getElementById('cal-today');

  const newPrev = prevBtn?.cloneNode(true);
  if (prevBtn && newPrev) prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  const newNext = nextBtn?.cloneNode(true);
  if (nextBtn && newNext) nextBtn.parentNode.replaceChild(newNext, nextBtn);
  const newToday = todayBtn?.cloneNode(true);
  if (todayBtn && newToday) todayBtn.parentNode.replaceChild(newToday, todayBtn);

  newPrev?.addEventListener('click', () => {
    if (viewMode === 'day') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
    }
    render();
  });

  newNext?.addEventListener('click', () => {
    if (viewMode === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
    }
    render();
  });

  newToday?.addEventListener('click', () => {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    render();
  });

  // View toggle
  document.querySelectorAll('.cal-toggle-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });

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
      markConflicts(allAppointments, allBufferTimes);
      render();
    },
    updateBufferTimes(newBts) {
      allBufferTimes = newBts || [];
      allAppointments.forEach(a => { a._hasConflict = false; });
      markConflicts(allAppointments, allBufferTimes);
      render();
    }
  };
}
