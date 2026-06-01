/**
 * SessionStorage State Management
 * Creates a fresh record per session – data is cleared when the browser tab/window is closed.
 * Each Pre-Check-In generates a unique session ID.
 */
import { auth } from './auth.js';

const STORE_PREFIX = 'doctolib_precheck_';

// Generate a unique session ID on first load, reuse it for the lifetime of this tab
let _sessionId = null;
function getSessionId() {
  if (!_sessionId) {
    // Check if we already have a session ID stored (to survive hash navigation)
    _sessionId = sessionStorage.getItem('_doctolib_session_id');
    if (!_sessionId) {
      _sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('_doctolib_session_id', _sessionId);
    }
  }
  return _sessionId;
}

function getTerminCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('termin') || 'demo_12345';
}

function getStoreKey() {
  return STORE_PREFIX + getTerminCode() + '_' + getSessionId();
}

function getAll() {
  try {
    const data = sessionStorage.getItem(getStoreKey());
    return data ? JSON.parse(data) : getDefaultData();
  } catch {
    return getDefaultData();
  }
}

function getDefaultData() {
  return {
    terminCode: getTerminCode(),
    sessionId: getSessionId(),
    currentStep: 'intro',
    beschwerden: {
      freitext: '',
      chips: [],
      customKeywords: [],
      showCustomInput: false,
      dauer: '',
      staerke: null,
    },
    medikamente: {
      liste: [],
      keine: false,
    },
    allergien: {
      liste: [],
      chips: [],
      keine: false,
      anmerkungen: '',
    },
    dokumente: {
      liste: [],
    },
    signature: null,
    submitted: false,
  };
}

function saveAll(data) {
  try {
    sessionStorage.setItem(getStoreKey(), JSON.stringify(data));
  } catch (e) {
    console.error('Store save error:', e);
  }
}

function get(key) {
  const data = getAll();
  return data[key];
}

let _autosaveTimeout = null;
function triggerAutosave() {
  if (_autosaveTimeout) clearTimeout(_autosaveTimeout);
  _autosaveTimeout = setTimeout(async () => {
    try {
      const allData = getAll();
      if (!allData.sessionId || allData.submitted) return;

      await fetch('/api/precheckin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: allData.sessionId,
          terminCode: allData.terminCode,
          beschwerden: allData.beschwerden,
          medikamente: allData.medikamente,
          allergien: allData.allergien,
          dokumente: allData.dokumente,
          signatureData: allData.signature,
          currentStep: allData.currentStep,
          submitted: allData.submitted
        })
      });
      console.log('Pre-check-in automatically saved to database.');
    } catch (e) {
      console.warn('Autosave to database failed:', e);
    }
  }, 1000); // 1-second debounce
}

function set(key, value) {
  const data = getAll();
  data[key] = value;
  saveAll(data);

  // Trigger background autosave for any questionnaire changes
  if (key !== 'submitted' && !data.submitted) {
    triggerAutosave();
  }
}

function clear() {
  sessionStorage.removeItem(getStoreKey());
}

function hasSavedProgress() {
  const data = getAll();
  if (data.submitted) return false;

  const hasBeschwerden = (data.beschwerden.chips && data.beschwerden.chips.length > 0) ||
                         (data.beschwerden.customKeywords && data.beschwerden.customKeywords.length > 0) ||
                         (data.beschwerden.freitext && data.beschwerden.freitext.trim().length > 0);
  const hasMedikamente = (data.medikamente.liste && data.medikamente.liste.length > 0) || data.medikamente.keine;
  const hasAllergien = (data.allergien.liste && data.allergien.liste.length > 0) ||
                       (data.allergien.chips && data.allergien.chips.length > 0) ||
                       data.allergien.keine;
  const hasDokumente = data.dokumente && data.dokumente.liste && data.dokumente.liste.length > 0;
  const hasSignature = !!data.signature;

  const hasNavigated = !['landing', 'confirm', 'intro'].includes(data.currentStep);

  return hasBeschwerden || hasMedikamente || hasAllergien || hasDokumente || hasSignature || hasNavigated;
}

