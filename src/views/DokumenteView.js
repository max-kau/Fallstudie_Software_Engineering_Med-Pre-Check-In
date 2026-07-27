import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function renderDokumenteView() {
  const data = store.get('dokumente') || { liste: [] };

  const filesHtml = data.liste.map(file => {
    const isImg = file.mimeType.startsWith('image/');
    const iconClass = isImg ? 'image' : (file.mimeType === 'application/pdf' ? 'pdf' : '');
    const iconMarkup = isImg
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

    return `
      <div class="file-item" data-id="${file.id}">
        <div class="file-info">
          <div class="file-info-icon ${iconClass}">
            ${iconMarkup}
          </div>
          <div class="file-details">
            <span class="file-name" title="${file.filename}">${file.filename}</span>
            <span class="file-size">${formatBytes(file.fileSize)}</span>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn-file-delete" data-id="${file.id}" type="button" title="${t('dokumente.delete_tooltip')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const hasPraxisDocs = store.getPraxisDocuments().length > 0;
  const nextStep = hasPraxisDocs ? 'praxis-dokumente' : 'zusammenfassung';
  const nextLabel = hasPraxisDocs ? t('common.next') : t('dokumente.next_to_summary');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(5)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">${t('dokumente.title')}</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">${t('dokumente.subtitle')}</p>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <div class="upload-dropzone" id="file-dropzone">
              <div class="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <span class="upload-title">${t('dokumente.dropzone_title')}</span>
              <span class="upload-desc">${t('dokumente.dropzone_desc')}</span>
              <input type="file" id="dokument-file-input" style="display: none;" accept=".pdf,.png,.jpg,.jpeg" multiple />
            </div>
            <div class="validation-message" id="upload-error" style="display: none; margin-top: var(--space-2);"></div>
          </div>

          <!-- Uploaded Files List -->
          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" style="display: ${data.liste.length > 0 ? 'block' : 'none'};">${t('dokumente.uploaded_files')}</label>
            <div class="file-list" id="uploaded-files-list">
              ${filesHtml}
            </div>
          </div>

          ${renderStepNavigation('ai-fragen', nextStep, nextLabel)}
        </div>
      </div>
    </div>
  `;
}

export function initDokumenteView() {
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('dokument-file-input');
  const errorEl = document.getElementById('upload-error');
  const fileListEl = document.getElementById('uploaded-files-list');

  if (!dropzone || !fileInput) return;

  // Click handler to open file dialog
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  // Drag and drop styles
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
    }
  });

  async function handleFiles(files) {
    if (errorEl) errorEl.style.display = 'none';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate MIME format
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        showError(t('dokumente.error_format').replace('{name}', file.name));
        continue;
      }

      // Validate size limit (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showError(t('dokumente.error_size').replace('{name}', file.name));
        continue;
      }

      // Add temporary loading card to the list
      const tempId = 'loading-' + Math.random().toString(36).slice(2, 9);
      appendLoadingItem(file.name, tempId);

      try {
        await store.uploadFile(file);
        refreshFileList();
      } catch (err) {
        removeLoadingItem(tempId);
        showError(t('dokumente.error_upload').replace('{name}', file.name));
      }
    }
  }

  // Set up delete event listeners initially
  setupDeleteListeners();

  function showError(msg) {
    if (errorEl) {
      errorEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: var(--space-1); display: inline; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${msg}</span>
      `;
      errorEl.style.display = 'flex';
    }
  }

  function appendLoadingItem(filename, id) {
    if (!fileListEl) return;

    // Show label if it was hidden
    const label = document.querySelector('.form-group label.form-label');
    if (label) label.style.display = 'block';

    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = id;
    div.innerHTML = `
      <div class="file-info">
        <div class="file-info-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="file-details">
          <span class="file-name">${filename}</span>
          <span class="file-size">${t('dokumente.uploading')}</span>
        </div>
      </div>
      <div class="file-actions">
        <div class="file-loading-spinner"></div>
      </div>
    `;
    fileListEl.appendChild(div);
  }

  function removeLoadingItem(id) {
    const item = document.getElementById(id);
    if (item) item.remove();
  }

  function refreshFileList() {
    const data = store.get('dokumente') || { liste: [] };

    // Update label visibility
    const label = document.querySelector('.form-group label.form-label');
    if (label) label.style.display = data.liste.length > 0 ? 'block' : 'none';

    if (!fileListEl) return;
    fileListEl.innerHTML = data.liste.map(file => {
      const isImg = file.mimeType.startsWith('image/');
      const iconClass = isImg ? 'image' : (file.mimeType === 'application/pdf' ? 'pdf' : '');
      const iconMarkup = isImg
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      return `
        <div class="file-item" data-id="${file.id}">
          <div class="file-info">
            <div class="file-info-icon ${iconClass}">
              ${iconMarkup}
            </div>
            <div class="file-details">
              <span class="file-name" title="${file.filename}">${file.filename}</span>
              <span class="file-size">${formatBytes(file.fileSize)}</span>
            </div>
          </div>
          <div class="file-actions">
            <button class="btn-file-delete" data-id="${file.id}" type="button" title="${t('dokumente.delete_tooltip')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    setupDeleteListeners();
  }

  function setupDeleteListeners() {
    document.querySelectorAll('.btn-file-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileId = parseInt(btn.dataset.id);
        if (confirm(t('dokumente.confirm_delete'))) {
          try {
            await store.deleteFile(fileId);
            refreshFileList();
          } catch (err) {
            showError(t('dokumente.error_delete'));
          }
        }
      });
    });
  }

  // File step is always valid/optional
  initStepNavigation(() => ({ valid: true }));
}
