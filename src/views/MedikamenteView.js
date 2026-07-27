import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderTagInput, initTagInput } from '../components/TagInput.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

const COMMON_MEDS = ['Ibuprofen', 'Paracetamol', 'Aspirin', 'Omeprazol', 'Metformin', 'Ramipril'];

export function renderMedikamenteView() {
  const data = store.get('medikamente');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(2)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">${t('medikamente.title')}</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">${t('medikamente.subtitle')}</p>

          <div id="medikamente-input-area" style="${data.keine ? 'opacity: 0.4; pointer-events: none;' : ''}">
            <div class="form-group">
              <label class="form-label">${t('medikamente.search_placeholder')}</label>
              ${renderTagInput('medikamente', data.liste, t('medikamente.search_placeholder'), COMMON_MEDS)}
            </div>
          </div>

          <label class="no-data-toggle ${data.keine ? 'active' : ''}" id="keine-medikamente-toggle">
            <input type="checkbox" class="checkbox-input" id="keine-medikamente" ${data.keine ? 'checked' : ''} />
            <span class="no-data-text">${t('medikamente.no')}</span>
          </label>

          ${renderStepNavigation(store.getCustomQuestions().length > 0 ? 'zusatzfragen' : 'beschwerden', 'allergien')}
        </div>
      </div>
    </div>
  `;
}

function validateMedikamente() {
  const data = store.get('medikamente');
  if (!data.keine && data.liste.length === 0) {
    return { valid: false, message: t('medikamente.val_required') };
  }
  return { valid: true };
}

export function initMedikamenteView() {
  const data = store.get('medikamente');
  const inputArea = document.getElementById('medikamente-input-area');
  const toggle = document.getElementById('keine-medikamente');
  const toggleLabel = document.getElementById('keine-medikamente-toggle');

  // Tag input
  initTagInput('medikamente', data.liste, (tags) => {
    data.liste = tags;
    store.set('medikamente', data);
    updateNextButtonState(validateMedikamente);
    reRenderTags();
  }, COMMON_MEDS);

  function reRenderTags() {
    const container = document.getElementById('medikamente-input-area');
    if (container) {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">${t('medikamente.add_label')}</label>
          ${renderTagInput('medikamente', data.liste, t('medikamente.input_placeholder'), COMMON_MEDS)}
        </div>
      `;
      initTagInput('medikamente', data.liste, (tags) => {
        data.liste = tags;
        store.set('medikamente', data);
        updateNextButtonState(validateMedikamente);
        reRenderTags();
      }, COMMON_MEDS);
    }
  }

  // No-medication toggle
  if (toggle) {
    toggle.addEventListener('change', () => {
      data.keine = toggle.checked;
      if (data.keine) {
        data.liste = [];
      }
      store.set('medikamente', data);
      if (inputArea) {
        inputArea.style.opacity = data.keine ? '0.4' : '1';
        inputArea.style.pointerEvents = data.keine ? 'none' : 'auto';
      }
      if (toggleLabel) {
        toggleLabel.classList.toggle('active', data.keine);
      }
      if (data.keine) reRenderTags();
      updateNextButtonState(validateMedikamente);
    });
  }

  // Init with validation
  initStepNavigation(validateMedikamente);
  updateNextButtonState(validateMedikamente);
}

