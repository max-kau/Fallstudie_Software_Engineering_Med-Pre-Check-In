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
            <div class="header-subtitle">Pre-Check-In</div>
          </div>
        </div>
        <div class="header-badge">
          <span>📅</span> ${termin.date} · ${termin.time}
        </div>
      </div>
    </header>
  `;
}
