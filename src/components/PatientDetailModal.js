import { t } from '../utils/i18n.js';

function getDefaultHints() {
  return [
    t('hints.fasting', 'Bitte erscheinen Sie nüchtern (nichts essen/trinken ab 22 Uhr am Vortag)'),
    t('hints.vaccination_pass', 'Bitte bringen Sie Ihren Impfpass mit'),
    t('hints.lab_results', 'Bitte bringen Sie aktuelle Laborergebnisse mit'),
    t('hints.referral', 'Bitte bringen Sie eine Überweisung mit'),
    t('hints.meds_as_usual', 'Bitte nehmen Sie Ihre Medikamente wie gewohnt ein')
  ];
}

let currentActiveTab = 'patient';

export function openPatientDetailModal(terminCode) {
  currentActiveTab = 'patient';
  // Remove any existing modal
  document.getElementById('patient-detail-modal')?.remove();

  const html = `
    <div class="dl-modal-backdrop" id="patient-detail-modal" style="z-index: 9000;">
      <div class="dl-modal-card fade-in-up" style="max-width: 720px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title">${t('praxis.appt_details', 'Termindetails')}</h3>
          <button class="dl-modal-close" id="btn-close-patient-detail">&times;</button>
        </div>
        <div class="dl-modal-body" id="patient-detail-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;">
          <div style="text-align: center; padding: var(--space-8);">
            <div class="dl-auth-spinner" style="display: inline-block; width: 28px; height: 28px; border-width: 3px;"></div>
            <p class="text-muted" style="margin-top: var(--space-3); font-size: var(--font-size-sm);">${t('common.loading', 'Daten werden geladen...')}</p>
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
      body.innerHTML = `<p class="text-muted" style="text-align:center; padding: var(--space-8);">${t('common.no_data', 'Keine Daten gefunden.')}</p>`;
      return;
    }

    const { termin, patientProfile, doctorNote, patientHints, praxisDocuments, sharedDocuments, aftercareInstructions } = data.details;
    body.innerHTML = renderDetailContent(termin, patientProfile, doctorNote, patientHints, terminCode, praxisDocuments, sharedDocuments, aftercareInstructions);

    // Attach event listeners
    attachDetailListeners(terminCode, doctorNote, patientHints, sharedDocuments, aftercareInstructions);

  } catch (err) {
    console.error('Error loading patient details:', err);
    body.innerHTML = `<p class="text-muted" style="text-align:center; padding: var(--space-8);">${t('common.error_loading', 'Fehler beim Laden.')}</p>`;
  }
}

function renderDetailContent(termin, patient, note, hints, terminCode, praxisDocuments = [], sharedDocuments = [], aftercareInstructions = []) {
  const patientName = `${termin.patient_vorname || ''} ${termin.patient_nachname || ''}`.trim() || 'Patient';
  const activeTab = currentActiveTab || 'patient';

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
          <a href="/api/file/${file.id}" target="_blank" class="btn btn-outline" style="padding: 2px 10px; font-size: 11px; font-weight: 600; text-decoration: none; border-color: var(--primary); color: var(--primary); background: white;">${t('praxis.view_doc', 'Ansehen')}</a>
        </div>
      `).join('')
    : `<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">${t('praxis.no_docs_uploaded', 'Keine Dokumente hochgeladen')}</div>`;

  const symptoms = (b.chips || []).join(', ') || t('common.none_given', 'Keine Angabe');
  const freitext = b.freitext || t('common.no_description', 'Keine Beschreibung');
  const staerke = b.staerke != null ? `${b.staerke} / 10` : t('common.none_given', 'Keine Angabe');
  const meds = m.keine ? t('praxis.no_meds', 'Keine Medikamente') : (m.liste || []).join(', ') || t('common.none_given', 'Keine Angabe');
  const allergien = a.keine ? t('praxis.no_allergies', 'Keine Allergien') : (a.liste || []).join(', ') || t('common.none_given', 'Keine Angabe');
  const allerAnm = a.anmerkungen || '';

  // Patient profile info
  const versicherung = patient
    ? `${patient.krankenversicherung === 'privat' ? t('profile.private', 'Privat') : t('profile.statutory', 'Gesetzlich')}${patient.krankenkasse ? ' (' + patient.krankenkasse + ')' : ''}`
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
              <span style="font-size: var(--font-size-xs); color: var(--gray-400); font-weight: 600;">${t('praxis.sent', 'Gesendet:')} ${sentDate}</span>
              <div style="display: flex; gap: var(--space-2); align-items: center;">
                ${h.email_sent ? `<span style="font-size: 10px; color: #059669; font-weight: 700;">${t('praxis.email_sent', '📧 E-Mail gesendet')}</span>` : `<span style="font-size: 10px; color: var(--gray-400);">${t('praxis.no_email', 'Keine E-Mail')}</span>`}
                <button class="btn-edit-hint" data-hint-id="${h.id}" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 2px 10px; border-radius: var(--radius-md); font-size: 11px; font-weight: 600; cursor: pointer;">${t('praxis.edit', 'Bearbeiten')}</button>
              </div>
            </div>
            ${hintList.length > 0 ? `<ul style="padding-left: 18px; margin: 0; font-size: var(--font-size-sm); color: var(--gray-700);">${hintList.map(ht => `<li style="margin-bottom: 4px;">${ht}</li>`).join('')}</ul>` : ''}
            ${h.custom_text ? `<div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--gray-700); font-style: italic; border-left: 2px solid var(--primary); padding-left: var(--space-3);">${h.custom_text}</div>` : ''}
          </div>
        `;
      }).join('')
    : '';

  const tabBtnStyle = (tabKey) => {
    const isActive = activeTab === tabKey;
    return `background: ${isActive ? 'white' : 'transparent'}; color: ${isActive ? 'var(--primary)' : 'var(--gray-600)'}; border: 1px solid ${isActive ? 'var(--gray-200)' : 'transparent'}; border-bottom: 3px solid ${isActive ? 'var(--primary)' : 'transparent'}; border-radius: var(--radius-md) var(--radius-md) 0 0; padding: 8px 4px; font-size: 12px; font-weight: ${isActive ? '700' : '600'}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; text-align: center; margin-bottom: -1px; transition: all 0.15s; width: 100%; box-sizing: border-box;`;
  };

  return `
    <!-- Termin Info Bar (Always Visible) -->
    <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--primary-lightest); border-radius: var(--radius-lg); margin-bottom: var(--space-4); border: 1px solid rgba(16,122,202,0.15);">
      <span style="font-size: var(--font-size-lg);">📅</span>
      <div>
        <span style="font-size: var(--font-size-sm); font-weight: 700; color: var(--primary);">${termin.date} · ${termin.time}</span>
        <span style="font-size: var(--font-size-xs); color: var(--gray-500); display: block;">${termin.art} · ${termin.doctor}</span>
      </div>
      <div style="margin-left: auto;">
        ${termin.precheck_submitted
          ? `<span style="background: #ECFDF5; color: #059669; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">${t('status.precheck_done', '✓ Pre-Check-In erledigt')}</span>`
          : `<span style="background: #FEF2F2; color: #DC2626; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">${t('status.precheck_pending', '⏳ Pre-Check-In ausstehend')}</span>`
        }
      </div>
    </div>

    <!-- Tab Navigation Bar (Grid template fits all 4 tabs seamlessly without horizontal scrolling) -->
    <div class="pdm-tabs-header" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: var(--bg-gray); padding: 6px 6px 0 6px; border: 1px solid var(--gray-200); border-radius: var(--radius-lg) var(--radius-lg) 0 0; margin-bottom: var(--space-4); flex-shrink: 0;">
      <button class="pdm-tab-btn ${activeTab === 'patient' ? 'active' : ''}" data-tab="patient" style="${tabBtnStyle('patient')}">
        👤 ${t('praxis.tab_patient')}
      </button>
      <button class="pdm-tab-btn ${activeTab === 'precheck' ? 'active' : ''}" data-tab="precheck" style="${tabBtnStyle('precheck')}">
        🩺 ${t('praxis.tab_precheck')}
      </button>
      <button class="pdm-tab-btn ${activeTab === 'ai' ? 'active' : ''}" data-tab="ai" style="${tabBtnStyle('ai')}">
        🤖 ${t('praxis.tab_ai')}
      </button>
      <button class="pdm-tab-btn ${activeTab === 'hints' ? 'active' : ''}" data-tab="hints" style="${tabBtnStyle('hints')}">
        💡 ${t('praxis.tab_hints')}
      </button>
    </div>

    <!-- TAB 1: Patient, Notizen & Freigegebene Dokumente -->
    <div id="pdm-tab-content-patient" class="pdm-tab-content" style="display: ${activeTab === 'patient' ? 'block' : 'none'};">
      <!-- Section 1: Patient Info -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.patient_info', '👤 Patienteninformationen')}</h4>
        <div class="pdm-info-grid">
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.name', 'Name')}</span>
            <span class="pdm-info-value">${patientName}</span>
          </div>
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.dob', 'Geburtsdatum')}</span>
            <span class="pdm-info-value">${patient?.geburtsdatum || '–'}</span>
          </div>
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.phone', 'Telefon')}</span>
            <span class="pdm-info-value">${patient?.telefonnummer || '–'}</span>
          </div>
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.address', 'Adresse')}</span>
            <span class="pdm-info-value">${adresse}</span>
          </div>
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.insurance', 'Versicherung')}</span>
            <span class="pdm-info-value">${versicherung}</span>
          </div>
          <div class="pdm-info-row">
            <span class="pdm-info-label">${t('profile.email', 'E-Mail')}</span>
            <span class="pdm-info-value">${patient?.email || '–'}</span>
          </div>
        </div>
      </div>

      <!-- Section 2: Doctor Notes -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.doctor_notes', '📝 Eigene Notizen (nur für Sie sichtbar)')}</h4>
        <textarea id="doctor-note-input" class="pdm-note-textarea" placeholder="${t('praxis.notes_placeholder', 'Notizen zum Termin eingeben...')}">${note?.note_text || ''}</textarea>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2);">
          <span id="doctor-note-status" style="font-size: var(--font-size-xs); color: var(--gray-400);"></span>
          <button id="btn-save-note" class="btn btn-primary" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
            ${t('praxis.save_note', '💾 Notiz speichern')}
          </button>
        </div>
      </div>

      <!-- Section 3: Shared Documents -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.share_docs_title', '📂 Dokumente für den Patienten bereitstellen (Laborberichte, Rezepte, etc.)')}</h4>
        <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-3);">
          ${t('praxis.shared_docs_desc', 'Hier hochgeladene Dateien werden für den Patienten in seinem Portal freigegeben und er erhält eine sofortige Benachrichtigung per E-Mail.')}
        </p>
        
        <div id="praxis-shared-docs-list" style="margin-bottom: var(--space-4);">
          ${
            sharedDocuments && sharedDocuments.length > 0
              ? sharedDocuments.map(doc => `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--bg-gray); border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2);">
                    <div>
                      <span style="font-size: var(--font-size-sm); color: var(--gray-700); font-weight: 700;">📄 ${doc.filename} (${formatBytes(doc.file_size || doc.fileSize)})</span>
                      <span style="font-size: 10px; color: var(--gray-400); display: block; font-weight: 600;">${t('documents.category', 'Kategorie')}: ${doc.doc_category || t('docs.type_other', 'Sonstiges')}</span>
                    </div>
                    <a href="/api/file/${doc.id}" target="_blank" class="btn btn-outline" style="padding: 2px 10px; font-size: 11px; font-weight: 600; text-decoration: none; border-color: var(--primary); color: var(--primary); background: white;">${t('praxis.view_doc', 'Ansehen')}</a>
                  </div>
                `).join('')
              : `<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; margin-bottom: var(--space-3);">${t('praxis.no_shared_docs', 'Noch keine Dokumente freigegeben')}</div>`
          }
        </div>
        
        <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
          <div id="praxis-upload-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); display: none; font-weight: 600; margin-bottom: var(--space-3);"></div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); align-items: flex-end;">
            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">${t('praxis.doc_type_label', 'Dokumententyp *')}</label>
              <select id="praxis-upload-category" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: 6px; font-size: var(--font-size-xs); background: white; cursor: pointer; height: 32px;">
                <option value="Laborbefund">${t('docs.type_lab', 'Laborbefund')}</option>
                <option value="Arztbrief">${t('docs.type_letter', 'Arztbrief')}</option>
                <option value="eRezept">${t('docs.type_erezept', 'eRezept')}</option>
                <option value="Sonstiges">${t('docs.type_other', 'Sonstiges')}</option>
              </select>
            </div>
            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">${t('praxis.select_file', 'Datei auswählen *')}</label>
              <input type="file" id="praxis-upload-file-input" style="font-size: var(--font-size-xs); width: 100%;">
            </div>
          </div>
          <button id="btn-praxis-upload-doc" class="btn btn-primary" style="margin-top: var(--space-3); width: 100%; padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
            ${t('praxis.share_doc_btn', '📤 Dokument freigeben & Patient benachrichtigen')}
          </button>
        </div>
      </div>

      <!-- Section 4: Patient Feedback -->
      ${termin.rating != null ? `
      <div class="pdm-section" style="margin-bottom: var(--space-5); background: #FFFBEB; border: 1px solid #FCD34D; padding: var(--space-4); border-radius: var(--radius-lg);">
        <h4 class="pdm-section-title" style="color: #D97706; margin-bottom: var(--space-2); font-weight: 800; display: flex; align-items: center; gap: 6px;">
          ${t('praxis.patient_feedback', '⭐ Patienten-Feedback & Bewertung')}
        </h4>
        <div style="font-size: var(--font-size-lg); font-weight: 700; color: #D97706; display: flex; align-items: center; gap: 4px; margin-bottom: var(--space-2);">
          ${'★'.repeat(termin.rating)}${'☆'.repeat(5 - termin.rating)} 
          <span style="font-size: var(--font-size-xs); color: var(--gray-600); font-weight: 600; margin-left: 4px;">${t('praxis.rating_stars', '({rating} von 5 Sternen)').replace('{rating}', termin.rating)}</span>
        </div>
        ${termin.feedback_text ? `
          <div style="font-size: var(--font-size-sm); color: var(--gray-800); font-style: italic; background: white; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid #FEF3C7; line-height: 1.4;">
            "${termin.feedback_text}"
          </div>
        ` : ''}
      </div>
      ` : ''}
    </div>

    <!-- TAB 2: Pre-Check-In -->
    <div id="pdm-tab-content-precheck" class="pdm-tab-content" style="display: ${activeTab === 'precheck' ? 'block' : 'none'};">
      ${termin.precheck_submitted ? `
      <!-- Section: PreCheck Summary -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.precheck_summary', '🩺 Pre-Check-In Zusammenfassung')}</h4>
        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div>
            <div class="pdm-subsection-title">${t('praxis.complaints', 'Beschwerden')}</div>
            <div class="pdm-data-block">
              <div><strong>${t('praxis.symptoms', 'Symptome')}:</strong> ${symptoms}</div>
              <div style="margin-top: var(--space-1);"><strong>${t('praxis.description', 'Beschreibung')}:</strong> ${freitext}</div>
              <div style="margin-top: var(--space-1);"><strong>${t('praxis.pain_level', 'Schmerzstärke')}:</strong> ${staerke}</div>
            </div>
          </div>
          <div>
            <div class="pdm-subsection-title">${t('praxis.medications', 'Medikamente')}</div>
            <div class="pdm-data-block">${meds}</div>
          </div>
          <div>
            <div class="pdm-subsection-title">${t('praxis.allergies', 'Allergien')}</div>
            <div class="pdm-data-block">${allergien}${allerAnm ? `<div style="margin-top: var(--space-1);"><strong>${t('praxis.notes', 'Anmerkungen')}:</strong> ${allerAnm}</div>` : ''}</div>
          </div>
          ${hasCustomAnswers ? `
          <div>
            <div class="pdm-subsection-title">${t('praxis.additional_questions', 'Zusatzfragen')}</div>
            <div class="pdm-data-block">
              ${Object.entries(customAnswers).map(([q, a]) => {
                const ansText = Array.isArray(a) ? a.join(', ') : (a || t('common.no_answer', 'Keine Antwort'));
                return `<div style="margin-bottom: var(--space-2);"><strong style="font-size: 11px; text-transform: uppercase; color: var(--gray-500);">${q}</strong><br><span style="font-weight: 600;">${ansText}</span></div>`;
              }).join('')}
            </div>
          </div>
          ` : ''}
          <div>
            <div class="pdm-subsection-title">${t('praxis.uploaded_docs', 'Hochgeladene Dokumente')}</div>
            <div class="pdm-data-block" style="padding: var(--space-3);">
              ${docsHtml}
            </div>
          </div>
          ${Object.keys(docConfirmations).length > 0 ? `
          <div>
            <div class="pdm-subsection-title">${t('praxis.doc_confirmations', 'Dokumentenbestätigungen')}</div>
            <div class="pdm-data-block" style="padding: var(--space-3);">
              ${Object.entries(docConfirmations).map(([docId, conf]) => {
                const statusColor = conf.status === 'rejected' ? '#DC2626' : '#059669';
                const statusBg = conf.status === 'rejected' ? '#FEF2F2' : '#ECFDF5';
                const statusLabel = conf.status === 'confirmed' ? t('status.confirmed', '✓ Bestätigt') : conf.status === 'accepted' ? t('status.accepted', '✓ Akzeptiert') : conf.status === 'rejected' ? t('status.rejected', '✗ Abgelehnt') : t('status.pending', '– Ausstehend');
                const docItem = praxisDocuments.find(d => String(d.id) === String(docId));
                const docTitle = docItem ? docItem.title : `${t('praxis.documents', 'Dokument')} #${docId}`;
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
        </div>
      </div>
      ` : `
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">🩺 Pre-Check-In</h4>
        <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-5); text-align: center; border: 1px dashed var(--gray-300);">
          <p style="font-size: var(--font-size-sm); color: var(--gray-500);">${t('praxis.precheck_not_completed', 'Der Pre-Check-In wurde noch nicht ausgefüllt.')}</p>
        </div>
      </div>
      `}
    </div>

    <!-- TAB 3: Separated KI-Assistent -->
    <div id="pdm-tab-content-ai" class="pdm-tab-content" style="display: ${activeTab === 'ai' ? 'block' : 'none'};">
      ${termin.precheck_submitted ? `
      <div class="pdm-section" id="ai-assessments-section" style="margin-bottom: var(--space-5); background: #f8fafc; border: 1px solid #e2e8f0; padding: var(--space-4); border-radius: var(--radius-lg);">
        <h4 class="pdm-section-title" style="color: var(--primary); margin-bottom: var(--space-3); font-weight: 800; display: flex; align-items: center; gap: 6px;">
          ${t('praxis.ai_assistant', '🤖 KI-Assistent')}
        </h4>
        <div id="ai-assessments-container" style="min-height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px;">
          <div class="dl-auth-spinner" style="width: 24px; height: 24px; border-width: 2.5px; border-color: var(--primary) transparent transparent transparent;"></div>
          <p class="text-muted" style="margin-top: var(--space-1); font-size: var(--font-size-xs); font-weight: 600;">${t('praxis.ai_loading', 'KI-Assistent wird geladen...')}</p>
        </div>
        
        <!-- Diagnostic Anamnese Assessment Area -->
        <div id="anamnesis-assessment-section" style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid #e2e8f0; display: none;">
          <button id="btn-generate-diagnostics" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; font-size: var(--font-size-sm); border: 1px solid var(--primary); color: var(--primary); background: white; padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
            ${t('praxis.ai_assessment_btn', '🧠 Einschätzung aus Anamnese')}
          </button>
          <div id="diagnostics-loading-container" style="display: none; flex-direction: column; align-items: center; margin-top: var(--space-3); gap: 6px;">
            <div class="dl-auth-spinner" style="width: 20px; height: 20px; border-width: 2px; border-color: var(--primary) transparent transparent transparent;"></div>
            <span style="font-size: var(--font-size-xs); color: var(--gray-500); font-weight: 600;">${t('praxis.ai_analyzing', 'Analysiere Anamnese und generiere Einschätzung...')}</span>
          </div>
          <div id="diagnostics-result-box" style="display: none; margin-top: var(--space-3); padding: var(--space-3); background: #eff6ff; border-left: 4px solid var(--primary); border-radius: 0 var(--radius-md) var(--radius-md) 0;">
            <h5 style="font-size: var(--font-size-xs); font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: var(--space-1); display: flex; align-items: center; gap: 4px;">
              ${t('praxis.medical_suspicion', '📋 Medizinische Verdachtseinschätzung')}
            </h5>
            <p id="diagnostics-result-text" style="font-size: var(--font-size-sm); color: #1e3a8a; margin: 0; line-height: 1.4; font-weight: 500;"></p>
          </div>
        </div>
      </div>

      ${hasAiQuestions ? `
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title" style="display: flex; align-items: center; gap: 6px;">
          ${termin.ai_consent === false ? t('praxis.std_followup_questions', '📋 Standardisierte Folgefragen') : t('praxis.ai_followup_questions', '🤖 Spezifische Folgefragen (KI)')}
        </h4>
        <div class="pdm-data-block">
          ${aiQuestions.map((q, idx) => `
            <div style="margin-bottom: var(--space-2); border-left: 2px solid var(--primary); padding-left: var(--space-2); padding-top: 2px; padding-bottom: 2px;">
              <strong style="font-size: 11px; text-transform: uppercase; color: var(--gray-500);">${idx + 1}. ${q.question}</strong><br>
              <span style="font-weight: 600;">${q.answer || t('common.no_answer', 'Keine Antwort')}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      ` : `
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">🤖 KI-Assistent</h4>
        <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-5); text-align: center; border: 1px dashed var(--gray-300);">
          <p style="font-size: var(--font-size-sm); color: var(--gray-500);">${t('praxis.precheck_not_completed', 'Der Pre-Check-In wurde noch nicht ausgefüllt.')}</p>
        </div>
      </div>
      `}
    </div>

    <!-- TAB 4: Hinweise & Nachsorge -->
    <div id="pdm-tab-content-hints" class="pdm-tab-content" style="display: ${activeTab === 'hints' ? 'block' : 'none'};">
      <!-- Section: Patient Hints -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.patient_hints', '💡 Hinweise an den Patienten')}</h4>
        ${hintsHtml || `<p style="font-size: var(--font-size-sm); color: var(--gray-400); margin-bottom: var(--space-3);">${t('praxis.no_hints_sent', 'Noch keine Hinweise gesendet.')}</p>`}
        <button id="btn-send-hint" class="btn" style="background: var(--primary); color: white; padding: var(--space-3) var(--space-5); border-radius: var(--radius-lg); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: var(--space-3); font-size: var(--font-size-sm);">
          ${t('praxis.send_hint', '📨 Hinweis schicken')}
        </button>
      </div>

      <!-- Section: Aftercare Instructions -->
      <div class="pdm-section" style="margin-bottom: var(--space-5);">
        <h4 class="pdm-section-title">${t('praxis.aftercare_title', '🩺 Nachsorge-Hinweise (Post-Treatment)')}</h4>
        <p style="font-size: var(--font-size-xs); color: var(--gray-500); margin-bottom: var(--space-3);">
          ${t('praxis.aftercare_desc', 'Senden Sie dem Patienten nach dem Termin wichtige Anweisungen (z. B. Schonung, Wundpflege, Kühlung) per E-Mail.')}
        </p>

        <div id="praxis-aftercare-list" style="margin-bottom: var(--space-4);">
          ${
            aftercareInstructions && aftercareInstructions.length > 0
              ? aftercareInstructions.map(instr => `
                  <div style="padding: var(--space-3); background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: var(--space-2); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 10px; color: var(--gray-400); margin-bottom: var(--space-1); font-weight: 600;">
                      ${t('praxis.sent_at_label', 'Gesendet am {date} Uhr').replace('{date}', new Date(instr.sent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }))} ${instr.email_sent ? `· ${t('praxis.email_sent', '📧 E-Mail gesendet')}` : ''}
                    </div>
                    <div style="font-size: var(--font-size-sm); color: var(--gray-700); font-style: italic; white-space: pre-wrap; line-height: 1.4;">"${instr.instructions}"</div>
                  </div>
                `).join('')
              : `<div style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; margin-bottom: var(--space-3);">${t('praxis.no_aftercare_sent', 'Noch keine Nachsorge-Hinweise gesendet.')}</div>`
          }
        </div>

        <div style="background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
          <div id="praxis-aftercare-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); display: none; font-weight: 600; margin-bottom: var(--space-3);"></div>
          
          <textarea id="praxis-aftercare-input" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); min-height: 80px; margin-bottom: var(--space-2); background: white; resize: vertical;" placeholder="${t('praxis.aftercare_ph', 'Z. B. Bitte denken Sie daran, die Wunde heute noch zu kühlen und keinen Sport zu treiben.')}"></textarea>
          
          <button id="btn-send-aftercare" class="btn btn-primary" style="width: 100%; padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">
            ${t('praxis.send_aftercare_btn', '📨 Nachsorge-Hinweise per E-Mail senden')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachDetailListeners(terminCode, existingNote, existingHints, sharedDocuments = [], aftercareInstructions = []) {
  // Tab switching listener
  const tabBtns = document.querySelectorAll('.pdm-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabKey = e.currentTarget.getAttribute('data-tab');
      currentActiveTab = tabKey;

      tabBtns.forEach(b => {
        const isActive = b.getAttribute('data-tab') === tabKey;
        if (isActive) {
          b.classList.add('active');
          b.style.background = 'white';
          b.style.color = 'var(--primary)';
          b.style.border = '1px solid var(--gray-200)';
          b.style.borderBottom = '3px solid var(--primary)';
          b.style.fontWeight = '700';
        } else {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--gray-600)';
          b.style.border = '1px solid transparent';
          b.style.borderBottom = '3px solid transparent';
          b.style.fontWeight = '600';
        }
      });

      document.querySelectorAll('.pdm-tab-content').forEach(el => {
        el.style.display = 'none';
      });

      const activeEl = document.getElementById(`pdm-tab-content-${tabKey}`);
      if (activeEl) {
        activeEl.style.display = 'block';
        if (tabKey === 'ai' && document.getElementById('ai-assessments-container')) {
          fetchAiAssessments(terminCode);
        }
      }
    });
  });

  // Load AI assessments if the container exists
  if (document.getElementById('ai-assessments-container')) {
    fetchAiAssessments(terminCode);
  }

  // Diagnostics generator listener
  const btnGen = document.getElementById('btn-generate-diagnostics');
  const loaderGen = document.getElementById('diagnostics-loading-container');
  const resultBox = document.getElementById('diagnostics-result-box');
  const resultText = document.getElementById('diagnostics-result-text');

  if (btnGen) {
    btnGen.addEventListener('click', async () => {
      btnGen.disabled = true;
      btnGen.style.opacity = '0.6';
      if (loaderGen) loaderGen.style.display = 'flex';
      if (resultBox) resultBox.style.display = 'none';

      try {
        const res = await fetch(`/api/praxis/termin/${terminCode}/anamnesis-assessment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success && data.anamnesis_assessment) {
          if (resultText) resultText.textContent = data.anamnesis_assessment;
          if (resultBox) resultBox.style.display = 'block';
        } else {
          alert('Fehler beim Generieren der Einschätzung: ' + (data.error || 'Unbekannter Fehler'));
        }
      } catch (err) {
        console.error('Diagnostics generation failed:', err);
        alert('Fehler beim Generieren der Einschätzung.');
      } finally {
        btnGen.disabled = false;
        btnGen.style.opacity = '1';
        if (loaderGen) loaderGen.style.display = 'none';
      }
    });
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
          <h3 class="dl-modal-title">${isEdit ? t('praxis.edit_hint_title', '✏️ Hinweis bearbeiten') : t('praxis.send_hint_title', '📨 Hinweis an Patienten')}</h3>
          <button class="dl-modal-close" id="btn-close-hint">&times;</button>
        </div>
        <div class="dl-modal-body" style="overflow-y: auto; padding: var(--space-6); flex-grow: 1;" id="hint-modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--gray-500); margin-bottom: var(--space-5); line-height: 1.5;">
            ${t('praxis.custom_questions_desc', 'Wählen Sie Hinweise aus oder schreiben Sie eine individuelle Nachricht.')}
            ${isEdit ? t('praxis.hint_modal_desc_edit', 'Nach der Bearbeitung können Sie erneut eine E-Mail senden.') : t('praxis.hint_modal_desc_new', 'Der Hinweis wird per E-Mail zugestellt und im Pre-Check-In angezeigt.')}
          </p>

          <div id="hint-options-container">
            <!-- Options loaded dynamically -->
          </div>

          <div style="margin-top: var(--space-5);">
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">${t('praxis.custom_msg_label', 'Individuelle Nachricht (optional)')}</label>
            <textarea id="hint-custom-text" placeholder="${t('praxis.custom_msg_ph', 'Z.B.: Bitte rufen Sie uns vorher an, wenn Sie sich verspäten...')}"
                      style="width: 100%; min-height: 80px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-sm); resize: vertical; font-family: var(--font-family);">${customText}</textarea>
          </div>

          <div style="margin-top: var(--space-4);">
            <button id="btn-hint-settings" type="button" style="background: none; border: none; color: var(--gray-500); font-size: var(--font-size-xs); cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600; text-decoration: underline;">
              ${t('praxis.edit_default_hints', '⚙️ Standard-Hinweise anpassen')}
            </button>
          </div>

          <!-- Settings area (hidden by default) -->
          <div id="hint-settings-area" style="display: none; margin-top: var(--space-4); background: var(--bg-gray); border-radius: var(--radius-lg); padding: var(--space-4); border: 1px solid var(--gray-200);">
            <h5 style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-700); margin-bottom: var(--space-3);">${t('praxis.edit_default_hints_title', 'Standard-Hinweise bearbeiten')}</h5>
            <div id="hint-settings-list"></div>
            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
              <button id="btn-add-default-hint" type="button" style="background: var(--primary-lightest); color: var(--primary); border: 1px dashed var(--primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">${t('praxis.add_btn', '+ Hinzufügen')}</button>
              <button id="btn-save-default-hints" type="button" style="background: var(--primary); color: white; border: none; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer;">${t('praxis.save_btn', '💾 Speichern')}</button>
            </div>
            <div id="hint-settings-status" style="font-size: var(--font-size-xs); color: var(--gray-400); margin-top: var(--space-2);"></div>
          </div>
        </div>
        <div class="dl-modal-footer" style="flex-shrink: 0; display: flex; gap: var(--space-3); justify-content: flex-end;">
          <button type="button" class="btn btn-outline" id="btn-cancel-hint" style="padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer;">${t('common.cancel', 'Abbrechen')}</button>
          <button type="button" class="btn btn-primary" id="btn-submit-hint" style="padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--font-size-sm); cursor: pointer; font-weight: 700;">
            ${isEdit ? t('praxis.update_hint_btn', '📧 Hinweis aktualisieren & senden') : t('praxis.submit_hint_btn', '📧 Hinweis versenden')}
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
    btn.textContent = t('common.sending', 'Wird gesendet...');

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
      btn.textContent = t('common.sent', '✓ Gesendet!');
      btn.style.background = '#059669';
      setTimeout(() => {
        close();
        // Reload the detail modal to show updated hints
        loadPatientDetails(terminCode);
      }, 1000);
    } catch (err) {
      console.error('Error submitting hint:', err);
      btn.textContent = t('common.error_retry', 'Fehler – erneut versuchen');
      btn.disabled = false;
    }
  });
}

async function loadHintOptions(selectedHints) {
  const container = document.getElementById('hint-options-container');
  if (!container) return;

  // Try to load custom defaults from server
  let options = getDefaultHints();
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
          ${t('praxis.ai_suggestions_title', '🤖 KI-Vorschläge (vorselektiert)')}
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
            <span style="font-size: 10px; color: var(--gray-500); margin-top: 2px; font-style: italic;">${t('praxis.based_on_ai', 'Basierend auf KI:')} "${item.text}"</span>
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

  let options = getDefaultHints();
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

    if (data.consentDeclined) {
      container.innerHTML = `
        <div style="width: 100%; padding: var(--space-4); background: #f8fafc; border: 1px dashed var(--gray-300); border-radius: var(--radius-md); text-align: center; color: var(--gray-500); font-size: var(--font-size-sm); line-height: 1.4;">
          <span style="font-size: 20px; display: block; margin-bottom: 4px;">📋</span>
          ${t('praxis.ai_declined_msg', 'Der Patient hat der KI-gestützten Auswertung widersprochen. Der KI-Assistent steht nicht zur Verfügung.')}
        </div>
      `;
      const diagSection = document.getElementById('anamnesis-assessment-section');
      if (diagSection) diagSection.style.display = 'none';
    } else if (data.success && data.ai_assessments) {
      let assessments = data.ai_assessments;
      if (typeof assessments === 'string') {
        try { assessments = JSON.parse(assessments); } catch (e) {}
      }
      currentAiAssessments = assessments;
      renderAiAssessments(terminCode);

      const diagSection = document.getElementById('anamnesis-assessment-section');
      if (diagSection) diagSection.style.display = 'block';

      if (data.anamnesis_assessment) {
        const resultBox = document.getElementById('diagnostics-result-box');
        const resultText = document.getElementById('diagnostics-result-text');
        if (resultBox && resultText) {
          resultText.textContent = data.anamnesis_assessment;
          resultBox.style.display = 'block';
        }
      }
    } else {
      container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">${t('praxis.no_ai_recommendations', 'Keine Empfehlungen des KI-Assistenten verfügbar.')}</p>`;
    }
  } catch (err) {
    console.error('Error fetching AI assessments:', err);
    container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic;">${t('praxis.ai_error_loading', 'Fehler beim Laden des KI-Assistenten.')}</p>`;
  }
}

function renderAiAssessments(terminCode) {
  const container = document.getElementById('ai-assessments-container');
  if (!container) return;

  const doctorTodos = currentAiAssessments?.doctorTodos || [];
  const patientTodos = currentAiAssessments?.patientTodos || [];

  if (doctorTodos.length === 0 && patientTodos.length === 0) {
    container.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--gray-400); font-style: italic; text-align: center; width: 100%;">${t('praxis.ai_all_processed', 'Alle Einschätzungen wurden bearbeitet oder ausgeblendet.')}</p>`;
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
        <button class="btn-ai-add" data-id="${item.id}" title="${t('praxis.add_to_notes', 'Zu Notizen hinzufügen')}" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px; font-weight: 600; transition: transform 0.1s ease; outline: none;">
          ${t('praxis.add_to_notes', '➕ Zu Notizen')}
        </button>
        <button class="btn-ai-remove" data-id="${item.id}" title="${t('praxis.remove', 'Entfernen')}" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; transition: transform 0.1s ease; outline: none;">
          ${t('praxis.remove', '❌ Entfernen')}
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
      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2);">
        <button class="btn-ai-add" data-id="${item.id}" title="${t('praxis.add_to_notes', 'Zu Notizen hinzufügen')}" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 2px; font-weight: 600; transition: transform 0.1s ease; outline: none;">
          ${t('praxis.add_to_notes', '➕ Zu Notizen')}
        </button>
        <button class="btn-ai-remove" data-id="${item.id}" title="${t('praxis.remove', 'Entfernen')}" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; transition: transform 0.1s ease; outline: none;">
          ${t('praxis.remove', '❌ Entfernen')}
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
      const item = doctorTodos.find(t => t.id === id) || patientTodos.find(t => t.id === id);
      if (item) {
        addTodoToNotes(item.text);
        // Automatically save notes to DB by triggering click on save button
        const saveBtn = document.getElementById('btn-save-note');
        if (saveBtn) {
          saveBtn.click();
        }
        removeAiAssessment(terminCode, id);
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
