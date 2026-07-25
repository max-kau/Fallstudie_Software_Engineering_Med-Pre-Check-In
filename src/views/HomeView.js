import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { praxen, fetchPraxen } from '../data/praxen.js';

export function renderHomeView() {
  return `
    ${renderDlNav()}

    <!-- Hero Section -->
    <div class="dl-home">
      <div class="dl-home-hero">
        <div class="dl-home-hero-inner">
          <h1 class="dl-home-title">Buchen Sie Ihren <span class="dl-home-highlight">Arzttermin</span> online</h1>
          <p class="dl-home-subtitle">Einfach. Sicher. Kostenlos.</p>

          <!-- Search bar active -->
          <div class="dl-home-search">
            <!-- Praxis Search Field with its relative container and dropdown -->
            <div class="dl-home-search-field" style="flex: 1.5; position: relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="search-praxis-input" placeholder="Arztpraxis, Fachbereich oder Name..." class="dl-home-search-input" autocomplete="off" />
              
              <!-- Autocomplete Dropdown for Praxis -->
              <div class="search-autocomplete-menu" id="search-autocomplete" style="display: none; top: 105%; left: 0; right: 0;">
                <!-- Matches rendered dynamically -->
              </div>
            </div>

            <!-- Location Search Field with its relative container and dropdown -->
            <div class="dl-home-search-field" style="position: relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input type="text" id="search-location-input" placeholder="Düsseldorf, Köln, Essen..." class="dl-home-search-input" autocomplete="off" />
              
              <!-- Autocomplete Dropdown for Location -->
              <div class="search-autocomplete-menu" id="location-autocomplete" style="display: none; top: 105%; left: 0; right: 0;">
                <!-- Location matches rendered dynamically -->
              </div>
            </div>

            <button class="dl-home-search-btn" id="btn-search-submit">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Suchen
            </button>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="dl-home-features">
        <div class="dl-home-features-inner">
          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.1s">
            <div class="dl-home-feature-icon" style="background: #EBF5FF; color: #0063BE;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Termine online buchen</h3>
            <p class="dl-home-feature-desc">Buchen Sie rund um die Uhr Termine bei Ihrem Arzt – ohne Wartezeit am Telefon.</p>
          </div>

          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.2s">
            <div class="dl-home-feature-icon" style="background: #ECFDF5; color: #059669;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Digitaler Pre-Check-In</h3>
            <p class="dl-home-feature-desc">Bereiten Sie Ihren Termin vorab vor – Beschwerden, Medikamente und Allergien digital erfassen.</p>
          </div>

          <div class="dl-home-feature-card fade-in-up" style="animation-delay: 0.3s">
            <div class="dl-home-feature-icon" style="background: #FEF3C7; color: #D97706;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <h3 class="dl-home-feature-title">Erinnerungen & Benachrichtigungen</h3>
            <p class="dl-home-feature-desc">Erhalten Sie automatische Erinnerungen per E-Mail oder SMS, damit Sie keinen Termin verpassen.</p>
          </div>
        </div>
      </div>

      <!-- Trust Banner -->
      <div class="dl-home-trust">
        <div class="dl-home-trust-inner">
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            DSGVO-konform
          </div>
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Über 80 Mio. Nutzer in Europa
          </div>
          <div class="dl-home-trust-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Ende-zu-Ende-Verschlüsselung
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="dl-home-footer">
        <div class="dl-home-footer-inner">
          <div class="dl-home-footer-brand">
            <span class="dl-nav-name" style="color: var(--gray-400);">Doctolib</span>
            <span class="dl-home-footer-copy">© 2026 – Demo für Studienzwecke</span>
          </div>
          <div class="dl-home-footer-links">
            <a href="#">Impressum</a>
            <a href="#">Datenschutz</a>
            <a href="#">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}

export function initHomeView() {
  initDlNav();

  const searchInput = document.getElementById('search-praxis-input');
  const locationInput = document.getElementById('search-location-input');
  const autocompleteMenu = document.getElementById('search-autocomplete');
  const locationMenu = document.getElementById('location-autocomplete');

  if (!searchInput || !locationInput || !autocompleteMenu || !locationMenu) return;

  const uniqueLocations = [
    'Düsseldorf', 'Köln', 'Essen', 'Duisburg', 'Dortmund', 
    'Münster', 'Bonn', 'Hamburg', 'Konstanz', 'Heidelberg'
  ];

  fetchPraxen();

  // 1. Practice autocomplete search
  function performSearch() {
    const val = searchInput.value.trim().toLowerCase();
    const loc = locationInput.value.trim().toLowerCase();

    if (val.length === 0) {
      autocompleteMenu.style.display = 'none';
      return;
    }

    // Filter matching practices strictly by name or specialty (not full description text)
    const matches = praxen.filter(praxis => {
      const nameMatch = (praxis.name || '').toLowerCase().includes(val);
      const fachbereichMatch = (praxis.fachbereich || '').toLowerCase().includes(val);
      const doctorsMatch = (praxis.aerzte ? praxis.aerzte.join(' ') : '').toLowerCase().includes(val);

      const textMatch = nameMatch || fachbereichMatch || doctorsMatch;
      const locMatch = loc ? (praxis.adresse || '').toLowerCase().includes(loc) : true;

      return textMatch && locMatch;
    });

    if (matches.length === 0) {
      autocompleteMenu.innerHTML = `
        <div class="autocomplete-no-results" style="padding: var(--space-4); text-align: center; color: var(--gray-500); font-size: var(--font-size-sm);">
          Keine Praxen gefunden
        </div>
      `;
    } else {
      autocompleteMenu.innerHTML = matches.map(praxis => {
        return `
          <div class="autocomplete-item" data-slug="${praxis.slug}">
            <div class="autocomplete-item-logo" style="background: ${praxis.gradient};">
              ${praxis.logo && praxis.logo.includes('.') ? `<img src="${praxis.logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />` : (praxis.logo || '🏥')}
            </div>
            <div class="autocomplete-item-details">
              <strong class="autocomplete-item-name">${praxis.name}</strong>
              <span class="autocomplete-item-sub">${praxis.fachbereich} · ${praxis.adresse}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    autocompleteMenu.style.display = 'block';
  }

  // 2. Location autocomplete search
  function performLocationSearch() {
    const val = locationInput.value.trim().toLowerCase();

    if (val.length === 0) {
      locationMenu.style.display = 'none';
      return;
    }

    const matches = uniqueLocations.filter(loc => loc.toLowerCase().includes(val));

    if (matches.length === 0) {
      locationMenu.innerHTML = `
        <div class="autocomplete-no-results">
          Keine Orte gefunden
        </div>
      `;
    } else {
      locationMenu.innerHTML = matches.map(loc => {
        return `
          <div class="autocomplete-item location-item" data-location="${loc}">
            <div class="autocomplete-item-logo" style="background: var(--primary-lightest); color: var(--primary); font-size: var(--font-size-md);">
              📍
            </div>
            <div class="autocomplete-item-details">
              <strong class="autocomplete-item-name">${loc}</strong>
              <span class="autocomplete-item-sub">Nordrhein-Westfalen / Deutschland</span>
            </div>
          </div>
        `;
      }).join('');
    }

    locationMenu.style.display = 'block';
  }

  // Attach input listeners
  searchInput.addEventListener('input', performSearch);
  locationInput.addEventListener('input', performLocationSearch);

  // Focus listeners - only show suggestions if text is typed
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) performSearch();
  });
  locationInput.addEventListener('focus', () => {
    if (locationInput.value.trim().length > 0) performLocationSearch();
  });

  // Global click listener to close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-praxis-input') && !e.target.closest('#search-autocomplete')) {
      autocompleteMenu.style.display = 'none';
    }
    if (!e.target.closest('#search-location-input') && !e.target.closest('#location-autocomplete')) {
      locationMenu.style.display = 'none';
    }
  });

  // Handle click on practice autocomplete item
  autocompleteMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;

    const slug = item.getAttribute('data-slug');
    autocompleteMenu.style.display = 'none';
    navigate(`praxis/${slug}`);
  });

  // Handle click on location autocomplete item
  locationMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.location-item');
    if (!item) return;

    const selectedLoc = item.getAttribute('data-location');
    locationInput.value = selectedLoc;
    locationMenu.style.display = 'none';

    // Update practice autocomplete search to immediately apply the location filter!
    if (searchInput.value.trim().length > 0) {
      performSearch();
    }
  });

  // Submit search button
  document.getElementById('btn-search-submit')?.addEventListener('click', () => {
    const val = searchInput.value.trim();
    const loc = locationInput.value.trim();

    // If both inputs are empty, do nothing (do not search)
    if (!val && !loc) return;

    sessionStorage.setItem('search_query_name', val);
    sessionStorage.setItem('search_query_location', loc);

    navigate('suche');
  });
}
