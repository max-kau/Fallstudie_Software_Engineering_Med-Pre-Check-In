import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { renderCalendarView, initCalendarView } from '../components/CalendarView.js';
import { openPatientDetailModal } from '../components/PatientDetailModal.js';

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

        <!-- Navigation Tabs (3 tabs: Kalender, Statistik, Gestaltung) -->
        <div style="display: flex; gap: var(--space-4); border-bottom: 2px solid var(--gray-200); margin-bottom: var(--space-8); padding-bottom: 1px;">
          <button id="tab-dashboard-kalender" class="dashboard-tab active" style="background: none; border: none; font-size: var(--font-size-md); font-weight: 700; color: var(--primary); border-bottom: 3px solid var(--primary); padding: var(--space-2) var(--space-4); cursor: pointer; transition: all 0.15s; margin-bottom: -3px;">
            📅 Kalender
          </button>
          <button id="tab-dashboard-termine" class="dashboard-tab" style="background: none; border: none; font-size: var(--font-size-md); font-weight: 600; color: var(--gray-500); border-bottom: 3px solid transparent; padding: var(--space-2) var(--space-4); cursor: pointer; transition: all 0.15s; margin-bottom: -3px;">
            📊 Statistik & Termine
          </button>
          <button id="tab-dashboard-gestaltung" class="dashboard-tab" style="background: none; border: none; font-size: var(--font-size-md); font-weight: 600; color: var(--gray-500); border-bottom: 3px solid transparent; padding: var(--space-2) var(--space-4); cursor: pointer; transition: all 0.15s; margin-bottom: -3px;">
            🎨 Pre-Check-In gestalten
          </button>
        </div>

        <!-- Tab Content: Calendar (DEFAULT) -->
        <div id="tab-content-kalender" class="dashboard-tab-content">
          ${renderCalendarView()}
        </div>

        <!-- Tab Content: Dashboard & Termine -->
        <div id="tab-content-termine" class="dashboard-tab-content" style="display: none;">
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

          <!-- Praxis Documents Section -->
          <div class="dl-profile-card fade-in-up" style="background: white; border-radius: var(--radius-xl); padding: var(--space-6); border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm); margin-bottom: var(--space-6);">
            <h2 style="font-size: var(--font-size-lg); font-weight: 800; color: var(--gray-800); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 8px;">📎 Dokumente für Patienten</h2>
            <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-2); line-height: 1.5;">
              Laden Sie Dokumente hoch, die Patienten vor dem Absenden ihres Pre-Check-Ins bestätigen oder akzeptieren müssen (z.B. Datenschutzerklärung, Einwilligungen).
            </p>
            <div style="background: #FFFBEB; border: 1px solid #FEF3C7; color: #B45309; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); margin-bottom: var(--space-5); font-size: var(--font-size-xs); display: flex; gap: var(--space-2); align-items: flex-start; line-height: 1.5;">
              <span style="font-size: var(--font-size-md); line-height: 1;">⚠️</span>
              <div>
                <strong>Hinweis:</strong> Neue Dokumente gelten erst für ab dem Zeitpunkt des Hochladens neu erstellte Pre-Check-Ins. Bereits laufende Pre-Check-Ins sind nicht betroffen. Beim Löschen gilt dasselbe umgekehrt.
              </div>
            </div>

            <!-- Existing Documents List -->
            <div id="praxis-docs-list-container" style="margin-bottom: var(--space-4);">
              <div style="text-align: center; padding: var(--space-4); color: var(--gray-400); font-size: var(--font-size-sm);">Wird geladen...</div>
            </div>

            <!-- Upload New Document Form -->
            <div style="background: var(--bg-gray); border-radius: var(--radius-xl); padding: var(--space-5); border: 1px dashed var(--gray-300);">
              <h4 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-700); margin-bottom: var(--space-4);">Neues Dokument hochladen</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
                <div>
                  <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Titel des Dokuments *</label>
                  <input type="text" id="praxis-doc-title" placeholder="z.B. Datenschutzerklärung" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
                </div>
                <div>
                  <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Bestätigungstyp</label>
                  <select id="praxis-doc-type" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; cursor: pointer;">
                    <option value="confirm">Nur Bestätigung (Häkchen)</option>
                    <option value="accept_reject">Akzeptieren / Ablehnen</option>
                  </select>
                </div>
              </div>
              <div style="margin-bottom: var(--space-4);">
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Datei auswählen (PDF, PNG, JPEG, max. 5 MB) *</label>
                <input type="file" id="praxis-doc-file" accept=".pdf,.png,.jpg,.jpeg" style="font-size: var(--font-size-sm);">
              </div>
              <button id="btn-upload-praxis-doc" type="button" class="btn btn-primary" style="padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                📤 Dokument hochladen
              </button>
              <div id="praxis-doc-upload-status" style="margin-top: var(--space-3); font-size: var(--font-size-sm); font-weight: 600; display: none;"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderStatsCards(stats) {
  const cards = [
    { label: 'Termine gesamt', value: stats.totalTermine, icon: '📅', color: '#0063BE', bg: '#EBF5FF' },
    { label: 'Pre-Check-Ins abgeschlossen', value: stats.prechecksCompleted, icon: '✅', color: '#059669', bg: '#ECFDF5' },
    { label: 'Pre-Check-Ins offen', value: stats.prechecksOpen, icon: '⏳', color: '#D97706', bg: '#FFFBEB' },
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
              <th style="padding: var(--space-3) var(--space-4); text-align: left; font-weight: 700; color: var(--gray-600); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em;">Pre-Check-In</th>
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
                    <button class="btn-view-details" data-code="${t.code}" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 4px 12px; border-radius: var(--radius-md); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;">Details</button>
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

export async function initPraxisDashboardView() {
  initDlNav();

  // Tab switching logic for 3 tabs
  const tabs = [
    { btn: 'tab-dashboard-kalender', content: 'tab-content-kalender' },
    { btn: 'tab-dashboard-termine', content: 'tab-content-termine' },
    { btn: 'tab-dashboard-gestaltung', content: 'tab-content-gestaltung' }
  ];

  tabs.forEach(tab => {
    document.getElementById(tab.btn)?.addEventListener('click', () => {
      tabs.forEach(t => {
        const b = document.getElementById(t.btn);
        const c = document.getElementById(t.content);
        if (t.btn === tab.btn) {
          b?.classList.add('active');
          if (b) { b.style.color = 'var(--primary)'; b.style.borderBottomColor = 'var(--primary)'; }
          if (c) c.style.display = 'block';
        } else {
          b?.classList.remove('active');
          if (b) { b.style.color = 'var(--gray-500)'; b.style.borderBottomColor = 'transparent'; }
          if (c) c.style.display = 'none';
        }
      });
    });
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
      
      // Render table in Statistik tab
      termineContainer.innerHTML = renderTermineTable(termineData);

      // Attach click handlers for table "Details" buttons
      termineContainer.querySelectorAll('.btn-view-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          if (code) openPatientDetailModal(code);
        });
      });

      // Initialize Calendar with appointment data
      initCalendarView(termineData, (appt) => {
        openPatientDetailModal(appt.code);
      });
    }
  } catch (err) {
    termineContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Termine konnten nicht geladen werden.</p>';
  }

  // Questionnaire Builder Logic (unchanged)
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

  // ============================================
  // PRAXIS DOCUMENTS MANAGEMENT
  // ============================================

  const docsListContainer = document.getElementById('praxis-docs-list-container');
  const docUploadStatus = document.getElementById('praxis-doc-upload-status');
  let praxisDocs = [];

  function formatBytes(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function renderPraxisDocsList() {
    if (!docsListContainer) return;

    if (praxisDocs.length === 0) {
      docsListContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-6); border: 1px dashed var(--gray-300); border-radius: var(--radius-xl); background: var(--bg-gray);">
          <div style="font-size: var(--font-size-3xl); margin-bottom: var(--space-2);">📄</div>
          <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">Noch keine Dokumente hochgeladen.</p>
        </div>
      `;
      return;
    }

    docsListContainer.innerHTML = praxisDocs.map(doc => {
      const typeLabel = doc.doc_type === 'accept_reject' ? 'Akzeptieren / Ablehnen' : 'Nur Bestätigung';
      const typeClass = doc.doc_type === 'accept_reject' ? 'accept-reject' : 'confirm';
      const typeIcon = doc.doc_type === 'accept_reject' ? '⚖️' : '✓';
      const createdAt = doc.created_at ? new Date(doc.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="praxis-doc-card">
          <div class="praxis-doc-info">
            <div class="praxis-doc-icon ${typeClass}">${typeIcon}</div>
            <div class="praxis-doc-details">
              <span class="praxis-doc-title">${doc.title}</span>
              <span class="praxis-doc-meta">${typeLabel} · ${doc.filename || 'Datei'} ${doc.file_size ? '(' + formatBytes(doc.file_size) + ')' : ''} · ${createdAt}</span>
            </div>
          </div>
          <div class="praxis-doc-actions">
            ${doc.file_id ? `<a href="/api/file/${doc.file_id}" target="_blank" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 4px 10px; border-radius: var(--radius-md); font-size: 11px; font-weight: 600; cursor: pointer; text-decoration: none;">Ansehen</a>` : ''}
            <button class="btn-delete-praxis-doc" data-doc-id="${doc.id}" style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #DC2626; padding: 4px 10px; border-radius: var(--radius-md); font-size: 11px; font-weight: 700; cursor: pointer;">🗑️ Löschen</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach delete handlers
    docsListContainer.querySelectorAll('.btn-delete-praxis-doc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = parseInt(btn.dataset.docId);
        if (!confirm('Dokument wirklich löschen? Bereits laufende Pre-Check-Ins behalten das Dokument.')) return;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const res = await fetch(`/api/praxis/documents/${docId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            praxisDocs = praxisDocs.filter(d => d.id !== docId);
            renderPraxisDocsList();
          }
        } catch (err) {
          console.error('Error deleting praxis document:', err);
          btn.disabled = false;
          btn.textContent = '🗑️ Löschen';
        }
      });
    });
  }

  // Load existing praxis documents
  (async () => {
    try {
      const res = await fetch('/api/praxis/documents');
      const data = await res.json();
      if (data.success) {
        praxisDocs = data.documents || [];
        renderPraxisDocsList();
      }
    } catch (err) {
      if (docsListContainer) docsListContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Dokumente konnten nicht geladen werden.</p>';
    }
  })();

  // Upload new praxis document
  document.getElementById('btn-upload-praxis-doc')?.addEventListener('click', async () => {
    const titleInput = document.getElementById('praxis-doc-title');
    const typeSelect = document.getElementById('praxis-doc-type');
    const fileInput = document.getElementById('praxis-doc-file');

    const title = titleInput?.value?.trim();
    const docType = typeSelect?.value || 'confirm';
    const file = fileInput?.files?.[0];

    if (!title) {
      showDocStatus('Bitte geben Sie einen Titel ein.', '#DC2626');
      return;
    }
    if (!file) {
      showDocStatus('Bitte wählen Sie eine Datei aus.', '#DC2626');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showDocStatus('Datei ist zu groß (max. 5 MB).', '#DC2626');
      return;
    }

    const btn = document.getElementById('btn-upload-praxis-doc');
    btn.disabled = true;
    btn.innerHTML = '<div class="dl-auth-spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block;"></div> Wird hochgeladen...';

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const res = await fetch('/api/praxis/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            docType,
            filename: file.name,
            mimeType: file.type,
            fileData: base64Data
          })
        });
        const data = await res.json();
        if (data.success) {
          praxisDocs.unshift(data.document);
          renderPraxisDocsList();
          // Clear form
          titleInput.value = '';
          fileInput.value = '';
          showDocStatus('✓ Dokument erfolgreich hochgeladen!', '#059669');
        } else {
          showDocStatus('❌ ' + (data.error || 'Fehler beim Hochladen.'), '#DC2626');
        }
        btn.disabled = false;
        btn.innerHTML = '📤 Dokument hochladen';
      };
      reader.onerror = () => {
        showDocStatus('❌ Fehler beim Lesen der Datei.', '#DC2626');
        btn.disabled = false;
        btn.innerHTML = '📤 Dokument hochladen';
      };
    } catch (err) {
      showDocStatus('❌ Fehler: ' + err.message, '#DC2626');
      btn.disabled = false;
      btn.innerHTML = '📤 Dokument hochladen';
    }
  });

  function showDocStatus(msg, color) {
    if (docUploadStatus) {
      docUploadStatus.style.display = 'block';
      docUploadStatus.style.color = color;
      docUploadStatus.textContent = msg;
      if (color === '#059669') {
        setTimeout(() => { docUploadStatus.style.display = 'none'; }, 4000);
      }
    }
  }
}
