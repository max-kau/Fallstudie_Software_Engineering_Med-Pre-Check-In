import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

export function renderHeader(options = {}) {
  const { showSaveExit = true } = options;
  const termin = store.getTerminInfo();
  return `
    <header class="app-header">
      <div class="header-inner">
        <div class="header-brand">
          <div class="header-logo">D</div>
          <div>
            <div class="header-title">${termin.doctor}</div>
            <div class="header-subtitle">${t('header.demo')}</div>
          </div>
        </div>
        <div class="header-right" style="display: flex; align-items: center; gap: var(--space-3);">
          <div class="header-badge">
            <span>📅</span>
            <span style="white-space: nowrap;">${termin.date} · ${termin.time}</span>
          </div>
          ${showSaveExit ? `
          <button class="btn-exit-precheck" id="btn-exit-precheck" title="${t('header.save_exit')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span class="btn-exit-text">${t('header.save_exit')}</span>
          </button>
          ` : ''}
        </div>
      </div>
    </header>
  `;
}
