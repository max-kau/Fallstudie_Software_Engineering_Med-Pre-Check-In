/**
 * Simple Hash-based SPA Router
 */

import { store } from './store.js';

const routes = {};
let currentView = null;
const appEl = () => document.getElementById('app');

export function registerRoute(hash, renderFn) {
  routes[hash] = renderFn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  // Ensure data is loaded (and restored from database) before rendering any view
  await store.loadData();

  const hash = window.location.hash.slice(1) || 'landing';
  
  // Guard: If the pre-check-in is already submitted, redirect to summary/success view
  const isSubmitted = store.get('submitted');
  if (isSubmitted && hash !== 'zusammenfassung') {
    navigate('zusammenfassung');
    return;
  }

  // Update current step in store for autosave/resumption (if navigating to a valid step)
  if (['confirm', 'intro', 'beschwerden', 'medikamente', 'allergien', 'dokumente', 'zusammenfassung'].includes(hash)) {
    // Temporarily disable triggerAutosave on simple metadata steps, but update structure
    const data = store.getAll();
    if (data.currentStep !== hash) {
      data.currentStep = hash;
      store.saveAll(data);
      if (['beschwerden', 'medikamente', 'allergien', 'dokumente'].includes(hash)) {
        store.triggerAutosave();
      }
    }
  }

  const renderFn = routes[hash];

  if (!renderFn) {
    navigate('landing');
    return;
  }

  const app = appEl();
  
  // Exit animation for current view
  const currentContent = app.querySelector('.view');
  if (currentContent) {
    currentContent.classList.add('view-exit');
    await new Promise(r => setTimeout(r, 200));
  }

  // Render new view
  const html = renderFn();
  app.innerHTML = html;

  // Enter animation
  const newContent = app.querySelector('.view');
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
