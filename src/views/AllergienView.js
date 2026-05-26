import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderTagInput, initTagInput } from '../components/TagInput.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';

const COMMON_ALLERGIES = ['Penicillin', 'Pollen', 'Hausstaubmilben', 'Nüsse', 'Latex', 'Jod', 'Tierhaare', 'Schimmelpilze'];

export function renderAllergienView() {
  const data = store.get('allergien');
  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(3)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom:var(--space-2)">Haben Sie bekannte Allergien?</h2>
          <p class="text-muted" style="margin-bottom:var(--space-6)">Bitte geben Sie alle bekannten Allergien und Unverträglichkeiten an.</p>
          <div id="allergien-input-area" style="${data.keine ? 'opacity:0.4;pointer-events:none' : ''}">
            <div class="form-group" style="margin-bottom:var(--space-6)">
              <label class="form-label">Allergien hinzufügen</label>
              ${renderTagInput('allergien', data.liste, 'Allergie eingeben + Enter', COMMON_ALLERGIES)}
            </div>
            <div class="form-group">
              <label class="form-label" for="allergien-anmerkungen">Anmerkungen für die Praxis <span style="font-weight:400;color:var(--gray-400)">(optional)</span></label>
              <textarea class="form-textarea" id="allergien-anmerkungen" placeholder="z.B. Reaktion auf bestimmte Medikamente..." style="min-height:80px">${data.anmerkungen}</textarea>
            </div>
          </div>
          <label class="no-data-toggle ${data.keine ? 'active' : ''}" id="keine-allergien-toggle">
            <input type="checkbox" class="checkbox-input" id="keine-allergien" ${data.keine ? 'checked' : ''} />
            <span class="no-data-text">Ich habe keine bekannten Allergien</span>
          </label>
          ${renderStepNavigation('medikamente', 'dokumente')}
        </div>
      </div>
    </div>`;
}

function validateAllergien() {
  const data = store.get('allergien');
  if (!data.keine && data.liste.length === 0) {
    return { valid: false, message: 'Bitte geben Sie mindestens eine Allergie ein oder wählen Sie "Keine Allergien".' };
  }
  return { valid: true };
}

export function initAllergienView() {
  const data = store.get('allergien');
  const inputArea = document.getElementById('allergien-input-area');
  const toggle = document.getElementById('keine-allergien');
  const toggleLabel = document.getElementById('keine-allergien-toggle');

  function reRenderTags() {
    const area = document.getElementById('allergien-input-area');
    if (!area) return;
    const anmVal = data.anmerkungen;
    area.innerHTML = `<div class="form-group" style="margin-bottom:var(--space-6)"><label class="form-label">Allergien hinzufügen</label>${renderTagInput('allergien', data.liste, 'Allergie eingeben + Enter', COMMON_ALLERGIES)}</div><div class="form-group"><label class="form-label" for="allergien-anmerkungen">Anmerkungen für die Praxis <span style="font-weight:400;color:var(--gray-400)">(optional)</span></label><textarea class="form-textarea" id="allergien-anmerkungen" placeholder="z.B. Reaktion auf bestimmte Medikamente..." style="min-height:80px">${anmVal}</textarea></div>`;
    initTagInput('allergien', data.liste, (tags) => {
      data.liste = tags;
      store.set('allergien', data);
      updateNextButtonState(validateAllergien);
      reRenderTags();
    }, COMMON_ALLERGIES);
    const a = document.getElementById('allergien-anmerkungen');
    if (a) a.addEventListener('input', () => { data.anmerkungen = a.value; store.set('allergien', data); });
  }

  initTagInput('allergien', data.liste, (tags) => {
    data.liste = tags;
    store.set('allergien', data);
    updateNextButtonState(validateAllergien);
    reRenderTags();
  }, COMMON_ALLERGIES);

  const anm = document.getElementById('allergien-anmerkungen');
  if (anm) anm.addEventListener('input', () => { data.anmerkungen = anm.value; store.set('allergien', data); });

  if (toggle) {
    toggle.addEventListener('change', () => {
      data.keine = toggle.checked;
      if (data.keine) { data.liste = []; data.anmerkungen = ''; }
      store.set('allergien', data);
      if (inputArea) { inputArea.style.opacity = data.keine ? '0.4' : '1'; inputArea.style.pointerEvents = data.keine ? 'none' : 'auto'; }
      if (toggleLabel) toggleLabel.classList.toggle('active', data.keine);
      if (data.keine) reRenderTags();
      updateNextButtonState(validateAllergien);
    });
  }

  // Init with validation
  initStepNavigation(validateAllergien);
  updateNextButtonState(validateAllergien);
}
