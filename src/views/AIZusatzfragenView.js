import { renderHeader } from '../components/Header.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderStepNavigation, initStepNavigation, updateNextButtonState } from '../components/StepNavigation.js';
import { store } from '../utils/store.js';
import { t } from '../utils/i18n.js';

export function renderAIZusatzfragenView() {
  const aiQuestions = store.get('aiQuestions') || [];
  const hasConsent = store.get('aiConsent') !== false;
  const isLoading = aiQuestions.length === 0 && hasConsent;

  let contentHtml = '';

  if (isLoading) {
    contentHtml = `
      <div class="ai-loading-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) 0; text-align: center;">
        <div class="dl-auth-spinner" style="width: 50px; height: 50px; border-width: 4px; border-color: var(--blue-600) transparent var(--blue-600) transparent; margin-bottom: var(--space-6);"></div>
        <h3 style="margin-bottom: var(--space-2); color: var(--gray-800);">${t('common.loading')}</h3>
        <p class="text-muted" style="max-width: 400px; font-size: var(--font-size-sm);">${t('ai_zusatzfragen.subtitle')}</p>
      </div>
    `;
  } else {
    // Show standard questions or generated AI questions
    const displayQuestions = aiQuestions.length > 0 ? aiQuestions : [];
    
    const questionsHtml = displayQuestions.map((q, idx) => {
      const isAi = hasConsent;
      const cardBg = isAi 
        ? 'linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%)' 
        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
      const badgeBg = isAi ? 'rgba(16, 122, 202, 0.1)' : 'rgba(100, 116, 139, 0.1)';
      const badgeColor = isAi ? 'var(--blue-600)' : 'var(--gray-600)';
      const borderStyle = isAi ? '1px solid rgba(16, 122, 202, 0.15)' : '1px solid rgba(100, 116, 139, 0.15)';

      return `
        <div class="form-group ai-question-card" style="margin-bottom: var(--space-6); background: ${cardBg}; padding: var(--space-5) var(--space-6); border-radius: var(--radius-xl); border: ${borderStyle}; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02); transition: transform 0.2s ease, border-color 0.2s ease;">
          <label class="form-label" style="display: flex; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-3); color: var(--gray-800); font-weight: 600; font-size: var(--font-size-base); line-height: 1.4;">
            <span style="display: inline-flex; align-items: center; justify-content: center; background: ${badgeBg}; color: ${badgeColor}; border-radius: 50%; width: 24px; height: 24px; font-size: 12px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">${idx + 1}</span>
            <span>${q.question}</span>
            <span style="color: var(--red-600); font-weight: bold; font-size: var(--font-size-sm); margin-left: 2px;">*</span>
          </label>
          <textarea class="form-textarea ai-q-input" data-idx="${idx}" placeholder="..." style="margin-top: var(--space-2); min-height: 90px; border-color: rgba(0, 0, 0, 0.15); background: #ffffff;" required>${q.answer || ''}</textarea>
        </div>
      `;
    }).join('');

    const bannerHtml = hasConsent ? `
      <div style="margin-bottom: var(--space-6); padding: var(--space-4) var(--space-5); background: linear-gradient(90deg, #eef2ff 0%, #e0e7ff 100%); border-radius: var(--radius-lg); display: flex; align-items: center; gap: var(--space-3); border: 1px solid rgba(99, 102, 241, 0.2);">
        <span style="font-size: var(--font-size-2xl);">🤖</span>
        <div>
          <h4 style="color: #312e81; font-weight: 600; margin-bottom: 2px;">${t('ai_zusatzfragen.title')}</h4>
          <p style="color: #4338ca; font-size: var(--font-size-xs); margin: 0; line-height: 1.3;">${t('ai_zusatzfragen.subtitle')}</p>
        </div>
      </div>
    ` : `
      <div style="margin-bottom: var(--space-6); padding: var(--space-4) var(--space-5); background: linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%); border-radius: var(--radius-lg); display: flex; align-items: center; gap: var(--space-3); border: 1px solid rgba(148, 163, 184, 0.2);">
        <span style="font-size: var(--font-size-2xl);">📋</span>
        <div>
          <h4 style="color: #1e293b; font-weight: 600; margin-bottom: 2px;">${t('ai_zusatzfragen.title')}</h4>
          <p style="color: #475569; font-size: var(--font-size-xs); margin: 0; line-height: 1.3;">${t('ai_zusatzfragen.subtitle')}</p>
        </div>
      </div>
    `;

    contentHtml = `
      ${bannerHtml}
      <form id="ai-questions-form" onsubmit="event.preventDefault();">
        ${questionsHtml}
      </form>
    `;
  }

  // Determine back route based on whether practice custom questions exist
  const hasCustomQuestions = store.getCustomQuestions().length > 0;
  const prevStep = hasCustomQuestions ? 'zusatzfragen' : 'allergien';
  const headingText = t('ai_zusatzfragen.title');
  const subHeadingText = t('ai_zusatzfragen.subtitle');

  return `
    ${renderHeader()}
    <div class="view">
      ${renderProgressBar(3.5)}
      <div class="container container--form">
        <div class="view-content">
          <h2 style="margin-bottom: var(--space-2);">${headingText}</h2>
          <p class="text-muted" style="margin-bottom: var(--space-6);">${subHeadingText}</p>

          <div id="ai-questions-content">
            ${contentHtml}
          </div>

          ${renderStepNavigation(prevStep, 'dokumente', t('common.next'), isLoading)}
        </div>
      </div>
    </div>
  `;
}

