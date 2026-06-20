import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';

export function renderPraxisDokumenteView() {
  const docs = store.getPraxisDocuments();
  const confirmations = store.get('documentConfirmations') || {};

  const docsHtml = docs.map((doc, idx) => {
    const fileUrl = `/api/file/${doc.file_id}`;
    const isPdf = doc.mime_type === 'application/pdf';
    const isImage = doc.mime_type && doc.mime_type.startsWith('image/');
    const existing = confirmations[doc.id] || {};
    const status = existing.status || null;
    const reason = existing.reason || '';

    const isConfirm = doc.doc_type === 'confirm';

    const viewerHtml = isPdf
      ? `<iframe src="${fileUrl}#toolbar=0&navpanes=0&scrollbar=1" style="width: 100%; height: 100%; border: none; border-radius: var(--radius-md);"></iframe>`
      : isImage
        ? `<div style="display: flex; justify-content: center; align-items: center; height: 100%; overflow: auto; background: var(--gray-50); border-radius: var(--radius-md);"><img src="${fileUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${doc.title}" /></div>`
        : `<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--gray-500); font-size: var(--font-size-sm);">
             <a href="${fileUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">Dokument in neuem Tab öffnen</a>
           </div>`;

    let actionHtml = '';
    if (isConfirm) {
      const isChecked = status === 'confirmed';
      actionHtml = `
        <div class="form-group" style="margin-top: var(--space-4);">
          <label class="checkbox-group" style="display: flex; align-items: flex-start; gap: var(--space-2); cursor: pointer;">
            <input type="checkbox" class="doc-confirm-checkbox" data-id="${doc.id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px;" />
            <span class="checkbox-label" style="font-size: var(--font-size-sm); color: var(--gray-700); font-weight: 600;">
              Ich habe das Dokument gelesen und bestätige dies.
            </span>
          </label>
        </div>
      `;
    } else {
      const isAccepted = status === 'accepted';
      const isRejected = status === 'rejected';
      actionHtml = `
        <div class="form-group doc-choice-group" data-id="${doc.id}" style="margin-top: var(--space-4);">
          <p style="font-size: var(--font-size-sm); font-weight: 700; color: var(--gray-700); margin-bottom: var(--space-2);">Bitte wählen Sie eine Option:</p>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <label class="radio-group" style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer;">
              <input type="radio" name="doc-choice-${doc.id}" value="accepted" ${isAccepted ? 'checked' : ''} />
              <span style="font-size: var(--font-size-sm); color: var(--gray-700);">Ich akzeptiere das Dokument</span>
            </label>
            <label class="radio-group" style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer;">
              <input type="radio" name="doc-choice-${doc.id}" value="rejected" ${isRejected ? 'checked' : ''} />
              <span style="font-size: var(--font-size-sm); color: var(--gray-700);">Ich akzeptiere das Dokument nicht (Ablehnung)</span>
            </label>
          </div>
          <div class="reject-reason-box" id="reject-reason-box-${doc.id}" style="display: ${isRejected ? 'block' : 'none'}; margin-top: var(--space-3);">
            <label class="form-label" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">
              Begründung für die Ablehnung <span style="color: #DC2626;">*</span>
            </label>
            <textarea class="textarea reject-reason-input" data-id="${doc.id}" placeholder="Bitte geben Sie eine Begründung ein..." 
                      style="width: 100%; min-height: 80px; border: 2px solid #DC2626; border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-sm); resize: vertical; font-family: var(--font-family); background: #FEF2F2;">${reason}</textarea>
          </div>
        </div>
      `;
    }

    return `
      <div class="praxis-doc-item" style="border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-6); background: white; box-shadow: var(--shadow-sm);">
        <h3 style="font-size: var(--font-size-md); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-3); display: flex; align-items: center; gap: 8px;">
          📄 ${idx + 1}. ${doc.title}
        </h3>
        <div class="doc-scroll-frame" style="height: 380px; border: 1px solid var(--gray-250); border-radius: var(--radius-md); overflow: hidden; background: var(--gray-50);">
          ${viewerHtml}
        </div>
        ${actionHtml}
      </div>
    `;
  }).join('');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(6)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">Einwilligungen & Praxis-Dokumente</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Bitte lesen und bestätigen Sie die folgenden Dokumente Ihrer Praxis, um den Pre-Check-In abzuschließen.</p>

          <div class="praxis-docs-container">
            ${docsHtml}
          </div>

          ${renderStepNavigation('dokumente', 'zusammenfassung', 'Zur Zusammenfassung')}
        </div>
      </div>
    </div>
  `;
}

export function initPraxisDokumenteView() {
  const container = document.querySelector('.praxis-docs-container');
  if (!container) return;

  function validate() {
    const docs = store.getPraxisDocuments();
    const confirmations = store.get('documentConfirmations') || {};

    for (const doc of docs) {
      const conf = confirmations[doc.id];
      if (!conf) return { valid: false };

      if (doc.doc_type === 'confirm') {
        if (conf.status !== 'confirmed') return { valid: false };
      } else {
        if (conf.status !== 'accepted' && conf.status !== 'rejected') return { valid: false };
        if (conf.status === 'rejected' && (!conf.reason || conf.reason.trim().length === 0)) {
          return { valid: false, message: `Bitte geben Sie eine Begründung für die Ablehnung von „${doc.title}“ an.` };
        }
      }
    }

    return { valid: true };
  }

  // Handle checkboxes
  container.querySelectorAll('.doc-confirm-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const docId = e.target.dataset.id;
      const confirmations = store.get('documentConfirmations') || {};
      if (e.target.checked) {
        confirmations[docId] = { status: 'confirmed', reason: '' };
      } else {
        delete confirmations[docId];
      }
      store.set('documentConfirmations', confirmations);
      updateNextButtonState(validate);
    });
  });

  // Handle radio buttons and textareas
  container.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const name = e.target.name; // doc-choice-ID
      const docId = name.replace('doc-choice-', '');
      const value = e.target.value; // accepted or rejected
      const confirmations = store.get('documentConfirmations') || {};

      const reasonBox = document.getElementById(`reject-reason-box-${docId}`);
      if (value === 'rejected') {
        if (reasonBox) reasonBox.style.display = 'block';
        const reasonInput = container.querySelector(`.reject-reason-input[data-id="${docId}"]`);
        confirmations[docId] = { status: 'rejected', reason: reasonInput ? reasonInput.value.trim() : '' };
      } else {
        if (reasonBox) reasonBox.style.display = 'none';
        confirmations[docId] = { status: 'accepted', reason: '' };
      }

      store.set('documentConfirmations', confirmations);
      updateNextButtonState(validate);
    });
  });

  container.querySelectorAll('.reject-reason-input').forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const docId = e.target.dataset.id;
      const confirmations = store.get('documentConfirmations') || {};
      const status = container.querySelector(`input[name="doc-choice-${docId}"]:checked`)?.value;

      if (status === 'rejected') {
        confirmations[docId] = { status: 'rejected', reason: e.target.value.trim() };
        store.set('documentConfirmations', confirmations);
        updateNextButtonState(validate);
      }
    });
  });

  // Initial state validation
  initStepNavigation(validate);
  updateNextButtonState(validate);
}
