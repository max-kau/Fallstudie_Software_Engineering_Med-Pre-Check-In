/**
 * LiveQueuePatientView – Patienten-Ansicht der Live-Warteschlange
 * Shows today's queue for the patient's praxis with their own position highlighted.
 * Includes early treatment request accept/decline functionality.
 */
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

let _pollInterval = null;

function getGermanDateToday() {
  const now = new Date();
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
    case 'waiting': return 'Wartend';
    case 'arrived': return 'Eingetroffen';
    case 'in_treatment': return 'In Behandlung';
    case 'treatment_finished': return 'Behandlung beendet';
    case 'done': return 'Abgeschlossen';
    case 'delayed': return 'Verzögert';
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

function getPraxisNameFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/praxis=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function renderLiveQueuePatientView() {
  const praxisName = getPraxisNameFromHash() || 'Arztpraxis';

  return `
    ${renderDlNav()}
    <div class="dl-page live-queue-page">
      <div class="live-queue-container">
        <!-- Back Button -->
        <button class="queue-back-btn" id="queue-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Zurück zu meinen Terminen
        </button>

        <!-- Header -->
        <div class="live-queue-header">
          <div class="live-queue-header-left">
            <h1 class="live-queue-title">
              📋 Warteschlange
              <span class="live-indicator">
                <span class="live-indicator-dot"></span>
                LIVE
              </span>
            </h1>
            <p class="live-queue-subtitle" id="queue-praxis-name">${praxisName} – Heutige Termine</p>
          </div>
          <div class="live-queue-header-right">
            <div class="live-queue-clock" id="queue-clock">--:--:--</div>
            <div class="live-queue-date">${getGermanDateToday()}</div>
          </div>
        </div>

        <!-- Own Position Display -->
        <div id="queue-own-position-container"></div>

        <!-- Early Request Banner -->
        <div id="queue-early-request-container"></div>

        <!-- Progress Bar -->
        <div class="queue-progress-bar">
          <div class="queue-progress-fill" id="queue-progress-fill" style="width: 0%"></div>
        </div>

        <!-- Queue Cards Container -->
        <div id="queue-cards-container">
          <div style="text-align: center; padding: var(--space-8) 0;">
            <div class="dl-auth-spinner" style="display: inline-block; width: 40px; height: 40px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-4); font-size: var(--font-size-sm);">Warteschlange wird geladen...</p>
          </div>
        </div>

        <!-- Refresh Indicator -->
        <div class="queue-refresh-indicator">
          <span class="queue-refresh-dot"></span>
          Automatische Aktualisierung alle 5 Sekunden
        </div>
      </div>
    </div>
  `;
}

function renderOwnPosition(queue) {
  const own = queue.find(q => q.is_own);
  if (!own) return '';

  if (own.status === 'in_treatment') {
    return `
      <div class="queue-own-position" style="border-color: var(--primary); background: linear-gradient(135deg, #DBEAFE, #EBF5FF);">
        <div class="queue-own-position-number" style="color: var(--primary);">🩺</div>
        <div class="queue-own-position-label" style="font-size: var(--font-size-lg); font-weight: 800; color: var(--primary);">Sie werden gerade behandelt!</div>
      </div>
    `;
  }

  if (own.status === 'done') {
    return `
      <div class="queue-own-position" style="border-color: var(--success); background: linear-gradient(135deg, #D1FAE5, #ECFDF5);">
        <div class="queue-own-position-number" style="color: var(--success);">✅</div>
        <div class="queue-own-position-label" style="font-size: var(--font-size-lg); font-weight: 800; color: var(--success);">Ihre Behandlung ist abgeschlossen!</div>
      </div>
    `;
  }

  // Calculate waiting position (only count waiting/delayed entries before this one)
  const waitingBefore = queue.filter(q => {
    if (q.code === own.code) return false;
    const ownIdx = queue.indexOf(own);
    const qIdx = queue.indexOf(q);
    return qIdx < ownIdx && (q.status === 'waiting' || q.status === 'delayed' || q.status === 'in_treatment');
  }).length;

  const position = waitingBefore + 1;

  // Estimate wait time based on backend dynamic calculation per appointment type
  const estimatedWait = own.estimated_wait_minutes !== undefined ? own.estimated_wait_minutes : (waitingBefore * 20);

  let delayNote = '';
  if (own.status === 'delayed' && own.delay_minutes > 0) {
    delayNote = `
      <div class="queue-delay-info" style="display: inline-flex; margin-top: var(--space-3);">
        ⏰ Ihr Termin wurde um ${own.delay_minutes} Min. verzögert${own.delay_reason ? `: ${own.delay_reason}` : ''}
      </div>
    `;
  }

  return `
    <div class="queue-own-position">
      <div class="queue-own-position-number">${position}</div>
      <div class="queue-own-position-label">Ihre Position in der Warteschlange</div>
      ${estimatedWait > 0 ? `
        <div class="queue-wait-estimate">
          ⏱️ Voraussichtliche Wartezeit: ca. <strong>${estimatedWait} Minuten</strong> (berechnet aus den Behandlungsarten der ${waitingBefore} Patient${waitingBefore > 1 ? 'en' : ''} vor Ihnen)
        </div>
      ` : `
        <div class="queue-wait-estimate" style="color: var(--success);">
          🎉 Sie sind als nächstes dran!
        </div>
      `}
      ${delayNote}
    </div>
  `;
}

function renderEarlyRequestBanner(queue) {
  const own = queue.find(q => q.is_own && q.early_request_status === 'pending');
  if (!own) return '';

  return `
    <div class="early-request-banner">
      <div class="early-request-banner-title">
        🕐 Frühere Behandlung möglich!
      </div>
      <div class="early-request-banner-desc">
        Ihre Praxis hat Ihnen angeboten, Ihren Termin voraussichtlich um ca. <strong>${own.early_minutes || 15} Minuten früher</strong> wahrzunehmen. 
        Möchten Sie die frühere Behandlung annehmen?
      </div>
      <div class="early-request-actions">
        <button class="queue-btn queue-btn--early-accept" data-code="${own.code}" data-early-response="accept">
          ✅ Annehmen – Ich komme früher!
        </button>
        <button class="queue-btn queue-btn--early-decline" data-code="${own.code}" data-early-response="decline">
          ❌ Ablehnen – Ich komme zur geplanten Zeit
        </button>
      </div>
    </div>
  `;
}

function renderPatientQueueCards(queue) {
  if (!queue || queue.length === 0) {
    return `
      <div class="queue-empty">
        <div class="queue-empty-icon">📋</div>
        <div class="queue-empty-text">Keine Termine heute</div>
        <div class="queue-empty-desc">Es sind heute keine Termine in der Warteschlange.</div>
      </div>
    `;
  }

  const own = queue.find(q => q.is_own);
  const ownIdx = own ? queue.indexOf(own) : -1;

  return queue.map((item, idx) => {
    const statusClass = `queue-card--${item.status}`;
    const personClass = `queue-person-icon--${item.status}`;
    const ownClass = item.is_own ? 'queue-card--own' : '';

    let nameHtml = '';
    if (item.is_own) {
      nameHtml = `${item.patient_vorname} ${item.patient_nachname} <span style="font-size: var(--font-size-xs); background: var(--primary); color: white; padding: 2px 8px; border-radius: var(--radius-full); font-weight: 700; vertical-align: middle;">SIE</span>`;
    } else {
      if (ownIdx !== -1) {
        if (idx < ownIdx) {
          nameHtml = `Patient/-in (vor Ihnen)`;
        } else {
          nameHtml = `Patient/-in (nach Ihnen)`;
        }
      } else {
        nameHtml = `Patient/-in`;
      }
    }

    let timeHtml = `${item.time} Uhr`;
    if (item.status === 'delayed' && item.delay_minutes > 0) {
      const newTime = adjustTime(item.time, item.delay_minutes);
      timeHtml = `<span style="text-decoration: line-through; color: #EF4444; margin-right: 6px;">${item.time}</span><span style="font-weight: 800; color: #EF4444;">${newTime} Uhr</span>`;
    } else if (item.early_request_status === 'accepted' && item.early_minutes > 0) {
      const newTime = adjustTime(item.time, -item.early_minutes);
      timeHtml = `<span style="text-decoration: line-through; color: #3B82F6; margin-right: 6px;">${item.time}</span><span style="font-weight: 800; color: #3B82F6;">${newTime} Uhr</span>`;
    }

    return `
      <div class="queue-card ${statusClass} ${ownClass}" style="animation-delay: ${idx * 0.08}s">
        <div class="queue-card-inner">
          <!-- Person Icon -->
          <div class="queue-person-icon ${personClass}">
            ${getPersonIcon(item.status)}
          </div>

          <!-- Patient Info -->
          <div class="queue-card-info">
            <div class="queue-card-name">
              ${nameHtml}
            </div>
            ${item.is_own && item.patient_geburtsdatum ? `<div class="queue-card-birthday">🎂 ${item.patient_geburtsdatum}</div>` : ''}
            <div class="queue-card-time">
              🕐 ${timeHtml}
            </div>
            ${item.status === 'delayed' && item.delay_minutes > 0 ? `
              <div class="queue-delay-info">
                ⏰ Verzögert um ${item.delay_minutes} Min.
              </div>
            ` : ''}
          </div>

          <!-- Status Badge -->
          <div class="queue-card-right">
            <span class="queue-status-badge queue-status-badge--${item.status}">
              ${getStatusIcon(item.status)} ${getStatusLabel(item.status)}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadPatientQueue() {
  const praxisName = getPraxisNameFromHash();
  if (!praxisName) return;

  try {
    const res = await fetch(`/api/queue/${encodeURIComponent(praxisName)}`);
    const data = await res.json();

    if (!data.success) return;

    // Update own position
    const ownPosContainer = document.getElementById('queue-own-position-container');
    if (ownPosContainer) {
      ownPosContainer.innerHTML = renderOwnPosition(data.queue);
    }

    // Update early request banner
    const earlyContainer = document.getElementById('queue-early-request-container');
    if (earlyContainer) {
      earlyContainer.innerHTML = renderEarlyRequestBanner(data.queue);
      // Attach early response listeners
      earlyContainer.querySelectorAll('[data-early-response]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const code = e.currentTarget.dataset.code;
          const response = e.currentTarget.dataset.earlyResponse;
          btn.disabled = true;

          try {
            await fetch(`/api/queue/${code}/early-response`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accepted: response === 'accept' })
            });
            await loadPatientQueue();
          } catch (err) {
            console.error('Early response failed:', err);
            btn.disabled = false;
          }
        });
      });
    }

    // Update cards
    const container = document.getElementById('queue-cards-container');
    if (container) {
      container.innerHTML = renderPatientQueueCards(data.queue);
    }

    // Update progress
    const done = data.queue.filter(q => q.status === 'done').length;
    const total = data.queue.length;
    const progressFill = document.getElementById('queue-progress-fill');
    if (progressFill) progressFill.style.width = total > 0 ? `${(done / total) * 100}%` : '0%';

  } catch (err) {
    console.error('Error loading patient queue:', err);
  }
}

function updateClock() {
  const el = document.getElementById('queue-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function initLiveQueuePatientView() {
  initDlNav();

  // Back button
  document.getElementById('queue-back-btn')?.addEventListener('click', () => {
    navigate('landing');
  });

  // Start clock
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  // Initial load
  loadPatientQueue();

  // Polling every 5 seconds
  _pollInterval = setInterval(() => {
    loadPatientQueue();
  }, 5000);

  // Cleanup on view change
  const cleanup = () => {
    clearInterval(clockInterval);
    if (_pollInterval) clearInterval(_pollInterval);
    window.removeEventListener('viewChanged', cleanup);
  };
  window.addEventListener('viewChanged', cleanup);
}
