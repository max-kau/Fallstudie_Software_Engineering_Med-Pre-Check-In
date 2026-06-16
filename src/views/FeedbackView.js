/**
 * FeedbackView
 * Allows patients to rate their visit and submit feedback.
 */

export function renderFeedbackView() {
  return `
    <div class="dl-page" style="background: var(--bg-gray); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-4);">
      <div class="dl-profile-card fade-in-up" style="max-width: 480px; width: 100%; padding: var(--space-8); background: white; border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); border: 1px solid var(--gray-200); text-align: center;">
        
        <div style="font-size: 3rem; margin-bottom: var(--space-4);">⭐</div>
        <h2 style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--gray-800); margin-bottom: var(--space-2); letter-spacing: -0.02em;">Ihre Meinung ist uns wichtig</h2>
        <p class="text-muted" id="feedback-subtitle" style="font-size: var(--font-size-sm); line-height: 1.5; margin-bottom: var(--space-6);">
          Bitte bewerten Sie Ihren kürzlichen Besuch und teilen Sie Ihre Erfahrungen mit uns.
        </p>

        <div id="feedback-form-container">
          <!-- Rating Stars -->
          <div style="display: flex; justify-content: center; gap: var(--space-2); margin-bottom: var(--space-5);">
            <button class="star-btn" data-rating="1" style="font-size: 2.2rem; background: none; border: none; cursor: pointer; color: var(--gray-300); transition: transform 0.1s;">★</button>
            <button class="star-btn" data-rating="2" style="font-size: 2.2rem; background: none; border: none; cursor: pointer; color: var(--gray-300); transition: transform 0.1s;">★</button>
            <button class="star-btn" data-rating="3" style="font-size: 2.2rem; background: none; border: none; cursor: pointer; color: var(--gray-300); transition: transform 0.1s;">★</button>
            <button class="star-btn" data-rating="4" style="font-size: 2.2rem; background: none; border: none; cursor: pointer; color: var(--gray-300); transition: transform 0.1s;">★</button>
            <button class="star-btn" data-rating="5" style="font-size: 2.2rem; background: none; border: none; cursor: pointer; color: var(--gray-300); transition: transform 0.1s;">★</button>
          </div>

          <!-- Feedback Comment -->
          <div style="text-align: left; margin-bottom: var(--space-6);">
            <label style="font-size: var(--font-size-xs); font-weight: 700; color: var(--gray-600); display: block; margin-bottom: 6px;">
              Ihr Kommentar (optional)
            </label>
            <textarea id="feedback-text-input" placeholder="Was hat Ihnen besonders gut gefallen? Was können wir verbessern?"
                      style="width: 100%; min-height: 100px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: var(--space-3); font-size: var(--font-size-sm); resize: vertical; font-family: var(--font-family);"></textarea>
          </div>

          <div id="feedback-error-msg" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-sm); display: none; font-weight: 600; margin-bottom: var(--space-4);"></div>

          <button id="btn-submit-feedback" class="btn btn-primary" style="width: 100%; padding: var(--space-3); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--font-size-sm); cursor: pointer;" disabled>
            Feedback absenden
          </button>
        </div>

        <div id="feedback-success-container" style="display: none;">
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: var(--space-4); border-radius: var(--radius-lg); font-size: var(--font-size-sm); font-weight: 600; line-height: 1.5; margin-bottom: var(--space-6);">
            ✓ Vielen Dank für Ihr Feedback! Ihre Bewertung hilft uns, den Service für Sie und andere Patienten kontinuierlich zu verbessern.
          </div>
          <button id="btn-feedback-go-home" class="btn" style="background: var(--primary); color: white; width: 100%; padding: var(--space-3); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--font-size-sm); cursor: pointer;">
            Zum Patient-Portal
          </button>
        </div>

      </div>
    </div>
  `;
}

export function initFeedbackView() {
  const hash = window.location.hash || '';
  const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
  const urlParams = new URLSearchParams(queryPart);
  const code = urlParams.get('code');

  if (!code) {
    const errorMsg = document.getElementById('feedback-error-msg');
    if (errorMsg) {
      errorMsg.textContent = 'Fehlender Termin-Code. Bitte nutzen Sie den Link aus Ihrer E-Mail.';
      errorMsg.style.display = 'block';
    }
    return;
  }

  let selectedRating = 0;
  const stars = document.querySelectorAll('.star-btn');
  const submitBtn = document.getElementById('btn-submit-feedback');

  stars.forEach(star => {
    star.addEventListener('mouseover', () => {
      const rating = parseInt(star.getAttribute('data-rating'), 10);
      highlightStars(rating);
    });

    star.addEventListener('mouseout', () => {
      highlightStars(selectedRating);
    });

    star.addEventListener('click', () => {
      selectedRating = parseInt(star.getAttribute('data-rating'), 10);
      highlightStars(selectedRating);
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  function highlightStars(rating) {
    stars.forEach(s => {
      const starRating = parseInt(s.getAttribute('data-rating'), 10);
      if (starRating <= rating) {
        s.style.color = '#F59E0B';
        s.style.transform = 'scale(1.15)';
      } else {
        s.style.color = 'var(--gray-300)';
        s.style.transform = 'scale(1.0)';
      }
    });
  }

  submitBtn?.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="dl-auth-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 4px; display: inline-block;"></div>
      Senden...
    `;

    const comment = document.getElementById('feedback-text-input')?.value || '';
    const errorMsg = document.getElementById('feedback-error-msg');
    if (errorMsg) errorMsg.style.display = 'none';

    try {
      const res = await fetch(`/api/termine/${code}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, feedbackText: comment })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Senden des Feedbacks.');

      document.getElementById('feedback-form-container').style.display = 'none';
      document.getElementById('feedback-success-container').style.display = 'block';
      document.getElementById('feedback-subtitle').style.display = 'none';
    } catch (err) {
      console.error(err);
      if (errorMsg) {
        errorMsg.textContent = err.message || 'Verbindung fehlgeschlagen.';
        errorMsg.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Feedback absenden';
    }
  });

  document.getElementById('btn-feedback-go-home')?.addEventListener('click', () => {
    window.location.href = '/#landing';
  });
}
