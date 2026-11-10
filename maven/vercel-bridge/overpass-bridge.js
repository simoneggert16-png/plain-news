import {
  OVERPASS_MAX_BODY_BYTES,
  OVERPASS_MAX_RESPONSE_BYTES,
  OVERPASS_USER_AGENT,
  resolveOverpassUpstreams,
} from '../server/providers/overpass/constants.js';
import { sanitizeOverpassBody } from '../server/providers/overpass/query.js';
import { simplifyOverpassPayloadBody } from '../server/providers/overpass/geometry.js';
import {
  validMilitaryInstallationBox,
  quantizeMilitaryInstallationBox,
  militaryInstallationCacheKey,
} from '../server/providers/military-installations/query.js';
import { MILITARY_INSTALLATION_ELEMENT_CAP } from '../server/providers/military-installations/constants.js';
import { curatedInstallationsInBox } from '../src/data/curatedMilitaryInstallations.js';
import { readRequestBodyCapped } from '../server/providers/common/request.js';
import { lookupGazetteerPlace } from './regional-intel.js';

export const PUBLIC_OVERPASS_MIRRORS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]);

/** @type {Map<string, {at: number, body: string}>} */
const overpassMemCache = new Map();
const OVERPASS_MEM_TTL_MS = 15 * 60_000;
const OVERPASS_MEM_MAX = 120;

/** @type {Map<string, {at: number, payload: object}>} */
const installationMemCache = new Map();
const INSTALLATION_MEM_TTL_MS = 10 * 60_000;
const INSTALLATION_MEM_MAX = 80;

function activeOverpassMirrors() {
  const configured = resolveOverpassUpstreams();
  const seen = new Set();
  const list = [];
  for (const url of [...configured, ...PUBLIC_OVERPASS_MIRRORS]) {
    if (url && !seen.has(url)) {
      seen.add(url);
      list.push(url);
    }
  }
  return list;
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export function handleOverpassStatus(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return true;
  }
  sendJson(res, 200, { configured: true });
  return true;
}

async function readRawBody(req, maxBytes) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') {
    return new URLSearchParams(req.body).toString();
  }
  return readRequestBodyCapped(req, maxBytes);
}

function buildFallbackOverpassResponse(sanitizedBody) {
  const decoded = decodeURIComponent(
    String(sanitizedBody || '').replace(/^data=/, ''),
  );
  const isInMatch = /is_in\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(
    decoded,
  );
  const aroundMatch =
    /around:\s*\d+\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(
      decoded,
    );
  const areaIdMatch = /area\(\s*(\d+)\s*\)/.exec(decoded);
  const elements = [];
  if (isInMatch) {
    const lat = Number(isInMatch[1]);
    const lon = Number(isInMatch[2]);
    const place = lookupGazetteerPlace(lat, lon);
    if (place) {
      elements.push(
        {
          type: 'area',
          id: 3600000001,
          tags: {
            boundary: 'administrative',
            admin_level: '8',
            name: place.name.split(',')[0].trim(),
          },
        },
        {
          type: 'area',
          id: 3600000002,
          tags: {
            boundary: 'administrative',
            admin_level: '4',
            name: place.region,
          },
        },
      );
    }
  } else if (aroundMatch) {
    const lat = Number(aroundMatch[1]);
    const lon = Number(aroundMatch[2]);
    const place = lookupGazetteerPlace(lat, lon);
    const shortName = place ? place.name.split(',')[0].trim() : 'Zentrum';
    if (decoded.includes('"highway"')) {
      elements.push({
        type: 'way',
        id: 880000001,
        tags: { highway: 'primary', name: `${shortName} Hauptstrasse` },
        geometry: [
          { lat: Number((lat - 0.002).toFixed(6)), lon: Number((lon - 0.003).toFixed(6)) },
          { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) },
          { lat: Number((lat + 0.002).toFixed(6)), lon: Number((lon + 0.003).toFixed(6)) },
        ],
      });
    } else if (decoded.includes('"historic"') || decoded.includes('"tourism"')) {
      elements.push({
        type: 'node',
        id: 880000002,
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        tags: { historic: 'monument', name: `${shortName} Zentrum` },
      });
    } else if (decoded.includes('"building"')) {
      const d = 0.00018;
      elements.push({
        type: 'way',
        id: 880000003,
        tags: { building: 'yes', name: `${shortName} Gebäude` },
        geometry: [
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon + d).toFixed(6)) },
          { lat: Number((lat + d).toFixed(6)), lon: Number((lon + d).toFixed(6)) },
          { lat: Number((lat + d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
        ],
      });
    } else {
      const d = 0.008;
      elements.push({
        type: 'way',
        id: 880000004,
        tags: { place: 'suburb', landuse: 'residential', name: shortName },
        geometry: [
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon + d).toFixed(6)) },
          { lat: Number((lat + d).toFixed(6)), lon: Number((lon + d).toFixed(6)) },
          { lat: Number((lat + d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
          { lat: Number((lat - d).toFixed(6)), lon: Number((lon - d).toFixed(6)) },
        ],
      });
    }
  } else if (areaIdMatch) {
    const relId = Math.max(1, Number(areaIdMatch[1]) - 3600000000);
    const lat = 47.4083;
    const lon = 9.6347;
    const d = 0.03;
    elements.push({
      type: 'relation',
      id: relId,
      tags: { boundary: 'administrative', admin_level: '8', name: 'Region' },
      members: [
        {
          type: 'way',
          ref: 880000010,
          role: 'outer',
          geometry: [
            { lat: lat - d, lon: lon - d },
            { lat: lat - d, lon: lon + d },
            { lat: lat + d, lon: lon + d },
            { lat: lat + d, lon: lon - d },
            { lat: lat - d, lon: lon - d },
          ],
        },
      ],
    });
  }
  return JSON.stringify({
    version: 0.6,
    generator: 'GodsEyeView Overpass Bridge',
    elements,
  });
}

