import { registerRoute, initRouter, navigate, handleRoute } from './utils/router.js';
import { store } from './utils/store.js';
import { renderHomeView, initHomeView } from './views/HomeView.js';
import { renderAuthView, initAuthView } from './views/AuthView.js';
import { renderLandingView, initLandingView } from './views/LandingView.js';
import { renderConfirmView, initConfirmView } from './views/ConfirmView.js';
import { renderIntroView, initIntroView } from './views/IntroView.js';
import { renderBeschwerdenView, initBeschwerdenView } from './views/BeschwerdenView.js';
import { renderMedikamenteView, initMedikamenteView } from './views/MedikamenteView.js';
import { renderAllergienView, initAllergienView } from './views/AllergienView.js';
import { renderAIZusatzfragenView, initAIZusatzfragenView } from './views/AIZusatzfragenView.js';
import { renderDokumenteView, initDokumenteView } from './views/DokumenteView.js';
import { renderSummaryView, initSummaryView } from './views/SummaryView.js';
import { renderPraxisView, initPraxisView } from './views/PraxisView.js';
import { renderSearchView, initSearchView } from './views/SearchView.js';
import { renderPraxisDashboardView, initPraxisDashboardView } from './views/PraxisDashboardView.js';
import { renderZusatzfragenView, initZusatzfragenView } from './views/ZusatzfragenView.js';
import { renderPraxisDokumenteView, initPraxisDokumenteView } from './views/PraxisDokumenteView.js';
import { renderFeedbackView, initFeedbackView } from './views/FeedbackView.js';
import { renderLiveQueueDoctorView, initLiveQueueDoctorView } from './views/LiveQueueDoctorView.js';
import { renderLiveQueuePatientView, initLiveQueuePatientView } from './views/LiveQueuePatientView.js';
import { renderTestDashboardView, initTestDashboardView } from './views/TestDashboardView.js';

// Register all routes
registerRoute('home', renderHomeView);
registerRoute('auth', renderAuthView);
registerRoute('landing', renderLandingView);
registerRoute('confirm', renderConfirmView);
registerRoute('intro', renderIntroView);
registerRoute('beschwerden', renderBeschwerdenView);
registerRoute('zusatzfragen', renderZusatzfragenView);
registerRoute('medikamente', renderMedikamenteView);
registerRoute('allergien', renderAllergienView);
registerRoute('ai-fragen', renderAIZusatzfragenView);
registerRoute('dokumente', renderDokumenteView);
registerRoute('praxis-dokumente', renderPraxisDokumenteView);
registerRoute('zusammenfassung', renderSummaryView);
registerRoute('praxis', renderPraxisView);
registerRoute('suche', renderSearchView);
registerRoute('praxis-dashboard', renderPraxisDashboardView);
registerRoute('feedback', renderFeedbackView);
registerRoute('live-queue', renderLiveQueueDoctorView);
registerRoute('warteschlange', renderLiveQueuePatientView);
registerRoute('test-dashboard', renderTestDashboardView);

// View initializers map
const initializers = {
  home: initHomeView,
  auth: initAuthView,
  landing: initLandingView,
  confirm: initConfirmView,
  intro: initIntroView,
  beschwerden: initBeschwerdenView,
  zusatzfragen: initZusatzfragenView,
  medikamente: initMedikamenteView,
  allergien: initAllergienView,
  'ai-fragen': initAIZusatzfragenView,
  dokumente: initDokumenteView,
  'praxis-dokumente': initPraxisDokumenteView,
  zusammenfassung: initSummaryView,
  praxis: initPraxisView,
  suche: initSearchView,
  'praxis-dashboard': initPraxisDashboardView,
  feedback: initFeedbackView,
  'live-queue': initLiveQueueDoctorView,
  warteschlange: initLiveQueuePatientView,
  'test-dashboard': initTestDashboardView,
};

// Listen for view changes and run initializers
window.addEventListener('viewChanged', (e) => {
  const view = e.detail.view;
  console.log("DEBUG: viewChanged event received for view =", view);
  const init = initializers[view];
  if (init) {
    console.log("DEBUG: Running initializer for view =", view);
    init();
  } else {
    console.warn("DEBUG: No initializer found for view =", view);
  }

  // Attach exit pre-check-in handler if button is present
  const exitBtn = document.getElementById('btn-exit-precheck');
  if (exitBtn) {
    exitBtn.addEventListener('click', async (evt) => {
      evt.preventDefault();
      // Show loading/saving state
      exitBtn.innerHTML = `
        <div class="dl-auth-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 4px; display: inline-block;"></div>
        <span class="btn-exit-text">Wird gespeichert...</span>
      `;
      exitBtn.style.pointerEvents = 'none';

      try {
        await store.saveProgressToServer();
      } catch (err) {
        console.warn('Immediate save on exit failed:', err);
      }

      navigate('landing');
    });
  }
});

// Start the app
initRouter();

// Re-render view on language change
window.addEventListener('languageChanged', () => {
  handleRoute();
});

// Expose store for E2E testing
window.__doctolib_store = store;
