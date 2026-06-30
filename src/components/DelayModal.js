/**
 * DelayModal – Modal für Terminverzögerung
 * Allows doctor to specify delay duration and optional reason, then sends notification to patient.
 */

export function openDelayModal(terminCode, patientName, onComplete) {
  // Remove any existing modal
  const existing = document.getElementById('delay-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'delay-modal-overlay';
  overlay.className = 'delay-modal-overlay';
  overlay.innerHTML = `
    <div class="delay-modal">
      <div class="delay-modal-title">
        ⏰ Termin verzögern
      </div>
      <div class="delay-modal-desc">
        Informieren Sie <strong>${patientName}</strong> per E-Mail über eine Verzögerung des Termins.
      </div>

      <div class="delay-modal-field">
        <label class="delay-modal-label" for="delay-minutes-select">Verzögerung (Minuten)</label>
        <select class="delay-modal-select" id="delay-minutes-select">
          <option value="5">5 Minuten</option>
          <option value="10">10 Minuten</option>
          <option value="15" selected>15 Minuten</option>
          <option value="20">20 Minuten</option>
          <option value="30">30 Minuten</option>
          <option value="45">45 Minuten</option>
          <option value="60">60 Minuten</option>
        </select>
      </div>

      <div class="delay-modal-field">
        <label class="delay-modal-label" for="delay-reason-textarea">Begründung (optional)</label>
        <textarea class="delay-modal-textarea" id="delay-reason-textarea" placeholder="z.B. Notfall bei vorherigem Patienten, technische Verzögerung..."></textarea>
      </div>

      <div class="delay-modal-actions">
        <button class="delay-modal-btn-cancel" id="delay-modal-cancel">Abbrechen</button>
        <button class="delay-modal-btn-send" id="delay-modal-send">
          📧 Benachrichtigung senden
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Cancel button
  document.getElementById('delay-modal-cancel')?.addEventListener('click', () => {
    overlay.remove();
  });

  // Send button
  document.getElementById('delay-modal-send')?.addEventListener('click', async () => {
    const delayMinutes = parseInt(document.getElementById('delay-minutes-select').value, 10);
    const reason = document.getElementById('delay-reason-textarea').value.trim();
    const sendBtn = document.getElementById('delay-modal-send');

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<div class="dl-auth-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:4px;"></div> Wird gesendet...';
    }

    try {
      const res = await fetch(`/api/queue/${terminCode}/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay_minutes: delayMinutes, reason })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Senden');
      }

      overlay.remove();

      // Show success toast
      showDelaySuccessToast(patientName, delayMinutes);

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Delay notification failed:', err);
      alert(err.message || 'Fehler beim Senden der Benachrichtigung.');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '📧 Benachrichtigung senden';
      }
    }
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function showDelaySuccessToast(patientName, minutes) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2000;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: white; padding: 16px 24px; border-radius: 12px;
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
    font-size: 14px; font-weight: 700;
    display: flex; align-items: center; gap: 10px;
    animation: slideUp 0.3s ease-out;
    max-width: 400px;
  `;
  toast.innerHTML = `
    <span style="font-size: 20px;">⏰</span>
    <div>
      <div style="font-weight: 800;">Verzögerung gesendet</div>
      <div style="font-weight: 500; opacity: 0.9; font-size: 12px; margin-top: 2px;">${patientName} wurde über ${minutes} Min. Verzögerung informiert.</div>
    </div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease-out';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
