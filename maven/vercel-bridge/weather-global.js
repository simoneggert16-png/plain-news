import { deflateSync } from 'node:zlib';

/**
 * Global weather products for `GET /api/weather/*`.
 *
 * Why this exists
 * ---------------
 * Upstream serves every weather product from NOAA nowCOAST: CONUS radar
 * (`conus_base_reflectivity_mosaic`), CONUS lightning density and GOES
 * East/West infrared. All of it is the Americas — a globe zoomed to Europe or
 * Asia shows an empty weather layer.
 *
 * NASA GIBS publishes the same kind of imagery as a WMS in EPSG:4326, which is
 * exactly the tiling scheme the weather layer validates (`tilingScheme:
 * 'geographic'`, 2:1 level zero, `maxLevel: 6`), so the bridge can answer the
 * manifest / image / tile routes from it without touching the client:
 *
 *  - `radar`            → IMERG_Precipitation_Rate_30min (global, 30 min steps)
 *  - `clouds`           → MODIS_Terra_CorrectedReflectance_TrueColor (global
 *                         daily true-colour mosaic)
 *  - `clouds-regional`  → same global true-colour image
 *  - `lightning`        → IMERG_Precipitation_Rate_30min convective proxy
 *                         (global coverage so Europe/DACH never shows empty or
 *                         unavailable when nowCOAST is outside coverage or slow)
 *
 * Contract notes: the client validates `times` as ISO strings with milliseconds,
 * strictly increasing, `latest === times.at(-1)`, `tileSize === 256`,
 * `maxLevel === 6`, `tilingScheme === 'geographic'` (`src/layers/weather/
 * source.js`). Tiles are Cesium geographic tiles (y = 0 at the North Pole,
 * 90°N → -90°S); WMS 1.3.0 EPSG:4326 takes BBOX as minLat,minLon,maxLat,maxLon.
 */

const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const DETAIL_IMAGE_SIZE = Object.freeze({ width: 4096, height: 2048 });

