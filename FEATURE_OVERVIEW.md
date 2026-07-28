# 🏥 Doctolib Pre-Check-In — Feature- & Scope-Übersicht

> **Projektübersicht & Funktionsumfang**  
> Digitale Anamnese, intelligente Praxis-Warteschlange, KI-Assistent & automatisierte Patienten-Kommunikation.

---

## 📐 Systemarchitektur & Kerntechnologien

| Bereich | Technologie / Framework | Beschreibung |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JS, HTML5, Modern CSS Variables | Performance-orientiertes Component-System ohne schwere Framework-Overheads |
| **Backend API** | Node.js & Express.js | REST-API & Server-Sent Events (SSE) für Echtzeit-Kommunikation |
| **Datenbank** | PostgreSQL (`pg`) | Relationale Datenhaltung mit persistenten Tabellen, Indizes & Constraints |
| **KI & LLM** | Google Gemini 2.5 Flash API | Medizinische Anamnese-Analyse, KI-Folgefragen & Behandlungs-To-Dos |
| **Testing** | Vitest & Playwright E2E | Interaktives In-App Test-Dashboard für Unit-, Integrations- & Systemtests |
| **E-Mail Service** | Resend API / Nodemailer (SMTP) | Transaktionale Benachrichtigungen & Nachsorge-Mails |
| **i18n** | Custom Lightweight i18n Engine | Vollständige Zweisprachigkeit (**Deutsch 🇩🇪** / **Englisch 🇬🇧**) |

---

## 🌟 Haupt-Features & Funktionsumfang

### 1. 👤 Patienten-Portal & Digitaler Pre-Check-In
- **Digitale Anamnese**:
  - Interaktives Auswählen von Symptom-Chips (z. B. Husten, Kopfschmerzen, Fieber) & Freitext-Erfassung.
  - Schmerzstärken-Skala (1–10) & Angabe der Beschwerdedauer.
  - Strukturierte Erfassung von Dauermedikation und bekannten Allergien.
- **Dynamischer Fragenkatalog**:
  - Praxis-spezifische Zusatzfragen (Single Choice, Multiple Choice, Textfeld).
- **KI-unterstützte Folgefragen**:
  - Echtzeit-Generierung individueller Vertiefungsfragen basierend auf den Beschwerden des Patienten.
- **Einwilligungen & Digitale Unterschrift**:
  - Integriertes HTML5-Canvas zur digitalen Signatur von Behandlungs- & Datenschutzvereinbarungen.
- **Dokumenten-Upload**:
  - Sicheres Hochladen von Laborbefunden, Vorbefunden & Impfpässen.
- **Kalender-Integration**:
  - Ein-Klick ICS-Kalender-Export für Apple Calendar, Google Calendar & Outlook.

---

### 2. 🏥 Arzt- & Praxis-Dashboard (Live Queue & Termine)
- **Patienten-Terminübersicht**:
  - Zeitliche Filterung: *Zukünftige Termine*, *Heutige Termine*, *Alle Termine / Archiv*.
  - Schnellsuche (Name, Termin-Code, Fachrichtung) & Stern-Favorisierung.
- **Live-Warteschlange (Queue Management)**:
  - Statusanzeige: `Wartend`, `In Behandlung`, `Abgeschlossen`.
  - Schnellaktionen: Patienten in Behandlungsraum aufrufen, Behandlungen abschließen.
  - **Verspätungs- & Vorziehungs-System**: E-Mail-Benachrichtigung an Patienten bei Terminverschiebungen oder früheren Behandlungs-Slots.
- **Kompaktes 4-Reiter Patienten-Modal**:
  - 👤 **Patient & Doku**: Stammdaten, direkte Arzt-Notizen, Patienten-Feedback & freigegebene Praxis-Dokumente (z.B. Arztbriefe, eRezepte).
  - 🩺 **Pre-Check-In**: Vollständiger Überblick über ausgefüllte Beschwerden, Vorbefunde & digitale Unterschriften.
  - 🤖 **KI-Assistent**: KI-gestützte Risiko-Einschätzung, Verdachtsdiagnosen & automatisierte Empfehlungen/To-Dos für Arzt und Patient.
  - 💡 **Hinweise & Nachsorge**: Versenden von Patientenhinweisen und Post-Treatment Anweisungen (z. B. Schonung, Wundpflege, Kühlung).

---

### 3. ⚙️ Praxis-Verwaltung & Konfiguration
- **Pufferzeiten-Planer (Buffer Times)**:
  - Anlegen von regelmäßigen (wöchentlichen) oder einmaligen Pufferzeiten für Mittagspausen, Rüstzeiten & Teambesprechungen.
  - Automatische Kollisionsprüfung mit existierenden Patiententerminen.
- **Dokumentenverwaltung**:
  - Hochladen & Verwalten zentraler Praxisdokumente (z. B. Aufklärungsbögen).
- **Aktivitätsprotokoll (Praxis Activity Log)**:
  - Audit-sicherer Verlauf aller Praxis-Aktionen (Terminbuchungen, Statusänderungen, Notiz-Updates).

---

### 4. 🧪 Interaktives Test-Dashboard (Vitest & Playwright)
- **Vollständige Testabdeckung**:
  - **Unit Tests**: Frontend-Stores, Authentifizierung & i18n Übersetzungsschlüssel.
  - **Integrationstests**: Backend-Express-APIs, Datenbank-Operationen & E-Mail-Worker.
  - **E2E-Tests**: Playwright-Systemtests für den vollständigen Pre-Check-In-Flow.
- **Dashboard-Views**:
  - Filterbar nach *Test-Typ*, *Feature-Area* (Auth, Startseite, Arzt-Dashboard, Pre-Check-In, Termine) sowie *Historie*.
  - Realtime progress streaming über Server-Sent Events (SSE).
