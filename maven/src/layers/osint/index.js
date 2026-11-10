import * as Cesium from 'cesium';
import { createInfoPopover } from '../../ui/conflictInfo.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../../overlays/worldOverlay.js';

const msg = (text) => text;

export const OSINT_OVERLAY_SOURCE_ID = 'conflict-osint';

/** Point colour by what the headline says was hit. */
const CATEGORY_COLORS = Object.freeze({
  military: Cesium.Color.fromCssColorString('#ff3b30'),
  energy: Cesium.Color.fromCssColorString('#ff8c00'),
  infrastructure: Cesium.Color.fromCssColorString('#ffd166'),
  other: Cesium.Color.fromCssColorString('#ffd166'),
});

/** Weapon-specific colours for rocket impacts, drone attacks, bombardments, blockades, and carriers. */
const WEAPON_COLORS = Object.freeze({
  missile: Cesium.Color.fromCssColorString('#ff2a55'),
  drone: Cesium.Color.fromCssColorString('#00e5ff'),
  rocket: Cesium.Color.fromCssColorString('#ff7b00'),
  airstrike: Cesium.Color.fromCssColorString('#b48cff'),
  artillery: Cesium.Color.fromCssColorString('#ff9f1c'),
  blockade: Cesium.Color.fromCssColorString('#00d4ff'),
  carrier: Cesium.Color.fromCssColorString('#38bdf8'),
});

const WEAPON_CSS_COLORS = Object.freeze({
  missile: '#ff4d6d',
  drone: '#00e5ff',
  rocket: '#ff8c24',
  airstrike: '#c4a5ff',
  artillery: '#ffb03a',
  blockade: '#00e5ff',
  carrier: '#38bdf8',
  other: '#ffd166',
});

const LAUNCH_ORIGIN_COLOR = Cesium.Color.fromCssColorString('#00f5d4');

const _svgIconCache = new Map();

function getOsintTacticalIcon(kind, hexColor = '#ff4d6d') {
  const key = `${kind}:${hexColor}`;
  if (_svgIconCache.has(key)) return _svgIconCache.get(key);
  let svg = '';
  if (kind === 'warhead') {
    // Sleek supersonic delta-chevron pointing UP (+Y) for 3D alignedAxis along trajectory
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2 L20 20 L12 15.2 L4 20 Z" fill="${hexColor}" stroke="#041019" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M12 4.8 L16.2 16.5 L12 13.8 L7.8 16.5 Z" fill="#ffffff" fill-opacity="0.88"/>
    </svg>`;
  } else if (kind === 'origin') {
    // Tactical launch-site corner brackets + upward emitter chevron
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <rect x="3" y="3" width="14" height="14" fill="#04121a" fill-opacity="0.65"/>
      <path d="M3 7 V3 H7 M13 3 H17 V7 M17 13 V17 H13 M7 17 H3 V13" fill="none" stroke="${hexColor}" stroke-width="1.6"/>
      <path d="M10 6.2 L13.6 13.2 L10 11.4 L6.4 13.2 Z" fill="${hexColor}"/>
    </svg>`;
  } else if (kind === 'naval') {
    // Tactical naval diamond + horizon bar
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <polygon points="11,2.5 19.5,11 11,19.5 2.5,11" fill="#04121a" fill-opacity="0.72" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="6" y1="11" x2="16" y2="11" stroke="${hexColor}" stroke-width="1.4"/>
      <circle cx="11" cy="11" r="2.2" fill="#ffffff"/>
    </svg>`;
  } else {
    // Tactical target impact crosshair reticle
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="6.5" fill="#041018" fill-opacity="0.68" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="12" y1="1.5" x2="12" y2="6.5" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="12" y1="17.5" x2="12" y2="22.5" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="1.5" y1="12" x2="6.5" y2="12" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="17.5" y1="12" x2="22.5" y2="12" stroke="${hexColor}" stroke-width="1.6"/>
      <circle cx="12" cy="12" r="2.2" fill="${hexColor}"/>
    </svg>`;
  }
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  _svgIconCache.set(key, url);
  return url;
}