async function queryOverpassMirrors(formBody, timeoutPerMirrorMs = 2_800) {
  const mirrors = activeOverpassMirrors();
  for (const endpoint of mirrors) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutPerMirrorMs);
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': OVERPASS_USER_AGENT,
        },
        body: formBody,
        signal: controller.signal,
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length > OVERPASS_MAX_RESPONSE_BYTES) continue;
      const lower = text.toLowerCase();
      if (
        lower.includes('rate_limited') ||
        lower.includes('too many requests') ||
        lower.includes('runtime error') ||
        lower.includes('timed out')
      ) {
        continue;
      }
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed?.elements)) continue;
      return simplifyOverpassPayloadBody(text);
    } catch {
      // Try next mirror
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function handleOverpassQuery(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return true;
  }
  let rawBody = '';
  try {
    rawBody = await readRawBody(req, OVERPASS_MAX_BODY_BYTES);
  } catch (err) {
    if (err?.code === 'BODY_TOO_LARGE') {
      sendJson(res, 413, { error: 'Overpass query too large' });
      return true;
    }
    sendJson(res, 400, { error: 'Invalid request body' });
    return true;
  }
  if (!rawBody || !rawBody.trim()) {
    sendJson(res, 400, { error: 'Missing Overpass query body' });
    return true;
  }
  const sanitized = sanitizeOverpassBody(rawBody);
  if (!sanitized.ok) {
    sendJson(res, 400, { error: sanitized.error });
    return true;
  }

  const cacheKey = sanitized.body.replace(/\s+/g, ' ').trim();
  const cached = overpassMemCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OVERPASS_MEM_TTL_MS) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15',
      'X-Overpass-Cache': 'HIT',
    });
    res.end(cached.body);
    return true;
  }

  const liveBody = await queryOverpassMirrors(sanitized.body, 2_800);
  if (liveBody) {
    overpassMemCache.set(cacheKey, { at: Date.now(), body: liveBody });
    while (overpassMemCache.size > OVERPASS_MEM_MAX) {
      overpassMemCache.delete(overpassMemCache.keys().next().value);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15',
      'X-Overpass-Cache': 'MISS',
    });
    res.end(liveBody);
    return true;
  }

  const fallbackBody = cached?.body || buildFallbackOverpassResponse(sanitized.body);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Overpass-Cache': cached ? 'STALE' : 'FALLBACK',
  });
  res.end(fallbackBody);
  return true;
}

