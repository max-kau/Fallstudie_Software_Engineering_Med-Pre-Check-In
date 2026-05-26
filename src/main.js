import { registerRoute, initRouter } from './utils/router.js';
import { renderLandingView, initLandingView } from './views/LandingView.js';
import { renderConfirmView, initConfirmView } from './views/ConfirmView.js';
import { renderIntroView, initIntroView } from './views/IntroView.js';
import { renderBeschwerdenView, initBeschwerdenView } from './views/BeschwerdenView.js';
import { renderMedikamenteView, initMedikamenteView } from './views/MedikamenteView.js';
import { renderAllergienView, initAllergienView } from './views/AllergienView.js';
import { renderSummaryView, initSummaryView } from './views/SummaryView.js';

// Register all routes
registerRoute('landing', renderLandingView);
registerRoute('confirm', renderConfirmView);
registerRoute('intro', renderIntroView);
registerRoute('beschwerden', renderBeschwerdenView);
registerRoute('medikamente', renderMedikamenteView);
registerRoute('allergien', renderAllergienView);
registerRoute('zusammenfassung', renderSummaryView);

// View initializers map
const initializers = {
  landing: initLandingView,
  confirm: initConfirmView,
  intro: initIntroView,
  beschwerden: initBeschwerdenView,
  medikamente: initMedikamenteView,
  allergien: initAllergienView,
  zusammenfassung: initSummaryView,
};

// Listen for view changes and run initializers
window.addEventListener('viewChanged', (e) => {
  const view = e.detail.view;
  const init = initializers[view];
  if (init) init();
});

// Start the app
initRouter();
