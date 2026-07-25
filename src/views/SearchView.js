import { auth } from '../utils/auth.js';
import { navigate } from '../utils/router.js';
import { renderDlNav, initDlNav } from '../components/DlNav.js';
import { praxen, fetchPraxen } from '../data/praxen.js';

export function renderSearchView() {
  const val = (sessionStorage.getItem('search_query_name') || '').trim().toLowerCase();
  const loc = (sessionStorage.getItem('search_query_location') || '').trim().toLowerCase();

  // Filter matching practices
  const matches = praxen.filter(praxis => {
    const nameMatch = (praxis.name || '').toLowerCase().includes(val);
    const fachbereichMatch = (praxis.fachbereich || '').toLowerCase().includes(val);
    const descMatch = (praxis.beschreibung || '').toLowerCase().includes(val);
    const addrMatch = (praxis.adresse || '').toLowerCase().includes(val);

    const textMatch = val ? (nameMatch || fachbereichMatch || descMatch || addrMatch) : true;
    const locMatch = loc ? (praxis.adresse || '').toLowerCase().includes(loc) : true;
    return textMatch && locMatch;
  });

  let resultsHtml = '';

  if (matches.length === 0) {
    resultsHtml = `
      <div class="dl-profile-card fade-in-up" style="text-align: center; padding: var(--space-12) var(--space-6); background: white; border-radius: var(--radius-xl); border: 1px dashed var(--gray-300); max-width: 600px; margin: var(--space-6) auto 0 auto;">
        <div style="font-size: var(--font-size-4xl); margin-bottom: var(--space-4);">🔍</div>
        <h3 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-2);">Kein Ergebnis gefunden</h3>
        <p class="text-muted" style="max-width: 440px; margin: 0 auto var(--space-4) auto; font-size: var(--font-size-sm); line-height: 1.5;">
          Für Ihre Suche nach ${val ? `<strong>"${val}"</strong>` : ''} ${val && loc ? 'in' : ''} ${loc ? `<strong>"${loc}"</strong>` : ''} konnten wir leider keine passende Arztpraxis finden.
        </p>
        <p class="text-muted" style="font-size: var(--font-size-xs); font-style: italic;">
          Tipp: Versuchen Sie es mit allgemeineren Suchbegriffen oder prüfen Sie die Schreibweise der Stadt.
        </p>
      </div>
    `;
  } else {
    resultsHtml = `
      <div class="dl-practices-grid" style="margin-top: var(--space-8);">
        ${matches.map((praxis, idx) => {
          return `
            <div class="dl-practice-card fade-in-up" style="animation-delay: ${idx * 0.05}s;" data-slug="${praxis.slug}">
              <div class="practice-card-header" style="background: ${praxis.gradient};">
                <div class="practice-card-logo-badge" style="background: white; overflow: hidden; padding: 2px;">
                  ${praxis.logo.includes('.') ? `<img src="${praxis.logo}" style="width: 100%; height: 100%; object-fit: contain;" />` : praxis.logo}
                </div>
              </div>
              <div class="practice-card-body">
                <div style="display: flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2); flex-wrap: wrap;">
                  <span class="practice-card-specialty" style="margin-bottom: 0;">${praxis.fachbereich}</span>
                  <span class="dl-tag" style="background: var(--gray-100); color: var(--gray-600); border: 1px solid var(--gray-200); font-weight: 600; font-size: 10px; padding: 2px 6px; border-radius: 4px; display: inline-block;">⚠️ Demo-Praxis</span>
                </div>
                <h3 class="practice-card-name">${praxis.name}</h3>
                
                <p class="practice-card-desc">${praxis.beschreibung}</p>

                <div class="practice-card-meta-list">
                  <div class="practice-card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>${praxis.adresse}</span>
                  </div>
                  <div class="practice-card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>${praxis.telefon}</span>
                  </div>
                  <div class="practice-card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span class="meta-label-insurance">${praxis.behandlungsarten}</span>
                  </div>
                </div>
              </div>
              <div class="practice-card-footer">
                <button class="practice-card-btn">Termin vereinbaren</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    ${renderDlNav()}

    <div class="dl-page" style="background: var(--bg-gray); min-height: 100vh; padding-bottom: var(--space-12);">
      <div class="dl-page-inner" style="padding-top: var(--space-6);">
        
        <!-- Search Bar Section -->
        <div style="background: white; border-radius: var(--radius-2xl); padding: var(--space-6); box-shadow: var(--shadow-md); border: 1px solid var(--gray-200); margin-bottom: var(--space-8);">
          <h2 style="font-size: var(--font-size-md); font-weight: 700; color: var(--gray-800); margin-bottom: var(--space-4);">Praxis- und Ortssuche</h2>
          
          <div class="dl-home-search" style="box-shadow: none; border: 1px solid var(--gray-200); padding: 6px;">
            <div class="dl-home-search-field" style="flex: 1.5; position: relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="search-praxis-input" placeholder="Arztpraxis, Fachbereich oder Name..." class="dl-home-search-input" value="${val}" autocomplete="off" />
              
              <!-- Autocomplete Dropdown for Praxis -->
              <div class="search-autocomplete-menu" id="search-autocomplete" style="display: none; top: 105%; left: 0; right: 0;">
                <!-- Matches rendered dynamically -->
              </div>
            </div>

            <div class="dl-home-search-field" style="position: relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input type="text" id="search-location-input" placeholder="Düsseldorf, Köln, Essen..." class="dl-home-search-input" value="${loc}" autocomplete="off" />
              
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

        <!-- Header Results Title -->
        <div class="fade-in-up">
          <span style="font-weight: 700; font-size: var(--font-size-xs); color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Suchergebnisse</span>
          <h1 style="font-size: var(--font-size-xl); font-weight: 800; color: var(--gray-800); letter-spacing: -0.02em;">
            ${matches.length} ${matches.length === 1 ? 'Praxis' : 'Praxen'} gefunden
            ${val ? `für <span style="color: var(--primary); font-weight: 700;">"${val}"</span>` : ''}
            ${loc ? `in <span style="color: var(--primary); font-weight: 700;">"${loc}"</span>` : ''}
          </h1>
        </div>

        <!-- Results List -->
        ${resultsHtml}

      </div>
    </div>
  `;
}

export function initSearchView() {
  initDlNav();

  const searchInput = document.getElementById('search-praxis-input');
  const locationInput = document.getElementById('search-location-input');
  const autocompleteMenu = document.getElementById('search-autocomplete');
  const locationMenu = document.getElementById('location-autocomplete');

  if (!searchInput || !locationInput || !autocompleteMenu || !locationMenu) return;

  fetchPraxen().then(() => {
    performSearch();
  });

  const uniqueLocations = [
    'Düsseldorf', 'Köln', 'Essen', 'Duisburg', 'Dortmund', 
    'Münster', 'Bonn', 'Hamburg', 'Konstanz', 'Heidelberg'
  ];

  function performSearch() {
    const val = searchInput.value.trim().toLowerCase();
    const loc = locationInput.value.trim().toLowerCase();

    const matches = praxen.filter(praxis => {
      if (val.length === 0) {
        return loc ? (praxis.adresse || '').toLowerCase().includes(loc) : true;
      }
      const nameMatch = (praxis.name || '').toLowerCase().includes(val);
      const fachbereichMatch = (praxis.fachbereich || '').toLowerCase().includes(val);
      const descMatch = (praxis.beschreibung || '').toLowerCase().includes(val);
      const addrMatch = (praxis.adresse || '').toLowerCase().includes(val);

      const textMatch = nameMatch || fachbereichMatch || descMatch || addrMatch;
      const locMatch = loc ? (praxis.adresse || '').toLowerCase().includes(loc) : true;

      return textMatch && locMatch;
    });

    if (matches.length === 0) {
      autocompleteMenu.innerHTML = `
        <div class="autocomplete-no-results">
          Keine Praxen gefunden
        </div>
      `;
    } else {
      autocompleteMenu.innerHTML = matches.map(praxis => {
        return `
          <div class="autocomplete-item" data-slug="${praxis.slug}">
            <div class="autocomplete-item-logo" style="background: ${praxis.gradient};">
              ${praxis.logo.includes('.') ? `<img src="${praxis.logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />` : praxis.logo}
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

  searchInput.addEventListener('input', performSearch);
  locationInput.addEventListener('input', performLocationSearch);

  searchInput.addEventListener('focus', () => {
    performSearch();
  });
  locationInput.addEventListener('focus', () => {
    if (locationInput.value.trim().length > 0) performLocationSearch();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-praxis-input') && !e.target.closest('#search-autocomplete')) {
      autocompleteMenu.style.display = 'none';
    }
    if (!e.target.closest('#search-location-input') && !e.target.closest('#location-autocomplete')) {
      locationMenu.style.display = 'none';
    }
  });

  autocompleteMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;

    const slug = item.getAttribute('data-slug');
    autocompleteMenu.style.display = 'none';
    navigate(`praxis/${slug}`);
  });

  locationMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.location-item');
    if (!item) return;

    const selectedLoc = item.getAttribute('data-location');
    locationInput.value = selectedLoc;
    locationMenu.style.display = 'none';

    if (searchInput.value.trim().length > 0) {
      performSearch();
    }
  });

  // Re-trigger search submit within search page
  document.getElementById('btn-search-submit')?.addEventListener('click', () => {
    const val = searchInput.value.trim();
    const loc = locationInput.value.trim();

    // If both inputs are empty, do not search!
    if (!val && !loc) return;

    sessionStorage.setItem('search_query_name', val);
    sessionStorage.setItem('search_query_location', loc);

    // Refresh view
    const app = document.getElementById('app');
    app.innerHTML = renderSearchView();
    initSearchView();
  });

  // Clicking result practice card
  document.querySelectorAll('.dl-practice-card').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      navigate(`praxis/${slug}`);
    });
  });
}
