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
    <style>
      .search-result-item:hover {
        background-color: var(--gray-50) !important;
      }
      .search-result-item.selected {
        background-color: var(--primary-lightest) !important;
      }
    </style>
    <div class="dl-modal-backdrop" id="create-appt-modal" style="z-index: 9100; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5);">
      <div class="dl-modal-card fade-in-up" style="max-width: 540px; width: 90%; background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; padding: 0; overflow: hidden; box-shadow: var(--shadow-lg);">
        
        <!-- Header -->
        <div class="dl-modal-header" style="padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;">
          <h3 class="dl-modal-title" style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin: 0;">📞 Telefonischen Termin eintragen</h3>
          <button class="dl-modal-close" id="btn-close-create-appt" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--gray-400); line-height: 1;">&times;</button>
        </div>
        
        <!-- Body / Form -->
        <div class="dl-modal-body" style="padding: var(--space-5) var(--space-6); overflow-y: auto; max-height: 70vh; display: flex; flex-direction: column; gap: var(--space-4);">
          <p style="font-size: var(--font-size-sm); color: var(--gray-600); line-height: 1.4; margin: 0;">
            Tragen Sie hier einen telefonisch vereinbarten Termin ein. Geben Sie dazu die Patientendaten ein. Existierende Patienten können über die Suche geladen werden.
          </p>

          <!-- Search Section -->
          <div style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--gray-200); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-700);">🔍 PATIENTEN-SUCHE</span>
              <span id="patient-status-badge" style="background: var(--gray-200); color: var(--gray-700); font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600;">🆕 Neuer Patient</span>
            </div>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="text" id="create-appt-search" placeholder="Name, Vorname oder E-Mail eingeben..." style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) 36px var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; transition: all 0.2s ease;">
              <div id="search-spinner" class="dl-auth-spinner" style="display: none; position: absolute; right: 12px; width: 16px; height: 16px; border-width: 2px;"></div>
              <div id="create-appt-search-results" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); z-index: 9200; max-height: 280px; overflow-y: auto; padding: 4px 0;"></div>
            </div>
          </div>

          <div id="create-appt-error" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); display: none; font-weight: 600;"></div>

          <!-- Patient Information (Akte) -->
          <div style="display: flex; flex-direction: column; gap: var(--space-3); border: 1px solid var(--gray-200); padding: var(--space-4); border-radius: var(--radius-lg);">
            <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-700); border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-1); margin-bottom: var(--space-1);">📋 PATIENTENAKTE</span>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Vorname *</label>
                <input type="text" id="create-appt-vorname" placeholder="Max" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Nachname *</label>
                <input type="text" id="create-appt-nachname" placeholder="Mustermann" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
            </div>

            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">E-Mail-Adresse *</label>
              <input type="email" id="create-appt-email" placeholder="patient@example.com" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Geburtsdatum</label>
                <input type="date" id="create-appt-geburtsdatum" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Telefonnummer</label>
                <input type="text" id="create-appt-telefon" placeholder="0176..." style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--space-3);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Straße & Hausnummer</label>
                <input type="text" id="create-appt-strasse" placeholder="Hauptstr. 10" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">PLZ & Ort</label>
                <input type="text" id="create-appt-plzort" placeholder="80331 München" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Versicherung</label>
                <select id="create-appt-versicherung" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white; cursor: pointer;">
                  <option value="gesetzlich">Gesetzlich</option>
                  <option value="privat">Privat</option>
                </select>
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Krankenkasse</label>
                <input type="text" id="create-appt-krankenkasse" placeholder="Techniker Krankenkasse" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
            </div>
          </div>

          <!-- Appointment Details Section -->
          <div style="display: flex; flex-direction: column; gap: var(--space-3); border: 1px solid var(--gray-200); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--gray-50);">
            <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-700); border-bottom: 1px solid var(--gray-100); padding-bottom: var(--space-1); margin-bottom: var(--space-1);">📅 TERMIN-DETAILS</span>

            <div>
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Behandelnder Arzt / Behandler *</label>
              <input type="text" id="create-appt-doctor" value="${defaultDoctor}" placeholder="Dr. Hartmann" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Datum *</label>
                <input type="date" id="create-appt-date" value="${defaultDateStr}" style="width: 100%; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); background: white;">
              </div>
              <div>
                <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Uhrzeit *</label>
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
              <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 4px;">Besuchsgrund (Art) *</label>
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

  // Setup Patient Search
  const searchInput = document.getElementById('create-appt-search');
  const searchResultsDiv = document.getElementById('create-appt-search-results');
  const patientStatusBadge = document.getElementById('patient-status-badge');
  const searchSpinner = document.getElementById('search-spinner');

  let debounceTimer;
  let activeIndex = -1;

  const updateActiveItem = () => {
    const list = searchResultsDiv.querySelectorAll('.search-result-item');
    list.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  };

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (!query) {
      searchResultsDiv.innerHTML = '';
      searchResultsDiv.style.display = 'none';
      if (searchSpinner) searchSpinner.style.display = 'none';
      activeIndex = -1;
      return;
    }

    if (searchSpinner) searchSpinner.style.display = 'block';

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/praxis/patients/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (searchSpinner) searchSpinner.style.display = 'none';
        activeIndex = -1;

        if (data.success && data.patients && data.patients.length > 0) {
          searchResultsDiv.innerHTML = data.patients.map((p, idx) => {
            const initials = ((p.vorname?.[0] || '') + (p.nachname?.[0] || '')).toUpperCase();
            const insuranceColor = p.krankenversicherung === 'privat' ? '#3B82F6' : '#10B981';
            const insuranceBg = p.krankenversicherung === 'privat' ? '#EFF6FF' : '#ECFDF5';
            const insuranceText = p.krankenversicherung === 'privat' ? 'Privat' : 'Gesetzlich';
            
            // Format birthday
            let formattedBirth = 'N/A';
            if (p.geburtsdatum) {
              const parts = p.geburtsdatum.split('-');
              if (parts.length === 3) {
                formattedBirth = `${parts[2]}.${parts[1]}.${parts[0]}`;
              } else {
                formattedBirth = p.geburtsdatum;
              }
            }

            return `
              <div class="search-result-item" 
                   style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); cursor: pointer; border-bottom: 1px solid var(--gray-50); font-size: var(--font-size-sm); transition: background-color 0.15s ease;"
                   data-index="${idx}"
                   data-email="${p.email}" 
                   data-vorname="${p.vorname}" 
                   data-nachname="${p.nachname}"
                   data-geburtsdatum="${p.geburtsdatum || ''}"
                   data-telefon="${p.telefonnummer || ''}"
                   data-strasse="${p.strasse_hnr || ''}"
                   data-plzort="${p.plz_ort || ''}"
                   data-versicherung="${p.krankenversicherung || 'gesetzlich'}"
                   data-krankenkasse="${p.krankenkasse || ''}">
                
                <!-- Avatar Circle -->
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-lightest); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--font-size-xs); flex-shrink: 0;">
                  ${initials}
                </div>
                
                <!-- Details -->
                <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
                    <span style="font-weight: 700; color: var(--gray-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${p.vorname} ${p.nachname}
                    </span>
                    <span style="background: ${insuranceBg}; color: ${insuranceColor}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; flex-shrink: 0;">
                      ${insuranceText}
                    </span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--gray-500); display: flex; flex-direction: column; gap: 1px;">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📧 ${p.email}</span>
                    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                      <span>🎂 ${formattedBirth}</span>
                      ${p.telefonnummer ? `<span>📞 ${p.telefonnummer}</span>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('');
          searchResultsDiv.style.display = 'block';

          // Add click listener to results
          searchResultsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
              document.getElementById('create-appt-vorname').value = item.getAttribute('data-vorname') || '';
              document.getElementById('create-appt-nachname').value = item.getAttribute('data-nachname') || '';
              document.getElementById('create-appt-email').value = item.getAttribute('data-email') || '';
              document.getElementById('create-appt-geburtsdatum').value = item.getAttribute('data-geburtsdatum') || '';
              document.getElementById('create-appt-telefon').value = item.getAttribute('data-telefon') || '';
              document.getElementById('create-appt-strasse').value = item.getAttribute('data-strasse') || '';
              document.getElementById('create-appt-plzort').value = item.getAttribute('data-plzort') || '';
              document.getElementById('create-appt-versicherung').value = item.getAttribute('data-versicherung') || 'gesetzlich';
              document.getElementById('create-appt-krankenkasse').value = item.getAttribute('data-krankenkasse') || '';

              patientStatusBadge.innerText = '✅ Existierender Patient';
              patientStatusBadge.style.background = '#D1FAE5';
              patientStatusBadge.style.color = '#065F46';

              searchResultsDiv.innerHTML = '';
              searchResultsDiv.style.display = 'none';
              searchInput.value = ''; // clear search bar
              activeIndex = -1;
            });
          });
        } else {
          searchResultsDiv.innerHTML = `
            <div style="padding: var(--space-4); text-align: center; color: var(--gray-500); font-size: var(--font-size-sm); display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
              <span style="font-size: 24px;">🔍</span>
              <div style="font-weight: 600; color: var(--gray-700);">Keine Übereinstimmung gefunden</div>
              <div style="font-size: var(--font-size-xs); max-width: 240px; line-height: 1.3;">Wir konnten keinen Patienten mit "${query}" in Ihrer Datenbank finden. Sie können die Akte manuell anlegen.</div>
            </div>
          `;
          searchResultsDiv.style.display = 'block';
        }
      } catch (err) {
        console.error('Error during patient search:', err);
        if (searchSpinner) searchSpinner.style.display = 'none';
      }
    }, 300);
  });

  searchInput?.addEventListener('keydown', (e) => {
    const list = searchResultsDiv.querySelectorAll('.search-result-item');
    if (searchResultsDiv.style.display === 'none' || list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % list.length;
      updateActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + list.length) % list.length;
      updateActiveItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < list.length) {
        list[activeIndex].click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchResultsDiv.style.display = 'none';
      activeIndex = -1;
    }
  });

  // Hide results if clicking outside search
  document.addEventListener('click', (e) => {
    if (!searchInput?.contains(e.target) && !searchResultsDiv?.contains(e.target)) {
      if (searchResultsDiv) {
        searchResultsDiv.style.display = 'none';
        activeIndex = -1;
      }
    }
  });

  // Reset status badge if core info modified
  const inputsToTrack = ['create-appt-vorname', 'create-appt-nachname', 'create-appt-email'];
  inputsToTrack.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      patientStatusBadge.innerText = '📝 Profil anpassen / Neu';
      patientStatusBadge.style.background = '#FEF3C7';
      patientStatusBadge.style.color = '#92400E';
    });
  });

  // Handle Form Submission
  document.getElementById('btn-submit-create-appt')?.addEventListener('click', async () => {
    const patientVorname = document.getElementById('create-appt-vorname').value.trim();
    const patientNachname = document.getElementById('create-appt-nachname').value.trim();
    const patientEmail = document.getElementById('create-appt-email').value.trim();
    const geburtsdatum = document.getElementById('create-appt-geburtsdatum').value;
    const telefonnummer = document.getElementById('create-appt-telefon').value.trim();
    const strasse_hnr = document.getElementById('create-appt-strasse').value.trim();
    const plz_ort = document.getElementById('create-appt-plzort').value.trim();
    const krankenversicherung = document.getElementById('create-appt-versicherung').value;
    const krankenkasse = document.getElementById('create-appt-krankenkasse').value.trim();
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
          geburtsdatum,
          telefonnummer,
          strasse_hnr,
          plz_ort,
          krankenversicherung,
          krankenkasse,
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
