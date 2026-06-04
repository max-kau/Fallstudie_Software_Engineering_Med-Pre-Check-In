import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';

export function renderPraxisDashboardView() {
  const user = auth.getUser() || {};

  return `
    ${renderDlNav()}

    <div class="dl-page" style="background: var(--bg-gray); min-height: 100vh;">
      <div class="dl-page-inner" style="padding-bottom: var(--space-12);">
        
        <!-- Praxis Header -->
        <div class="landing-header fade-in-up" style="margin-bottom: var(--space-6);">
          <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-3);">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-xl); background: linear-gradient(135deg, var(--primary), #004f98); display: flex; align-items: center; justify-content: center; color: white; font-size: var(--font-size-xl); font-weight: 700; flex-shrink: 0;">
              ${(user.praxis_name || 'P')[0]}
            </div>
            <div>
              <span style="font-weight: 700; font-size: var(--font-size-xs); color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Praxis-Dashboard</span>
              <h1 style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--gray-800); letter-spacing: -0.02em; margin: 0;">${user.praxis_name || 'Meine Praxis'}</h1>
            </div>
          </div>
          <p class="text-muted" style="font-size: var(--font-size-sm);">${user.praxis_fachbereich || ''} ${user.praxis_adresse ? '· ' + user.praxis_adresse : ''}</p>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: var(--space-4); border-bottom: 2px solid var(--gray-200); margin-bottom: var(--space-8); padding-bottom: 1px;">
          <button id="tab-dashboard-termine" class="dashboard-tab active" style="background: none; border: none; font-size: var(--font-size-md); font-weight: 700; color: var(--primary); border-bottom: 3px solid var(--primary); padding: var(--space-2) var(--space-4); cursor: pointer; transition: all 0.15s; margin-bottom: -3px;">
            📅 Termine & Statistik
          </button>
          <button id="tab-dashboard-gestaltung" class="dashboard-tab" style="background: none; border: none; font-size: var(--font-size-md); font-weight: 600; color: var(--gray-500); border-bottom: 3px solid transparent; padding: var(--space-2) var(--space-4); cursor: pointer; transition: all 0.15s; margin-bottom: -3px;">
            🎨 Pre-Check-In gestalten
          </button>
        </div>

        <!-- Tab Content: Dashboard & Termine -->
        <div id="tab-content-termine" class="dashboard-tab-content">
          <!-- Stats Cards -->
          <div id="praxis-stats-container" style="margin-bottom: var(--space-8);">
            <div style="text-align: center; padding: var(--space-8) 0;">
              <div class="dl-auth-spinner" style="display: inline-block; width: 32px; height: 32px; border-width: 3px;"></div>
              <p class="text-muted" style="margin-top: var(--space-3); font-size: var(--font-size-sm);">Statistiken werden geladen...</p>
            </div>
          </div>

          <!-- Appointments Table -->
          <div id="praxis-termine-container">
            <div style="text-align: center; padding: var(--space-8) 0;">
              <div class="dl-auth-spinner" style="display: inline-block; width: 32px; height: 32px; border-width: 3px;"></div>
              <p class="text-muted" style="margin-top: var(--space-3); font-size: var(--font-size-sm);">Termine werden geladen...</p>
            </div>
          </div>
        </div>

        <!-- Tab Content: Gestaltung -->
        <div id="tab-content-gestaltung" class="dashboard-tab-content" style="display: none;">
          <div class="dl-profile-card fade-in-up" style="background: white; border-radius: var(--radius-xl); padding: var(--space-6); border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm); margin-bottom: var(--space-6);">
            <h2 style="font-size: var(--font-size-lg); font-weight: 800; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 8px;">🎨 Eigenen Fragebogen gestalten</h2>
            <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4); line-height: 1.5;">
              Fügen Sie hier eigene Fragen hinzu, die Patienten beim Ausfüllen des Pre-Check-Ins für Ihre Praxis beantworten müssen. 
              Sie können Freitextfragen, Einzelauswahl oder Mehrfachauswahl-Fragen erstellen.
            </p>
            
            <div id="questions-list-container" style="margin-top: var(--space-4);">
              <!-- Questions will be dynamically loaded here -->
            </div>

            <div style="display: flex; gap: var(--space-3); margin-top: var(--space-6); flex-wrap: wrap;">
              <button id="btn-add-question" type="button" class="btn" style="background: var(--primary-lightest); color: var(--primary); border: 1px dashed var(--primary); padding: var(--space-3) var(--space-5); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s;">
                ➕ Neue Frage hinzufügen
              </button>
              <button id="btn-save-questions" type="button" class="btn btn-primary" style="padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                💾 Fragebogen speichern
              </button>
            </div>
            <div id="questions-status-message" style="margin-top: var(--space-4); font-size: var(--font-size-sm); font-weight: 600; display: none;"></div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderStatsCards(stats) {
  const cards = [
    { label: 'Termine gesamt', value: stats.totalTermine, icon: '📅', color: '#0063BE', bg: '#EBF5FF' },
    { label: 'Pre-Checks abgeschlossen', value: stats.prechecksCompleted, icon: '✅', color: '#059669', bg: '#ECFDF5' },
    { label: 'Pre-Checks offen', value: stats.prechecksOpen, icon: '⏳', color: '#D97706', bg: '#FFFBEB' },
    { label: 'Patienten', value: stats.uniquePatients, icon: '👥', color: '#7C3AED', bg: '#F5F3FF' },
  ];

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">
      ${cards.map((c, i) => `
        <div class="fade-in-up" style="animation-delay: ${i * 0.08}s; background: white; border-radius: var(--radius-xl); padding: var(--space-5); border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-lg); background: ${c.bg}; display: flex; align-items: center; justify-content: center; font-size: var(--font-size-lg);">${c.icon}</div>
            <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.04em;">${c.label}</span>
          </div>
          <div style="font-size: var(--font-size-3xl); font-weight: 800; color: ${c.color}; letter-spacing: -0.02em;">${c.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTermineTable(termine) {
  if (termine.length === 0) {
    return `
      <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-10) var(--space-6); background: white; border-radius: var(--radius-xl); border: 1px dashed var(--gray-300);">
        <div style="font-size: var(--font-size-4xl); margin-bottom: var(--space-4);">📋</div>
        <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2);">Keine Termine vorhanden</h3>
        <p class="text-muted" style="max-width: 420px; margin: 0 auto; font-size: var(--font-size-sm); line-height: 1.5;">
          Sobald Patienten Termine bei Ihrer Praxis buchen, erscheinen diese hier.
        </p>
      </div>
    `;
  }

  return `
    <div class="fade-in-up" style="background: white; border-radius: var(--radius-xl); border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm); overflow: hidden;">
      <div style="padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin: 0;">Terminübersicht</h2>
        <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-400); text-transform: uppercase;">${termine.length} Termin${termine.length !== 1 ? 'e' : ''}</span>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
          <thead>
            <tr style="background: var(--bg-gray); border-bottom: 2px solid var(--gray-200);">
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Patient</th>
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Datum</th>
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Uhrzeit</th>
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Art</th>
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Pre-Check</th>
              <th style="padding: var(--space-3) var(--space-4); text-align: center; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${termine.map((t, i) => {
              const patientName = `${t.patient_vorname || '–'} ${t.patient_nachname || ''}`.trim();
              const statusHtml = t.precheck_submitted
                ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: #ECFDF5; color: #059669; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">✓ Abgeschlossen</span>`
                : t.precheck_step && t.precheck_step !== 'intro'
                  ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: #FFFBEB; color: #D97706; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">⏳ In Bearbeitung</span>`
                  : `<span style="display: inline-flex; align-items: center; gap: 4px; background: var(--gray-100); color: var(--gray-500); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">– Ausstehend</span>`;

              return `
                <tr style="border-bottom: 1px solid var(--gray-100); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-gray)'" onmouseout="this.style.background='white'">
                  <td style="padding: var(--space-3) var(--space-4); font-weight: 600; color: var(--gray-800);">${patientName}</td>
                  <td style="padding: var(--space-3) var(--space-4); color: var(--gray-600);">${t.date}</td>
                  <td style="padding: var(--space-3) var(--space-4); color: var(--gray-600);">${t.time} Uhr</td>
                  <td style="padding: var(--space-3) var(--space-4); color: var(--gray-600);">${t.art}</td>
                  <td style="padding: var(--space-3) var(--space-4);">${statusHtml}</td>
                  <td style="padding: var(--space-3) var(--space-4); text-align: center;">
                    ${t.precheck_submitted ? `<button class="btn-view-precheck" data-index="${i}" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 4px 12px; border-radius: var(--radius-md); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;">Einsehen</button>` : `<span style="color: var(--gray-300);">–</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderQuestions(questions) {
  if (questions.length === 0) {
    return `
      <div style="text-align: center; padding: var(--space-8); border: 1px dashed var(--gray-300); border-radius: var(--radius-xl); background: var(--bg-gray);">
        <div style="font-size: var(--font-size-3xl); margin-bottom: var(--space-2);">📝</div>
        <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">Noch keine spezifischen Fragen hinzugefügt. Klicken Sie auf "Neue Frage hinzufügen" oben.</p>
      </div>
    `;
  }

  return questions.map((q, idx) => {
    const isText = q.question_type === 'text';
    const optionsVal = Array.isArray(q.options) ? q.options.join(', ') : (q.options || '');
    return `
      <div class="dl-question-card fade-in-up" data-index="${idx}" style="background: var(--bg-gray); border-radius: var(--radius-xl); border: 1px solid var(--gray-200); padding: var(--space-5); margin-bottom: var(--space-4); position: relative; display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--gray-200); padding-bottom: var(--space-2);">
          <span style="font-weight: 700; font-size: var(--font-size-sm); color: var(--primary);">Frage #${idx + 1}</span>
          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <button type="button" class="btn-move-up" data-index="${idx}" style="background: white; border: 1px solid var(--gray-300); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: var(--gray-600); font-weight: 700;" ${idx === 0 ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>▲</button>
            <button type="button" class="btn-move-down" data-index="${idx}" style="background: white; border: 1px solid var(--gray-300); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: var(--gray-600); font-weight: 700;" ${idx === questions.length - 1 ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>▼</button>
            <button type="button" class="btn-delete-question" data-index="${idx}" style="background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: #DC2626; font-weight: 700; display: inline-flex; align-items: center; gap: 2px; margin-left: 8px;">🗑️ Löschen</button>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
          <div>
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Frage / Titel</label>
            <input type="text" class="question-text-input" data-index="${idx}" value="${q.question_text || ''}" placeholder="Z.B.: Bitte beschreiben Sie Ihre Symptome genauer." style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
          </div>
          <div>
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Antwort-Typ</label>
            <select class="question-type-select" data-index="${idx}" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; cursor: pointer;">
              <option value="text" ${q.question_type === 'text' ? 'selected' : ''}>Freitext (Textfeld)</option>
              <option value="single" ${q.question_type === 'single' ? 'selected' : ''}>Einzelauswahl (Radio-Buttons)</option>
              <option value="multiple" ${q.question_type === 'multiple' ? 'selected' : ''}>Mehrfachauswahl (Checkboxen)</option>
            </select>
          </div>
        </div>

        <div class="options-container" style="display: ${isText ? 'none' : 'block'};">
          <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Antwortmöglichkeiten (Komma-separiert)</label>
          <input type="text" class="question-options-input" data-index="${idx}" value="${optionsVal}" placeholder="Z.B.: Ja, Nein, Unsicher" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
          <span style="font-size: 10px; color: var(--gray-400); margin-top: 4px; display: block;">Geben Sie die Optionen durch Kommata getrennt ein.</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="question-required-checkbox" data-index="${idx}" id="req-${idx}" ${q.required ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;">
          <label for="req-${idx}" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--gray-600); cursor: pointer; user-select: none;">Antwort ist verpflichtend (Pflichtfeld)</label>
        </div>
      </div>
    `;
  }).join('');
}

function renderPrecheckModal(termin) {
  const b = termin.beschwerden ? (typeof termin.beschwerden === 'string' ? JSON.parse(termin.beschwerden) : termin.beschwerden) : {};
  const m = termin.medikamente ? (typeof termin.medikamente === 'string' ? JSON.parse(termin.medikamente) : termin.medikamente) : {};
  const a = termin.allergien ? (typeof termin.allergien === 'string' ? JSON.parse(termin.allergien) : termin.allergien) : {};
  const customAnswers = termin.custom_answers ? (typeof termin.custom_answers === 'string' ? JSON.parse(termin.custom_answers) : termin.custom_answers) : {};
  const hasCustomAnswers = Object.keys(customAnswers).length > 0;

  const patientName = `${termin.patient_vorname || ''} ${termin.patient_nachname || ''}`.trim() || 'Patient';
  const symptoms = (b.chips || []).join(', ') || 'Keine Angabe';
  const freitext = b.freitext || 'Keine Beschreibung';
  const staerke = b.staerke != null ? `${b.staerke} / 10` : 'Keine Angabe';
  const meds = m.keine ? 'Keine Medikamente' : (m.liste || []).join(', ') || 'Keine Angabe';
  const allergien = a.keine ? 'Keine Allergien' : (a.liste || []).join(', ') || 'Keine Angabe';
  const allerAnm = a.anmerkungen || '';

  return `
    <div class="dl-modal-backdrop" id="precheck-modal">
      <div class="dl-modal-card fade-in-up" style="max-width: 600px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">Pre-Check-In: ${patientName}</h3>
          <button class="dl-modal-close" id="btn-close-precheck">&times;</button>
        </div>
        <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
          <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-5);">
            Termin: ${termin.date} um ${termin.time} Uhr · ${termin.art}
          </p>

          <div style="display: flex; flex-direction: column; gap: var(--space-5);">
            <!-- Beschwerden -->
            <div>
              <h4 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 6px;">🩺 Beschwerden</h4>
              <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); font-size: var(--font-size-sm); color: var(--gray-700); line-height: 1.6;">
                <div><strong>Symptome:</strong> ${symptoms}</div>
                <div style="margin-top: var(--space-2);"><strong>Beschreibung:</strong> ${freitext}</div>
                <div style="margin-top: var(--space-2);"><strong>Schmerzstärke:</strong> ${staerke}</div>
              </div>
            </div>

            <!-- Medikamente -->
            <div>
              <h4 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 6px;">💊 Medikamente</h4>
              <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); font-size: var(--font-size-sm); color: var(--gray-700);">
                ${meds}
              </div>
            </div>

            <!-- Allergien -->
            <div>
              <h4 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 6px;">⚠️ Allergien</h4>
              <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); font-size: var(--font-size-sm); color: var(--gray-700);">
                ${allergien}${allerAnm ? `<div style="margin-top: var(--space-2);"><strong>Anmerkungen:</strong> ${allerAnm}</div>` : ''}
              </div>
            </div>

            <!-- Zusatzfragen -->
            ${hasCustomAnswers ? `
            <div>
              <h4 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 6px;">📋 Praxis-Zusatzfragen</h4>
              <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); font-size: var(--font-size-sm); color: var(--gray-700); display: flex; flex-direction: column; gap: var(--space-3);">
                ${Object.entries(customAnswers).map(([qText, qAns]) => {
                  const ansText = Array.isArray(qAns) ? qAns.join(', ') : (qAns || 'Keine Antwort');
                  return `
                    <div>
                      <strong style="display: block; color: var(--gray-600); font-size: 11px; text-transform: uppercase;">${qText}</strong>
                      <span style="color: var(--gray-800); font-weight: 600;">${ansText}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            ` : ''}

          </div>
        </div>
        <div class="dl-modal-footer" style="flex-shrink: 0;">
          <button type="button" class="btn btn-primary" id="btn-close-precheck-footer" style="padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Schließen</button>
        </div>
      </div>
    </div>
  `;
}

export async function initPraxisDashboardView() {
  initDlNav();

  const tabTermineBtn = document.getElementById('tab-dashboard-termine');
  const tabGestaltungBtn = document.getElementById('tab-dashboard-gestaltung');
  const contentTermine = document.getElementById('tab-content-termine');
  const contentGestaltung = document.getElementById('tab-content-gestaltung');

  tabTermineBtn?.addEventListener('click', () => {
    tabTermineBtn.classList.add('active');
    tabTermineBtn.style.color = 'var(--primary)';
    tabTermineBtn.style.borderBottomColor = 'var(--primary)';
    
    tabGestaltungBtn.classList.remove('active');
    tabGestaltungBtn.style.color = 'var(--gray-500)';
    tabGestaltungBtn.style.borderBottomColor = 'transparent';
    
    contentTermine.style.display = 'block';
    contentGestaltung.style.display = 'none';
  });

  tabGestaltungBtn?.addEventListener('click', () => {
    tabGestaltungBtn.classList.add('active');
    tabGestaltungBtn.style.color = 'var(--primary)';
    tabGestaltungBtn.style.borderBottomColor = 'var(--primary)';
    
    tabTermineBtn.classList.remove('active');
    tabTermineBtn.style.color = 'var(--gray-500)';
    tabTermineBtn.style.borderBottomColor = 'transparent';
    
    contentTermine.style.display = 'none';
    contentGestaltung.style.display = 'block';
  });

  const statsContainer = document.getElementById('praxis-stats-container');
  const termineContainer = document.getElementById('praxis-termine-container');

  let termineData = [];

  // Load stats
  try {
    const statsRes = await fetch('/api/praxis/stats');
    const statsData = await statsRes.json();
    if (statsData.success) {
      statsContainer.innerHTML = renderStatsCards(statsData.stats);
    }
  } catch (err) {
    statsContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Statistiken konnten nicht geladen werden.</p>';
  }

  // Load appointments
  try {
    const termineRes = await fetch('/api/praxis/termine');
    const data = await termineRes.json();
    if (data.success) {
      termineData = data.termine || [];
      termineContainer.innerHTML = renderTermineTable(termineData);

      // Attach click handlers for "Einsehen" buttons
      termineContainer.querySelectorAll('.btn-view-precheck').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index);
          const termin = termineData[idx];
          if (!termin) return;

          document.getElementById('precheck-modal')?.remove();
          document.body.insertAdjacentHTML('beforeend', renderPrecheckModal(termin));

          const modal = document.getElementById('precheck-modal');
          const closeModal = () => modal?.remove();
          document.getElementById('btn-close-precheck')?.addEventListener('click', closeModal);
          document.getElementById('btn-close-precheck-footer')?.addEventListener('click', closeModal);
          modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        });
      });
    }
  } catch (err) {
    termineContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Termine konnten nicht geladen werden.</p>';
  }

  // Questionnaire Builder Logic
  let questions = [];
  const questionsListContainer = document.getElementById('questions-list-container');
  const statusMessage = document.getElementById('questions-status-message');

  const updateQuestionsUI = () => {
    if (questionsListContainer) {
      questionsListContainer.innerHTML = renderQuestions(questions);
      attachQuestionsListeners();
    }
  };

  const attachQuestionsListeners = () => {
    // Text changes
    questionsListContainer.querySelectorAll('.question-text-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        questions[idx].question_text = e.target.value;
      });
    });

    // Type change
    questionsListContainer.querySelectorAll('.question-type-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        questions[idx].question_type = e.target.value;
        // Show/hide options container
        const optionsDiv = e.target.closest('.dl-question-card').querySelector('.options-container');
        if (optionsDiv) {
          optionsDiv.style.display = e.target.value === 'text' ? 'none' : 'block';
        }
      });
    });

    // Options text changes
    questionsListContainer.querySelectorAll('.question-options-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        questions[idx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      });
    });

    // Required changes
    questionsListContainer.querySelectorAll('.question-required-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        questions[idx].required = e.target.checked;
      });
    });

    // Move Up
    questionsListContainer.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        if (idx > 0) {
          const temp = questions[idx];
          questions[idx] = questions[idx - 1];
          questions[idx - 1] = temp;
          updateQuestionsUI();
        }
      });
    });

    // Move Down
    questionsListContainer.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        if (idx < questions.length - 1) {
          const temp = questions[idx];
          questions[idx] = questions[idx + 1];
          questions[idx + 1] = temp;
          updateQuestionsUI();
        }
      });
    });

    // Delete
    questionsListContainer.querySelectorAll('.btn-delete-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        questions.splice(idx, 1);
        updateQuestionsUI();
      });
    });
  };

  // Fetch initial questions
  try {
    const qRes = await fetch('/api/praxis/questions');
    const qData = await qRes.json();
    if (qData.success) {
      questions = qData.questions || [];
      updateQuestionsUI();
    }
  } catch (err) {
    console.error('Failed to load questions:', err);
  }

  // Add question button
  document.getElementById('btn-add-question')?.addEventListener('click', () => {
    questions.push({
      question_text: '',
      question_type: 'text',
      options: [],
      required: false
    });
    updateQuestionsUI();
  });

  // Save questions button
  document.getElementById('btn-save-questions')?.addEventListener('click', async () => {
    if (statusMessage) {
      statusMessage.style.display = 'block';
      statusMessage.style.color = 'var(--gray-600)';
      statusMessage.textContent = 'Speichert...';
    }
    try {
      const res = await fetch('/api/praxis/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions })
      });
      const data = await res.json();
      if (data.success) {
        statusMessage.style.color = 'var(--green-600)';
        statusMessage.textContent = '✓ Fragebogen erfolgreich gespeichert!';
        setTimeout(() => { statusMessage.style.display = 'none'; }, 3000);
      } else {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      statusMessage.style.color = 'var(--red-600)';
      statusMessage.textContent = '❌ Fehler beim Speichern: ' + err.message;
    }
  });
}
