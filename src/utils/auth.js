/**
 * Client-side Authentication Manager
 * Handles login, registration, logout and session state.
 */

let _currentUser = null;
let _checked = false;

async function checkSession(force = false) {
  if (_checked && !force) return _currentUser;
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    _currentUser = data.loggedIn ? data.user : null;
    _checked = true;
  } catch (err) {
    console.warn('Auth session check failed:', err);
    _currentUser = null;
    _checked = true;
  }
  return _currentUser;
}

async function login(email, password, role) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login fehlgeschlagen');
  _currentUser = data.user;
  _checked = true;
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: _currentUser } }));
  return _currentUser;
}

async function register(vorname, nachname, email, password, role, praxisFields) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, vorname, nachname, role, ...praxisFields })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen');
  _currentUser = data.user;
  _checked = true;
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: _currentUser } }));
  return _currentUser;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout request failed:', err);
  }
  _currentUser = null;
  _checked = true;
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { user: null } }));
}

function getUser() {
  return _currentUser;
}

function isLoggedIn() {
  return !!_currentUser;
}

function isPraxis() {
  return Boolean(_currentUser && _currentUser.role === 'praxis');
}

function isAdmin() {
  return Boolean(_currentUser && _currentUser.role === 'admin');
}

export const auth = {
  checkSession,
  login,
  register,
  logout,
  getUser,
  isLoggedIn,
  isPraxis,
  isAdmin
};
