import { test, expect } from '@playwright/test';

test.describe('Patient Database & Telephone Booking E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock logged-in praxis session
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          loggedIn: true,
          user: {
            id: 1,
            email: 'praxis@example.com',
            vorname: 'Anna',
            nachname: 'Hartmann',
            role: 'praxis',
            praxis_name: 'Hausarztpraxis Anna'
          }
        })
      });
    });

    // Mock patient search endpoint
    await page.route('**/api/praxis/patients/search*', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';
      
      if (query.toLowerCase().includes('max')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            patients: [
              {
                id: 101,
                email: 'max@example.com',
                vorname: 'Max',
                nachname: 'Mustermann',
                geburtsdatum: '1990-05-15',
                telefonnummer: '017611223344',
                strasse_hnr: 'Teststraße 5',
                plz_ort: '80331 München',
                krankenversicherung: 'privat',
                krankenkasse: 'Allianz Private Krankenversicherung'
              }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, patients: [] })
        });
      }
    });

    // Mock booking endpoint
    await page.route('**/api/praxis/termine/buchen', async (route) => {
      const body = JSON.parse(route.request().postData());
      // Expect all submitted patient profile fields
      expect(body.patientVorname).toBeDefined();
      expect(body.patientNachname).toBeDefined();
      expect(body.patientEmail).toBeDefined();
      expect(body.geburtsdatum).toBeDefined();
      expect(body.telefonnummer).toBeDefined();
      expect(body.strasse_hnr).toBeDefined();
      expect(body.plz_ort).toBeDefined();
      expect(body.krankenversicherung).toBeDefined();
      expect(body.krankenkasse).toBeDefined();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          appointment: {
            code: 't_TEST123',
            doctor: body.doctor,
            date: body.date,
            time: body.time,
            art: body.art
          }
        })
      });
    });

    // Mock praxis appointments page loading (required for dashboard view)
    await page.route('**/api/praxis/termine*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, appointments: [] })
      });
    });

    await page.route('**/api/praxis/buffer-times*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, buffer_times: [] })
      });
    });
  });

  test('should search and auto-fill existing patient details', async ({ page }) => {
    // Go to praxis dashboard
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(500);

    // Open booking modal
    const bookBtn = page.locator('button:has-text("Telefonischen Termin")');
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // Verify modal is visible
    await expect(page.locator('#create-appt-modal')).toBeVisible();

    // Type query in search field
    const searchInput = page.locator('#create-appt-search');
    await searchInput.fill('Max');
    await page.waitForTimeout(500);

    // Click search result item
    const searchResultItem = page.locator('.search-result-item');
    await expect(searchResultItem).toBeVisible();
    await searchResultItem.click();

    // Verify all Akte fields are auto-filled
    await expect(page.locator('#create-appt-vorname')).toHaveValue('Max');
    await expect(page.locator('#create-appt-nachname')).toHaveValue('Mustermann');
    await expect(page.locator('#create-appt-email')).toHaveValue('max@example.com');
    await expect(page.locator('#create-appt-geburtsdatum')).toHaveValue('1990-05-15');
    await expect(page.locator('#create-appt-telefon')).toHaveValue('017611223344');
    await expect(page.locator('#create-appt-strasse')).toHaveValue('Teststraße 5');
    await expect(page.locator('#create-appt-plzort')).toHaveValue('80331 München');
    await expect(page.locator('#create-appt-versicherung')).toHaveValue('privat');
    await expect(page.locator('#create-appt-krankenkasse')).toHaveValue('Allianz Private Krankenversicherung');

    // Status badge check
    const badge = page.locator('#patient-status-badge');
    await expect(badge).toContainText('Existierender Patient');
  });

  test('should book a new patient and manually create their profile', async ({ page }) => {
    await page.goto('/#praxis-dashboard');
    await page.waitForTimeout(500);

    const bookBtn = page.locator('button:has-text("Telefonischen Termin")');
    await bookBtn.click();

    // Manually fill all Akte fields
    await page.fill('#create-appt-vorname', 'Erika');
    await page.fill('#create-appt-nachname', 'Musterfrau');
    await page.fill('#create-appt-email', 'erika@example.com');
    await page.fill('#create-appt-geburtsdatum', '1985-11-20');
    await page.fill('#create-appt-telefon', '015199887766');
    await page.fill('#create-appt-strasse', 'Hauptstraße 15');
    await page.fill('#create-appt-plzort', '10115 Berlin');
    await page.selectOption('#create-appt-versicherung', 'gesetzlich');
    await page.fill('#create-appt-krankenkasse', 'Techniker Krankenkasse');

    // Submit booking form
    const submitBtn = page.locator('#btn-submit-create-appt');
    await submitBtn.click();

    // Modal should close on success
    await page.waitForTimeout(500);
    await expect(page.locator('#create-appt-modal')).not.toBeVisible();
  });
});
