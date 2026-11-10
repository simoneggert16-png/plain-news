import * as Cesium from 'cesium';
import { createInfoPopover } from '../../ui/conflictInfo.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../../overlays/worldOverlay.js';
import { formatOsintTimestamp, formatShortTimestamp } from '../osint/index.js';

const msg = (text) => text;

export const FRONTLINE_OVERLAY_SOURCE_ID = 'conflict-frontline';

const _frontlineSvgCache = new Map();

function getFrontlineTacticalIcon(kind, hexColor = '#60a5fa') {
  const key = `${kind}:${hexColor}`;
  if (_frontlineSvgCache.has(key)) return _frontlineSvgCache.get(key);
  let svg = '';
  if (kind === 'carrier') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <polygon points="11,2 20,11 11,20 2,11" fill="#04121a" fill-opacity="0.76" stroke="${hexColor}" stroke-width="1.6"/>
      <line x1="6" y1="11" x2="16" y2="11" stroke="${hexColor}" stroke-width="1.5"/>
      <circle cx="11" cy="11" r="2.2" fill="#ffffff"/>
    </svg>`;
  } else if (kind === 'air_defense') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="6.5" fill="#04121a" fill-opacity="0.72" stroke="${hexColor}" stroke-width="1.5"/>
      <path d="M5.5 11.5 A4.5 4.5 0 0 1 14.5 11.5" fill="none" stroke="${hexColor}" stroke-width="1.4"/>
      <circle cx="10" cy="10" r="1.8" fill="${hexColor}"/>
    </svg>`;
  } else if (kind === 'missile_site') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <polygon points="10,2.5 17.5,16.5 2.5,16.5" fill="#04121a" fill-opacity="0.72" stroke="${hexColor}" stroke-width="1.5"/>
      <circle cx="10" cy="11.8" r="2" fill="${hexColor}"/>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="3.5" y="3.5" width="11" height="11" fill="#04121a" fill-opacity="0.72" stroke="${hexColor}" stroke-width="1.4"/>
      <circle cx="9" cy="9" r="2" fill="${hexColor}"/>
    </svg>`;
  }
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  _frontlineSvgCache.set(key, url);
  return url;
}

/** Colour per strategic/conflict category. */
const AREA_COLORS = Object.freeze({
  occupied: Cesium.Color.fromCssColorString('#ff4d4d'),
  unknown: Cesium.Color.fromCssColorString('#ffb84d'),
  territory: Cesium.Color.fromCssColorString('#b48cff'),
  front: Cesium.Color.fromCssColorString('#ff5733'),
  blockade: Cesium.Color.fromCssColorString('#00e5ff'),
  carrier: Cesium.Color.fromCssColorString('#38bdf8'),
  air_defense: Cesium.Color.fromCssColorString('#10b981'),
  missile_site: Cesium.Color.fromCssColorString('#f97316'),
  bunker: Cesium.Color.fromCssColorString('#eab308'),
  military_base: Cesium.Color.fromCssColorString('#60a5fa'),
  research: Cesium.Color.fromCssColorString('#e879f9'),
});

const AREA_CSS_COLORS = Object.freeze({
  occupied: '#ff5c5c',
  unknown: '#ffb84d',
  territory: '#c49cff',
  front: '#ff6b4a',
  blockade: '#00e5ff',
  carrier: '#38bdf8',
  air_defense: '#10b981',
  missile_site: '#f97316',
  bunker: '#eab308',
  military_base: '#60a5fa',
  research: '#e879f9',
});

const KIND_STATUS_LABELS = Object.freeze({
  occupied: 'Besetztes Gebiet / Aktive Kampfzone',
  front: '⚔️ Aktive Front- & Kontaktlinie',
  unknown: 'Umstrittene Zone / Sicherheitssektor',
  territory: 'Strategischer Sektor / Pufferzone',
  blockade: '🚧 Seeblockade / Maritime Sperrzone',
  carrier: '⚓ Flugzeugträger-Kampfgruppe (CSG)',
  air_defense: '🛡️ Luftabwehrstellung (Iron Dome / SAM / ABM)',
  missile_site: '🚀 Raketenabschuss-Standort & ICBM-Silo',
  bunker: '🏰 Bunker & Unterirdische Kommandozentrale',
  military_base: '🏛️ Strategische Militärbasis',
  research: '🧬 Militär-Forschung, Rüstung & Biowaffen-/Nuklearlabor',
});

const FILTER_CHIPS = Object.freeze([
  {
    id: 'all',
    // i18n-ignore: tactical German filter chip
    label: 'Alle',
    // i18n-ignore: tactical German filter tooltip
    title: 'Alle Frontlinien, Luftabwehrstellungen, Bunker, Silos, Basen & Forschungslabore anzeigen',
  },
  {
    id: 'air_defense',
    // i18n-ignore: tactical German filter chip
    label: '🛡️ Luftabwehr & Iron Dome',
    color: '#10b981',
    // i18n-ignore: tactical German filter tooltip
    title: 'Weltweite Luftabwehrstellungen, Iron Dome, Arrow-3, Patriot, THAAD & S-400 anzeigen',
  },
  {
    id: 'missile_site',
    // i18n-ignore: tactical German filter chip
    label: '🚀 Raketen-Silos & Startbasen',
    color: '#f97316',
    // i18n-ignore: tactical German filter tooltip
    title: 'Weltweite Raketenabschuss-Standorte, ICBM-Silofelder & Untergrund-Raketenstädte anzeigen',
  },
  {
    id: 'bunker',
    // i18n-ignore: tactical German filter chip
    label: '🏰 Bunker & Kommandos',
    color: '#eab308',
    // i18n-ignore: tactical German filter tooltip
    title: 'Weltweite Atombunker, Regierungsbunker & unterirdische Kommandozentralen anzeigen',
  },
  {
    id: 'military_base',
    // i18n-ignore: tactical German filter chip
    label: '🏛️ Militärbasen & Träger',
    color: '#38bdf8',
    // i18n-ignore: tactical German filter tooltip
    title: 'Strategische Militärbasen & Flugzeugträger-Kampfgruppen weltweit anzeigen',
  },
  {
    id: 'research',
    // i18n-ignore: tactical German filter chip
    label: '🧬 Forschung, Lockheed & Biowaffen',
    color: '#e879f9',
    // i18n-ignore: tactical German filter tooltip
    title: 'Lockheed Martin Skunk Works, Area 51, BSL-4 Biowaffen-Forschung & Nuklearlabore anzeigen',
  },
  {
    id: 'front',
    // i18n-ignore: tactical German filter chip
    label: '⚔️ Front & Seeblockaden',
    color: '#ff6b4a',
    // i18n-ignore: tactical German filter tooltip
    title: 'Aktive Frontlinien (Gaza, Libanon, Jemen, Ukraine) & Seeblockaden anzeigen',
  },
]);

function matchesFilter(kind, activeFilter) {
  if (!activeFilter || activeFilter === 'all') return true;
  if (activeFilter === 'front_only')
    return (
      kind === 'front' ||
      kind === 'occupied' ||
      kind === 'unknown' ||
      kind === 'territory'
    );
  if (activeFilter === 'naval')
    return kind === 'blockade' || kind === 'carrier';
  if (activeFilter === 'front')
    return (
      kind === 'front' ||
      kind === 'blockade' ||
      kind === 'occupied' ||
      kind === 'unknown' ||
      kind === 'territory'
    );
  if (activeFilter === 'military_base')
    return kind === 'military_base';
  return kind === activeFilter;
}

const sharedSnapshotCache = new WeakMap();

async function getSharedSnapshot(source, signal) {
  const entry = sharedSnapshotCache.get(source);
  const now = Date.now();
  if (entry?.data && now - entry.at < 60_000) return entry.data;
  if (entry?.promise) return entry.promise;
  const promise = source
    .getSnapshot({ signal })
    .then((data) => {
      sharedSnapshotCache.set(source, { data, at: Date.now(), promise: null });
      return data;
    })
    .catch((err) => {
      sharedSnapshotCache.delete(source);
      throw err;
    });
  sharedSnapshotCache.set(source, { data: entry?.data || null, at: entry?.at || 0, promise });
  return promise;
}

/**
 * Classify area kind from feature properties or bilingual DeepState name.
 */
export function classifyFrontlineArea(name, explicitKind = '') {
  const k = String(explicitKind || '').toLowerCase();
  if (k && AREA_COLORS[k]) return k;
  const text = String(name || '').toLowerCase();
  if (text.includes('seeblockade') || text.includes('blockade'))
    return 'blockade';
  if (
    text.includes('iron dome') ||
    text.includes('patriot') ||
    text.includes('thaad') ||
    text.includes('s-400') ||
    text.includes('luftabwehr')
  )
    return 'air_defense';
  if (
    text.includes('raketenbasis') ||
    text.includes('silofeld') ||
    text.includes('icbm')
  )
    return 'missile_site';
  if (text.includes('bunker') || text.includes('untergrund-kommando'))
    return 'bunker';
  if (
    text.includes('lockheed') ||
    text.includes('skunk works') ||
    text.includes('biowaffen') ||
    text.includes('bsl-4') ||
    text.includes('forschungs')
  )
    return 'research';
  if (
    text.includes('cvn-') ||
    text.includes('lhd-') ||
    text.includes('carrier') ||
    text.includes('flugzeugträger')
  )
    return 'carrier';
  if (
    text.includes('contact line') ||
    text.includes('front line') ||
    text.includes('frontlinie')
  )
    return 'front';
  if (text.includes('geojson.territories.')) return 'territory';
  if (text.includes('unknown status')) return 'unknown';
  if (text.includes('occupied')) return 'occupied';
  return 'territory';
}

/** Build a 3D polyline or polygon ring at fixed height (no GroundPrimitive stencil lag). */
function ringPositions(ring, maxPoints = 96, heightMeters = 80) {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  const step =
    ring.length > maxPoints
      ? Math.max(1, Math.floor(ring.length / maxPoints))
      : 1;
  const flat = [];
  for (let i = 0; i < ring.length; i += step) {
    const point = ring[i];
    const lon = Number(point?.[0]);
    const lat = Number(point?.[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat))
      flat.push(lon, lat, heightMeters);
  }
  if (step > 1 && ring.length > 1) {
    const last = ring[ring.length - 1];
    const lon = Number(last?.[0]);
    const lat = Number(last?.[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat))
      flat.push(lon, lat, heightMeters);
  }
  return flat.length >= 6
    ? Cesium.Cartesian3.fromDegreesArrayHeights(flat)
    : null;
}

/** Build a smooth 36-segment circular radar/defense dome or perimeter ring. */
function buildTacticalCirclePositions(
  lon,
  lat,
  radiusKm = 55,
  segments = 36,
  heightMeters = 160,
) {
  const dLat = radiusKm / 111;
  const dLon =
    radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const flat = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    flat.push(
      lon + Math.cos(angle) * dLon,
      lat + Math.sin(angle) * dLat,
      heightMeters,
    );
  }
  return Cesium.Cartesian3.fromDegreesArrayHeights(flat);
}

/** Every ring of a Polygon / MultiPolygon geometry. */
function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/** Every line of a LineString / MultiLineString geometry. */
function geometryLines(geometry) {
  if (geometry?.type === 'LineString') return [geometry.coordinates];
  if (geometry?.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

/**
 * Front lines, maritime blockades, aircraft carriers, air defense (Iron Dome / SAMs),
 * missile launch sites & ICBM silos, underground bunkers, military bases, and
 * defense / bioweapons / nuclear research facilities worldwide.
 */
export function createFrontlineLayer({
  source,
  id: layerId = 'frontline',
  name: layerName = 'Front line & occupied areas',
  icon: layerIcon = '⚔️',
  sourceLabel = 'DeepState & Strategische Militär-DB',
  coverage: layerCoverage = 'Weltweite Konfliktgebiete, Frontlinien & strategische Militärinfrastruktur',
  fixedFilter = null,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Front line requires a snapshot source');
  const overlaySourceId =
    layerId === 'frontline'
      ? FRONTLINE_OVERLAY_SOURCE_ID
      : `conflict-${layerId}`;
  const entityPrefix = `${layerId}:`;
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _popover = null;
  let _lastSnapshot = null;
  let _activeFilter = fixedFilter || 'all';
  let _rowControlsListener = null;
  let _countsByKind = {};
  let _horizonRecords = [];
  let _removeCameraListener = null;
  let _removePreRenderListener = null;
  let _lastCamPos = null;
  let _showLabels = true;
  const _dismissedIds = new Set();
  let _allOverlayEntries = [];
  let _onGlobalLabelsEvent = null;

  function syncOverlayEntries() {
    const visibleEntries = _showLabels
      ? _allOverlayEntries.filter((entry) => !_dismissedIds.has(entry.id))
      : [];
    setOverlaySourceVisible(overlaySourceId, _enabled && _showLabels);
    setOverlayEntries(overlaySourceId, visibleEntries, {
      cohortLimit: 64,
      collisionCapacity: 14,
      maxVisible: 12,
      moving: false,
    });
    _rowControlsListener?.();
    _viewer?.scene?.requestRender?.();
  }

  function dismissCardById(rawId) {
    if (!rawId) return;
    const baseId = String(rawId)
      .replace(/:ring$/, '')
      .replace(/:inner-ring$/, '')
      .replace(/:outline:\d+$/, '');
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

  function anchorAndNormalForLonLat(lon, lat) {
    const anchorWC = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
      anchorWC,
      new Cesium.Cartesian3(),
    );
    return { anchorWC, normal };
  }

  function rebuildFromSnapshot(snapshot) {
    if (!_dataSource || !snapshot?.features) return;
    const entities = [];
    const horizonRecords = [];
    const pushEntity = (entity, lon, lat) => {
      entities.push(entity);
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        const { anchorWC, normal } = anchorAndNormalForLonLat(lon, lat);
        horizonRecords.push({
          entity,
          anchorWC,
          normal,
        });
      }
    };
    const overlayEntries = [];
    let count = 0;
    const counts = {
      air_defense: 0,
      missile_site: 0,
      bunker: 0,
      military_base: 0,
      research: 0,
      front: 0,
      naval: 0,
    };
    const defaultUpdated = snapshot.updatedAt || new Date().toISOString();

    snapshot.features.forEach((feature, index) => {
      const props = feature?.properties || {};
      const rawName = String(props.name || '');
      const cleanName = rawName.split('///')[0].trim();
      const kind = classifyFrontlineArea(rawName, props.kind);

      if (kind === 'air_defense') counts.air_defense += 1;
      else if (kind === 'missile_site') counts.missile_site += 1;
      else if (kind === 'bunker') counts.bunker += 1;
      else if (kind === 'military_base') counts.military_base += 1;
      else if (kind === 'carrier' || kind === 'blockade') counts.naval += 1;
      else if (kind === 'research') counts.research += 1;
      else counts.front += 1;

      if (!matchesFilter(kind, _activeFilter)) return;

      const color = AREA_COLORS[kind] || AREA_COLORS.territory;
      const cssAccent = AREA_CSS_COLORS[kind] || AREA_CSS_COLORS.territory;
      const updatedAt = props.updatedAt || defaultUpdated;
      const theater = props.theater || '';
      const details = props.details || '';
      const radiusKm = Number(props.radiusKm) || 0;
      const sharedProps = {
        areaName: rawName,
        kind,
        theater,
        details,
        radiusKm,
        updatedAt,
      };

      // 1. Point feature (Air Defense / Iron Dome, Missile Site / Silo, Bunker, Military Base, Research Lab, Carrier)
      if (feature?.geometry?.type === 'Point') {
        const lon = Number(feature.geometry.coordinates?.[0]);
        const lat = Number(feature.geometry.coordinates?.[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        count += 1;
        const id = `${entityPrefix}pt:${kind}:${index}:${count}`;
        const pos = Cesium.Cartesian3.fromDegrees(lon, lat, 180);

        const iconSize =
          kind === 'carrier'
            ? 20
            : kind === 'air_defense' ||
                kind === 'missile_site' ||
                kind === 'research'
              ? 18
              : 16;

        pushEntity(
          new Cesium.Entity({
            id,
            position: pos,
            billboard: {
              image: getFrontlineTacticalIcon(kind, cssAccent),
              width: iconSize,
              height: iconSize,
              scaleByDistance: new Cesium.NearFarScalar(
                200_000,
                1.0,
                18_000_000,
                0.38,
              ),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: sharedProps,
          }),
          lon,
          lat,
        );

        // Tactical rings for Air Defense, Carrier Strike Groups, and Missile Silos
        if (
          kind === 'air_defense' ||
          kind === 'carrier' ||
          kind === 'missile_site'
        ) {
          const domeRadiusKm =
            kind === 'missile_site'
              ? 14
              : radiusKm > 0
                ? Math.min(75, radiusKm)
                : kind === 'carrier'
                  ? 95
                  : 42;
          const ringPos = buildTacticalCirclePositions(
            lon,
            lat,
            domeRadiusKm,
            36,
            420,
          );
          const ringMat = color.withAlpha(
            kind === 'missile_site' ? 0.82 : 0.72,
          );
          pushEntity(
            new Cesium.Entity({
              id: `${id}:ring`,
              polyline: {
                positions: ringPos,
                width: kind === 'missile_site' ? 2.2 : 2.0,
                arcType: Cesium.ArcType.NONE,
                material: ringMat,
              },
              properties: sharedProps,
            }),
            lon,
            lat,
          );

          if (kind === 'air_defense') {
            const innerRingPos = buildTacticalCirclePositions(
              lon,
              lat,
              Math.max(8, domeRadiusKm * 0.34),
              28,
              420,
            );
            const innerMat = color.withAlpha(0.88);
            pushEntity(
              new Cesium.Entity({
                id: `${id}:inner-ring`,
                polyline: {
                  positions: innerRingPos,
                  width: 2.2,
                  arcType: Cesium.ArcType.NONE,
                  material: innerMat,
                },
                properties: sharedProps,
              }),
              lon,
              lat,
            );
          }
        }

        const basePriority =
          _activeFilter !== 'all'
            ? 2000 - index
            : kind === 'carrier'
              ? 1450
              : kind === 'air_defense'
                ? 1420
                : kind === 'missile_site'
                  ? 1390
                  : kind === 'research'
                    ? 1370
                    : kind === 'bunker'
                      ? 1350
                      : 1320;

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
          id,
          position: pos,
          variant: 'card',
          title: cleanName,
          details: [
            theater
              ? `${KIND_STATUS_LABELS[kind] || kind} · ${theater}`
              : details.slice(0, 72),
            `🕒 Stand: ${formatShortTimestamp(updatedAt)}`,
          ].filter(Boolean),
          accent: cssAccent,
          selected: false,
          protected: false,
          dismissible: true,
          onDismiss: (dismissedId) => dismissCardById(dismissedId || id),
          priority: basePriority - (index % 80),
          maxDistance: 14_000_000,
        });
        return;
      }

      // 2. Contact line / Front line (LineString / MultiLineString)
      const lines = geometryLines(feature?.geometry);
      if (lines.length) {
        const lineLat = Number(props.labelLat) || Number(lines[0]?.[0]?.[1]);
        const lineLon = Number(props.labelLon) || Number(lines[0]?.[0]?.[0]);
        for (const line of lines) {
          const positions = ringPositions(line, 96, 360);
          if (!positions) continue;
          count += 1;
          const glowMat = color.withAlpha(0.36);
          const coreMat = color.withAlpha(0.96);
          pushEntity(
            new Cesium.Entity({
              id: `${entityPrefix}glow:${index}:${count}`,
              polyline: {
                positions,
                width: 6.5,
                arcType: Cesium.ArcType.NONE,
                material: glowMat,
              },
              properties: sharedProps,
            }),
            lineLon,
            lineLat,
          );
          pushEntity(
            new Cesium.Entity({
              id: `${entityPrefix}line:${index}:${count}`,
              polyline: {
                positions,
                width: 2.6,
                arcType: Cesium.ArcType.NONE,
                material: coreMat,
              },
              properties: sharedProps,
            }),
            lineLon,
            lineLat,
          );
        }
        if (
          Number.isFinite(props.labelLat) &&
          Number.isFinite(props.labelLon)
        ) {
          const id = `${entityPrefix}line-label:${index}`;
          const labelPos = Cesium.Cartesian3.fromDegrees(
            Number(props.labelLon),
            Number(props.labelLat),
            180,
          );
          pushEntity(
            new Cesium.Entity({
              id,
              position: labelPos,
              point: {
                pixelSize: 5,
                color: color.withAlpha(0.92),
                outlineColor: Cesium.Color.fromCssColorString('#041019').withAlpha(0.9),
                outlineWidth: 1,
                scaleByDistance: new Cesium.NearFarScalar(
                  200_000,
                  1.0,
                  16_000_000,
                  0.38,
                ),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: sharedProps,
            }),
            Number(props.labelLon),
            Number(props.labelLat),
          );
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
            id,
            position: labelPos,
            variant: 'card',
            title: cleanName,
            details: [
              details ? details.slice(0, 72) : KIND_STATUS_LABELS[kind],
              `🕒 Stand: ${formatShortTimestamp(updatedAt)}`,
            ].filter(Boolean),
            accent: cssAccent,
            selected: false,
            protected: false,
            dismissible: true,
            onDismiss: (dismissedId) => dismissCardById(dismissedId || id),
            priority: 1480 - index,
            maxDistance: 10_000_000,
          });
        }
        return;
      }

      // 3. Polygon / MultiPolygon (Curved Maritime Seeblockaden at sea level & Ukraine DeepState fronts)
      for (const rings of polygonRings(feature?.geometry)) {
        const polyHeight = kind === 'blockade' ? 60 : 320;
        const positions = ringPositions(rings[0] || [], 96, polyHeight);
        if (!positions) continue;
        count += 1;
        const id = `${entityPrefix}${index}:${count}`;
        const polyLon = Number(props.labelLon) || Number(rings[0]?.[0]?.[0]);
        const polyLat = Number(props.labelLat) || Number(rings[0]?.[0]?.[1]);
        pushEntity(
          new Cesium.Entity({
            id,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              height: polyHeight,
              material: color.withAlpha(kind === 'blockade' ? 0.22 : 0.14),
              outline: false,
            },
            properties: sharedProps,
          }),
          polyLon,
          polyLat,
        );
        for (const ring of rings) {
          const line = ringPositions(ring, 96, polyHeight + 20);
          if (!line) continue;
          const outMat = color.withAlpha(kind === 'blockade' ? 0.92 : 0.78);
          pushEntity(
            new Cesium.Entity({
              id: `${id}:outline:${entities.length}`,
              polyline: {
                positions: line,
                width: kind === 'blockade' ? 2.4 : 1.8,
                arcType: Cesium.ArcType.NONE,
                material: outMat,
              },
              properties: sharedProps,
            }),
            polyLon,
            polyLat,
          );
        }

        if (
          Number.isFinite(props.labelLat) &&
          Number.isFinite(props.labelLon)
        ) {
          const labelPos = Cesium.Cartesian3.fromDegrees(
            Number(props.labelLon),
            Number(props.labelLat),
            120,
          );
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
            id,
            position: labelPos,
            variant: 'card',
            title: cleanName,
            details: [
              details ? details.slice(0, 72) : KIND_STATUS_LABELS[kind],
              `🕒 Stand: ${formatShortTimestamp(updatedAt)}`,
            ].filter(Boolean),
            accent: cssAccent,
            selected: false,
            protected: false,
            dismissible: true,
            onDismiss: (dismissedId) => dismissCardById(dismissedId || id),
            priority: (kind === 'blockade' ? 1440 : 1150) - index,
            maxDistance: 10_500_000,
          });
        }
      }
    });

    _countsByKind = counts;
    _horizonRecords = horizonRecords;
    _lastCamPos = null;
    _dataSource.entities.removeAll();
    for (const entity of entities) _dataSource.entities.add(entity);
    syncHorizonVisibility(true);

    _allOverlayEntries = overlayEntries;
    _count = count;
    syncOverlayEntries();
  }

  const layer = {
    id: layerId,
    name: layerName,
    icon: layerIcon,
    source: sourceLabel,
    updateInterval: 30 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error(`${layerId} layer is already initialized`);
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource(layerId);
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _popover = createInfoPopover(viewer, {
        prefix: entityPrefix,
        describe: (read, entity) => {
          const kind = read('kind') || 'territory';
          const radiusKm = Number(read('radiusKm')) || 0;
          const entityId = entity?.id || '';
          return {
            title: String(read('areaName') || '')
              .split('///')[0]
              .trim(),
            lines: [
              ['Zeitpunkt / Stand', formatOsintTimestamp(read('updatedAt'))],
              [
                'Kategorie / Typ',
                KIND_STATUS_LABELS[kind] || KIND_STATUS_LABELS.territory,
              ],
              ['Region / Schauplatz', read('theater')],
              ...(radiusKm > 0 && (kind === 'air_defense' || kind === 'carrier')
                ? [['Aktions- / Radar-Radius', `ca. ${radiusKm} km`]]
                : []),
              ['Details & Systeme', read('details')],
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
      console.log(`[Data:${layerId}] Initialized`);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      setOverlaySourceVisible(overlaySourceId, _showLabels);
      syncHorizonVisibility(true);
      _viewer?.scene?.requestRender?.();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      clearOverlaySource(overlaySourceId);
      setOverlaySourceVisible(overlaySourceId, false);
      _viewer?.scene?.requestRender?.();
    },

    setRowControlsListener(listener) {
      _rowControlsListener = typeof listener === 'function' ? listener : null;
    },

    getRowControls() {
      const labelChips = [
        {
          id: 'toggle-labels',
          // i18n-ignore: tactical German label toggle chip
          label: _showLabels ? '🏷️ Textfelder: AN' : '🏷️ Textfelder: AUS',
          color: _showLabels ? '#38bdf8' : '#64748b',
          title:
            'Textfelder auf der Karte ein- oder ausblenden (Standort-Punkte bleiben sichtbar)',
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
      ];
      if (fixedFilter) {
        return {
          chips: labelChips,
          info: 'Klicke auf × im Textfeld (oder Rechtsklick), um einzelne Textfelder zu entfernen, oder schalte alle Textfelder oben ein/aus.',
        };
      }
      return {
        chips: [
          ...labelChips,
          ...FILTER_CHIPS.map((chip) => ({
            id: chip.id,
            label: chip.label,
            color: chip.color,
            title: chip.title,
            active: _activeFilter === chip.id,
            onClick: () => {
              _activeFilter =
                _activeFilter === chip.id && chip.id !== 'all'
                  ? 'all'
                  : chip.id;
              if (_lastSnapshot) rebuildFromSnapshot(_lastSnapshot);
            },
          })),
        ],
        legend: [
          {
            // i18n-ignore: tactical German legend label
            label: '🛡️ Luftabwehr / Iron Dome',
            color: '#10b981',
            count: _countsByKind.air_defense || 0,
          },
          {
            // i18n-ignore: tactical German legend label
            label: '🚀 Raketen-Silos & Startbasen',
            color: '#f97316',
            count: _countsByKind.missile_site || 0,
          },
          {
            // i18n-ignore: tactical German legend label
            label: '🏰 Bunker & Kommandos',
            color: '#eab308',
            count: _countsByKind.bunker || 0,
          },
          {
            // i18n-ignore: tactical German legend label
            label: '🏛️ Militärbasen & Kasernen',
            color: '#38bdf8',
            count: _countsByKind.military_base || 0,
          },
          {
            // i18n-ignore: tactical German legend label
            label: '🧬 Forschung, Lockheed & Biowaffen',
            color: '#e879f9',
            count: _countsByKind.research || 0,
          },
          {
            // i18n-ignore: tactical German legend label
            label: '⚔️ Front & Seeblockaden',
            color: '#ff6b4a',
            count: (_countsByKind.front || 0) + (_countsByKind.naval || 0),
          },
        ],
        info: 'Klicke auf einen Standort auf dem Globus für Details, Zeitstempel & 🤖 Gemini-Sprachbriefing.',
      };
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await getSharedSnapshot(source, request.signal);
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;

        _lastSnapshot = snapshot;
        rebuildFromSnapshot(snapshot);

        _lastUpdate = snapshot.updatedAt
          ? Date.parse(snapshot.updatedAt) || Date.now()
          : Date.now();
        _lastError = null;
        console.log(`[Data:${layerId}] Updated: ${_count} items`);
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn(`[Data:${layerId}] Fetch error:`, error);
        _lastError = error?.message || msg('Front line source unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      clearOverlaySource(overlaySourceId);
      setOverlaySourceVisible(overlaySourceId, false);
      _popover?.destroy();
      _popover = null;
      _request?.abort();
      _request = null;
      _viewer = null;
      _enabled = false;
      _lastSnapshot = null;
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
        source: sourceLabel,
        coverage: layerCoverage,
      };
    },

    getAnalystRecords(limit = 50) {
      const features = _lastSnapshot?.features || [];
      const out = [];
      for (let i = 0; i < features.length; i += 1) {
        if (out.length >= limit) break;
        const feature = features[i];
        const props = feature?.properties || {};
        const rawName = String(props.name || '');
        const cleanName = rawName.split('///')[0].trim();
        const kind = classifyFrontlineArea(rawName, props.kind);
        if (!matchesFilter(kind, _activeFilter)) continue;
        let lat = Number(props.labelLat);
        let lon = Number(props.labelLon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          if (feature?.geometry?.type === 'Point') {
            lon = Number(feature.geometry.coordinates?.[0]);
            lat = Number(feature.geometry.coordinates?.[1]);
          } else if (feature?.geometry?.type === 'LineString') {
            const mid = feature.geometry.coordinates?.[
              Math.floor((feature.geometry.coordinates?.length || 1) / 2)
            ];
            lon = Number(mid?.[0]);
            lat = Number(mid?.[1]);
          } else if (feature?.geometry?.type === 'Polygon') {
            const first = feature.geometry.coordinates?.[0]?.[0];
            lon = Number(first?.[0]);
            lat = Number(first?.[1]);
          }
        }
        out.push({
          id: `${entityPrefix}${kind}:${i}`,
          name: cleanName,
          kind,
          theater: props.theater || '',
          details: props.details || '',
          radiusKm: Number(props.radiusKm) || 0,
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          updatedAt: props.updatedAt || _lastSnapshot?.updatedAt || '',
        });
      }
      return out;
    },
  };
  return layer;
}
