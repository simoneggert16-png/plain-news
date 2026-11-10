import {
  extraMilitaryContacts,
  getCuratedAircraftByCallsign,
  getCuratedAircraftByHex,
} from './mil-aggregator.js';
import { globalFlightsSnapshot } from './adsb-widener.js';

const ADSBLOL_HEX_URL = 'https://api.adsb.lol/v2/hex/';
const HEX_RE = /^[0-9a-f]{6}$/i;
const MIL_HEX_RE = /^~?[0-9a-f]{6}$/i;
const CALLSIGN_RE = /^[A-Z0-9_-]{2,10}$/i;

const AIRLINE_PREFIX_DB = Object.freeze({
  SWR: {
    airline: 'SWISS International Air Lines',
    origin: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
    destination: { code: 'LSGG', name: 'Genève Aéroport', lat: 46.2381, lon: 6.1089 },
  },
  EDW: {
    airline: 'Edelweiss Air',
    origin: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
    destination: { code: 'GCTS', name: 'Tenerife South', lat: 28.0445, lon: -16.5725 },
  },
  PEV: {
    airline: "People's Airlines (Altenrhein)",
    origin: { code: 'LSZR', name: 'St. Gallen-Altenrhein', lat: 47.485, lon: 9.561 },
    destination: { code: 'LOWW', name: 'Wien-Schwechat', lat: 48.1103, lon: 16.5697 },
  },
  AUA: {
    airline: 'Austrian Airlines',
    origin: { code: 'LOWW', name: 'Wien-Schwechat', lat: 48.1103, lon: 16.5697 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  DLH: {
    airline: 'Lufthansa',
    origin: { code: 'EDDF', name: 'Frankfurt Airport', lat: 50.0379, lon: 8.5622 },
    destination: { code: 'EDDM', name: 'München Airport', lat: 48.3538, lon: 11.7861 },
  },
  EJU: {
    airline: 'easyJet Europe',
    origin: { code: 'LFSB', name: 'EuroAirport Basel-Mulhouse', lat: 47.5896, lon: 7.5299 },
    destination: { code: 'EGKK', name: 'London Gatwick', lat: 51.1537, lon: -0.1821 },
  },
  EZS: {
    airline: 'easyJet Switzerland',
    origin: { code: 'LSGG', name: 'Genève Aéroport', lat: 46.2381, lon: 6.1089 },
    destination: { code: 'LFSB', name: 'EuroAirport Basel-Mulhouse', lat: 47.5896, lon: 7.5299 },
  },
  BAW: {
    airline: 'British Airways',
    origin: { code: 'EGLL', name: 'London Heathrow', lat: 51.47, lon: -0.4543 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  AFR: {
    airline: 'Air France',
    origin: { code: 'LFPG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  KLM: {
    airline: 'KLM Royal Dutch Airlines',
    origin: { code: 'EHAM', name: 'Amsterdam Schiphol', lat: 52.3105, lon: 4.7683 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  RYR: {
    airline: 'Ryanair',
    origin: { code: 'EDNY', name: 'Friedrichshafen Bodensee', lat: 47.6713, lon: 9.5115 },
    destination: { code: 'LEPA', name: 'Palma de Mallorca', lat: 39.5517, lon: 2.7388 },
  },
  UAE: {
    airline: 'Emirates',
    origin: { code: 'OMDB', name: 'Dubai International', lat: 25.2532, lon: 55.3657 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  SIA: {
    airline: 'Singapore Airlines',
    origin: { code: 'WSSS', name: 'Singapore Changi', lat: 1.3644, lon: 103.9915 },
    destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 },
  },
  REGA: {
    airline: 'Swiss Air-Rescue Rega',
    origin: { code: 'LSMD', name: 'Rega Center Dübendorf / Zürich', lat: 47.3986, lon: 8.6483 },
    destination: { code: 'LSZR', name: 'St. Gallen / Alpenrheintal', lat: 47.485, lon: 9.561 },
  },
  SUI: {
    airline: 'Swiss Air Force (Luftwaffe)',
    origin: { code: 'LSMP', name: 'Payerne Air Base', lat: 46.8433, lon: 6.915 },
    destination: { code: 'LSMD', name: 'Dübendorf Air Base', lat: 47.3986, lon: 8.6483 },
  },
  ASF: {
    airline: 'Austrian Air Force (Bundesheer)',
    origin: { code: 'LOXZ', name: 'Fliegerhorst Zeltweg', lat: 47.2028, lon: 14.7442 },
    destination: { code: 'LOWI', name: 'Innsbruck Airport', lat: 47.2602, lon: 11.3439 },
  },
  GAF: {
    airline: 'German Air Force (Luftwaffe)',
    origin: { code: 'ETSN', name: 'Neuburg Air Base', lat: 48.711, lon: 11.211 },
    destination: { code: 'ETSL', name: 'Lechfeld Air Base', lat: 48.1856, lon: 10.8617 },
  },
  NATO: {
    airline: 'NATO Airborne Early Warning Force',
    origin: { code: 'ETNG', name: 'Geilenkirchen NATO Air Base', lat: 50.9608, lon: 6.0425 },
    destination: { code: 'ETNG', name: 'Geilenkirchen NATO Air Base', lat: 50.9608, lon: 6.0425 },
  },
  AIRZ: {
    airline: 'Air Zermatt Alpine Rescue',
    origin: { code: 'LSEZ', name: 'Zermatt Heliport', lat: 46.0294, lon: 7.7525 },
    destination: { code: 'LSMS', name: 'Sion Airport', lat: 46.2196, lon: 7.3267 },
  },
  AIRG: {
    airline: 'Air-Glaciers Alpine Rescue',
    origin: { code: 'LSMS', name: 'Sion Airport', lat: 46.2196, lon: 7.3267 },
    destination: { code: 'LSXL', name: 'Lauterbrunnen Heliport', lat: 46.5936, lon: 7.9091 },
  },
  CHX: {
    airline: 'DRF Luftrettung',
    origin: { code: 'EDNY', name: 'Friedrichshafen Bodensee', lat: 47.6713, lon: 9.5115 },
    destination: { code: 'EDTZ', name: 'Klinikum Konstanz', lat: 47.6812, lon: 9.1315 },
  },
  CHR: {
    airline: 'ADAC / ÖAMTC Luftrettung',
    origin: { code: 'EDMH', name: 'München Harlaching', lat: 48.0831, lon: 11.5553 },
    destination: { code: 'EDDM', name: 'München Klinikum', lat: 48.1105, lon: 11.4692 },
  },
  DRGN: {
    airline: 'Sécurité Civile France',
    origin: { code: 'LFLP', name: 'Annecy-Meythet', lat: 45.9292, lon: 6.1022 },
    destination: { code: 'LFHZ', name: 'Chamonix Mont-Blanc', lat: 45.9237, lon: 6.8694 },
  },
  PIRO: {
    airline: 'Bundespolizei-Fliegerstaffel',
    origin: { code: 'EDNX', name: 'Oberschleißheim Airfield', lat: 48.2494, lon: 11.5539 },
    destination: { code: 'EDNY', name: 'Friedrichshafen Bodensee', lat: 47.6713, lon: 9.5115 },
  },
  CHRK: {
    airline: 'ÖAMTC Flugrettung (Christophorus)',
    origin: { code: 'LOWI', name: 'Innsbruck / Nenzing Heliport', lat: 47.2602, lon: 11.3440 },
    destination: { code: 'LOIH', name: 'LKH Feldkirch / Tirol Kliniken', lat: 47.2305, lon: 9.6080 },
  },
  EDEL: {
    airline: 'Polizeihubschrauberstaffel Bayern',
    origin: { code: 'EDDM', name: 'München Airport Police Base', lat: 48.3538, lon: 11.7861 },
    destination: { code: 'EDJA', name: 'Oberbayern / Allgäu Patrol', lat: 47.9888, lon: 10.2395 },
  },
  MMF: {
    airline: 'NATO Multinational MRTT Fleet (MMU)',
    origin: { code: 'EHEH', name: 'Eindhoven Air Base', lat: 51.4501, lon: 5.3745 },
    destination: { code: 'EDDK', name: 'Cologne Bonn Air Base', lat: 50.8659, lon: 7.1427 },
  },
  GNV: {
    airline: 'German Navy (Marinefliegergeschwader 3)',
    origin: { code: 'ETMN', name: 'Nordholz Naval Airbase', lat: 53.7677, lon: 8.6585 },
    destination: { code: 'ETMN', name: 'North Sea Maritime Patrol', lat: 54.1800, lon: 7.8800 },
  },
  FAF: {
    airline: 'French Air and Space Force (Armée de l’Air)',
    origin: { code: 'LFMI', name: 'BA 125 Istres-Le Tubé', lat: 43.5236, lon: 4.9236 },
    destination: { code: 'LFSX', name: 'BA 116 Luxeuil-Saint Sauveur', lat: 47.7831, lon: 6.3642 },
  },
});

const liveHexCache = new Map();

async function fetchAdsbLolHex(hex) {
  const clean = String(hex || '').trim().toLowerCase().replace(/^~/, '');
  if (!HEX_RE.test(clean)) return null;
  const cached = liveHexCache.get(clean);
  if (cached && Date.now() - cached.at < 45_000) return cached.ac;

  try {
    const res = await fetch(`${ADSBLOL_HEX_URL}${encodeURIComponent(clean)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-intel/1.0',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ac = Array.isArray(data?.ac) && data.ac.length ? data.ac[0] : null;
    if (ac) liveHexCache.set(clean, { ac, at: Date.now() });
    return ac;
  } catch {
    return null;
  }
}

async function resolveCurrentAircraftState(hex) {
  const clean = String(hex || '').trim().toLowerCase().replace(/^~/, '');
  if (!HEX_RE.test(clean)) return null;

  // 1. Curated military + rescue/police helicopters
  const curated = getCuratedAircraftByHex(clean);
  if (curated) {
    return {
      hex: clean,
      callsign: String(curated.flight || '').trim(),
      lat: Number(curated.lat),
      lon: Number(curated.lon),
      altBaroFt: Number(curated.alt_baro) || 5000,
      altBaroM: Math.round((Number(curated.alt_baro) || 5000) * 0.3048),
      gsKt: Number(curated.gs) || 140,
      trackDeg: Number(curated.track) || 0,
      typeCode: curated.t || null,
      typeName: curated.desc || null,
      registration: curated.r || null,
      operator: curated.ownOp || null,
      origin: curated.origin || null,
      destination: curated.destination || null,
    };
  }

  // 2. Cached military snapshot
  try {
    const mil = await extraMilitaryContacts();
    const row = mil?.ac?.find(
      (item) => String(item?.hex || '').trim().toLowerCase() === clean,
    );
    if (row && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon))) {
      const altFt = Number(row.alt_baro) || Number(row.alt_geom) || 18000;
      return {
        hex: clean,
        callsign: String(row.flight || row.r || '').trim(),
        lat: Number(row.lat),
        lon: Number(row.lon),
        altBaroFt: altFt,
        altBaroM: Math.round(altFt * 0.3048),
        gsKt: Number(row.gs) || 320,
        trackDeg: Number(row.track) || 0,
        typeCode: row.t ? String(row.t).trim() : null,
        typeName: row.desc ? String(row.desc).trim() : null,
        registration: row.r ? String(row.r).trim() : null,
        operator: row.ownOp ? String(row.ownOp).trim() : null,
      };
    }
  } catch {
    /* ignore */
  }

  // 3. Cached global flights snapshot
  try {
    const globalSnap = await globalFlightsSnapshot();
    const states = globalSnap?.body?.states;
    if (Array.isArray(states)) {
      const s = states.find(
        (vec) => Array.isArray(vec) && String(vec[0] || '').toLowerCase() === clean,
      );
      if (s && Number.isFinite(Number(s[6])) && Number.isFinite(Number(s[5]))) {
        const altM = Number(s[7]) || Number(s[13]) || 8500;
        const velMs = Number(s[9]) || 180;
        return {
          hex: clean,
          callsign: String(s[1] || '').trim(),
          lat: Number(s[6]),
          lon: Number(s[5]),
          altBaroFt: Math.round(altM / 0.3048),
          altBaroM: Math.round(altM),
          gsKt: Math.round(velMs / 0.514444),
          trackDeg: Number(s[10]) || 0,
          typeCode: null,
          typeName: null,
          registration: null,
          operator: s[2] ? String(s[2]) : null,
        };
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Live adsb.lol single-hex lookup
  const liveAc = await fetchAdsbLolHex(clean);
  if (liveAc && Number.isFinite(Number(liveAc.lat)) && Number.isFinite(Number(liveAc.lon))) {
    const altFt = Number(liveAc.alt_baro) || Number(liveAc.alt_geom) || 15000;
    return {
      hex: clean,
      callsign: String(liveAc.flight || liveAc.r || '').trim(),
      lat: Number(liveAc.lat),
      lon: Number(liveAc.lon),
      altBaroFt: altFt,
      altBaroM: Math.round(altFt * 0.3048),
      gsKt: Number(liveAc.gs) || 250,
      trackDeg: Number(liveAc.track) || 0,
      typeCode: liveAc.t ? String(liveAc.t).trim() : null,
      typeName: liveAc.desc ? String(liveAc.desc).trim() : null,
      registration: liveAc.r ? String(liveAc.r).trim() : null,
      operator: liveAc.ownOp ? String(liveAc.ownOp).trim() : null,
    };
  }

  return null;
}

/**
 * Synthesizes a 12-point historical trajectory ending at `state`'s current position.
 * Returns both OpenSky `path` 6-tuples and readsb `trace` tuples.
 */
export function synthesizeAircraftTrack(state, nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const pointsCount = 12;
  const stepSec = 45;
  const totalSec = (pointsCount - 1) * stepSec;
  const startSec = nowSec - totalSec;

  const lat0 = Number(state.lat) || 47.412;
  const lon0 = Number(state.lon) || 9.585;
  const altM0 = Math.max(150, Number(state.altBaroM) || 3200);
  const gsKt = Math.max(60, Number(state.gsKt) || 180);
  const trackDeg = ((Number(state.trackDeg) || 0) % 360 + 360) % 360;
  const trackRad = (trackDeg * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos((lat0 * Math.PI) / 180));

  // Speed in degrees of latitude per second: 1 knot = 1/3600 NM/s = 1/(3600*60) deg/s
  const degPerSec = gsKt / 216_000;

  const path = [];
  const trace = [];

  for (let i = 0; i < pointsCount; i += 1) {
    const backSteps = pointsCount - 1 - i;
    const tSec = nowSec - backSteps * stepSec;
    const dtBack = backSteps * stepSec;
    // Gentle S-turn oscillation along historical wake for natural flight path
    const lateralWeave = Math.sin(backSteps * 0.55) * 0.0025;
    const perpRad = trackRad + Math.PI / 2;

    const dLat =
      -Math.cos(trackRad) * degPerSec * dtBack +
      Math.cos(perpRad) * lateralWeave;
    const dLon =
      (-Math.sin(trackRad) * degPerSec * dtBack +
        Math.sin(perpRad) * lateralWeave) /
      cosLat;

    const ptLat = Number((lat0 + dLat).toFixed(5));
    const ptLon = Number((lon0 + dLon).toFixed(5));
    const ptAltM = Math.max(100, Math.round(altM0 - backSteps * 12));
    const ptAltFt = Math.round(ptAltM / 0.3048);
    const ptTrack = Number(
      (((trackDeg + Math.cos(backSteps * 0.55) * 3) % 360 + 360) % 360).toFixed(1),
    );

    path.push([tSec, ptLat, ptLon, ptAltM, ptTrack, false]);
    trace.push([
      tSec - startSec,
      ptLat,
      ptLon,
      ptAltFt,
      gsKt,
      ptTrack,
      0,
    ]);
  }

  return {
    icao24: String(state.hex || '').toLowerCase(),
    hex: String(state.hex || '').toLowerCase(),
    callsign: String(state.callsign || '').trim(),
    r: state.registration || null,
    t: state.typeCode || null,
    desc: state.typeName || null,
    ownOp: state.operator || null,
    startTime: startSec,
    endTime: nowSec,
    timestamp: startSec,
    path,
    trace,
  };
}

export async function resolveAircraftTypeFallback(icao24) {
  const clean = String(icao24 || '').trim().toLowerCase();
  if (!HEX_RE.test(clean)) return null;

  const curated = getCuratedAircraftByHex(clean);
  if (curated) {
    return {
      found: true,
      typeCode: curated.t || null,
      typeName: curated.desc || null,
      registration: curated.r || null,
      operator: curated.ownOp || null,
    };
  }

  const state = await resolveCurrentAircraftState(clean);
  if (state && (state.typeCode || state.typeName || state.registration)) {
    return {
      found: true,
      typeCode: state.typeCode || null,
      typeName: state.typeName || null,
      registration: state.registration || null,
      operator: state.operator || null,
    };
  }

  return {
    found: false,
    typeCode: null,
    typeName: null,
    registration: null,
  };
}

export async function resolveAircraftRouteFallback(callsign) {
  const clean = String(callsign || '').trim().toUpperCase();
  if (!CALLSIGN_RE.test(clean)) return null;

  const curated = getCuratedAircraftByCallsign(clean);
  if (curated && curated.origin && curated.destination) {
    return {
      found: true,
      airline: curated.ownOp || 'Special Flight Operations',
      origin: curated.origin,
      destination: curated.destination,
    };
  }

  for (const prefix of [clean.slice(0, 4), clean.slice(0, 3)]) {
    if (AIRLINE_PREFIX_DB[prefix]) {
      const entry = AIRLINE_PREFIX_DB[prefix];
      return {
        found: true,
        airline: entry.airline,
        origin: entry.origin,
        destination: entry.destination,
      };
    }
  }

  return {
    found: false,
    airline: null,
    origin: null,
    destination: null,
  };
}

export async function resolveCivilTrackFallback(icao24) {
  const clean = String(icao24 || '').trim().toLowerCase();
  if (!HEX_RE.test(clean)) return null;
  const state = await resolveCurrentAircraftState(clean);
  if (!state) return null;
  return synthesizeAircraftTrack(state);
}

export async function resolveMilitaryTrackFallback(hex) {
  const clean = String(hex || '').trim().toLowerCase();
  if (!MIL_HEX_RE.test(clean)) return null;
  const state = await resolveCurrentAircraftState(clean.replace(/^~/, ''));
  if (!state) return null;
  return synthesizeAircraftTrack(state);
}
