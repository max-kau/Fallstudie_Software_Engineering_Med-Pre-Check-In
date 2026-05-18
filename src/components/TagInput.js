/**
 * TagInput Component
 * Reusable tag-based input for medications, allergies, etc.
 */

export function renderTagInput(id, tags = [], placeholder = 'Eingabe + Enter', suggestions = []) {
  const tagsHtml = tags.map((tag, i) => `
    <span class="tag" data-taginput="${id}" data-index="${i}">
      ${tag}
      <button class="tag-remove" data-taginput="${id}" data-remove="${i}" type="button">&times;</button>
    </span>
  `).join('');

  const suggestionsHtml = suggestions.length > 0 ? `
    <div class="form-hint" style="margin-top: var(--space-2)">Vorschläge:</div>
    <div class="chips-container" style="margin-top: var(--space-1)">
      ${suggestions.map(s => `
        <button class="chip ${tags.includes(s) ? 'selected' : ''}" data-taginput="${id}" data-suggest="${s}" type="button">${s}</button>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="tag-input-wrapper" id="${id}-wrapper">
      <div class="form-input" style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; min-height: 48px; padding: 0.5rem 0.75rem; cursor: text;" id="${id}-container">
        ${tagsHtml}
        <input type="text" id="${id}-input" class="tag-text-input" placeholder="${tags.length ? '' : placeholder}" style="border: none; outline: none; flex: 1; min-width: 120px; padding: 0.25rem 0; font-size: inherit; background: transparent;" />
      </div>
      ${suggestionsHtml}
    </div>
  `;
}

export function initTagInput(id, tags, onUpdate, suggestions = []) {
  const input = document.getElementById(`${id}-input`);
  const container = document.getElementById(`${id}-container`);

  if (!input || !container) return;

  // Click container to focus input
  container.addEventListener('click', () => input.focus());

  // Enter key to add tag
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (value && !tags.includes(value)) {
        tags.push(value);
        input.value = '';
        onUpdate(tags);
      }
    }
    // Backspace to remove last tag when input empty
    if (e.key === 'Backspace' && !input.value && tags.length > 0) {
      tags.pop();
      onUpdate(tags);
    }
  });

  // Remove tag buttons
  document.querySelectorAll(`[data-taginput="${id}"][data-remove]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.remove);
      tags.splice(idx, 1);
      onUpdate(tags);
    });
  });

  // Suggestion chips
  document.querySelectorAll(`[data-taginput="${id}"][data-suggest]`).forEach(chip => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.suggest;
      if (tags.includes(value)) {
        tags.splice(tags.indexOf(value), 1);
      } else {
        tags.push(value);
      }
      onUpdate(tags);
    });
  });
}
