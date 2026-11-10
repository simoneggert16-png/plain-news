/**
 * TomTom-backed adapter for the Google Places / Geocoding proxy routes.
 *
 * Why this exists
 * ---------------
 * `/api/google/nearby-places`, `/api/google/text-search`,
 * `/api/google/reverse-geocode` and `/api/google/geocode` are thin, key-holding
 * proxies over Google's paid Places + Geocoding APIs. Without a
 * `GOOGLE_MAPS_API_KEY` (or the split `GOOGLE_SERVER_API_KEY`) upstream answers
 * `{configured:false, places:[]}` — a deliberate, correct keyless contract. The
 * consequence on the client is silent: annotation resolution
 * (`src/annotations/resolver.js` → `placesTextSearch`) and the nearby-place
 * context simply never resolve, so labelled features stay unnamed.
 *
 * A TomTom Search key IS configured on this deployment (it already powers
 * `/api/route` and the traffic-flow tiles), and TomTom Search v2 offers the same
 * three primitives: POI text search with geo-bias, nearby search, and reverse
 * geocoding. So the bridge answers those routes from TomTom, translated into the
 * exact payload shapes upstream's own projectors emit, and steps aside the
 * moment a real Google key appears.
 *
 * Boundaries
 * ----------
 * - No upstream file is modified; this is a pre-dispatch hook in the bridge, the
 *   same pattern as the OpenSky egress shim and the AIS warm-up.
 * - It only activates when Google is NOT configured. With a Google key present,
 *   `handlePlacesRequest` returns false and upstream serves the route unchanged.
 * - The TomTom key never leaves the server, never appears in a cache key, a log
 *   line, or a response body.
 * - Bounded: in-memory LRU + per-client rate limit + a per-instance daily cap on
 *   billed upstream calls, so a runaway client cannot exhaust the TomTom budget
 *   that the traffic layer also depends on.
 */

import {
  makeRateLimiter,
  clientKey,
} from '../server/providers/common/rate-limit.js';
import { admitSameSite } from '../server/providers/common/same-site.js';
import { googleServerApiKey } from '../server/providers/places/google-key.js';
import {
  typesFromNominatim,
  viewportFromNominatim,
} from '../src/nominatimGeocode.js';
import { matchStrategicFacility } from './frontline.js';

const TOMTOM_SEARCH_BASE = 'https://api.tomtom.com/search/2';

/** Routes this adapter owns. Anything else falls through to upstream. */
const ADAPTED = new Set([
  '/api/google/nearby-places',
  '/api/google/text-search',
  '/api/google/reverse-geocode',
  '/api/google/geocode',
]);

const CACHE_MAX_ENTRIES = 400;
const CACHE_TTL_MS = 10 * 60_000;
const NEGATIVE_TTL_MS = 60_000;
/** Billed upstream calls per instance-day. Cache hits never count. */
const DAILY_UPSTREAM_CAP = 1500;
const MAX_RESULTS = 20;
const REQUEST_TIMEOUT_MS = 12_000;

const cache = new Map();
let dailyCount = 0;
let dailyKey = null;

const limiter = makeRateLimiter({
  windowMs: 60_000,
  max: 30,
  globalMax: 90,
});

/** UTC day key, matching the TomTom budget governor's rollover semantics. */
function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function rollDaily(now = Date.now()) {
  const key = utcDayKey(now);
  if (key !== dailyKey) {
    dailyKey = key;
    dailyCount = 0;
  }
}

