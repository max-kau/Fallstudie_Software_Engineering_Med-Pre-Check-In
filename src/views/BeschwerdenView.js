import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { renderTagInput, initTagInput } from '../components/TagInput.js';
import { store } from '../utils/store.js';

const COMMON_SYMPTOMS = [
  'Kopfschmerzen', 'Rückenschmerzen', 'Husten', 'Fieber',
  'Müdigkeit', 'Übelkeit', 'Halsschmerzen', 'Schwindel',
  'Bauchschmerzen', 'Gelenkschmerzen', 'Atemnot', 'Schlafstörungen',
];

export function renderBeschwerdenView() {
  const data = store.get('beschwerden');

  const chipsHtml = COMMON_SYMPTOMS.map(s => `
    <button class="chip ${data.chips.includes(s) ? 'selected' : ''}" data-symptom="${s}" type="button">${s}</button>
  `).join('');

  // Render custom keywords tags if any
  const customKeywords = data.customKeywords || [];

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(1)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">Welche Beschwerden haben Sie?</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Beschreiben Sie Ihre aktuellen Symptome so genau wie möglich.</p>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label">Mögliche Beschwerden</label>
            <div class="chips-container" id="symptom-chips">
              ${chipsHtml}
              <button class="chip chip--other ${data.showCustomInput ? 'selected' : ''}" id="chip-other" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Was anderes
              </button>
            </div>
          </div>

          <!-- Custom keyword input (hidden by default) -->
          <div class="custom-input-area ${data.showCustomInput ? 'custom-input-area--visible' : ''}" id="custom-input-area">
            <div class="form-group" style="margin-bottom: var(--space-4);">
              <label class="form-label">Eigene Beschwerden als Stichwörter</label>
              <p class="form-hint" style="margin-bottom: var(--space-2);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Geben Sie einzelne Stichwörter ein und drücken Sie Enter.
              </p>
              ${renderTagInput('beschwerden-custom', customKeywords, 'z.B. Taubheitsgefühl + Enter')}
            </div>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" for="beschwerden-text">Beschreiben Sie Ihre Beschwerden genauer</label>
            <textarea class="form-textarea" id="beschwerden-text" placeholder="z.B. Ich habe starke Kopfschmerzen, besonders morgens nach dem Aufstehen...">${data.freitext}</textarea>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" for="beschwerden-dauer">Seit wann bestehen die Beschwerden?</label>
            <select class="form-select" id="beschwerden-dauer">
              <option value="" ${!data.dauer ? 'selected' : ''}>Bitte wählen...</option>
              <option value="heute" ${data.dauer === 'heute' ? 'selected' : ''}>Seit heute</option>
              <option value="einige_tage" ${data.dauer === 'einige_tage' ? 'selected' : ''}>Seit einigen Tagen</option>
              <option value="eine_woche" ${data.dauer === 'eine_woche' ? 'selected' : ''}>Seit etwa einer Woche</option>
              <option value="mehrere_wochen" ${data.dauer === 'mehrere_wochen' ? 'selected' : ''}>Seit mehreren Wochen</option>
              <option value="monate" ${data.dauer === 'monate' ? 'selected' : ''}>Seit Monaten</option>
              <option value="laenger" ${data.dauer === 'laenger' ? 'selected' : ''}>Länger als 6 Monate</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Wie stark sind die Beschwerden?</label>
            <div class="slider-container">
              <div class="slider-value" id="slider-value">${data.staerke !== null ? data.staerke : '–'}</div>
              <div class="slider-track slider-track--with-arrows ${data.staerke === null ? 'slider-unset' : ''}">
                <span class="slider-arrow slider-arrow--left" id="slider-arrow-left">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </span>
                <input type="range" class="slider-input" id="beschwerden-staerke" min="1" max="10" value="${data.staerke !== null ? data.staerke : 5}" />
                <span class="slider-arrow slider-arrow--right" id="slider-arrow-right">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </div>
              <div class="slider-labels">
                <span>1 – Leicht</span>
                <span>10 – Sehr stark</span>
              </div>
            </div>
          </div>

          ${renderStepNavigation('intro', store.getCustomQuestions().length > 0 ? 'zusatzfragen' : 'medikamente')}
        </div>
      </div>
    </div>
  `;
}

function validateBeschwerden() {
  const data = store.get('beschwerden');
  const hasChips = data.chips.length > 0;
  const hasCustomKeywords = (data.customKeywords || []).length > 0;
  const customOpen = data.showCustomInput;
  const hasFreitext = data.freitext.trim().length > 0;
  const hasDauer = data.dauer !== '';
  const hasStaerke = data.staerke !== null;
  const hasAnySymptom = hasChips || hasCustomKeywords;

  if (customOpen && !hasCustomKeywords) {
    return { valid: false, message: 'Bitte geben Sie mindestens ein Stichwort für Ihre Beschwerde ein.' };
  }
  if (!hasAnySymptom && !hasFreitext) {
    return { valid: false, message: 'Bitte wählen Sie mindestens eine Beschwerde aus oder beschreiben Sie Ihre Symptome.' };
  }
  if (!hasDauer) {
    return { valid: false, message: 'Bitte geben Sie an, seit wann die Beschwerden bestehen.' };
  }
  if (!hasStaerke) {
    return { valid: false, message: 'Bitte geben Sie die Stärke Ihrer Beschwerden an.' };
  }
  return { valid: true };
}

export function initBeschwerdenView() {
  const data = store.get('beschwerden');

  // Initialize customKeywords in data if not present
  if (!data.customKeywords) {
    data.customKeywords = [];
    store.set('beschwerden', data);
  }
  if (data.showCustomInput === undefined) {
    data.showCustomInput = false;
    store.set('beschwerden', data);
  }

  // Symptom chips
  document.querySelectorAll('[data-symptom]').forEach(chip => {
    chip.addEventListener('click', () => {
      const symptom = chip.dataset.symptom;
      if (data.chips.includes(symptom)) {
        data.chips = data.chips.filter(s => s !== symptom);
        chip.classList.remove('selected');
      } else {
        data.chips.push(symptom);
        chip.classList.add('selected');
      }
      store.set('beschwerden', data);
      updateNextButtonState(validateBeschwerden);
    });
  });

  // "Was anderes" chip
  const chipOther = document.getElementById('chip-other');
  const customArea = document.getElementById('custom-input-area');
  if (chipOther && customArea) {
    chipOther.addEventListener('click', () => {
      data.showCustomInput = !data.showCustomInput;
      store.set('beschwerden', data);
      chipOther.classList.toggle('selected', data.showCustomInput);
      customArea.classList.toggle('custom-input-area--visible', data.showCustomInput);
      updateNextButtonState(validateBeschwerden);
    });
  }

  // Custom keywords tag input
  initTagInput('beschwerden-custom', data.customKeywords, (tags) => {
    data.customKeywords = tags;
    store.set('beschwerden', data);
    updateNextButtonState(validateBeschwerden);
    reRenderCustomTags();
  });

  function reRenderCustomTags() {
    const area = document.getElementById('custom-input-area');
    if (!area) return;
    area.innerHTML = `
      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label class="form-label">Eigene Beschwerden als Stichwörter</label>
        <p class="form-hint" style="margin-bottom: var(--space-2);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Geben Sie einzelne Stichwörter ein und drücken Sie Enter.
        </p>
        ${renderTagInput('beschwerden-custom', data.customKeywords, 'z.B. Taubheitsgefühl + Enter')}
      </div>
    `;
    initTagInput('beschwerden-custom', data.customKeywords, (tags) => {
      data.customKeywords = tags;
      store.set('beschwerden', data);
      updateNextButtonState(validateBeschwerden);
      reRenderCustomTags();
    });
  }

  // Textarea
  const textarea = document.getElementById('beschwerden-text');
  if (textarea) {
    textarea.addEventListener('input', () => {
      data.freitext = textarea.value;
      store.set('beschwerden', data);
      updateNextButtonState(validateBeschwerden);
    });
  }

  // Duration select
  const dauer = document.getElementById('beschwerden-dauer');
  if (dauer) {
    dauer.addEventListener('change', () => {
      data.dauer = dauer.value;
      store.set('beschwerden', data);
      updateNextButtonState(validateBeschwerden);
    });
  }

  // Slider
  const slider = document.getElementById('beschwerden-staerke');
  const sliderValue = document.getElementById('slider-value');
  const sliderTrack = slider ? slider.closest('.slider-track') : null;
  if (slider && sliderValue) {
    // Handle first interaction – activate slider
    const activateSlider = () => {
      data.staerke = parseInt(slider.value);
      sliderValue.textContent = slider.value;
      const hue = 120 - (data.staerke - 1) * 12;
      sliderValue.style.color = `hsl(${hue}, 70%, 45%)`;
      if (sliderTrack) sliderTrack.classList.remove('slider-unset');
      store.set('beschwerden', data);
      updateNextButtonState(validateBeschwerden);
    };

    slider.addEventListener('input', activateSlider);

    // Set initial state
    if (data.staerke !== null) {
      const hue = 120 - (data.staerke - 1) * 12;
      sliderValue.style.color = `hsl(${hue}, 70%, 45%)`;
      if (sliderTrack) sliderTrack.classList.remove('slider-unset');
    } else {
      sliderValue.style.color = 'var(--gray-400)';
    }
  }

  // Init step navigation with validation
  initStepNavigation(validateBeschwerden);

  // Set initial button state
  updateNextButtonState(validateBeschwerden);
}
