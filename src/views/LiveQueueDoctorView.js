/**
 * LiveQueueDoctorView – Arzt-Ansicht der Live-Warteschlange
 * Shows today's appointments as a live queue with accept/done/delay/early-request actions.
 */
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { openDelayModal } from '../components/DelayModal.js';
import { t, getLanguage } from '../utils/i18n.js';

let _pollInterval = null;

function getGermanDateToday() {
  const now = new Date();
  const lang = getLanguage();
  if (lang === 'en') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[now.getDay()]}, ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function adjustTime(timeStr, minutesOffset) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  let totalMin = h * 60 + m + minutesOffset;
  if (totalMin < 0) totalMin = 0;
  const hOut = Math.floor(totalMin / 60) % 24;
  const mOut = totalMin % 60;
  return `${String(hOut).padStart(2, '0')}:${String(mOut).padStart(2, '0')}`;
}

function getStatusLabel(status) {
  switch (status) {
    case 'waiting': return t('status.waiting', 'Wartend');
    case 'arrived': return t('status.appeared', 'Erschienen');
    case 'in_treatment': return t('status.in_treatment', 'In Behandlung');
    case 'treatment_finished': return t('status.done', 'Fertig');
    case 'done': return t('status.done', 'Fertig');
    case 'delayed': return t('status.delayed', 'Verzögert');
    default: return status;
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'waiting': return '🕐';
    case 'arrived': return '👤';
    case 'in_treatment': return '🩺';
    case 'treatment_finished': return '🩹';
    case 'done': return '✅';
    case 'delayed': return '⏰';
    default: return '👤';
  }
}

function getPersonIcon(status) {
  switch (status) {
    case 'waiting': return '🧑';
    case 'arrived': return '👋';
    case 'in_treatment': return '🧑‍⚕️';
    case 'treatment_finished': return '🩹';
    case 'done': return '✓';
    case 'delayed': return '⏳';
    default: return '👤';
  }
}

export function renderLiveQueueDoctorView() {
  const user = auth.getUser() || {};
  return `
    ${renderDlNav()}
    <div class="dl-page live-queue-page">
      <div class="live-queue-container">
        <!-- Back Button -->
        <button class="queue-back-btn" id="queue-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          ${t('queue.back_dashboard')}
        </button>

        <!-- Header -->
        <div class="live-queue-header">
          <div class="live-queue-header-left">
            <h1 class="live-queue-title">
              📋 ${t('queue.title')}
              <span class="live-indicator">
                <span class="live-indicator-dot"></span>
                LIVE
              </span>
            </h1>
            <p class="live-queue-subtitle">${user.praxis_name || t('profile.my_praxis', 'Meine Praxis')} – ${t('queue.today_appts')}</p>
          </div>
          <div class="live-queue-header-right">
            <div class="live-queue-clock" id="queue-clock">--:--:--</div>
            <div class="live-queue-date">${getGermanDateToday()}</div>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="queue-stats-bar" id="queue-stats-bar">
          <div class="queue-stat">
            <div class="queue-stat-icon queue-stat-icon--waiting">🕐</div>
            <div>
              <div class="queue-stat-value" id="stat-waiting">-</div>
              <div class="queue-stat-label">${t('queue.waiting')}</div>
            </div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-icon queue-stat-icon--active">🩺</div>
            <div>
              <div class="queue-stat-value" id="stat-active">-</div>
              <div class="queue-stat-label">${t('queue.in_treatment')}</div>
            </div>
          </div>
          <div class="queue-stat">
            <div class="queue-stat-icon queue-stat-icon--done">✅</div>
            <div>
              <div class="queue-stat-value" id="stat-done">-</div>
              <div class="queue-stat-label">${t('queue.completed')}</div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="queue-progress-bar">
          <div class="queue-progress-fill" id="queue-progress-fill" style="width: 0%"></div>
        </div>

        <!-- Queue Cards Container -->
        <div id="queue-cards-container">
          <div style="text-align: center; padding: var(--space-8) 0;">
            <div class="dl-auth-spinner" style="display: inline-block; width: 40px; height: 40px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-4); font-size: var(--font-size-sm);">${t('common.loading')}</p>
          </div>
        </div>

        <!-- Refresh Indicator -->
        <div class="queue-refresh-indicator">
          <span class="queue-refresh-dot"></span>
          ${t('queue.auto_refresh_5s')}
        </div>
      </div>
    </div>
  `;
}

