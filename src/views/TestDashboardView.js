import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { t, getLanguage } from '../utils/i18n.js';

export function renderTestDashboardView() {
  const user = auth.getUser();
  const userName = user ? `${user.vorname || ''} ${user.nachname || ''}`.trim() : 'Admin';
  const lang = getLanguage();

  return `
    ${renderDlNav()}

    <div class="dl-admin-dashboard-wrapper fade-in-up" style="min-height: calc(100vh - 64px); background: var(--surface); display: flex; flex-direction: column;">
      
      <!-- Admin Control Header Banner -->
      <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: white; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 14px rgba(0,0,0,0.12); flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="background: linear-gradient(135deg, #107ACA 0%, #3B82F6 100%); width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; box-shadow: 0 2px 8px rgba(16,122,202,0.4);">
            🛡️
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em;">${t('test.admin_banner')}</span>
              <span style="background: rgba(16, 185, 129, 0.2); color: #34D399; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid rgba(52, 211, 153, 0.3);">
                Admin Mode
              </span>
            </div>
            <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 2px;">
              Logged in as <strong>${userName}</strong> · Vitest & Playwright E2E Test Engine
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <a href="http://localhost:3030" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.08); color: #E2E8F0; border: 1px solid rgba(255,255,255,0.2); font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; transition: all 0.2s ease;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            ${t('test.open_tab')}
          </a>
          <button id="btn-refresh-iframe" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); font-size: 0.8rem; cursor: pointer; padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            ${t('test.reload')}
          </button>
        </div>
      </div>

      <!-- Test Dashboard Embedded Frame -->
      <div style="flex-grow: 1; position: relative; width: 100%; min-height: calc(100vh - 130px);">
        <iframe 
          id="test-dashboard-frame" 
          src="/test-dashboard.html?lang=${lang}" 
          style="width: 100%; height: 100%; min-height: calc(100vh - 130px); border: none; display: block; background: var(--surface);"
          title="Med-Pre-Check-In Interactive Test Dashboard"
        ></iframe>
      </div>
    </div>
  `;
}

export function initTestDashboardView() {
  initDlNav();

  const refreshBtn = document.getElementById('btn-refresh-iframe');
  const frame = document.getElementById('test-dashboard-frame');
  if (refreshBtn && frame) {
    refreshBtn.addEventListener('click', () => {
      frame.src = frame.src;
    });
  }
}