const WEAPON_TYPE_LABELS = Object.freeze({
  missile: '🚀 Raketen-/Marschflugkörper-Einschlag',
  drone: '🛸 Drohnenangriff (UAV)',
  rocket: '💥 Raketenbeschuss (MLRS)',
  airstrike: '💣 Bombardierung / Luftschlag',
  artillery: '🎯 Artillerie- & Panzerbeschuss',
  blockade: '🚧 Seeblockade / Marine-Sperrzone',
  carrier: '⚓ Flugzeugträger-Kampfgruppe',
  other: '📡 OSINT-Meldung',
});

const WEAPON_SHORT_ICONS = Object.freeze({
  missile: '🚀',
  drone: '🛸',
  rocket: '💥',
  airstrike: '💣',
  artillery: '🎯',
  blockade: '🚧',
  carrier: '⚓',
  other: '📡',
});

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

export function strikeColor(weaponType, category) {
  return WEAPON_COLORS[weaponType] || categoryColor(category);
}

/** Format an ISO timestamp into a concise German date/time + relative age. */
export function formatOsintTimestamp(iso) {
  if (!iso) return 'Aktuell';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return String(iso);
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
  const diffMin = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (diffMin < 60) return `${datePart} (vor ${diffMin} Min.)`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 48) return `${datePart} (vor ${diffHours} Std.)`;
  const diffDays = Math.round(diffHours / 24);
  return `${datePart} (vor ${diffDays} Tg.)`;
}

export function formatShortTimestamp(iso) {
  if (!iso) return 'Live';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const clock = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const diffMin = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (diffMin < 60) return `vor ${diffMin} Min. (${clock})`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 48) return `vor ${diffHours} Std. (${clock})`;
  return clock;
}

/**
 * Build a 3D parabolic trajectory arc between launch origin and impact point.
 * 16 segments keep WebGL geometry ultra-light while forming a smooth 3D curve.
 */
export function buildStrikeArcPositions(
  originLon,
  originLat,
  impactLon,
  impactLat,
  weaponType = 'missile',
  distanceKm = 200,
) {
  const segments = 16;
  const dist = Math.max(25, Number(distanceKm) || 200);
  const peakMeters =
    weaponType === 'missile'
      ? Math.min(180_000, Math.max(30_000, dist * 180))
      : weaponType === 'drone'
        ? Math.min(45_000, Math.max(12_000, dist * 65))
        : Math.min(65_000, Math.max(16_000, dist * 95));
  const positions = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const lon = originLon + (impactLon - originLon) * t;
    const lat = originLat + (impactLat - originLat) * t;
    const alt = 1400 + 4 * t * (1 - t) * peakMeters;
    positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, alt));
  }
  return positions;
}

