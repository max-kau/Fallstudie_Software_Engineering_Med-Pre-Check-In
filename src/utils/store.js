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
  let code = params.get('termin');

  // Try parsing from hash query if not in search (e.g., #intro?termin=...)
  if (!code && window.location.hash) {
    const hashParts = window.location.hash.split('?');
    if (hashParts.length > 1) {
      const hashParams = new URLSearchParams(hashParts[1]);
      code = hashParams.get('termin');
    }
  }

  // Fallback to sessionStorage
  if (!code) {
    code = sessionStorage.getItem('_last_termin_code');
  }

  // Save if found, so we can preserve it
  if (code && code !== 'demo_12345') {
    sessionStorage.setItem('_last_termin_code', code);
  }

  return code || 'demo_12345';
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
    customAnswers: {},
    documentConfirmations: {},
    aiQuestions: [],
    aiConsent: null,
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

async function saveProgressToServer() {
  const allData = getAll();
  if (!allData.sessionId || allData.submitted) return;

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
      currentStep: allData.currentStep,
      submitted: allData.submitted,
      customAnswers: allData.customAnswers || {},
      documentConfirmations: allData.documentConfirmations || {},
      aiQuestions: allData.aiQuestions || [],
      aiConsent: allData.aiConsent
    })
  });
  if (!res.ok) throw new Error('API save failed');
  console.log('Pre-check-in saved to database immediately.');
}

let _autosaveTimeout = null;
function triggerAutosave() {
  if (_autosaveTimeout) clearTimeout(_autosaveTimeout);
  _autosaveTimeout = setTimeout(async () => {
    try {
      await saveProgressToServer();
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
  _cachedData = null;
  _praxisDocuments = null;
  // Generate a brand new session ID so we start completely clean
  _sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem('_doctolib_session_id', _sessionId);

  const freshData = getDefaultData();
  saveAll(freshData);

  // Do NOT trigger autosave here, as it would overwrite the completed pre-check-in record in the database.
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
  const res = await fetch(`/api/termin/${terminCode}?_t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
};

function setDataProvider(providerFn) {
  _dataProvider = providerFn;
}

let _cachedData = null;

async function loadData() {
  const terminCode = getTerminCode();
  if (_cachedData && _cachedData.termin && _cachedData.termin.code !== terminCode) {
    _cachedData = null;
    _praxisDocuments = null;
    _sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem('_doctolib_session_id', _sessionId);
  }

  if (!_cachedData) {
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
      const res = await fetch(`/api/precheckin/${terminCode}?_t=${Date.now()}`, { cache: 'no-store' });
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
            submitted: result.submitted || false,
            customAnswers: result.customAnswers || {},
            documentConfirmations: result.documentConfirmations || {},
            aiQuestions: result.aiQuestions || [],
            aiConsent: result.aiConsent
          };
          saveAll(savedState);
        } else {
          // No pre-check-in exists for this appointment yet; reset store state to defaults for this appointment
          const freshData = getDefaultData();
          saveAll(freshData);
        }
      }
    } catch (err) {
      console.warn('Failed to load existing pre-check-in from database:', err);
    }
  }

  // Load custom questions for this practice/appointment (always refresh)
  try {
    const qRes = await fetch(`/api/precheckin/questions?termin=${terminCode}&_t=${Date.now()}`, { cache: 'no-store' });
    if (qRes.ok) {
      const qData = await qRes.json();
      if (qData.success) {
        if (_cachedData) {
          _cachedData.customQuestions = qData.questions || [];
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load custom questions for pre-check-in:', err);
  }

  // Load praxis documents for this practice/appointment (always refresh)
  try {
    await loadPraxisDocuments();
  } catch (err) {
    console.warn('Failed to load praxis documents for pre-check-in:', err);
  }

  return _cachedData;
}

function getCustomQuestions() {
  return _cachedData && _cachedData.customQuestions ? _cachedData.customQuestions : [];
}

let _praxisDocuments = null;

async function loadPraxisDocuments() {
  const terminCode = getTerminCode();
  try {
    const res = await fetch(`/api/precheckin/documents?termin=${terminCode}&_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        _praxisDocuments = data.documents || [];
        if (_cachedData) {
          _cachedData.praxisDocuments = _praxisDocuments;
        }
        return _praxisDocuments;
      }
    }
  } catch (err) {
    console.warn('Failed to load praxis documents:', err);
  }
  _praxisDocuments = (_cachedData && _cachedData.praxisDocuments) ? _cachedData.praxisDocuments : [];
  return _praxisDocuments;
}

function getPraxisDocuments() {
  if (_praxisDocuments && Array.isArray(_praxisDocuments)) {
    return _praxisDocuments;
  }
  if (_cachedData && Array.isArray(_cachedData.praxisDocuments)) {
    return _cachedData.praxisDocuments;
  }
  return [];
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
      submitted: true,
      customAnswers: allData.customAnswers || {},
      documentConfirmations: allData.documentConfirmations || {},
      aiQuestions: allData.aiQuestions || [],
      aiConsent: allData.aiConsent
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
  getCustomQuestions,
  getPraxisDocuments,
  loadPraxisDocuments,
  getDefaultData,
  setDataProvider,
  loadData,
  submitPreCheckIn,
  hasSavedProgress,
  resetProgress,
  triggerAutosave,
  saveProgressToServer,
  uploadFile,
  deleteFile
};
