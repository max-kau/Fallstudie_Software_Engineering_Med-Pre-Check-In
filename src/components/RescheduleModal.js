import { praxen } from '../data/praxen.js';

let selectedDate = null;
let selectedTime = null;
let blockedSlots = [];
let currentMonth = new Date();
let activeTerminCode = null;
let activePraxisName = null;
let onRescheduledCallback = null;

function getNextAvailableDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1); // Tomorrow
  while (d.getDay() === 0) { // Skip Sundays
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

function getAvailableTimeslotsForDate(dateStr) {
  if (!dateStr) return [];
  const d = new Date(dateStr + 'T00:00:00');
  const isSaturday = d.getDay() === 6;
  if (isSaturday) {
    return ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
  }
  return [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];
}

async function fetchBlockedSlots(praxisName, date, excludeCode) {
  try {
    const res = await fetch(`/api/termine/blocked?date=${date}&praxis=${encodeURIComponent(praxisName)}&excludeCode=${excludeCode}&_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    blockedSlots = data.blocked || [];
  } catch (err) {
    console.error('Error fetching blocked slots:', err);
    blockedSlots = [];
  }
}

function renderCalendarHtml() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Adjust Monday-based
  
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let daysHtml = '';
  
  for (let i = 0; i < startDayOfWeek; i++) {
    daysHtml += `<div class="dl-calendar-day-empty"></div>`;
  }
  
  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const currentDayDate = new Date(year, month, dayNum);
    currentDayDate.setHours(0, 0, 0, 0);
    
    const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isPast = currentDayDate < today;
    const isSunday = currentDayDate.getDay() === 0;
    const isDisabled = isPast || isSunday;
    
    const activeClass = selectedDate === isoDate ? 'active' : '';
    const todayClass = (today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year) ? 'today' : '';
    const disabledAttr = isDisabled ? 'disabled' : '';
    let titleAttr = '';
    if (isSunday) {
      titleAttr = 'title="Sonntags geschlossen"';
    } else if (isPast) {
      titleAttr = 'title="In der Vergangenheit"';
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
    <div class="dl-calendar" style="margin: 0 auto;">
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

function renderTimeslotsHtml() {
  if (!selectedDate) {
    return `<p class="text-muted" style="text-align: center; font-size: var(--font-size-sm);">Bitte wählen Sie zuerst ein Datum.</p>`;
  }

  const slots = getAvailableTimeslotsForDate(selectedDate);
  if (slots.length === 0) {
    return `<p class="text-muted" style="text-align: center; font-size: var(--font-size-sm);">Keine Termine an diesem Tag verfügbar.</p>`;
  }

  let html = `<div class="dl-time-slots" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-top: var(--space-2);">`;
  slots.forEach(slot => {
    const isBlocked = blockedSlots.includes(slot);
    const isSelected = selectedTime === slot;
    const btnClass = isSelected ? 'active' : '';
    const disabledAttr = isBlocked ? 'disabled title="Bereits belegt"' : '';
    
    html += `
      <button class="booking-time-slot ${btnClass}" data-time="${slot}" ${disabledAttr} style="padding: var(--space-2) 0; font-size: var(--font-size-sm); font-weight: 600;">
        ${slot}
      </button>
    `;
  });
  html += `</div>`;
  return html;
}

async function updateModalContent() {
  const calContainer = document.getElementById('reschedule-calendar-container');
  const timeContainer = document.getElementById('reschedule-time-container');
  const saveBtn = document.getElementById('btn-save-reschedule');

  if (calContainer) {
    calContainer.innerHTML = renderCalendarHtml();
  }

  if (timeContainer) {
    timeContainer.innerHTML = `
      <div style="text-align: center; padding: var(--space-4);">
        <div class="dl-auth-spinner" style="display: inline-block; width: 20px; height: 20px; border-width: 2px;"></div>
      </div>
    `;
    if (selectedDate) {
      await fetchBlockedSlots(activePraxisName, selectedDate, activeTerminCode);
    }
    timeContainer.innerHTML = renderTimeslotsHtml();
  }

  if (saveBtn) {
    saveBtn.disabled = !(selectedDate && selectedTime);
  }

  initCalendarEvents();
}

function initCalendarEvents() {
  const modal = document.getElementById('reschedule-modal');
  if (!modal) return;

  // Month navigation
  modal.querySelector('#btn-prev-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    selectedDate = null;
    selectedTime = null;
    updateModalContent();
  });

  modal.querySelector('#btn-next-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    selectedDate = null;
    selectedTime = null;
    updateModalContent();
  });

  // Day selection
  modal.querySelectorAll('.dl-calendar-day:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedDate = e.currentTarget.getAttribute('data-date');
      selectedTime = null; // Reset time selection on day change
      updateModalContent();
    });
  });

  // Timeslot selection
  modal.querySelectorAll('.booking-time-slot:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedTime = e.currentTarget.getAttribute('data-time');
      // Highlight selected timeslot
      modal.querySelectorAll('.booking-time-slot').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const saveBtn = document.getElementById('btn-save-reschedule');
      if (saveBtn) saveBtn.disabled = false;
    });
  });
}

