/**
 * Simple Hash-based SPA Router
 */

import { store } from './store.js';
import { auth } from './auth.js';

const routes = {};
let currentView = null;
const appEl = () => document.getElementById('app');

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['home', 'auth'];

export function registerRoute(hash, renderFn) {
  routes[hash] = renderFn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || 'home';

  // Check authentication status
  await auth.checkSession();
  const loggedIn = auth.isLoggedIn();

  // Auth guard: redirect to home if not logged in and trying to access protected route
  if (!loggedIn && !PUBLIC_ROUTES.includes(hash)) {
    navigate('home');
    return;
  }

  // If logged in and trying to access auth or home, redirect to landing
  if (loggedIn && (hash === 'home' || hash === 'auth')) {
    navigate('landing');
    return;
  }

  // For protected routes, ensure data is loaded
  if (!PUBLIC_ROUTES.includes(hash)) {
    await store.loadData();

    // Guard: If the pre-check-in is already submitted, redirect to summary/success view
    const isSubmitted = store.get('submitted');
    if (isSubmitted && hash !== 'zusammenfassung') {
      navigate('zusammenfassung');
      return;
    }

    // Update current step in store for autosave/resumption (if navigating to a valid step)
    if (['confirm', 'intro', 'beschwerden', 'medikamente', 'allergien', 'dokumente', 'zusammenfassung'].includes(hash)) {
      const data = store.getAll();
      if (data.currentStep !== hash) {
        data.currentStep = hash;
        store.saveAll(data);
        if (['beschwerden', 'medikamente', 'allergien', 'dokumente'].includes(hash)) {
          store.triggerAutosave();
        }
      }
    }
  }

  const renderFn = routes[hash];

  if (!renderFn) {
    navigate(loggedIn ? 'landing' : 'home');
    return;
  }

  const app = appEl();
  
  // Exit animation for current view
  const currentContent = app.querySelector('.view, .dl-home, .dl-auth-page');
  if (currentContent) {
    currentContent.classList.add('view-exit');
    await new Promise(r => setTimeout(r, 200));
  }

  // Render new view
  const html = renderFn();
  app.innerHTML = html;

  // Enter animation
  const newContent = app.querySelector('.view, .dl-home, .dl-auth-page');
  if (newContent) {
    newContent.classList.add('view-enter');
  }

  // Scroll to top
  window.scrollTo(0, 0);

  // Dispatch custom event for view-specific init
  window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: hash } }));
  currentView = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function getCurrentView() {
  return currentView;
}