function renderQueueCards(queue) {
  if (!queue || queue.length === 0) {
    return `
      <div class="queue-empty">
        <div class="queue-empty-icon">📋</div>
        <div class="queue-empty-text">${t('queue.no_appts_today')}</div>
        <div class="queue-empty-desc">${t('queue.no_appts_today_desc')}</div>
      </div>
    `;
  }

  // Check if any patient is currently in treatment
  const hasActivePatient = queue.some(q => q.status === 'in_treatment');

  return queue.map((item, idx) => {
    const statusClass = `queue-card--${item.status}`;
    const personClass = `queue-person-icon--${item.status}`;

    // Determine which buttons to show
    let actionsHtml = '';
    if (item.status === 'waiting' || item.status === 'delayed') {
      // Check if this patient's time has not come yet and no one is being treated
      const now = new Date();
      const [h, m] = (item.time || '00:00').split(':').map(Number);
      const appointmentTime = new Date();
      appointmentTime.setHours(h, m, 0, 0);
      const isBeforeTime = now < appointmentTime;

      actionsHtml = `
        <button class="queue-btn queue-btn--arrived" data-code="${item.code}" data-action="status-update" data-target-status="arrived" style="background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; border: none; font-weight: 700;">
          ${t('queue.patient_arrived')}
        </button>
        <button class="queue-btn queue-btn--delay" data-code="${item.code}" data-action="delay" data-name="${item.patient_vorname} ${item.patient_nachname}">
          ${t('queue.delay_appt')}
        </button>
        <button class="queue-btn" data-code="${item.code}" data-action="no-show" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; font-weight: 700;">
          ${t('queue.no_show')}
        </button>
        ${!hasActivePatient && isBeforeTime ? `
        <button class="queue-btn queue-btn--early" data-code="${item.code}" data-action="early-request">
          ${t('queue.request_early')}
        </button>
        ` : ''}
      `;
    } else if (item.status === 'arrived') {
      actionsHtml = `
        <button class="queue-btn queue-btn--start-treatment" data-code="${item.code}" data-action="status-update" data-target-status="in_treatment" style="background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; font-weight: 700;">
          ${t('queue.treatment_started')}
        </button>
      `;
    } else if (item.status === 'in_treatment') {
      actionsHtml = `
        <button class="queue-btn queue-btn--finish-treatment" data-code="${item.code}" data-action="status-update" data-target-status="treatment_finished" style="background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; font-weight: 700;">
          ${t('queue.treatment_finished')}
        </button>
      `;
    } else if (item.status === 'treatment_finished') {
      actionsHtml = `
        <button class="queue-btn queue-btn--left-practice" data-code="${item.code}" data-action="status-update" data-target-status="done" style="background: linear-gradient(135deg, #6B7280, #4B5563); color: white; border: none; font-weight: 700;">
          ${t('queue.left_practice')}
        </button>
      `;
    }

    // Early request badge
    let earlyBadgeHtml = '';
    if (item.early_request_status === 'pending') {
      earlyBadgeHtml = `<span class="queue-early-badge queue-early-badge--pending">${t('queue.early_requested')}</span>`;
    } else if (item.early_request_status === 'accepted') {
      earlyBadgeHtml = `<span class="queue-early-badge queue-early-badge--accepted">${t('queue.early_accepted')}</span>`;
    } else if (item.early_request_status === 'declined') {
      earlyBadgeHtml = `<span class="queue-early-badge queue-early-badge--declined">${t('queue.early_declined')}</span>`;
    }

    // Delay info
    let delayInfoHtml = '';
    const uhrStr = getLanguage() === 'en' ? '' : ' Min.';
    if (item.status === 'delayed' && item.delay_minutes > 0) {
      delayInfoHtml = `
        <div class="queue-delay-info">
          ⏰ ${t('status.delayed')} um ${item.delay_minutes}${uhrStr}${item.delay_reason ? ` – ${item.delay_reason}` : ''}
        </div>
      `;
    }

    const timeSuffix = getLanguage() === 'en' ? '' : ' Uhr';
    let timeHtml = `${item.time}${timeSuffix}`;
    if (item.status === 'delayed' && item.delay_minutes > 0) {
      const newTime = adjustTime(item.time, item.delay_minutes);
      timeHtml = `<span style="text-decoration: line-through; color: #EF4444; margin-right: 6px;">${item.time}</span><span style="font-weight: 800; color: #EF4444;">${newTime}${timeSuffix}</span>`;
    } else if (item.early_request_status === 'accepted' && item.early_minutes > 0) {
      const newTime = adjustTime(item.time, -item.early_minutes);
      timeHtml = `<span style="text-decoration: line-through; color: #3B82F6; margin-right: 6px;">${item.time}</span><span style="font-weight: 800; color: #3B82F6;">${newTime}${timeSuffix}</span>`;
    }

    return `
      <div class="queue-card ${statusClass}" style="animation-delay: ${idx * 0.08}s" id="queue-card-${item.code}">
        <div class="queue-card-inner">
          <!-- Person Icon -->
          <div class="queue-person-icon ${personClass}">
            ${getPersonIcon(item.status)}
          </div>

          <!-- Patient Info -->
          <div class="queue-card-info">
            <div class="queue-card-name">${item.patient_vorname} ${item.patient_nachname}</div>
            ${item.patient_geburtsdatum ? `<div class="queue-card-birthday">🎂 ${item.patient_geburtsdatum}</div>` : ''}
            <div class="queue-card-time">
              🕐 ${timeHtml} · ${item.art || t('landing.your_appointment', 'Termin')} · ${item.duration} ${t('create_appt.min_abbr', 'Min.')}
            </div>
            ${delayInfoHtml}
            ${earlyBadgeHtml}
          </div>

          <!-- Status Badge + Actions -->
          <div class="queue-card-right">
            <span class="queue-status-badge queue-status-badge--${item.status}">
              ${getStatusIcon(item.status)} ${getStatusLabel(item.status)}
            </span>
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadQueue() {
  let user = auth.getUser();
  if (!user || !user.praxis_name) {
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.loggedIn && meData.user) {
        user = meData.user;
      }
    } catch (e) {}
  }

  const praxisName = user?.praxis_name || user?.praxisName;
  const container = document.getElementById('queue-cards-container');

  if (!praxisName) {
    if (container) {
      container.innerHTML = `
        <div class="queue-empty">
          <div class="queue-empty-icon">⚠️</div>
          <div class="queue-empty-text">Keine Praxis angemeldet</div>
          <div class="queue-empty-desc">Bitte melden Sie sich als Praxis an, um die Warteschlange zu sehen.</div>
        </div>
      `;
    }
    return;
  }

  try {
    const res = await fetch(`/api/queue/${encodeURIComponent(praxisName)}`);
    const data = await res.json();

    if (!container) return;

    if (!data.success) {
      container.innerHTML = `
        <div class="queue-empty">
          <div class="queue-empty-icon">⚠️</div>
          <div class="queue-empty-text">Fehler beim Laden der Warteschlange</div>
          <div class="queue-empty-desc">${data.error || 'Serverfehler'}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = renderQueueCards(data.queue || []);

    // Update stats
    const queue = data.queue || [];
    const waiting = queue.filter(q => q.status === 'waiting' || q.status === 'delayed').length;
    const active = queue.filter(q => q.status === 'in_treatment').length;
    const done = queue.filter(q => q.status === 'done').length;
    const total = queue.length;

    const statWaiting = document.getElementById('stat-waiting');
    const statActive = document.getElementById('stat-active');
    const statDone = document.getElementById('stat-done');
    const progressFill = document.getElementById('queue-progress-fill');

    if (statWaiting) statWaiting.textContent = waiting;
    if (statActive) statActive.textContent = active;
    if (statDone) statDone.textContent = done;
    if (progressFill) progressFill.style.width = total > 0 ? `${(done / total) * 100}%` : '0%';

    // Attach action listeners
    attachQueueActions();
  } catch (err) {
    console.error('Error loading queue:', err);
    if (container) {
      container.innerHTML = `
        <div class="queue-empty">
          <div class="queue-empty-icon">⚠️</div>
          <div class="queue-empty-text">Verbindungsfehler</div>
          <div class="queue-empty-desc">${err.message || 'Warteschlange konnte nicht geladen werden.'}</div>
        </div>
      `;
    }
  }
}

function attachQueueActions() {
  // Status update buttons (arrived, in_treatment, treatment_finished, done)
  document.querySelectorAll('[data-action="status-update"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const code = e.currentTarget.dataset.code;
      const targetStatus = e.currentTarget.dataset.targetStatus;
      btn.disabled = true;
      let originalHtml = btn.innerHTML;
      btn.innerHTML = '<div class="dl-auth-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:4px;"></div> Bitte warten...';
      try {
        const res = await fetch(`/api/queue/${code}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus })
        });
        if (!res.ok) {
          throw new Error('Fehler beim Aktualisieren des Status.');
        }
        await loadQueue();
      } catch (err) {
        console.error('Status update failed:', err);
        alert(err.message || 'Verbindung fehlgeschlagen.');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  });

  // Delay buttons
  document.querySelectorAll('[data-action="delay"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.currentTarget.dataset.code;
      const name = e.currentTarget.dataset.name;
      openDelayModal(code, name, async () => {
        await loadQueue();
      });
    });
  });

  // Early request buttons
  document.querySelectorAll('[data-action="early-request"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const code = e.currentTarget.dataset.code;
      const minutesStr = prompt('Wie viele Minuten früher kann der Patient voraussichtlich behandelt werden?', '15');
      if (minutesStr === null) return;
      const minutes = parseInt(minutesStr, 10);
      if (isNaN(minutes) || minutes <= 0) {
        alert('Bitte geben Sie eine gültige Minutenzahl größer als 0 ein.');
        return;
      }
      btn.disabled = true;
      btn.innerHTML = '<div class="dl-auth-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:4px;"></div> Wird gesendet...';
      try {
        await fetch(`/api/queue/${code}/early-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ early_minutes: minutes })
        });
        await loadQueue();
      } catch (err) {
        console.error('Early request failed:', err);
        btn.disabled = false;
        btn.textContent = '🕐 Frühere Behandlung beantragen';
      }
    });
  });

  // No-show buttons
  document.querySelectorAll('[data-action="no-show"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const code = e.currentTarget.dataset.code;
      if (!confirm('Möchten Sie diesen Patienten als "nicht erschienen" markieren? Der Termin wird aus der Warteschlange entfernt.')) {
        return;
      }
      btn.disabled = true;
      try {
        const res = await fetch(`/api/queue/${code}/no-show`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) {
          let data = {};
          try { data = await res.json(); } catch(e) {}
          throw new Error(data.error || 'Fehler beim Markieren des Nicht-Erscheinens.');
        }
        await loadQueue();
      } catch (err) {
        console.error('No-show failed:', err);
        alert(err.message || 'Verbindung fehlgeschlagen.');
        btn.disabled = false;
      }
    });
  });
}

function updateClock() {
  const el = document.getElementById('queue-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function initLiveQueueDoctorView() {
  initDlNav();

  // Back button
  document.getElementById('queue-back-btn')?.addEventListener('click', () => {
    navigate('praxis-dashboard');
  });

  // Start clock
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  // Initial load
  loadQueue();

  // Polling every 5 seconds
  _pollInterval = setInterval(() => {
    loadQueue();
  }, 5000);

  // Cleanup on view change
  const cleanup = () => {
    clearInterval(clockInterval);
    if (_pollInterval) clearInterval(_pollInterval);
    window.removeEventListener('viewChanged', cleanup);
  };
  window.addEventListener('viewChanged', cleanup);
}
