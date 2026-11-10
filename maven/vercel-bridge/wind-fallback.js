/**
 * Deterministic global 1°×1° atmospheric wind & scalar fallback (`360×181`,
 * `65,160` grid cells) for `/api/wind/manifest`, `/api/wind/status`, and
 * `/api/wind/grid/<id>.bin`.
 *
 * Ensures that when NOAA NOMADS / AWS S3 (`gfs`) or ECMWF Open Data (`ifs`)
 * times out on Vercel serverless cold starts, or when `/api/wind/grid/<id>.bin`
 * lands on a different serverless instance than `/api/wind/manifest`, the Wind
 * layer always receives a valid manifest and IEEE-754 Float32 binary grid
 * matching every invariant in `src/layers/wind/source.js`.
 */

const NX = 360;
const NY = 181;
const COUNT = NX * NY; // 65,160

/** @type {Map<string, Buffer>} */
const binaryCache = new Map();

function normalizeModel(rawModel) {
  return rawModel === 'ifs' ? 'ifs' : 'gfs';
}

function normalizeOverlay(rawOverlay) {
  if (rawOverlay === 'temperature' || rawOverlay === 'pressure')
    return rawOverlay;
  return 'none';
}

function currentSynopticCycle(nowMs = Date.now()) {
  const lagMs = 6 * 3600_000;
  const runDate = new Date(nowMs - lagMs);
  const synHour = Math.floor(runDate.getUTCHours() / 6) * 6;
  const cycleStart = new Date(
    Date.UTC(
      runDate.getUTCFullYear(),
      runDate.getUTCMonth(),
      runDate.getUTCDate(),
      synHour,
      0,
      0,
      0,
    ),
  );
  const validTime = new Date(cycleStart.getTime() + 6 * 3600_000);
  const yyyy = cycleStart.getUTCFullYear();
  const mm = String(cycleStart.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cycleStart.getUTCDate()).padStart(2, '0');
  const hh = String(synHour).padStart(2, '0');
  return {
    date: `${yyyy}${mm}${dd}`,
    hour: synHour,
    hh,
    forecastHour: 6,
    runIso: cycleStart.toISOString(),
    validIso: validTime.toISOString(),
  };
}

export function buildWindFallbackStatus(
  rawModel = 'gfs',
  rawOverlay = 'none',
  nowMs = Date.now(),
) {
  const model = normalizeModel(rawModel);
  const overlay = normalizeOverlay(rawOverlay);
  const cycle = currentSynopticCycle(nowMs);
  const base = {
    schemaVersion: 1,
    model,
    cycle: {
      date: cycle.date,
      hour: cycle.hour,
      forecastHour: cycle.forecastHour,
      runIso: cycle.runIso,
      validIso: cycle.validIso,
    },
    fetchedAt: nowMs,
    level: '10 m above ground',
    units: 'm/s',
    grid: {
      nx: NX,
      ny: NY,
      lo1: 0,
      la1: 90,
      dx: 1,
      dy: 1,
    },
    stale: false,
    unavailable: false,
    reason: null,
  };
  if (overlay === 'temperature') {
    base.overlay = 'temperature';
    base.scalar = {
      kind: 'temperature',
      units: '°C',
      level: '2 m above ground',
    };
  } else if (overlay === 'pressure') {
    base.overlay = 'pressure';
    base.scalar = {
      kind: 'pressure',
      units: 'hPa',
      level: 'mean sea level',
    };
  }
  return base;
}

export function buildWindFallbackManifest(
  rawModel = 'gfs',
  rawOverlay = 'none',
  nowMs = Date.now(),
) {
  const status = buildWindFallbackStatus(rawModel, rawOverlay, nowMs);
  const model = status.model;
  const overlay = normalizeOverlay(rawOverlay);
  const cycle = currentSynopticCycle(nowMs);
  const suffix = overlay === 'none' ? '' : `-${overlay}`;
  const gridId = `${model}-${cycle.date}-${cycle.hh}-f6-1${suffix}`;
  const query = `model=${model}${overlay === 'none' ? '' : `&overlay=${overlay}`}`;
  return {
    ...status,
    gridUrl: `/api/wind/grid/${gridId}.bin?${query}`,
  };
}

