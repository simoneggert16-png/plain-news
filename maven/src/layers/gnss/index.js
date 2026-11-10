import * as Cesium from 'cesium';
import { formatNumber, msg, t } from '../../i18n/index.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../../overlays/worldOverlay.js';
import { createInfoPopover } from '../../ui/conflictInfo.js';
import { translateFeedError } from '../../ui/statusText.js';
import {
  GLOBAL_GNSS_BLOCKADE_ZONES,
  GNSS_LEVEL_COLORS,
  GNSS_MIN_AIRCRAFT,
  GNSS_WINDOW_MS,
  accumulateGnssObservations,
  binGnssCells,
  gnssProvenance,
  pruneGnssObservations,
} from './records.js';
export * from './records.js';
export { createAdsbGnssSource } from './source.js';

function buildGnssCirclePositions(lon, lat, radiusKm, height = 240, segments = 36) {
  const latRad = (lat * Math.PI) / 180;
  const dLat = radiusKm / 111.0;
  const dLon = radiusKm / (111.0 * Math.max(0.2, Math.cos(latRad)));
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(
      Cesium.Cartesian3.fromDegrees(
        lon + Math.cos(angle) * dLon,
        lat + Math.sin(angle) * dLat,
        height,
      ),
    );
  }
  return positions;
}

function formatGnssTimestamp(tsMs, nowMs) {
  const date = new Date(Number.isFinite(tsMs) && tsMs > 0 ? tsMs : nowMs);
  const absStr = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const diffMin = Math.max(0, Math.round((nowMs - date.getTime()) / 60000));
  const relStr =
    diffMin <= 1
      ? 'gerade eben / aktiv'
      : diffMin < 60
        ? `vor ${diffMin} Min.`
        : `vor ${Math.round(diffMin / 60)} Std.`;
  return `${absStr} Uhr (${relStr})`;
}

/**
 * GroundPrimitive allowPicking:false suppresses ids but still submits stencil
 * commands in Cesium's pick pass, erasing picks of overlapping ground geometry.
 * This fill participates only in rendering, so sibling polygons remain pickable.
 */
class GnssGroundFill extends Cesium.GroundPrimitive {
  update(frameState) {
    if (!frameState.passes.pick) super.update(frameState);
  }
}

/** Low stays visible over land so coverage reads apart from no data. */
const FILL_ALPHA = Object.freeze({ low: 0.3, medium: 0.42, high: 0.55 });
const LEVEL_LABELS = Object.freeze({
  low: msg('Low-accuracy score < 2%'),
  medium: msg('Low-accuracy score 2–10%'),
  high: msg('Low-accuracy score > 10%'),
});

