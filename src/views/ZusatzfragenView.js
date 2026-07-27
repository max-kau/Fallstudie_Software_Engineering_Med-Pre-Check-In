import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

export function renderZusatzfragenView() {
  const questions = store.getCustomQuestions();
  const answers = store.get('customAnswers') || {};

  const questionsHtml = questions.map((q, idx) => {
    const isRequired = q.required;
    const currentVal = answers[q.question_text];

    let inputHtml = '';
    if (q.question_type === 'text') {
      inputHtml = `
        <textarea class="form-textarea custom-q-input" data-text="${q.question_text}" placeholder="..." style="margin-top: var(--space-2); min-height: 80px;">${currentVal || ''}</textarea>
      `;
    } else if (q.question_type === 'single') {
      const options = q.options || [];
      inputHtml = `
        <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
          ${options.map((opt, oIdx) => {
            const isChecked = currentVal === opt;
            return `
              <label style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--gray-700); cursor: pointer; user-select: none;">
                <input type="radio" class="custom-q-radio" name="custom-radio-${idx}" data-text="${q.question_text}" value="${opt}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                <span>${opt}</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.question_type === 'multiple') {
      const options = q.options || [];
      const selectedList = Array.isArray(currentVal) ? currentVal : [];
      inputHtml = `
        <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
          ${options.map((opt, oIdx) => {
            const isChecked = selectedList.includes(opt);
            return `
              <label style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--gray-700); cursor: pointer; user-select: none;">
                <input type="checkbox" class="custom-q-checkbox" data-text="${q.question_text}" value="${opt}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                <span>${opt}</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="form-group" style="margin-bottom: var(--space-6); background: var(--bg-gray); padding: var(--space-4) var(--space-5); border-radius: var(--radius-xl); border: 1px solid var(--gray-200);">
        <label class="form-label" style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px;">
          <span>${q.question_text}</span>
          ${isRequired ? '<span style="color: var(--red-600); font-weight: bold; font-size: var(--font-size-sm);">*</span>' : ''}
        </label>
        ${inputHtml}
      </div>
    `;
  }).join('');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(1)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">${t('zusatzfragen.title')}</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">${t('zusatzfragen.subtitle')}</p>

          <form id="custom-questions-form" onsubmit="event.preventDefault();">
            ${questionsHtml}
          </form>

          ${renderStepNavigation('beschwerden', 'medikamente')}
        </div>
      </div>
    </div>
  `;
}

function validateZusatzfragen() {
  const questions = store.getCustomQuestions();
  const answers = store.get('customAnswers') || {};

  for (const q of questions) {
    if (!q.required) continue;
    const val = answers[q.question_text];

    if (q.question_type === 'text') {
      if (!val || val.trim().length === 0) {
        return { valid: false, message: t('zusatzfragen.val_text').replace('{q}', q.question_text) };
      }
    } else if (q.question_type === 'single') {
      if (!val) {
        return { valid: false, message: t('zusatzfragen.val_single').replace('{q}', q.question_text) };
      }
    } else if (q.question_type === 'multiple') {
      if (!Array.isArray(val) || val.length === 0) {
        return { valid: false, message: t('zusatzfragen.val_multiple').replace('{q}', q.question_text) };
      }
    }
  }

  return { valid: true };
}

export function initZusatzfragenView() {
  const answers = store.get('customAnswers') || {};

  // Text inputs
  document.querySelectorAll('.custom-q-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const qText = e.target.dataset.text;
      answers[qText] = e.target.value;
      store.set('customAnswers', answers);
      updateNextButtonState(validateZusatzfragen);
    });
  });

  // Radio inputs
  document.querySelectorAll('.custom-q-radio').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        const qText = e.target.dataset.text;
        answers[qText] = e.target.value;
        store.set('customAnswers', answers);
        updateNextButtonState(validateZusatzfragen);
      }
    });
  });

  // Checkbox inputs
  document.querySelectorAll('.custom-q-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const qText = e.target.dataset.text;
      let currentVal = answers[qText];
      if (!Array.isArray(currentVal)) {
        currentVal = [];
      }

      if (e.target.checked) {
        if (!currentVal.includes(e.target.value)) {
          currentVal.push(e.target.value);
        }
      } else {
        currentVal = currentVal.filter(v => v !== e.target.value);
      }

      answers[qText] = currentVal;
      store.set('customAnswers', answers);
      updateNextButtonState(validateZusatzfragen);
    });
  });

  initStepNavigation(validateZusatzfragen);
  updateNextButtonState(validateZusatzfragen);
}