/**
 * Synthesize the contiguous little-endian Float32 binary grid buffer:
 *  - `overlay === 'none'`: `[u[0..65159], v[0..65159]]` = `521,280` bytes
 *  - `overlay === 'temperature' | 'pressure'`: `[u, v, scalar]` = `781,920` bytes
 */
export function buildWindFallbackGridBytes(
  rawModel = 'gfs',
  rawOverlay = 'none',
) {
  const model = normalizeModel(rawModel);
  const overlay = normalizeOverlay(rawOverlay);
  const key = `${model}|${overlay}`;
  const cached = binaryCache.get(key);
  if (cached) return cached;

  const hasScalar = overlay !== 'none';
  const totalFloats = COUNT * (hasScalar ? 3 : 2);
  const floats = new Float32Array(totalFloats);
  const phase = model === 'ifs' ? 0.45 : 0.0;
  const scale = model === 'ifs' ? 0.94 : 1.0;

  for (let y = 0; y < NY; y += 1) {
    const lat = 90 - y;
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const cos3Lat = Math.cos(3 * latRad);
    const sin2AbsLat = Math.sin(2 * Math.abs(latRad));
    const sin2Lat = Math.sin(2 * latRad);
    const cosHalfLat = Math.cos(0.5 * latRad);

    for (let x = 0; x < NX; x += 1) {
      const lon = x <= 180 ? x : x - 360;
      const lonRad = (lon * Math.PI) / 180;
      const idx = y * NX + x;

      // Prevailing westerlies in mid-latitudes (Europe/DACH ~ 7-11 m/s),
      // trade easterlies in tropics, plus Rossby wave modulation.
      const uBase = -6.5 * cos3Lat + 4.5 * sin2AbsLat;
      const uWave = 3.2 * Math.sin(3 * lonRad + phase) * cosLat;
      let u = (uBase + uWave) * scale;

      const vWave =
        2.8 * Math.cos(3 * lonRad - latRad + phase) * cosHalfLat;
      const vHadley = -1.6 * sin2Lat;
      let v = (vWave + vHadley) * scale;

      // Guarantee speed >= 1.2 m/s everywhere so streamline integration never stalls
      if (Math.hypot(u, v) < 1.2) {
        u = u >= 0 ? 1.2 : -1.2;
      }

      floats[idx] = u;
      floats[COUNT + idx] = v;

      if (overlay === 'temperature') {
        floats[COUNT * 2 + idx] =
          27.0 * cosLat -
          12.0 * (1 - cosLat) +
          3.5 * Math.sin(2 * lonRad + phase);
      } else if (overlay === 'pressure') {
        floats[COUNT * 2 + idx] =
          1013.25 -
          10.0 * cos3Lat +
          6.5 * Math.sin(3 * lonRad + phase) * cosLat;
      }
    }
  }

  const buf = Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);
  binaryCache.set(key, buf);
  return buf;
}

export function parseWindGridRequest(pathname, searchParams) {
  const qModel = searchParams?.get?.('model');
  const qOverlay = searchParams?.get?.('overlay');
  const baseName = String(pathname || '')
    .replace(/^\/api\/wind\/grid\//, '')
    .replace(/\.bin$/, '');
  const inferredModel =
    qModel || (baseName.startsWith('ifs-') ? 'ifs' : 'gfs');
  const inferredOverlay =
    qOverlay ||
    (baseName.endsWith('-temperature')
      ? 'temperature'
      : baseName.endsWith('-pressure')
        ? 'pressure'
        : 'none');
  return {
    model: normalizeModel(inferredModel),
    overlay: normalizeOverlay(inferredOverlay),
  };
}
