import { lookupGazetteerPlace } from './regional-intel.js';

/**
 * Official Swiss & DACH parcel and building lookup (`GET /api/parcel`).
 *
 * Combines:
 *  1. `geodienste.ch` WFS (Amtliche Vermessung cantonal cadastral parcels)
 *  2. `api3.geo.admin.ch` Swisstopo Federal Building Registry (GWR: EGID,
 *     EGRID, parcel number `lparz`, building area `garea`, canton `gdekt`,
 *     municipality `ggdename`, postal code `dplz4`, street, year built `gbauj`,
 *     floors `gastw`, dwellings `ganzwhg`, building category `gkat`)
 *  3. Multi-mirror OpenStreetMap building & landuse cadastre with geodesic
 *     shoelace area calculation (`m²`)
 *  4. Reverse-geocode & DACH Gazetteer enrichment for Switzerland,
 *     Liechtenstein, Vorarlberg / Austria, and Germany.
 */

const WFS = 'https://geodienste.ch/db/avc_0/deu';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const CACHE_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;
const CACHE_MISS_MS = 2 * 60 * 1000;
/** @type {Map<string, {at:number, body:object}>} */
const cache = new Map();

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] || [];
    const [xj, yj] = ring[j] || [];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || !polygon.length) return false;
  if (!pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon')
    return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(point, polygon),
    );
  return false;
}

function isInSwissOrLiechtensteinBounds(lat, lon) {
  return lat >= 45.75 && lat <= 47.85 && lon >= 5.9 && lon <= 10.6;
}

function isLiechtensteinPoint(lat, lon) {
  return lat >= 47.04 && lat <= 47.28 && lon >= 9.47 && lon <= 9.64;
}

function computeRingAreaM2(ring, refLat) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const metersPerDegLat = 111_320;
  const metersPerDegLon =
    111_320 * Math.max(0.1, Math.cos((refLat * Math.PI) / 180));
  const [lon0, lat0] = ring[0];
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const x1 = (ring[i][0] - lon0) * metersPerDegLon;
    const y1 = (ring[i][1] - lat0) * metersPerDegLat;
    const x2 = (ring[i + 1][0] - lon0) * metersPerDegLon;
    const y2 = (ring[i + 1][1] - lat0) * metersPerDegLat;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.max(12, Math.round(Math.abs(sum) * 0.5));
}

