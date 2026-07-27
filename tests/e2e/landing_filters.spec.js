import { test, expect } from '@playwright/test';

test.describe('Patient Landing Page - Sorting & Filtering E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // 1. Mock logged-in patient session
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          loggedIn: true,
          user: {
            id: 101,
            email: 'patient@example.com',
            vorname: 'Max',
            nachname: 'Mustermann',
            role: 'patient'
          }
        })
      });
    });

    // 2. Mock patient appointments
    await page.route('**/api/user/termine', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          appointments: [
            {
              code: 'appt_001',
              doctor: 'Dr. med. Anna Hartmann',
              fachrichtung: 'Allgemeinmedizin',
              adresse: 'Leopoldstraße 12, 80802 München',
              date: '2026-08-20',
              time: '09:30',
              art: 'Routineuntersuchung',
              praxis: 'Hausarztpraxis Anna',
              tags: ['Kassenpatienten'],
              precheck_submitted: false,
              status: 'bestätigt',
              favorite: false,
              urgent: false,
              priority: 0
            },
            {
              code: 'appt_002',
              doctor: 'Dr. med. Bernd Becker',
              fachrichtung: 'Zahnmedizin',
              adresse: 'Klinikweg 4, 80336 München',
              date: '2026-08-22',
              time: '11:00',
              art: 'Kontrolltermin',
              praxis: 'Zahnarzt Becker',
              tags: ['Privatpatienten'],
              precheck_submitted: true,
              status: 'bestätigt',
              favorite: true,
              urgent: true,
              priority: 2
            },
            {
              code: 'appt_003',
              doctor: 'Dr. med. Carl Clausen',
              fachrichtung: 'Physiotherapie',
              adresse: 'Bahnhofstr. 7, 80331 München',
              date: '2026-08-15',
              time: '15:00',
              art: 'Videosprechstunde',
              praxis: 'Physiotherapie Clausen',
              tags: ['Kassenpatienten'],
              precheck_submitted: false,
              status: 'abgesagt',
              favorite: false,
              urgent: false,
              priority: 0
            }
          ]
        })
      });
    });

    // 3. Mock other standard endpoints to avoid store.loadData failures
    await page.route('**/api/termin/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          termin: {
            code: 'demo_12345',
            doctor: 'Dr. med. Anna Hartmann',
            fachrichtung: 'Allgemeinmedizin',
            adresse: 'Leopoldstraße 12, 80802 München',
            date: 'Mo, 25. Mai',
            time: '09:30',
            art: 'Routineuntersuchung',
            praxis: 'Hausarztpraxis',
            tags: ['Kassenpatienten']
          },
          patient: { vorname: 'Max', nachname: 'Mustermann' }
        })
      });
    });

    await page.route('**/api/precheckin/demo_12345*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false })
      });
    });

    await page.route('**/api/precheckin/questions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, questions: [] })
      });
    });

    await page.route('**/api/precheckin/documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, documents: [] })
      });
    });
  });

  test('should render filter and sort UI on landing view', async ({ page }) => {
    await page.goto('/#landing');
    await page.waitForTimeout(1000);

    // Verify filter collapse button is visible
    const toggleBtn = page.locator('#btn-toggle-filters');
    await expect(toggleBtn).toBeVisible();

    // Click to expand filters
    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Check presence of select options
    await expect(page.locator('#filter-praxis')).toBeVisible();
    await expect(page.locator('#filter-fachbereich')).toBeVisible();
    await expect(page.locator('#filter-art')).toBeVisible();
    await expect(page.locator('#filter-zeitraum')).toBeVisible();
    await expect(page.locator('#filter-status')).toBeVisible();
    await expect(page.locator('#sort-by')).toBeVisible();
  });

  test('should filter by doctor/praxis', async ({ page }) => {
    await page.goto('/#landing');
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Filter by Zahnarzt Becker
    await page.selectOption('#filter-praxis', 'Zahnarzt Becker');
    await page.waitForTimeout(500);

    // Should only show Becker
    const cards = page.locator('.termin-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Bernd Becker');
  });

  test('should filter by specialty', async ({ page }) => {
    await page.goto('/#landing');
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Filter by Zahnmedizin
    await page.selectOption('#filter-fachbereich', 'Zahnmedizin');
    await page.waitForTimeout(500);

    const cards = page.locator('.termin-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Bernd Becker');
  });

  test('should filter by timeframe (today and future)', async ({ page }) => {
    await page.goto('/#landing');
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Timeframe defaults to future
    await expect(page.locator('#filter-zeitraum')).toHaveValue('future');

    // Filter by all timeframes
    await page.selectOption('#filter-zeitraum', 'all');
    await page.waitForTimeout(500);
  });

  test('should sort chronologically and individually', async ({ page }) => {
    await page.goto('/#landing');
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Filter all timeframes to see all mock appts
    await page.selectOption('#filter-zeitraum', 'all');

    // Sort: Chronologisch (nächster Termin zuerst)
    await page.selectOption('#sort-by', 'date-asc');
    await page.waitForTimeout(500);

    let cards = page.locator('.termin-card');

    // Sort: Favorisierte Ärzte zuerst
    await page.selectOption('#sort-by', 'fav-first');
    await page.waitForTimeout(500);

    // Becker is favorite, so Becker should be first
    await expect(cards.first()).toContainText('Bernd Becker');
  });

  test('should save filter preferences to localStorage and restore them on reload', async ({ page }) => {
    await page.goto('/#landing');
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Change filter & sort values
    await page.selectOption('#filter-zeitraum', 'all');
    await page.selectOption('#sort-by', 'fav-first');

    // Click save button
    await page.click('#btn-save-filters');
    await expect(page.locator('#filter-saved-status')).toBeVisible();

    // Reload page
    await page.reload();
    await page.click('#btn-toggle-filters');
    await page.waitForTimeout(500);

    // Verify filter and sort values were restored
    await expect(page.locator('#filter-zeitraum')).toHaveValue('all');
    await expect(page.locator('#sort-by')).toHaveValue('fav-first');
  });
});
