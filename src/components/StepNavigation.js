export function renderStepNavigation(prevHash, nextHash, nextLabel = 'Weiter', nextDisabled = false) {
  const prevBtn = prevHash
    ? `<button class="btn btn-secondary btn-lg" id="btn-prev" data-nav="${prevHash}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Zurück
       </button>`
    : '<div></div>';

  const nextBtn = `
    <button class="btn btn-primary btn-lg ${nextDisabled ? '' : ''}" id="btn-next" data-nav="${nextHash}" ${nextDisabled ? 'disabled' : ''}>
      ${nextLabel}
      ${nextLabel !== 'Absenden' ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>` : ''}
    </button>
  `;

  return `<div class="step-nav">${prevBtn}${nextBtn}</div>`;
}

export function initStepNavigation() {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');

  if (prev) {
    prev.addEventListener('click', () => {
      window.location.hash = prev.dataset.nav;
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      if (!next.disabled) {
        window.location.hash = next.dataset.nav;
      }
    });
  }
}
