/**
 * Client-side PIN Gatekeeper & 401 Auto-Unlock Interceptor for God's Eye View.
 *
 * If a tab was already open before GEV_WALL_PIN was enabled (or if the session
 * cookie expired), any `/api/*` request returning 401 automatically opens the
 * 6-digit Security Clearance keypad modal, posts the PIN to `/api/wall`, sets
 * the `gev_wall` cookie, and transparently retries the original fetch request.
 */

let unlockPromise = null;

export function showPinModal() {
  if (unlockPromise) return unlockPromise;

  unlockPromise = new Promise((resolve) => {
    const existing = document.getElementById('pin-gate-modal');
    if (existing) existing.remove();

    if (!document.getElementById('pin-gate-style')) {
      const style = document.createElement('style');
      style.id = 'pin-gate-style';
      style.textContent = `
        #pin-gate-modal {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(10, 10, 15, 0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: var(--font-sans, -apple-system, sans-serif);
          color: #e8eaed;
          transition: opacity 0.35s ease;
        }
        .pin-card {
          background: rgba(18, 20, 32, 0.94);
          border: 1px solid rgba(0, 212, 255, 0.35);
          box-shadow: 0 0 40px rgba(0, 212, 255, 0.16), 0 20px 50px rgba(0, 0, 0, 0.82);
          border-radius: 18px;
          padding: 36px 28px;
          max-width: 420px;
          width: 100%;
          text-align: center;
        }
        .pin-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 212, 255, 0.12);
          border: 1px solid rgba(0, 212, 255, 0.4);
          color: #00d4ff;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          margin-bottom: 18px;
          text-transform: uppercase;
        }
        .pin-card h2 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.06em;
          margin: 0 0 8px;
          color: #f7f8f8;
        }
        .pin-card p {
          font-size: 13px;
          color: rgba(232, 234, 237, 0.65);
          line-height: 1.45;
          margin: 0 auto 24px;
        }
        .pin-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .pin-box {
          width: 44px;
          height: 54px;
          background: rgba(8, 10, 18, 0.85);
          border: 2px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          font-family: var(--font-mono, monospace);
          font-size: 24px;
          font-weight: 700;
          color: #00d4ff;
          text-align: center;
          outline: none;
          transition: all 0.2s ease;
        }
        .pin-box:focus {
          border-color: #00d4ff;
          box-shadow: 0 0 16px rgba(0, 212, 255, 0.5);
          background: rgba(12, 16, 28, 0.95);
        }
        .pin-status {
          min-height: 20px;
          font-size: 12px;
          color: #ff4d4d;
          font-family: var(--font-mono, monospace);
          margin-bottom: 18px;
        }
        .pin-pad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          max-width: 270px;
          margin: 0 auto;
        }
        .pin-pad-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #e8eaed;
          font-family: var(--font-mono, monospace);
          font-size: 20px;
          font-weight: 600;
          padding: 14px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
        }
        .pin-pad-btn:hover {
          background: rgba(0, 212, 255, 0.14);
          border-color: rgba(0, 212, 255, 0.35);
        }
        .pin-pad-btn:active {
          transform: scale(0.95);
          background: #00d4ff;
          color: #0a0a0f;
        }
        .pin-shake {
          animation: pinShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes pinShake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(3px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
          40%, 60% { transform: translate3d(5px, 0, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.id = 'pin-gate-modal';
    // i18n-ignore: German PIN security gate markup
    modal.innerHTML = `
      <div class="pin-card" id="pin-card-inner">
        <div class="pin-badge"><span>🔒</span> SECURITY CLEARANCE</div>
        <h2>GOD'S EYE VIEW</h2>
        <p>Zugangsbeschränkung aktiv. Bitte 6-stelligen Sicherheitscode eingeben, um die Konsole und Live-Feeds freizuschalten.</p>
        <div class="pin-row" id="pin-input-row">
          <input type="password" maxlength="6" class="pin-box" inputmode="numeric" pattern="[0-9]*" autofocus>
          <input type="password" maxlength="1" class="pin-box" inputmode="numeric" pattern="[0-9]*">
          <input type="password" maxlength="1" class="pin-box" inputmode="numeric" pattern="[0-9]*">
          <input type="password" maxlength="1" class="pin-box" inputmode="numeric" pattern="[0-9]*">
          <input type="password" maxlength="1" class="pin-box" inputmode="numeric" pattern="[0-9]*">
          <input type="password" maxlength="1" class="pin-box" inputmode="numeric" pattern="[0-9]*">
        </div>
        <div class="pin-status" id="pin-status-msg"></div>
        <div class="pin-pad">
          <button type="button" class="pin-pad-btn" data-key="1">1</button>
          <button type="button" class="pin-pad-btn" data-key="2">2</button>
          <button type="button" class="pin-pad-btn" data-key="3">3</button>
          <button type="button" class="pin-pad-btn" data-key="4">4</button>
          <button type="button" class="pin-pad-btn" data-key="5">5</button>
          <button type="button" class="pin-pad-btn" data-key="6">6</button>
          <button type="button" class="pin-pad-btn" data-key="7">7</button>
          <button type="button" class="pin-pad-btn" data-key="8">8</button>
          <button type="button" class="pin-pad-btn" data-key="9">9</button>
          <button type="button" class="pin-pad-btn" data-key="C">C</button>
          <button type="button" class="pin-pad-btn" data-key="0">0</button>
          <button type="button" class="pin-pad-btn" data-key="DEL">⌫</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const boxes = Array.from(modal.querySelectorAll('.pin-box'));
    const statusMsg = modal.querySelector('#pin-status-msg');
    const card = modal.querySelector('#pin-card-inner');

    function clearAll() {
      boxes.forEach((b) => {
        b.value = '';
      });
      boxes[0].focus();
    }

    async function trySubmit(rawFetch) {
      const pin = boxes.map((b) => b.value).join('');
      if (pin.length !== 6) return;

      statusMsg.style.color = '#00d4ff';
      // i18n-ignore: German PIN verification status
      statusMsg.textContent = 'VERIFIZIERE CODE...';

      try {
        const res = await rawFetch('/api/wall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ pin }),
          redirect: 'manual',
        });
        const check = await rawFetch('/api/wall', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const statusData = await check.json().catch(() => ({}));
        if (res.ok || res.status === 303 || res.type === 'opaqueredirect' || statusData.status === 'open') {
          statusMsg.style.color = '#00ff88';
          // i18n-ignore: German PIN granted status
          statusMsg.textContent = 'ZUGANG GEWÄHRT.';
          setTimeout(() => {
            modal.style.opacity = '0';
            setTimeout(() => {
              modal.remove();
              unlockPromise = null;
              resolve(true);
            }, 300);
          }, 250);
          return;
        }
      } catch {
        /* fall through */
      }

      statusMsg.style.color = '#ff4d4d';
      // i18n-ignore: German PIN invalid status
      statusMsg.textContent = 'UNGÜLTIGER PIN';
      card.classList.remove('pin-shake');
      void card.offsetWidth;
      card.classList.add('pin-shake');
      clearAll();
    }

    const rawFetch = window.__gevOriginalFetch || window.fetch.bind(window);

    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        const v = box.value.replace(/\D/g, '');
        if (v.length > 1) {
          for (let k = 0; k < v.length && i + k < 6; k++) {
            boxes[i + k].value = v[k];
          }
          boxes[Math.min(5, i + v.length)].focus();
          void trySubmit(rawFetch);
          return;
        }
        box.value = v;
        if (box.value && i < 5) boxes[i + 1].focus();
        void trySubmit(rawFetch);
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          boxes[i - 1].value = '';
          boxes[i - 1].focus();
        }
      });
    });

    modal.querySelectorAll('.pin-pad-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'C') {
          clearAll();
          statusMsg.textContent = '';
        } else if (key === 'DEL') {
          for (let i = 5; i >= 0; i--) {
            if (boxes[i].value) {
              boxes[i].value = '';
              boxes[i].focus();
              break;
            }
          }
        } else {
          const next = boxes.find((b) => !b.value);
          if (next) {
            next.value = key;
            const idx = boxes.indexOf(next);
            if (idx < 5) boxes[idx + 1].focus();
            void trySubmit(rawFetch);
          }
        }
      });
    });

    boxes[0].focus();
  });

  return unlockPromise;
}

export function installPinFetchInterceptor() {
  if (typeof window === 'undefined' || window.__gevOriginalFetch) return;
  const origFetch = window.fetch.bind(window);
  window.__gevOriginalFetch = origFetch;

  window.fetch = async function interceptedFetch(input, init) {
    const res = await origFetch(input, init);
    if (res.status !== 401) return res;

    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.includes('/api/') || url.includes('/api/wall')) return res;

    const unlocked = await showPinModal();
    if (!unlocked) return res;
    return origFetch(input, init);
  };
}
