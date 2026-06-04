/**
 * Simple Hash-based SPA Router
 */

import { store } from './store.js';
import { auth } from './auth.js';
import { fetchPraxen } from '../data/praxen.js';

const routes = {};
let currentView = null;
const appEl = () => document.getElementById('app');

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['home', 'auth', 'praxis', 'suche'];

export function registerRoute(hash, renderFn) {
  routes[hash] = renderFn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  // Load dynamic practices from server
  try {
    await fetchPraxen();
  } catch (err) {
    console.warn('Could not fetch practices in route handler:', err);
  }

  const hash = window.location.hash.slice(1) || 'home';
  let routeKey = hash;

  if (hash.startsWith('praxis/')) {
    routeKey = 'praxis';
  }

  // Check authentication status
  await auth.checkSession();
  const loggedIn = auth.isLoggedIn();

  // Auth guard: redirect to home if not logged in and trying to access protected route
  if (!loggedIn && !PUBLIC_ROUTES.includes(routeKey)) {
    navigate('home');
    return;
  }

  // If logged in and trying to access auth, redirect based on role
  if (loggedIn && routeKey === 'auth') {
    navigate(auth.isPraxis() ? 'praxis-dashboard' : 'landing');
    return;
  }

  // If praxis user tries to access patient-only routes, redirect to praxis dashboard
  const PATIENT_ONLY_ROUTES = ['landing', 'confirm', 'intro', 'beschwerden', 'medikamente', 'allergien', 'dokumente', 'zusammenfassung'];
  if (loggedIn && auth.isPraxis() && PATIENT_ONLY_ROUTES.includes(routeKey)) {
    navigate('praxis-dashboard');
    return;
  }

  // If patient user tries to access praxis dashboard, redirect to landing
  if (loggedIn && !auth.isPraxis() && routeKey === 'praxis-dashboard') {
    navigate('landing');
    return;
  }

  // For protected patient routes, ensure data is loaded
  if (!PUBLIC_ROUTES.includes(routeKey) && routeKey !== 'praxis-dashboard') {
    await store.loadData();

    // Guard: If the pre-check-in is already submitted, redirect to summary/success view
    const isSubmitted = store.get('submitted');
    if (isSubmitted && routeKey !== 'zusammenfassung') {
      navigate('zusammenfassung');
      return;
    }

    // Update current step in store for autosave/resumption (if navigating to a valid step)
    if (['confirm', 'intro', 'beschwerden', 'medikamente', 'allergien', 'dokumente', 'zusammenfassung'].includes(routeKey)) {
      const data = store.getAll();
      if (data.currentStep !== routeKey) {
        data.currentStep = routeKey;
        store.saveAll(data);
        if (['beschwerden', 'medikamente', 'allergien', 'dokumente'].includes(routeKey)) {
          store.triggerAutosave();
        }
      }
    }
  }

  const renderFn = routes[routeKey];

  if (!renderFn) {
    navigate(loggedIn ? 'landing' : 'home');
    return;
  }

  const app = appEl();
  
  // Exit animation for current view
  const currentContent = app.querySelector('.view, .dl-home, .dl-auth-page, .dl-praxis-view');
  if (currentContent) {
    currentContent.classList.add('view-exit');
    await new Promise(r => setTimeout(r, 200));
  }

  // Render new view
  const html = renderFn();
  app.innerHTML = html;

  // Enter animation
  const newContent = app.querySelector('.view, .dl-home, .dl-auth-page, .dl-praxis-view');
  if (newContent) {
    newContent.classList.add('view-enter');
  }

  // Scroll to top
  window.scrollTo(0, 0);

  // Dispatch custom event for view-specific init
  window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: routeKey } }));
  currentView = routeKey;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function getCurrentView() {
  return currentView;
}