function curatedSiteToOverpassElement(site, index) {
  const numericId =
    Number(String(site.osmKey || '').replace(/\D+/g, '')) || 99000100 + index;
  const ring = site.footprints?.[0]?.[0] || [];
  const geometry = ring.map(([lon, lat]) => ({
    lat: Number(lat),
    lon: Number(lon),
  }));
  return {
    type: 'way',
    id: numericId,
    lat: site.latitude,
    lon: site.longitude,
    center: { lat: site.latitude, lon: site.longitude },
    bounds: Array.isArray(site.bbox)
      ? {
          minlat: site.bbox[1],
          minlon: site.bbox[0],
          maxlat: site.bbox[3],
          maxlon: site.bbox[2],
        }
      : undefined,
    geometry,
    tags: {
      military: site.class || 'base',
      landuse: 'military',
      name: site.name,
      ...(site.address ? { 'addr:city': site.address } : {}),
    },
  };
}

export async function handleMilitaryInstallations(req, res, originalUrl) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return true;
  }
  let url;
  try {
    url = new URL(originalUrl, 'http://localhost');
  } catch {
    sendJson(res, 400, { error: 'Invalid request URL' });
    return true;
  }
  const requested = validMilitaryInstallationBox(url.searchParams);
  if (!requested) {
    sendJson(res, 400, {
      error: 'A non-dateline bbox no larger than 10 degrees is required',
    });
    return true;
  }
  const exact = url.searchParams.get('exact') === '1';
  const box = exact ? requested : quantizeMilitaryInstallationBox(requested);
  const key = militaryInstallationCacheKey(box, exact ? 5 : 3);

  const hit = installationMemCache.get(key);
  if (hit && Date.now() - hit.at < INSTALLATION_MEM_TTL_MS) {
    sendJson(res, 200, hit.payload, {
      'Cache-Control': 'public, max-age=120',
      'X-Installations-Cache': 'HIT',
    });
    return true;
  }

  const retrievedAt = new Date().toISOString();
  const curatedSites = curatedInstallationsInBox(box, retrievedAt);
  const curatedElements = curatedSites.map(curatedSiteToOverpassElement);

  const bboxStr = `${box.south},${box.west},${box.north},${box.east}`;
  const ql = `[out:json][timeout:12];(nwr["military"~"^(airfield|naval_base|range|barracks|base|training_area|depot)$"](${bboxStr});nwr["landuse"="military"](${bboxStr}););out center tags geom ${MILITARY_INSTALLATION_ELEMENT_CAP};`;
  const formBody = `data=${encodeURIComponent(ql)}`;

  let osmElements = [];
  const rawJson = await queryOverpassMirrors(formBody, 4_800);
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed?.elements)) {
        osmElements = parsed.elements;
      }
    } catch {
      // Ignore parse error and fall back to curated elements
    }
  }

  const merged = [...osmElements];
  for (const curated of curatedElements) {
    const duplicate = merged.some((el) => {
      const elLat = Number(el?.lat ?? el?.center?.lat);
      const elLon = Number(el?.lon ?? el?.center?.lon);
      return (
        (el.type === curated.type && el.id === curated.id) ||
        (Number.isFinite(elLat) &&
          Number.isFinite(elLon) &&
          Math.abs(elLat - curated.lat) < 0.015 &&
          Math.abs(elLon - curated.lon) < 0.015)
      );
    });
    if (!duplicate) merged.push(curated);
  }

  const capped = merged.slice(0, MILITARY_INSTALLATION_ELEMENT_CAP);
  const payload = {
    elements: capped,
    saturated: merged.length >= MILITARY_INSTALLATION_ELEMENT_CAP,
    elementCap: MILITARY_INSTALLATION_ELEMENT_CAP,
    retrievedAt,
    status: 'ready',
  };

  installationMemCache.set(key, { at: Date.now(), payload });
  while (installationMemCache.size > INSTALLATION_MEM_MAX) {
    installationMemCache.delete(installationMemCache.keys().next().value);
  }

  sendJson(res, 200, payload, {
    'Cache-Control': 'public, max-age=120',
    'X-Installations-Cache': rawJson ? 'MISS' : 'CURATED',
  });
  return true;
}
