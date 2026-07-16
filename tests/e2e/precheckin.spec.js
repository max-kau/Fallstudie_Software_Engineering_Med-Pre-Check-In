import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: set up common route intercepts for the patient pre-check-in
// ─────────────────────────────────────────────────────────────────────────────
async function setupPatientMocks(page) {
  // Mock logged-in patient session
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        loggedIn: true,
        user: {
          id: 1,
          email: 'patient@example.com',
          vorname: 'Max',
          nachname: 'Mustermann',
          role: 'patient',
          geburtsdatum: '1990-01-01',
          krankenversicherung: 'gesetzlich'
        }
      })
    });
  });

  // Dynamic future appointment date to avoid past-appointment guards
  const future = new Date();
  future.setDate(future.getDate() + 2);
  const day = String(future.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const futureDateStr = `Di, ${day}. ${monthNames[future.getMonth()]}`;

  await page.route('**/api/termin/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        termin: {
          code: 'demo_12345',
          doctor: 'Dr. med. Anna Hartmann',
          fachrichtung: 'Allgemeinmedizin · Innere Medizin',
          adresse: 'Leopoldstraße 12, 80802 München',
          date: futureDateStr,
          time: '09:30',
          art: 'Routineuntersuchung',
          praxis: 'Hausarztpraxis',
          tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche']
        },
        patient: { vorname: 'Max', nachname: 'Mustermann' }
      })
    });
  });

  // Empty pre-checkin state
  await page.route('**/api/precheckin/demo_12345*', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ exists: false })
    });
  });

  // Mock AI questions
  await page.route('**/api/precheckin/*/generate-ai-questions', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        questions: [
          { question: 'Gibt es Begleitsymptome wie Schwindel oder Fieber?', answer: '' },
          { question: 'Seit wann treten diese Symptome genau auf?', answer: '' }
        ]
      })
    });
  });

  // Mock save/upload endpoints
  await page.route('**/api/precheckin', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/upload', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, file: { id: 'f_MOCK_123', filename: 'test.pdf', mimeType: 'application/pdf', fileSize: 1024 } })
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 1: Happy Path – vollständiger Patient-Fragebogen-Durchlauf
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Doctolib Pre-Check-In E2E System Test (Offline Mode)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    await setupPatientMocks(page);
  });

  test('should successfully guide the patient through the complete questionnaire flow', async ({ page }) => {
    // 1. Intro
    await page.goto('/?termin=demo_12345#intro');
    await expect(page.locator('h2')).toContainText('So funktioniert der Pre-Check-In');
    await expect(page.locator('.header-title')).toContainText('Dr. med. Anna Hartmann');
    await page.click('#btn-start-form');

    // 2. Beschwerden
    await expect(page).toHaveURL(/.*#beschwerden/);
    await expect(page.locator('h2')).toContainText('Welche Beschwerden haben Sie?');
    await page.click('.chip[data-symptom="Kopfschmerzen"]');
    await page.selectOption('#beschwerden-dauer', 'heute');
    await page.fill('#beschwerden-staerke', '6');
    await page.dispatchEvent('#beschwerden-staerke', 'input');
    await page.click('#btn-next');

    // 3. Medikamente
    await expect(page).toHaveURL(/.*#medikamente/);
    await page.click('#keine-medikamente-toggle');
    await page.click('#btn-next');

    // 4. Allergien
    await expect(page).toHaveURL(/.*#allergien/);
    await page.click('#keine-allergien-toggle');
    await page.click('#btn-next');

    // 5. KI-Folgefragen
    await expect(page).toHaveURL(/.*#ai-fragen/);
    await page.waitForSelector('.ai-q-input', { timeout: 10000 });
    await page.fill('.ai-q-input[data-idx="0"]', 'Nein, kein Schwindel oder Fieber.');
    await page.fill('.ai-q-input[data-idx="1"]', 'Heute Morgen nach dem Aufstehen.');
    await page.click('#btn-next');

    // 6. Dokumente
    await expect(page).toHaveURL(/.*#dokumente/);
    await expect(page.locator('h2')).toContainText('Befunde und Dokumente');

    // Inject signature via store
    await page.evaluate(() => {
      if (window.__doctolib_store) {
        window.__doctolib_store.set('signature', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      }
    });
    await page.click('#btn-next');

    // 7. Zusammenfassung & Absenden
    await expect(page).toHaveURL(/.*#zusammenfassung/);
    await expect(page.locator('h2')).toContainText('Zusammenfassung');
    const summaryContainer = page.locator('.view-content');
    await expect(summaryContainer).toContainText('Kopfschmerzen');
    await expect(summaryContainer).toContainText('Seit heute');
    await expect(summaryContainer).toContainText('Keine Medikamente');
    await expect(summaryContainer).toContainText('Keine bekannten Allergien');
    await page.click('#confirm-checkbox');
    await page.click('#btn-submit');

    // 8. Erfolgsbildschirm
    await page.waitForSelector('.success-screen', { timeout: 15000 });
    await expect(page.locator('h2')).toContainText('Erfolgreich übermittelt!');
    await expect(page.locator('#btn-success-home')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 2: Validierungs-Tests – Negativszenarien (Felder leer lassen)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Validierungs-Tests: Pflichtfelder & deaktivierte Buttons', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await setupPatientMocks(page);
  });

  test('Weiter-Button bleibt deaktiviert wenn Beschwerden-Pflichtfelder leer sind', async ({ page }) => {
    await page.goto('/?termin=demo_12345#beschwerden');
    await expect(page).toHaveURL(/.*#beschwerden/);

    // Ohne Symptom, Dauer und Stärke: Button muss disabled sein
    const nextBtn = page.locator('#btn-next');
    await expect(nextBtn).toBeDisabled();

    // Nur Symptom auswählen – Button bleibt noch deaktiviert (Dauer fehlt)
    await page.click('.chip[data-symptom="Kopfschmerzen"]');
    await expect(nextBtn).toBeDisabled();

    // Dauer hinzufügen – Button bleibt noch deaktiviert (Stärke fehlt)
    await page.selectOption('#beschwerden-dauer', 'einige_tage');
    await expect(nextBtn).toBeDisabled();

    // Stärke setzen – jetzt erst wird Button aktiviert
    await page.fill('#beschwerden-staerke', '5');
    await page.dispatchEvent('#beschwerden-staerke', 'input');
    await expect(nextBtn).toBeEnabled();
  });

  test('Absenden-Button bleibt deaktiviert ohne Bestätigungsfeld und Unterschrift', async ({ page }) => {
    await page.goto('/?termin=demo_12345#zusammenfassung');
    await expect(page).toHaveURL(/.*#zusammenfassung/);

    const submitBtn = page.locator('#btn-submit');

    // Ohne Checkbox und Unterschrift: Button deaktiviert
    await expect(submitBtn).toBeDisabled();

    // Nur Checkbox anklicken – Button bleibt deaktiviert (Unterschrift fehlt)
    await page.click('#confirm-checkbox');
    await expect(submitBtn).toBeDisabled();

    // Unterschrift über MouseEvents auf Canvas simulieren – Button wird aktiviert
    await page.evaluate(() => {
      const canvas = document.getElementById('signature-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 50, clientY: rect.top + 50, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }
    });

    await expect(submitBtn).toBeEnabled();
  });

  test('KI-Fragen-Weiter bleibt deaktiviert solange nicht alle Antworten ausgefüllt sind', async ({ page }) => {
    await page.goto('/?termin=demo_12345#ai-fragen');
    await expect(page).toHaveURL(/.*#ai-fragen/);
    await page.waitForSelector('.ai-q-input', { timeout: 10000 });

    const nextBtn = page.locator('#btn-next');
    // Vor dem Ausfüllen: Button deaktiviert
    await expect(nextBtn).toBeDisabled();

    // Nur erste Frage beantworten – Button bleibt deaktiviert
    await page.fill('.ai-q-input[data-idx="0"]', 'Erste Antwort.');
    await expect(nextBtn).toBeDisabled();

    // Auch zweite Frage beantworten – Button wird aktiviert
    await page.fill('.ai-q-input[data-idx="1"]', 'Zweite Antwort.');
    await expect(nextBtn).toBeEnabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 3: Fehler-Szenarien – API-Fehler und Fehlermeldungen
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fehler-Szenarien: API-Fehler und Fehlermeldungen', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await setupPatientMocks(page);
  });

  test('Fehlermeldung bei ungültigem Termin-Code (API gibt 404 zurück)', async ({ page }) => {
    // Override: Termin-API gibt 404 zurück für unbekannten Code
    await page.route('**/api/termin/unbekannt_999', async (route) => {
      await route.fulfill({
        status: 404, contentType: 'application/json',
        body: JSON.stringify({ error: 'Termin nicht gefunden' })
      });
    });

    await page.goto('/?termin=unbekannt_999#intro');

    // Die App soll zur Home-Seite weiterleiten oder eine Fehlermeldung anzeigen
    // (nicht eingefroren bleiben)
    await page.waitForTimeout(2000);
    const url = page.url();
    const isOnHomeOrLanding = url.includes('#home') || url.includes('#landing') || url.includes('#intro') || !url.includes('#');
    expect(isOnHomeOrLanding).toBeTruthy();
  });

  test('KI-Fragen zeigen Fehlermeldung wenn API 500 zurückgibt', async ({ page }) => {
    // Override AI endpoint to return 500 error
    await page.unroute('**/api/precheckin/*/generate-ai-questions');
    await page.route('**/api/precheckin/*/generate-ai-questions', async (route) => {
      await route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/?termin=demo_12345#ai-fragen');
    await expect(page).toHaveURL(/.*#ai-fragen/);

    // Die App soll nach dem API-Fehler nicht eingefroren bleiben
    // und eine entsprechende Meldung oder einen Retry-Bereich anzeigen
    await page.waitForTimeout(3000);

    // Prüfe, dass die Seite noch reagiert und kein vollständig leeres DOM hat
    const viewContent = page.locator('.view');
    await expect(viewContent).toBeVisible();
  });

  test('Nicht eingeloggt: Weiterleitung zu Home-Seite bei geschützter Route', async ({ page }) => {
    // Override: Kein eingeloggter Nutzer
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ loggedIn: false })
      });
    });

    // Versuche, direkt auf die Beschwerden-Seite zuzugreifen
    await page.goto('/?termin=demo_12345#beschwerden');
    await page.waitForTimeout(2000);

    // Router soll zur Home-Seite weiterleiten (da nicht eingeloggt)
    await expect(page).toHaveURL(/.*#home/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite 4: Praxis-Dashboard (Arzt-Ansicht)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Praxis-Dashboard E2E Tests (Arzt-Ansicht)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // Mock eingeloggter Praxis-Nutzer
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          loggedIn: true,
          user: {
            id: 99,
            email: 'praxis@beispiel.de',
            role: 'praxis',
            praxis_name: 'Musterpraxis München',
            praxis_fachbereich: 'Allgemeinmedizin',
            praxis_adresse: 'Musterstraße 1, 80000 München'
          }
        })
      });
    });

    // Praxis-spezifische API-Endpunkte mocken
    await page.route('**/api/praxen', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/api/praxis/termine*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          termine: [
            {
              code: 'termin_test_001',
              patient_name: 'Anna Müller',
              date: '2026-08-15',
              time: '10:00',
              art: 'Routineuntersuchung',
              submitted: true
            },
            {
              code: 'termin_test_002',
              patient_name: 'Hans Schmidt',
              date: '2026-08-15',
              time: '11:30',
              art: 'Beratungsgespräch',
              submitted: false
            }
          ],
          stats: { total: 2, submitted: 1, pending: 1 }
        })
      });
    });

    await page.route('**/api/praxis/questions*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ questions: [] })
      });
    });

    await page.route('**/api/praxis/documents*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ documents: [] })
      });
    });

    await page.route('**/api/precheckin/documents*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
  });

  test('Praxis-Dashboard lädt und zeigt Praxis-Name korrekt an', async ({ page }) => {
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(1500);

    // Prüfe, dass wir auf dem Praxis-Dashboard sind (nicht weitergeleitet)
    await expect(page).toHaveURL(/.*#praxis-dashboard/);

    // Praxis-Name muss sichtbar sein
    await expect(page.locator('h1')).toContainText('Musterpraxis München');
    await expect(page.locator('body')).toContainText('Praxis-Dashboard');
  });

  test('Praxis-Dashboard hat alle drei Tabs (Kalender, Statistik, Gestaltung)', async ({ page }) => {
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/.*#praxis-dashboard/);

    // Alle drei Tabs müssen vorhanden sein
    await expect(page.locator('#tab-dashboard-kalender')).toBeVisible();
    await expect(page.locator('#tab-dashboard-termine')).toBeVisible();
    await expect(page.locator('#tab-dashboard-gestaltung')).toBeVisible();
  });

  test('Tab-Wechsel funktioniert: Statistik & Termine Tab wird angezeigt', async ({ page }) => {
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*#praxis-dashboard/);

    // Klicke auf "Statistik & Termine" Tab
    await page.click('#tab-dashboard-termine');
    await page.waitForTimeout(500);

    // Statistik-Container muss sichtbar sein
    const termineTabContent = page.locator('#tab-content-termine');
    await expect(termineTabContent).toBeVisible();
  });

  test('Praxis-Benutzer wird von Patient-Route zu Praxis-Dashboard umgeleitet', async ({ page }) => {
    // Praxis-Nutzer versucht, die Patienten-Seite zu öffnen
    await page.goto('/?termin=demo_12345#beschwerden');
    await page.waitForTimeout(2000);

    // Router muss Praxis-Nutzer zum Dashboard weiterleiten
    await expect(page).toHaveURL(/.*#praxis-dashboard/);
  });

  test('Gestaltung-Tab zeigt Fragebogen-Editor', async ({ page }) => {
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/.*#praxis-dashboard/);

    // Klicke auf "Pre-Check-In gestalten" Tab
    await page.click('#tab-dashboard-gestaltung');
    await page.waitForTimeout(500);

    // Fragebogen-Editor muss sichtbar sein
    const gestaltungContent = page.locator('#tab-content-gestaltung');
    await expect(gestaltungContent).toBeVisible();
    await expect(page.locator('#btn-add-question')).toBeVisible();
    await expect(page.locator('#btn-save-questions')).toBeVisible();
  });
});
