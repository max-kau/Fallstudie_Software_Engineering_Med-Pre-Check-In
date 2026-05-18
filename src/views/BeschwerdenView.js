import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation } from '../components/StepNavigation.js';
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

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(1)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">Welche Beschwerden haben Sie?</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Beschreiben Sie Ihre aktuellen Symptome so genau wie möglich.</p>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label">Häufige Beschwerden <span style="font-weight: 400; color: var(--gray-400);">(optional)</span></label>
            <div class="chips-container" id="symptom-chips">
              ${chipsHtml}
            </div>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" for="beschwerden-text">Beschreiben Sie Ihre Beschwerden</label>
            <textarea class="form-textarea" id="beschwerden-text" placeholder="z.B. Seit drei Tagen habe ich starke Kopfschmerzen, besonders morgens...">${data.freitext}</textarea>
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
              <div class="slider-value" id="slider-value">${data.staerke}</div>
              <div class="slider-track">
                <input type="range" class="slider-input" id="beschwerden-staerke" min="1" max="10" value="${data.staerke}" />
              </div>
              <div class="slider-labels">
                <span>1 – Leicht</span>
                <span>10 – Sehr stark</span>
              </div>
            </div>
          </div>

          ${renderStepNavigation('intro', 'medikamente')}
        </div>
      </div>
    </div>
  `;
}

export function initBeschwerdenView() {
  const data = store.get('beschwerden');

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
    });
  });

  // Textarea
  const textarea = document.getElementById('beschwerden-text');
  if (textarea) {
    textarea.addEventListener('input', () => {
      data.freitext = textarea.value;
      store.set('beschwerden', data);
    });
  }

  // Duration select
  const dauer = document.getElementById('beschwerden-dauer');
  if (dauer) {
    dauer.addEventListener('change', () => {
      data.dauer = dauer.value;
      store.set('beschwerden', data);
    });
  }

  // Slider
  const slider = document.getElementById('beschwerden-staerke');
  const sliderValue = document.getElementById('slider-value');
  if (slider) {
    slider.addEventListener('input', () => {
      data.staerke = parseInt(slider.value);
      sliderValue.textContent = slider.value;
      // Color the value based on severity
      const hue = 120 - (data.staerke - 1) * 12; // green to red
      sliderValue.style.color = `hsl(${hue}, 70%, 45%)`;
      store.set('beschwerden', data);
    });
    // Set initial color
    const hue = 120 - (data.staerke - 1) * 12;
    sliderValue.style.color = `hsl(${hue}, 70%, 45%)`;
  }

  initStepNavigation();
}
