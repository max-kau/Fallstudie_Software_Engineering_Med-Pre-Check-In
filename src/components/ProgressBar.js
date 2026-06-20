import { store } from '../utils/store.js';

export function renderProgressBar(currentStep) {
  const hasPraxisDocs = store.getPraxisDocuments().length > 0;
  const steps = [
    { num: 1, label: 'Beschwerden' },
    { num: 2, label: 'Medikamente' },
    { num: 3, label: 'Allergien' },
    { num: 4, label: 'Folgefragen' },
    { num: 5, label: 'Dokumente' },
  ];

  if (hasPraxisDocs) {
    steps.push({ num: 6, label: 'Einwilligungen' });
  }

  const totalSteps = steps.length;
  const fillPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const stepsHtml = steps.map(step => {
    let state = '';
    if (step.num < currentStep) state = 'completed';
    else if (step.num === currentStep) state = 'active';

    return `
      <div class="progress-step ${state}">
        <div class="progress-circle">${state === 'completed' ? '' : step.num}</div>
        <div class="progress-label">${step.label}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="progress-container">
      <div class="container">
        <div class="progress-steps">
          <div class="progress-line">
            <div class="progress-line-fill" style="width: ${fillPercent}%"></div>
          </div>
          ${stepsHtml}
        </div>
      </div>
    </div>
  `;
}
