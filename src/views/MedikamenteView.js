import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderTagInput, initTagInput } from '../components/TagInput.js';
import { renderStepNavigation, initStepNavigation } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';

const COMMON_MEDS = ['Ibuprofen', 'Paracetamol', 'Aspirin', 'Omeprazol', 'Metformin', 'Ramipril'];

export function renderMedikamenteView() {
  const data = store.get('medikamente');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(2)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">Welche Medikamente nehmen Sie ein?</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Geben Sie alle Medikamente an, die Sie aktuell regelmäßig oder bei Bedarf einnehmen.</p>

          <div id="medikamente-input-area" style="${data.keine ? 'opacity: 0.4; pointer-events: none;' : ''}">
            <div class="form-group">
              <label class="form-label">Medikamente hinzufügen</label>
              ${renderTagInput('medikamente', data.liste, 'Medikament eingeben + Enter', COMMON_MEDS)}
            </div>
          </div>

          <label class="no-data-toggle ${data.keine ? 'active' : ''}" id="keine-medikamente-toggle">
            <input type="checkbox" class="checkbox-input" id="keine-medikamente" ${data.keine ? 'checked' : ''} />
            <span class="no-data-text">Ich nehme aktuell keine Medikamente ein</span>
          </label>

          ${renderStepNavigation('beschwerden', 'allergien')}
        </div>
      </div>
    </div>
  `;
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
    // Re-render to update tags display
    const wrapper = document.getElementById('medikamente-wrapper');
    reRenderTags();
  }, COMMON_MEDS);

  function reRenderTags() {
    const container = document.getElementById('medikamente-input-area');
    if (container) {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Medikamente hinzufügen</label>
          ${renderTagInput('medikamente', data.liste, 'Medikament eingeben + Enter', COMMON_MEDS)}
        </div>
      `;
      initTagInput('medikamente', data.liste, (tags) => {
        data.liste = tags;
        store.set('medikamente', data);
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
    });
  }

  initStepNavigation();
}
