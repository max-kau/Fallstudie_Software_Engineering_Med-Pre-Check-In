/**
 * DocumentViewerModal
 * Opens a praxis document in a modal for the patient to view and confirm/accept/reject.
 */
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

export function openDocumentViewerModal(doc, onStatusChange) {
  // Remove any existing modal
  document.getElementById('doc-viewer-modal')?.remove();

  const confirmations = store.get('documentConfirmations') || {};
  const existing = confirmations[doc.id] || {};
  const currentStatus = existing.status || null;
  const currentReason = existing.reason || '';

  const isConfirmOnly = doc.doc_type === 'confirm';
  const fileUrl = `/api/file/${doc.file_id}`;
  const isPdf = doc.mime_type === 'application/pdf';
  const isImage = doc.mime_type && doc.mime_type.startsWith('image/');

  const viewerContent = isPdf
    ? `<iframe src="${fileUrl}#toolbar=0&navpanes=0&scrollbar=1" style="width: 100%; height: 100%; border: none; border-radius: var(--radius-md);"></iframe>`
    : isImage
      ? `<div style="display: flex; justify-content: center; align-items: center; height: 100%; overflow: auto; background: var(--gray-50); border-radius: var(--radius-md);"><img src="${fileUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${doc.title}" /></div>`
      : `<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--gray-500); font-size: var(--font-size-sm);">
           <a href="${fileUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">${t('doc_modal.open_new_tab')}</a>
         </div>`;

  const actionButtons = isConfirmOnly
    ? `<button id="btn-doc-confirm" class="btn btn-primary" style="padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--font-size-sm); cursor: pointer; display: flex; align-items: center; gap: 8px;">
         ${t('doc_modal.confirm')}
       </button>`
    : `<div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
         <button id="btn-doc-accept" class="btn" style="background: #059669; color: white; padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--font-size-sm); cursor: pointer; display: flex; align-items: center; gap: 8px; border: none;">
           ${t('doc_modal.accept')}
         </button>
         <button id="btn-doc-reject" class="btn" style="background: #DC2626; color: white; padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--font-size-sm); cursor: pointer; display: flex; align-items: center; gap: 8px; border: none;">
           ${t('doc_modal.reject')}
         </button>
       </div>`;

  const html = `
    <div class="dl-modal-backdrop" id="doc-viewer-modal" style="z-index: 9000;">
      <div class="dl-modal-card fade-in-up" style="max-width: 800px; height: 80vh; max-height: 92vh; display: flex; flex-direction: column; width: 95vw;">
        <div class="dl-modal-header" style="flex-shrink: 0;">
          <h3 class="dl-modal-title" style="display: flex; align-items: center; gap: 8px;">
            📄 ${doc.title}
          </h3>
          <button class="dl-modal-close" id="btn-close-doc-viewer">&times;</button>
        </div>
        <div class="dl-modal-body" style="flex-grow: 1; overflow: hidden; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
          <!-- Document Viewer -->
          <div style="flex: 1; min-height: 300px; overflow: hidden; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); background: white;">
            ${viewerContent}
          </div>

          <!-- Rejection Reason (hidden initially) -->
          <div id="doc-reject-area" style="display: ${currentStatus === 'rejected' ? 'block' : 'none'};">
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">
              ${t('doc_modal.reject_reason_label')} <span style="color: #DC2626;">*</span>
            </label>
            <textarea id="doc-reject-reason" placeholder="${t('doc_modal.reject_reason_placeholder')}" 
                      style="width: 100%; min-height: 80px; border: 2px solid #DC2626; border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-sm); resize: vertical; font-family: var(--font-family); background: #FEF2F2;">${currentReason}</textarea>
          </div>

          <!-- Status indicator -->
          <div id="doc-current-status" style="display: ${currentStatus ? 'flex' : 'none'}; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); font-size: var(--font-size-sm); font-weight: 600;
               background: ${currentStatus === 'rejected' ? '#FEF2F2' : '#ECFDF5'};
               color: ${currentStatus === 'rejected' ? '#DC2626' : '#059669'};
               border: 1px solid ${currentStatus === 'rejected' ? '#FCA5A5' : '#A7F3D0'};">
            <span>${currentStatus === 'rejected' ? t('doc_modal.rejected') : currentStatus === 'accepted' ? t('doc_modal.accepted') : currentStatus === 'confirmed' ? t('doc_modal.confirmed') : ''}</span>
            ${currentStatus === 'rejected' && currentReason ? `<span style="font-weight: 400; margin-left: 8px;">– ${currentReason}</span>` : ''}
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);">
            ${actionButtons}
            <button id="btn-doc-close-bottom" class="btn btn-secondary" style="padding: var(--space-3) var(--space-5); border-radius: var(--radius-lg); font-size: var(--font-size-sm); cursor: pointer;">
              ${t('doc_modal.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('doc-viewer-modal');
  const closeModal = () => modal?.remove();

  document.getElementById('btn-close-doc-viewer')?.addEventListener('click', closeModal);
  document.getElementById('btn-doc-close-bottom')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function saveStatus(status, reason = '') {
    const confs = store.get('documentConfirmations') || {};
    confs[doc.id] = { status, reason };
    store.set('documentConfirmations', confs);

    // Update status display
    const statusEl = document.getElementById('doc-current-status');
    if (statusEl) {
      statusEl.style.display = 'flex';
      statusEl.style.background = status === 'rejected' ? '#FEF2F2' : '#ECFDF5';
      statusEl.style.color = status === 'rejected' ? '#DC2626' : '#059669';
      statusEl.style.borderColor = status === 'rejected' ? '#FCA5A5' : '#A7F3D0';
      const label = status === 'rejected' ? t('doc_modal.rejected') : status === 'accepted' ? t('doc_modal.accepted') : t('doc_modal.confirmed');
      statusEl.innerHTML = `<span>${label}</span>${status === 'rejected' && reason ? `<span style="font-weight: 400; margin-left: 8px;">– ${reason}</span>` : ''}`;
    }

    if (onStatusChange) onStatusChange(doc.id, status, reason);
  }

  // Confirm button (confirm-only type)
  document.getElementById('btn-doc-confirm')?.addEventListener('click', () => {
    saveStatus('confirmed');
    setTimeout(closeModal, 500);
  });

  // Accept button
  document.getElementById('btn-doc-accept')?.addEventListener('click', () => {
    document.getElementById('doc-reject-area').style.display = 'none';
    saveStatus('accepted');
    setTimeout(closeModal, 500);
  });

  // Reject button
  document.getElementById('btn-doc-reject')?.addEventListener('click', () => {
    const rejectArea = document.getElementById('doc-reject-area');
    rejectArea.style.display = 'block';

    // If already has reason, save immediately
    const reasonInput = document.getElementById('doc-reject-reason');
    if (reasonInput.value.trim().length > 0) {
      saveStatus('rejected', reasonInput.value.trim());
    }
  });

  // Listen for reason input changes
  document.getElementById('doc-reject-reason')?.addEventListener('input', (e) => {
    const reason = e.target.value.trim();
    if (reason.length > 0) {
      saveStatus('rejected', reason);
    }
  });
}