/** Degrees at the centre of the current view, or null before the camera settles. */
export function defaultGnssViewAnchor(viewer) {
  const canvas = viewer?.scene?.canvas;
  const ellipsoid = viewer?.scene?.globe?.ellipsoid;
  // At globe scale the visible rectangle can be the whole world, whose
  // midpoint is unrelated to the place under the screen centre.
  const centre =
    canvas?.clientWidth > 0 &&
    canvas.clientHeight > 0 &&
    viewer.camera?.pickEllipsoid?.(
      new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
      ellipsoid,
    );
  const rectangle =
    !centre && viewer?.camera?.computeViewRectangle?.(ellipsoid);
  const carto = centre
    ? (ellipsoid || Cesium.Ellipsoid.WGS84).cartesianToCartographic(centre)
    : rectangle
      ? Cesium.Rectangle.center(rectangle)
      : viewer?.camera?.positionCartographic;
  if (!carto) return null;
  const latitude = Cesium.Math.toDegrees(carto.latitude);
  const longitude = Cesium.Math.toDegrees(carto.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

/**
 * Own one GNSS navigation-integrity display: rolling integrity observations
 * around the views the user visits, binned into cells coloured by the
 * gpsjam low-accuracy score. Share links retain token 3.
 */
export function createGnssIntegrityLayer({
  source,
  viewAnchor = defaultGnssViewAnchor,
  now = () => Date.now(),
  monotonicNow = () => performance.now(),
  windowMs: requestedWindowMs,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('GNSS integrity layer requires a snapshot source');
  // A source may set its own evidence window; anything but a positive finite
  // duration keeps the default.
  const windowMs =
    Number.isFinite(requestedWindowMs) && requestedWindowMs > 0
      ? requestedWindowMs
      : GNSS_WINDOW_MS;
  let _viewer = null;
  let _primitives = null;
  let _dataSource = null;
  let _overlay = null;
  let _popover = null;
  let _clickHandler = null;
  let _request = null;
  let _enabled = false;
  let _cells = [];
  let _signature = null;
  let _lastUpdate = null;
  let _lastError = null;
  let _stale = false;
  let _manager = null;
  let _cameraTimer = null;
  let _backgroundRefresh = null;
  let _lastQueryKey = null;
  let _lastRequestAt = -Infinity;
  let _removeCameraEnd = null;
  let _removeCameraChanged = null;
  let _coverage = null;
  let _retryTimer = null;
  let _retryAt = 0;
  let _failureCount = 0;
  let _showLabels = true;
  const _dismissedIds = new Set();
  let _allOverlayEntries = [];
  let _rowControlsListener = null;
  let _onGlobalLabelsEvent = null;
  const _observations = new Map();
  const provenance = gnssProvenance({ windowMs });

  function syncOverlayEntries() {
    if (!_dataSource) return;
    const visibleEntries = _showLabels
      ? _allOverlayEntries.filter((entry) => !_dismissedIds.has(entry.id))
      : [];
    setOverlaySourceVisible(layer.id, _enabled && _showLabels);
    setOverlayEntries(layer.id, visibleEntries, {
      cohortLimit: 80,
      collisionCapacity: 24,
      moving: false,
    });
    _rowControlsListener?.();
    _viewer?.scene?.requestRender?.();
  }

  function dismissCardById(rawId) {
    if (!rawId) return;
    _dismissedIds.add(String(rawId));
    syncOverlayEntries();
  }

  const queryKey = (anchor) =>
    anchor
      ? `${Math.round(anchor.latitude)},${Math.round(anchor.longitude)}`
      : null;

  function scheduleCameraRefresh() {
    if (!_enabled || !_primitives) return;
    if (now() < _retryAt) return;
    const key = queryKey(viewAnchor(_viewer));
    if (!key || key === _lastQueryKey) return;
    clearTimeout(_cameraTimer);
    // Debounce drags and bound moving/follow cameras to at most 24 requests
    // per minute. Nearby views share the proxy's whole-degree cache key.
    _cameraTimer = setTimeout(
      async () => {
        _cameraTimer = null;
        if (!_enabled || _backgroundRefresh || _request) return;
        const key = queryKey(viewAnchor(_viewer));
        if (!key || key === _lastQueryKey) return;
        await refreshInBackground();
      },
      Math.max(600, 2500 - (monotonicNow() - _lastRequestAt)),
    );
  }

  async function refreshInBackground() {
    if (!_enabled || _backgroundRefresh) return;
    const controller = new AbortController();
    _backgroundRefresh = controller;
    try {
      if (_manager)
        await _manager.refreshLayer(layer.id, { signal: controller.signal });
      else await layer.update(undefined, { signal: controller.signal });
    } finally {
      if (_backgroundRefresh === controller) {
        _backgroundRefresh = null;
        scheduleCameraRefresh();
        scheduleRetry();
      }
    }
  }

  function scheduleRetry() {
    clearTimeout(_retryTimer);
    _retryTimer = null;
    if (!_enabled || !_retryAt) return;
    // Long provider cooldowns keep their full deadline. Browser timers cannot
    // exceed ~24 days, so wake in bounded chunks without fetching early.
    _retryTimer = setTimeout(
      () => {
        _retryTimer = null;
        void refreshInBackground();
      },
      Math.min(2147483647, Math.max(0, _retryAt - now())),
    );
    _retryTimer?.unref?.();
  }

  /** Age the store without new evidence, so expired cells leave the globe. */
  function expire() {
    pruneGnssObservations(_observations, now(), { windowMs });
    _cells = binGnssCells(_observations);
    render();
  }

  function render() {
    // Only the id and band change what is drawn; counts alone do not.
    const signature = JSON.stringify(
      _cells.map(({ id, level }) => [id, level]),
    );
    if (signature === _signature) return;
    _signature = signature;
    _primitives.removeAll();
    if (_cells.length) {
      _primitives.add(
        new GnssGroundFill({
          geometryInstances: _cells.map(
            (cell) =>
              new Cesium.GeometryInstance({
                id: `${layer.id}:${cell.id}`,
                geometry: new Cesium.RectangleGeometry({
                  rectangle: Cesium.Rectangle.fromDegrees(
                    cell.west,
                    cell.south,
                    cell.east,
                    cell.north,
                  ),
                  vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
                }),
                attributes: {
                  color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                    Cesium.Color.fromCssColorString(
                      GNSS_LEVEL_COLORS[cell.level],
                    ).withAlpha(FILL_ALPHA[cell.level]),
                  ),
                },
              }),
          ),
          appearance: new Cesium.PerInstanceColorAppearance({
            flat: true,
            translucent: true,
          }),
          classificationType: Cesium.ClassificationType.BOTH,
          allowPicking: false,
          // Retain the compact rectangle descriptors for inspection, not Entity visualizers.
          releaseGeometryInstances: false,
        }),
      );
    }

    if (_dataSource) {
      _dataSource.entities.removeAll();
      const overlayEntries = [];
      const currentNow = now();
      const timeStr = formatGnssTimestamp(_lastUpdate, currentNow);
      const shortTime = new Date(_lastUpdate || currentNow).toLocaleTimeString(
        'de-DE',
        { hour: '2-digit', minute: '2-digit' },
      );

      GLOBAL_GNSS_BLOCKADE_ZONES.forEach((zone, index) => {
        const ring = buildGnssCirclePositions(
          zone.lon,
          zone.lat,
          zone.radiusKm,
          240,
          36,
        );
        const cssAccent = GNSS_LEVEL_COLORS[zone.level] || '#f85149';
        const zoneColor = Cesium.Color.fromCssColorString(cssAccent);
        const id = `gnss-3d:zone:${zone.id}`;
        const sharedProps = {
          title: `📡 ${zone.name}`,
          timeStr,
          percentStr: `${zone.percentDegraded}% (${zone.degradedPerCell} von ${zone.totalPerCell} Luftfahrzeugen pro Sektor mit GPS-Verlust)`,
          system: zone.system,
          effect: zone.effect,
          theater: zone.theater,
          coords: `${zone.lat.toFixed(2)}°N, ${zone.lon.toFixed(2)}°E · Radius ~${zone.radiusKm} km`,
        };

        _dataSource.entities.add({
          id,
          position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat, 240),
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(ring),
            material: zoneColor.withAlpha(0.18),
            height: 240,
          },
          polyline: {
            positions: ring,
            width: 2.5,
            material: zoneColor.withAlpha(0.92),
          },
          point: {
            pixelSize: 6,
            color: zoneColor,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.85),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.NONE,
            scaleByDistance: new Cesium.NearFarScalar(200_000, 1.0, 16_000_000, 0.42),
            disableDepthTestDistance: 4000,
          },
          properties: sharedProps,
        });

        overlayEntries.push({
          domain: 'infrastructure',
          source: layer.id,
          cardStyle: 'tactical',
          collisionGroup: 'ambient-card',
          edgeFade: 'keyhole',
          horizonCull: true,
          terrainOcclusion: false,
          interactive: true,
          dismissible: true,
          onDismiss: (dismissedId) => dismissCardById(dismissedId || id),
          gapPx: 14,
          leaderOffsetPx: 8,
          verticalOnly: true,
          viewportMargin: 4,
          id,
          position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat, 280),
          variant: 'card',
          title: zone.shortLabel,
          details: [
            zone.system.slice(0, 68),
            `🕒 Stand: ${shortTime} Uhr · Radius ${zone.radiusKm} km`,
          ],
          accent: cssAccent,
          selected: false,
          protected: false,
          priority: 1500 - index,
          maxDistance: 12_000_000,
        });
      });

      _cells.forEach((cell, cellIdx) => {
        if (cell.level === 'low') return;
        const cssAccent = GNSS_LEVEL_COLORS[cell.level];
        const cellColor = Cesium.Color.fromCssColorString(cssAccent);
        const rectRing = [
          Cesium.Cartesian3.fromDegrees(cell.west, cell.south, 210),
          Cesium.Cartesian3.fromDegrees(cell.east, cell.south, 210),
          Cesium.Cartesian3.fromDegrees(cell.east, cell.north, 210),
          Cesium.Cartesian3.fromDegrees(cell.west, cell.north, 210),
          Cesium.Cartesian3.fromDegrees(cell.west, cell.south, 210),
        ];
        const id = `gnss-3d:cell:${cell.id}:${cellIdx}`;
        const sharedProps = {
          // i18n-ignore: tactical German GNSS title
          title: `📡 GPS-Blockade / GNSS-Anomaliezelle (${cell.lat.toFixed(2)}°, ${cell.lon.toFixed(2)}°)`,
          timeStr,
          percentStr: `${cell.percentDegraded}% (${cell.degraded} von ${cell.aircraft} Luftfahrzeugen mit NIC/NACp-Verlust)`,
          system:
            'ADS-B NIC/NACp-Echtzeit-Telemetrie (adsb.lol / GEV Classifier v2)',
          effect:
            cell.level === 'high'
              ? 'Schwere GNSS-Navigationsstörung (> 10% Low-Accuracy-Score) — starker Hinweis auf aktives GPS-Jamming oder Spoofing.'
              : 'Mittlere GNSS-Navigationsstörung (2–10% Low-Accuracy-Score).',
          theater: `Sektor ${cell.id}`,
          coords: `${cell.south.toFixed(1)}°–${cell.north.toFixed(1)}°N, ${cell.west.toFixed(1)}°–${cell.east.toFixed(1)}°E`,
        };
        _dataSource.entities.add({
          id,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(rectRing),
            material: cellColor.withAlpha(cell.level === 'high' ? 0.24 : 0.16),
            height: 210,
          },
          polyline: {
            positions: rectRing,
            width: 1.6,
            material: cellColor.withAlpha(0.82),
          },
          properties: sharedProps,
        });
      });

      _allOverlayEntries = overlayEntries;
      syncOverlayEntries();
    }

    _viewer?.scene?.requestRender?.();
  }

  const layer = {
    id: 'gnss-integrity',
    name: 'GNSS Integrity',
    icon: '📡',
    source: 'adsb.lol',
    /** Where each part of the method comes from; see records.js. */
    provenance,
    updateInterval: 60000,

    attachDataManager(manager) {
      _manager = manager;
    },

    init(viewer) {
      if (_viewer)
        throw new Error('GNSS integrity layer is already initialized');
      _viewer = viewer;
      _primitives = new Cesium.PrimitiveCollection();
      _primitives.id = layer.id;
      _primitives.show = false;
      viewer.scene.groundPrimitives.add(_primitives);
      if (viewer.dataSources && viewer.scene?.primitives) {
        _dataSource = new Cesium.CustomDataSource('gnss-integrity-3d');
        _dataSource.show = false;
        viewer.dataSources.add(_dataSource);
        _popover = createInfoPopover(viewer, {
          prefix: 'gnss-3d:',
          describe: (read, entity) => {
            const entityId = entity?.id || '';
            return {
              // i18n-ignore: tactical German GNSS title
              title: read('title') || '📡 GPS-Blockade / GNSS-Störzone',
              lines: [
                ['Zeitpunkt / Stand', read('timeStr')],
                ['Störrate (NIC/NACp)', read('percentStr')],
                ['EW-System / Quelle', read('system')],
                ['Effekt / Signatur', read('effect')],
                ['Schauplatz', read('theater')],
                ['Koordinaten', read('coords')],
              ],
              cardsVisible: _showLabels,
              onDismissCard:
                _showLabels && entityId
                  ? () => dismissCardById(entityId)
                  : null,
              onToggleAllCards: () => {
                _showLabels = !_showLabels;
                if (_showLabels) _dismissedIds.clear();
                syncOverlayEntries();
              },
            };
          },
        });
      }
      if (typeof window !== 'undefined' && window.addEventListener) {
        _onGlobalLabelsEvent = (ev) => {
          const next =
            typeof ev?.detail?.visible === 'boolean'
              ? ev.detail.visible
              : !_showLabels;
          _showLabels = next;
          if (_showLabels) _dismissedIds.clear();
          syncOverlayEntries();
        };
        window.addEventListener('gev:set-map-labels', _onGlobalLabelsEvent);
      }
      _removeCameraEnd = viewer.camera?.moveEnd?.addEventListener(
        scheduleCameraRefresh,
      );
      _removeCameraChanged = viewer.camera?.changed?.addEventListener(
        scheduleCameraRefresh,
      );
    },

    enable() {
      _enabled = true;
      // Cells left from before a long disable must not reappear past the window.
      if (_primitives) {
        expire();
        _primitives.show = true;
      }
      if (_dataSource) {
        _dataSource.show = true;
        syncOverlayEntries();
      }
    },

    disable() {
      clearTimeout(_cameraTimer);
      _cameraTimer = null;
      clearTimeout(_retryTimer);
      _retryTimer = null;
      _backgroundRefresh?.abort();
      _backgroundRefresh = null;
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_primitives) _primitives.show = false;
      if (_dataSource) {
        _dataSource.show = false;
        setOverlaySourceVisible(layer.id, false);
      }
      _popover?.hide?.();
    },

    async update(_viewerArg, { signal } = {}) {
      if (!_enabled || !_primitives || signal?.aborted) return false;
      if (now() < _retryAt) {
        expire();
        scheduleRetry();
        return true;
      }
      _retryAt = 0;
      clearTimeout(_retryTimer);
      _retryTimer = null;
      const anchor = viewAnchor(_viewer);
      // No anchor yet (camera still settling) is not a failure: returning
      // false would make the manager reject the enable. The next interval
      // retries; cells already drawn still age out of the window.
      if (!anchor) {
        expire();
        return true;
      }
      _request?.abort();
      const request = new AbortController();
      _request = request;
      const onAbort = () => request.abort(signal.reason);
      signal?.addEventListener('abort', onAbort, { once: true });
      _lastQueryKey = queryKey(anchor);
      _lastRequestAt = monotonicNow();
      _coverage = {
        kind: 'regional',
        latitude: Math.round(anchor.latitude),
        longitude: Math.round(anchor.longitude),
        radiusNm: 250,
      };
      let received = false;
      try {
        const snapshot = await source.getSnapshot(anchor, {
          signal: request.signal,
        });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        received = true;
        // Date the rows by when the proxy observed them: a cached or stale
        // replay keeps its original age instead of restarting the window.
        // The proxy reports that age, so client and server clocks never mix.
        const at = now();
        accumulateGnssObservations(_observations, snapshot.rows, at, {
          windowMs,
          observedAt: at - snapshot.ageMs,
        });
        _cells = binGnssCells(_observations);
        render();
        _stale = snapshot.stale === true;
        _lastUpdate = at - snapshot.ageMs;
        _lastError = null;
        _retryAt = 0;
        _failureCount = 0;
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        // A renderer/programming failure remains a real lifecycle failure.
        // Only acquisition failures are kept enabled for recovery.
        if (received) throw e;
        console.warn('[Data:GNSS] Fetch error:', e);
        _lastError = e?.message || msg('GNSS integrity source unavailable');
        // Keep the last cells only while their evidence is inside the window.
        expire();
        if (e?.retryable === false) return false;
        _failureCount = Math.min(3, _failureCount + 1);
        const delay =
          Number.isFinite(e?.retryAfterMs) && e.retryAfterMs > 0
            ? e.retryAfterMs
            : Math.min(120000, 30000 * 2 ** (_failureCount - 1));
        _retryAt = Math.max(
          _retryAt,
          Math.min(Number.MAX_VALUE, now() + delay),
        );
        // Enabling the display succeeded. Stats still report an unavailable
        // or degraded feed; the manager keeps its normal refresh failure lane.
        return true;
      } finally {
        signal?.removeEventListener('abort', onAbort);
        if (_request === request) _request = null;
        scheduleCameraRefresh();
        scheduleRetry();
      }
    },

    destroy(viewer = _viewer) {
      layer.disable();
      _removeCameraEnd?.();
      _removeCameraChanged?.();
      _removeCameraEnd = null;
      _removeCameraChanged = null;
      _popover?.destroy?.();
      _popover = null;
      _allOverlayEntries = [];
      _dismissedIds.clear();
      _rowControlsListener = null;
      if (
        _onGlobalLabelsEvent &&
        typeof window !== 'undefined' &&
        window.removeEventListener
      ) {
        window.removeEventListener('gev:set-map-labels', _onGlobalLabelsEvent);
        _onGlobalLabelsEvent = null;
      }
      if (_dataSource && viewer?.dataSources) {
        clearOverlaySource(layer.id);
        viewer.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _observations.clear();
      _cells = [];
      _signature = null;
      if (_primitives) {
        viewer.scene.groundPrimitives.remove(_primitives);
        _primitives = null;
      }
      _viewer = null;
      _lastUpdate = null;
      _lastError = null;
      _stale = false;
      _coverage = null;
      _retryAt = 0;
      _failureCount = 0;
      _lastQueryKey = null;
      _manager = null;
    },

    setRowControlsListener(listener) {
      _rowControlsListener = typeof listener === 'function' ? listener : null;
    },

    getRowControls() {
      return {
        chips: [
          {
            id: 'toggle-labels',
            // i18n-ignore: tactical German label toggle chip
            label: _showLabels ? '🏷️ Textfelder: AN' : '🏷️ Textfelder: AUS',
            color: _showLabels ? '#38bdf8' : '#64748b',
            title:
              'Textfelder der GPS-Blockaden ein- oder ausblenden (Störzonen bleiben sichtbar)',
            active: _showLabels,
            onClick: () => {
              _showLabels = !_showLabels;
              if (_showLabels) _dismissedIds.clear();
              syncOverlayEntries();
            },
          },
          ...(_showLabels && _dismissedIds.size > 0
            ? [
                {
                  id: 'restore-labels',
                  // i18n-ignore: tactical German label restore chip
                  label: `↺ Ausgeblendete (${_dismissedIds.size})`,
                  color: '#94a3b8',
                  title: 'Einzeln entfernte Textfelder wieder einblenden',
                  active: false,
                  onClick: () => {
                    _dismissedIds.clear();
                    syncOverlayEntries();
                  },
                },
              ]
            : []),
        ],
        info:
          t(
            'Regional sample · 250 nm radius · cells from visited views over {minutes} min',
            { minutes: formatNumber(provenance.window.minutes) },
          ) +
          (_lastError && _retryAt
            ? ` · ${translateFeedError(_lastError)} · ${
                _retryAt <= 8640000000000000
                  ? t('Retrying automatically at {time} UTC', {
                      time: new Date(_retryAt).toISOString().slice(11, 19),
                    })
                  : t('Retrying automatically after provider cooldown')
              }`
            : ''),
        infoTitle: t(
          'Updates automatically after pan or zoom and once a minute. The public feed covers a 250-nautical-mile circle around the view centre; zooming out does not make it a worldwide snapshot. Blank cells are outside sampled coverage or have insufficient observations.',
        ),
        legend: ['high', 'medium', 'low'].map((level, index) => ({
          label: t(LEVEL_LABELS[level]),
          color: GNSS_LEVEL_COLORS[level],
          count: _cells.filter((cell) => cell.level === level).length,
          ...(index === 0
            ? {
                blurb: t(
                  'Low-accuracy score = 100 × max(0, bad − 1) / total: one aircraft is discounted, so this is not the raw share. Cells need {aircraft} aircraft over {minutes} minutes. Navigation-integrity anomalies are not a detection of jamming or spoofing.',
                  {
                    aircraft: formatNumber(GNSS_MIN_AIRCRAFT),
                    minutes: formatNumber(provenance.window.minutes),
                  },
                ),
              }
            : {}),
        })),
      };
    },

    getStats() {
      return {
        count: _cells.length,
        levels: Object.fromEntries(
          ['low', 'medium', 'high'].map((level) => [
            level,
            _cells.filter((cell) => cell.level === level).length,
          ]),
        ),
        lastUpdate: _lastUpdate,
        error: _lastError,
        retryInSec: _retryAt
          ? Math.max(0, Math.ceil((_retryAt - now()) / 1000))
          : null,
        stale: _stale,
        provenance,
        coverage: _coverage,
        // Load-bearing: without an explicit boolean, layerFeedState reads the
        // adsb.lol source name as a flights fallback (src/data/feedState.js).
        fallback: false,
      };
    },
  };
  return layer;
}