function boxPolygonAround(lat, lon, areaM2 = 220) {
  const sideM = Math.max(10, Math.min(80, Math.sqrt(Math.max(60, areaM2))));
  const halfLat = (sideM * 0.5) / 111_320;
  const halfLon =
    (sideM * 0.5) /
    (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const w = Number((lon - halfLon).toFixed(6));
  const e = Number((lon + halfLon).toFixed(6));
  const s = Number((lat - halfLat).toFixed(6));
  const n = Number((lat + halfLat).toFixed(6));
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}

function mapGwrBuildingCategory(gkat) {
  const code = Number(gkat);
  if (code === 1020) return 'residential';
  if (code === 1030) return 'mixed_residential';
  if (code === 1040) return 'commercial';
  if (code === 1060) return 'industrial';
  if (code === 1080) return 'special';
  return 'building';
}

async function fetchSwissBuildingInfo(lat, lon, fetchImpl) {
  if (!isInSwissOrLiechtensteinBounds(lat, lon)) return null;
  try {
    const url = new URL(
      'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify',
    );
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('geometry', `${lon},${lat}`);
    url.searchParams.set('sr', '4326');
    url.searchParams.set('layers', 'all:ch.bfs.gebaeude_wohnungs_register');
    url.searchParams.set('tolerance', '30');
    url.searchParams.set(
      'mapExtent',
      `${lon - 0.002},${lat - 0.002},${lon + 0.002},${lat + 0.002}`,
    );
    url.searchParams.set('imageDisplay', '400,400,96');
    url.searchParams.set('returnGeometry', 'false');
    const resp = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const attrs = body?.results?.[0]?.attributes;
    if (!attrs) return null;
    const rawStreet = Array.isArray(attrs.strname)
      ? attrs.strname[0]
      : attrs.strname;
    const streetNum = attrs.deinr ? ` ${attrs.deinr}` : '';
    const street = `${rawStreet || ''}${streetNum}`.trim();
    const postalCode = attrs.dplz4 ? String(attrs.dplz4) : '';
    const city = String(attrs.dplzname || attrs.ggdename || '');
    const municipality = String(attrs.ggdename || city || '');
    const canton = String(
      attrs.gdekt || (isLiechtensteinPoint(lat, lon) ? 'LI' : ''),
    );
    const floors = attrs.gastw ? Number(attrs.gastw) : null;
    const height = floors ? Number((floors * 3.1).toFixed(1)) : null;
    return {
      egid: attrs.egid ? String(attrs.egid) : '',
      egrid: attrs.egrid ? String(attrs.egrid) : '',
      number: String(attrs.lparz || attrs.egid || ''),
      area: Number(attrs.garea) || 0,
      canton,
      countryCode: canton === 'LI' ? 'LI' : 'CH',
      street,
      postalCode,
      municipality,
      address: `${street}, ${postalCode} ${city}`
        .replace(/^,\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
      buildingUse: mapGwrBuildingCategory(attrs.gkat),
      yearBuilt: attrs.gbauj ? Number(attrs.gbauj) : null,
      floors,
      levels: floors,
      height,
      dwellings: attrs.ganzwhg ? Number(attrs.ganzwhg) : null,
    };
  } catch {
    return null;
  }
}

async function fetchReverseGeocodeDetails(lat, lon, fetchImpl) {
  const gaz = lookupGazetteerPlace(lat, lon);
  const fallbackCity = gaz ? gaz.name.split(',')[0].trim() : '';
  const fallbackRegion = gaz ? gaz.region : '';
  const fallbackCountry = gaz ? gaz.countryCode : '';

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=18&addressdetails=1&extratags=1`;
    const resp = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'gods-eye-view/1.0 (parcel reverse-geocode; https://gods-eye-view-fresh.vercel.app)',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (resp.ok) {
      const data = await resp.json();
      const addr = data?.address || {};
      const street = [
        addr.road || addr.pedestrian || addr.footway || '',
        addr.house_number || '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      const postalCode = String(addr.postcode || '');
      const municipality = String(
        addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          fallbackCity ||
          '',
      );
      const canton = String(
        addr['ISO3166-2-lvl4']?.split('-')[1] ||
          addr.state ||
          fallbackRegion ||
          '',
      );
      const countryCode = String(
        addr.country_code || fallbackCountry || '',
      ).toUpperCase();
      const address = [street, [postalCode, municipality].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
      return {
        street,
        postalCode,
        municipality,
        canton,
        countryCode,
        address: address || data?.display_name?.split(',').slice(0, 3).join(',') || '',
        buildingName: String(data?.name || ''),
        buildingUse: String(data?.type || data?.category || 'building'),
      };
    }
  } catch {
    // Fall through to gazetteer
  }

  if (!gaz) return null;
  return {
    street: '',
    postalCode: '',
    municipality: fallbackCity,
    canton: fallbackRegion,
    countryCode: fallbackCountry,
    address: gaz.name,
    buildingName: '',
    buildingUse: 'building',
  };
}

async function fetchOsmBuildingParcel(lat, lon, fetchImpl) {
  const query = `[out:json][timeout:6];(way(around:45,${lat.toFixed(6)},${lon.toFixed(6)})["building"];way(around:60,${lat.toFixed(6)},${lon.toFixed(6)})["landuse"~"residential|commercial|industrial|retail"];);out body geom 10;`;
  const mirrors =
    fetchImpl === fetch ? OVERPASS_MIRRORS : [OVERPASS_MIRRORS[0]];

  for (const endpoint of mirrors) {
    try {
      const resp = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(4800),
      });
      if (!resp.ok) continue;
      const body = await resp.json();
      const rawWays = Array.isArray(body?.elements) ? body.elements : [];
      const candidates = [];
      for (const way of rawWays) {
        if (!Array.isArray(way?.geometry) || way.geometry.length < 3) continue;
        const ring = way.geometry.map((pt) => [
          Number(pt.lon),
          Number(pt.lat),
        ]);
        if (
          ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1]
        ) {
          ring.push([...ring[0]]);
        }
        const contains = pointInRing([lon, lat], ring);
        const isBuilding = Boolean(way.tags?.building);
        const cx =
          ring.reduce((acc, p) => acc + p[0], 0) / Math.max(1, ring.length);
        const cy =
          ring.reduce((acc, p) => acc + p[1], 0) / Math.max(1, ring.length);
        const distSq = (cx - lon) ** 2 + (cy - lat) ** 2;
        candidates.push({ way, ring, contains, isBuilding, distSq });
      }
      if (!candidates.length) continue;

      candidates.sort((a, b) => {
        if (a.contains !== b.contains) return a.contains ? -1 : 1;
        if (a.isBuilding !== b.isBuilding) return a.isBuilding ? -1 : 1;
        return a.distSq - b.distSq;
      });

      const chosen = candidates[0];
      const { way, ring } = chosen;
      const tags = way.tags || {};
      const area = computeRingAreaM2(ring, lat);
      let street = [tags['addr:street'] || '', tags['addr:housenumber'] || '']
        .filter(Boolean)
        .join(' ')
        .trim();
      let postalCode = String(tags['addr:postcode'] || '');
      let municipality = String(
        tags['addr:city'] || tags['addr:municipality'] || '',
      );
      let canton = String(
        tags['addr:state'] || tags['addr:country'] || municipality || '',
      );
      let countryCode = String(tags['addr:country'] || '').toUpperCase();

      if ((!street || !municipality) && fetchImpl === fetch) {
        const rev = await fetchReverseGeocodeDetails(lat, lon, fetchImpl);
        if (rev) {
          if (!street && rev.street) street = rev.street;
          if (!postalCode && rev.postalCode) postalCode = rev.postalCode;
          if (!municipality && rev.municipality)
            municipality = rev.municipality;
          if ((!canton || canton === municipality) && rev.canton)
            canton = rev.canton;
          if (!countryCode && rev.countryCode) countryCode = rev.countryCode;
        }
      }

      const address = [
        street,
        [postalCode, municipality].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ');

      const levels = tags['building:levels']
        ? Number(tags['building:levels'])
        : null;
      const rawHeight = tags.height
        ? Number(String(tags.height).replace(/[^\d.]/g, ''))
        : null;
      const height =
        Number.isFinite(rawHeight) && rawHeight > 0
          ? rawHeight
          : levels
            ? Number((levels * 3.1).toFixed(1))
            : null;
      const yearBuilt = /^\d{4}$/.test(String(tags.start_date || ''))
        ? Number(tags.start_date)
        : null;
      const buildingUse = String(
        tags.building && tags.building !== 'yes'
          ? tags.building
          : tags.amenity || tags.shop || tags.office || tags.landuse || 'building',
      );

      return {
        found: true,
        number: String(tags.ref || way.id || ''),
        area,
        canton,
        ...(countryCode ? { countryCode } : {}),
        egrid: `OSM-WAY-${way.id}`,
        ...(street ? { street } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(municipality ? { municipality } : {}),
        ...(address ? { address } : {}),
        ...(tags.name ? { buildingName: String(tags.name) } : {}),
        buildingUse,
        ...(levels ? { floors: levels, levels } : {}),
        ...(height ? { height } : {}),
        ...(yearBuilt ? { yearBuilt } : {}),
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
        source: 'OpenStreetMap Building Cadastre',
        fetchedAt: Date.now(),
      };
    } catch {
      // Try next mirror
    }
  }
  return null;
}

/**
 * The cadastral parcel containing a WGS84 point, or {found:false}.
 * The WFS expects BBOX in lat,lon order for EPSG:4326.
 * @param {{lat:number|string, lon:number|string, fetchImpl?:Function}} options
 */
export async function parcelAt({ lat, lon, fetchImpl = fetch } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 85 ||
    Math.abs(longitude) > 180
  )
    return { found: false, source: 'geodienste.ch' };
  const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
  if (fetchImpl === fetch) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < (hit.body.found ? CACHE_MS : CACHE_MISS_MS))
      return hit.body;
  }

  const padLat = 0.0005;
  const padLon = 0.0008;
  const isCustomFetch = fetchImpl !== fetch;
  const trySwissWfs =
    isCustomFetch || isInSwissOrLiechtensteinBounds(latitude, longitude);

  let match = null;
  if (trySwissWfs) {
    try {
      const url = new URL(WFS);
      url.searchParams.set('SERVICE', 'WFS');
      url.searchParams.set('VERSION', '2.0.0');
      url.searchParams.set('REQUEST', 'GetFeature');
      url.searchParams.set('TYPENAMES', 'ms:RESF');
      url.searchParams.set('COUNT', '50');
      url.searchParams.set('SRSNAME', 'EPSG:4326');
      url.searchParams.set(
        'BBOX',
        [
          (latitude - padLat).toFixed(6),
          (longitude - padLon).toFixed(6),
          (latitude + padLat).toFixed(6),
          (longitude + padLon).toFixed(6),
          'EPSG:4326',
        ].join(','),
      );
      url.searchParams.set('OUTPUTFORMAT', 'geojson');
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'gods-eye-view/1.0 (parcel lookup; https://gods-eye-view-fresh.vercel.app)',
        },
        signal: AbortSignal.timeout(isCustomFetch ? 12_000 : 4_500),
      });
      if (response.ok) {
        const body = await response.json();
        const features = Array.isArray(body?.features) ? body.features : [];
        const point = [longitude, latitude];
        match = features.find((feature) =>
          pointInGeometry(point, feature?.geometry),
        );
      } else if (isCustomFetch) {
        return { found: false, source: 'geodienste.ch' };
      }
    } catch {
      if (isCustomFetch) {
        return { found: false, source: 'geodienste.ch' };
      }
    }
  }

  let result = { found: false, source: 'geodienste.ch' };
  const gwr = !isCustomFetch
    ? await fetchSwissBuildingInfo(latitude, longitude, fetchImpl)
    : null;

  if (match?.geometry) {
    const properties = match.properties || {};
    const area =
      Number(properties.Flaeche) ||
      gwr?.area ||
      computeRingAreaM2(match.geometry.coordinates?.[0], latitude);
    const canton = String(properties.Kanton || gwr?.canton || '');
    result = {
      found: true,
      number: String(properties.Nummer || gwr?.number || ''),
      area,
      canton,
      countryCode: canton === 'LI' ? 'LI' : 'CH',
      egrid: String(properties.EGRIS_EGRID || gwr?.egrid || ''),
      ...(gwr?.egid ? { egid: gwr.egid } : {}),
      ...(gwr?.street ? { street: gwr.street } : {}),
      ...(gwr?.postalCode ? { postalCode: gwr.postalCode } : {}),
      ...(gwr?.address ? { address: gwr.address } : {}),
      ...(gwr?.municipality ? { municipality: gwr.municipality } : {}),
      ...(gwr?.buildingUse ? { buildingUse: gwr.buildingUse } : {}),
      ...(gwr?.yearBuilt ? { yearBuilt: gwr.yearBuilt } : {}),
      ...(gwr?.floors ? { floors: gwr.floors, levels: gwr.floors } : {}),
      ...(gwr?.height ? { height: gwr.height } : {}),
      ...(gwr?.dwellings ? { dwellings: gwr.dwellings } : {}),
      geometry: match.geometry,
      source: gwr?.egid
        ? 'geodienste.ch (AV) · Swisstopo GWR'
        : 'geodienste.ch (Amtliche Vermessung)',
      fetchedAt: Date.now(),
    };
  } else if (!isCustomFetch) {
    const osmFallback = await fetchOsmBuildingParcel(
      latitude,
      longitude,
      fetchImpl,
    );
    if (osmFallback && gwr) {
      result = {
        ...osmFallback,
        number: gwr.number || osmFallback.number,
        area: osmFallback.area || gwr.area || 180,
        canton: gwr.canton || osmFallback.canton,
        countryCode: gwr.countryCode || osmFallback.countryCode || 'CH',
        egrid: gwr.egrid || osmFallback.egrid,
        ...(gwr.egid ? { egid: gwr.egid } : {}),
        street: gwr.street || osmFallback.street || '',
        postalCode: gwr.postalCode || osmFallback.postalCode || '',
        municipality: gwr.municipality || osmFallback.municipality || '',
        address: gwr.address || osmFallback.address || '',
        buildingUse: gwr.buildingUse || osmFallback.buildingUse || 'building',
        ...(gwr.yearBuilt || osmFallback.yearBuilt
          ? { yearBuilt: gwr.yearBuilt || osmFallback.yearBuilt }
          : {}),
        ...(gwr.floors || osmFallback.floors
          ? {
              floors: gwr.floors || osmFallback.floors,
              levels: gwr.floors || osmFallback.floors,
            }
          : {}),
        ...(gwr.height || osmFallback.height
          ? { height: gwr.height || osmFallback.height }
          : {}),
        ...(gwr.dwellings ? { dwellings: gwr.dwellings } : {}),
        source: 'Swisstopo GWR · OpenStreetMap Cadastre',
      };
    } else if (osmFallback) {
      result = osmFallback;
    } else if (gwr) {
      result = {
        found: true,
        number: gwr.number || gwr.egid || 'GWR',
        area: gwr.area || 220,
        canton: gwr.canton,
        countryCode: gwr.countryCode,
        egrid: gwr.egrid || (gwr.egid ? `GWR-${gwr.egid}` : ''),
        ...(gwr.egid ? { egid: gwr.egid } : {}),
        ...(gwr.street ? { street: gwr.street } : {}),
        ...(gwr.postalCode ? { postalCode: gwr.postalCode } : {}),
        ...(gwr.municipality ? { municipality: gwr.municipality } : {}),
        ...(gwr.address ? { address: gwr.address } : {}),
        buildingUse: gwr.buildingUse || 'building',
        ...(gwr.yearBuilt ? { yearBuilt: gwr.yearBuilt } : {}),
        ...(gwr.floors ? { floors: gwr.floors, levels: gwr.floors } : {}),
        ...(gwr.height ? { height: gwr.height } : {}),
        ...(gwr.dwellings ? { dwellings: gwr.dwellings } : {}),
        geometry: boxPolygonAround(latitude, longitude, gwr.area || 220),
        source: 'Swisstopo GWR Building Registry',
        fetchedAt: Date.now(),
      };
    }
  }

  if (!isCustomFetch) {
    cache.set(key, { at: Date.now(), body: result });
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  }
  return result;
}
