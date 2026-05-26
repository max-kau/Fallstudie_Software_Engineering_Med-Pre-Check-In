/**
 * SessionStorage State Management
 * Creates a fresh record per session – data is cleared when the browser tab/window is closed.
 * Each Pre-Check-In generates a unique session ID.
 */

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

function set(key, value) {
  const data = getAll();
  data[key] = value;
  saveAll(data);
}

function clear() {
  sessionStorage.removeItem(getStoreKey());
}

/* ============================================
   DATA SOURCE ABSTRACTION
   ============================================
   By default, the app uses the example dataset below.
   To connect your own database / API, call:

     store.setDataProvider(async (terminCode) => {
       const res = await fetch(`https://your-api.com/termin/${terminCode}`);
       const data = await res.json();
       return {
         termin: {
           code: terminCode,
           doctor: data.doctor,
           fachrichtung: data.fachrichtung,
           adresse: data.adresse,
           date: data.date,
           time: data.time,
           art: data.art,
           praxis: data.praxis,
           tags: data.tags,
         },
         patient: {
           vorname: data.patient.vorname,
           nachname: data.patient.nachname,
         },
       };
     });

   Until you set a provider, the example data is used.
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

// Custom data provider – defaults to API fetch from PostgreSQL backend
let _dataProvider = async (terminCode) => {
  const res = await fetch(`/api/termin/${terminCode}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
};

function setDataProvider(providerFn) {
  _dataProvider = providerFn;
}

// Cache for loaded data (per session)
let _cachedData = null;

async function loadData() {
  if (_cachedData) return _cachedData;

  const terminCode = getTerminCode();

  if (_dataProvider) {
    try {
      _cachedData = await _dataProvider(terminCode);
      return _cachedData;
    } catch (err) {
      console.warn('Data provider failed, falling back to example data:', err);
    }
  }

  // Fallback: use example data
  _cachedData = { ...EXAMPLE_DATA, termin: { ...EXAMPLE_DATA.termin, code: terminCode } };
  return _cachedData;
}

// Synchronous getter (uses cached or example data)
function getTerminInfo() {
  if (_cachedData) return _cachedData.termin;
  return { ...EXAMPLE_DATA.termin, code: getTerminCode() };
}

function getPatientInfo() {
  if (_cachedData) return _cachedData.patient;
  return EXAMPLE_DATA.patient;
}

async function submitPreCheckIn() {
  const allData = getAll();
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
      allergien: allData.allergien
    })
  });

  if (!res.ok) {
    throw new Error('Failed to submit precheck-in data to server');
  }

  // Update state locally
  set('submitted', true);
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
};