export function openRescheduleModal(terminCode, praxisName, callback) {
  // Remove existing
  document.getElementById('reschedule-modal')?.remove();

  activeTerminCode = terminCode;
  activePraxisName = praxisName;
  onRescheduledCallback = callback;

  // Defaults
  selectedDate = getNextAvailableDate();
  selectedTime = null;
  currentMonth = new Date(selectedDate);

  const html = `
    <div class="dl-modal-backdrop" id="reschedule-modal" style="z-index: 9100;">
      <div class="dl-modal-card fade-in-up" style="max-width: 480px; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
        <div class="dl-modal-header" style="padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--gray-200);">
          <h3 class="dl-modal-title" style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800);">Termin verschieben</h3>
          <button class="dl-modal-close" id="btn-close-reschedule" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--gray-400);">&times;</button>
        </div>
        
        <div class="dl-modal-body" style="padding: var(--space-5) var(--space-6); overflow-y: auto; max-height: 70vh;">
          <p style="font-size: var(--font-size-sm); color: var(--gray-600); margin-bottom: var(--space-4); line-height: 1.4;">
            Wählen Sie ein neues Datum und eine neue Uhrzeit für Ihren Termin in der Praxis <strong>${praxisName}</strong>.
          </p>

          <label class="booking-section-label" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-500); text-transform: uppercase; margin-bottom: var(--space-2); display: block;">1. Datum wählen</label>
          <div id="reschedule-calendar-container" style="margin-bottom: var(--space-4);"></div>

          <label class="booking-section-label" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-500); text-transform: uppercase; margin-bottom: var(--space-2); display: block;">2. Uhrzeit wählen</label>
          <div id="reschedule-time-container"></div>
        </div>

        <div class="dl-modal-footer" style="padding: var(--space-4) var(--space-6); background: var(--bg-gray); border-top: 1px solid var(--gray-200); display: flex; justify-content: flex-end; gap: var(--space-3);">
          <button class="btn btn-outline" id="btn-cancel-reschedule-action" style="padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm);">Abbrechen</button>
          <button class="btn btn-primary" id="btn-save-reschedule" disabled style="padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm);">Termin verschieben</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('reschedule-modal');
  const close = () => modal?.remove();

  document.getElementById('btn-close-reschedule')?.addEventListener('click', close);
  document.getElementById('btn-cancel-reschedule-action')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // Handle Save Reschedule
  document.getElementById('btn-save-reschedule')?.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime) return;

    const saveBtn = document.getElementById('btn-save-reschedule');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="dl-auth-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>';

    try {
      const res = await fetch(`/api/termine/${activeTerminCode}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: selectedTime })
      });
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Der Server hat keine gültige Antwort gesendet.');
      }

      if (!res.ok) throw new Error(data.error || 'Fehler beim Verschieben des Termins');

      close();
      if (onRescheduledCallback) onRescheduledCallback(selectedDate, selectedTime);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Verbindung fehlgeschlagen.');
      saveBtn.disabled = false;
      saveBtn.innerText = 'Termin verschieben';
    }
  });

  updateModalContent();
}