function validateAIQuestions() {
  const aiQuestions = store.get('aiQuestions') || [];
  if (aiQuestions.length === 0) return { valid: false, message: t('ai_zusatzfragen.loading') };

  for (const q of aiQuestions) {
    if (!q.answer || q.answer.trim().length === 0) {
      return { valid: false, message: t('ai_zusatzfragen.val_required') };
    }
  }

  return { valid: true };
}

export function initAIZusatzfragenView() {
  const aiQuestions = store.get('aiQuestions') || [];
  const hasConsent = store.get('aiConsent') !== false;

  if (aiQuestions.length === 0) {
    if (!hasConsent) {
      // Load standard questions catalogue
      const standardQuestions = [
        { question: t('ai_zusatzfragen.std_q1'), answer: '' },
        { question: t('ai_zusatzfragen.std_q2'), answer: '' },
        { question: t('ai_zusatzfragen.std_q3'), answer: '' },
        { question: t('ai_zusatzfragen.std_q4'), answer: '' }
      ];
      store.set('aiQuestions', standardQuestions);
      
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.innerHTML = renderAIZusatzfragenView();
        initAIZusatzfragenView();
      }
      return;
    }

    // Call dynamic AI generation endpoint if consent is granted
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
        let qList = data.questions;
        while (typeof qList === 'string') {
          try { qList = JSON.parse(qList); } catch (e) { break; }
        }
        if (data.success && Array.isArray(qList)) {
          store.set('aiQuestions', qList);
          const appEl = document.getElementById('app');
          if (appEl) {
            appEl.innerHTML = renderAIZusatzfragenView();
            initAIZusatzfragenView();
          }
        }
      })
      .catch(err => {
        console.error('Failed to generate AI questions:', err);
        // Local fallback
        const localFallback = [
          { question: t('ai_zusatzfragen.std_q1'), answer: '' },
          { question: t('ai_zusatzfragen.std_q2'), answer: '' }
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
        card.style.borderColor = hasConsent ? 'var(--blue-600)' : 'var(--gray-600)';
        card.style.transform = 'translateY(-2px)';
      }
    });

    input.addEventListener('blur', () => {
      const card = input.closest('.ai-question-card');
      if (card) {
        card.style.borderColor = hasConsent ? 'rgba(16, 122, 202, 0.15)' : 'rgba(100, 116, 139, 0.15)';
        card.style.transform = 'translateY(0)';
      }
    });
  });

  initStepNavigation(validateAIQuestions);
  updateNextButtonState(validateAIQuestions);
}