function resetProgress() {
  clear();
  // Generate a brand new session ID so we start completely clean
  _sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem('_doctolib_session_id', _sessionId);

  const freshData = getDefaultData();
  saveAll(freshData);

  // Trigger an autosave to override/initialize the database record with the clean state
  triggerAutosave();
}

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        const terminCode = getTerminCode();

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            terminCode,
            filename: file.name,
            mimeType: file.type,
            fileData: base64Data
          })
        });

        if (!res.ok) throw new Error('Upload failed');
        const result = await res.json();

        if (result.success) {
          const currentDocs = get('dokumente') || { liste: [] };
          currentDocs.liste.push(result.file);
          set('dokumente', currentDocs);
          resolve(result.file);
        } else {
          reject(new Error('Upload failed on server'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

async function deleteFile(fileId) {
  try {
    const res = await fetch(`/api/file/${fileId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Delete failed');

    const currentDocs = get('dokumente') || { liste: [] };
    currentDocs.liste = currentDocs.liste.filter(f => f.id !== fileId);
    set('dokumente', currentDocs);
  } catch (err) {
    console.error('Failed to delete file:', err);
    throw err;
  }
}

/* ============================================
   DATA SOURCE ABSTRACTION
   ============================================ */

// --- Example / Placeholder Data ---
const EXAMPLE_DATA = {
  termin: {
    code: 'demo_12345',
    doctor: 'Dr. med. Anna Hartmann',
    fachrichtung: 'Allgemeinmedizin · Innere Medizin',
    adresse: 'Leopoldstraße 12, 80802 München',
    date: 'Mo, 25. Mai',
    time: '09:30',
    art: 'Routineuntersuchung',
    praxis: 'Hausarztpraxis',
    tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche'],
  },
  patient: {
    vorname: 'Max',
    nachname: 'Mustermann',
  },
};

let _dataProvider = async (terminCode) => {
  const res = await fetch(`/api/termin/${terminCode}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
};

function setDataProvider(providerFn) {
  _dataProvider = providerFn;
}

let _cachedData = null;

async function loadData() {
  if (_cachedData) return _cachedData;

  const terminCode = getTerminCode();

  // Load appointment and patient info first
  if (_dataProvider) {
    try {
      _cachedData = await _dataProvider(terminCode);
    } catch (err) {
      console.warn('Data provider failed, falling back to example data:', err);
      _cachedData = { ...EXAMPLE_DATA, termin: { ...EXAMPLE_DATA.termin, code: terminCode } };
    }
  } else {
    _cachedData = { ...EXAMPLE_DATA, termin: { ...EXAMPLE_DATA.termin, code: terminCode } };
  }

  // Load existing saved pre-check-in from the database for this appointment (resumption)
  try {
    const res = await fetch(`/api/precheckin/${terminCode}`);
    if (res.ok) {
      const result = await res.json();
      if (result.exists) {
        console.log('Restoring existing database pre-check-in record:', result.sessionId);

        // Keep the saved sessionId active in the client session
        _sessionId = result.sessionId;
        sessionStorage.setItem('_doctolib_session_id', _sessionId);

        // Restore entire state
        const savedState = {
          terminCode: result.terminCode,
          sessionId: result.sessionId,
          currentStep: result.currentStep || 'intro',
          beschwerden: result.beschwerden,
          medikamente: result.medikamente,
          allergien: result.allergien,
          dokumente: result.dokumente || { liste: [] },
          signature: result.signatureData || null,
          submitted: result.submitted || false
        };
        saveAll(savedState);
      }
    }
  } catch (err) {
    console.warn('Failed to load existing pre-check-in from database:', err);
  }

  return _cachedData;
}

function getTerminInfo() {
  if (_cachedData) return _cachedData.termin;
  return { ...EXAMPLE_DATA.termin, code: getTerminCode() };
}

function getPatientInfo() {
  if (auth.isLoggedIn()) {
    const user = auth.getUser();
    return {
      vorname: user.vorname,
      nachname: user.nachname,
      geburtsdatum: user.geburtsdatum || '',
      telefonnummer: user.telefonnummer || '',
      strasse_hnr: user.strasse_hnr || '',
      plz_ort: user.plz_ort || '',
      krankenversicherung: user.krankenversicherung || 'gesetzlich',
      krankenkasse: user.krankenkasse || '',
    };
  }
  if (_cachedData) return _cachedData.patient;
  return EXAMPLE_DATA.patient;
}

async function submitPreCheckIn() {
  const allData = getAll();
  
  // Set locally first
  allData.submitted = true;
  allData.currentStep = 'zusammenfassung';
  saveAll(allData);

  const res = await fetch('/api/precheckin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: allData.sessionId,
      terminCode: allData.terminCode,
      beschwerden: allData.beschwerden,
      medikamente: allData.medikamente,
      allergien: allData.allergien,
      dokumente: allData.dokumente,
      signatureData: allData.signature,
      currentStep: 'zusammenfassung',
      submitted: true
    })
  });

  if (!res.ok) {
    allData.submitted = false;
    saveAll(allData);
    throw new Error('Failed to submit precheck-in data to server');
  }
}

export const store = {
  getAll,
  saveAll,
  get,
  set,
  clear,
  getTerminCode,
  getTerminInfo,
  getPatientInfo,
  getDefaultData,
  setDataProvider,
  loadData,
  submitPreCheckIn,
  hasSavedProgress,
  resetProgress,
  triggerAutosave,
  uploadFile,
  deleteFile
};
