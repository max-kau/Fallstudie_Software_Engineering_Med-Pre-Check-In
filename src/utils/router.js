/**
 * Simple Hash-based SPA Router
 */

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
  const hash = window.location.hash.slice(1) || 'landing';
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
