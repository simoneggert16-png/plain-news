import * as Cesium from 'cesium';
import { createInfoPopover } from '../../ui/conflictInfo.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../../overlays/worldOverlay.js';

const msg = (text) => text;
const BORDERS_OVERLAY_SOURCE_ID = 'borders-crossings';

/**
 * Approximate ground elevation (m above WGS84) for border vertices so oblique
 * 3D views (like -22° pitch in the St. Galler Rheintal at 410m ASL) align
 * cleanly with the terrain surface.
 */
function borderHeightForLatLon(lat, lon) {
  // St. Galler Rheintal & Bodensee (400–435m ASL)
  if (lat >= 47.15 && lat <= 47.65 && lon >= 9.35 && lon <= 9.85) return 418;
  // Swiss / Austrian Alps & Liechtenstein
  if (lat >= 45.8 && lat <= 47.8 && lon >= 5.9 && lon <= 13.5) return 520;
  return 60;
}

/**
 * Exact WGS84 ellipsoid horizon visibility test for a surface point `p` with
 * outward geodetic surface normal `n`, viewed from camera ECEF position `camPos`.
 *
 * Because the WGS84 ellipsoid is strictly convex, `p` lies on the camera-facing
 * front cap of the globe (not occluded by the globe's curvature at any altitude)
 * if and only if `(camPos - p) · n > 0`. Requiring `sin(alpha) > minSin` clips
 * segments cleanly just inside the visible silhouette limb of the globe.
 */
function isPointOnVisibleGlobe(camPos, minSinSq, maxDistSq, p, n) {
  const vx = camPos.x - p.x;
  const vy = camPos.y - p.y;
  const vz = camPos.z - p.z;
  const dot = vx * n.x + vy * n.y + vz * n.z;
  if (dot <= 0) return false;
  const distSq = vx * vx + vy * vy + vz * vz;
  if (distSq > maxDistSq) return false;
  return dot * dot > minSinSq * distSq;
}

function surfaceAnchorAndNormal(lon, lat) {
  const p = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
  const n = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    p,
    new Cesium.Cartesian3(),
  );
  return { p, n };
}

/**
 * Densify long spans (> 1.2°) so straight desert/parallel borders follow the
 * globe curvature, split across antimeridian jumps, and chunk into short
 * segments (<= 8 vertices) with start/mid/end horizon normals.
 */
