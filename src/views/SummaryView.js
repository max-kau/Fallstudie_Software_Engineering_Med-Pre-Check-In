import { renderHeader } from '../components/Header.js';
import { store } from '../utils/store.js';
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { openDocumentViewerModal } from '../components/DocumentViewerModal.js';
import { t } from '../utils/i18n.js';

function formatGermanDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return dateStr;
}

function getDauerMap() {
  return {
    heute: t('beschwerden.duration_today'),
    einige_tage: t('beschwerden.duration_days'),
    eine_woche: t('beschwerden.duration_week'),
    mehrere_wochen: t('beschwerden.duration_weeks'),
    monate: t('beschwerden.duration_months'),
    laenger: t('beschwerden.duration_longer')
  };
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function renderSummaryView() {
  const allData = store.getAll();
  const b = allData.beschwerden;
  const m = allData.medikamente;
  const a = allData.allergien;
  const d = allData.dokumente || { liste: [] };
  const dauerMap = getDauerMap();

  if (allData.submitted) return renderSuccessScreen();

  const symptomsList = [...b.chips];
  const beschwerdenContent = `
    ${symptomsList.length ? `<div class="summary-item"><div class="summary-item-label">${t('summary.selected_symptoms')}</div>${symptomsList.join(', ')}</div>` : ''}
    ${b.freitext ? `<div class="summary-item"><div class="summary-item-label">${t('summary.description')}</div>${b.freitext}</div>` : ''}
    ${b.dauer ? `<div class="summary-item"><div class="summary-item-label">${t('summary.duration')}</div>${dauerMap[b.dauer] || b.dauer}</div>` : ''}
    <div class="summary-item"><div class="summary-item-label">${t('summary.severity')}</div>${b.staerke} / 10</div>
  `;

  const customQuestions = store.getCustomQuestions();
  const customAnswers = allData.customAnswers || {};
  const hasCustomQuestions = customQuestions.length > 0;

  const customContent = hasCustomQuestions
    ? customQuestions.map(q => {
        const ans = customAnswers[q.question_text];
        const displayAns = Array.isArray(ans) ? ans.join(', ') : (ans || t('summary.no_answer'));
        return `
          <div class="summary-item">
            <div class="summary-item-label">${q.question_text}</div>
            ${displayAns}
          </div>
        `;
      }).join('')
    : '';

  const medContent = m.keine
    ? `<div class="summary-item">${t('summary.no_meds')}</div>`
    : (m.liste.length ? `<div class="summary-item">${m.liste.join(', ')}</div>` : `<div class="summary-item text-muted">${t('summary.no_info')}</div>`);

  const allerContent = a.keine
    ? `<div class="summary-item">${t('summary.no_allergies')}</div>`
    : `${a.liste.length ? `<div class="summary-item">${a.liste.join(', ')}</div>` : `<div class="summary-item text-muted">${t('summary.no_info')}</div>`}
       ${a.anmerkungen ? `<div class="summary-item"><div class="summary-item-label">${t('summary.notes')}</div>${a.anmerkungen}</div>` : ''}`;

  const docsContent = d.liste.length
    ? d.liste.map(file => `
        <div class="summary-item" style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
          <span>📄 ${file.filename} (${formatBytes(file.fileSize)})</span>
          <a href="/api/file/${file.id}" target="_blank" style="color: var(--primary); text-decoration: underline; font-size: var(--font-size-xs); font-weight: 500;">${t('summary.view')}</a>
        </div>
      `).join('')
    : `<div class="summary-item text-muted">${t('summary.no_docs')}</div>`;

  const aiQuestions = allData.aiQuestions || [];
  const hasAiQuestions = aiQuestions.length > 0;
  const aiQuestionsContent = hasAiQuestions
    ? aiQuestions.map((q, idx) => `
        <div class="summary-item">
          <div class="summary-item-label">${idx + 1}. ${q.question}</div>
          <div style="font-weight: 500; color: var(--gray-800); margin-top: 4px;">${q.answer || t('summary.no_answer')}</div>
        </div>
      `).join('')
    : `<div class="summary-item text-muted">${t('summary.no_ai_q')}</div>`;

  return `
    ${renderHeader()}
    <div class="view">
      <div class="container container--form">
        <div class="view-content" style="padding-top:var(--space-8)">
          <h2 style="margin-bottom:var(--space-2)">${t('summary.title')}</h2>
          <p class="text-muted" style="margin-bottom:var(--space-6)">${t('summary.subtitle')}</p>

          <!-- Demonstrationshinweis -->
          <div style="background: #FFFBEB; border: 1px solid #FEF3C7; color: #B45309; padding: var(--space-4); border-radius: var(--radius-lg); margin-bottom: var(--space-6); font-size: var(--font-size-xs); display: flex; gap: var(--space-3); align-items: flex-start; line-height: 1.5;">
            <span style="font-size: var(--font-size-lg); line-height: 1;">⚠️</span>
            <div>
              <strong>${t('summary.demo_notice_title')}</strong> ${t('summary.demo_notice_desc')}
            </div>
          </div>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">${t('summary.symptoms_title')}</div>
              <button class="summary-edit" data-edit="beschwerden">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${beschwerdenContent}</div>
          </div>

          ${hasCustomQuestions ? `
          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">${t('summary.custom_q_title')}</div>
              <button class="summary-edit" data-edit="zusatzfragen">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${customContent}</div>
          </div>
          ` : ''}

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">${t('summary.meds_title')}</div>
              <button class="summary-edit" data-edit="medikamente">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${medContent}</div>
          </div>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">${t('summary.allergies_title')}</div>
              <button class="summary-edit" data-edit="allergien">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${allerContent}</div>
          </div>

          ${hasAiQuestions ? `
          <div class="summary-section card fade-in-up" style="border-left: 4px solid var(--blue-600);">
            <div class="summary-header">
              <div class="summary-title" style="display: flex; align-items: center; gap: var(--space-2);">${t('summary.ai_q_title')}</div>
              <button class="summary-edit" data-edit="ai-fragen">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${aiQuestionsContent}</div>
          </div>
          ` : ''}

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">${t('summary.docs_title')}</div>
              <button class="summary-edit" data-edit="dokumente">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">${docsContent}</div>
          </div>

          <!-- Digital Signature Canvas Card -->
          <!-- Praxis Documents Confirmation Section -->
          <div id="praxis-docs-section" class="summary-section card fade-in-up" style="display: none;">
            <div class="summary-header">
              <div class="summary-title">${t('summary.praxis_docs_title')}</div>
              <button class="summary-edit" data-edit="praxis-dokumente">${t('summary.edit')}</button>
            </div>
            <div class="summary-content">
              <p class="text-muted" style="font-size: var(--font-size-xs); margin-bottom: var(--space-3); line-height: 1.5;">${t('summary.praxis_docs_desc')}</p>
              <div id="praxis-docs-list"></div>
            </div>
          </div>

          <div class="summary-section card fade-in-up" style="margin-top: var(--space-6);">
            <div class="summary-header">
              <div class="summary-title">${t('summary.signature_title')}</div>
              <button class="summary-edit" id="btn-clear-signature" style="color: var(--danger); background: transparent; border: none; cursor: pointer;">${t('summary.clear_signature')}</button>
            </div>
            <div class="summary-content" style="padding: 0; background: var(--white); border: 2px dashed var(--gray-200); border-radius: var(--radius-lg); overflow: hidden;">
              <canvas id="signature-canvas" style="width: 100%; height: 150px; display: block; cursor: crosshair; background: #fff;"></canvas>
            </div>
            <p class="text-muted" style="font-size: var(--font-size-xs); margin-top: var(--space-2);">${t('summary.signature_hint')}</p>
          </div>

          <label class="checkbox-group" style="margin:var(--space-4) 0">
            <input type="checkbox" class="checkbox-input" id="confirm-checkbox" />
            <span class="checkbox-label">${t('summary.confirm_checkbox')}</span>
          </label>

          <button class="btn btn-primary btn-lg btn-block" id="btn-submit" disabled>
            ${t('summary.submit_btn')}
          </button>
        </div>
      </div>
    </div>`;
}

function renderSuccessScreen() {
  const termin = store.getTerminInfo();
  const allData = store.getAll();

  // Find the generated summary PDF in the documents list
  const pdfFile = allData.dokumente.liste.find(f => f.filename.startsWith('Zusammenfassung_'));

  const pdfDownloadButton = pdfFile
    ? `<a href="/api/file/${pdfFile.id}" target="_blank" class="btn btn-outline btn-lg btn-block" style="margin-top: var(--space-4); display: flex; align-items: center; justify-content: center; gap: var(--space-2); text-decoration: none;">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
         ${t('summary.download_pdf')}
       </a>`
    : '';

  return `
    ${renderHeader({ showSaveExit: false })}
    <div class="view">
      <div class="container container--form">
        <div class="view-content" style="justify-content:center">
          <div class="success-screen">
            <div class="success-icon success-animate">✓</div>
            <h2>${t('summary.success_headline')}</h2>
            <p style="margin-top:var(--space-3)">${t('summary.success_msg').replace('{praxis}', termin.praxis)}</p>
            <div class="termin-card" style="margin-top:var(--space-8);text-align:left">
              <div class="termin-icon">📅</div>
              <div class="termin-info">
                <div class="termin-doctor">${termin.doctor}</div>
                <div class="termin-date">${formatGermanDate(termin.date)}, ${termin.time} Uhr</div>
              </div>
            </div>
            ${pdfDownloadButton}
            <button class="btn btn-primary btn-lg btn-block" id="btn-success-home" style="margin-top: var(--space-4);">
              ${t('summary.back_home')}
            </button>
            <p class="text-muted" style="margin-top:var(--space-8);font-size:var(--font-size-sm)">${t('summary.close_window_hint')}</p>
          </div>
        </div>
      </div>
    </div>`;
}

function setupSuccessHomeButton() {
  const btnSuccessHome = document.getElementById('btn-success-home');
  if (btnSuccessHome) {
    btnSuccessHome.addEventListener('click', () => {
      store.resetProgress();
      navigate('landing');
    });
  }
}

function generatePDF(allData, signatureDataUrl) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const patient = store.getPatientInfo();
  const termin = store.getTerminInfo();
  const dauerMap = getDauerMap();

  // Title / Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(16, 122, 202); // Doctolib Blue
  doc.text('Doctolib Pre-Check-In Zusammenfassung', 20, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Erstellt am: ${new Date().toLocaleString('de-DE')}`, 20, 32);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 36, 190, 36);

  // Section 1: Patient & Appointment Details
  let y = 45;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('1. Patient & Termin', 20, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${patient.vorname} ${patient.nachname}`, 20, y);
  y += 5;
  doc.text(`Arzt/Praxis: ${termin.doctor} (${termin.praxis})`, 20, y);
  y += 5;
  doc.text(`Termin: ${formatGermanDate(termin.date)} um ${termin.time} Uhr`, 20, y);
  y += 5;
  doc.text(`Konsultationsart: ${termin.art}`, 20, y);
  y += 10;

  // Section 2: Complaints
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Medizinische Beschwerden', 20, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const symptoms = allData.beschwerden.chips.join(', ') || 'Keine Symptome ausgewählt';
  doc.text(`Ausgewählte Symptome: ${symptoms}`, 20, y);
  y += 5;

  const splitFreitext = doc.splitTextToSize(`Beschreibung: ${allData.beschwerden.freitext || 'Keine Freitextbeschreibung eingegeben'}`, 170);
  doc.text(splitFreitext, 20, y);
  y += splitFreitext.length * 5;

  const dauerText = allData.beschwerden.dauer ? (dauerMap[allData.beschwerden.dauer] || allData.beschwerden.dauer) : 'Keine Angabe';
  doc.text(`Dauer der Beschwerden: ${dauerText}`, 20, y);
  y += 5;
  doc.text(`Schmerzstärke: ${allData.beschwerden.staerke || 0} / 10`, 20, y);
  y += 12;

  // Section 2.5: Custom Questions (only if exists)
  const customQuestions = store.getCustomQuestions();
  const customAnswers = allData.customAnswers || {};
  if (customQuestions.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Zusatzfragen der Praxis', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const q of customQuestions) {
      const ans = customAnswers[q.question_text];
      const displayAns = Array.isArray(ans) ? ans.join(', ') : (ans || 'Keine Antwort');
      const lines = doc.splitTextToSize(`${q.question_text}: ${displayAns}`, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5;
    }
    y += 7;
  }

  // Section 3: Medications
  let sectionIdx = customQuestions.length > 0 ? 4 : 3;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionIdx}. Aktuelle Medikation`, 20, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const meds = allData.medikamente.keine ? 'Keine Medikamente angegeben' : (allData.medikamente.liste.join(', ') || 'Keine Angabe');
  doc.text(meds, 20, y);
  y += 10;

  // Section 4: Allergies
  sectionIdx++;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionIdx}. Allergien & Unverträglichkeiten`, 20, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const allergies = allData.allergien.keine ? 'Keine bekannten Allergien' : (allData.allergien.liste.join(', ') || 'Keine Angabe');
  doc.text(allergies, 20, y);
  y += 5;
  if (allData.allergien.anmerkungen) {
    doc.text(`Anmerkungen: ${allData.allergien.anmerkungen}`, 20, y);
    y += 5;
  }
  y += 5;

  // Section 4.5: AI Specific Questions
  const aiQuestions = allData.aiQuestions || [];
  if (aiQuestions.length > 0) {
    sectionIdx++;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionIdx}. Spezifische Folgefragen (KI)`, 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const q of aiQuestions) {
      const lines = doc.splitTextToSize(`${q.question}: ${q.answer || 'Keine Antwort'}`, 170);
      if (y + lines.length * 5 > 285) {
        doc.addPage();
        y = 25;
      }
      doc.text(lines, 20, y);
      y += lines.length * 5 + 2;
    }
    y += 5;
  }

  // Section 5: Documents
  sectionIdx++;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionIdx}. Hochgeladene Dokumente`, 20, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const docsList = allData.dokumente.liste.map(f => `${f.filename} (${formatBytes(f.fileSize)})`).join(', ') || 'Keine Dokumente hochgeladen';
  doc.text(docsList, 20, y);
  y += 10;

  // Section: Praxis Document Confirmations
  const docConfs = allData.documentConfirmations || {};
  const praxisDocs = store.getPraxisDocuments();
  if (praxisDocs.length > 0) {
    sectionIdx++;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionIdx}. Bereitgestellte Dokumente (Bestätigungen)`, 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const pd of praxisDocs) {
      const conf = docConfs[pd.id];
      const statusText = conf ? (conf.status === 'confirmed' ? 'Bestätigt' : conf.status === 'accepted' ? 'Akzeptiert' : conf.status === 'rejected' ? 'Abgelehnt' : 'Ausstehend') : 'Ausstehend';
      const lines = doc.splitTextToSize(`${pd.title}: ${statusText}${conf && conf.status === 'rejected' && conf.reason ? ' – ' + conf.reason : ''}`, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5;
    }
    y += 5;
  }

  // Section: Signature
  sectionIdx++;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionIdx}. Bestätigung & Digitale Unterschrift`, 20, y);

  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Hiermit bestätige ich, dass die vorstehenden Angaben nach bestem Wissen korrekt und vollständig gemacht wurden.', 20, y);
  y += 5;

  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, 'PNG', 20, y, 70, 20);
    y += 22;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Handzeichen von ${patient.vorname} ${patient.nachname}`, 20, y);

  // Footer / Watermark
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(180, 180, 180);
  doc.text('* DEMO-DOKUMENT - NUR FÜR SIMULATIONSZWECKE *', 105, 285, { align: 'center' });

  return doc;
}

export function initSummaryView() {
  console.log("DEBUG: initSummaryView called");
  // Edit buttons
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = btn.dataset.edit; });
  });

  const checkbox = document.getElementById('confirm-checkbox');
  const submitBtn = document.getElementById('btn-submit');
  const canvas = document.getElementById('signature-canvas');
  const clearBtn = document.getElementById('btn-clear-signature');

  let hasSigned = !!store.get('signature');
  let drawing = false;
  let ctx = null;
  let praxisDocs = [];

  function allDocsConfirmed() {
    if (praxisDocs.length === 0) return true;
    const confs = store.get('documentConfirmations') || {};
    return praxisDocs.every(doc => {
      const c = confs[doc.id];
      if (!c || !c.status) return false;
      if (c.status === 'rejected' && (!c.reason || c.reason.trim().length === 0)) return false;
      return true;
    });
  }

  function updateSubmitState() {
    if (checkbox && submitBtn) {
      submitBtn.disabled = !(checkbox.checked && hasSigned && allDocsConfirmed());
    }
  }

  function renderDocStatusBadge(doc) {
    const confs = store.get('documentConfirmations') || {};
    const c = confs[doc.id];
    if (!c || !c.status) {
      return `<div class="doc-status-badge doc-status-pending" title="Noch nicht bearbeitet"></div>`;
    }
    if (c.status === 'rejected') {
      return `<div class="doc-status-badge doc-status-rejected" title="${t('doc_modal.rejected')}">✗</div>`;
    }
    return `<div class="doc-status-badge doc-status-accepted" title="${c.status === 'confirmed' ? t('doc_modal.confirmed') : t('doc_modal.accepted')}">✓</div>`;
  }

  function renderPraxisDocsList() {
    console.log("DEBUG: renderPraxisDocsList called. praxisDocs =", praxisDocs);
    const listEl = document.getElementById('praxis-docs-list');
    const sectionEl = document.getElementById('praxis-docs-section');
    if (!listEl || !sectionEl) {
      console.warn("DEBUG: listEl or sectionEl is missing from the DOM");
      return;
    }

    if (praxisDocs.length === 0) {
      sectionEl.style.display = 'none';
      return;
    }

    sectionEl.style.display = 'block';
    listEl.innerHTML = praxisDocs.map(doc => `
      <div class="doc-confirm-item" data-doc-id="${doc.id}">
        <div class="doc-confirm-info">
          ${renderDocStatusBadge(doc)}
          <div class="doc-confirm-details">
            <span class="doc-confirm-title">${doc.title}</span>
            <span class="doc-confirm-type">${doc.doc_type === 'confirm' ? t('doc_modal.confirm') : t('doc_modal.accept')}</span>
          </div>
        </div>
        <button class="btn-doc-open" data-doc-id="${doc.id}" style="background: none; border: 1px solid var(--primary); color: var(--primary); padding: 4px 14px; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap;">
          ${t('dokumente.read_file')}
        </button>
      </div>
    `).join('');

    // Attach click handlers
    listEl.querySelectorAll('.btn-doc-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = parseInt(btn.dataset.docId);
        const doc = praxisDocs.find(d => d.id === docId);
        if (doc) {
          openDocumentViewerModal(doc, () => {
            renderPraxisDocsList();
            updateSubmitState();
          });
        }
      });
    });
  }

  // Load praxis documents
  (async () => {
    try {
      praxisDocs = await store.loadPraxisDocuments();
      renderPraxisDocsList();
      updateSubmitState();
    } catch (err) {
      console.warn('Failed to load praxis documents:', err);
    }
  })();

  if (canvas) {
    ctx = canvas.getContext('2d');
    
    // Support high DPI screens / correct coordinates
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || canvas.clientWidth || 450;
    canvas.height = rect.height || canvas.clientHeight || 150;

    ctx.strokeStyle = '#107ACA'; // Doctolib Blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature if exists
    const savedSignature = store.get('signature');
    if (savedSignature) {
      const img = new Image();
      img.src = savedSignature;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        hasSigned = true;
        updateSubmitState();
      };
    }

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - r.left) * (canvas.width / r.width),
        y: (clientY - r.top) * (canvas.height / r.height)
      };
    };

    const startDrawing = (e) => {
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    };

    const draw = (e) => {
      if (!drawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasSigned = true;
      updateSubmitState();
      e.preventDefault();
    };

    const stopDrawing = () => {
      if (drawing) {
        drawing = false;
        // Save the signature as a base64 DataURL
        const dataUrl = canvas.toDataURL('image/png');
        store.set('signature', dataUrl);
      }
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });
  }

  // Clear signature canvas
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      hasSigned = false;
      store.set('signature', null);
      updateSubmitState();
    });
  }

  // Checkbox state listener
  if (checkbox) {
    checkbox.addEventListener('change', updateSubmitState);
  }

  // Submit Pre-Check-In
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!checkbox.checked || !hasSigned) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="shimmer" style="display:inline-block;width:120px;height:20px;border-radius:10px"></span>';

      try {
        const patient = store.getPatientInfo();
        const allData = store.getAll();

        // 1. Generate client-side PDF document with signature embedded
        const doc = generatePDF(allData, allData.signature);
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // 2. Upload final PDF to backend database
        const terminCode = store.getTerminCode();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            terminCode,
            filename: `Zusammenfassung_${patient.vorname}_${patient.nachname}.pdf`,
            mimeType: 'application/pdf',
            fileData: pdfBase64
          })
        });

        if (!res.ok) throw new Error('PDF upload failed');
        const uploadResult = await res.json();

        if (uploadResult.success) {
          // 3. Inject generated PDF metadata into local documents state list
          const docs = allData.dokumente || { liste: [] };
          docs.liste.push(uploadResult.file);
          store.set('dokumente', docs);
        }

        // 4. Save and Submit Pre-Check-In details to DB
        await store.submitPreCheckIn();

        const app = document.getElementById('app');
        app.innerHTML = renderSuccessScreen();
        setupSuccessHomeButton();
      } catch (err) {
        console.error('Submission failed:', err);
        alert(t('summary.submit_error'));
        submitBtn.disabled = false;
        submitBtn.innerHTML = t('summary.submit_btn');
      }
    });
  }

  setupSuccessHomeButton();
  updateSubmitState();
}
