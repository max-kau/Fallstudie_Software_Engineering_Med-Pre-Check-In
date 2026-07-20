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
const PUBLIC_ROUTES = ['home', 'auth', 'praxis', 'suche', 'feedback'];

export function registerRoute(hash, renderFn) {
  routes[hash] = renderFn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  // Clean up any remaining modals/overlays in document.body
  const modalSelectors = [
    '#profile-modal',
    '#delay-modal-overlay',
    '#reschedule-modal-backdrop',
    '#create-appt-modal-backdrop',
    '#doc-viewer-modal',
    '.dl-modal-backdrop',
    '.delay-modal-overlay',
    '.reschedule-modal-backdrop',
    '.create-appt-modal-backdrop',
    '.modal-backdrop'
  ];
  modalSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.remove());
  });

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
  // Handle warteschlange route with query params (e.g. warteschlange?praxis=...)
  if (hash.startsWith('warteschlange')) {
    routeKey = 'warteschlange';
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
  const PATIENT_ONLY_ROUTES = ['landing', 'confirm', 'intro', 'beschwerden', 'zusatzfragen', 'medikamente', 'allergien', 'ai-fragen', 'dokumente', 'praxis-dokumente', 'zusammenfassung', 'warteschlange'];
  if (loggedIn && auth.isPraxis() && PATIENT_ONLY_ROUTES.includes(routeKey)) {
    navigate('praxis-dashboard');
    return;
  }

  // If patient user tries to access praxis-only routes, redirect to landing
  if (loggedIn && !auth.isPraxis() && (routeKey === 'praxis-dashboard' || routeKey === 'live-queue')) {
    navigate('landing');
    return;
  }

  // For protected patient routes, ensure data is loaded (skip queue views and landing view which have their own data loading)
  if (!PUBLIC_ROUTES.includes(routeKey) && routeKey !== 'landing' && routeKey !== 'praxis-dashboard' && routeKey !== 'live-queue' && routeKey !== 'warteschlange') {
    await store.loadData();

    const isSubmitted = store.get('submitted');

    // Guard: If the appointment date has passed and it's not submitted, redirect to landing
    const termin = store.getTerminInfo();
    if (termin && termin.date) {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return new Date(dateStr + 'T00:00:00');
        }
        const monthMap = {
          'jan': 0, 'feb': 1, 'mär': 2, 'mar': 2, 'apr': 3, 'mai': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
        };
        const match = dateStr.match(/(\d{1,2})\.\s*(\w{3})/);
        if (!match) return null;
        const day = parseInt(match[1], 10);
        const monthAbbr = match[2].toLowerCase();
        const month = monthMap[monthAbbr];
        if (month === undefined || isNaN(day)) return null;
        const now = new Date();
        const year = now.getFullYear();
        return new Date(year, month, day);
      };
      
      const parseDateTime = (dateStr, timeStr) => {
        const dateObj = parseDate(dateStr);
        if (!dateObj) return null;
        if (timeStr) {
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            dateObj.setHours(hours, minutes, 0, 0);
          }
        }
        return dateObj;
      };

      const apptDateTime = parseDateTime(termin.date, termin.time);
      const isPast = apptDateTime && apptDateTime < new Date();
      
      const PRECHECK_STEPS = ['confirm', 'intro', 'beschwerden', 'zusatzfragen', 'medikamente', 'allergien', 'ai-fragen', 'dokumente', 'praxis-dokumente'];
      if (isPast && !isSubmitted && PRECHECK_STEPS.includes(routeKey)) {
        navigate('landing');
        return;
      }
    }

    // Guard: If the pre-check-in is already submitted, redirect to summary/success view when trying to access active pre-check-in steps
    const PRECHECK_STEPS = ['confirm', 'intro', 'beschwerden', 'zusatzfragen', 'medikamente', 'allergien', 'ai-fragen', 'dokumente', 'praxis-dokumente'];
    if (isSubmitted && PRECHECK_STEPS.includes(routeKey)) {
      navigate('zusammenfassung');
      return;
    }

    // Update current step in store for autosave/resumption (if navigating to a valid step)
    if (['confirm', 'intro', 'beschwerden', 'zusatzfragen', 'medikamente', 'allergien', 'ai-fragen', 'dokumente', 'praxis-dokumente', 'zusammenfassung'].includes(routeKey)) {
      const data = store.getAll();
      if (data.currentStep !== routeKey) {
        data.currentStep = routeKey;
        store.saveAll(data);
        if (['beschwerden', 'zusatzfragen', 'medikamente', 'allergien', 'ai-fragen', 'dokumente', 'praxis-dokumente'].includes(routeKey)) {
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
