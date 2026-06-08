/**
 * PatientDetailModal
 * Shows detailed patient info, precheck summary, doctor notes, and hint management.
 */

const DEFAULT_HINTS = [
  'Bitte erscheinen Sie nüchtern (nichts essen/trinken ab 22 Uhr am Vortag)',
  'Bitte bringen Sie Ihren Impfpass mit',
  'Bitte bringen Sie aktuelle Laborergebnisse mit',
  'Bitte bringen Sie eine Überweisung mit',
  'Bitte nehmen Sie Ihre Medikamente wie gewohnt ein'
];

export function openPatientDetailModal(terminCode) {
  // Remove any existing modal
  document.getElementById('patient-detail-modal')?.remove();

  const html = `
    <div class="dl-modal-backdrop" id="patient-detail-modal" style="z-index: 9000;">
      <div class="dl-modal-card fade-in-up" style="max-width: 680px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">Termindetails</h3>
          <button class="dl-modal-close" id="btn-close-patient-detail">&times;</button>
        </div>
        <div class="dl-modal-body" id="patient-detail-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
          <div style="text-align: center; padding: var(--space-8);">
            <div class="dl-auth-spinner" style="display: inline-block; width: 28px; height: 28px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-3); font-size: var(--font-size-sm);">Daten werden geladen...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('patient-detail-modal');
  const closeModal = () => modal?.remove();
  document.getElementById('btn-close-patient-detail')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Load data
  loadPatientDetails(terminCode);
}

async function loadPatientDetails(terminCode) {
  const body = document.getElementById('patient-detail-body');
  if (!body) return;

  try {
    const res = await fetch(`/api/praxis/termin/${terminCode}/details`);
    const data = await res.json();

    if (!data.success || !data.details) {
      body.innerHTML = '<p class="text-muted" style="text-align:center; padding: var(--space-8);">Keine Daten gefunden.</p>';
      return;
    }

    const { termin, patientProfile, doctorNote, patientHints } = data.details;
    body.innerHTML = renderDetailContent(termin, patientProfile, doctorNote, patientHints, terminCode);

    // Attach event listeners
    attachDetailListeners(terminCode, doctorNote, patientHints);

  } catch (err) {
    console.error('Error loading patient details:', err);
    body.innerHTML = '<p class="text-muted" style="text-align:center; padding: var(--space-8);">Fehler beim Laden.</p>';
  }
}

function renderDetailContent(termin, patient, note, hints, terminCode) {
  const patientName = `${termin.patient_vorname || ''} ${termin.patient_nachname || ''}`.trim() || 'Patient';

  // Parse precheck data
  const b = termin.beschwerden ? (typeof termin.beschwerden === 'string' ? JSON.parse(termin.beschwerden) : termin.beschwerden) : {};
  const m = termin.medikamente ? (typeof termin.medikamente === 'string' ? JSON.parse(termin.medikamente) : termin.medikamente) : {};
  const a = termin.allergien ? (typeof termin.allergien === 'string' ? JSON.parse(termin.allergien) : termin.allergien) : {};
  const customAnswers = termin.custom_answers ? (typeof termin.custom_answers === 'string' ? JSON.parse(termin.custom_answers) : termin.custom_answers) : {};
  const hasCustomAnswers = Object.keys(customAnswers).length > 0;

  const d = termin.dokumente ? (typeof termin.dokumente === 'string' ? JSON.parse(termin.dokumente) : termin.dokumente) : { liste: [] };
  const docList = d.liste || [];

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const docsHtml = docList.length > 0
    ? docList.map(file => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--bg-gray); border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2);">
          <span style="font-size: var(--font-size-sm); color: var(--gray-700); font-weight: 500;">📄 ${file.filename} (${formatBytes(file.fileSize)})</span>
          <a href="/api/file/${file.id}" target="_blank" class="btn btn-outline" style="padding: 2px 10px; font-size: 11px; font-weight: 600; text-decoration: none; border-color: var(--primary); color: var(--primary); background: white;">Ansehen</a>
        </div>
      `).join('')
    : '<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">Keine Dokumente hochgeladen</div>';

  const symptoms = (b.chips || []).join(', ') || 'Keine Angabe';
  const freitext = b.freitext || 'Keine Beschreibung';
  const staerke = b.staerke != null ? `${b.staerke} / 10` : 'Keine Angabe';
  const meds = m.keine ? 'Keine Medikamente' : (m.liste || []).join(', ') || 'Keine Angabe';
  const allergien = a.keine ? 'Keine Allergien' : (a.liste || []).join(', ') || 'Keine Angabe';
  const allerAnm = a.anmerkungen || '';

  // Patient profile info
  const versicherung = patient
    ? `${patient.krankenversicherung === 'privat' ? 'Privat' : 'Gesetzlich'}${patient.krankenkasse ? ' (' + patient.krankenkasse + ')' : ''}`
    : '–';
  const adresse = patient ? [patient.strasse_hnr, patient.plz_ort].filter(Boolean).join(', ') || '–' : '–';

  // Existing hints
  const hintsHtml = hints && hints.length > 0
    ? hints.map(h => {
        const hintList = Array.isArray(h.hints) ? h.hints : (typeof h.hints === 'string' ? JSON.parse(h.hints) : []);
        const sentDate = h.sent_at ? new Date(h.sent_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div class="pdm-hint-card" style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <span style="font-size: var(--font-size-xs); color: var(--gray-400); font-weight: 600;">Gesendet: ${sentDate}</span>
              <div style="display: flex; gap: var(--space-2); align-items: center;">
                ${h.email_sent ? '<span style="font-size: 10px; color: #059669; font-weight: 700;">📧 E-Mail gesendet</span>' : '<span style="font-size: 10px; color: var(--gray-400);">Keine E-Mail</span>'}
                <button class="btn-edit-hint" data-hint-id="${h.id}" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 2px 10px; border-radius: var(--radius-md); font-size: 11px; font-weight: 600; cursor: pointer;">Bearbeiten</button>
              </div>
            </div>
            ${hintList.length > 0 ? `<ul style="padding-left: 18px; margin: 0; font-size: var(--font-size-sm); color: var(--gray-700);">${hintList.map(ht => `<li style="margin-bottom: 4px;">${ht}</li>`).join('')}</ul>` : ''}
            ${h.custom_text ? `<div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--gray-700); font-style: italic; border-left: 2px solid var(--primary); padding-left: var(--space-3);">${h.custom_text}</div>` : ''}
          </div>
        `;
      }).join('')
    : '';

  return `
    <!-- Termin Info Bar -->
    <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--primary-lightest); border-radius: var(--radius-lg); margin-bottom: var(--space-5); border: 1px solid rgba(16,122,202,0.15);">
      <span style="font-size: var(--font-size-lg);">📅</span>
      <div>
        <span style="font-size: var(--font-size-sm); font-weight: 700; color: var(--primary);">${termin.date} · ${termin.time} Uhr</span>
        <span style="font-size: var(--font-size-xs); color: var(--gray-500); display: block;">${termin.art} · ${termin.doctor}</span>
      </div>
      <div style="margin-left: auto;">
        ${termin.precheck_submitted
          ? '<span style="background: #ECFDF5; color: #059669; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">✓ Pre-Check-In erledigt</span>'
          : '<span style="background: #FEF2F2; color: #DC2626; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">⏳ Pre-Check-In ausstehend</span>'
        }
      </div>
    </div>

    <!-- Section 1: Patient Info -->
    <div class="pdm-section" style="margin-bottom: var(--space-5);">
      <h4 class="pdm-section-title">👤 Patienteninformationen</h4>
      <div class="pdm-info-grid">
        <div class="pdm-info-row">
          <span class="pdm-info-label">Name</span>
          <span class="pdm-info-value">${patientName}</span>
        </div>
        <div class="pdm-info-row">
          <span class="pdm-info-label">Geburtsdatum</span>
          <span class="pdm-info-value">${patient?.geburtsdatum || '–'}</span>
        </div>
        <div class="pdm-info-row">
          <span class="pdm-info-label">Telefon</span>
          <span class="pdm-info-value">${patient?.telefonnummer || '–'}</span>
        </div>
        <div class="pdm-info-row">
          <span class="pdm-info-label">Adresse</span>
          <span class="pdm-info-value">${adresse}</span>
        </div>
        <div class="pdm-info-row">
          <span class="pdm-info-label">Versicherung</span>
          <span class="pdm-info-value">${versicherung}</span>
        </div>
        <div class="pdm-info-row">
          <span class="pdm-info-label">E-Mail</span>
          <span class="pdm-info-value">${patient?.email || '–'}</span>
        </div>
      </div>
    </div>

    <!-- Section 2: PreCheck Summary -->
    ${termin.precheck_submitted ? `
    <div class="pdm-section" style="margin-bottom: var(--space-5);">
      <h4 class="pdm-section-title">🩺 Pre-Check-In Zusammenfassung</h4>
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div>
          <div class="pdm-subsection-title">Beschwerden</div>
          <div class="pdm-data-block">
            <div><strong>Symptome:</strong> ${symptoms}</div>
            <div style="margin-top: var(--space-1);"><strong>Beschreibung:</strong> ${freitext}</div>
            <div style="margin-top: var(--space-1);"><strong>Schmerzstärke:</strong> ${staerke}</div>
          </div>
        </div>
        <div>
          <div class="pdm-subsection-title">Medikamente</div>
          <div class="pdm-data-block">${meds}</div>
        </div>
        <div>
          <div class="pdm-subsection-title">Allergien</div>
          <div class="pdm-data-block">${allergien}${allerAnm ? `<div style="margin-top: var(--space-1);"><strong>Anmerkungen:</strong> ${allerAnm}</div>` : ''}</div>
        </div>
        ${hasCustomAnswers ? `
        <div>
          <div class="pdm-subsection-title">Zusatzfragen</div>
          <div class="pdm-data-block">
            ${Object.entries(customAnswers).map(([q, a]) => {
              const ansText = Array.isArray(a) ? a.join(', ') : (a || 'Keine Antwort');
              return `<div style="margin-bottom: var(--space-2);"><strong style="font-size: 11px; text-transform: uppercase; color: var(--gray-500);">${q}</strong><br><span style="font-weight: 600;">${ansText}</span></div>`;
            }).join('')}
          </div>
        </div>
        ` : ''}
        <div>
          <div class="pdm-subsection-title">Hochgeladene Dokumente</div>
          <div class="pdm-data-block" style="padding: var(--space-3);">
            ${docsHtml}
          </div>
        </div>
        ${termin.signature_data ? `
        <div>
          <div class="pdm-subsection-title">Digitale Unterschrift</div>
          <div style="margin-top: var(--space-2); background: white; border: 1px dashed var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2); display: inline-block; max-width: 250px;">
            <img src="${termin.signature_data}" style="max-height: 80px; display: block;" alt="Unterschrift" />
          </div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : `
    <div class="pdm-section" style="margin-bottom: var(--space-5);">
      <h4 class="pdm-section-title">🩺 Pre-Check-In</h4>
      <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-5); text-align: center; border: 1px dashed var(--gray-300);">
        <p style="font-size: var(--font-size-sm); color: var(--gray-500);">Der Pre-Check-In wurde noch nicht ausgefüllt.</p>
      </div>
    </div>
    `}

    <!-- Section 3: Doctor Notes -->
    <div class="pdm-section" style="margin-bottom: var(--space-5);">
      <h4 class="pdm-section-title">📝 Eigene Notizen (nur für Sie sichtbar)</h4>
      <textarea id="doctor-note-input" class="pdm-note-textarea" placeholder="Notizen zum Termin eingeben...">${note?.note_text || ''}</textarea>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2);">
        <span id="doctor-note-status" style="font-size: var(--font-size-xs); color: var(--gray-400);"></span>
        <button id="btn-save-note" class="btn btn-primary" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
          💾 Notiz speichern
        </button>
      </div>
    </div>

    <!-- Section 4: Patient Hints -->
    <div class="pdm-section">
      <h4 class="pdm-section-title">💡 Hinweise an den Patienten</h4>
      ${hintsHtml || '<p style="font-size: var(--font-size-sm); color: var(--gray-400); margin-bottom: var(--space-3);">Noch keine Hinweise gesendet.</p>'}
      <button id="btn-send-hint" class="btn" style="background: var(--primary); color: white; padding: var(--space-3) var(--space-5); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: var(--space-3); font-size: var(--font-size-sm);">
        📨 Hinweis schicken
      </button>
    </div>
  `;
}

function attachDetailListeners(terminCode, existingNote, existingHints) {
  // Save note
  document.getElementById('btn-save-note')?.addEventListener('click', async () => {
    const noteText = document.getElementById('doctor-note-input')?.value || '';
    const status = document.getElementById('doctor-note-status');
    const btn = document.getElementById('btn-save-note');
    btn.disabled = true;
    btn.textContent = 'Speichern...';
    try {
      await fetch(`/api/praxis/termin/${terminCode}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText })
      });
      if (status) {
        status.textContent = '✓ Gespeichert';
        status.style.color = '#059669';
        setTimeout(() => { status.textContent = ''; }, 3000);
      }
    } catch (err) {
      if (status) { status.textContent = '❌ Fehler'; status.style.color = '#DC2626'; }
    }
    btn.disabled = false;
    btn.textContent = '💾 Notiz speichern';
  });

  // Send hint button → open HintModal
  document.getElementById('btn-send-hint')?.addEventListener('click', () => {
    openHintModal(terminCode, null);
  });

  // Edit hint buttons
  document.querySelectorAll('.btn-edit-hint').forEach(btn => {
    btn.addEventListener('click', () => {
      const hintId = btn.dataset.hintId;
      const hint = existingHints?.find(h => String(h.id) === String(hintId));
      openHintModal(terminCode, hint);
    });
  });
}

