import { registerRoute, initRouter } from './utils/router.js';
import { renderHomeView, initHomeView } from './views/HomeView.js';
import { renderAuthView, initAuthView } from './views/AuthView.js';
import { renderLandingView, initLandingView } from './views/LandingView.js';
import { renderConfirmView, initConfirmView } from './views/ConfirmView.js';
import { renderIntroView, initIntroView } from './views/IntroView.js';
import { renderBeschwerdenView, initBeschwerdenView } from './views/BeschwerdenView.js';
import { renderMedikamenteView, initMedikamenteView } from './views/MedikamenteView.js';
import { renderAllergienView, initAllergienView } from './views/AllergienView.js';
import { renderDokumenteView, initDokumenteView } from './views/DokumenteView.js';
import { renderSummaryView, initSummaryView } from './views/SummaryView.js';
import { renderPraxisView, initPraxisView } from './views/PraxisView.js';
import { renderSearchView, initSearchView } from './views/SearchView.js';

// Register all routes
registerRoute('home', renderHomeView);
registerRoute('auth', renderAuthView);
registerRoute('landing', renderLandingView);
registerRoute('confirm', renderConfirmView);
registerRoute('intro', renderIntroView);
registerRoute('beschwerden', renderBeschwerdenView);
registerRoute('medikamente', renderMedikamenteView);
registerRoute('allergien', renderAllergienView);
registerRoute('dokumente', renderDokumenteView);
registerRoute('zusammenfassung', renderSummaryView);
registerRoute('praxis', renderPraxisView);
registerRoute('suche', renderSearchView);

// View initializers map
const initializers = {
  home: initHomeView,
  auth: initAuthView,
  landing: initLandingView,
  confirm: initConfirmView,
  intro: initIntroView,
  beschwerden: initBeschwerdenView,
  medikamente: initMedikamenteView,
  allergien: initAllergienView,
  dokumente: initDokumenteView,
  zusammenfassung: initSummaryView,
  praxis: initPraxisView,
  suche: initSearchView,
};

// Listen for view changes and run initializers
window.addEventListener('viewChanged', (e) => {
  const view = e.detail.view;
  const init = initializers[view];
  if (init) init();
});

// Start the app
initRouter();