function cacheRead(key, now = Date.now()) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > (hit.negative ? NEGATIVE_TTL_MS : CACHE_TTL_MS)) {
    cache.delete(key);
    return undefined;
  }
  // Refresh recency so hot entries survive eviction.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheWrite(key, payload, negative = false) {
  cache.set(key, { payload, negative, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Great-circle distance in metres; upstream's projectors compute this themselves
 * from the coordinates, so the field only has to be plausible and finite.
 */
function approximateDistanceM(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function finiteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    typeof value === 'boolean'
  ) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * TomTom POI result → the place object upstream's `projectNearbyPlaces` /
 * `projectTextSearchPlaces` produce. Field names and nullability match exactly,
 * because that is what `src/search/http.js` and the annotation resolver read.
 */
function tomtomPlace(result, anchorLat, anchorLon) {
  const latitude = finiteNumber(result?.position?.lat);
  const longitude = finiteNumber(result?.position?.lon);
  if (latitude === null || longitude === null) return null;

  const poi = result?.poi || {};
  const address = result?.address || {};
  const categories = Array.isArray(poi.categories) ? poi.categories : [];
  const classifications = Array.isArray(poi.classifications)
    ? poi.classifications
    : [];

  // TomTom's viewport is NW/SE corners; Google's contract is low (SW) / high
  // (NE). Swap the longitudes so the box is the same rectangle.
  const topLeft = result?.viewport?.topLeftPoint;
  const bottomRight = result?.viewport?.btmRightPoint;
  const viewport =
    finiteNumber(topLeft?.lat) !== null &&
    finiteNumber(topLeft?.lon) !== null &&
    finiteNumber(bottomRight?.lat) !== null &&
    finiteNumber(bottomRight?.lon) !== null
      ? {
          low: {
            latitude: finiteNumber(bottomRight.lat),
            longitude: finiteNumber(topLeft.lon),
          },
          high: {
            latitude: finiteNumber(topLeft.lat),
            longitude: finiteNumber(bottomRight.lon),
          },
        }
      : null;

  return {
    id: result?.id || null,
    name: poi.name || null,
    address: address.freeformAddress || null,
    latitude,
    longitude,
    distanceM:
      finiteNumber(result?.dist) !== null
        ? Math.round(Number(result.dist))
        : approximateDistanceM(anchorLat, anchorLon, latitude, longitude),
    primaryType: classifications[0]?.code || categories[0] || null,
    types: categories.slice(0, 8),
    viewport,
  };
}

/** Project a TomTom Search answer into upstream's `{places:[…]}` payload. */
function projectPlaces(data, anchorLat, anchorLon) {
  const seen = new Set();
  const places = [];
  for (const raw of Array.isArray(data?.results) ? data.results : []) {
    const place = tomtomPlace(raw, anchorLat, anchorLon);
    if (!place || !place.name) continue;
    const key = `${place.name}:${place.address || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(place);
    if (places.length >= MAX_RESULTS) break;
  }
  // Nearest first, mirroring the DISTANCE rank preference upstream requests.
  places.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  return places;
}

/**
 * TomTom reverse-geocode address → Google Geocoding result.
 * `normalizeGoogleReverse` in `src/search/http.js` requires `status:'OK'`,
 * `results[0].formatted_address`, `results[0].address_components` with
 * `long_name` + `types`, and reads `types` off each result.
 */
function tomtomReverseToGoogle(data) {
  const addresses = Array.isArray(data?.addresses) ? data.addresses : [];
  const results = [];
  for (const entry of addresses) {
    const a = entry?.address || {};
    const position = entry?.position || {};
    const lat = finiteNumber(position.lat);
    const lng = finiteNumber(position.lon);
    const components = [
      { long_name: a.streetName, types: ['route'] },
      { long_name: a.streetNumber, types: ['street_number'] },
      { long_name: a.neighbourhood, types: ['neighborhood'] },
      { long_name: a.municipalitySubdivision, types: ['sublocality'] },
      { long_name: a.municipality, types: ['locality'] },
      {
        long_name: a.countrySecondarySubdivision,
        types: ['administrative_area_level_2'],
      },
      {
        long_name: a.countrySubdivision,
        types: ['administrative_area_level_1'],
      },
      { long_name: a.postalCode, types: ['postal_code'] },
      { long_name: a.country, types: ['country'] },
      { long_name: a.countryCodeISO3, types: ['country_iso3'] },
    ]
      .filter((component) => component.long_name)
      .map((component) => ({
        long_name: String(component.long_name),
        short_name: String(component.long_name),
        types: component.types,
      }));
    results.push({
      formatted_address: a.freeformAddress || null,
      address_components: components,
      types: a.countryCode ? ['address'] : [],
      geometry:
        lat !== null && lng !== null
          ? { location: { lat, lng } }
          : { location: null },
    });
    if (results.length >= 12) break;
  }
  return {
    status: results.length ? 'OK' : 'ZERO_RESULTS',
    results,
    provider: 'tomtom',
  };
}

const STREET_ABBR_CANONICAL = Object.freeze({
  str: 'strasse',
  st: 'street',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  blvd: 'boulevard',
  bd: 'boulevard',
  dr: 'drive',
  ln: 'lane',
  ct: 'court',
  pl: 'platz',
  pkwy: 'parkway',
  hwy: 'highway',
  sq: 'square',
  nw: 'northwest',
  ne: 'northeast',
  sw: 'southwest',
  se: 'southeast',
});

const SPOKEN_GERMAN_HOUSE_NUMBERS = Object.freeze({
  eins: '1',
  zwei: '2',
  drei: '3',
  vier: '4',
  fünf: '5',
  fuenf: '5',
  sechs: '6',
  sieben: '7',
  acht: '8',
  neun: '9',
  zehn: '10',
  elf: '11',
  zwölf: '12',
  zwoelf: '12',
  dreizehn: '13',
  vierzehn: '14',
  fünfzehn: '15',
  sechzehn: '16',
  siebzehn: '17',
  achtzehn: '18',
  neunzehn: '19',
  zwanzig: '20',
});

function normalizeSpokenAddressQuery(text) {
  let out = String(text || '').trim();
  if (!out) return '';
  // Join split German compound street suffixes: "Brüggli Weg" -> "Brüggliweg"
  out = out.replace(
    /\b([A-ZÄÖÜ][a-zäöüß]{2,})\s+(Weg|Strasse|Straße|Gasse|Platz|Allee|Ring|Rain|Stutz|Halde|Boden|Ried)\b/gi,
    (_, stem, suffix) => `${stem}${suffix.toLowerCase()}`,
  );
  // Convert spoken German house numbers after street words or "Hausnummer/Nr"
  out = out.replace(
    /\b([a-zA-ZäöüÄÖÜß]{3,}(?:weg|strasse|straße|str|gasse|platz|allee|ring|hof|stutz|rain|halde|matte|boden|ried|wiese)|hausnummer|nummer|nr\.?)\s+(eins|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig)\b/gi,
    (full, prefix, word) => {
      const digit = SPOKEN_GERMAN_HOUSE_NUMBERS[word.toLowerCase()];
      return digit ? `${prefix} ${digit}` : full;
    },
  );
  return out;
}

function toSwissPhoneticSpelling(text) {
  return String(text || '')
    .replace(/([Bb]r[üu])(?:ck|g)li/g, '$1ggli')
    .replace(/([a-zA-ZäöüÄÖÜ])ckli(weg|strasse|straße|gasse|platz|rain|stutz)?\b/g, '$1ggli$2')
    .replace(/([aeiouäöüAEIOUÄÖÜ])gli(weg|strasse|straße|gasse|platz|rain|stutz)\b/g, '$1ggli$2')
    .replace(/\b([Bb]r[üu])ck(weg|strasse|straße|gasse|platz|ach|en)\b/g, '$1gg$2');
}

function normalizeAddressToken(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z]{3,})str\b/g, '$1strasse')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePhoneticToken(text) {
  return normalizeAddressToken(toSwissPhoneticSpelling(normalizeSpokenAddressQuery(text)))
    .replace(/\b([a-z]{3,})\s+(weg|strasse|gasse|platz|allee|ring|rain|stutz|halde)\b/g, '$1$2');
}

function canonicalizeStreetWords(token) {
  return normalizeAddressToken(token)
    .split(' ')
    .filter(Boolean)
    .map((w) => STREET_ABBR_CANONICAL[w] || w);
}

function extractQueryStreetAndNumber(query) {
  const raw = normalizeSpokenAddressQuery(query);
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const head = parts[0] || '';
  // Format 1 (European / Latin American / DACH): "<Street> <Number>"
  const streetFirst = head.match(
    /^([a-zA-ZäöüÄÖÜßéèàâêîôûçñáíóúãõ.\-\s]{3,}?)\s+(\d{1,6}[a-zA-Z]?)(?:\s+(.*))?$/,
  );
  if (streetFirst) {
    const streetToken = normalizeAddressToken(streetFirst[1]);
    if (streetToken && streetToken.length >= 3) {
      const houseNumber = normalizeAddressToken(streetFirst[2]);
      const tailText = [streetFirst[3] || '', ...parts.slice(1)].join(' ');
      const locationWords = normalizeAddressToken(tailText)
        .split(' ')
        .filter((w) => w.length >= 2);
      return {
        streetToken,
        streetWords: canonicalizeStreetWords(streetFirst[1]),
        houseNumber,
        locationWords,
      };
    }
  }
  // Format 2 (Anglo / French / Global): "<Number> <Street>"
  const numberFirst = head.match(
    /^(\d{1,6}[a-zA-Z]?)\s+([a-zA-Z0-9äöüÄÖÜßéèàâêîôûçñáíóúãõ.\-\s]{3,})$/,
  );
  if (numberFirst) {
    const streetToken = normalizeAddressToken(numberFirst[2]);
    if (streetToken && streetToken.length >= 3 && /[a-z]/i.test(streetToken)) {
      const houseNumber = normalizeAddressToken(numberFirst[1]);
      const tailText = parts.slice(1).join(' ');
      const locationWords = normalizeAddressToken(tailText)
        .split(' ')
        .filter((w) => w.length >= 2);
      return {
        streetToken,
        streetWords: canonicalizeStreetWords(numberFirst[2]),
        houseNumber,
        locationWords,
      };
    }
  }
  // Format 3 ("<Street>, <Number>, <City>"):
  if (parts.length >= 2 && /^\d{1,6}[a-zA-Z]?$/.test(parts[1])) {
    const streetToken = normalizeAddressToken(parts[0]);
    if (streetToken && streetToken.length >= 3) {
      const houseNumber = normalizeAddressToken(parts[1]);
      const locationWords = normalizeAddressToken(parts.slice(2).join(' '))
        .split(' ')
        .filter((w) => w.length >= 2);
      return {
        streetToken,
        streetWords: canonicalizeStreetWords(parts[0]),
        houseNumber,
        locationWords,
      };
    }
  }
  return null;
}

function streetMatchesCandidate(candidateText, streetInfo) {
  if (!streetInfo) return true;
  const normCandidate = normalizeAddressToken(candidateText);
  if (!normCandidate) return false;
  if (normCandidate.includes(streetInfo.streetToken)) return true;
  const phonCandidate = normalizePhoneticToken(candidateText);
  const phonStreet = normalizePhoneticToken(streetInfo.streetToken);
  if (phonStreet && phonCandidate.includes(phonStreet)) return true;
  const candidateWords = new Set(canonicalizeStreetWords(candidateText));
  const queryWords = streetInfo.streetWords || [];
  if (!queryWords.length) return false;
  return queryWords.every((w) => {
    const pw = normalizePhoneticToken(w);
    return (
      candidateWords.has(w) ||
      normCandidate.includes(w) ||
      (pw && phonCandidate.includes(pw)) ||
      (w === 'platz' && candidateWords.has('place')) ||
      (w === 'avenue' && candidateWords.has('avenida'))
    );
  });
}

function houseNumberMatchesCandidate(candidateText, houseNumber) {
  if (!houseNumber) return true;
  const norm = normalizeAddressToken(candidateText);
  return new RegExp(`\\b${houseNumber}\\b`).test(norm);
}

function parseBiasCenter(params) {
  const directLat = finiteNumber(params?.get?.('lat'));
  const directLon = finiteNumber(params?.get?.('lon'));
  if (directLat !== null && directLon !== null) {
    return { lat: directLat, lon: directLon };
  }
  const bounds = String(params?.get?.('bounds') || '').trim();
  const corners = bounds.split('|');
  if (corners.length === 2) {
    const [swLat, swLon] = corners[0].split(',').map(Number);
    const [neLat, neLon] = corners[1].split(',').map(Number);
    if ([swLat, swLon, neLat, neLon].every(Number.isFinite)) {
      return {
        lat: (swLat + neLat) / 2,
        lon: (swLon + neLon) / 2,
      };
    }
  }
  return null;
}

/** Forward geocode → the same Google shape `createGoogleGeocoder` consumes. */
function tomtomForwardToGoogle(data, query = '') {
  const streetInfo = extractQueryStreetAndNumber(query);
  const results = [];
  for (const entry of Array.isArray(data?.results) ? data.results : []) {
    const a = entry?.address || {};
    const position = entry?.position || {};
    const lat = finiteNumber(position.lat);
    const lng = finiteNumber(position.lon);
    if (lat === null || lng === null) continue;
    const candidateText = `${a.streetName || ''} ${a.streetNumber || ''} ${a.freeformAddress || ''} ${a.municipality || ''} ${a.country || ''}`;
    if (streetInfo && !streetMatchesCandidate(candidateText, streetInfo)) {
      continue;
    }
    const isStreetAddress = Boolean(a.streetNumber || streetInfo);
    results.push({
      formatted_address: a.freeformAddress || null,
      address_components: [
        a.municipality && {
          long_name: a.municipality,
          short_name: a.municipality,
          types: ['locality'],
        },
        a.countrySubdivision && {
          long_name: a.countrySubdivision,
          short_name: a.countrySubdivision,
          types: ['administrative_area_level_1'],
        },
        a.country && {
          long_name: a.country,
          short_name: a.countryCode || a.country,
          types: ['country'],
        },
      ].filter(Boolean),
      types:
        entry?.type === 'POI'
          ? ['point_of_interest']
          : isStreetAddress
            ? ['street_address', 'address']
            : ['address'],
      geometry: { location: { lat, lng } },
    });
    if (results.length >= 10) break;
  }
  return {
    status: results.length ? 'OK' : 'ZERO_RESULTS',
    results,
    provider: 'tomtom',
  };
}

/** Build a TomTom Search URL for one adapted route. Key excluded from cache keys. */
function tomtomUrlFor(pathname, params, key) {
  const lat = finiteNumber(params.get('lat'));
  const lon = finiteNumber(params.get('lon'));

  if (
    pathname === '/api/google/nearby-places' ||
    pathname === '/api/google/text-search'
  ) {
    if (lat === null || lon === null) return null;
    if (pathname === '/api/google/nearby-places') {
      const radius = Math.max(
        25,
        Math.min(5000, finiteNumber(params.get('radiusM')) ?? 250),
      );
      const url = new URL(`${TOMTOM_SEARCH_BASE}/nearbySearch/.json`);
      url.searchParams.set('key', key);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('limit', String(MAX_RESULTS));
      return url;
    }
    const query = String(params.get('q') || '').trim();
    if (!query || query.length > 200) return null;
    // TomTom's geo-bias radius is much wider than Google's nearby circle; the
    // client passes a view-scale radius (default 6000 m), clamp to its range.
    const radius = Math.max(
      1000,
      Math.min(50_000, finiteNumber(params.get('radiusM')) ?? 6000),
    );
    const url = new URL(
      `${TOMTOM_SEARCH_BASE}/poiSearch/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set('key', key);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('limit', String(MAX_RESULTS));
    return url;
  }

  if (pathname === '/api/google/reverse-geocode') {
    if (lat === null || lon === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    const url = new URL(
      `${TOMTOM_SEARCH_BASE}/reverseGeocode/${lat},${lon}.json`,
    );
    url.searchParams.set('key', key);
    url.searchParams.set('radius', '1000');
    url.searchParams.set('limit', '5');
    return url;
  }

  // /api/google/geocode
  const query = String(params.get('address') || params.get('q') || '').trim();
  if (!query || query.length > 200) return null;
  const url = new URL(
    `${TOMTOM_SEARCH_BASE}/geocode/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '10');
  const biasCenter = parseBiasCenter(params);
  if (biasCenter) {
    url.searchParams.set('lat', String(biasCenter.lat));
    url.searchParams.set('lon', String(biasCenter.lon));
  }
  return url;
}

/** Cache identity: everything the answer depends on, never the key. */
function cacheKeyFor(pathname, params) {
  const parts = [pathname];
  for (const name of ['q', 'address', 'lat', 'lon', 'bounds', 'radiusM']) {
    parts.push(`${name}=${String(params.get(name) ?? '')}`);
  }
  return parts.join('|');
}

function project(pathname, data, params) {
  if (pathname === '/api/google/reverse-geocode')
    return tomtomReverseToGoogle(data);
  if (pathname === '/api/google/geocode') {
    const query = String(params.get('address') || params.get('q') || '').trim();
    return tomtomForwardToGoogle(data, query);
  }
  return {
    places: projectPlaces(
      data,
      finiteNumber(params.get('lat')),
      finiteNumber(params.get('lon')),
    ),
    error: null,
    provider: 'tomtom',
  };
}

function send(res, status, payload, { cacheable = true } = {}) {
  if (res.writableEnded || res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheable ? 'private, max-age=300' : 'no-store',
  });
  res.end(JSON.stringify(payload));
}

/**
 * True when this adapter is the right answer for the deployment: a TomTom key and
 * no Google server key. Checked per request so a later-added Google key takes
 * over on the next deploy without touching code.
 * @returns {string|null} The TomTom key when the adapter should serve, else null.
 */
function adapterActive() {
  const tomtom = String(process.env.TOMTOM_API_KEY || '').trim();
  if (!tomtom) return 'swisstopo';
  if (String(process.env.GOOGLE_MAPS_SERVER_API_KEY || '').trim()) return null;
  return tomtom;
}

const SWISS_PLACE_HINT_RE =
  /\b(r[üu]thi|heerbrugg|diepoldsau|widnau|balgach|berneck|rebstein|marbach|altst[äa]tten|oberriet|kriessern|st\.?\s*margrethen|au\s*sg|rheineck|altenrhein|rorschach|buchs|sargans|chur|st\.?\s*gallen|z[üu]rich|bern|basel|luzern|gen[èe]ve|genf|lausanne|lugano|winterthur|schweiz|switzerland|suisse|svizzera|rheintal|kandersteg|gotthard|spiez|thun|amsteg|vitznau|meiringen|payerne)\b/i;

function isBiasNearSwitzerland(biasCenter) {
  if (!biasCenter) return false;
  return (
    biasCenter.lat >= 45.7 &&
    biasCenter.lat <= 47.95 &&
    biasCenter.lon >= 5.85 &&
    biasCenter.lon <= 10.65
  );
}

async function swisstopoForwardGeocode(query) {
  try {
    const trimmedQuery = normalizeSpokenAddressQuery(query);
    if (/^(schweiz|switzerland|suisse|svizzera)$/i.test(trimmedQuery)) {
      return {
        status: 'OK',
        provider: 'swisstopo',
        results: [
          {
            formatted_address: 'Schweiz / Switzerland',
            address_components: [
              {
                long_name: 'Switzerland',
                short_name: 'CH',
                types: ['country', 'political'],
              },
            ],
            types: ['country', 'political'],
            geometry: {
              location: { lat: 46.8182, lng: 8.2275 },
              viewport: {
                southwest: { lat: 45.818, lng: 5.956 },
                northeast: { lat: 47.808, lng: 10.492 },
              },
            },
          },
        ],
      };
    }
    const streetInfo = extractQueryStreetAndNumber(trimmedQuery);
    const phoneticQuery = toSwissPhoneticSpelling(trimmedQuery);
    const searchCandidates = [trimmedQuery];
    if (phoneticQuery && phoneticQuery !== trimmedQuery) {
      searchCandidates.push(phoneticQuery);
    }
    let rows = [];
    for (const candidateQuery of searchCandidates) {
      const url = new URL(
        'https://api3.geo.admin.ch/rest/services/ech/SearchServer',
      );
      url.searchParams.set('type', 'locations');
      url.searchParams.set('searchText', candidateQuery);
      url.searchParams.set('limit', '10');
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!resp.ok) continue;
      const body = await resp.json();
      const batch = Array.isArray(body?.results) ? body.results : [];
      if (batch.length) {
        rows.push(...batch);
        // Stop early if we already found an address/parcel match
        if (batch.some((r) => r?.attrs?.origin === 'address' || r?.attrs?.origin === 'parcel')) {
          break;
        }
      }
    }
    const results = [];
    for (const row of rows) {
      const attrs = row?.attrs || {};
      const lat = finiteNumber(attrs.lat);
      const lng = finiteNumber(attrs.lon);
      if (lat === null || lng === null) continue;
      const cleanLabel = String(attrs.label || trimmedQuery)
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const normLabel = normalizePhoneticToken(
        `${cleanLabel} schweiz switzerland suisse svizzera ch`,
      );
      if (streetInfo) {
        if (!streetMatchesCandidate(cleanLabel, streetInfo)) continue;
        if (
          streetInfo.houseNumber &&
          !houseNumberMatchesCandidate(cleanLabel, streetInfo.houseNumber)
        ) {
          continue;
        }
        if (
          streetInfo.locationWords.length > 0 &&
          !streetInfo.locationWords.every((w) =>
            normLabel.includes(normalizePhoneticToken(w)),
          )
        ) {
          continue;
        }
      } else {
        const queryTokens = normalizePhoneticToken(trimmedQuery)
          .split(' ')
          .filter((w) => w.length >= 2);
        if (
          queryTokens.length > 0 &&
          !queryTokens.every((w) => normLabel.includes(w))
        ) {
          continue;
        }
      }
      const isAddress =
        attrs.origin === 'address' || attrs.origin === 'parcel';
      const isCanton = attrs.origin === 'kantone';
      const dLat = isAddress ? 0.0005 : isCanton ? 0.35 : 0.15;
      const dLng = isAddress ? 0.0007 : isCanton ? 0.5 : 0.22;
      results.push({
        formatted_address: `${cleanLabel}, Schweiz`,
        address_components: [
          {
            long_name: cleanLabel,
            short_name: cleanLabel,
            types: ['locality'],
          },
          {
            long_name: 'Switzerland',
            short_name: 'CH',
            types: ['country'],
          },
        ],
        types: isAddress
          ? ['street_address', 'address']
          : isCanton
            ? ['administrative_area_level_1', 'political']
            : ['locality', 'political'],
        geometry: {
          location: { lat, lng },
          viewport: {
            southwest: { lat: lat - dLat, lng: lng - dLng },
            northeast: { lat: lat + dLat, lng: lng + dLng },
          },
        },
        _rooftop: isAddress,
        _rankBonus: Math.max(0, 40 - results.length * 4),
        _provider: 'swisstopo',
      });
    }
    if (!results.length) return null;
    return { status: 'OK', results, provider: 'swisstopo' };
  } catch {
    return null;
  }
}

async function nominatimForwardGeocode(query, params) {
  try {
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) return null;
    const streetInfo = extractQueryStreetAndNumber(trimmedQuery);
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', trimmedQuery);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '8');
    url.searchParams.set('accept-language', 'de,en');
    const bounds = String(params?.get?.('bounds') || '').trim();
    const corners = bounds.split('|');
    if (corners.length === 2) {
      const [swLat, swLon] = corners[0].split(',').map(Number);
      const [neLat, neLon] = corners[1].split(',').map(Number);
      if ([swLat, swLon, neLat, neLon].every(Number.isFinite)) {
        url.searchParams.set('viewbox', `${swLon},${neLat},${neLon},${swLat}`);
        url.searchParams.set('bounded', '0');
      }
    }
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'gods-eye-view/1.0 (https://gods-eye-view-fresh.vercel.app)',
      },
      signal: AbortSignal.timeout(5_500),
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const results = [];
    for (const row of rows) {
      const lat = finiteNumber(row?.lat);
      const lng = finiteNumber(row?.lon);
      if (lat === null || lng === null) continue;
      const a = row?.address || {};
      const displayName = String(row?.display_name || trimmedQuery).trim();
      const candidateText = `${a.road || ''} ${a.house_number || ''} ${displayName}`;
      if (streetInfo && !streetMatchesCandidate(candidateText, streetInfo)) {
        continue;
      }
      const isAddress = Boolean(
        a.house_number ||
          row?.category === 'building' ||
          row?.type === 'house' ||
          streetInfo,
      );
      const mappedTypes = isAddress
        ? ['street_address', 'address']
        : typesFromNominatim(row);
      const viewport = isAddress ? null : viewportFromNominatim(row);
      results.push({
        formatted_address: displayName,
        address_components: [
          (a.city || a.town || a.village || a.municipality) && {
            long_name: String(a.city || a.town || a.village || a.municipality),
            short_name: String(a.city || a.town || a.village || a.municipality),
            types: ['locality'],
          },
          a.country && {
            long_name: String(a.country),
            short_name: String(a.country_code || a.country).toUpperCase(),
            types: ['country'],
          },
        ].filter(Boolean),
        types: mappedTypes,
        geometry: {
          location: { lat, lng },
          ...(viewport ? { bounds: viewport, viewport } : {}),
        },
        _rooftop: Boolean(a.house_number || row?.category === 'building'),
        _rankBonus: Math.max(0, 30 - results.length * 4),
        _provider: 'nominatim',
      });
    }
    if (!results.length) return null;
    return { status: 'OK', results, provider: 'nominatim' };
  } catch {
    return null;
  }
}

function scoreGeocodeCandidate(candidate, query, streetInfo, biasCenter) {
  const text = String(candidate?.formatted_address || '');
  const norm = normalizeAddressToken(text);
  let score = 0;
  if (streetInfo) {
    const streetOk = streetMatchesCandidate(text, streetInfo);
    const numberOk = houseNumberMatchesCandidate(text, streetInfo.houseNumber);
    if (streetOk && numberOk) score += 1200;
    else if (streetOk) score += 600;
    else score -= 1500;
    if (streetInfo.locationWords.length > 0) {
      const matchedLoc = streetInfo.locationWords.filter((w) =>
        norm.includes(w),
      ).length;
      if (matchedLoc === streetInfo.locationWords.length) score += 800;
      else score -= (streetInfo.locationWords.length - matchedLoc) * 900;
    }
  } else {
    const headWords = normalizeAddressToken(String(query || '').split(',')[0])
      .split(' ')
      .filter((w) => w.length >= 2);
    if (headWords.length && headWords.every((w) => norm.includes(w))) {
      score += 500;
    }
  }
  if (candidate?._rooftop) score += 250;
  if (Number.isFinite(candidate?._rankBonus)) score += candidate._rankBonus;
  if (biasCenter) {
    const lat = finiteNumber(candidate?.geometry?.location?.lat);
    const lng = finiteNumber(candidate?.geometry?.location?.lng);
    const distM = approximateDistanceM(biasCenter.lat, biasCenter.lon, lat, lng);
    if (distM !== null) {
      const distKm = distM / 1000;
      score +=
        distKm <= 25 ? 400 : Math.round(400 / (1 + (distKm - 25) / 25));
    }
  }
  return score;
}

async function resolveGlobalGeocode(query, params) {
  const trimmed = normalizeSpokenAddressQuery(query);
  if (!trimmed) return null;
  const strategic = matchStrategicFacility(trimmed);
  if (strategic?.results?.length) return strategic;

  const streetInfo = extractQueryStreetAndNumber(trimmed);
  const biasCenter = parseBiasCenter(params);
  const explicitSwiss = SWISS_PLACE_HINT_RE.test(trimmed);
  const shouldAskSwisstopo =
    explicitSwiss ||
    Boolean(streetInfo) ||
    isBiasNearSwitzerland(biasCenter) ||
    !biasCenter;

  const phoneticTrimmed = toSwissPhoneticSpelling(trimmed);
  const [swissResp, nomResp] = await Promise.all([
    shouldAskSwisstopo ? swisstopoForwardGeocode(trimmed) : Promise.resolve(null),
    nominatimForwardGeocode(phoneticTrimmed || trimmed, params),
  ]);

  const pool = [
    ...(Array.isArray(nomResp?.results) ? nomResp.results : []),
    ...(Array.isArray(swissResp?.results) ? swissResp.results : []),
  ];
  if (!pool.length) {
    return await photonForwardGeocode(trimmed);
  }
  pool.sort(
    (a, b) =>
      scoreGeocodeCandidate(b, trimmed, streetInfo, biasCenter) -
      scoreGeocodeCandidate(a, trimmed, streetInfo, biasCenter),
  );
  const winnerProvider = pool[0]?._provider || nomResp?.provider || 'nominatim';
  const cleaned = pool
    .slice(0, 10)
    .map(({ _rooftop, _rankBonus, _provider, ...rest }) => rest);
  return {
    status: 'OK',
    results: cleaned,
    provider: winnerProvider,
  };
}

async function photonForwardGeocode(query) {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'de');
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0',
      },
      signal: AbortSignal.timeout(6_000),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const features = Array.isArray(body?.features) ? body.features : [];
    const results = [];
    for (const f of features) {
      const coords = f?.geometry?.coordinates;
      const lng = finiteNumber(coords?.[0]);
      const lat = finiteNumber(coords?.[1]);
      if (lat === null || lng === null) continue;
      const p = f?.properties || {};
      const parts = [
        [p.street, p.housenumber].filter(Boolean).join(' ') || p.name,
        [p.postcode, p.city || p.town || p.village].filter(Boolean).join(' '),
        p.state,
        p.country,
      ].filter(Boolean);
      const label = parts.join(', ') || query;
      results.push({
        formatted_address: label,
        address_components: [
          p.name && {
            long_name: String(p.name),
            short_name: String(p.name),
            types: ['locality'],
          },
          p.country && {
            long_name: String(p.country),
            short_name: String(p.countrycode || p.country),
            types: ['country'],
          },
        ].filter(Boolean),
        types: p.street ? ['street_address', 'address'] : ['locality', 'political'],
        geometry: {
          location: { lat, lng },
        },
      });
    }
    if (!results.length) return null;
    return { status: 'OK', results, provider: 'photon' };
  } catch {
    return null;
  }
}

async function nominatimReverseGeocode(lat, lon) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'de,en');
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0 (https://gods-eye-view-fresh.vercel.app)',
      },
      signal: AbortSignal.timeout(5_500),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    if (!body?.display_name) return null;
    const a = body.address || {};
    const components = [
      a.road && { long_name: String(a.road), short_name: String(a.road), types: ['route'] },
      a.house_number && { long_name: String(a.house_number), short_name: String(a.house_number), types: ['street_number'] },
      (a.suburb || a.neighbourhood) && { long_name: String(a.suburb || a.neighbourhood), short_name: String(a.suburb || a.neighbourhood), types: ['neighborhood'] },
      (a.city || a.town || a.village || a.municipality) && {
        long_name: String(a.city || a.town || a.village || a.municipality),
        short_name: String(a.city || a.town || a.village || a.municipality),
        types: ['locality'],
      },
      a.state && { long_name: String(a.state), short_name: String(a.state), types: ['administrative_area_level_1'] },
      a.postcode && { long_name: String(a.postcode), short_name: String(a.postcode), types: ['postal_code'] },
      a.country && { long_name: String(a.country), short_name: String(a.country_code || a.country).toUpperCase(), types: ['country'] },
    ].filter(Boolean);
    return {
      status: 'OK',
      results: [
        {
          formatted_address: String(body.display_name),
          address_components: components,
          types: ['address'],
          geometry: { location: { lat: Number(body.lat ?? lat), lng: Number(body.lon ?? lon) } },
        },
      ],
      provider: 'nominatim',
    };
  } catch {
    return null;
  }
}

async function photonPlacesSearch(query, anchorLat, anchorLon, radiusM = null) {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    const effectiveQuery =
      query && query !== 'city' ? query : 'restaurant';
    url.searchParams.set('q', effectiveQuery);
    url.searchParams.set('limit', String(MAX_RESULTS));
    url.searchParams.set('lang', 'de');
    if (anchorLat !== null && anchorLon !== null) {
      url.searchParams.set('lat', String(anchorLat));
      url.searchParams.set('lon', String(anchorLon));
      const spanM = Math.max(2500, Math.min(80_000, Number(radiusM) || 15_000));
      const dLat = spanM / 111_320;
      const dLon =
        spanM /
        (111_320 * Math.max(0.15, Math.cos((anchorLat * Math.PI) / 180)));
      url.searchParams.set(
        'bbox',
        [
          (anchorLon - dLon).toFixed(4),
          (anchorLat - dLat).toFixed(4),
          (anchorLon + dLon).toFixed(4),
          (anchorLat + dLat).toFixed(4),
        ].join(','),
      );
    }
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view/1.0',
      },
      signal: AbortSignal.timeout(5_500),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const features = Array.isArray(body?.features) ? body.features : [];
    const places = [];
    for (const f of features) {
      const coords = f?.geometry?.coordinates;
      const longitude = finiteNumber(coords?.[0]);
      const latitude = finiteNumber(coords?.[1]);
      if (latitude === null || longitude === null) continue;
      const p = f?.properties || {};
      const name = String(p.name || p.street || p.city || '').trim();
      if (!name) continue;
      const address = [
        [p.street, p.housenumber].filter(Boolean).join(' '),
        [p.postcode, p.city || p.town || p.village].filter(Boolean).join(' '),
        p.country,
      ]
        .filter(Boolean)
        .join(', ');
      places.push({
        id: String(p.osm_id || `${latitude},${longitude}`),
        name,
        address: address || name,
        latitude,
        longitude,
        distanceM: approximateDistanceM(anchorLat, anchorLon, latitude, longitude),
        primaryType: p.osm_value || p.osm_key || 'point_of_interest',
        types: [p.osm_value, p.osm_key].filter(Boolean),
        viewport: null,
      });
    }
    if (!places.length) return null;
    places.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    return { places: places.slice(0, MAX_RESULTS), error: null, provider: 'photon' };
  } catch {
    return null;
  }
}

async function resolveFreeFallback(pathname, params) {
  if (pathname === '/api/google/geocode') {
    const query = String(params.get('address') || params.get('q') || '').trim();
    return await resolveGlobalGeocode(query, params);
  }
  const lat = finiteNumber(params.get('lat'));
  const lon = finiteNumber(params.get('lon'));
  if (pathname === '/api/google/reverse-geocode') {
    return await nominatimReverseGeocode(lat, lon);
  }
  const q = String(params.get('q') || params.get('type') || 'restaurant').trim();
  const radiusM = finiteNumber(params.get('radiusM') || params.get('radius'));
  return await photonPlacesSearch(q, lat, lon, radiusM);
}

/**
 * Pre-dispatch hook. Answers the request and returns true, or returns false to
 * let upstream's Google proxy handle it (key present, route not adapted, or the
 * adapter declined for a validation reason upstream reports better).
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname Full request pathname.
 * @param {string} [overrideUrl] Optional URL override for internal bridge calls.
 * @returns {Promise<boolean>}
 */
export async function handlePlacesRequest(req, res, pathname, overrideUrl) {
  if (req.method !== 'GET' || !ADAPTED.has(pathname)) return false;

  const key = adapterActive();
  if (!key) return false;

  // Same-site gate first, exactly like upstream, so a cross-site caller learns
  // nothing about this route's surface from the adapter either.
  if (admitSameSite(req, res)) return true;

  const url = new URL(String(overrideUrl || req.url || ''), 'http://localhost');
  const params = url.searchParams;

  // Validation failures fall through to upstream: its 400 messages describe the
  // contract the client actually coded against, and re-wording them here would
  // only create a second source of truth.
  const target = tomtomUrlFor(pathname, params, key);
  if (!target) return false;

  const cacheKey = cacheKeyFor(pathname, params);
  const cached = cacheRead(cacheKey);
  if (cached) {
    send(res, 200, cached.payload, { cacheable: false });
    return true;
  }

  if (pathname === '/api/google/geocode') {
    const query = String(params.get('address') || params.get('q') || '').trim();
    if (query) {
      const resolved = await resolveGlobalGeocode(query, params);
      if (resolved?.results?.length) {
        cacheWrite(cacheKey, resolved, false);
        send(res, 200, resolved, { cacheable: false });
        return true;
      }
    }
    if (key === 'swisstopo') {
      const empty = {
        status: 'ZERO_RESULTS',
        results: [],
        provider: 'nominatim',
      };
      cacheWrite(cacheKey, empty, true);
      send(res, 200, empty, { cacheable: false });
      return true;
    }
  } else if (key === 'swisstopo') {
    if (pathname === '/api/google/reverse-geocode') {
      const rev = (await resolveFreeFallback(pathname, params)) || {
        status: 'ZERO_RESULTS',
        results: [],
        provider: 'nominatim',
      };
      cacheWrite(cacheKey, rev, !rev.results?.length);
      send(res, 200, rev, { cacheable: false });
      return true;
    }
    const placesResp = (await resolveFreeFallback(pathname, params)) || {
      places: [],
      error: null,
      provider: 'photon',
    };
    cacheWrite(cacheKey, placesResp, !placesResp.places?.length);
    send(res, 200, placesResp, { cacheable: false });
    return true;
  }

  rollDaily();
  if (dailyCount >= DAILY_UPSTREAM_CAP) {
    const freeFallback = await resolveFreeFallback(pathname, params);
    if (freeFallback) {
      send(res, 200, freeFallback, { cacheable: false });
      return true;
    }
    send(
      res,
      429,
      { error: 'Place search budget exhausted', places: [] },
      {
        cacheable: false,
      },
    );
    return true;
  }

  if (!limiter(clientKey(req))) {
    if (!res.writableEnded && !res.headersSent) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '5',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'Rate limit exceeded', places: [] }));
    }
    return true;
  }

  let data = null;
  try {
    dailyCount += 1;
    const response = await fetch(target, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(
        `[gev-bridge] TomTom places ${pathname} upstream ${response.status}`,
        body.slice(0, 120).replace(/[A-Za-z0-9_-]{20,}/g, '[redacted]'),
      );
    } else {
      data = await response.json();
    }
  } catch (err) {
    console.warn(
      '[gev-bridge] TomTom places request failed:',
      err?.message || err,
    );
  }

  let payload = data ? project(pathname, data, params) : null;
  const isEmpty =
    !payload ||
    (pathname.endsWith('geocode')
      ? !payload.results?.length
      : !payload.places?.length);
  if (isEmpty) {
    const fallback = await resolveFreeFallback(pathname, params);
    if (fallback) {
      payload = fallback;
    } else if (!payload) {
      payload = pathname.endsWith('geocode')
        ? { status: 'ZERO_RESULTS', results: [], provider: 'tomtom' }
        : { places: [], error: null, provider: 'photon' };
    }
  }
  const negative = pathname.endsWith('geocode')
    ? !payload.results?.length
    : !payload.places?.length;
  cacheWrite(cacheKey, payload, negative);
  send(res, 200, payload, { cacheable: false });
  return true;
}

export { ADAPTED as PLACES_ADAPTER_ROUTES };
