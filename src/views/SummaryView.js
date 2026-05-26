import { renderHeader } from '../components/Header.js';
import { store } from '../utils/store.js';

const DAUER_MAP = { heute: 'Seit heute', einige_tage: 'Seit einigen Tagen', eine_woche: 'Seit etwa einer Woche', mehrere_wochen: 'Seit mehreren Wochen', monate: 'Seit Monaten', laenger: 'Länger als 6 Monate' };

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function renderSummaryView() {
  const allData = store.getAll();
  const b = allData.beschwerden;
  const m = allData.medikamente;
  const a = allData.allergien;
  const d = allData.dokumente || { liste: [] };

  if (allData.submitted) return renderSuccessScreen();

  const symptomsList = [...b.chips];
  const beschwerdenContent = `
    ${symptomsList.length ? `<div class="summary-item"><div class="summary-item-label">Ausgewählte Symptome</div>${symptomsList.join(', ')}</div>` : ''}
    ${b.freitext ? `<div class="summary-item"><div class="summary-item-label">Beschreibung</div>${b.freitext}</div>` : ''}
    ${b.dauer ? `<div class="summary-item"><div class="summary-item-label">Dauer</div>${DAUER_MAP[b.dauer] || b.dauer}</div>` : ''}
    <div class="summary-item"><div class="summary-item-label">Stärke</div>${b.staerke} / 10</div>
  `;

  const medContent = m.keine
    ? '<div class="summary-item">Keine Medikamente</div>'
    : (m.liste.length ? `<div class="summary-item">${m.liste.join(', ')}</div>` : '<div class="summary-item text-muted">Keine Angabe</div>');

  const allerContent = a.keine
    ? '<div class="summary-item">Keine bekannten Allergien</div>'
    : `${a.liste.length ? `<div class="summary-item">${a.liste.join(', ')}</div>` : '<div class="summary-item text-muted">Keine Angabe</div>'}
       ${a.anmerkungen ? `<div class="summary-item"><div class="summary-item-label">Anmerkungen</div>${a.anmerkungen}</div>` : ''}`;

  const docsContent = d.liste.length
    ? d.liste.map(file => `
        <div class="summary-item" style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
          <span>📄 ${file.filename} (${formatBytes(file.fileSize)})</span>
          <a href="/api/file/${file.id}" target="_blank" style="color: var(--primary); text-decoration: underline; font-size: var(--font-size-xs); font-weight: 500;">Ansehen</a>
        </div>
      `).join('')
    : '<div class="summary-item text-muted">Keine Dokumente hochgeladen</div>';

  return `
    ${renderHeader()}
    <div class="view">
      <div class="container container--form">
        <div class="view-content" style="padding-top:var(--space-8)">
          <h2 style="margin-bottom:var(--space-2)">Zusammenfassung</h2>
          <p class="text-muted" style="margin-bottom:var(--space-6)">Bitte überprüfen Sie Ihre Angaben vor dem Absenden.</p>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">🩺 Beschwerden</div>
              <button class="summary-edit" data-edit="beschwerden">Bearbeiten</button>
            </div>
            <div class="summary-content">${beschwerdenContent}</div>
          </div>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">💊 Medikamente</div>
              <button class="summary-edit" data-edit="medikamente">Bearbeiten</button>
            </div>
            <div class="summary-content">${medContent}</div>
          </div>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">⚠️ Allergien</div>
              <button class="summary-edit" data-edit="allergien">Bearbeiten</button>
            </div>
            <div class="summary-content">${allerContent}</div>
          </div>

          <div class="summary-section card fade-in-up">
            <div class="summary-header">
              <div class="summary-title">📂 Dokumente</div>
              <button class="summary-edit" data-edit="dokumente">Bearbeiten</button>
            </div>
            <div class="summary-content">${docsContent}</div>
          </div>

          <label class="checkbox-group" style="margin:var(--space-4) 0">
            <input type="checkbox" class="checkbox-input" id="confirm-checkbox" />
            <span class="checkbox-label">Ich bestätige, dass meine Angaben korrekt und vollständig sind.</span>
          </label>

          <button class="btn btn-primary btn-lg btn-block" id="btn-submit" disabled>
            ✓ Pre-Check absenden
          </button>
        </div>
      </div>
    </div>`;
}

function renderSuccessScreen() {
  const termin = store.getTerminInfo();
  return `
    ${renderHeader()}
    <div class="view">
      <div class="container container--form">
        <div class="view-content" style="justify-content:center">
          <div class="success-screen">
            <div class="success-icon success-animate">✓</div>
            <h2>Erfolgreich übermittelt!</h2>
            <p style="margin-top:var(--space-3)">Ihre Angaben wurden erfolgreich an <strong>${termin.praxis}</strong> übermittelt. Ihr Arzt kann sich nun optimal auf Ihren Termin vorbereiten.</p>
            <div class="termin-card" style="margin-top:var(--space-8);text-align:left">
              <div class="termin-icon">📅</div>
              <div class="termin-info">
                <div class="termin-doctor">${termin.doctor}</div>
                <div class="termin-date">${termin.date}, ${termin.time}</div>
              </div>
            </div>
            <p class="text-muted" style="margin-top:var(--space-8);font-size:var(--font-size-sm)">Sie können dieses Fenster jetzt schließen.</p>
          </div>
        </div>
      </div>
    </div>`;
}

export function initSummaryView() {
  // Edit buttons
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = btn.dataset.edit; });
  });

  // Confirm checkbox
  const checkbox = document.getElementById('confirm-checkbox');
  const submitBtn = document.getElementById('btn-submit');
  if (checkbox && submitBtn) {
    checkbox.addEventListener('change', () => { submitBtn.disabled = !checkbox.checked; });
    submitBtn.addEventListener('click', async () => {
      if (!checkbox.checked) return;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="shimmer" style="display:inline-block;width:120px;height:20px;border-radius:10px"></span>';
      try {
        await store.submitPreCheckIn();
        const app = document.getElementById('app');
        app.innerHTML = renderSuccessScreen();
      } catch (err) {
        console.error('Submission failed:', err);
        alert('Fehler beim Absenden. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✓ Pre-Check absenden';
      }
    });
  }
}
