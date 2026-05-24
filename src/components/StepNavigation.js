export function renderStepNavigation(prevHash, nextHash, nextLabel = 'Weiter', nextDisabled = false) {
  const prevBtn = prevHash
    ? `<button class="btn btn-secondary btn-lg" id="btn-prev" data-nav="${prevHash}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Zurück
       </button>`
    : '<div></div>';

  const nextBtn = `
    <button class="btn btn-primary btn-lg" id="btn-next" data-nav="${nextHash}" ${nextDisabled ? 'disabled' : ''}>
      ${nextLabel}
      ${nextLabel !== 'Absenden' ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>` : ''}
    </button>
  `;

  return `
    <div id="validation-message" class="validation-message" style="display: none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span id="validation-text">Bitte füllen Sie die erforderlichen Felder aus.</span>
    </div>
    <div class="step-nav">${prevBtn}${nextBtn}</div>
  `;
}

/**
 * Initialize step navigation with optional validation.
 * @param {Function} [validateFn] - A function that returns { valid: boolean, message?: string }.
 *   If not provided, navigation proceeds without validation.
 */
export function initStepNavigation(validateFn = null) {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  const validationMsg = document.getElementById('validation-message');
  const validationText = document.getElementById('validation-text');

  if (prev) {
    prev.addEventListener('click', () => {
      window.location.hash = prev.dataset.nav;
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      if (next.disabled) return;

      if (validateFn) {
        const result = validateFn();
        if (!result.valid) {
          // Show validation message
          if (validationMsg && validationText) {
            validationText.textContent = result.message || 'Bitte füllen Sie die erforderlichen Felder aus.';
            validationMsg.style.display = 'flex';
            validationMsg.classList.add('validation-shake');
            setTimeout(() => validationMsg.classList.remove('validation-shake'), 600);
          }
          return;
        }
      }

      // Hide validation message on success
      if (validationMsg) validationMsg.style.display = 'none';
      window.location.hash = next.dataset.nav;
    });
  }
}

/**
 * Update the "Weiter" button's disabled state based on current validation.
 * Call this whenever form data changes.
 */
export function updateNextButtonState(validateFn) {
  const next = document.getElementById('btn-next');
  const validationMsg = document.getElementById('validation-message');
  if (!next || !validateFn) return;

  const result = validateFn();
  next.disabled = !result.valid;

  // Hide validation message when valid
  if (result.valid && validationMsg) {
    validationMsg.style.display = 'none';
  }
}
