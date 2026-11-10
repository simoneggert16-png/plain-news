import * as Cesium from 'cesium';
import { t } from '../i18n/index.js';
import { viewportBias } from '../annotations/annotationResolver.js';
import { guardCameraAboveGround } from '../cameraGroundGuard.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';

const OVERLAY_SOURCE = 'map-focus';

const FALLBACK_RADIUS_M = 22;

let _reticleIconUrl = null;
function getMapFocusReticleIcon() {
  if (_reticleIconUrl) return _reticleIconUrl;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="9" fill="#04121a" fill-opacity="0.55" stroke="#00f0ff" stroke-width="1.5"/>
    <path d="M14 2 v5 M14 21 v5 M2 14 h5 M21 14 h5" stroke="#00f0ff" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="14" cy="14" r="2.2" fill="#00f0ff"/>
  </svg>`;
  _reticleIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return _reticleIconUrl;
}

function ringPositions(ring, height = 0) {
  const flat = [];
  for (const point of ring || []) {
    const lon = Number(point?.[0]);
    const lat = Number(point?.[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat))
      flat.push(lon, lat, height);
  }
  return flat.length >= 9
    ? Cesium.Cartesian3.fromDegreesArrayHeights(flat)
    : [];
}

/** Ellipsoidal ground height: rendered 3D mesh first, terrain provider second, then the GEV terrain API. */
async function groundHeightAt(viewer, lon, lat) {
  const carto = new Cesium.Cartographic(
    Cesium.Math.toRadians(lon),
    Cesium.Math.toRadians(lat),
  );
  if (typeof viewer.scene?.sampleHeight === 'function') {
    try {
      const sampled = viewer.scene.sampleHeight(carto);
      if (Number.isFinite(sampled) && sampled > -450) return sampled;
    } catch {
      /* tiles not ready for this cell */
    }
  }
  try {
    const height = viewer.scene.globe.getHeight(carto);
    if (Number.isFinite(height)) return height;
  } catch {
    /* The photoreal stack hides the globe; fall through to the API. */
  }
  try {
    const response = await fetch(
      `/api/terrain/heights?points=${encodeURIComponent(lon)},${encodeURIComponent(lat)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    if (response.ok) {
      const body = await response.json();
      const value = Number(body?.results?.[0]?.ellipsoid);
      if (Number.isFinite(value)) return value;
    }
  } catch {
    /* fall back to the ellipsoid */
  }
  return 0;
}

/**
 * Fly to a published address and mark the official cadastral parcel around it.
 *
 * The parcel geometry comes from the public geodienste.ch AV WFS. Where the
 * cadastre has no parcel (or the canton does not publish it), a 45 m circle is
 * drawn instead and labelled as an estimate. Nothing here infers a private
 * residence; only published addresses and typed addresses are focused.
 */
