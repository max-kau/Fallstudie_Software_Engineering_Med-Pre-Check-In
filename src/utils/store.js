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
      dauer: '',
      staerke: 3,
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

function getTerminInfo() {
  return {
    code: getTerminCode(),
    doctor: 'Dr. med. Anna Hartmann',
    fachrichtung: 'Allgemeinmedizin · Innere Medizin',
    adresse: 'Leopoldstraße 12, 80802 München',
    date: 'Mo, 25. Mai',
    time: '09:30',
    art: 'Routineuntersuchung',
    praxis: 'Hausarztpraxis',
    tags: ['Kassenpatienten', 'Privatpatienten', 'Hausbesuche'],
  };
}

export const store = {
  getAll,
  saveAll,
  get,
  set,
  clear,
  getTerminCode,
  getTerminInfo,
  getDefaultData,
};
