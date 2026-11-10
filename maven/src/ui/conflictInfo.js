import * as Cesium from 'cesium';
import { t } from '../i18n/index.js';
import { hitTestWorldOverlay } from '../overlays/worldOverlay.js';

/**
 * Click summary for a conflict layer: pick an entity of the layer's data
 * source and show what it is, with a close button, Escape, or a click on empty
 * space dismissing it. Text is inserted as text nodes, never as HTML — the
 * headlines come from the open web.
 *
 * @param {Cesium.Viewer} viewer
 * @param {object} options
 * @param {string} options.prefix Entity-id prefix (e.g. `osint:`).
 * @param {(read:(key:string)=>string, entity:object)=>object} options.describe
 *   Returns `{title, lines: [[label, value], ...], link?: {href, text}}`.
 * @returns {{destroy:Function}}
 */
export function createInfoPopover(viewerOrOptions, maybeOptions = {}) {
  const isOptionsObject =
    viewerOrOptions &&
    typeof viewerOrOptions === 'object' &&
    'viewer' in viewerOrOptions &&
    !('scene' in viewerOrOptions);
  const viewer = isOptionsObject ? viewerOrOptions.viewer : viewerOrOptions;
  const {
    prefix = '',
    describe = null,
    className = '',
    render: customRender = null,
    onClose = null,
  } = isOptionsObject ? viewerOrOptions : maybeOptions;

  const element = document.createElement('div');
  element.className = ['gev-info-popover', className].filter(Boolean).join(' ');
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-live', 'polite');
  document.body.appendChild(element);

  const time = new Cesium.JulianDate();
  let handler = null;
  let escape = null;

  const hide = () => {
    const wasVisible = !element.hidden;
    element.hidden = true;
    if (wasVisible && typeof onClose === 'function') {
      try {
        onClose();
      } catch {
        /* ignore */
      }
    }
  };

  const renderInfoObject = (info, screen) => {
    element.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = info.title || '';
    element.appendChild(title);
    for (const [label, value] of info.lines || []) {
      if (!value) continue;
      const row = document.createElement('div');
      row.className = 'gev-info-row';
      const key = document.createElement('span');
      key.className = 'gev-info-label';
      key.textContent = label;
      const val = document.createElement('span');
      val.textContent = value;
      row.append(key, val);
      element.appendChild(row);
    }
    if (info.link?.href) {
      const link = document.createElement('a');
      link.href = info.link.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = info.link.text || info.link.href;
      element.appendChild(link);
    }

    // Interactive Gemini AI Tactical Briefing & Voice Readout for any facility/event
    if (info.title) {
      const actionsRow = document.createElement('div');
      actionsRow.style.marginTop = '8px';
      actionsRow.style.display = 'flex';
      actionsRow.style.flexDirection = 'column';
      actionsRow.style.gap = '6px';

      const geminiBtn = document.createElement('button');
      geminiBtn.type = 'button';
      // i18n-ignore: tactical German dossier button
      geminiBtn.textContent = '🤖 Gemini-Dossier & Sprach-Briefing';
      geminiBtn.style.cssText =
        'background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.65);color:#6ee7b7;font:600 11px/1.3 var(--font-mono,monospace);padding:5px 8px;border-radius:4px;cursor:pointer;text-align:left;';

      const geminiBox = document.createElement('div');
      geminiBox.hidden = true;
      geminiBox.style.cssText =
        'background:rgba(6,18,26,0.92);border-left:2px solid #10b981;padding:6px 8px;font-size:11px;line-height:1.45;color:#e2f1f8;max-height:180px;overflow-y:auto;white-space:pre-wrap;';

      geminiBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        geminiBtn.disabled = true;
        // i18n-ignore: tactical German dossier status
        geminiBtn.textContent = '⏳ Gemini analysiert Anlage...';
        geminiBox.hidden = false;
        // i18n-ignore: tactical German dossier status
        geminiBox.textContent = 'Erstelle taktisches Dossier über Gemini AI...';
        try {
          const contextLines = (info.lines || [])
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
          const params = new URLSearchParams({
            facility: '1',
            name: info.title,
            place: contextLines,
            lang: 'de',
          });
          const res = await fetch(`/api/person/summary?${params.toString()}`);
          const data = await res.json().catch(() => null);
          const text =
            data?.summary ||
            `${info.title}: Strategische Anlage (${contextLines}).`;
          geminiBox.textContent = text;
          // i18n-ignore: tactical German dossier button
          geminiBtn.textContent = '🔊 Gemini-Briefing vorlesen';
          geminiBtn.disabled = false;
          // Speak briefing via Gemini TTS
          try {
            const ttsRes = await fetch('/api/person/speak', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, lang: 'de' }),
            });
            if (ttsRes.ok) {
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.play().catch(() => {});
            }
          } catch {
            /* ignore audio autoplay blocks */
          }
        } catch {
          // i18n-ignore: tactical German dossier error
          geminiBox.textContent = 'Taktische Zusammenfassung momentan nicht erreichbar.';
          // i18n-ignore: tactical German dossier retry
          geminiBtn.textContent = '🤖 Gemini-Dossier erneut abrufen';
          geminiBtn.disabled = false;
        }
      });

      actionsRow.append(geminiBtn, geminiBox);

      if (
        typeof info.onDismissCard === 'function' ||
        typeof info.onToggleAllCards === 'function'
      ) {
        const labelBtnRow = document.createElement('div');
        labelBtnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

        if (typeof info.onDismissCard === 'function') {
          const dismissBtn = document.createElement('button');
          dismissBtn.type = 'button';
          // i18n-ignore: tactical German label dismiss button
          dismissBtn.textContent = '✕ Textfeld entfernen';
          dismissBtn.style.cssText =
            'background:rgba(239,68,68,0.16);border:1px solid rgba(239,68,68,0.65);color:#fca5a5;font:600 10.5px/1.3 var(--font-mono,monospace);padding:4px 7px;border-radius:4px;cursor:pointer;';
          dismissBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            info.onDismissCard();
            hide();
          });
          labelBtnRow.appendChild(dismissBtn);
        }

        if (typeof info.onToggleAllCards === 'function') {
          const toggleAllBtn = document.createElement('button');
          toggleAllBtn.type = 'button';
          // i18n-ignore: tactical German label toggle button
          toggleAllBtn.textContent = info.cardsVisible === false
            ? '🏷️ Alle Textfelder einblenden'
            : '🏷️ Alle Textfelder ausblenden';
          toggleAllBtn.style.cssText =
            'background:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.55);color:#7dd3fc;font:600 10.5px/1.3 var(--font-mono,monospace);padding:4px 7px;border-radius:4px;cursor:pointer;';
          toggleAllBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            info.onToggleAllCards();
            hide();
          });
          labelBtnRow.appendChild(toggleAllBtn);
        }

        actionsRow.appendChild(labelBtnRow);
      }

      element.appendChild(actionsRow);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'gev-info-close';
    close.textContent = '×';
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', hide);
    element.appendChild(close);

    element.hidden = false;
    const canvas = viewer?.scene?.canvas;
    const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const width = element.offsetWidth || 280;
    const height = element.offsetHeight || 120;
    const sx = Number(screen?.x) || 80;
    const sy = Number(screen?.y) || 80;
    const x = Math.min(
      Math.max(8, rect.left + sx + 14),
      window.innerWidth - width - 8,
    );
    const y = Math.min(
      Math.max(8, rect.top + sy + 14),
      window.innerHeight - height - 8,
    );
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  const render = (entity, screen) => {
    const props = entity.properties;
    const read = (key) => {
      try {
        const value = props?.[key]?.getValue?.(time);
        return value == null ? '' : String(value);
      } catch {
        return '';
      }
    };
    const info = (typeof describe === 'function' ? describe(read, entity) : null) || {};
    renderInfoObject(info, screen);
  };

  const open = (item, screen) => {
    if (typeof customRender === 'function') {
      const rows = customRender(item) || [];
      const lines = rows.map((r) =>
        Array.isArray(r) ? r : [r?.label || '', r?.value || ''],
      );
      renderInfoObject(
        {
          title: item?.name || item?.title || lines[0]?.[1] || '',
          lines,
        },
        screen,
      );
      return;
    }
    if (item && typeof describe === 'function') {
      render(item, screen);
    }
  };

  if (prefix && viewer?.scene?.canvas) {
    try {
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event) => {
        const overlayHit = hitTestWorldOverlay(event.position.x, event.position.y);
        if (
          overlayHit?.id &&
          String(overlayHit.id).startsWith(prefix) &&
          overlayHit.entry?.dismissible &&
          typeof overlayHit.entry.onDismiss === 'function' &&
          overlayHit.rect &&
          event.position.x >= overlayHit.rect.x + overlayHit.rect.w - 28 &&
          event.position.y <= overlayHit.rect.y + 24
        ) {
          overlayHit.entry.onDismiss(overlayHit.entryId || overlayHit.id);
          hide();
          return;
        }
        let picked = viewer.scene.pick(event.position);
        let entity = picked?.id;
        if (!entity || typeof entity.id !== 'string' || !entity.id.startsWith(prefix)) {
          if (overlayHit?.id && String(overlayHit.id).startsWith(prefix)) {
            const sources = viewer.dataSources;
            const len = sources?.length || 0;
            for (let i = 0; i < len; i += 1) {
              const ds = sources.get(i);
              const found = ds?.entities?.getById?.(overlayHit.id);
              if (found) {
                entity = found;
                break;
              }
            }
          }
        }
        if (!entity || typeof entity.id !== 'string' || !entity.id.startsWith(prefix)) {
          hide();
          return;
        }
        render(entity, event.position);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      if (Cesium.ScreenSpaceEventType?.RIGHT_CLICK) {
        handler.setInputAction((event) => {
          const overlayHit = hitTestWorldOverlay(
            event.position.x,
            event.position.y,
          );
          if (
            overlayHit?.id &&
            String(overlayHit.id).startsWith(prefix) &&
            overlayHit.entry?.dismissible &&
            typeof overlayHit.entry.onDismiss === 'function'
          ) {
            overlayHit.entry.onDismiss(overlayHit.entryId || overlayHit.id);
            hide();
          }
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      }
    } catch {
      handler = null;
    }
  }

  escape = (event) => {
    if (event.key === 'Escape') hide();
  };
  document.addEventListener('keydown', escape);

  return {
    open,
    close: hide,
    destroy() {
      handler?.destroy?.();
      document.removeEventListener('keydown', escape);
      element.remove();
    },
  };
}