// ── Hint Modal ────────

function openHintModal(terminCode, existingHint) {
  document.getElementById('hint-modal')?.remove();

  const isEdit = !!existingHint;
  const selectedHints = isEdit ? (Array.isArray(existingHint.hints) ? existingHint.hints : JSON.parse(existingHint.hints || '[]')) : [];
  const customText = isEdit ? (existingHint.custom_text || '') : '';

  const html = `
    <div class="dl-modal-backdrop" id="hint-modal" style="z-index: 9500;">
      <div class="dl-modal-card fade-in-up" style="max-width: 560px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">${isEdit ? '✏️ Hinweis bearbeiten' : '📨 Hinweis an Patienten'}</h3>
          <button class="dl-modal-close" id="btn-close-hint">&times;</button>
        </div>
        <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;" id="hint-modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--gray-500); margin-bottom: var(--space-5); line-height: 1.5;">
            Wählen Sie Hinweise aus oder schreiben Sie eine individuelle Nachricht.
            ${isEdit ? 'Nach der Bearbeitung können Sie erneut eine E-Mail senden.' : 'Der Hinweis wird per E-Mail zugestellt und im Pre-Check-In angezeigt.'}
          </p>

          <div id="hint-options-container">
            <!-- Options loaded dynamically -->
          </div>

          <div style="margin-top: var(--space-5);">
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Individuelle Nachricht (optional)</label>
            <textarea id="hint-custom-text" placeholder="Z.B.: Bitte rufen Sie uns vorher an, wenn Sie sich verspäten..."
                      style="width: 100%; min-height: 80px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-sm); resize: vertical; font-family: var(--font-family);">${customText}</textarea>
          </div>

          <div style="margin-top: var(--space-4);">
            <button id="btn-hint-settings" type="button" style="background: none; border: none; color: var(--gray-500); font-size: var(--font-size-xs); cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600; text-decoration: underline;">
              ⚙️ Standard-Hinweise anpassen
            </button>
          </div>

          <!-- Settings area (hidden by default) -->
          <div id="hint-settings-area" style="display: none; margin-top: var(--space-4); background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
            <h5 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-700); margin-bottom: var(--space-3);">Standard-Hinweise bearbeiten</h5>
            <div id="hint-settings-list"></div>
            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
              <button id="btn-add-default-hint" type="button" style="background: var(--primary-lightest); color: var(--primary); border: 1px dashed var(--primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">+ Hinzufügen</button>
              <button id="btn-save-default-hints" type="button" style="background: var(--primary); color: white; border: none; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">💾 Speichern</button>
            </div>
            <div id="hint-settings-status" style="font-size: var(--font-size-xs); color: var(--gray-400); margin-top: var(--space-2);"></div>
          </div>
        </div>
        <div class="dl-modal-footer" style="flex-shrink: 0; display: flex; gap: var(--space-3); justify-content: flex-end;">
          <button type="button" class="btn btn-outline" id="btn-cancel-hint" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="btn-submit-hint" style="padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer; font-weight: 700;">
            ${isEdit ? '📧 Hinweis aktualisieren & senden' : '📧 Hinweis versenden'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('hint-modal');
  const close = () => modal?.remove();
  document.getElementById('btn-close-hint')?.addEventListener('click', close);
  document.getElementById('btn-cancel-hint')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // Load hint options
  loadHintOptions(selectedHints);

  // Settings toggle
  document.getElementById('btn-hint-settings')?.addEventListener('click', () => {
    const area = document.getElementById('hint-settings-area');
    if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area?.style.display === 'block') loadHintSettings();
  });

  // Submit hint
  document.getElementById('btn-submit-hint')?.addEventListener('click', async () => {
    const selectedOptions = [];
    document.querySelectorAll('.hint-option-checkbox:checked').forEach(cb => {
      selectedOptions.push(cb.value);
    });
    const custom = document.getElementById('hint-custom-text')?.value || '';
    const btn = document.getElementById('btn-submit-hint');
    btn.disabled = true;
    btn.textContent = 'Wird gesendet...';

    try {
      if (isEdit) {
        await fetch(`/api/praxis/termin/${terminCode}/hints/${existingHint.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hints: selectedOptions, custom_text: custom, resend_email: true })
        });
      } else {
        await fetch(`/api/praxis/termin/${terminCode}/hints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hints: selectedOptions, custom_text: custom })
        });
      }
      btn.textContent = '✓ Gesendet!';
      btn.style.background = '#059669';
      setTimeout(() => {
        close();
        // Reload the detail modal to show updated hints
        loadPatientDetails(terminCode);
      }, 1000);
    } catch (err) {
      console.error('Error submitting hint:', err);
      btn.textContent = 'Fehler – erneut versuchen';
      btn.disabled = false;
    }
  });
}

async function loadHintOptions(selectedHints) {
  const container = document.getElementById('hint-options-container');
  if (!container) return;

  // Try to load custom defaults from server
  let options = [...DEFAULT_HINTS];
  try {
    const res = await fetch('/api/praxis/default-hints');
    const data = await res.json();
    if (data.success && data.defaultHints && Array.isArray(data.defaultHints)) {
      options = data.defaultHints;
    }
  } catch (err) {
    console.warn('Could not load default hints, using fallback:', err);
  }

  container.innerHTML = options.map((opt, i) => `
    <label class="hint-option" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s; margin-bottom: var(--space-2); border: 1px solid var(--gray-200); background: white;">
      <input type="checkbox" class="hint-option-checkbox" value="${opt}" 
             ${selectedHints.includes(opt) ? 'checked' : ''}
             style="margin-top: 2px; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); flex-shrink: 0;">
      <span style="font-size: var(--font-size-sm); color: var(--gray-700); line-height: 1.4;">${opt}</span>
    </label>
  `).join('');

  // Hover effect
  container.querySelectorAll('.hint-option').forEach(label => {
    label.addEventListener('mouseenter', () => { label.style.background = 'var(--primary-lightest)'; });
    label.addEventListener('mouseleave', () => {
      const checked = label.querySelector('input')?.checked;
      label.style.background = checked ? 'var(--primary-lightest)' : 'white';
    });
    label.querySelector('input')?.addEventListener('change', (e) => {
      label.style.background = e.target.checked ? 'var(--primary-lightest)' : 'white';
    });
  });
}

async function loadHintSettings() {
  const list = document.getElementById('hint-settings-list');
  if (!list) return;

  let options = [...DEFAULT_HINTS];
  try {
    const res = await fetch('/api/praxis/default-hints');
    const data = await res.json();
    if (data.success && data.defaultHints && Array.isArray(data.defaultHints)) {
      options = data.defaultHints;
    }
  } catch (err) { /* use defaults */ }

  function renderSettingsList() {
    list.innerHTML = options.map((opt, i) => `
      <div style="display: flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2);">
        <input type="text" class="hint-setting-input" data-index="${i}" value="${opt}" 
               style="flex: 1; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); font-size: var(--font-size-xs);">
        <button type="button" class="hint-setting-delete" data-index="${i}" 
                style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 700;">✕</button>
      </div>
    `).join('');

    // Delete handlers
    list.querySelectorAll('.hint-setting-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        options.splice(idx, 1);
        renderSettingsList();
      });
    });

    // Input change handlers
    list.querySelectorAll('.hint-setting-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        options[idx] = e.target.value;
      });
    });
  }

  renderSettingsList();

  // Add button
  document.getElementById('btn-add-default-hint')?.addEventListener('click', () => {
    options.push('');
    renderSettingsList();
    // Focus the new input
    const inputs = list.querySelectorAll('.hint-setting-input');
    inputs[inputs.length - 1]?.focus();
  });

  // Save button
  document.getElementById('btn-save-default-hints')?.addEventListener('click', async () => {
    const status = document.getElementById('hint-settings-status');
    const filtered = options.filter(o => o.trim().length > 0);
    try {
      await fetch('/api/praxis/default-hints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultHints: filtered })
      });
      options = filtered;
      renderSettingsList();
      if (status) { status.textContent = '✓ Gespeichert!'; status.style.color = '#059669'; }
      // Reload the hint checkboxes
      loadHintOptions([]);
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    } catch (err) {
      if (status) { status.textContent = '❌ Fehler'; status.style.color = '#DC2626'; }
    }
  });
}
