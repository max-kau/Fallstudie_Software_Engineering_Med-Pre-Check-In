import { navigate } from '../utils/router.js';
import { auth } from '../utils/auth.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { praxen } from '../data/praxen.js';
import { openRescheduleModal } from '../components/RescheduleModal.js';
import { exportAppointmentToIcs } from '../utils/icsExport.js';
import { t } from '../utils/i18n.js';

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
    case 'beschwerden': return `${t('flow.step_symptoms')} (1/3)`;
    case 'medikamente': return `${t('flow.step_meds')} (2/3)`;
    case 'allergien': return `${t('flow.step_allergies')} (3/3)`;
    case 'zusammenfassung': return `${t('flow.step_summary')} (3/3)`;
    default: return t('flow.step_intro');
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
        <div class="landing-header fade-in-up" style="margin-bottom: var(--space-8); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
          <div>
            <span style="font-weight: 700; font-size: var(--font-size-sm); color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">${t('landing.my_account')}</span>
            <h1 style="font-size: var(--font-size-3xl); font-weight: 800; color: var(--gray-800); letter-spacing: -0.02em;">${t('landing.appointments_header')}</h1>
            <p class="text-muted" style="margin-top: 4px; font-size: var(--font-size-sm);">${t('landing.appointments_subtitle')}</p>
          </div>
          <button id="btn-toggle-filters" class="btn btn-outline" style="display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); padding: 8px 16px; border-radius: var(--radius-lg); height: auto;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span>${t('landing.filter_sort_btn')}</span>
          </button>
        </div>

        <!-- Filter- und Sortier-Panel -->
        <div id="filter-panel" class="dl-profile-card fade-in-up" style="display: none; padding: var(--space-5); background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-md); border: 1px solid var(--gray-200); margin-bottom: var(--space-6);">
          <h4 style="font-weight: 700; font-size: var(--font-size-sm); color: var(--gray-700); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            ${t('landing.filter_title')}
          </h4>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
            <!-- Praxis / Arzt -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-praxis" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_praxis')}</label>
              <select id="filter-praxis" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="all">${t('landing.filter_all_praxen')}</option>
              </select>
            </div>
            
            <!-- Fachbereich -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-fachbereich" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_specialty')}</label>
              <select id="filter-fachbereich" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="all">${t('landing.filter_all_specialties')}</option>
              </select>
            </div>
            
            <!-- Art der Untersuchung -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-art" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_type')}</label>
              <select id="filter-art" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="all">${t('landing.filter_all_types')}</option>
              </select>
            </div>

            <!-- Zeitraum -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-zeitraum" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_timeframe')}</label>
              <select id="filter-zeitraum" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="all">${t('landing.filter_all_timeframes')}</option>
                <option value="week">${t('landing.filter_this_week')}</option>
                <option value="month">${t('landing.filter_this_month')}</option>
                <option value="past">${t('landing.filter_past')}</option>
                <option value="future">${t('landing.filter_future')}</option>
              </select>
            </div>

            <!-- Status -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-status" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_status')}</label>
              <select id="filter-status" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="active" selected>${t('landing.filter_active_appts')}</option>
                <option value="all">${t('landing.filter_all_status')}</option>
                <option value="bestaetigt">${t('landing.filter_confirmed')}</option>
                <option value="ausstehend">${t('landing.filter_pending')}</option>
                <option value="abgesagt">${t('landing.filter_cancelled')}</option>
              </select>
            </div>

            <!-- Dringlichkeit -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="filter-dringlichkeit" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.filter_urgency')}</label>
              <select id="filter-dringlichkeit" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="all">${t('landing.filter_all_urgencies')}</option>
                <option value="dringend">${t('landing.filter_urgent_only')}</option>
              </select>
            </div>

            <!-- Sortierung -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="sort-by" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500);">${t('landing.sort_by')}</label>
              <select id="sort-by" class="dl-input" style="height: 38px; padding: 0 10px; border-radius: var(--radius-md); font-size: var(--font-size-sm);">
                <option value="date-asc">${t('landing.sort_date_asc')}</option>
                <option value="date-desc">${t('landing.sort_date_desc')}</option>
                <option value="fav-first">${t('landing.sort_fav')}</option>
                <option value="priority">${t('landing.sort_priority')}</option>
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--gray-200); padding-top: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
            <div id="filter-saved-status" style="font-size: var(--font-size-xs); color: #10B981; font-weight: 600; display: none; align-items: center; gap: 4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>${t('landing.filters_saved')}</span>
            </div>
            <div style="display: flex; gap: var(--space-2); margin-left: auto;">
              <button id="btn-reset-filters" class="btn btn-outline" style="font-size: var(--font-size-xs); padding: 6px 12px; height: auto;">
                ${t('landing.reset_filters')}
              </button>
              <button id="btn-save-filters" class="btn btn-primary" style="font-size: var(--font-size-xs); padding: 6px 12px; height: auto; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>${t('landing.save_filters')}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Content Container -->
        <div id="landing-content-container">
          <div style="text-align: center; padding: var(--space-12) 0;">
            <div class="dl-auth-spinner" style="display: inline-block; width: 40px; height: 40px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-4); font-size: var(--font-size-sm);">${t('landing.loading_appts')}</p>
          </div>
        </div>

        <!-- Footnote Disclaimer -->
        <div style="margin-top: var(--space-16); padding-top: var(--space-6); border-top: 1px solid var(--gray-200); text-align: center;">
          <p style="font-size: var(--font-size-xs); color: var(--gray-400); line-height: 1.5; max-width: 600px; margin: 0 auto;">
            ${t('landing.demo_disclaimer')}
          </p>
        </div>

      </div>
    </div>
  `;
}

export async function initLandingView() {
  initDlNav();

  // Clean up global click listener when navigating away
  const cleanup = () => {
    if (window._landingClickOutsideHandler) {
      document.removeEventListener('click', window._landingClickOutsideHandler);
      window._landingClickOutsideHandler = null;
    }
    window.removeEventListener('viewChanged', cleanup);
  };
  window.addEventListener('viewChanged', cleanup);

  // Setup filter toggle synchronously before any await calls to prevent race conditions in E2E tests
  const toggleBtn = document.getElementById('btn-toggle-filters');
  const filterPanel = document.getElementById('filter-panel');
  if (toggleBtn && filterPanel) {
    filterPanel.style.display = 'none';
    toggleBtn.addEventListener('click', () => {
      const isHidden = filterPanel.style.display === 'none';
      filterPanel.style.display = isHidden ? 'block' : 'none';
      toggleBtn.classList.toggle('active', !isHidden);
    });
  }

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

    window._allAppointments = appointments;

    // Populate filter options dynamically
    populateFilterOptions(appointments);

    // Initial render and apply filters/sort
    applyFiltersAndSort();

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

function populateFilterOptions(appointments) {
  const filterPraxisSelect = document.getElementById('filter-praxis');
  if (filterPraxisSelect) {
    const oldVal = filterPraxisSelect.value;
    filterPraxisSelect.innerHTML = `<option value="all">${t('landing.filter_all_praxen')}</option>`;
    const items = [];
    appointments.forEach(a => {
      if (a.praxis && !items.includes(a.praxis)) {
        items.push(a.praxis);
        const opt = document.createElement('option');
        opt.value = a.praxis;
        opt.textContent = `${t('praxis.title')}: ${a.praxis}`;
        filterPraxisSelect.appendChild(opt);
      }
      if (a.doctor && !items.includes(a.doctor)) {
        items.push(a.doctor);
        const opt = document.createElement('option');
        opt.value = a.doctor;
        opt.textContent = `Arzt: ${a.doctor}`;
        filterPraxisSelect.appendChild(opt);
      }
    });
    if (Array.from(filterPraxisSelect.options).some(o => o.value === oldVal)) {
      filterPraxisSelect.value = oldVal;
    }
  }

  const filterFachbereichSelect = document.getElementById('filter-fachbereich');
  if (filterFachbereichSelect) {
    const oldVal = filterFachbereichSelect.value;
    filterFachbereichSelect.innerHTML = `<option value="all">${t('landing.filter_all_specialties')}</option>`;
    const uniqueFachbereiche = Array.from(new Set(appointments.map(a => a.fachrichtung).filter(Boolean)));
    uniqueFachbereiche.forEach(fb => {
      const opt = document.createElement('option');
      opt.value = fb;
      opt.textContent = fb;
      filterFachbereichSelect.appendChild(opt);
    });
    if (Array.from(filterFachbereichSelect.options).some(o => o.value === oldVal)) {
      filterFachbereichSelect.value = oldVal;
    }
  }

  const filterArtSelect = document.getElementById('filter-art');
  if (filterArtSelect) {
    const oldVal = filterArtSelect.value;
    filterArtSelect.innerHTML = `<option value="all">${t('landing.filter_all_types')}</option>`;
    const uniqueArten = Array.from(new Set(appointments.map(a => a.art).filter(Boolean)));
    uniqueArten.forEach(art => {
      const opt = document.createElement('option');
      opt.value = art;
      opt.textContent = art;
      filterArtSelect.appendChild(opt);
    });
    if (Array.from(filterArtSelect.options).some(o => o.value === oldVal)) {
      filterArtSelect.value = oldVal;
    }
  }

  // Restore saved filter settings from localStorage if present
  applySavedFiltersToSelects();
  setupFilterSortListeners();
}

const SAVED_FILTERS_KEY = 'doctolib_saved_filters';

function getSavedFilters() {
  try {
    const data = localStorage.getItem(SAVED_FILTERS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveFilters() {
  const filterState = {
    praxis: document.getElementById('filter-praxis')?.value || 'all',
    fachbereich: document.getElementById('filter-fachbereich')?.value || 'all',
    art: document.getElementById('filter-art')?.value || 'all',
    zeitraum: document.getElementById('filter-zeitraum')?.value || 'all',
    status: document.getElementById('filter-status')?.value || 'active',
    dringlichkeit: document.getElementById('filter-dringlichkeit')?.value || 'all',
    sort: document.getElementById('sort-by')?.value || 'date-asc'
  };

  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filterState));
    
    const statusEl = document.getElementById('filter-saved-status');
    if (statusEl) {
      statusEl.style.display = 'inline-flex';
      setTimeout(() => {
        if (statusEl) statusEl.style.display = 'none';
      }, 3500);
    }
  } catch (err) {
    console.error('Fehler beim Speichern der Filter:', err);
  }
}

function applySavedFiltersToSelects() {
  const saved = getSavedFilters();
  if (!saved) return;

  const map = {
    'filter-praxis': saved.praxis,
    'filter-fachbereich': saved.fachbereich,
    'filter-art': saved.art,
    'filter-zeitraum': saved.zeitraum,
    'filter-status': saved.status,
    'filter-dringlichkeit': saved.dringlichkeit,
    'sort-by': saved.sort
  };

  Object.entries(map).forEach(([id, val]) => {
    if (!val) return;
    const el = document.getElementById(id);
    if (el) {
      const exists = Array.from(el.options).some(o => o.value === val);
      if (exists) {
        el.value = val;
      }
    }
  });
}

function setupFilterSortListeners() {
  const ids = ['filter-praxis', 'filter-fachbereich', 'filter-art', 'filter-zeitraum', 'filter-status', 'filter-dringlichkeit', 'sort-by'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeEventListener('change', applyFiltersAndSort);
      el.addEventListener('change', applyFiltersAndSort);
    }
  });

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.removeEventListener('click', resetFilters);
    resetBtn.addEventListener('click', resetFilters);
  }

  const saveBtn = document.getElementById('btn-save-filters');
  if (saveBtn) {
    saveBtn.removeEventListener('click', saveFilters);
    saveBtn.addEventListener('click', saveFilters);
  }
}

function resetFilters() {
  try {
    localStorage.removeItem(SAVED_FILTERS_KEY);
  } catch {}

  const ids = ['filter-praxis', 'filter-fachbereich', 'filter-art', 'filter-zeitraum', 'filter-status', 'filter-dringlichkeit'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'filter-status') {
        el.value = 'active';
      } else {
        el.value = 'all';
      }
    }
  });

  const sortEl = document.getElementById('sort-by');
  if (sortEl) sortEl.value = 'date-asc';

  const statusEl = document.getElementById('filter-saved-status');
  if (statusEl) statusEl.style.display = 'none';

  applyFiltersAndSort();
}

function isSameWeek(now, date) {
  const currentWeekDay = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (currentWeekDay === 0 ? 6 : currentWeekDay - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
}

function isSameMonth(now, date) {
  return now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth();
}

function applyFiltersAndSort() {
  if (!window._allAppointments) return;
  let filtered = [...window._allAppointments];

  // 1. Praxis / Arzt Filter
  const praxisArztVal = document.getElementById('filter-praxis')?.value || 'all';
  if (praxisArztVal !== 'all') {
    filtered = filtered.filter(a => a.praxis === praxisArztVal || a.doctor === praxisArztVal);
  }

  // 2. Fachbereich Filter
  const fachbereichVal = document.getElementById('filter-fachbereich')?.value || 'all';
  if (fachbereichVal !== 'all') {
    filtered = filtered.filter(a => a.fachrichtung === fachbereichVal);
  }

  // 3. Art der Untersuchung Filter
  const artVal = document.getElementById('filter-art')?.value || 'all';
  if (artVal !== 'all') {
    filtered = filtered.filter(a => a.art === artVal);
  }

  // 4. Zeitraum Filter
  const zeitraumVal = document.getElementById('filter-zeitraum')?.value || 'all';
  if (zeitraumVal !== 'all') {
    const now = new Date();
    filtered = filtered.filter(a => {
      const apptDate = parseGermanDateTime(a.date, a.time);
      if (!apptDate) return true;

      if (zeitraumVal === 'week') {
        return isSameWeek(now, apptDate);
      } else if (zeitraumVal === 'month') {
        return isSameMonth(now, apptDate);
      } else if (zeitraumVal === 'past') {
        return apptDate < now;
      } else if (zeitraumVal === 'future') {
        return apptDate >= now;
      }
      return true;
    });
  }

  // 5. Status Filter
  const statusVal = document.getElementById('filter-status')?.value || 'active';
  if (statusVal !== 'all') {
    filtered = filtered.filter(a => {
      const isPast = parseGermanDateTime(a.date, a.time) < new Date();
      if (statusVal === 'active') {
        return a.status !== 'abgesagt';
      } else if (statusVal === 'abgesagt') {
        return a.status === 'abgesagt';
      } else if (statusVal === 'ausstehend') {
        return a.status !== 'abgesagt' && !isPast && !a.precheck_submitted;
      } else if (statusVal === 'bestaetigt') {
        return a.status === 'bestätigt' || (a.status !== 'abgesagt' && (isPast || a.precheck_submitted));
      }
      return true;
    });
  }

  // 6. Dringlichkeit Filter
  const dringlichkeitVal = document.getElementById('filter-dringlichkeit')?.value || 'all';
  if (dringlichkeitVal === 'dringend') {
    filtered = filtered.filter(a => a.urgent === true);
  }

  // 7. Sortierung
  const sortVal = document.getElementById('sort-by')?.value || 'date-asc';
  filtered.sort((a, b) => {
    const dateA = parseGermanDateTime(a.date, a.time) || new Date(0);
    const dateB = parseGermanDateTime(b.date, b.time) || new Date(0);

    if (sortVal === 'date-asc') {
      return dateB - dateA;
    } else if (sortVal === 'date-desc') {
      return dateA - dateB;
    } else if (sortVal === 'fav-first') {
      const favA = a.favorite ? 1 : 0;
      const favB = b.favorite ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return dateA - dateB;
    } else if (sortVal === 'priority') {
      const prioA = parseInt(a.priority, 10) || 0;
      const prioB = parseInt(b.priority, 10) || 0;
      if (prioA !== prioB) return prioB - prioA;
      return dateA - dateB;
    }
    return 0;
  });

  renderCardsList(filtered);
}

function renderCardsList(appointments) {
  const container = document.getElementById('landing-content-container');
  if (!container) return;

  if (window._allAppointments.length === 0) {
    container.innerHTML = `
      <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-10) var(--space-6); background: white; border-radius: var(--radius-xl); border: 1px dashed var(--gray-300);">
        <div style="font-size: var(--font-size-4xl); margin-bottom: var(--space-4);">📅</div>
        <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2);">${t('landing.no_appts_title')}</h3>
        <p class="text-muted" style="max-width: 420px; margin: 0 auto var(--space-6) auto; font-size: var(--font-size-sm); line-height: 1.5;">
          ${t('landing.no_appts_desc')}
        </p>
        <button class="dl-home-search-btn" id="btn-landing-go-home" style="margin: 0 auto;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: var(--space-2);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          ${t('landing.find_praxis_btn')}
        </button>
      </div>
    `;

    document.getElementById('btn-landing-go-home')?.addEventListener('click', () => {
      navigate('home');
    });
    return;
  }

  if (appointments.length === 0) {
    container.innerHTML = `
      <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-8) var(--space-6); background: white; border-radius: var(--radius-xl); border: 1px dashed var(--gray-300);">
        <div style="font-size: 32px; margin-bottom: var(--space-3);">🔍</div>
        <h3 style="font-size: var(--font-size-md); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-1);">${t('landing.no_matching_title')}</h3>
        <p class="text-muted" style="font-size: var(--font-size-sm); max-width: 360px; margin: 0 auto;">
          ${t('landing.no_matching_desc')}
        </p>
      </div>
    `;
    return;
  }

  let listHtml = `<div style="display: flex; flex-direction: column; gap: var(--space-6);">`;

  appointments.forEach((appt, idx) => {
    const pInfo = getPraxisInfo(appt.praxis);
    const tagsHtml = [
      ...(appt.tags || []).map(t => `<span class="dl-tag">${t}</span>`),
      `<span class="dl-tag" style="background: var(--gray-100); color: var(--gray-600); border: 1px solid var(--gray-200); font-weight: 600;">⚠️ Demo-Praxis</span>`
    ].join('');

    const isSubmitted = appt.precheck_submitted;
    const currentStep = appt.precheck_step;
    const hasProgress = currentStep && currentStep !== 'intro';

    const appointmentDateTime = parseGermanDateTime(appt.date, appt.time);
    const isPast = appointmentDateTime && appointmentDateTime < new Date();

    const isToday = (() => {
      const d = parseGermanDate(appt.date);
      if (!d) return false;
      const now = new Date();
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    })();

    const available = isPrecheckAvailable(appt.date, appt.time);
    const openDate = getPrecheckOpenDate(appt.date, appt.time);
    const daysLeft = daysUntil(appt.date);

    let precheckBannerHtml = '';

    if (appt.status === 'abgesagt') {
      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--locked" style="background: #FEE2E2; border-left: 4px solid #EF4444; position: relative;">
          <div class="precheck-banner__content">
            <div class="precheck-banner__info">
              <span class="precheck-banner__badge" style="background: #EF4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-bottom: var(--space-2);">
                ❌ ${t('status.cancelled').toUpperCase()}
              </span>
              <h4 class="precheck-banner__title" style="color: #991B1B; font-weight: 700; font-size: var(--font-size-md); margin-bottom: 2px;">${t('landing.cancelled_title')}</h4>
              <p class="precheck-banner__desc" style="color: #B91C1C; font-size: var(--font-size-sm); line-height: 1.4;">${t('landing.cancelled_desc')}</p>
            </div>
          </div>
        </div>
      `;
    } else if (isSubmitted) {
      const latestHint = appt.hints && appt.hints.length > 0 ? appt.hints[0] : null;
      let hintSectionHtml = '';
      if (latestHint) {
        const hintList = Array.isArray(latestHint.hints) ? latestHint.hints : (typeof latestHint.hints === 'string' ? JSON.parse(latestHint.hints) : []);
        const listItems = hintList.map(h => `<li style="margin-bottom: 4px;">${h}</li>`).join('');
        hintSectionHtml = `
          <div class="patient-hint-banner-alert" style="margin-top: var(--space-4); background: #FFFBEB; border: 1px solid #FEF3C7; border-left: 4px solid #F59E0B; padding: var(--space-4); border-radius: var(--radius-lg); text-align: left; width: 100%;">
            <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-sm); color: #B45309; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              ${t('landing.practice_notes')}
            </h5>
            ${hintList.length > 0 ? `<ul style="margin: 0; padding-left: 20px; font-size: var(--font-size-sm); color: #92400E;">${listItems}</ul>` : ''}
            ${latestHint.custom_text ? `<div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: #92400E; font-style: italic;">${latestHint.custom_text}</div>` : ''}
          </div>
        `;
      }

      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--submitted">
          <div class="precheck-banner__content" style="flex-wrap: wrap;">
            <div class="precheck-banner__info" style="flex: 1; min-width: 250px;">
              <span class="precheck-banner__badge precheck-banner__badge--success">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ${t('landing.submitted_badge')}
              </span>
              <h4 class="precheck-banner__title">${t('landing.submitted_title')}</h4>
              <p class="precheck-banner__desc">${t('landing.submitted_desc')}</p>
              ${hintSectionHtml}
            </div>
            <div class="precheck-banner__action" style="align-self: flex-start;">
              <button class="precheck-banner__btn precheck-banner__btn--outline-success btn-go-precheck" data-code="${appt.code}" data-target="zusammenfassung">
                ${t('landing.view_summary_btn')}
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (isPast) {
      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--locked" style="background: #F3F4F6; border-left: 4px solid #9CA3AF; position: relative;">
          <div class="precheck-banner__content">
            <div class="precheck-banner__info">
              <span class="precheck-banner__badge" style="background: #E5E7EB; color: #4B5563; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-bottom: var(--space-2);">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ${t('landing.expired_badge')}
              </span>
              <h4 class="precheck-banner__title" style="color: #374151; font-weight: 700; font-size: var(--font-size-md); margin-bottom: 2px;">${t('landing.expired_title')}</h4>
              <p class="precheck-banner__desc" style="color: #6B7280; font-size: var(--font-size-sm); line-height: 1.4;">${t('landing.expired_desc')}</p>
            </div>
          </div>
          <div class="precheck-banner__locked-overlay" style="background: rgba(243, 244, 246, 0.05); pointer-events: none;"></div>
        </div>
      `;
    } else if (hasProgress && available) {
      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--progress">
          <div class="precheck-banner__content">
            <div class="precheck-banner__info">
              <span class="precheck-banner__badge precheck-banner__badge--progress">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${t('landing.in_progress_badge')}
              </span>
              <h4 class="precheck-banner__title">${t('landing.in_progress_title')}</h4>
              <p class="precheck-banner__desc">${t('landing.in_progress_desc').replace('{step}', getStepLabel(currentStep))}</p>
            </div>
            <div class="precheck-banner__action">
              <button class="precheck-banner__btn precheck-banner__btn--outline-progress btn-go-precheck" data-code="${appt.code}" data-target="${currentStep}">
                ${t('landing.continue_prep_btn')}
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (available) {
      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--available">
          <div class="precheck-banner__content">
            <div class="precheck-banner__info">
              <span class="precheck-banner__badge precheck-banner__badge--available">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PRE-CHECK-IN
              </span>
              <h4 class="precheck-banner__title">${t('landing.start_prep_title')}</h4>
              <p class="precheck-banner__desc">${t('landing.start_prep_desc')}</p>
            </div>
            <div class="precheck-banner__action">
              <button class="precheck-banner__btn precheck-banner__btn--start btn-go-precheck" data-code="${appt.code}" data-target="confirm">
                ${t('landing.start_prep_btn')}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      const openDateStr = openDate ? formatGermanDateTime(openDate) : '–';
      const daysText = daysLeft !== null ? `Noch ${daysLeft} Tag${daysLeft !== 1 ? 'e' : ''} bis zum Termin` : '';

      precheckBannerHtml = `
        <div class="precheck-banner precheck-banner--locked">
          <div class="precheck-banner__content">
            <div class="precheck-banner__info">
              <span class="precheck-banner__badge precheck-banner__badge--locked">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ${t('status.pending').toUpperCase()}
              </span>
              <h4 class="precheck-banner__title precheck-banner__title--locked">${t('landing.locked_title')}</h4>
              <p class="precheck-banner__desc precheck-banner__desc--locked">
                ${daysText ? `<span class="precheck-banner__countdown">${daysText}</span> · ` : ''}${t('landing.locked_desc').replace('{openDate}', openDateStr)}
              </p>
            </div>
          </div>
          <div class="precheck-banner__locked-overlay"></div>
        </div>
      `;
    }

    let sharedDocsHtml = '';
    if (appt.shared_documents && appt.shared_documents.length > 0) {
      sharedDocsHtml = `
        <div class="shared-docs-patient-container" style="padding: var(--space-4) var(--space-6); border-top: 1px solid var(--gray-100); background: #F8FAFC; border-bottom: 1px solid var(--gray-100);">
          <h5 style="margin: 0 0 var(--space-3) 0; font-size: var(--font-size-xs); color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
            📂 ${t('flow.step_docs')}:
          </h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-2);">
            ${appt.shared_documents.map(doc => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
                <div style="display: flex; flex-direction: column; overflow: hidden; margin-right: var(--space-2);">
                  <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${doc.filename}">${doc.filename}</span>
                  <span style="font-size: 10px; color: var(--gray-400); font-weight: 600;">${doc.doc_category}</span>
                </div>
                <a href="/api/file/${doc.id}" target="_blank" class="btn" style="background: var(--primary-lightest); color: var(--primary); padding: 4px 10px; font-size: 11px; font-weight: 700; text-decoration: none; border-radius: var(--radius-md); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; height: 24px; border: 1px solid rgba(0, 99, 190, 0.15);">
                  Laden
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let aftercareHtml = '';
    if (appt.aftercare_instructions && appt.aftercare_instructions.length > 0) {
      aftercareHtml = `
        <div class="aftercare-patient-container" style="padding: var(--space-4) var(--space-6); border-top: 1px solid var(--gray-100); background: #EFF6FF; border-bottom: 1px solid var(--gray-100);">
          <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-xs); color: #1D4ED8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
            🩺 Nachsorge-Hinweise:
          </h5>
          ${appt.aftercare_instructions.map(instr => `
            <div style="background: white; border: 1px solid #BFDBFE; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--gray-700); font-style: italic; line-height: 1.5; box-shadow: var(--shadow-sm); margin-bottom: var(--space-2);">
              "${instr.instructions}"
            </div>
          `).join('')}
        </div>
      `;
    }

    const starColor = appt.favorite ? '#F59E0B' : '#D1D5DB';
    const starIcon = appt.favorite ? '★' : '☆';
    const starHtml = `
      <button class="btn-toggle-favorite" data-code="${appt.code}" title="Favorit" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 4px; color: ${starColor}; line-height: 1; transition: transform 0.1s; display: inline-flex; align-items: center;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
        ${starIcon}
      </button>
    `;

    const urgentColor = appt.urgent ? '#EF4444' : '#D1D5DB';
    const urgentIcon = appt.urgent ? '🚩' : '🏳️';
    const urgentBtnHtml = `
      <button class="btn-toggle-urgent" data-code="${appt.code}" title="Dringlichkeit" style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 0 4px; color: ${urgentColor}; line-height: 1; transition: transform 0.1s; display: inline-flex; align-items: center;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
        ${urgentIcon}
      </button>
    `;

    const urgentBadgeHtml = appt.urgent 
      ? `<span class="dl-tag" style="background: #FEE2E2; color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
           DRINGEND
         </span>`
      : '';

    const priorityControlsHtml = `
      <div style="display: flex; align-items: center; gap: 6px; background: var(--gray-50); border: 1px solid var(--gray-200); padding: 4px 8px; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-600); margin-right: 4px;">
        <span>Prio:</span>
        <strong style="color: var(--gray-800); min-width: 14px; text-align: center;">${appt.priority || 0}</strong>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <button class="btn-priority-up" data-code="${appt.code}" style="border: none; background: none; font-size: 8px; cursor: pointer; padding: 0; line-height: 1; color: var(--gray-500); display: block;">▲</button>
          <button class="btn-priority-down" data-code="${appt.code}" style="border: none; background: none; font-size: 8px; cursor: pointer; padding: 0; line-height: 1; color: var(--gray-500); display: block;">▼</button>
        </div>
      </div>
    `;

    listHtml += `
      <div class="dl-profile-card fade-in-up termin-card" style="animation-delay: ${idx * 0.05}s; display: flex; flex-direction: column; overflow: hidden; padding: 0; background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-md); border: 1px solid var(--gray-200); ${appt.status === 'abgesagt' ? 'opacity: 0.65;' : ''}">
        
        <!-- Appointment Header Card -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6); border-bottom: 1px solid var(--gray-100); flex-wrap: wrap; gap: var(--space-4);">
          <div style="display: flex; gap: var(--space-4); flex: 1; min-width: 280px;">
            <div style="background: white; border: 1px solid var(--gray-200); width: 50px; height: 50px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: var(--font-size-2xl); flex-shrink: 0; overflow: hidden; padding: 2px;">
              ${pInfo.logo.includes('.') ? `<img src="${pInfo.logo}" style="width: 100%; height: 100%; object-fit: contain;" />` : pInfo.logo}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em;">${appt.praxis.toUpperCase()}</span>
                ${starHtml}
                ${urgentBtnHtml}
              </div>
              <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin: 2px 0 6px 0;">${appt.doctor}</h3>
              <p class="text-muted" style="font-size: var(--font-size-sm); line-height: 1.4;">${appt.fachrichtung} · ${appt.adresse}</p>
              <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; align-items: center;">
                ${urgentBadgeHtml}
                ${tagsHtml}
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: var(--space-3); margin-left: auto;">
            ${priorityControlsHtml}
            <div style="background: var(--bg-gray); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); text-align: right; border: 1px solid var(--gray-200); min-width: 170px;">
              <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">${t('landing.your_appointment')}</span>
              <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block;">${formatGermanDate(appt.date)}</strong>
              <span style="font-size: var(--font-size-xs); color: var(--gray-500); display: block; margin-top: 2px;">${appt.time} · ${appt.art}</span>
            </div>

            ${!isPast && appt.status !== 'abgesagt' ? `
            <div style="position: relative;" class="dl-menu-container">
              <button class="btn-menu-trigger" data-code="${appt.code}" data-consent="${appt.precheck_consent}" style="background: none; border: none; font-size: 20px; color: var(--gray-500); cursor: pointer; padding: 4px 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; height: 36px; width: 36px; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                ⋮
              </button>
              <div class="dl-menu-dropdown" id="dropdown-${appt.code}" style="display: none; position: absolute; right: 0; top: 40px; background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-md); z-index: 100; min-width: 200px; padding: 4px 0;">
                <button class="btn-menu-action btn-manage-ai" data-code="${appt.code}" data-consent="${appt.precheck_consent}" style="width: 100%; text-align: left; background: none; border: none; padding: 10px 16px; font-size: var(--font-size-sm); color: var(--gray-700); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                  🤖 <span>KI-Einstellungen</span>
                </button>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Precheckin Banner Section inside Card -->
        ${precheckBannerHtml}

        <!-- Shared documents from Praxis -->
        ${sharedDocsHtml}

        <!-- Aftercare instructions -->
        ${aftercareHtml}

        <!-- Card Action Footer -->
        ${!isPast && appt.status !== 'abgesagt' ? `
        <div class="dl-card-action-footer" style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); background: var(--bg-gray); border-top: 1px solid var(--gray-100); flex-wrap: wrap;">
          ${isToday ? `
          <button class="btn btn-open-queue" data-praxis="${appt.praxis}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
            📺 ${t('landing.open_live_queue_btn')}
          </button>
          ` : ''}
          <button class="btn btn-export-ics btn-outline" data-code="${appt.code}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px;">
            📥 ${t('landing.export_ics_btn')}
          </button>
          <button class="btn btn-reschedule btn-outline" data-code="${appt.code}" data-praxis="${appt.praxis}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px;">
            📅 ${t('landing.reschedule_btn')}
          </button>
          <button class="btn btn-cancel-appt btn-outline-danger" data-code="${appt.code}" data-date="${formatGermanDate(appt.date)}" data-time="${appt.time}" style="font-size: var(--font-size-xs); padding: var(--space-2) var(--space-4); font-weight: 700; display: flex; align-items: center; gap: 6px;">
            ❌ ${t('landing.cancel_btn')}
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
      window.location.href = `?termin=${code}#${target}`;
    });
  });

  // Attach click events for ICS calendar export
  container.querySelectorAll('.btn-export-ics').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.currentTarget.getAttribute('data-code');
      const targetAppt = appointments.find(a => a.code === code);
      if (targetAppt) {
        exportAppointmentToIcs(targetAppt);
      }
    });
  });

  // Attach click events to open live queue
  container.querySelectorAll('.btn-open-queue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const praxis = e.currentTarget.getAttribute('data-praxis');
      navigate(`warteschlange?praxis=${encodeURIComponent(praxis)}`);
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

  // Attach click events for cancelling
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

        button.classList.add('precheck-banner__btn--notified');
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          E-Mail-Erinnerung aktiviert
        `;
        showNotificationToast(openDate);
      } catch (err) {
        console.error('Error enabling notification:', err);
        button.disabled = false;
        alert('Die Aktivierung der E-Mail-Benachrichtigung ist fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    });
  });

  // Handle dropdown toggle clicks for 3-dots menu
  container.querySelectorAll('.btn-menu-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const dropdown = document.getElementById(`dropdown-${code}`);
      
      document.querySelectorAll('.dl-menu-dropdown').forEach(d => {
        if (d.id !== `dropdown-${code}`) {
          d.style.display = 'none';
        }
      });

      if (dropdown) {
        const isHidden = dropdown.style.display === 'none';
        dropdown.style.display = isHidden ? 'block' : 'none';
      }
    });
  });

  // Attach click events for managing AI settings in the dropdown
  container.querySelectorAll('.btn-manage-ai').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const consentAttr = e.currentTarget.getAttribute('data-consent');
      
      let currentConsent = null;
      if (consentAttr === 'true') currentConsent = true;
      if (consentAttr === 'false') currentConsent = false;

      openAiConsentModal(code, currentConsent, (savedConsent) => {
        showConsentUpdateToast(savedConsent);
        initLandingView();
      });
    });
  });

  // Attach click events for toggling favorites
  container.querySelectorAll('.btn-toggle-favorite').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const appt = window._allAppointments.find(a => a.code === code);
      if (!appt) return;
      const newFav = !appt.favorite;
      
      try {
        const res = await fetch(`/api/termine/${code}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorite: newFav })
        });
        if (res.ok) {
          appt.favorite = newFav;
          applyFiltersAndSort();
        }
      } catch (err) {
        console.error('Error toggling favorite:', err);
      }
    });
  });

  // Attach click events for toggling urgency
  container.querySelectorAll('.btn-toggle-urgent').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const appt = window._allAppointments.find(a => a.code === code);
      if (!appt) return;
      const newUrgent = !appt.urgent;
      
      try {
        const res = await fetch(`/api/termine/${code}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urgent: newUrgent })
        });
        if (res.ok) {
          appt.urgent = newUrgent;
          applyFiltersAndSort();
        }
      } catch (err) {
        console.error('Error toggling urgency:', err);
      }
    });
  });

  // Attach click events for priority adjustment
  container.querySelectorAll('.btn-priority-up').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const appt = window._allAppointments.find(a => a.code === code);
      if (!appt) return;
      const newPriority = (appt.priority || 0) + 1;
      
      try {
        const res = await fetch(`/api/termine/${code}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: newPriority })
        });
        if (res.ok) {
          appt.priority = newPriority;
          applyFiltersAndSort();
        }
      } catch (err) {
        console.error('Error updating priority:', err);
      }
    });
  });

  container.querySelectorAll('.btn-priority-down').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = e.currentTarget.getAttribute('data-code');
      const appt = window._allAppointments.find(a => a.code === code);
      if (!appt) return;
      const newPriority = Math.max(0, (appt.priority || 0) - 1);
      
      try {
        const res = await fetch(`/api/termine/${code}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: newPriority })
        });
        if (res.ok) {
          appt.priority = newPriority;
          applyFiltersAndSort();
        }
      } catch (err) {
        console.error('Error updating priority:', err);
      }
    });
  });
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

function showConsentUpdateToast(consent) {
  document.querySelector('.notify-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'notify-toast';
  toast.innerHTML = `
    <div class="notify-toast__icon" style="color: var(--primary);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div class="notify-toast__text">
      <strong>KI-Einstellungen aktualisiert</strong>
      <span>Die KI-Unterstützung wurde erfolgreich ${consent ? 'aktiviert' : 'deaktiviert'}.</span>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('notify-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('notify-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function openAiConsentModal(terminCode, currentConsent, onSaved) {
  document.getElementById('ai-consent-modal')?.remove();

  const isConsentEnabled = currentConsent !== false; // Defaults to true/enabled

  const html = `
    <div class="dl-modal-backdrop" id="ai-consent-modal" style="z-index: 9200;">
      <div class="dl-modal-card fade-in-up" style="max-width: 500px; padding: var(--space-6); border-radius: var(--radius-xl); background: white;">
        <h3 style="font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); font-size: var(--font-size-lg); display: flex; align-items: center; gap: 8px;">
          🤖 KI-Zustimmung verwalten
        </h3>
        <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.5; margin-bottom: var(--space-4);">
          Bestimmen Sie, ob künstliche Intelligenz zur Datenverarbeitung und Auswertung für diesen Termin verwendet werden darf.
        </p>

        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); text-align: left;">
          <!-- Option 1: Mit KI -->
          <label class="modal-ai-consent-card" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 2px solid ${isConsentEnabled ? 'var(--primary)' : 'var(--gray-200)'}; background: ${isConsentEnabled ? '#eff6ff' : 'white'}; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s; box-shadow: ${isConsentEnabled ? '0 0 0 3px rgba(16, 122, 202, 0.15)' : 'none'};">
            <input type="radio" name="modal-ai-consent-choice" value="true" ${isConsentEnabled ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
            <div>
              <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block; margin-bottom: 2px;">KI-Unterstützung zulassen (empfohlen)</strong>
              <span style="font-size: var(--font-size-xs); color: var(--gray-500);">Für personalisierte Folgefragen und automatisierte Zusammenfassungen.</span>
            </div>
          </label>
          
          <!-- Option 2: Ohne KI -->
          <label class="modal-ai-consent-card" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 2px solid ${!isConsentEnabled ? 'var(--primary)' : 'var(--gray-200)'}; background: ${!isConsentEnabled ? '#eff6ff' : 'white'}; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s; box-shadow: ${!isConsentEnabled ? '0 0 0 3px rgba(16, 122, 202, 0.15)' : 'none'};">
            <input type="radio" name="modal-ai-consent-choice" value="false" ${!isConsentEnabled ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
            <div>
              <strong style="font-size: var(--font-size-sm); color: var(--gray-800); display: block; margin-bottom: 2px;">KI-Unterstützung ablehnen / entziehen</strong>
              <span style="font-size: var(--font-size-xs); color: var(--gray-500);">Verwendung eines standardisierten Fragenkatalogs. Keine automatisierte Analyse Ihrer Angaben.</span>
            </div>
          </label>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); font-size: var(--font-size-xs); color: #b45309; margin-bottom: var(--space-6); text-align: left; line-height: 1.4;">
          ⚠️ <strong>Wichtiger Hinweis:</strong> Das Ändern Ihrer Zustimmung löscht alle bisher für diesen Pre-Check-In gespeicherten Folgefragen und Auswertungen, damit diese passend neu generiert werden können.
        </div>

        <div style="display: flex; gap: var(--space-3); justify-content: flex-end;">
          <button class="btn btn-outline" id="btn-modal-ai-cancel" style="padding: var(--space-2) var(--space-4); font-weight: 600;">Abbrechen</button>
          <button class="btn btn-primary" id="btn-modal-ai-save" style="padding: var(--space-2) var(--space-4); font-weight: 600;">Einstellungen speichern</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('ai-consent-modal');
  const close = () => modal?.remove();

  document.getElementById('btn-modal-ai-cancel')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  const choiceRadios = document.querySelectorAll('input[name="modal-ai-consent-choice"]');
  choiceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      choiceRadios.forEach(r => {
        const card = r.closest('.modal-ai-consent-card');
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

  document.getElementById('btn-modal-ai-save')?.addEventListener('click', async () => {
    const isConsentSelected = document.querySelector('input[name="modal-ai-consent-choice"]:checked')?.value === 'true';
    const saveBtn = document.getElementById('btn-modal-ai-save');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch(`/api/precheckin/${terminCode}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: isConsentSelected })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Fehler beim Speichern der KI-Zustimmung.');
      }

      close();
      onSaved(isConsentSelected);
    } catch (err) {
      alert(err.message || 'Speichern fehlgeschlagen.');
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}

