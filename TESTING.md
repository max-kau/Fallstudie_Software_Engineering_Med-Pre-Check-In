# Dokumentation der Testumgebung (Unit- und Integrationstests)

Dieses Projekt nutzt **Vitest** in Kombination mit **jsdom** als Test-Runner. Dieses Setup ermöglicht das Testen von Client-Side-Code mit simulierten Browser-APIs sowie das Testen von Express-Backend-Schnittstellen mit Datenbank-Mocks.

---

## Inhaltsverzeichnis
1. [Installation & Konfiguration](#1-installation--konfiguration)
2. [Teststruktur](#2-teststruktur)
3. [Ausführen der Tests](#3-ausführen-der-tests)
4. [Mocking-Strategien](#4-mocking-strategien)
    - [Client: sessionStorage & window.location](#client-sessionstorage--windowlocation)
    - [Server: PostgreSQL (pg) & E-Mail (nodemailer)](#server-postgresql-pg--e-mail-nodemailer)
5. [Hinzufügen neuer Tests](#5-hinzufügen-neuer-tests)

---

## 1. Installation & Konfiguration

Die benötigten Bibliotheken sind in der `package.json` als `devDependencies` hinterlegt:
- `vitest`: Der Test-Runner.
- `jsdom`: Eine in JavaScript geschriebene Simulation des Webbrowsers, um Browser-spezifische APIs im Terminal nutzbar zu machen.

Die Konfiguration erfolgt in der `vite.config.js`:
```javascript
test: {
  environment: 'jsdom',
  globals: true, // Ermöglicht describe, it, expect etc. ohne explizite Imports
}
```

---

## 2. Teststruktur

Die Tests sind unter dem Verzeichnis `tests/` organisiert:

### Frontend-Tests (`tests/frontend/`)

| Testdatei | Getestetes Modul | Testfälle |
|---|---|---|
| `praxen.test.js` | `src/data/praxen.js` | API-Fetch, Deduplizierung, Fallback bei Netzwerkfehlern |
| `store.test.js` | `src/utils/store.js` | Default-Daten, URL-Parameter-Parsing, `set()`/`get()`, `clear()`, `hasSavedProgress()` (inkl. 6 Szenarien), `resetProgress()` |
| `auth.test.js` | `src/utils/auth.js` | Login (Erfolg & Fehler), `register()` (Erfolg & Fehler), `checkSession()` (Erfolg, nicht eingeloggt, Netzwerkfehler), Logout (Erfolg & Netzwerkfehler) |

### Backend-Tests (`tests/backend/`)

| Testdatei | Getestete Endpunkte | Testfälle |
|---|---|---|
| `server_auth.test.js` | `/api/auth/register`, `/api/auth/login`, `/api/auth/me` | Registrierung (Patient, Praxis, Duplikat, Passwort zu kurz, fehlende Felder), Login (Erfolg, falsches Passwort, fehlende Felder, User nicht gefunden), Session-Check |
| `server_precheckin.test.js` | `/api/precheckin` (GET & POST) | Abruf (existiert/nicht vorhanden), Speichern (Validierung, Upsert), Submission-Workflow mit E-Mail-Benachrichtigung, DB-Fehlerbehandlung |
| `server_termine.test.js` | `/api/termin/:code`, `/api/health`, `/api/praxen`, `/api/praxis/termine/buchen`, `/api/praxis/termin/:code/duration` | Terminabruf, Health-Check, Praxen-Listing, Telefonische Buchung (mit Vorname/Nachname), Termin-Dauer-Änderung (Drag-to-resize) und Konflikterkennung |
| `server_dashboard.test.js` | `/api/praxis/buffer-times`, `/api/praxis/documents`, `/api/queue/*` | Pufferzeiten verwalten (Laden, Erstellen, Löschen), Praxis-Dokumente (Laden, Upload, Löschen), Live-Warteschlange (Patienten annehmen, Behandlung abschließen, Termin verzögern & Patient benachrichtigen) |

---

## 3. Ausführen der Tests

### Entwicklung (Watch-Modus)
Führt alle Tests aus und überwacht Dateiänderungen, um Tests bei Bedarf automatisch neu zu starten:
```bash
npm run test
```

### Einmalige Ausführung (z. B. für CI/CD)
Führt alle Tests einmalig aus und beendet den Prozess danach:
```bash
npx vitest run
```

---

## 4. Mocking-Strategien

### Client: sessionStorage & window.location
Weil jsdom als Testumgebung definiert ist, stehen standardmäßig globale Objekte wie `sessionStorage` zur Verfügung.
* `sessionStorage` kann vor jedem Test via `sessionStorage.clear()` zurückgesetzt werden.
* `window.location` kann via `Object.defineProperty` manipuliert werden, um verschiedene URL-Parameter für den Buchungscode zu simulieren:
```javascript
Object.defineProperty(window, 'location', {
  writable: true,
  value: { search: '?termin=test_code_123', hash: '' }
});
```
* `global.fetch` wird mit `vi.fn()` gemockt, um API-Aufrufe ohne echten Server zu simulieren:
```javascript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, user: mockUser })
});
```

### Server: PostgreSQL (pg) & E-Mail (nodemailer)
Backend-Tests starten die Express-App im Hintergrund auf einem dynamisch zugewiesenen Port (Port `0`).
Um die Tests datenbankunabhängig und ohne reale E-Mails auszuführen, nutzen wir das Mocking-System von Vitest:

* **PostgreSQL-Mock**: Der Import von `pg` wird abgefangen. Die Klasse `Pool` wird mit einer Mock-Implementation innerhalb der `vi.mock()`-Factory definiert (wichtig wegen Hoisting):
```javascript
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  class MockPool {
    constructor() { this.query = mockQuery; }
    on() {}
    async end() {}
  }
  return {
    default: { Pool: MockPool, mockQuery: mockQuery }
  };
});

import pg from 'pg';
const { mockQuery } = pg;
```
* **E-Mail-Mock**: Verhindert das tatsächliche Senden von E-Mails:
```javascript
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
      verify: vi.fn().mockResolvedValue(true)
    })
  }
}));
```

---

## 5. Hinzufügen neuer Tests

### Frontend-Tests
1. Lege eine neue Datei mit der Endung `.test.js` im Ordner `tests/frontend/` an.
2. Importiere die zu testende Funktion/Modul.
3. Nutze `global.fetch = vi.fn()` für API-Mocks.
4. Nutze `sessionStorage.clear()` in `beforeEach()` für saubere Ausgangszustände.

### Backend-Tests
1. Lege eine neue Datei mit der Endung `.test.js` im Ordner `tests/backend/` an.
2. Kopiere den Mock-Block für `pg` und `nodemailer` aus einer bestehenden Testdatei.
3. Importiere `app` aus `../../server.js`.
4. Starte den Server in `beforeAll()` auf Port `0` und schließe ihn in `afterAll()`.
5. Nutze `mockQuery.mockResolvedValueOnce()` zur Konfiguration der DB-Antworten pro Test.
6. Setze `mockQuery.mockReset()` in `beforeEach()` zurück.

---

## 6. System- und E2E-Tests mit Playwright

Für automatisierte Oberflächen- und Systemtests (End-to-End) verwenden wir **Playwright**. Diese Tests simulieren einen echten Benutzer, der sich durch den gesamten Buchungs- und Pre-Check-In-Fragebogen klickt.

### Ausführung der E2E-Tests

Um die E2E-Tests auszuführen, führe folgenden Befehl aus:
```bash
npm run test:e2e
```
Dieser Befehl startet automatisch den Vite-Entwicklungsserver sowie den Node.js-Backend-Server im Hintergrund und führt die Test-Szenarien aus.

### Konfiguration (`playwright.config.js`)
Die Konfiguration legt fest, wie die Browserumgebung aufgebaut wird und welche Server gestartet werden müssen:
- **Test-Verzeichnis:** `tests/e2e`
- **Port-Definition:** Führt die Tests gegen das Frontend auf Port `3000` aus.
- **Offline-Modus:** Das Backend wird während der Tests mit einer leeren `DATABASE_URL` gestartet, wodurch es automatisch im simulierten In-Memory-Modus (Offline-Modus) läuft.

### Abgedeckte E2E-Szenarien (`tests/e2e/precheckin.spec.js`)
Der E2E-Test-Katalog umfasst folgende automatisierte Workflows:
1. **Kompletter Pre-Check-In Flow:** Begleitung eines Patienten von der Eingabe des Codes, über Beschwerden, Medikamente, Allergien und KI-Folgefragen bis zur Signatur und Übermittlung.
2. **Validierungen & Sperren:** Prüfung, ob Buttons blockiert bleiben, solange Pflichtfelder leer sind oder Zustimmungen/Signaturen fehlen.
3. **Fehler-Szenarien:** Korrekte Behandlung von 404/500 API-Antworten und Weiterleitung nicht angemeldeter Nutzer von geschützten Routen.
4. **Praxis-Dashboard-Grundlagen:** Prüfung des Login-Verhaltens, der Dashboard-Navigation und Tab-Funktionalitäten (Kalender, Statistiken, Gestaltung).
5. **Praxis-Mitarbeiter-Workflows:**
   - *Telefonischer Termin:* Öffnen des Buchungs-Modals, Ausfüllen von Vor- und Nachname, E-Mail-Adresse und erfolgreiches Absenden (sowie Validierungsfehler bei fehlenden Feldern).
   - *Pufferzeiten-Steuerung:* Wechsel zum Pufferzeiten-Verwaltungs-Panel und Zurückkehren zur Tagesansicht.
6. **Live-Warteschlange:** Abruf der Live-Warteschlange für den aktuellen Tag und korrekte Darstellung der gelisteten Patienten.