function ringSegments(ring, maxChunk = 8, maxStepDeg = 1.2) {
  const runs = [];
  let current = [];
  for (const point of ring || []) {
    const lon = Number(point?.[0]);
    const lat = Number(point?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (current.length > 0) {
      const prev = current[current.length - 1];
      const dLon = lon - prev[0];
      const dLat = lat - prev[1];
      // Split across antimeridian or discontinuous jumps
      if (Math.abs(dLon) > 60) {
        if (current.length >= 2) runs.push(current);
        current = [[lon, lat, borderHeightForLatLon(lat, lon)]];
        continue;
      }
      const span = Math.hypot(dLon, dLat);
      if (span > maxStepDeg) {
        const steps = Math.min(32, Math.ceil(span / maxStepDeg));
        for (let s = 1; s < steps; s += 1) {
          const t = s / steps;
          const iLon = prev[0] + dLon * t;
          const iLat = prev[1] + dLat * t;
          current.push([iLon, iLat, borderHeightForLatLon(iLat, iLon)]);
        }
      }
    }
    current.push([lon, lat, borderHeightForLatLon(lat, lon)]);
  }
  if (current.length >= 2) runs.push(current);

  const segments = [];
  for (const valid of runs) {
    for (let i = 0; i < valid.length - 1; i += maxChunk - 1) {
      const slice = valid.slice(i, i + maxChunk);
      if (slice.length < 2) continue;
      const flat = [];
      for (const [lon, lat, h] of slice) {
        flat.push(lon, lat, h);
      }
      const first = slice[0];
      const mid = slice[Math.floor(slice.length / 2)];
      const last = slice[slice.length - 1];
      const a0 = surfaceAnchorAndNormal(first[0], first[1]);
      const am = surfaceAnchorAndNormal(mid[0], mid[1]);
      const a1 = surfaceAnchorAndNormal(last[0], last[1]);
      segments.push({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
        p0: a0.p,
        n0: a0.n,
        pm: am.p,
        nm: am.n,
        p1: a1.p,
        n1: a1.n,
      });
    }
  }
  return segments;
}

/**
 * Country borders (Natural Earth 1:10m + exact St. Galler Rheintal / Diepoldsau boundary).
 */
export function createBordersLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Borders require a snapshot source');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _polylineCollection = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _syncVisibility = null;
  let _onMapStackChanged = null;
  let _removeCameraListener = null;
  let _removePreRenderListener = null;
  let _segmentRecords = [];
  let _crossingRecords = [];
  let _lastCamPos = null;
  let _popover = null;
  let _handler = null;
  let _selectedId = null;
  const _crossingById = new Map();

  const layer = {
    id: 'borders',
    name: 'National borders',
    icon: '🗺️',
    source: 'Natural Earth · Swisstopo · BAZG',
    updateInterval: 15 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('Borders layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('borders');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);

      _polylineCollection = new Cesium.PolylineCollection();
      _polylineCollection.show = false;
      // Render front-hemisphere border lines above continental terrain while
      // preRender horizon culling synchronously hides every segment beyond the limb.
      try {
        _polylineCollection._translucentRS = Cesium.RenderState.fromCache({
          blending: Cesium.BlendingState.ALPHA_BLEND,
          depthMask: false,
          depthTest: {
            enabled: true,
            func: Cesium.WebGLConstants.ALWAYS,
          },
        });
      } catch {
        // Fallback for unit-test mocks without full WebGL RenderState cache
      }
      viewer.scene?.primitives?.add?.(_polylineCollection);

      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _segmentRecords = [];
      _crossingRecords = [];
      _lastCamPos = null;
      _selectedId = null;
      _crossingById.clear();

      _popover = createInfoPopover({
        viewer,
        className: 'gev-border-popover',
        render: (item) => [
          // i18n-ignore: border crossing field label
          { label: 'Grenzübergang', value: item.name },
          // i18n-ignore: border crossing field label
          { label: 'Staaten', value: item.countries },
          // i18n-ignore: border crossing field label
          { label: 'Verkehrskorridor', value: item.corridor },
          // i18n-ignore: border crossing field label
          { label: 'Aktuelle Lage', value: item.status },
          // i18n-ignore: border crossing field label
          { label: 'Abfertigung / Spuren', value: item.lanes },
          // i18n-ignore: border crossing field label
          { label: 'Grenzregime', value: item.regime },
          {
            // i18n-ignore: border crossing field label
            label: 'Position',
            value: `${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°`,
          },
        ],
        briefingContext: (item) => ({
          kind: 'border_crossing',
          name: item.name,
          category: `Grenzübergang (${item.countries})`,
          status: item.status,
          details: `${item.corridor} · ${item.lanes} · ${item.regime}`,
          lat: item.lat,
          lon: item.lon,
        }),
        onClose: () => {
          if (_selectedId) {
            clearOverlaySource(BORDERS_OVERLAY_SOURCE_ID);
            _selectedId = null;
          }
        },
      });

      _handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      _handler.setInputAction((movement) => {
        if (!_enabled) return;
        const picked = viewer.scene.pick(movement.position);
        const entity = picked?.id;
        if (
          !(entity instanceof Cesium.Entity) ||
          !String(entity.id).startsWith('border-crossing:')
        ) {
          return;
        }
        const item = _crossingById.get(entity.id);
        if (!item) return;
        _selectedId = item.id;
        setOverlayEntries(BORDERS_OVERLAY_SOURCE_ID, [
          {
            cardStyle: 'tactical',
            collisionGroup: 'ambient-card',
            edgeFade: 'keyhole',
            horizonCull: true,
            terrainOcclusion: false,
            interactive: false,
            gapPx: 14,
            leaderOffsetPx: 8,
            verticalOnly: true,
            viewportMargin: 4,
            id: `border-card:${item.id}`,
            position: Cesium.Cartesian3.fromDegrees(
              item.lon,
              item.lat,
              item.height + 16,
            ),
            variant: 'card',
            title: item.name,
            details: [
              `${item.countries || 'Grenzübergang'} · ${item.status}`,
              item.corridor,
            ].filter(Boolean),
            accent:
              item.waitMinutes >= 30
                ? '#ff4d4d'
                : item.waitMinutes >= 12
                  ? '#ffb84d'
                  : '#00e5ff',
            selected: true,
            protected: true,
            priority: 950,
            maxDistance: 500_000,
          },
        ]);
        setOverlaySourceVisible(BORDERS_OVERLAY_SOURCE_ID, true);
        _popover?.open(item, movement.position);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      _syncVisibility = (force = false) => {
        if (
          !_viewer ||
          !_enabled ||
          (!_segmentRecords.length && !_crossingRecords.length)
        ) {
          return;
        }
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

        const camHeight =
          _viewer.camera?.positionCartographic?.height ??
          Math.max(0, Cesium.Cartesian3.magnitude(camPos) - 6_371_000);
        const minSin =
          camHeight > 180_000 ? 0.055 : camHeight > 30_000 ? 0.02 : 0.003;
        const minSinSq = minSin * minSin;
        const maxDist =
          camHeight < 80_000
            ? Math.max(18_000, camHeight * 14 + 12_000)
            : Number.POSITIVE_INFINITY;
        const maxDistSq =
          maxDist === Number.POSITIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : maxDist * maxDist;

        let changed = false;
        for (let i = 0; i < _segmentRecords.length; i += 1) {
          const rec = _segmentRecords[i];
          const shouldShow =
            isPointOnVisibleGlobe(
              camPos,
              minSinSq,
              maxDistSq,
              rec.p0,
              rec.n0,
            ) &&
            isPointOnVisibleGlobe(
              camPos,
              minSinSq,
              maxDistSq,
              rec.pm,
              rec.nm,
            ) &&
            isPointOnVisibleGlobe(camPos, minSinSq, maxDistSq, rec.p1, rec.n1);
          if (rec.polyline.show !== shouldShow) {
            rec.polyline.show = shouldShow;
            changed = true;
          }
        }
        for (let i = 0; i < _crossingRecords.length; i += 1) {
          const rec = _crossingRecords[i];
          const shouldShow = isPointOnVisibleGlobe(
            camPos,
            minSinSq,
            maxDistSq,
            rec.p0,
            rec.n0,
          );
          if (rec.entity.show !== shouldShow) {
            rec.entity.show = shouldShow;
            changed = true;
          }
        }
        if (changed && force === true) _viewer.scene?.requestRender?.();
      };
      _onMapStackChanged = () => _syncVisibility?.(true);
      window.addEventListener('gev:map-stack-changed', _onMapStackChanged);
      if (viewer.scene?.preRender?.addEventListener) {
        _removePreRenderListener = viewer.scene.preRender.addEventListener(() =>
          _syncVisibility(false),
        );
      }
      if (viewer.camera?.moveEnd?.addEventListener) {
        _removeCameraListener = viewer.camera.moveEnd.addEventListener(() =>
          _syncVisibility(true),
        );
      }
      console.log('[Data:Borders] Initialized');
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      if (_polylineCollection) _polylineCollection.show = true;
      _syncVisibility?.(true);
      _viewer?.scene?.requestRender?.();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      _popover?.close();
      if (_selectedId) {
        clearOverlaySource(BORDERS_OVERLAY_SOURCE_ID);
        _selectedId = null;
      }
      setOverlaySourceVisible(BORDERS_OVERLAY_SOURCE_ID, false);
      if (_dataSource) _dataSource.show = false;
      if (_polylineCollection) _polylineCollection.show = false;
      _viewer?.scene?.requestRender?.();
    },

    async update() {
      if (!_enabled || !_dataSource || !_polylineCollection) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        _dataSource.entities.removeAll();
        _polylineCollection.removeAll();
        _segmentRecords = [];
        _crossingRecords = [];
        _lastCamPos = null;
        _crossingById.clear();
        let count = 0;
        const borderColor =
          Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.84);
        const borderMaterial = Cesium.Material.fromType('Color', {
          color: borderColor,
        });

        const addRing = (ring) => {
          const segments = ringSegments(ring);
          for (const seg of segments) {
            const polyline = _polylineCollection.add({
              positions: seg.positions,
              width: 1.8,
              material: borderMaterial,
              show: false,
            });
            _segmentRecords.push({
              polyline,
              p0: seg.p0,
              n0: seg.n0,
              pm: seg.pm,
              nm: seg.nm,
              p1: seg.p1,
              n1: seg.n1,
            });
            count += 1;
          }
        };

        for (const feature of snapshot.features) {
          const geometry = feature?.geometry;
          if (geometry?.type === 'Point') {
            const lon = Number(geometry.coordinates?.[0]);
            const lat = Number(geometry.coordinates?.[1]);
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
            const props = feature.properties || {};
            const id = `border-crossing:${props.id || count}`;
            const waitMinutes = Number(props.waitMinutes) || 0;
            const height = borderHeightForLatLon(lat, lon) + 14;
            const pointColor =
              waitMinutes >= 30
                ? Cesium.Color.fromCssColorString('#ef4444')
                : waitMinutes >= 12
                  ? Cesium.Color.fromCssColorString('#f59e0b')
                  : Cesium.Color.fromCssColorString('#38bdf8');
            const a0 = surfaceAnchorAndNormal(lon, lat);
            const labelShort = String(props.name || 'Grenzübergang').replace(
              /^🛂\s*/,
              '',
            );
            const entity = _dataSource.entities.add(
              new Cesium.Entity({
                id,
                name: labelShort,
                show: false,
                position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
                point: {
                  pixelSize: 6.5,
                  color: pointColor,
                  outlineColor: Cesium.Color.fromCssColorString('#082f49'),
                  outlineWidth: 1.2,
                  scaleByDistance: new Cesium.NearFarScalar(
                    150_000,
                    1.0,
                    14_000_000,
                    0.38,
                  ),
                  disableDepthTestDistance: 2_500_000,
                },
              }),
            );
            _crossingRecords.push({ entity, p0: a0.p, n0: a0.n });
            _crossingById.set(id, {
              id,
              name: labelShort,
              countries: String(props.countries || 'Grenzübergang'),
              corridor: String(props.corridor || 'Grenzregion'),
              lanes: String(props.lanes || 'PKW / LKW'),
              waitMinutes,
              status: String(props.status || 'Regulärer Grenzbetrieb'),
              regime: String(props.regime || 'Zoll- & Grenzkontrolle'),
              lat,
              lon,
              height,
            });
            count += 1;
            continue;
          }
          const polygons =
            geometry?.type === 'Polygon'
              ? [geometry.coordinates]
              : geometry?.type === 'MultiPolygon'
                ? geometry.coordinates
                : [];
          for (const rings of polygons) {
            for (const ring of rings) {
              addRing(ring);
            }
          }
          const lines =
            geometry?.type === 'LineString'
              ? [geometry.coordinates]
              : geometry?.type === 'MultiLineString'
                ? geometry.coordinates
                : [];
          for (const line of lines) {
            addRing(line);
          }
        }
        _count = count;
        _syncVisibility?.(true);
        _lastUpdate = Date.now();
        _lastError = null;
        console.log(
          `[Data:Borders] Updated: ${_count} segments & border crossings`,
        );
        return true;
      } catch (error) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:Borders] Fetch error:', error);
        _lastError = error?.message || msg('Border source unavailable');
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _viewer = null;
      _enabled = false;
      _segmentRecords = [];
      _crossingRecords = [];
      _crossingById.clear();
      if (_selectedId) {
        clearOverlaySource(BORDERS_OVERLAY_SOURCE_ID);
        _selectedId = null;
      }
      _popover?.destroy();
      _popover = null;
      _handler?.destroy();
      _handler = null;
      if (_removePreRenderListener) {
        _removePreRenderListener();
        _removePreRenderListener = null;
      }
      if (_removeCameraListener) {
        _removeCameraListener();
        _removeCameraListener = null;
      }
      if (_onMapStackChanged) {
        window.removeEventListener('gev:map-stack-changed', _onMapStackChanged);
        _onMapStackChanged = null;
      }
      _syncVisibility = null;
      if (_polylineCollection) {
        viewer?.scene?.primitives?.remove?.(_polylineCollection);
        _polylineCollection = null;
      }
      if (_dataSource) {
        viewer?.dataSources?.remove?.(_dataSource, true);
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
        source: 'Natural Earth · Swisstopo · BAZG',
        coverage: 'national outlines & 42 live border crossings',
      };
    },
  };
  return layer;
}