export function installMapFocus(viewer, placeSearch) {
  const source = new Cesium.CustomDataSource('map-focus');
  viewer.dataSources.add(source);

  const notify = (ok, label, extra = {}) => {
    window.dispatchEvent(
      new CustomEvent('gev:map-focus-result', {
        detail: { ok, label: label || '', ...extra },
      }),
    );
  };

  const clear = () => {
    source.entities.removeAll();
    clearOverlaySource(OVERLAY_SOURCE);
  };

  const addCircleFallback = (
    targetLat,
    targetLon,
    groundHeight,
    targetLabel,
    addressText,
  ) => {
    const color = Cesium.Color.fromCssColorString('#00f0ff');
    const latRadius = FALLBACK_RADIUS_M / 111_320;
    const lonRadius =
      FALLBACK_RADIUS_M / (111_320 * Math.cos((targetLat * Math.PI) / 180));
    const ring = [];
    for (let step = 0; step <= 64; step += 1) {
      const angle = (step / 64) * Math.PI * 2;
      ring.push(
        targetLon + Math.cos(angle) * lonRadius,
        targetLat + Math.sin(angle) * latRadius,
        groundHeight + 1.5,
      );
    }
    const positions = Cesium.Cartesian3.fromDegreesArrayHeights(ring);
    const center = Cesium.Cartesian3.fromDegrees(
      targetLon,
      targetLat,
      groundHeight + 2,
    );
    const pinHead = Cesium.Cartesian3.fromDegrees(
      targetLon,
      targetLat,
      groundHeight + 18,
    );
    source.entities.add({
      position: center,
      polyline: {
        positions,
        width: 1.6,
        material: color.withAlpha(0.75),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8_000),
      },
      billboard: {
        image: getMapFocusReticleIcon(),
        width: 24,
        height: 24,
        scaleByDistance: new Cesium.NearFarScalar(250, 1.0, 15_000, 0.4),
        translucencyByDistance: new Cesium.NearFarScalar(3_500, 1.0, 22_000, 0.0),
        disableDepthTestDistance: 3500,
      },
    });
    const details = [];
    if (addressText && addressText !== targetLabel) details.push(`📮 ${addressText}`);
    details.push(
      `🌐 ${targetLat.toFixed(5)}°N, ${targetLon.toFixed(5)}°E · ${t('Estimated area')}`,
    );
    setOverlayEntries(OVERLAY_SOURCE, [
      {
        id: 'estimate',
        position: () => pinHead,
        variant: 'card',
        accent: '#00f0ff',
        selected: true,
        protected: true,
        dismissible: true,
        onDismiss: () => clear(),
        title: `📍 ${targetLabel || addressText || t('Estimated area')}`,
        details,
        priority: 10,
      },
    ]);
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(center, FALLBACK_RADIUS_M),
      {
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-45),
          260,
        ),
        duration: 2.2,
        complete: () => {
          try {
            guardCameraAboveGround(viewer, { lat: targetLat, lon: targetLon });
          } catch {
            /* best-effort */
          }
        },
      },
    );
  };

  const addParcel = (parcel, groundHeight, targetLabel, addressText) => {
    const color = Cesium.Color.fromCssColorString('#00f0ff');
    const polygons =
      parcel.geometry?.type === 'Polygon'
        ? [parcel.geometry.coordinates]
        : parcel.geometry?.type === 'MultiPolygon'
          ? parcel.geometry.coordinates
          : [];
    const all = [];
    for (const polygon of polygons) {
      const outer = ringPositions(polygon?.[0], groundHeight + 1.5);
      if (!outer.length) continue;
      all.push(...outer);
      source.entities.add({
        polyline: {
          positions: outer,
          width: 3,
          material: color.withAlpha(0.92),
        },
      });
      const holes = (polygon || [])
        .slice(1)
        .map((hole) => ringPositions(hole, groundHeight + 1.5))
        .filter((hole) => hole.length)
        .map((hole) => new Cesium.PolygonHierarchy(hole));
      source.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outer, holes),
          material: color.withAlpha(0.16),
          height: groundHeight + 1.5,
        },
      });
    }
    if (!all.length) return false;
    const sphere = Cesium.BoundingSphere.fromPoints(all);
    const carto = Cesium.Cartographic.fromCartesian(sphere.center);
    const groundPinPos = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      groundHeight + 2,
    );
    const labelPosition = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      groundHeight + 18,
    );
    source.entities.add({
      position: groundPinPos,
      billboard: {
        image: getMapFocusReticleIcon(),
        width: 24,
        height: 24,
        scaleByDistance: new Cesium.NearFarScalar(250, 1.0, 15_000, 0.4),
        translucencyByDistance: new Cesium.NearFarScalar(3_500, 1.0, 22_000, 0.0),
        disableDepthTestDistance: 3500,
      },
    });
    const parcelMeta = [
      parcel.number ? `Parzelle #${parcel.number}` : '',
      parcel.area ? `${parcel.area} m²` : '',
      parcel.canton || '',
      'Amtliche Vermessung (AV)',
    ]
      .filter(Boolean)
      .join(' · ');
    const details = [];
    if (addressText && addressText !== targetLabel) details.push(`📮 ${addressText}`);
    if (parcelMeta) details.push(`📐 ${parcelMeta}`);
    setOverlayEntries(OVERLAY_SOURCE, [
      {
        id: 'parcel',
        position: labelPosition,
        variant: 'card',
        accent: '#00f0ff',
        selected: true,
        protected: true,
        dismissible: true,
        onDismiss: () => clear(),
        title: `📍 ${targetLabel || addressText || parcelMeta}`,
        details,
        priority: 10,
      },
    ]);
    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-52),
        Math.max(240, sphere.radius * 4.2),
      ),
      duration: 2.2,
      complete: () => {
        try {
          guardCameraAboveGround(viewer, {
            lat: Cesium.Math.toDegrees(carto.latitude),
            lon: Cesium.Math.toDegrees(carto.longitude),
          });
        } catch {
          /* best-effort */
        }
      },
    });
    return true;
  };

  const focus = async ({ address, lat, lon, label } = {}) => {
    let targetLat = Number(lat);
    let targetLon = Number(lon);
    const rawAddress = String(address || '').trim();
    let targetLabel = String(label || rawAddress || '').trim();
    if (
      (!Number.isFinite(targetLat) || !Number.isFinite(targetLon)) &&
      rawAddress
    ) {
      try {
        const { place } = await placeSearch.geocode(rawAddress, {
          bias: viewportBias(viewer),
        });
        if (!place) {
          notify(false, targetLabel);
          return;
        }
        targetLat = Number(place.lat);
        targetLon = Number(place.lng);
        if (!label) targetLabel = String(place.label || targetLabel);
      } catch {
        notify(false, targetLabel);
        return;
      }
    }
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLon)) {
      notify(false, targetLabel);
      return;
    }

    const groundHeight = await groundHeightAt(viewer, targetLon, targetLat);
    clear();
    let parcel = null;
    try {
      const response = await fetch(
        `/api/parcel?lat=${encodeURIComponent(targetLat)}&lon=${encodeURIComponent(targetLon)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(12_000) },
      );
      if (response.ok) {
        const body = await response.json();
        if (body?.found && body.geometry) parcel = body;
      }
    } catch {
      parcel = null;
    }
    if (
      parcel &&
      addParcel(parcel, groundHeight, targetLabel, rawAddress)
    ) {
      notify(true, targetLabel, {
        parcel: true,
        number: parcel.number,
        area: parcel.area,
        canton: parcel.canton,
      });
      return;
    }
    addCircleFallback(
      targetLat,
      targetLon,
      groundHeight,
      targetLabel,
      rawAddress,
    );
    notify(true, targetLabel, { parcel: false });
  };

  const onFocus = (event) => {
    void focus(event.detail || {});
  };
  const onClear = () => {
    clear();
  };
  const onSetMapLabels = (event) => {
    const visible = Boolean(event?.detail?.visible);
    setOverlaySourceVisible(OVERLAY_SOURCE, visible);
    source.show = visible;
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') clear();
  };
  window.addEventListener('gev:map-focus', onFocus);
  window.addEventListener('gev:map-focus-clear', onClear);
  window.addEventListener('gev:set-map-labels', onSetMapLabels);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('gev:map-focus', onFocus);
    window.removeEventListener('gev:map-focus-clear', onClear);
    window.removeEventListener('gev:set-map-labels', onSetMapLabels);
    window.removeEventListener('keydown', onKeyDown);
    viewer.dataSources.remove(source, true);
    clearOverlaySource(OVERLAY_SOURCE);
  };
}
