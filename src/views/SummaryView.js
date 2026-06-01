import { renderHeader } from '../components/Header.js';
import { store } from '../utils/store.js';
import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';

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

          <!-- Digital Signature Canvas Card -->
          <div class="summary-section card fade-in-up" style="margin-top: var(--space-6);">
            <div class="summary-header">
              <div class="summary-title">✍️ Digitale Unterschrift</div>
              <button class="summary-edit" id="btn-clear-signature" style="color: var(--danger); background: transparent; border: none; cursor: pointer;">Löschen</button>
            </div>
            <div class="summary-content" style="padding: 0; background: var(--white); border: 2px dashed var(--gray-200); border-radius: var(--radius-lg); overflow: hidden;">
              <canvas id="signature-canvas" style="width: 100%; height: 150px; display: block; cursor: crosshair; background: #fff;"></canvas>
            </div>
            <p class="text-muted" style="font-size: var(--font-size-xs); margin-top: var(--space-2);">Bitte unterschreiben Sie im obigen Feld mit Ihrer Maus oder Ihrem Finger (bei Touchscreens).</p>
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
  const allData = store.getAll();
  
  // Find the generated summary PDF in the documents list
  const pdfFile = allData.dokumente.liste.find(f => f.filename.startsWith('Zusammenfassung_'));

  const pdfDownloadButton = pdfFile
    ? `<a href="/api/file/${pdfFile.id}" target="_blank" class="btn btn-outline btn-lg btn-block" style="margin-top: var(--space-4); display: flex; align-items: center; justify-content: center; gap: var(--space-2); text-decoration: none;">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
         Zusammenfassung (PDF) herunterladen
       </a>`
    : '';

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
            ${pdfDownloadButton}
            <button class="btn btn-primary btn-lg btn-block" id="btn-success-home" style="margin-top: var(--space-4);">
              Zurück zur Startseite
            </button>
            <p class="text-muted" style="margin-top:var(--space-8);font-size:var(--font-size-sm)">Sie können dieses Fenster jetzt schließen.</p>
          </div>
        </div>
      </div>
    </div>`;
}

function setupSuccessHomeButton() {
  const btnSuccessHome = document.getElementById('btn-success-home');
  if (btnSuccessHome) {
    btnSuccessHome.addEventListener('click', () => {
      store.resetProgress();
      navigate('landing');
    });
  }
}

function generatePDF(allData, signatureDataUrl) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const patient = store.getPatientInfo();
  const termin = store.getTerminInfo();

  // Title / Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(16, 122, 202); // Doctolib Blue
  doc.text('Doctolib Pre-Check-In Zusammenfassung', 20, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Erstellt am: ${new Date().toLocaleString('de-DE')}`, 20, 32);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 36, 190, 36);

  // Section 1: Patient & Appointment Details
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('1. Patient & Termin', 20, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Patient: ${patient.vorname} ${patient.nachname}`, 20, 52);
  doc.text(`Arzt/Praxis: ${termin.doctor} (${termin.praxis})`, 20, 57);
  doc.text(`Termin: ${termin.date} um ${termin.time} Uhr`, 20, 62);
  doc.text(`Konsultationsart: ${termin.art}`, 20, 67);

  // Section 2: Complaints
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Medizinische Beschwerden', 20, 77);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const symptoms = allData.beschwerden.chips.join(', ') || 'Keine Symptome ausgewählt';
  doc.text(`Ausgewählte Symptome: ${symptoms}`, 20, 84);

  const splitFreitext = doc.splitTextToSize(`Beschreibung: ${allData.beschwerden.freitext || 'Keine Freitextbeschreibung eingegeben'}`, 170);
  doc.text(splitFreitext, 20, 89);

  const dauerText = allData.beschwerden.dauer ? (DAUER_MAP[allData.beschwerden.dauer] || allData.beschwerden.dauer) : 'Keine Angabe';
  doc.text(`Dauer der Beschwerden: ${dauerText}`, 20, 105);
  doc.text(`Schmerzstärke: ${allData.beschwerden.staerke || 0} / 10`, 20, 110);

  // Section 3: Medications
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Aktuelle Medikation', 20, 122);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const meds = allData.medikamente.keine ? 'Keine Medikamente angegeben' : (allData.medikamente.liste.join(', ') || 'Keine Angabe');
  doc.text(meds, 20, 129);

  // Section 4: Allergies
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Allergien & Unverträglichkeiten', 20, 139);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const allergies = allData.allergien.keine ? 'Keine bekannten Allergien' : (allData.allergien.liste.join(', ') || 'Keine Angabe');
  doc.text(allergies, 20, 146);
  if (allData.allergien.anmerkungen) {
    doc.text(`Anmerkungen: ${allData.allergien.anmerkungen}`, 20, 151);
  }

  // Section 5: Documents
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Hochgeladene Dokumente', 20, 161);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const docsList = allData.dokumente.liste.map(f => `${f.filename} (${formatBytes(f.fileSize)})`).join(', ') || 'Keine Dokumente hochgeladen';
  doc.text(docsList, 20, 168);

  // Section 6: Signature
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Bestätigung & Digitale Unterschrift', 20, 178);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Hiermit bestätige ich, dass die vorstehenden Angaben nach bestem Wissen korrekt und vollständig gemacht wurden.', 20, 185);

  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, 'PNG', 20, 188, 70, 20);
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Handzeichen von ${patient.vorname} ${patient.nachname}`, 20, 214);

  return doc;
}

