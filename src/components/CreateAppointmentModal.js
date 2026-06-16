import { auth } from '../utils/auth.js';

export function openCreateAppointmentModal(callback) {
  // Remove existing modal if any
  document.getElementById('create-appt-modal')?.remove();

  const user = auth.getUser() || {};
  const defaultDoctor = user.vorname && user.nachname 
    ? `Dr. med. ${user.vorname} ${user.nachname}` 
    : (user.praxis_name || '');

  // Default date: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const html = `
    <div class="dl-modal-backdrop" id="create-appt-modal" style="z-index: 9100; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5);">
      <div class="dl-modal-card fade-in-up" style="max-width: 520px; width: 90%; background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; padding: 0; overflow: hidden; box-shadow: var(--shadow-lg);">
        
        <!-- Header -->
        <div class="dl-modal-header" style="padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;">
          <h3 class="dl-modal-title" style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin: 0;">📞 Telefonischen Termin eintragen</h3>
          <button class="dl-modal-close" id="btn-close-create-appt" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--gray-400); line-height: 1;">&times;</button>
        </div>
        
        <!-- Body / Form -->
        <div class="dl-modal-body" style="padding: var(--space-5) var(--space-6); overflow-y: auto; max-height: 70vh; display: flex; flex-direction: column; gap: var(--space-4);">
          <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.4; margin: 0 0 var(--space-2) 0;">
            Tragen Sie hier einen telefonisch vereinbarten Termin ein. Der Patient wird automatisch per E-Mail benachrichtigt und sieht den Termin bei Registrierung oder Anmeldung in seiner Terminübersicht.
          </p>

          <div id="create-appt-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); display: none; font-weight: 600;"></div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Vorname des Patienten *</label>
              <input type="text" id="create-appt-vorname" placeholder="z.B. Max" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
            </div>
            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Nachname des Patienten *</label>
              <input type="text" id="create-appt-nachname" placeholder="z.B. Mustermann" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
            </div>
          </div>

          <div>
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">E-Mail-Adresse des Patienten *</label>
            <input type="email" id="create-appt-email" placeholder="patient@example.com" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
          </div>

          <div style="border-top: 1px solid var(--gray-100); padding-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Behandelnder Arzt / Behandler *</label>
              <input type="text" id="create-appt-doctor" value="${defaultDoctor}" placeholder="z.B. Dr. Hartmann" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Datum *</label>
                <input type="date" id="create-appt-date" value="${defaultDateStr}" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Uhrzeit *</label>
                <select id="create-appt-time" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; cursor: pointer;">
                  <option value="08:00">08:00 Uhr</option>
                  <option value="08:30">08:30 Uhr</option>
                  <option value="09:00">09:00 Uhr</option>
                  <option value="09:30" selected>09:30 Uhr</option>
                  <option value="10:00">10:00 Uhr</option>
                  <option value="10:30">10:30 Uhr</option>
                  <option value="11:00">11:00 Uhr</option>
                  <option value="11:30">11:30 Uhr</option>
                  <option value="12:00">12:00 Uhr</option>
                  <option value="12:30">12:30 Uhr</option>
                  <option value="13:00">13:00 Uhr</option>
                  <option value="13:30">13:30 Uhr</option>
                  <option value="14:00">14:00 Uhr</option>
                  <option value="14:30">14:30 Uhr</option>
                  <option value="15:00">15:00 Uhr</option>
                  <option value="15:30">15:30 Uhr</option>
                  <option value="16:00">16:00 Uhr</option>
                  <option value="16:30">16:30 Uhr</option>
                  <option value="17:00">17:00 Uhr</option>
                </select>
              </div>
            </div>

            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">Besuchsgrund (Art) *</label>
              <select id="create-appt-art" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; cursor: pointer;">
                <option value="Routineuntersuchung">Routineuntersuchung</option>
                <option value="Erstgespräch">Erstgespräch</option>
                <option value="Akutbeschwerden">Akutbeschwerden</option>
                <option value="Besprechung">Besprechung / Beratung</option>
                <option value="Kontrolltermin">Kontrolltermin</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="dl-modal-footer" style="padding: var(--space-4) var(--space-6); background: var(--bg-gray); border-top: 1px solid var(--gray-200); display: flex; justify-content: flex-end; gap: var(--space-3);">
          <button class="btn btn-outline" id="btn-cancel-create-appt" style="padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm); border: 1px solid var(--gray-300); background: white; border-radius: var(--radius-md); cursor: pointer;">Abbrechen</button>
          <button class="btn btn-primary" id="btn-submit-create-appt" style="padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm); background: var(--primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 700;">Termin eintragen</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('create-appt-modal');
  const errorDiv = document.getElementById('create-appt-error');

  const close = () => modal?.remove();

  document.getElementById('btn-close-create-appt')?.addEventListener('click', close);
  document.getElementById('btn-cancel-create-appt')?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // Handle Form Submission
  document.getElementById('btn-submit-create-appt')?.addEventListener('click', async () => {
    const patientVorname = document.getElementById('create-appt-vorname').value.trim();
    const patientNachname = document.getElementById('create-appt-nachname').value.trim();
    const patientEmail = document.getElementById('create-appt-email').value.trim();
    const doctor = document.getElementById('create-appt-doctor').value.trim();
    const date = document.getElementById('create-appt-date').value;
    const time = document.getElementById('create-appt-time').value;
    const art = document.getElementById('create-appt-art').value;

    if (!patientVorname || !patientNachname || !patientEmail || !doctor || !date || !time || !art) {
      errorDiv.innerText = 'Bitte füllen Sie alle Pflichtfelder (*) aus.';
      errorDiv.style.display = 'block';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientEmail)) {
      errorDiv.innerText = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      errorDiv.style.display = 'block';
      return;
    }

    errorDiv.style.display = 'none';
    const submitBtn = document.getElementById('btn-submit-create-appt');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="dl-auth-spinner" style="width: 16px; height: 16px; border-width: 2px; display: inline-block;"></div>';

    try {
      const res = await fetch('/api/praxis/termine/buchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientEmail,
          patientVorname,
          patientNachname,
          doctor,
          date,
          time,
          art
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Der Server hat keine gültige Antwort gesendet.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Eintragen des Termins.');
      }

      close();
      if (callback) callback();
    } catch (err) {
      console.error(err);
      errorDiv.innerText = err.message || 'Verbindung fehlgeschlagen.';
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  });
}
