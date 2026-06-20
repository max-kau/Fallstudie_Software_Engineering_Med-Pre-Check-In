import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';

export function renderAIZusatzfragenView() {
  const aiQuestions = store.get('aiQuestions') || [];
  const isLoading = aiQuestions.length === 0;

  let contentHtml = '';

  if (isLoading) {
    contentHtml = `
      <div class="ai-loading-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) 0; text-align: center;">
        <div class="dl-auth-spinner" style="width: 50px; height: 50px; border-width: 4px; border-color: var(--blue-600) transparent var(--blue-600) transparent; margin-bottom: var(--space-6);"></div>
        <h3 style="margin-bottom: var(--space-2); color: var(--gray-800);">Anamnese wird personalisiert...</h3>
        <p class="text-muted" style="max-width: 400px; font-size: var(--font-size-sm);">Unsere KI analysiert Ihre Angaben zu Beschwerden, Medikamenten und Allergien, um individuelle Folgefragen für Ihren Arzt vorzubereiten.</p>
      </div>
    `;
  } else {
    const questionsHtml = aiQuestions.map((q, idx) => {
      return `
        <div class="form-group ai-question-card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%); padding: var(--space-5) var(--space-6); border-radius: var(--radius-xl); border: 1px solid rgba(16, 122, 202, 0.15); box-shadow: 0 4px 12px rgba(16, 122, 202, 0.03); transition: transform 0.2s ease, border-color 0.2s ease;">
          <label class="form-label" style="display: flex; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-3); color: var(--gray-800); font-weight: 600; font-size: var(--font-size-base); line-height: 1.4;">
            <span style="display: inline-flex; align-items: center; justify-content: center; background: rgba(16, 122, 202, 0.1); color: var(--blue-600); border-radius: 50%; width: 24px; height: 24px; font-size: 12px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">${idx + 1}</span>
            <span>${q.question}</span>
            <span style="color: var(--red-600); font-weight: bold; font-size: var(--font-size-sm); margin-left: 2px;">*</span>
          </label>
          <textarea class="form-textarea ai-q-input" data-idx="${idx}" placeholder="Ihre Antwort..." style="margin-top: var(--space-2); min-height: 90px; border-color: rgba(16, 122, 202, 0.2); background: #ffffff;" required>${q.answer || ''}</textarea>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div style="margin-bottom: var(--space-6); padding: var(--space-4) var(--space-5); background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%); border-radius: var(--radius-lg); display: flex; align-items: center; gap: var(--space-3); border: 1px solid rgba(99, 102, 241, 0.2);">
        <span style="font-size: var(--font-size-2xl);">🤖</span>
        <div>
          <h4 style="color: #312e81; font-weight: 600; margin-bottom: 2px;">Intelligente Folgefragen</h4>
          <p style="color: #4338ca; font-size: var(--font-size-xs); margin: 0; line-height: 1.3;">Basierend auf Ihren Angaben hat unser System spezifische Fragen generiert, die für Ihre Behandlung wichtig sein könnten.</p>
        </div>
      </div>
      <form id="ai-questions-form" onsubmit="event.preventDefault();">
        ${questionsHtml}
      </form>
    `;
  }

  // Determine back route based on whether practice custom questions exist
  const hasCustomQuestions = store.getCustomQuestions().length > 0;
  const prevStep = hasCustomQuestions ? 'zusatzfragen' : 'allergien';

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(3.5)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">Spezifische Folgefragen</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">Bitte beantworten Sie diese kurzen Fragen, um Ihrem Arzt ein präziseres Bild zu vermitteln.</p>

          <div id="ai-questions-content">
            ${contentHtml}
          </div>

          ${renderStepNavigation(prevStep, 'dokumente', 'Weiter', isLoading)}
        </div>
      </div>
    </div>
  `;
}

function validateAIQuestions() {
  const aiQuestions = store.get('aiQuestions') || [];
  if (aiQuestions.length === 0) return { valid: false, message: 'Folgefragen werden generiert...' };

  for (const q of aiQuestions) {
    if (!q.answer || q.answer.trim().length === 0) {
      return { valid: false, message: 'Bitte beantworten Sie alle Fragen.' };
    }
  }

  return { valid: true };
}

export function initAIZusatzfragenView() {
  const aiQuestions = store.get('aiQuestions') || [];

  if (aiQuestions.length === 0) {
    // We need to fetch and generate from backend
    const terminCode = store.getTerminCode();
    
    fetch(`/api/precheckin/${terminCode}/generate-ai-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Generation failed');
        return res.json();
      })
      .then(data => {
        if (data.success && Array.isArray(data.questions)) {
          store.set('aiQuestions', data.questions);
          // Re-render and re-init
          const appEl = document.getElementById('app');
          if (appEl) {
            appEl.innerHTML = renderAIZusatzfragenView();
            initAIZusatzfragenView();
          }
        }
      })
      .catch(err => {
        console.error('Failed to generate AI questions:', err);
        // Fallback to simple local generation so the app never gets stuck
        const localFallback = [
          { question: 'Gibt es Begleitsymptome wie Schwindel oder Fieber?', answer: '' },
          { question: 'Seit wann treten diese Symptome genau auf?', answer: '' }
        ];
        store.set('aiQuestions', localFallback);
        const appEl = document.getElementById('app');
        if (appEl) {
          appEl.innerHTML = renderAIZusatzfragenView();
          initAIZusatzfragenView();
        }
      });
    return;
  }

  // Setup event listeners for textareas
  document.querySelectorAll('.ai-q-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const currentQuestions = store.get('aiQuestions') || [];
      if (currentQuestions[idx]) {
        currentQuestions[idx].answer = e.target.value;
        store.set('aiQuestions', currentQuestions);
        updateNextButtonState(validateAIQuestions);
      }
    });

    // Animate cards on focus
    input.addEventListener('focus', () => {
      const card = input.closest('.ai-question-card');
      if (card) {
        card.style.borderColor = 'var(--blue-600)';
        card.style.transform = 'translateY(-2px)';
      }
    });

    input.addEventListener('blur', () => {
      const card = input.closest('.ai-question-card');
      if (card) {
        card.style.borderColor = 'rgba(16, 122, 202, 0.15)';
        card.style.transform = 'translateY(0)';
      }
    });
  });

  initStepNavigation(validateAIQuestions);
  updateNextButtonState(validateAIQuestions);
}
