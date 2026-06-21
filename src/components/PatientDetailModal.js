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

let currentAiAssessments = null;

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

    const { termin, patientProfile, doctorNote, patientHints, praxisDocuments, sharedDocuments, aftercareInstructions } = data.details;
    body.innerHTML = renderDetailContent(termin, patientProfile, doctorNote, patientHints, terminCode, praxisDocuments, sharedDocuments, aftercareInstructions);

    // Attach event listeners
    attachDetailListeners(terminCode, doctorNote, patientHints, sharedDocuments, aftercareInstructions);

  } catch (err) {
    console.error('Error loading patient details:', err);
    body.innerHTML = '<p class="text-muted" style="text-align:center; padding: var(--space-8);">Fehler beim Laden.</p>';
  }
}

function renderDetailContent(termin, patient, note, hints, terminCode, praxisDocuments = [], sharedDocuments = [], aftercareInstructions = []) {
  const patientName = `${termin.patient_vorname || ''} ${termin.patient_nachname || ''}`.trim() || 'Patient';

  // Parse precheck data
  const b = termin.beschwerden ? (typeof termin.beschwerden === 'string' ? JSON.parse(termin.beschwerden) : termin.beschwerden) : {};
  const m = termin.medikamente ? (typeof termin.medikamente === 'string' ? JSON.parse(termin.medikamente) : termin.medikamente) : {};
  const a = termin.allergien ? (typeof termin.allergien === 'string' ? JSON.parse(termin.allergien) : termin.allergien) : {};
  const customAnswers = termin.custom_answers ? (typeof termin.custom_answers === 'string' ? JSON.parse(termin.custom_answers) : termin.custom_answers) : {};
  const hasCustomAnswers = Object.keys(customAnswers).length > 0;

  const d = termin.dokumente ? (typeof termin.dokumente === 'string' ? JSON.parse(termin.dokumente) : termin.dokumente) : { liste: [] };
  const docList = d.liste || [];
  const docConfirmations = termin.document_confirmations ? (typeof termin.document_confirmations === 'string' ? JSON.parse(termin.document_confirmations) : termin.document_confirmations) : {};
  const aiQuestions = termin.ai_questions ? (typeof termin.ai_questions === 'string' ? JSON.parse(termin.ai_questions) : termin.ai_questions) : [];
  const hasAiQuestions = aiQuestions.length > 0;

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
        ${hasAiQuestions ? `
        <div>
          <div class="pdm-subsection-title" style="display: flex; align-items: center; gap: 6px;">🤖 Spezifische Folgefragen (KI)</div>
          <div class="pdm-data-block">
            ${aiQuestions.map((q, idx) => `
              <div style="margin-bottom: var(--space-2); border-left: 2px solid var(--primary); padding-left: var(--space-2); padding-top: 2px; padding-bottom: 2px;">
                <strong style="font-size: 11px; text-transform: uppercase; color: var(--gray-500);">${idx + 1}. ${q.question}</strong><br>
                <span style="font-weight: 600;">${q.answer || 'Keine Antwort'}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        <div>
          <div class="pdm-subsection-title">Hochgeladene Dokumente</div>
          <div class="pdm-data-block" style="padding: var(--space-3);">
            ${docsHtml}
          </div>
        </div>
        ${Object.keys(docConfirmations).length > 0 ? `
        <div>
          <div class="pdm-subsection-title">Dokumentenbestätigungen</div>
          <div class="pdm-data-block" style="padding: var(--space-3);">
            ${Object.entries(docConfirmations).map(([docId, conf]) => {
              const statusColor = conf.status === 'rejected' ? '#DC2626' : '#059669';
              const statusBg = conf.status === 'rejected' ? '#FEF2F2' : '#ECFDF5';
              const statusLabel = conf.status === 'confirmed' ? '✓ Bestätigt' : conf.status === 'accepted' ? '✓ Akzeptiert' : conf.status === 'rejected' ? '✗ Abgelehnt' : '– Ausstehend';
              const docItem = praxisDocuments.find(d => String(d.id) === String(docId));
              const docTitle = docItem ? docItem.title : `Dokument #${docId}`;
              return `
                <div style="display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: ${statusBg}; border-radius: var(--radius-md); margin-bottom: var(--space-2); border: 1px solid ${conf.status === 'rejected' ? '#FCA5A5' : '#A7F3D0'};">
                  <span style="font-size: var(--font-size-sm); font-weight: 700; color: ${statusColor}; white-space: nowrap;">${statusLabel}</span>
                  <span style="font-size: var(--font-size-sm); color: var(--gray-600); font-weight: 500;">${docTitle}</span>
                  ${conf.status === 'rejected' && conf.reason ? `<span style="font-size: var(--font-size-xs); color: var(--gray-500); font-style: italic; margin-left: auto;">"${conf.reason}"</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}
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

    <!-- Section 1.5: Patient Feedback -->
    ${termin.rating != null ? `
    <div class="pdm-section" style="margin-bottom: var(--space-5); background: #FFFBEB; border: 1px solid #FCD34D; padding: var(--space-4); border-radius: var(--radius-lg);">
      <h4 class="pdm-section-title" style="color: #D97706; margin-bottom: var(--space-2); font-weight: 800; display: flex; align-items: center; gap: 6px;">
        ⭐ Patienten-Feedback & Bewertung
      </h4>
      <div style="font-size: var(--font-size-lg); font-weight: 700; color: #D97706; display: flex; align-items: center; gap: 4px; margin-bottom: var(--space-2);">
        ${'★'.repeat(termin.rating)}${'☆'.repeat(5 - termin.rating)} 
        <span style="font-size: var(--font-size-xs); color: var(--gray-600); font-weight: 600; margin-left: 4px;">(${termin.rating} von 5 Sternen)</span>
      </div>
      ${termin.feedback_text ? `
        <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-style: italic; background: white; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid #FEF3C7; line-height: 1.4;">
          "${termin.feedback_text}"
        </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Section 2.5: KI-Einschätzungen -->
    ${termin.precheck_submitted ? `
    <div class="pdm-section" id="ai-assessments-section" style="margin-bottom: var(--space-5); background: #f8fafc; border: 1px solid #e2e8f0; padding: var(--space-4); border-radius: var(--radius-lg);">
      <h4 class="pdm-section-title" style="color: var(--primary); margin-bottom: var(--space-3); font-weight: 800; display: flex; align-items: center; gap: 6px;">
        🤖 KI-Einschätzungen
      </h4>
      <div id="ai-assessments-container" style="min-height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px;">
        <div class="dl-auth-spinner" style="width: 24px; height: 24px; border-width: 2.5px; border-color: var(--primary) transparent transparent transparent;"></div>
        <p class="text-muted" style="margin-top: var(--space-1); font-size: var(--font-size-xs); font-weight: 600;">Einschätzungen werden geladen...</p>
      </div>
    </div>
    ` : ''}

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
    <div class="pdm-section" style="margin-bottom: var(--space-5);">
      <h4 class="pdm-section-title">💡 Hinweise an den Patienten</h4>
      ${hintsHtml || '<p style="font-size: var(--font-size-sm); color: var(--gray-400); margin-bottom: var(--space-3);">Noch keine Hinweise gesendet.</p>'}
      <button id="btn-send-hint" class="btn" style="background: var(--primary); color: white; padding: var(--space-3) var(--space-5); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: var(--space-3); font-size: var(--font-size-sm);">
        📨 Hinweis schicken
      </button>
    </div>

    <!-- Section 5: Documents for Patient -->
    <div class="pdm-section" style="margin-bottom: var(--space-5); border-top: 1px solid var(--gray-200); padding-top: var(--space-5);">
      <h4 class="pdm-section-title">📂 Dokumente für den Patienten bereitstellen (Laborberichte, Rezepte, etc.)</h4>
      <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-3);">
        Hier hochgeladene Dateien werden für den Patienten in seinem Portal freigegeben und er erhält eine sofortige Benachrichtigung per E-Mail.
      </p>
      
      <!-- List of already shared documents -->
      <div id="praxis-shared-docs-list" style="margin-bottom: var(--space-4);">
        ${
          sharedDocuments && sharedDocuments.length > 0
            ? sharedDocuments.map(doc => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--bg-gray); border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2);">
                  <div>
                    <span style="font-size: var(--font-size-sm); color: var(--gray-700); font-weight: 700;">📄 ${doc.filename} (${formatBytes(doc.file_size || doc.fileSize)})</span>
                    <span style="font-size: 10px; color: var(--gray-400); display: block; font-weight: 600;">Kategorie: ${doc.doc_category || 'Sonstiges'}</span>
                  </div>
                  <a href="/api/file/${doc.id}" target="_blank" class="btn btn-outline" style="padding: 2px 10px; font-size: 11px; font-weight: 600; text-decoration: none; border-color: var(--primary); color: var(--primary); background: white;">Ansehen</a>
                </div>
              `).join('')
            : '<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; margin-bottom: var(--space-3);">Noch keine Dokumente freigegeben</div>'
        }
      </div>
      
      <!-- Upload form -->
      <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
        <div id="praxis-upload-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); display: none; font-weight: 600; margin-bottom: var(--space-3);"></div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); align-items: flex-end;">
          <div>
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Dokumententyp *</label>
            <select id="praxis-upload-category" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: 6px; font-size: var(--font-size-xs); background: white; cursor: pointer; height: 32px;">
              <option value="Laborbefund">Laborbefund</option>
              <option value="Arztbrief">Arztbrief</option>
              <option value="eRezept">eRezept</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Datei auswählen *</label>
            <input type="file" id="praxis-upload-file-input" style="font-size: var(--font-size-xs); width: 100%;">
          </div>
        </div>
        <button id="btn-praxis-upload-doc" class="btn btn-primary" style="margin-top: var(--space-3); width: 100%; padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
          📤 Dokument freigeben & Patient benachrichtigen
        </button>
      </div>
    </div>

    <!-- Section 6: Aftercare Instructions (Nachsorge) -->
    <div class="pdm-section" style="margin-bottom: var(--space-5); border-top: 1px solid var(--gray-200); padding-top: var(--space-5);">
      <h4 class="pdm-section-title">🩺 Nachsorge-Hinweise (Post-Treatment)</h4>
      <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-3);">
        Senden Sie dem Patienten nach dem Termin wichtige Anweisungen (z. B. Schonung, Wundpflege, Kühlung) per E-Mail.
      </p>

      <!-- List of already sent aftercare instructions -->
      <div id="praxis-aftercare-list" style="margin-bottom: var(--space-4);">
        ${
          aftercareInstructions && aftercareInstructions.length > 0
            ? aftercareInstructions.map(instr => `
                <div style="padding: var(--space-3); background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2); box-shadow: var(--shadow-sm);">
                  <div style="font-size: 10px; color: var(--gray-400); margin-bottom: var(--space-1); font-weight: 600;">
                    Gesendet am ${new Date(instr.sent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} Uhr ${instr.email_sent ? '· 📧 E-Mail gesendet' : ''}
                  </div>
                  <div style="font-size: var(--font-size-sm); color: var(--gray-700); font-style: italic; white-space: pre-wrap; line-height: 1.4;">"${instr.instructions}"</div>
                </div>
              `).join('')
            : '<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; margin-bottom: var(--space-3);">Noch keine Nachsorge-Hinweise gesendet.</div>'
        }
      </div>

      <!-- Send new aftercare instructions -->
      <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
        <div id="praxis-aftercare-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); display: none; font-weight: 600; margin-bottom: var(--space-3);"></div>
        
        <textarea id="praxis-aftercare-input" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); min-height: 80px; margin-bottom: var(--space-2); background: white; resize: vertical;" placeholder="Z. B. Bitte denken Sie daran, die Wunde heute noch zu kühlen und keinen Sport zu treiben."></textarea>
        
        <button id="btn-send-aftercare" class="btn btn-primary" style="width: 100%; padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
          📨 Nachsorge-Hinweise per E-Mail senden
        </button>
      </div>
    </div>
  `;
}

function attachDetailListeners(terminCode, existingNote, existingHints, sharedDocuments = [], aftercareInstructions = []) {
  // Load AI assessments if the container exists
  if (document.getElementById('ai-assessments-container')) {
    fetchAiAssessments(terminCode);
  }

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

  // Upload document for patient
  const uploadBtn = document.getElementById('btn-praxis-upload-doc');
  uploadBtn?.addEventListener('click', async () => {
    const fileInput = document.getElementById('praxis-upload-file-input');
    const categorySelect = document.getElementById('praxis-upload-category');
    const errorDiv = document.getElementById('praxis-upload-error');

    if (errorDiv) errorDiv.style.display = 'none';

    const file = fileInput?.files?.[0];
    if (!file) {
      showUploadError('Bitte wählen Sie zuerst eine Datei aus.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showUploadError('Die Datei ist zu groß (maximal 5 MB erlaubt).');
      return;
    }

    const category = categorySelect?.value || 'Sonstiges';

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
      <div class="dl-auth-spinner" style="width: 12px; height: 12px; border-width: 2px; margin-right: 4px; display: inline-block;"></div>
      Hochladen...
    `;

    try {
      const base64Data = await toBase64(file);
      const payload = {
        filename: file.name,
        mimeType: file.type,
        fileData: base64Data.split(',')[1],
        docCategory: category
      };

      const res = await fetch(`/api/praxis/termin/${terminCode}/upload-patient-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Hochladen.');

      // Refresh patient details modal
      loadPatientDetails(terminCode);
    } catch (err) {
      console.error(err);
      showUploadError(err.message || 'Verbindung zum Server fehlgeschlagen.');
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `📤 Dokument freigeben & Patient benachrichtigen`;
    }
  });

  function showUploadError(msg) {
    const errorDiv = document.getElementById('praxis-upload-error');
    if (errorDiv) {
      errorDiv.textContent = msg;
      errorDiv.style.display = 'block';
    }
  }

  // Send aftercare instructions
  const sendAftercareBtn = document.getElementById('btn-send-aftercare');
  sendAftercareBtn?.addEventListener('click', async () => {
    const input = document.getElementById('praxis-aftercare-input');
    const errorDiv = document.getElementById('praxis-aftercare-error');
    if (errorDiv) errorDiv.style.display = 'none';

    const text = input?.value || '';
    if (!text.trim()) {
      showAftercareError('Bitte geben Sie zuerst die Nachsorge-Hinweise ein.');
      return;
    }

    sendAftercareBtn.disabled = true;
    sendAftercareBtn.textContent = 'Wird gesendet...';

    try {
      const res = await fetch(`/api/praxis/termin/${terminCode}/aftercare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Senden.');

      // Refresh patient details modal
      loadPatientDetails(terminCode);
    } catch (err) {
      console.error(err);
      showAftercareError(err.message || 'Verbindung zum Server fehlgeschlagen.');
      sendAftercareBtn.disabled = false;
      sendAftercareBtn.textContent = '📨 Nachsorge-Hinweise per E-Mail senden';
    }
  });

  function showAftercareError(msg) {
    const errorDiv = document.getElementById('praxis-aftercare-error');
    if (errorDiv) {
      errorDiv.textContent = msg;
      errorDiv.style.display = 'block';
    }
  }

  function toBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
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

  // Generate HTML for standard options
  let standardHtml = options.map((opt, i) => `
    <label class="hint-option" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s; margin-bottom: var(--space-2); border: 1px solid var(--gray-200); background: white;">
      <input type="checkbox" class="hint-option-checkbox" value="${opt}" 
             ${selectedHints.includes(opt) ? 'checked' : ''}
             style="margin-top: 2px; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); flex-shrink: 0;">
      <span style="font-size: var(--font-size-sm); color: var(--gray-700); line-height: 1.4;">${opt}</span>
    </label>
  `).join('');

  // Generate HTML for AI patient suggestions
  let aiHtml = '';
  const aiPatientTodos = currentAiAssessments?.patientTodos || [];
  if (aiPatientTodos.length > 0) {
    aiHtml = `
      <div style="margin-bottom: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px dashed var(--gray-200);">
        <span style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
          🤖 KI-Vorschläge (vorselektiert)
        </span>
      </div>
    ` + aiPatientTodos.map(item => {
      const val = item.patientText || item.text;
      // We check it by default unless it's an edit view and it wasn't selected (though normally new AI suggestions are checked by default)
      const isChecked = selectedHints.length > 0 ? selectedHints.includes(val) : true;
      return `
        <label class="hint-option ai-hint-option" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s; margin-bottom: var(--space-2); border: 1px dashed var(--primary); background: #eff6ff;">
          <input type="checkbox" class="hint-option-checkbox" value="${val}" 
                 ${isChecked ? 'checked' : ''}
                 style="margin-top: 2px; width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); flex-shrink: 0;">
          <div style="font-size: var(--font-size-sm); color: #1e3a8a; line-height: 1.4; display: flex; flex-direction: column;">
            <span style="font-weight: 600;">${val}</span>
            <span style="font-size: 10px; color: var(--gray-500); margin-top: 2px; font-style: italic;">Basierend auf KI: "${item.text}"</span>
          </div>
        </label>
      `;
    }).join('');
  }

  container.innerHTML = aiHtml + standardHtml;

  // Hover and background effects
  container.querySelectorAll('.hint-option').forEach(label => {
    const isAi = label.classList.contains('ai-hint-option');
    const checkedBg = isAi ? '#eff6ff' : 'var(--primary-lightest)';
    const uncheckedBg = isAi ? '#f8fafc' : 'white';
    
    // Set initial background based on checkbox state
    const checked = label.querySelector('input')?.checked;
    label.style.background = checked ? checkedBg : uncheckedBg;

    label.addEventListener('mouseenter', () => { label.style.background = 'var(--primary-lightest)'; });
    label.addEventListener('mouseleave', () => {
      const currentChecked = label.querySelector('input')?.checked;
      label.style.background = currentChecked ? checkedBg : uncheckedBg;
    });
    label.querySelector('input')?.addEventListener('change', (e) => {
      label.style.background = e.target.checked ? checkedBg : uncheckedBg;
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

// ── AI Assessments Helpers ────────

async function fetchAiAssessments(terminCode) {
  const container = document.getElementById('ai-assessments-container');
  if (!container) return;

  try {
    const res = await fetch(`/api/praxis/termin/${terminCode}/ai-assessments`);
    const data = await res.json();

    if (data.success && data.ai_assessments) {
      currentAiAssessments = data.ai_assessments;
      renderAiAssessments(terminCode);
    } else {
      container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">Keine KI-Einschätzungen verfügbar.</p>`;
    }
  } catch (err) {
    console.error('Error fetching AI assessments:', err);
    container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">Fehler beim Laden der KI-Einschätzungen.</p>`;
  }
}

function renderAiAssessments(terminCode) {
  const container = document.getElementById('ai-assessments-container');
  if (!container) return;

  const doctorTodos = currentAiAssessments?.doctorTodos || [];
  const patientTodos = currentAiAssessments?.patientTodos || [];

  if (doctorTodos.length === 0 && patientTodos.length === 0) {
    container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; text-align: center; width: 100%;">Alle Einschätzungen wurden bearbeitet oder ausgeblendet.</p>`;
    return;
  }

  const doctorHtml = doctorTodos.map(item => `
    <div class="ai-todo-card" data-id="${item.id}" style="background: #ffffff; border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: var(--space-3); transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between; min-height: 100px; box-shadow: var(--shadow-sm); margin-bottom: var(--space-2);">
      <div>
        <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--primary); background: var(--primary-lightest); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: var(--space-2);">${item.category}</span>
        <p style="font-size: var(--font-size-sm); color: var(--gray-800); margin: 0; font-weight: 600; line-height: 1.4;">${item.text}</p>
        ${item.reasoning ? `<p style="font-size: 10px; color: var(--gray-500); margin: var(--space-1) 0 0 0; line-height: 1.3; font-style: italic;">💡 ${item.reasoning}</p>` : ''}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2);">
        <button class="btn-ai-add" data-id="${item.id}" title="Zu Notizen hinzufügen" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px; font-weight: 600; transition: transform 0.1s ease; outline: none;">
          ➕ Zu Notizen
        </button>
        <button class="btn-ai-remove" data-id="${item.id}" title="Entfernen" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; transition: transform 0.1s ease; outline: none;">
          ❌ Entfernen
        </button>
      </div>
    </div>
  `).join('');

  const patientHtml = patientTodos.map(item => `
    <div class="ai-todo-card" data-id="${item.id}" style="background: #ffffff; border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: var(--space-3); transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between; min-height: 100px; box-shadow: var(--shadow-sm); margin-bottom: var(--space-2);">
      <div>
        <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--primary); background: var(--primary-lightest); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: var(--space-2);">${item.category}</span>
        <p style="font-size: var(--font-size-sm); color: var(--gray-800); margin: 0; font-weight: 600; line-height: 1.4;">${item.text}</p>
        ${item.reasoning ? `<p style="font-size: 10px; color: var(--gray-500); margin: var(--space-1) 0 0 0; line-height: 1.3; font-style: italic;">💡 ${item.reasoning}</p>` : ''}
      </div>
      <div style="display: flex; justify-content: flex-end; margin-top: var(--space-2);">
        <button class="btn-ai-remove" data-id="${item.id}" title="Entfernen" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; transition: transform 0.1s ease; outline: none;">
          ❌ Entfernen
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-1); width: 100%; text-align: left;">
      ${doctorHtml}
      ${patientHtml}
    </div>
  `;

  // Attach button event listeners
  container.querySelectorAll('.btn-ai-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = doctorTodos.find(t => t.id === id);
      if (item) {
        addTodoToNotes(item.text);
      }
    });
  });

  container.querySelectorAll('.btn-ai-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      removeAiAssessment(terminCode, id);
    });
  });
}

function addTodoToNotes(text) {
  const textarea = document.getElementById('doctor-note-input');
  if (!textarea) return;

  const currentVal = textarea.value.trim();
  if (currentVal) {
    textarea.value = currentVal + '\n- ' + text;
  } else {
    textarea.value = '- ' + text;
  }
  // Visual feedback pulse
  textarea.style.transition = 'all 0.3s ease';
  textarea.style.borderColor = 'var(--primary)';
  textarea.style.boxShadow = '0 0 0 3px rgba(16,122,202,0.25)';
  setTimeout(() => {
    textarea.style.borderColor = '';
    textarea.style.boxShadow = '';
  }, 1000);
}

async function removeAiAssessment(terminCode, id) {
  if (!currentAiAssessments) return;

  currentAiAssessments.doctorTodos = (currentAiAssessments.doctorTodos || []).filter(t => t.id !== id);
  currentAiAssessments.patientTodos = (currentAiAssessments.patientTodos || []).filter(t => t.id !== id);

  // Re-render immediately
  renderAiAssessments(terminCode);

  try {
    await fetch(`/api/praxis/termin/${terminCode}/ai-assessments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_assessments: currentAiAssessments })
    });
  } catch (err) {
    console.error('Error saving updated AI assessments:', err);
  }
}