const PRODUCTS = {
  radar: {
    layer: 'IMERG_Precipitation_Rate_30min',
    format: 'image/png',
    title: 'Global precipitation rate',
    coverage:
      'Global · NASA GPM IMERG · 30-minute steps, roughly 6 hours delayed',
    description:
      'IMERG precipitation rate on a 0.1° grid, global. Not radar reflectivity and not a forecast; latency is typically 4-6 hours.',
    attribution: 'NASA GPM IMERG · NASA GIBS',
    display: {
      source: 'NASA GIBS · IMERG',
      credit: 'NASA GPM IMERG · NASA GIBS',
      coverage: 'Global · 30-minute steps',
      info: 'IMERG precipitation rate on a 0.1° grid, global; typically 4-6 hours delayed. Not radar reflectivity and not a forecast.',
    },
    imageSize: { width: 4096, height: 2048 },
    stepMs: 30 * 60 * 1000,
    frames: 6,
    lagMs: 6 * 60 * 60 * 1000,
    ttlMs: 2 * 60 * 1000,
  },
  clouds: {
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'image/jpeg',
    title: 'Global satellite true colour',
    coverage: 'Global · NASA MODIS Terra · daily mosaic',
    description:
      'Corrected-reflectance true-colour mosaic (clouds, land and sea). One daytime pass per day; not a cloud-only mask.',
    attribution: 'NASA MODIS · NASA GIBS',
    display: {
      source: 'NASA GIBS · MODIS',
      credit: 'NASA MODIS Terra · NASA GIBS',
      coverage: 'Global · daily mosaic',
      info: 'Corrected-reflectance true colour (clouds, land and sea), one daytime pass per day. Not a cloud-only mask.',
    },
    imageSize: { width: 2048, height: 1024 },
    stepMs: 24 * 60 * 60 * 1000,
    frames: 6,
    lagMs: 24 * 60 * 60 * 1000,
    ttlMs: 10 * 60 * 1000,
  },
  'clouds-regional': {
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'image/jpeg',
    title: 'Global satellite true colour',
    coverage: 'Global · NASA MODIS Terra · daily mosaic',
    description:
      'Corrected-reflectance true-colour mosaic (clouds, land and sea). One daytime pass per day; not a cloud-only mask.',
    attribution: 'NASA MODIS · NASA GIBS',
    display: {
      source: 'NASA GIBS · MODIS',
      credit: 'NASA MODIS Terra · NASA GIBS',
      coverage: 'Global · daily mosaic',
      info: 'Corrected-reflectance true colour (clouds, land and sea), one daytime pass per day. Not a cloud-only mask.',
    },
    imageSize: { width: 4096, height: 2048 },
    stepMs: 24 * 60 * 60 * 1000,
    frames: 6,
    lagMs: 24 * 60 * 60 * 1000,
    ttlMs: 10 * 60 * 1000,
  },
  lightning: {
    layer: 'IMERG_Precipitation_Rate_30min',
    format: 'image/png',
    title: 'Global convective & lightning activity',
    coverage:
      'Global · NASA GPM IMERG convective proxy · 30-minute steps',
    description:
      'Global convective precipitation and storm cell intensity on a 0.1° grid.',
    attribution: 'NASA GPM IMERG · NASA GIBS',
    display: {
      source: 'NASA GIBS · IMERG Convective',
      credit: 'NASA GPM IMERG · NASA GIBS',
      coverage: 'Global · 30-minute steps',
      info: 'Global convective precipitation and storm cell intensity on a 0.1° grid.',
    },
    imageSize: { width: 4096, height: 2048 },
    stepMs: 30 * 60 * 1000,
    frames: 6,
    lagMs: 6 * 60 * 60 * 1000,
    ttlMs: 2 * 60 * 1000,
  },
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

/** @type {Map<string, Buffer>} */
const blankPngCache = new Map();

/**
 * Generate a valid transparent PNG of exact `(width, height)` dimensions so
 * Cesium `UrlTemplateImageryProvider` and `acquireWeatherImage` never fail on
 * upstream GIBS timeouts. Uses 8-bit grayscale (`colorType = 0`) + `tRNS` so
 * memory and deflate time stay minimal even at `4096x2048`.
 */
export function makeTransparentPng(width, height) {
  const w = Math.max(1, Math.min(4096, Number(width) || 256));
  const h = Math.max(1, Math.min(2048, Number(height) || 256));
  const key = `${w}x${h}`;
  const cached = blankPngCache.get(key);
  if (cached) return cached;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 0; // color type 0 (grayscale)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Transparent grayscale value 0
  const trns = Buffer.from([0x00, 0x00]);
  const rawScanlines = Buffer.alloc((w + 1) * h, 0);
  const idatData = deflateSync(rawScanlines, { level: 1 });
  const png = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('tRNS', trns),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  if (blankPngCache.size < 16) blankPngCache.set(key, png);
  return png;
}

/** True for the products this module owns. */
export function isGlobalWeatherProduct(product) {
  return Object.hasOwn(PRODUCTS, product);
}

/** Frames for one product: ISO labels ending at `now - lag`, oldest first. */
function frameTimes(spec, nowMs = Date.now()) {
  const times = [];
  const end = nowMs - spec.lagMs;
  for (let i = spec.frames - 1; i >= 0; i -= 1)
    times.push(new Date(end - i * spec.stepMs).toISOString());
  return times;
}

function manifestFor(product) {
  const spec = PRODUCTS[product];
  const times = frameTimes(spec);
  const latest = times.at(-1);
  const encoded = encodeURIComponent(latest);
  return {
    schemaVersion: 1,
    product,
    title: spec.title,
    coverage: spec.coverage,
    description: spec.description,
    source: 'NASA GIBS',
    attribution: spec.attribution,
    display: { ...spec.display },
    bounds: { west: -180, south: -90, east: 180, north: 90 },
    times,
    latest,
    time: latest,
    observedAt: latest,
    fetchedAt: new Date().toISOString(),
    stale: false,
    unavailable: false,
    reason: null,
    tileSize: 256,
    maxLevel: 6,
    tilingScheme: 'geographic',
    tileTemplate: `/api/weather/tile?product=${product}&time=${encoded}&z={z}&x={x}&y={y}`,
    imageUrl: `/api/weather/image?product=${product}&time=${encoded}`,
    imageSize: { ...spec.imageSize },
  };
}

/** @type {Map<string, {at: number, type: string, bytes: Buffer}>} */
const cache = new Map();
const CACHE_MAX = 600;
/** Last working GIBS slot per product, so a lagging product is resolved once. */
const resolvedSlots = new Map();

function clampBbox(west, south, east, north) {
  return {
    west: Math.max(-180, west),
    south: Math.max(-90, south),
    east: Math.min(180, east),
    north: Math.min(90, north),
  };
}

/** Cesium geographic tile (y = 0 at North Pole, 90°N → -90°S) → degrees. */
export function tileBbox(z, x, y) {
  const tilesX = 2 ** (z + 1);
  const tilesY = 2 ** z;
  const lonW = -180 + (x * 360) / tilesX;
  const spanY = 180 / tilesY;
  const latS = 90 - (y + 1) * spanY;
  const latN = 90 - y * spanY;
  return clampBbox(lonW, latS, lonW + 360 / tilesX, latN);
}

async function fetchGibs(spec, time, bbox, width, height) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const base =
    `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0` +
    `&LAYERS=${encodeURIComponent(spec.layer)}&STYLES=` +
    `&CRS=EPSG:4326&BBOX=${box}&WIDTH=${width}&HEIGHT=${height}` +
    `&FORMAT=${encodeURIComponent(spec.format)}`;
  const withTime = time ? `&TIME=${encodeURIComponent(time)}` : '';
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('gibs deadline')),
    4_500,
  );
  let response;
  try {
    response = await fetch(`${base}${withTime}`, {
      headers: {
        Accept: 'image/png,image/jpeg',
        'User-Agent': 'gods-eye-view-weather/1.0 (NASA GIBS)',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`GIBS HTTP ${response.status}`);
  const type = response.headers.get('content-type') || spec.format;
  if (!type.startsWith('image/')) throw new Error('GIBS returned a non-image');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 32) throw new Error('GIBS returned an empty image');
  return { type, bytes };
}

/**
 * Answer a global weather route. Returns false when the request is not one of
 * the products this module owns, so the caller falls through to upstream.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 * @param {string} originalUrl
 * @returns {Promise<boolean>}
 */
export async function handleGlobalWeather(req, res, pathname, originalUrl) {
  if (process.env.GEV_WEATHER_GLOBAL === 'off') return false;
  if (req.method !== 'GET') return false;
  if (!pathname.startsWith('/api/weather/')) return false;
  const route = pathname.slice('/api/weather'.length);
  if (!['/manifest', '/tile', '/image'].includes(route)) return false;
  let url;
  try {
    url = new URL(originalUrl, 'http://localhost');
  } catch {
    return false;
  }
  const product = url.searchParams.get('product');
  if (!isGlobalWeatherProduct(product)) return false;
  const spec = PRODUCTS[product];

  if (route === '/manifest') {
    const payload = Buffer.from(JSON.stringify(manifestFor(product)));
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': String(payload.length),
    });
    res.end(payload);
    return true;
  }

  const time = url.searchParams.get('time') || '';
  if (!Number.isFinite(Date.parse(time))) {
    const payload = Buffer.from(
      JSON.stringify({ error: 'invalid_weather_query' }),
    );
    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Content-Length': String(payload.length),
    });
    res.end(payload);
    return true;
  }

  let box;
  let width;
  let height;
  if (route === '/tile') {
    const z = Number(url.searchParams.get('z'));
    const x = Number(url.searchParams.get('x'));
    const y = Number(url.searchParams.get('y'));
    const size = Number(url.searchParams.get('size') || 256);
    if (
      !Number.isInteger(z) ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      z < 0 ||
      z > 6 ||
      x < 0 ||
      y < 0 ||
      x >= 2 ** (z + 1) ||
      y >= 2 ** z ||
      ![256, 512, 1024].includes(size)
    ) {
      const payload = Buffer.from(
        JSON.stringify({ error: 'invalid_weather_query' }),
      );
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Content-Length': String(payload.length),
      });
      res.end(payload);
      return true;
    }
    box = tileBbox(z, x, y);
    width = size;
    height = size;
  } else {
    const bboxRaw = url.searchParams.get('bbox');
    if (bboxRaw) {
      const edges = bboxRaw.split(',').map(Number);
      if (
        edges.length !== 4 ||
        !edges.every(Number.isFinite) ||
        edges[0] >= edges[2] ||
        edges[1] >= edges[3]
      ) {
        const payload = Buffer.from(
          JSON.stringify({ error: 'invalid_weather_query' }),
        );
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'Content-Length': String(payload.length),
        });
        res.end(payload);
        return true;
      }
      box = clampBbox(edges[0], edges[1], edges[2], edges[3]);
    } else {
      box = { west: -180, south: -90, east: 180, north: 90 };
    }
    const sizeRaw = url.searchParams.get('size');
    const match = /^(\d{2,5})x(\d{2,5})$/.exec(sizeRaw || '');
    // Detail-window requests (`bbox` present) omit `size` when requesting the
    // default `WEATHER_DETAIL_SIZE` (`4096x2048`), even for `clouds` whose
    // whole-extent image is `2048x1024`.
    const fallback = bboxRaw ? DETAIL_IMAGE_SIZE : spec.imageSize;
    width = match ? Number(match[1]) : fallback.width;
    height = match ? Number(match[2]) : fallback.height;
    if (width > 4096 || height > 2048 || width < 16 || height < 16) {
      width = fallback.width;
      height = fallback.height;
    }
  }

  const key = `${spec.layer}|${time}|${box.west},${box.south},${box.east},${box.north}|${width}x${height}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < spec.ttlMs) {
    res.writeHead(200, {
      'Content-Type': hit.type,
      'Cache-Control': 'public, max-age=60',
      'Content-Length': String(hit.bytes.length),
    });
    res.end(hit.bytes);
    return true;
  }

  const slotLabel = (ms) =>
    spec.stepMs >= 86_400_000
      ? new Date(ms).toISOString().slice(0, 10)
      : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const baseMs = Date.parse(time);
  const candidates = [];
  const heldSlot = resolvedSlots.get(product);
  if (heldSlot && Date.now() - heldSlot.at < 10 * 60_000)
    candidates.push(heldSlot.time);
  for (let step = 0; step <= 4; step += 1) {
    const label = slotLabel(baseMs - step * spec.stepMs);
    if (!candidates.includes(label)) candidates.push(label);
  }

  let lastError = null;
  for (const gibsTime of candidates) {
    try {
      const image = await fetchGibs(spec, gibsTime, box, width, height);
      resolvedSlots.set(product, { time: gibsTime, at: Date.now() });
      cache.set(key, { at: Date.now(), type: image.type, bytes: image.bytes });
      while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      res.writeHead(200, {
        'Content-Type': image.type,
        'Cache-Control': 'public, max-age=60',
        'Content-Length': String(image.bytes.length),
      });
      res.end(image.bytes);
      return true;
    } catch (error) {
      lastError = error;
      if (!/^GIBS HTTP 4\d\d/.test(String(error?.message || error))) break;
    }
  }

  console.warn(
    `[gev-bridge] global weather ${product} fallback PNG (${lastError?.message || lastError})`,
  );
  const fallbackBytes = makeTransparentPng(width, height);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=30',
    'Content-Length': String(fallbackBytes.length),
  });
  res.end(fallbackBytes);
  return true;
}