export function initSummaryView() {
  // Edit buttons
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = btn.dataset.edit; });
  });

  const canvas = document.getElementById('signature-canvas');
  let hasSigned = false;

  const checkbox = document.getElementById('confirm-checkbox');
  const submitBtn = document.getElementById('btn-submit');

  function updateSubmitState() {
    if (checkbox && submitBtn) {
      submitBtn.disabled = !(checkbox.checked && hasSigned);
    }
  }

  if (canvas) {
    const ctx = canvas.getContext('2d');
    
    // Support high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.strokeStyle = '#107ACA'; // Doctolib Blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false;

    // Load existing signature if exists
    const savedSignature = store.get('signature');
    if (savedSignature) {
      const img = new Image();
      img.src = savedSignature;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        hasSigned = true;
        updateSubmitState();
      };
    }

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - r.left,
        y: clientY - r.top
      };
    };

    const startDrawing = (e) => {
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    };

    const draw = (e) => {
      if (!drawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasSigned = true;
      updateSubmitState();
      e.preventDefault();
    };

    const stopDrawing = () => {
      if (drawing) {
        drawing = false;
        // Auto-save the signature as a base64 DataURL
        const dataUrl = canvas.toDataURL('image/png');
        store.set('signature', dataUrl);
      }
    };

    // Mouse listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch listeners
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    // Clear Button listener
    const clearBtn = document.getElementById('btn-clear-signature');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasSigned = false;
        store.set('signature', null);
        updateSubmitState();
      });
    }
  }

  if (checkbox) {
    checkbox.addEventListener('change', updateSubmitState);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!checkbox.checked || !hasSigned) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="shimmer" style="display:inline-block;width:120px;height:20px;border-radius:10px"></span>';

      try {
        const patient = store.getPatientInfo();
        const allData = store.getAll();

        // 1. Generate client-side PDF document
        const doc = generatePDF(allData, allData.signature);
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // 2. Upload generated PDF as appointment attachment
        const terminCode = store.getTerminCode();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            terminCode,
            filename: `Zusammenfassung_${patient.vorname}_${patient.nachname}.pdf`,
            mimeType: 'application/pdf',
            fileData: pdfBase64
          })
        });

        if (!res.ok) throw new Error('PDF upload failed');
        const uploadResult = await res.json();

        if (uploadResult.success) {
          // 3. Inject generated PDF metadata into local documents state list
          const docs = allData.dokumente || { liste: [] };
          docs.liste.push(uploadResult.file);
          store.set('dokumente', docs);
        }

        // 4. Submit Pre-Check-In
        await store.submitPreCheckIn();

        const app = document.getElementById('app');
        app.innerHTML = renderSuccessScreen();
        setupSuccessHomeButton();
      } catch (err) {
        console.error('Submission failed:', err);
        alert('Fehler beim Absenden. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✓ Pre-Check absenden';
      }
    });
  }

  setupSuccessHomeButton();
  updateSubmitState();
}
