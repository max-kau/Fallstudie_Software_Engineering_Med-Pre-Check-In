import { store } from '../utils/store.js';

export function renderHeader() {
  const termin = store.getTerminInfo();
  return `
    <header class="app-header">
      <div class="header-inner">
        <div class="header-brand">
          <div class="header-logo">D</div>
          <div>
            <div class="header-title">${termin.doctor}</div>
            <div class="header-subtitle">Pre-Check-In (Demo-Simulation)</div>
          </div>
        </div>
        <div class="header-right" style="display: flex; align-items: center; gap: var(--space-3);">
          <div class="header-badge">
            <span>📅</span> ${termin.date} · ${termin.time}
          </div>
          <button class="btn-exit-precheck" id="btn-exit-precheck" title="Speichern & Verlassen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span class="btn-exit-text">Speichern & Verlassen</span>
          </button>
        </div>
      </div>
    </header>
  `;
}
