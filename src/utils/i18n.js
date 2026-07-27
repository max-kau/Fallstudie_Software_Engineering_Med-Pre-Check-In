// Internationalization (i18n) Utility

const STORAGE_KEY = 'dl_app_lang';

let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'de';

export const translations = {
  de: {
    // Navigation
    'nav.search_praxis': 'Praxis suchen',
    'nav.my_appointments': 'Meine Termine',
    'nav.dashboard': 'Dashboard',
    'nav.test_dashboard': 'Test Dashboard',
    'nav.profile_data': 'Profildaten & Einstellungen',
    'nav.logout': 'Abmelden',
    'nav.login': 'Anmelden',
    'nav.system_admin': 'System Admin',
    'nav.language': 'Sprache',

    // Auth View
    'auth.as_patient': 'Als Patient',
    'auth.as_praxis': 'Als Praxis',
    'auth.as_admin': 'Als Admin',
    'auth.login': 'Anmelden',
    'auth.register': 'Registrieren',
    'auth.email': 'E-Mail-Adresse',
    'auth.password': 'Passwort',
    'auth.email_placeholder': 'ihre@email.de',
    'auth.login_btn': 'Anmelden',
    'auth.register_btn': 'Konto erstellen',
    'auth.admin_title': '🛡️ Admin-Zugang & Test Dashboard',
    'auth.admin_desc': 'Melden Sie sich als Administrator an, um direkten Zugriff auf das interaktive Test Dashboard zu erhalten.',
    'auth.vorname': 'Vorname',
    'auth.nachname': 'Nachname',
    'auth.geburtsdatum': 'Geburtsdatum',
    'auth.telefonnummer': 'Telefonnummer',
    'auth.strasse_hnr': 'Straße & Hausnummer',
    'auth.plz_ort': 'PLZ & Ort',
    'auth.versicherungsart': 'Versicherungsart',
    'auth.gesetzlich': 'Gesetzlich',
    'auth.privat': 'Privat',
    'auth.krankenkasse': 'Krankenkasse',
    'auth.praxis_name': 'Praxisname',
    'auth.praxis_fachbereich': 'Fachbereich',
    'auth.praxis_adresse': 'Praxisadresse',

    // Landing / Pre-Check-In
    'landing.title': 'Pre-Check-In Übersicht',
    'landing.welcome': 'Willkommen zum digitalen Pre-Check-In',
    'landing.subtitle': 'Bereiten Sie Ihren Praxisbesuch vorab vor',
    'landing.your_appointment': 'Ihr nächster Termin',
    'landing.start_btn': 'Pre-Check-In starten',
    'landing.continue_btn': 'Pre-Check-In fortfahren',
    'landing.view_summary': 'Zusammenfassung ansehen',
    'landing.completed_badge': 'Pre-Check-In abgeschlossen',
    'landing.queue_status': 'Live-Warteschlange',
    'landing.queue_pos': 'Ihre Position in der Schlange:',

    // Home / Search
    'home.hero_title': 'Arzttermine online buchen & digital einchecken',
    'home.hero_sub': 'Vereinbaren Sie schnell Termine und erledigen Sie Ihre Anamnese bequem von zu Hause.',
    'home.search_input': 'Fachgebiet, Arzt oder Symptom...',
    'home.location_input': 'Ort oder PLZ',
    'home.search_btn': 'Suchen',
    'home.available_doctors': 'Verfügbare Praxen & Ärzte',
    'home.book_appointment': 'Termin vereinbaren',

    // Pre-Check-In Flow
    'flow.step_confirm': 'Terminbestätigung',
    'flow.step_intro': 'Einführung',
    'flow.step_symptoms': 'Beschwerden',
    'flow.step_questions': 'Zusatzfragen',
    'flow.step_meds': 'Medikamente',
    'flow.step_allergies': 'Allergien',
    'flow.step_ai': 'KI-Anamnese',
    'flow.step_docs': 'Dokumente',
    'flow.step_summary': 'Zusammenfassung',

    // Common Buttons & Labels
    'common.next': 'Weiter',
    'common.back': 'Zurück',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.close': 'Schließen',
    'common.edit': 'Ändern',
    'common.delete': 'Löschen',
    'common.confirm': 'Bestätigen',
    'common.saving': 'Wird gespeichert…',
    'common.loading': 'Wird geladen…',
    'common.yes': 'Ja',
    'common.no': 'Nein',
    'common.none': 'Keine',
    'common.select_lang': 'Sprache auswählen',
    'common.german': 'Deutsch 🇩🇪',
    'common.english': 'English 🇬🇧',

    // Praxis Dashboard
    'praxis.dashboard': 'Praxis Management Dashboard',
    'praxis.queue': 'Warteschlange & Patienten',
    'praxis.activity_log': 'Aktivitätsprotokoll',
    'praxis.buffer_times': 'Pufferzeiten',
    'praxis.documents': 'Dokumentenvorlagen',
    'praxis.call_patient': 'Aufrufen',
    'praxis.finish_treatment': 'Behandlung beendet',
    'praxis.delay_appointment': 'Verzögern',
    'praxis.delay_reason': 'Grund für Verzögerung',

    // Test Dashboard Banner
    'test.admin_banner': 'Interactive Testing Dashboard (Vitest & Playwright)',
    'test.open_tab': 'In neuem Tab öffnen (3030)',
    'test.reload': 'Dashboard neu laden',

    // Settings & Profile Modal
    'profile.title': 'Profildaten & Einstellungen',
    'profile.lang_setting': 'App-Sprache / Language',
    'profile.contact_person': 'Ansprechpartner',
    'profile.name': 'Name',
    'profile.dob': 'Geburtsdatum',
    'profile.phone': 'Telefonnummer',
    'profile.address': 'Adresse',
    'profile.insurance': 'Krankenversicherung',
    'profile.opening_hours': 'Öffnungszeiten',

    // Status Badges
    'status.in_treatment': 'In Behandlung',
    'status.appeared': 'Erschienen',
    'status.done': 'Abgeschlossen',
    'status.cancelled': 'Abgesagt',
    'status.delayed': 'Verzögert',
    'status.rescheduled': 'Verschoben',
    'status.pending': 'Ausstehend',

    // Activity Log & Praxis Dashboard
    'praxis.activity_title': 'Aktivitätslog der Patientenbesuche',
    'praxis.activity_subtitle': 'Vollständiges Protokoll aller Patientenbesuche, Statusänderungen & Bearbeitungsschritte Ihrer Praxis.',
    'praxis.add_manual_entry': 'Manuellen Eintrag hinzufügen',
    'praxis.search_placeholder': 'Suche nach Patient, Code, Aktion...',
    'praxis.filter_all_status': 'Alle Status',
    'praxis.entries': 'Einträge',
    'praxis.timestamp': 'Zeitstempel',
    'praxis.patient_id': 'Patienten-ID',
    'praxis.appointment_code': 'Termin-Code',
    'praxis.status': 'Status',
    'praxis.activity_description': 'Aktivität / Beschreibung',
    'praxis.staff': 'Mitarbeiter',
    'praxis.tab_calendar': 'Kalender',
    'praxis.tab_stats': 'Statistik & Termine',
    'praxis.tab_treatment_times': 'Behandlungszeiten & Analyse',
    'praxis.tab_activity_log': 'Aktivitätslog',
    'praxis.tab_design': 'Pre-Check-In gestalten',
    'praxis.live_queue': 'Live-Warteschlange',
    'praxis.enter_manual_appointment': 'Telefonischen Termin eintragen'
  },

  en: {
    // Navigation
    'nav.search_praxis': 'Search Practice',
    'nav.my_appointments': 'My Appointments',
    'nav.dashboard': 'Dashboard',
    'nav.test_dashboard': 'Test Dashboard',
    'nav.profile_data': 'Profile & Settings',
    'nav.logout': 'Log Out',
    'nav.login': 'Log In',
    'nav.system_admin': 'System Admin',
    'nav.language': 'Language',

    // Auth View
    'auth.as_patient': 'As Patient',
    'auth.as_praxis': 'As Practice',
    'auth.as_admin': 'As Admin',
    'auth.login': 'Log In',
    'auth.register': 'Register',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.email_placeholder': 'your@email.com',
    'auth.login_btn': 'Log In',
    'auth.register_btn': 'Create Account',
    'auth.admin_title': '🛡️ Admin Access & Test Dashboard',
    'auth.admin_desc': 'Log in as administrator to gain direct access to the interactive test dashboard.',
    'auth.vorname': 'First Name',
    'auth.nachname': 'Last Name',
    'auth.geburtsdatum': 'Date of Birth',
    'auth.telefonnummer': 'Phone Number',
    'auth.strasse_hnr': 'Street & Number',
    'auth.plz_ort': 'ZIP & City',
    'auth.versicherungsart': 'Insurance Type',
    'auth.gesetzlich': 'Public',
    'auth.privat': 'Private',
    'auth.krankenkasse': 'Insurance Provider',
    'auth.praxis_name': 'Practice Name',
    'auth.praxis_fachbereich': 'Medical Specialty',
    'auth.praxis_adresse': 'Practice Address',

    // Landing / Pre-Check-In
    'landing.title': 'Pre-Check-In Overview',
    'landing.welcome': 'Welcome to Digital Pre-Check-In',
    'landing.subtitle': 'Prepare your medical appointment in advance',
    'landing.your_appointment': 'Your Next Appointment',
    'landing.start_btn': 'Start Pre-Check-In',
    'landing.continue_btn': 'Continue Pre-Check-In',
    'landing.view_summary': 'View Summary',
    'landing.completed_badge': 'Pre-Check-In Completed',
    'landing.queue_status': 'Live Waiting Queue',
    'landing.queue_pos': 'Your position in queue:',

    // Home / Search
    'home.hero_title': 'Book Doctor Appointments & Check-In Digitally',
    'home.hero_sub': 'Schedule appointments quickly and complete your medical anamnesis comfortably from home.',
    'home.search_input': 'Specialty, doctor or symptom...',
    'home.location_input': 'City or ZIP code',
    'home.search_btn': 'Search',
    'home.available_doctors': 'Available Practices & Doctors',
    'home.book_appointment': 'Book Appointment',

    // Pre-Check-In Flow
    'flow.step_confirm': 'Appointment Confirmation',
    'flow.step_intro': 'Introduction',
    'flow.step_symptoms': 'Symptoms',
    'flow.step_questions': 'Additional Questions',
    'flow.step_meds': 'Medications',
    'flow.step_allergies': 'Allergies',
    'flow.step_ai': 'AI Anamnesis',
    'flow.step_docs': 'Documents',
    'flow.step_summary': 'Summary',

    // Common Buttons & Labels
    'common.next': 'Next',
    'common.back': 'Back',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.saving': 'Saving…',
    'common.loading': 'Loading…',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.none': 'None',
    'common.select_lang': 'Select Language',
    'common.german': 'Deutsch 🇩🇪',
    'common.english': 'English 🇬🇧',

    // Praxis Dashboard
    'praxis.dashboard': 'Practice Management Dashboard',
    'praxis.queue': 'Waiting Queue & Patients',
    'praxis.activity_log': 'Activity Log',
    'praxis.buffer_times': 'Buffer Times',
    'praxis.documents': 'Document Templates',
    'praxis.call_patient': 'Call Patient',
    'praxis.finish_treatment': 'Finish Treatment',
    'praxis.delay_appointment': 'Delay',
    'praxis.delay_reason': 'Reason for Delay',

    // Test Dashboard Banner
    'test.admin_banner': 'Interactive Testing Dashboard (Vitest & Playwright)',
    'test.open_tab': 'Open in new tab (3030)',
    'test.reload': 'Reload Dashboard',

    // Settings & Profile Modal
    'profile.title': 'Profile & Settings',
    'profile.lang_setting': 'App Language / Sprache',
    'profile.contact_person': 'Contact Person',
    'profile.name': 'Name',
    'profile.dob': 'Date of Birth',
    'profile.phone': 'Phone Number',
    'profile.address': 'Address',
    'profile.insurance': 'Health Insurance',
    'profile.opening_hours': 'Opening Hours',

    // Status Badges
    'status.in_treatment': 'In Treatment',
    'status.appeared': 'Checked In',
    'status.done': 'Completed',
    'status.cancelled': 'Cancelled',
    'status.delayed': 'Delayed',
    'status.rescheduled': 'Rescheduled',
    'status.pending': 'Pending',

    // Activity Log & Praxis Dashboard
    'praxis.activity_title': 'Patient Visit Activity Log',
    'praxis.activity_subtitle': 'Complete log of all patient visits, status changes, and workflow steps of your practice.',
    'praxis.add_manual_entry': 'Add Manual Entry',
    'praxis.search_placeholder': 'Search by patient, code, action...',
    'praxis.filter_all_status': 'All Statuses',
    'praxis.entries': 'Entries',
    'praxis.timestamp': 'Timestamp',
    'praxis.patient_id': 'Patient ID',
    'praxis.appointment_code': 'Appointment Code',
    'praxis.status': 'Status',
    'praxis.activity_description': 'Activity / Description',
    'praxis.staff': 'Staff Member',
    'praxis.tab_calendar': 'Calendar',
    'praxis.tab_stats': 'Stats & Appointments',
    'praxis.tab_treatment_times': 'Treatment Times & Analysis',
    'praxis.tab_activity_log': 'Activity Log',
    'praxis.tab_design': 'Design Pre-Check-In',
    'praxis.live_queue': 'Live Queue',
    'praxis.enter_manual_appointment': 'Add Phone Appointment'
  }
};

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'de' && lang !== 'en') return;
  currentLang = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang);
  }
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }
}

export function t(key, fallback = '') {
  const dict = translations[currentLang] || translations.de;
  if (dict[key] !== undefined) {
    return dict[key];
  }
  const fallbackDict = translations.de;
  if (fallbackDict[key] !== undefined) {
    return fallbackDict[key];
  }
  return fallback || key;
}
