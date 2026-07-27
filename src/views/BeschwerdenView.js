import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { renderTagInput, initTagInput } from '../components/TagInput.js';
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

function getSymptomsByFachrichtung(termin) {
  if (!termin) {
    return [
      'Kopfschmerzen', 'Rückenschmerzen', 'Husten', 'Fieber',
      'Müdigkeit', 'Übelkeit', 'Halsschmerzen', 'Schwindel',
      'Bauchschmerzen', 'Gelenkschmerzen', 'Atemnot', 'Schlafstörungen'
    ];
  }
  
  const text = ((termin.fachrichtung || '') + ' ' + (termin.praxis || '')).toLowerCase();
  
  if (text.includes('zahn')) {
    return [
      'Zahnschmerzen', 'Zahnfleischbluten', 'Karies', 'Zahnstein', 
      'Aufbissbeschwerden', 'Schmerzempfindlichkeit', 'Kieferknacken', 'Weisheitszahn'
    ];
  }
  if (text.includes('psycho') || text.includes('psychiat') || text.includes('psycholog')) {
    return [
      'Schlafstörungen', 'Innere Unruhe', 'Ängste', 'Stimmungsschwankungen', 
      'Antriebslosigkeit', 'Stress/Burnout', 'Konzentrationsprobleme', 'Traurigkeit'
    ];
  }
  if (text.includes('derm') || text.includes('haut')) {
    return [
      'Hautausschlag', 'Juckreiz', 'Muttermal-Kontrolle', 'Rötung', 
      'Trockene Haut', 'Akne', 'Haarausfall', 'Allergische Hautreaktion'
    ];
  }
  if (text.includes('ortho') || text.includes('gelenk') || text.includes('knochen')) {
    return [
      'Rückenschmerzen', 'Gelenkschmerzen', 'Knieschmerzen', 'Nackenschmerzen', 
      'Bewegungseinschränkung', 'Muskelverspannung', 'Sportverletzung', 'Taubheitsgefühl'
    ];
  }
  if (text.includes('kinder') || text.includes('jugend') || text.includes('päd')) {
    return [
      'Fieber', 'Husten', 'Bauchschmerzen', 'Hautausschlag', 
      'Entwicklungsfrage', 'Appetitlosigkeit', 'Ohrenschmerzen', 'Vorsorgeuntersuchung'
    ];
  }
  if (text.includes('gyn') || text.includes('frau') || text.includes('schwanger')) {
    return [
      'Unterleibsschmerzen', 'Regelbeschwerden', 'Schwangerschaftsvorsorge', 'Brustschmerzen', 
      'Hormonschwankungen', 'Vorsorgeuntersuchung', 'Wechseljahresbeschwerden'
    ];
  }
  if (text.includes('hno') || text.includes('hals') || text.includes('nase') || text.includes('ohr')) {
    return [
      'Halsschmerzen', 'Ohrenschmerzen', 'Schnupfen', 'Hörbeschwerden', 
      'Heiserkeit', 'Nasenbluten', 'Tinnitus', 'Schluckbeschwerden'
    ];
  }
  if (text.includes('kardio') || text.includes('herz')) {
    return [
      'Herzrasen', 'Brustenge/Druckgefühl', 'Atemnot', 'Herzstolpern', 
      'Schwindel', 'Bluthochdruck', 'Müdigkeit', 'Leistungsminderung'
    ];
  }
  if (text.includes('auge') || text.includes('ophth')) {
    return [
      'Sehverschlechterung', 'Trockene Augen', 'Augenrötung', 'Juckreiz/Brennen', 
      'Fremdkörpergefühl', 'Lichtempfindlichkeit', 'Doppelbilder'
    ];
  }

  // Default / Allgemeinmedizin
  return [
    'Kopfschmerzen', 'Rückenschmerzen', 'Husten', 'Fieber',
    'Müdigkeit', 'Übelkeit', 'Halsschmerzen', 'Schwindel',
    'Bauchschmerzen', 'Gelenkschmerzen', 'Atemnot', 'Schlafstörungen'
  ];
}

export function renderBeschwerdenView() {
  const data = store.get('beschwerden');
  const termin = store.getTerminInfo();
  const symptoms = getSymptomsByFachrichtung(termin);

  const chipsHtml = symptoms.map(s => `
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
          <h2 style="margin-bottom: var(--space-2);">${t('beschwerden.title')}</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">${t('beschwerden.subtitle')}</p>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label">${t('beschwerden.possible')}</label>
            <div class="chips-container" id="symptom-chips">
              ${chipsHtml}
              <button class="chip chip--other ${data.showCustomInput ? 'selected' : ''}" id="chip-other" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                ${t('beschwerden.other')}
              </button>
            </div>
          </div>

          <!-- Custom keyword input (hidden by default) -->
          <div class="custom-input-area ${data.showCustomInput ? 'custom-input-area--visible' : ''}" id="custom-input-area">
            <div class="form-group" style="margin-bottom: var(--space-4);">
              <label class="form-label">${t('beschwerden.custom_title')}</label>
              <p class="form-hint" style="margin-bottom: var(--space-2);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                ${t('beschwerden.custom_hint')}
              </p>
              ${renderTagInput('beschwerden-custom', customKeywords, t('beschwerden.custom_placeholder'))}
            </div>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" for="beschwerden-text">${t('beschwerden.detail_label')}</label>
            <textarea class="form-textarea" id="beschwerden-text" placeholder="${t('beschwerden.detail_placeholder')}">${data.freitext}</textarea>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-6);">
            <label class="form-label" for="beschwerden-dauer">${t('beschwerden.duration_label')}</label>
            <select class="form-select" id="beschwerden-dauer">
              <option value="" ${!data.dauer ? 'selected' : ''}>${t('beschwerden.select_placeholder')}</option>
              <option value="heute" ${data.dauer === 'heute' ? 'selected' : ''}>${t('beschwerden.duration_today')}</option>
              <option value="einige_tage" ${data.dauer === 'einige_tage' ? 'selected' : ''}>${t('beschwerden.duration_days')}</option>
              <option value="eine_woche" ${data.dauer === 'eine_woche' ? 'selected' : ''}>${t('beschwerden.duration_week')}</option>
              <option value="mehrere_wochen" ${data.dauer === 'mehrere_wochen' ? 'selected' : ''}>${t('beschwerden.duration_weeks')}</option>
              <option value="monate" ${data.dauer === 'monate' ? 'selected' : ''}>${t('beschwerden.duration_months')}</option>
              <option value="laenger" ${data.dauer === 'laenger' ? 'selected' : ''}>${t('beschwerden.duration_longer')}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${t('beschwerden.severity_label')}</label>
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
                <span>${t('beschwerden.severity_light')}</span>
                <span>${t('beschwerden.severity_strong')}</span>
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
    return { valid: false, message: t('beschwerden.val_custom') };
  }
  if (!hasAnySymptom && !hasFreitext) {
    return { valid: false, message: t('beschwerden.val_symptom') };
  }
  if (!hasDauer) {
    return { valid: false, message: t('beschwerden.val_duration') };
  }
  if (!hasStaerke) {
    return { valid: false, message: t('beschwerden.val_severity') };
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
        <label class="form-label">${t('beschwerden.custom_title')}</label>
        <p class="form-hint" style="margin-bottom: var(--space-2);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          ${t('beschwerden.custom_hint')}
        </p>
        ${renderTagInput('beschwerden-custom', data.customKeywords, t('beschwerden.custom_placeholder'))}
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