export function createOsintLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('OSINT layer requires a snapshot source');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _popover = null;
  let _flewToTheater = false;
  let _horizonRecords = [];
  let _removeCameraListener = null;
  let _removePreRenderListener = null;
  let _lastCamPos = null;
  let _showLabels = true;
  const _dismissedIds = new Set();
  let _allOverlayEntries = [];
  let _rowControlsListener = null;
  let _onGlobalLabelsEvent = null;

  function syncOverlayEntries() {
    const visibleEntries = _showLabels
      ? _allOverlayEntries.filter((entry) => !_dismissedIds.has(entry.id))
      : [];
    setOverlaySourceVisible(OSINT_OVERLAY_SOURCE_ID, _enabled && _showLabels);
    setOverlayEntries(OSINT_OVERLAY_SOURCE_ID, visibleEntries, {
      cohortLimit: 36,
      collisionCapacity: 14,
      maxVisible: 12,
      moving: false,
    });
    _rowControlsListener?.();
    _viewer?.scene?.requestRender?.();
  }

  function dismissCardById(rawId) {
    if (!rawId) return;
    const baseId = String(rawId).replace(
      /^osint:(origin|arc|trail|vec1|vec2):/,
      'osint:',
    );
    _dismissedIds.add(baseId);
    _dismissedIds.add(String(rawId));
    syncOverlayEntries();
  }

  function syncHorizonVisibility(force = false) {
    if (!_viewer || !_enabled || !_horizonRecords.length) return;
    const camPos = _viewer.camera?.positionWC;
    if (!camPos) return;
    if (
      force !== true &&
      _lastCamPos &&
      Cesium.Cartesian3.distanceSquared(camPos, _lastCamPos) < 2500
    ) {
      return;
    }
    _lastCamPos = Cesium.Cartesian3.clone(camPos);
    const minSinSq = 0.04 * 0.04;
    let changed = false;
    for (let i = 0; i < _horizonRecords.length; i += 1) {
      const rec = _horizonRecords[i];
      const vx = camPos.x - rec.anchorWC.x;
      const vy = camPos.y - rec.anchorWC.y;
      const vz = camPos.z - rec.anchorWC.z;
      const dot = vx * rec.normal.x + vy * rec.normal.y + vz * rec.normal.z;
      const distSq = vx * vx + vy * vy + vz * vz;
      const shouldShow = dot > 0 && dot * dot > minSinSq * distSq;
      if (rec.entity.show !== shouldShow) {
        rec.entity.show = shouldShow;
        changed = true;
      }
    }
    if (changed && force === true) _viewer.scene?.requestRender?.();
  }

  function addHorizonEntity(entity, lon, lat) {
    _dataSource.entities.add(entity);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      const anchorWC = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
      const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
        anchorWC,
        new Cesium.Cartesian3(),
      );
      _horizonRecords.push({
        entity,
        anchorWC,
        normal,
      });
    }
  }
  let _lastRecords = [];

  const layer = {
    id: 'osint',
    name: 'OSINT reports (Reddit)',
    icon: '🚀',
    source: 'Reddit RSS × gazetteer',
    updateInterval: 2 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('OSINT layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('osint');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _popover = createInfoPopover(viewer, {
        prefix: 'osint:',
        describe: (read, entity) => {
          const weaponType = read('weaponType') || 'other';
          const weaponModel = read('weaponModel');
          const typeBase =
            WEAPON_TYPE_LABELS[weaponType] || WEAPON_TYPE_LABELS.other;
          const typeLabel = weaponModel
            ? `${typeBase} · ${weaponModel}`
            : typeBase;
          const dist = read('distanceKm');
          const entityId = entity?.id || '';
          return {
            title: read('title'),
            lines: [
              ['Zeitpunkt', formatOsintTimestamp(read('updated'))],
              ['Typ', typeLabel],
              ['Ort / Zielraum', read('place')],
              ['Startort / Herkunft', read('originPlace')],
              ['Flugdistanz', dist ? `ca. ${dist} km` : ''],
              ['Zielkategorie', read('target') || read('category')],
              ['Quelle', read('sub')],
            ],
            link: read('url')
              ? { href: read('url'), text: 'Originalmeldung öffnen' }
              : null,
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
      if (viewer.scene?.preRender?.addEventListener) {
        _removePreRenderListener = viewer.scene.preRender.addEventListener(() =>
          syncHorizonVisibility(false),
        );
      }
      if (viewer.camera?.moveEnd?.addEventListener) {
        _removeCameraListener = viewer.camera.moveEnd.addEventListener(() =>
          syncHorizonVisibility(true),
        );
      }
      console.log('[Data:OSINT] Initialized');
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      setOverlaySourceVisible(OSINT_OVERLAY_SOURCE_ID, _showLabels);
      syncHorizonVisibility(true);
      // When the camera is still parked near the default Swiss startup view,
      // pull out over the Middle East & Eastern Europe so the strikes, blockades,
      // and carriers are immediately visible.
      if (!_flewToTheater && _viewer?.camera) {
        const carto = _viewer.camera.positionCartographic;
        const lonDeg = carto ? Cesium.Math.toDegrees(carto.longitude) : 0;
        const height = carto?.height ?? 0;
        if (height < 600_000 && lonDeg < 20) {
          _flewToTheater = true;
          try {
            _viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(35.2, 33.5, 3_200_000),
              duration: 1.8,
            });
          } catch {
            // Ignore in headless test environments
          }
        }
      }
      _viewer?.scene?.requestRender?.();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      clearOverlaySource(OSINT_OVERLAY_SOURCE_ID);
      setOverlaySourceVisible(OSINT_OVERLAY_SOURCE_ID, false);
      _viewer?.scene?.requestRender?.();
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
              'Textfelder auf der Karte ein- oder ausblenden (Einschlagpunkte & Flugbahnen bleiben sichtbar)',
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
        info: 'Klicke auf × im Textfeld (oder Rechtsklick), um einzelne Textfelder zu entfernen, oder schalte alle Textfelder oben ein/aus.',
      };
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        _dataSource.entities.removeAll();
        _horizonRecords = [];
        _lastRecords = [];
        let count = 0;
        const overlayEntries = [];
        const cardPlaces = new Set();

        for (const report of snapshot.reports || []) {
          if (!Number.isFinite(report.lat) || !Number.isFinite(report.lon))
            continue;
          const weaponType = report.weaponType || 'other';
          const baseColor = strikeColor(weaponType, report.category);
          const cssAccent =
            WEAPON_CSS_COLORS[weaponType] || WEAPON_CSS_COLORS.other;
          const isStrike = weaponType !== 'other';
          const entityId = `osint:${count}`;
          const impactPosition = Cesium.Cartesian3.fromDegrees(
            report.lon,
            report.lat,
            250,
          );

          const sharedProps = {
            title: report.title,
            sub: report.sub,
            place: report.place,
            originPlace: report.originPlace || '',
            distanceKm: report.distanceKm ? String(report.distanceKm) : '',
            weaponType,
            weaponModel: report.weaponModel || '',
            target: report.target || '',
            category: report.category || 'other',
            updated: report.updated,
            url: report.url,
          };

          // 1. Tactical vector reticle for strikes/naval, or subtle pip for general OSINT
          const iconScale = new Cesium.NearFarScalar(
            200_000,
            1.0,
            18_000_000,
            0.42,
          );
          if (isStrike) {
            const iconKind =
              weaponType === 'carrier' || weaponType === 'blockade'
                ? 'naval'
                : 'impact';
            addHorizonEntity(
              new Cesium.Entity({
                id: entityId,
                position: impactPosition,
                billboard: {
                  image: getOsintTacticalIcon(iconKind, cssAccent),
                  width: 20,
                  height: 20,
                  scaleByDistance: iconScale,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                properties: sharedProps,
              }),
              report.lon,
              report.lat,
            );
          } else {
            addHorizonEntity(
              new Cesium.Entity({
                id: entityId,
                position: impactPosition,
                point: {
                  pixelSize: 4.5,
                  color: baseColor.withAlpha(0.82),
                  outlineColor: Cesium.Color.fromCssColorString('#041019').withAlpha(0.9),
                  outlineWidth: 0.9,
                  scaleByDistance: new Cesium.NearFarScalar(
                    200_000,
                    1.0,
                    16_000_000,
                    0.35,
                  ),
                  translucencyByDistance: new Cesium.NearFarScalar(
                    1_200_000,
                    0.88,
                    16_000_000,
                    0.24,
                  ),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                properties: sharedProps,
              }),
              report.lon,
              report.lat,
            );
          }

          // Publish a crisp HiDPI worldOverlay tactical card with weapon, origin->target, and timestamp
          const placeKey = `${report.place || ''}:${weaponType}`;
          if (report.place && !cardPlaces.has(placeKey)) {
            cardPlaces.add(placeKey);
            const icon = WEAPON_SHORT_ICONS[weaponType] || '📡';
            const cleanOrigin = report.originPlace
              ? report.originPlace.replace(/\s*\(.*?\)\s*/g, '').trim()
              : '';
            const headlineLabel =
              weaponType === 'carrier' || weaponType === 'blockade'
                ? `${icon} ${report.weaponModel || weaponType.toUpperCase()} · ${report.place}`
                : cleanOrigin
                  ? `${icon} ${cleanOrigin} ➔ ${report.place}`
                  : `${icon} ${report.weaponModel || weaponType.toUpperCase()} ➔ ${report.place}`;
            const detailLine1 = cleanOrigin
              ? `${report.weaponModel || weaponType.toUpperCase()} · Start: ${cleanOrigin} ➔ Ziel: ${report.place}${report.distanceKm ? ` (${report.distanceKm} km)` : ''}`
              : report.target
                ? `Ziel: ${report.target}`
                : report.sub || '';
            const timeLine = `🕒 ${formatShortTimestamp(report.updated)}`;

            overlayEntries.push({
              cardStyle: 'tactical',
              collisionGroup: 'ambient-card',
              edgeFade: 'keyhole',
              horizonCull: true,
              terrainOcclusion: false,
              interactive: true,
              gapPx: 14,
              leaderOffsetPx: 8,
              verticalOnly: true,
              viewportMargin: 4,
              id: entityId,
              position: impactPosition,
              variant: 'card',
              title: headlineLabel,
              details: [detailLine1, timeLine].filter(Boolean),
              accent: cssAccent,
              selected: false,
              protected: false,
              dismissible: true,
              onDismiss: (dismissedId) => dismissCardById(dismissedId || entityId),
              priority:
                (weaponType === 'carrier' || weaponType === 'blockade'
                  ? 1200
                  : isStrike
                    ? 1000
                    : 600) - count,
              maxDistance: 9_000_000,
            });
          }

          // 2. Launch origin bracket, directional arrowhead arc, and 3D-aligned warhead chevrons
          if (
            Number.isFinite(report.originLat) &&
            Number.isFinite(report.originLon)
          ) {
            const originPosition = Cesium.Cartesian3.fromDegrees(
              report.originLon,
              report.originLat,
              250,
            );
            addHorizonEntity(
              new Cesium.Entity({
                id: `osint:origin:${count}`,
                position: originPosition,
                billboard: {
                  image: getOsintTacticalIcon('origin', '#00f5d4'),
                  width: 17,
                  height: 17,
                  scaleByDistance: new Cesium.NearFarScalar(
                    200_000,
                    0.95,
                    18_000_000,
                    0.38,
                  ),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                properties: sharedProps,
              }),
              report.originLon,
              report.originLat,
            );

            const arcPositions = buildStrikeArcPositions(
              report.originLon,
              report.originLat,
              report.lon,
              report.lat,
              weaponType,
              report.distanceKm,
            );
            const midLon = (report.originLon + report.lon) / 2;
            const midLat = (report.originLat + report.lat) / 2;
            const glowMat = new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.22,
              taperPower: 0.7,
              color: baseColor.withAlpha(0.55),
            });
            addHorizonEntity(
              new Cesium.Entity({
                id: `osint:trail:${count}`,
                polyline: {
                  positions: arcPositions,
                  width: 2.2,
                  arcType: Cesium.ArcType.NONE,
                  material: glowMat,
                },
                properties: sharedProps,
              }),
              midLon,
              midLat,
            );
            const arrowMat = new Cesium.PolylineArrowMaterialProperty(
              baseColor.withAlpha(0.98),
            );
            addHorizonEntity(
              new Cesium.Entity({
                id: `osint:arc:${count}`,
                polyline: {
                  positions: arcPositions,
                  width: weaponType === 'missile' ? 11 : 9,
                  arcType: Cesium.ArcType.NONE,
                  material: arrowMat,
                },
                properties: sharedProps,
              }),
              midLon,
              midLat,
            );

            // Place two 3D-oriented warhead chevrons along the trajectory pointing Origin -> Impact
            const warheadIcon = getOsintTacticalIcon('warhead', cssAccent);
            for (const [tag, segIdx] of [
              ['vec1', 7],
              ['vec2', 12],
            ]) {
              const pPrev = arcPositions[Math.max(0, segIdx - 1)];
              const pCurr = arcPositions[segIdx];
              const pNext =
                arcPositions[Math.min(arcPositions.length - 1, segIdx + 1)];
              if (!pPrev || !pCurr || !pNext) continue;
              const tangent = Cesium.Cartesian3.subtract(
                pNext,
                pPrev,
                new Cesium.Cartesian3(),
              );
              if (Cesium.Cartesian3.magnitudeSquared(tangent) <= 1e-6) continue;
              Cesium.Cartesian3.normalize(tangent, tangent);
              addHorizonEntity(
                new Cesium.Entity({
                  id: `osint:${tag}:${count}`,
                  position: pCurr,
                  billboard: {
                    image: warheadIcon,
                    width: 16,
                    height: 16,
                    alignedAxis: tangent,
                    scaleByDistance: new Cesium.NearFarScalar(
                      200_000,
                      1.0,
                      18_000_000,
                      0.45,
                    ),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  },
                  properties: sharedProps,
                }),
                midLon,
                midLat,
              );
            }
          }

          count += 1;
          _lastRecords.push({
            id: entityId,
            title: report.title || '',
            place: report.place || '',
            lat: report.lat,
            lon: report.lon,
            originPlace: report.originPlace || '',
            originLat: Number.isFinite(report.originLat) ? report.originLat : null,
            originLon: Number.isFinite(report.originLon) ? report.originLon : null,
            distanceKm: Number.isFinite(report.distanceKm) ? report.distanceKm : null,
            weaponType,
            weaponModel: report.weaponModel || '',
            target: report.target || '',
            category: report.category || 'other',
            updated: report.updated || '',
            hasTrajectory:
              Number.isFinite(report.originLat) &&
              Number.isFinite(report.originLon),
          });
        }

        _lastCamPos = null;
        syncHorizonVisibility(true);
        _allOverlayEntries = overlayEntries;
        _count = count;
        _lastUpdate = Date.now();
        _lastError = null;
        syncOverlayEntries();
        console.log(`[Data:OSINT] Updated: ${_count} located reports`);
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:OSINT] Fetch error:', error);
        _lastError = error?.message || msg('OSINT source unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      clearOverlaySource(OSINT_OVERLAY_SOURCE_ID);
      setOverlaySourceVisible(OSINT_OVERLAY_SOURCE_ID, false);
      _popover?.destroy();
      _popover = null;
      _request?.abort();
      _request = null;
      _viewer = null;
      _enabled = false;
      _allOverlayEntries = [];
      _dismissedIds.clear();
      _rowControlsListener = null;
      _horizonRecords = [];
      if (
        _onGlobalLabelsEvent &&
        typeof window !== 'undefined' &&
        window.removeEventListener
      ) {
        window.removeEventListener('gev:set-map-labels', _onGlobalLabelsEvent);
        _onGlobalLabelsEvent = null;
      }
      if (_removePreRenderListener) {
        _removePreRenderListener();
        _removePreRenderListener = null;
      }
      if (_removeCameraListener) {
        _removeCameraListener();
        _removeCameraListener = null;
      }
      if (_dataSource) {
        viewer.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _lastError,
        source: 'Reddit / Telegram OSINT',
        coverage: 'Raketen, Drohnen, Bombardierungen, Seeblockaden & Träger',
      };
    },

    getAnalystRecords(limit = 50) {
      return _lastRecords.slice(0, Math.max(1, limit));
    },
  };
  return layer;
}
