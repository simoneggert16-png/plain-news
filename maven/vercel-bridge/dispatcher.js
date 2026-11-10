/**
 * Vercel bridge for God's Eye View's local provider middleware.
 *
 * Upstream GEV exposes its 43 key-brokering `/api/*` endpoints as Vite
 * dev/preview server plugins (`server/providers/local.js`). There is no
 * standalone production HTTP server in the upstream repository, so a plain
 * static Vercel deployment would serve the globe with every keyed layer dead.
 *
 * This module re-mounts those exact same plugins inside a Vercel Node
 * serverless function. It deliberately reuses upstream code paths rather than
 * reimplementing any provider: the plugins are constructed with their
 * `configurePreviewServer` hook, which is the same hook `vite preview` uses for
 * production builds. Two consequences are intentional and worth knowing:
 *
 *  - `key-setup.js` only registers via `configureServer`, never via
 *    `configurePreviewServer`, so the in-app "Provider Settings" endpoints that
 *    write this checkout's `.env` are absent here. That is correct: on Vercel
 *    the filesystem is read-only and keys come from environment variables.
 *  - The MCP plugin is excluded on purpose (it is a local stdio/SSE concern).
 *
 * The only behaviour adapted for the edge environment is the same-site gate,
 * documented at `stripProxySignals` below.
 */

import { localProviderPlugins } from '../server/providers/local.js';
import { gzipSync } from 'node:zlib';
import { apiNotFoundPlugin } from '../server/standalone/api-not-found.js';
import { googleTokenUnavailablePlugin } from '../server/standalone/google-token-unavailable.js';
import { standaloneVoiceTools } from '../server/standalone/voiceTools.js';
import { createCapturingResponse, waitForVesselRows } from './ais-warmup.js';
import {
  extraVesselRows,
  findExtraVesselByMmsi,
  synthesizeVesselTrack,
} from './ais-extra.js';
import { relayVesselRows } from './ais-relay.js';
import {
  buildCivilianHelicopterStates,
  extraMilitaryContacts,
  mergeMilitaryPayload,
} from './mil-aggregator.js';
import {
  resolveAircraftRouteFallback,
  resolveAircraftTypeFallback,
  resolveCivilTrackFallback,
  resolveMilitaryTrackFallback,
} from './aircraft-intel.js';
import { handlePlacesRequest } from './places-adapter.js';
import {
  fetchGeoFallbackFrame,
  pinnedCamera,
  pinnedCameraFrame,
  pinnedCameras,
} from './pinned-cameras.js';
import { bordersSnapshot } from './borders.js';
import { osintReports, searchReports } from './osint.js';
import { businessSearch, personBusinessSearch } from './business.js';
import { personWebSearch } from './person-web.js';
import {
  hasGeminiApiKeyPool,
  personSummary,
  summarizeHudContext,
} from './person-summary.js';
import { speakSummaryText } from './person-speech.js';
import { parcelAt } from './parcels.js';
import { frontFiresFrom } from './frontfires.js';
import { frontlineSnapshot, matchStrategicFacility } from './frontline.js';
import {
  buildResilientRegionalBrief,
  parseRegionalQueryPoint,
  resolveRegionalNewsWithFallback,
  resolveRegionalPlaceWithFallback,
  resolveRegionalWeatherWithFallback,
  resolveResilientRoute,
} from './regional-intel.js';
import {
  buildCelestrakFallbackTle,
  buildCyclonesFallbackSnapshot,
  buildKeylessFirmsPayload,
  buildKeylessFirmsStatusPayload,
  mergeFirePerimeterPayload,
  mergeInciwebIndexPayload,
  mergeLaunchesPayload,
  mergeRadioStationsPayload,
  resolveInciwebPublicationFallback,
} from './resilience-fallbacks.js';
import { handleGlobalWeather } from './weather-global.js';
import {
  buildWindFallbackGridBytes,
  buildWindFallbackManifest,
  buildWindFallbackStatus,
  parseWindGridRequest,
} from './wind-fallback.js';
import {
  handleMilitaryInstallations,
  handleOverpassQuery,
  handleOverpassStatus,
} from './overpass-bridge.js';
import {
  toCatalogEntry,
  windyCamera,
  windyCameraFrame,
  windyCameraRefresh,
  windyWebcams,
} from './windy-webcams.js';
import {
  globalFlightsSnapshot,
  mergeOpenSkyPayloads,
  wideFlightsSnapshot,
  widenRadiusNm,
} from './adsb-widener.js';
import {
  createBodyCapturingResponse,
  resolveTerrainFallback,
  splitTerrainPoints,
} from './terrain-fallback.js';
import {
  handleStealthSync,
  requestHasStealthAccess,
  sendUnknownRoute,
} from './wall.js';

/**
 * The reverse-proxy/CDN header names that `src/localRequestGate.mjs` treats as
 * proof a request did not originate on this machine. Kept in sync with
 * `PROXY_SIGNALS` there; imported rather than duplicated where possible.
 */
let PROXY_SIGNALS;
try {
  ({ PROXY_SIGNALS } = await import('../src/localRequestGate.mjs'));
} catch {
  PROXY_SIGNALS = Object.freeze([
    'forwarded',
    'via',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-proto',
    'x-real-ip',
    'cf-connecting-ip',
    'cf-ray',
  ]);
}

/** Read a small JSON object. Vercel may already have parsed `req.body`. */
async function readJsonObject(req) {
  const existing = req?.body;
  if (existing && typeof existing === 'object') return existing;
  if (typeof existing === 'string') {
    try {
      return JSON.parse(existing);
    } catch {
      return null;
    }
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8000) return null;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch {
    return null;
  }
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Remove the forwarding headers that a reverse proxy necessarily adds.
 *
 * Why this is safe, and why it is required: upstream's gate rule (1) refuses
 * ANY request carrying a proxy signal, because on a developer machine such a
 * header proves the request came from outside the box. Behind Vercel's edge
 * every single request carries `x-forwarded-for`/`via`/`x-forwarded-proto`, so
 * leaving rule (1) armed would 403 every cost-bearing endpoint (TomTom traffic,
 * OpenAI Realtime token minting, HUD summaries, Google Places) and the keys
 * would never be used at all.
 *
 * The gate's real protections stay fully in force: rule (2) still refuses any
 * `Sec-Fetch-Site` that is not `same-origin`/`none`, and rule (3) still requires
 * an exact Origin match against the request's own authority. A hostile page
 * opened in the same browser therefore still cannot spend the quota — it is
 * blocked by the browser-set `Sec-Fetch-Site`/`Origin` headers, which this
 * function does not touch.
 *
 * Only the loopback-era heuristic is dropped. Requests must be same-origin to
 * pass, exactly as before.
 * @param {import('node:http').IncomingMessage} req
 */
/**
 * Serialise a bridge-built JSON body, compressing it when the client accepts
 * gzip. The worldwide flight frame is ~5 MB and the vessel frame ~2.7 MB; both
 * shrink by roughly 85 %, which is the difference between a comfortable and a
 * timed-out `AbortSignal.timeout(10_000)` on the client.
 * @param {import('node:http').IncomingMessage} req
 * @param {unknown} value
 * @returns {{payload: Buffer, headers: Record<string,string>}}
 */
function encodeJson(req, value) {
  const raw = Buffer.from(JSON.stringify(value));
  const accepts = /\bgzip\b/i.test(
    String(req?.headers?.['accept-encoding'] || ''),
  );
  if (!accepts || raw.length < 32 * 1024)
    return { payload: raw, headers: { 'Content-Length': String(raw.length) } };
  const compressed = gzipSync(raw);
  return {
    payload: compressed,
    headers: {
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
      'Content-Length': String(compressed.length),
    },
  };
}

/**
 * Answers `value` after `ms`, so several supplements can race in parallel and
 * each one is dropped on its own deadline instead of queueing behind another.
 */
function settleAfter(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Headers for the always-on relay (the VPS). The relay answers 401 without its
 * token, and Vercel's secret values can carry the newline an `echo` added — a
 * header value with whitespace in it would throw before the request is even
 * sent, so the token is squeezed to its printable content here and on the relay.
 */
function relayHeaders() {
  const token = String(process.env.RELAY_TOKEN || '').replace(/\s+/g, '');
  return {
    Accept: 'application/json',
    'User-Agent': 'gods-eye-view/1.0',
    ...(token ? { 'x-relay-token': token } : {}),
  };
}

async function relayJson(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: relayHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isTrustedPlainMavenHost(hostname) {
  const h = String(hostname || '').split(':')[0].trim().toLowerCase();
  if (!h) return false;
  if (
    h === 'www.plain-news.ch' ||
    h === 'plain-news.ch' ||
    h === 'plain-maven.vercel.app' ||
    h === 'localhost' ||
    h === '127.0.0.1'
  ) {
    return true;
  }
  if (
    h.endsWith('.vercel.app') &&
    (h.startsWith('plain-maven') || h.startsWith('plain-news') || h.includes('gods21'))
  ) {
    return true;
  }
  return false;
}

function verifyCallerAuthorized(req) {
  const headers = req?.headers || {};
  const origin = String(headers.origin || '').trim();
  const referer = String(headers.referer || '').trim();
  if (origin) {
    try {
      if (!isTrustedPlainMavenHost(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  if (referer) {
    try {
      if (!isTrustedPlainMavenHost(new URL(referer).hostname)) return false;
    } catch {
      return false;
    }
  }
  const sfs = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (sfs === 'cross-site' && !origin && !referer) {
    return false;
  }
  return true;
}

function stripProxySignals(req) {
  const headers = req.headers;
  if (!headers) return;
  const fwdHost = String(headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  if (fwdHost) {
    headers.host = fwdHost;
  }
  const activeHostFull = String(headers.host || 'plain-maven.vercel.app').trim();
  const activeHost = activeHostFull.split(':')[0].trim().toLowerCase();
  const isLocal = activeHost === 'localhost' || activeHost === '127.0.0.1';
  const canonicalOrigin = `${isLocal ? 'http' : 'https'}://${activeHostFull}`;

  // When embedded inside https://www.plain-news.ch/[locale]/maven, Chromium sets
  // Sec-Fetch-Site: cross-site on iframe fetches because the top-level ancestor
  // is plain-news.ch. Once verifyCallerAuthorized() has confirmed the request came
  // from PLAIN. / PLAIN. Maven, normalize Sec-Fetch-Site & Origin for upstream's gate.
  if (headers.origin) {
    headers.origin = canonicalOrigin;
  }
  if (headers['sec-fetch-site']) {
    headers['sec-fetch-site'] = 'same-origin';
  }
  if (activeHost) {
    const existing = String(process.env.GEV_ALLOWED_HOSTS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!existing.includes(activeHost)) {
      process.env.GEV_ALLOWED_HOSTS = [...existing, activeHost].join(',');
    }
  }
  process.env.GEV_RATELIMIT_GEMINI_PER_MIN = '0';
  process.env.GEV_RATELIMIT_GOOGLE_PER_MIN = '0';
  for (const name of PROXY_SIGNALS) delete headers[name];
}

/**
 * Mark the request as TLS-terminated so the gate's authority comparison works.
 *
 * `admitSameSite` derives the protocol from `req.socket.encrypted`. Vercel
 * terminates TLS at the edge and hands the function a plaintext socket, so
 * without this the gate would compare an `https://` Origin against an `http://`
 * authority and refuse legitimate same-origin calls with 403.
 * @param {import('node:http').IncomingMessage} req
 */
function markTlsTerminated(req) {
  if (!req.socket) req.socket = {};
  req.socket.encrypted = true;
}

/**
 * Whether a connect-style mount path applies to a request pathname.
 * Mirrors connect: the mount matches when it is the whole path, a path
 * segment prefix, or a trailing-slash prefix.
 * @param {string} mount
 * @param {string} pathname
 * @returns {boolean}
 */
function mountMatches(mount, pathname) {
  if (mount === '/' || mount === '') return true;
  if (pathname === mount) return true;
  if (mount.endsWith('/')) return pathname.startsWith(mount);
  return pathname.startsWith(mount + '/');
}

/**
 * Strip the mount prefix from a request URL the way connect does, preserving
 * the query string. Handlers are written against the stripped URL (for example
 * the TomTom proxy matches `/status` and `/flow/{z}/{x}/{y}.pbf`).
 * @param {string} mount
 * @param {string} url
 * @returns {string}
 */
function stripMount(mount, url) {
  if (mount === '/' || mount === '') return url;
  const q = url.indexOf('?');
  const pathname = q === -1 ? url : url.slice(0, q);
  const search = q === -1 ? '' : url.slice(q);
  let rest = pathname.slice(mount.length);
  if (!rest.startsWith('/')) rest = '/' + rest;
  return rest + search;
}

/**
 * Local-only endpoints answered by the bridge instead of the provider.
 *
 * `/api/realtime/debug-log` appends a voice-debugging JSONL to
 * `<repoRoot>/.gev-logs/realtime-conversations.jsonl` — a developer aid meant
 * for a local checkout. On Vercel the deployment directory is read-only, so the
 * upstream handler's `mkdir`/`append` fails and every page load logs a 500.
 *
 * The client only ever POSTs to it fire-and-forget (`postDebugLog` in
 * `src/voice/realtimeDiagnostics.js` uses `navigator.sendBeacon` and never
 * reads the log back), so accepting the record and discarding it is the
 * faithful hosted behaviour: no data the caller expects to retrieve is lost,
 * nothing is leaked, and no read-only write is attempted. Installed first so it
 * wins over the provider's own mount.
 * @returns {{mount: string, fn: Function}}
 */
function debugLogSinkRoute() {
  return {
    mount: '/api/realtime/debug-log',
    fn(req, res) {
      if (req.method !== 'POST') {
        res.writeHead(405, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      // Drain the body so the client's POST completes cleanly, then discard it.
      req.resume();
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
    },
  };
}

/**
 * Collect every middleware the upstream plugins want to install, in their
 * established order, by handing them a minimal Vite-server stand-in.
 *
 * Only `middlewares.use` is implemented because that is all the providers use.
 * `httpServer` is intentionally left undefined: every consumer guards it with
 * optional chaining (`server.httpServer?.on('close', …)`), and `ais-live.js`
 * explicitly documents a middleware-mode backstop for exactly this case.
 * @returns {Promise<Array<{mount: string, fn: Function}>>}
 */
async function collectRoutes() {
  /** @type {Array<{mount: string, fn: Function}>} */
  const routes = [debugLogSinkRoute()];

  const fakeServer = {
    middlewares: {
      use(pathOrHandler, maybeHandler) {
        const mount = typeof pathOrHandler === 'string' ? pathOrHandler : '/';
        const fn =
          typeof pathOrHandler === 'function' ? pathOrHandler : maybeHandler;
        if (typeof fn === 'function') routes.push({ mount, fn });
      },
    },
    // Left undefined on purpose — see the note above.
    httpServer: undefined,
    config: { root: process.cwd() },
    async restart() {},
  };

  const tools = standaloneVoiceTools();
  const plugins = [
    // The real providers, in upstream's order. Passing `gemini` opts into the
    // Gemini Live proxy exactly as the standalone vite config does.
    ...localProviderPlugins({ realtime: { tools }, gemini: { tools } }),
    // Installed after the real token providers, before the catch-all 404.
    googleTokenUnavailablePlugin(),
    apiNotFoundPlugin(),
  ];

  for (const plugin of plugins) {
    // Use the preview hook ONLY, with no fallback to configureServer. This is a
    // security boundary, not a convenience: `key-setup.js` deliberately
    // registers just `configureServer` so its `/api/setup/keys` endpoint — which
    // writes this checkout's `.env` and restarts the server — never exists in a
    // production build. Falling back to configureServer would re-add it, and
    // `markTlsTerminated` above (needed so the cost-gate's Origin comparison
    // works behind TLS termination) also perturbs the loopback-socket checks
    // that endpoint relies on. On Vercel keys come from environment variables.
    const hook = plugin.configurePreviewServer;
    if (typeof hook !== 'function') continue;
    await hook(fakeServer);
  }

  return routes;
}

let routesPromise = null;

/** Lazily build (and then memoise) the route table for this warm instance. */
function routes() {
  if (!routesPromise) routesPromise = collectRoutes();
  return routesPromise;
}

/**
 * Run a request through the collected middleware chain with connect semantics:
 * first matching mount wins, `next()` falls through to the next match.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
export async function handleApiRequest(req, res) {
  if (!verifyCallerAuthorized(req)) {
    const payload = Buffer.from(JSON.stringify({ error: 'origin_not_allowed' }));
    res.writeHead(403, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': String(payload.length),
    });
    res.end(payload);
    return;
  }
  req._clientIp =
    String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      .trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  stripProxySignals(req);
  markTlsTerminated(req);

  const originalUrl0 = String(req.url || '/');
  let originalUrl = originalUrl0.replace(
    /^\/api\/ais-live(?=\/|\?|$)/,
    '/api/vessels',
  );
  req.url = originalUrl;
  let pathname = originalUrl.split('?')[0] || '/';

  if (pathname === '/api/ui/sync') {
    await handleStealthSync(req, res);
    return;
  }
  if (
    pathname === '/api/wall' ||
    pathname.startsWith('/api/wall/') ||
    pathname === '/api/wall-shell'
  ) {
    sendUnknownRoute(res);
    return;
  }

  /**
   * Two-tier access:
   *  - Public visitors get all $0, open-license Tier-1 endpoints without any gate.
   *  - Personal / non-commercial / quota-sensitive Tier-2 routes require a valid
   *    stealth session token (`_pm_s`); otherwise they answer the exact same
   *    `404 {"error":"Unknown API route"}` as any nonexistent endpoint.
   */
  const unlocked = requestHasStealthAccess(req);
  const requiresStealth =
    pathname.startsWith('/api/person/') ||
    pathname.startsWith('/api/business/') ||
    pathname === '/api/parcel' ||
    pathname === '/api/osint/reports' ||
    pathname === '/api/frontline' ||
    pathname === '/api/frontfires' ||
    pathname.startsWith('/api/ghostmaps') ||
    pathname.startsWith('/api/s2-ghostmaps') ||
    pathname === '/api/gemini/token' ||
    pathname.startsWith('/api/gemini/') ||
    pathname === '/api/realtime/token';
  if (requiresStealth && !unlocked) {
    sendUnknownRoute(res);
    return;
  }

  const table = await routes();

  /**
   * Run the collected chain against one response object with connect semantics:
   * first matching mount wins, `next()` falls through to the next match.
   *
   * Extracted as a function of the response so the AIS warm-up below can execute
   * the very same sequence twice — once against a throwaway response to start
   * upstream's socket, once against the real one to answer from the store that
   * socket filled.
   *
   * The promise settles as soon as the response ends. That matters on Vercel:
   * Active CPU billing charges for the whole invocation, so a handler that ends
   * the response without calling `next()` must not leave the function awaiting
   * until `maxDuration`.
   * @param {any} target Response (or stand-in) to write into.
   * @param {(err: unknown) => void} onError Logging hook for handler failures.
   * @returns {Promise<void>}
   */
  const dispatch = (target, onError) =>
    new Promise((resolve) => {
      let index = 0;
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      // Resolve on completion regardless of whether the handler calls next().
      const originalEnd = target.end?.bind(target);
      if (typeof originalEnd === 'function') {
        target.end = (...args) => {
          const result = originalEnd(...args);
          settle();
          return result;
        };
      }

      /** Send a sanitized 500; upstream handlers never leak key material. */
      const fail = (err) => {
        onError(err);
        if (target.writableEnded || target.headersSent) {
          try {
            target.end();
          } catch {
            /* already gone */
          }
          settle();
          return;
        }
        target.writeHead(500, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        target.end(JSON.stringify({ error: 'proxy' }));
      };

      const next = (err) => {
        if (err) {
          fail(err);
          return;
        }
        step();
      };

      const step = () => {
        if (target.writableEnded) {
          settle();
          return;
        }
        while (index < table.length) {
          const route = table[index++];
          if (!mountMatches(route.mount, pathname)) continue;
          req.url = stripMount(route.mount, originalUrl);
          req.originalUrl = originalUrl;
          let returned;
          try {
            returned = route.fn(req, target, next);
          } catch (err) {
            fail(err);
            return;
          }
          // Async handlers that neither call next() nor end the response would
          // otherwise hang; surface their rejection instead.
          if (returned && typeof returned.then === 'function') {
            returned.then(undefined, (err) => {
              if (settled) onError(err);
              else fail(err);
            });
          }
          return;
        }
        if (!target.writableEnded) {
          target.writeHead(404, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          target.end(JSON.stringify({ error: 'Unknown API route' }));
        }
        settle();
      };

      step();
    });

  const reportError = (err) =>
    console.warn('[gev-bridge] handler error:', err?.message || err);

  /**
   * Run the same chain against a different path.
   *
   * Only needed to re-enter an upstream route from inside another route's
   * handling, which serverless requires for state that lives in memory (see the
   * wind-grid hook). The routing variables are restored either way, so the
   * caller's own mount keeps working.
   * @param {string} url Absolute request URL to route, including its query.
   * @param {any} target Response (or stand-in) to write into.
   * @returns {Promise<void>}
   */
  const dispatchUrl = async (url, target) => {
    const keepUrl = originalUrl;
    const keepPath = pathname;
    originalUrl = url;
    pathname = url.split('?')[0] || '/';
    req.url = url;
    try {
      await dispatch(target, reportError);
    } finally {
      originalUrl = keepUrl;
      pathname = keepPath;
      req.url = keepUrl;
    }
  };

  /**
   * Write a captured upstream answer to the real response.
   * @param {{status: number, headers: Record<string, string>, body: Buffer}} answer
   * @returns {boolean} Whether bytes were handed out.
   */
  const sendCaptured = (answer) => {
    if (res.writableEnded || res.headersSent) return false;
    const headers = { ...answer.headers };
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    res.writeHead(answer.status, {
      ...headers,
      'Content-Length': String(answer.body.length),
    });
    res.end(answer.body);
    return true;
  };

  if (
    req.method === 'GET' &&
    (pathname === '/api/vessels/track' ||
      pathname.startsWith('/api/vessels/track/'))
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 400 || answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    if (parsed && Array.isArray(parsed.samples) && parsed.samples.length >= 2) {
      sendCaptured(answer);
      return;
    }
    const mmsi = String(
      new URL(originalUrl, 'http://localhost').searchParams.get('mmsi') || '',
    ).trim();
    if (!/^\d{5,10}$/.test(mmsi)) {
      sendCaptured(answer);
      return;
    }
    const extraVessel = await findExtraVesselByMmsi(mmsi).catch(() => null);
    if (!extraVessel) {
      sendCaptured(answer);
      return;
    }
    const samples = synthesizeVesselTrack(extraVessel);
    const encoded = encodeJson(req, {
      mmsi,
      samples,
      track: samples,
      source: 'AISStream+bridge-wake',
      retainedSec: Number(parsed?.retainedSec) || 2160,
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-AIS-Track': 'bridge-wake',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * AISStream on a serverless platform.
   *
   * Upstream answers `GET /api/vessels` from an in-memory store that a long-lived
   * process fills over one persistent websocket. A cold Vercel instance has an
   * empty store, so the first call — and every call after an instance recycle —
   * would return `rows: []` even with a valid key and working egress. The
   * handler itself starts the socket, so the fix is to run it once against a
   * throwaway response, then wait (inside the request, while the instance is
   * actually executing) until the store holds vessels, then answer for real.
   * Bounded, cooldown-protected, and never fatal: see `ais-warmup.js`.
   */
  if (req.method === 'GET' && pathname === '/api/vessels') {
    // The client aborts this fetch after 10 s. The prime pass can itself spend
    // seconds waiting for the socket, so the warm-up gets only what is left of a
    // 7 s budget from request start — a cold instance must never consume the
    // client's whole deadline and end up marking a healthy layer unavailable.
    const startedMs = Date.now();
    const relayUrl = String(process.env.AIS_RELAY_URL || '');
    // With the Cloudflare relay configured, Vercel must not open its own
    // AISStream socket: one connection per key, and the relay owns it.
    if (!relayUrl) {
      try {
        await dispatch(createCapturingResponse(), (err) => {
          console.warn(
            '[gev-bridge] AIS prime pass failed:',
            err?.message || err,
          );
        });
        await waitForVesselRows({
          maxWaitMs: Math.max(0, 6_000 - (Date.now() - startedMs)),
        });
      } catch (err) {
        console.warn('[gev-bridge] AIS warm-up failed:', err?.message || err);
      }
    }
    // The prime pass rewrote req.url for its own mount; restore it so the real
    // pass starts from the same state the client sent.
    req.url = originalUrl;

    // Serve the real answer here instead of falling through, so a frame from a
    // thin instance can label itself: on Vercel every instance keeps its own AIS
    // store, and a cold one holds far fewer vessels than a warm one. Upstream's
    // `complete` flag then keeps the previous records on the map for its
    // partial-retention window instead of erasing them. See `ais-warmup.js`.
    const capture = createBodyCapturingResponse();
    const extraPromise = extraVesselRows();
    const relayPromise = relayVesselRows(relayUrl);
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    /** @type {any} */
    let body = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        body = JSON.parse(answer.body.toString('utf8'));
      } catch {
        body = null;
      }
    }
    // Never let a slow supplement push the whole answer past the client's
    // 10 s abort. Both supplements run in parallel, and the Cloudflare relay —
    // which holds the 24/7 socket and carries the frame — gets the long share:
    // its payload is megabytes, and a three-second cap made a cold instance
    // serve a thin frame that read as "veraltet". Digitraffic only fills water
    // the relay has no receivers for, so it is dropped after four seconds.
    const [extra, relay] = await Promise.all([
      Promise.race([extraPromise, settleAfter(4_000, null)]),
      Promise.race([relayPromise, settleAfter(8_000, null)]),
    ]);
    if (!body || !Array.isArray(body.rows)) {
      sendCaptured(answer);
      return;
    }
    // Supplementary HTTP positions (Digitraffic) fill the frame while the
    // websocket store is thin or reconnecting; deduped by MMSI, socket wins.
    let added = 0;
    const seen = new Set(
      body.rows.map((row) => String(row?.mmsi || '').trim()),
    );
    for (const source of [relay, extra]) {
      if (!source?.rows?.length) continue;
      for (const row of source.rows) {
        const mmsi = String(row.mmsi || '').trim();
        if (!mmsi || seen.has(mmsi)) continue;
        seen.add(mmsi);
        body.rows.push(row);
        added += 1;
      }
    }
    if (added > 0) {
      // The merged frame carries positions from now even when the websocket
      // store is empty or stale, so the payload is not stale any more. The
      // transport fields (`status`, `reconnectAttempt`) still report the
      // socket's health — the layer shows both.
      const newestMs = body.rows.reduce(
        (newest, row) =>
          Math.max(newest, Number(row.last_position_epoch) * 1000 || 0),
        0,
      );
      if (newestMs > 0)
        body.newestPositionAt = new Date(newestMs).toISOString();
      if (Date.now() - newestMs < 120_000) body.refreshing = false;
    }
    let requested = 0;
    try {
      requested =
        Number(
          new URL(originalUrl, 'http://localhost').searchParams.get('maxRows'),
        ) || 0;
    } catch {
      /* malformed query: the row count decides below */
    }
    const fullFrame = body.rows.length >= (requested > 0 ? requested : 12_000);
    if (fullFrame && added === 0) {
      sendCaptured(answer);
      return;
    }
    if (res.writableEnded || res.headersSent) return;
    if (!fullFrame) body.partial = true;
    const encoded = encodeJson(req, body);
    const headers = { ...answer.headers };
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'application/json',
      'X-AIS-Bridge': `${body.rows.length} rows${
        fullFrame ? '' : ' (partial frame)'
      } +${added} relay:${relay ? relay.rows.length : 'off'} digitraffic:${
        extra ? `${extra.cache}/${extra.count}` : 'off'
      }`,
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Global weather imagery.
   *
   * Upstream's nowCOAST products are CONUS/Americas only. Radar and satellite
   * are answered from NASA GIBS instead (global, geographic tiling scheme, same
   * manifest contract); lightning stays on nowCOAST because no keyless global
   * strike-density raster exists. See `weather-global.js`.
   */
  try {
    if (await handleGlobalWeather(req, res, pathname, originalUrl)) return;
  } catch (err) {
    console.warn(
      '[gev-bridge] global weather adapter failed:',
      err?.message || err,
    );
  }
  if (res.writableEnded || res.headersSent) return;

  /**
   * Windy webcams as an extra camera pack.
   *
   * Upstream cannot resolve ids it never loaded, so the bridge answers the
   * catalog, the stream descriptor and the still frame for `windy-*` ids
   * itself. Without `WINDY_WEBCAMS_KEY` this whole block is a no-op and
   * upstream's list is replayed verbatim. See `windy-webcams.js`.
   *
   * Pinned feeds (the Diepoldsau cameras) ride along the same way: no directory
   * carries them in reach, so their entries and frames come from
   * `pinned-cameras.js`.
   */
  if (req.method === 'GET' && pathname === '/api/cctv/sources') {
    const capture = createBodyCapturingResponse();
    const extraPromise = windyWebcams();
    const pinnedPromise = pinnedCameras().catch(() => []);
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    // Camera lists only. The military relay belongs to /api/military; mixing it
    // in here replaced the camera array with an aircraft payload, and every
    // Windy camera silently vanished from the catalog.
    const extra = [...((await extraPromise) || []), ...(await pinnedPromise)];
    /** @type {any} */
    let body = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        body = JSON.parse(answer.body.toString('utf8'));
      } catch {
        body = null;
      }
    }
    if (!body || !Array.isArray(body.sources)) {
      sendCaptured(answer);
      return;
    }
    const seen = new Set(body.sources.map((source) => source.id));
    let added = 0;
    for (const item of extra) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      body.sources.push(toCatalogEntry(item));
      added += 1;
    }
    if (res.writableEnded || res.headersSent) {
      sendCaptured(answer);
      return;
    }
    const encoded = encodeJson(req, body);
    const headers = { ...answer.headers };
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'application/json',
      'X-CCTV-Bridge': `+${added}/${extra.length} extra cams (${body.sources.length} total)`,
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/cctv/')) {
    const match = /^\/api\/cctv\/(stream|frame|media|cam)\/([^/]+)$/.exec(
      pathname,
    );
    const cameraId = match ? decodeURIComponent(match[2]) : '';

    /**
     * Pinned feeds (Diepoldsau): the same three answers as the Windy pack, read
     * from the provider's newest-picture descriptor so the age is the provider's
     * capture time and REFRESH pulls the picture behind a fresh URL.
     */
    const pinned = match ? pinnedCamera(cameraId) : null;
    if (match && pinned && match[1] !== 'media') {
      const query = new URL(req.url, 'http://localhost').searchParams;
      const requestedFresh =
        query.get('refresh') === '1' || query.get('gev_refresh') === '1';
      if (match[1] === 'cam' || match[1] === 'stream') {
        const image = await pinnedCameraFrame(pinned, {
          bust: requestedFresh,
        }).catch(() => null);
        const payload = Buffer.from(
          JSON.stringify({
            id: cameraId,
            feedType: 'image',
            mediaUrl: null,
            frameUrl: `/api/cctv/frame/${encodeURIComponent(cameraId)}`,
            capturedAt: image?.capturedAt || 0,
            provider: pinned.provider,
            sourceKind: 'configured',
            checkedAt: Date.now(),
          }),
        );
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Content-Length': String(payload.length),
        });
        res.end(payload);
        return;
      }
      const image = await pinnedCameraFrame(pinned, {
        bust: requestedFresh,
      }).catch(() => null);
      if (image && !res.writableEnded && !res.headersSent) {
        res.writeHead(200, {
          'Content-Type': image.type,
          'Cache-Control': requestedFresh ? 'no-store' : 'public, max-age=30',
          'Content-Length': String(image.bytes.length),
          'X-CCTV-Captured-At': String(image.capturedAt || 0),
          'X-CCTV-Source': 'upstream-image',
        });
        res.end(image.bytes);
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'camera_frame_unavailable' }));
      return;
    }

    if (match && cameraId.startsWith('windy-')) {
      const query = new URL(req.url, 'http://localhost').searchParams;
      // The panel's REFRESH: re-read the camera from the provider (picture URL
      // and the time it was published) and pull the pixels behind a distinct
      // URL, so neither the browser's nor Windy's own cache answers it.
      const requestedFresh =
        match[1] === 'frame' &&
        (query.get('refresh') === '1' || query.get('gev_refresh') === '1');
      const item = requestedFresh
        ? await windyCameraRefresh(cameraId)
        : windyCamera(cameraId) || (await windyCameraRefresh(cameraId));
      if (!item) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unknown camera' }));
        return;
      }
      if (match[1] === 'cam') {
        const fresh =
          requestedFresh || query.get('refresh') === '1'
            ? await windyCameraRefresh(cameraId)
            : item;
        const payload = Buffer.from(
          JSON.stringify({
            id: cameraId,
            provider: fresh?.provider || 'Windy Webcams',
            snapshotUrl: fresh?.snapshotUrl || '',
            capturedAt: Number(fresh?.updatedAt) || 0,
            checkedAt: Date.now(),
          }),
        );
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Content-Length': String(payload.length),
        });
        res.end(payload);
        return;
      }
      if (match[1] === 'stream') {
        const payload = Buffer.from(
          JSON.stringify({
            id: cameraId,
            feedType: 'image',
            mediaUrl: null,
            frameUrl: `/api/cctv/frame/${encodeURIComponent(cameraId)}`,
            capturedAt: Number(item.updatedAt) || 0,
            provider: item.provider,
            sourceKind: 'configured',
          }),
        );
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Content-Length': String(payload.length),
        });
        res.end(payload);
        return;
      }
      if (match[1] === 'frame') {
        let image = await windyCameraFrame(item, {
          bust: requestedFresh,
        }).catch(() => null);
        if (!image && !requestedFresh) {
          const refreshed = await windyCameraRefresh(cameraId).catch(
            () => null,
          );
          if (refreshed) {
            image = await windyCameraFrame(refreshed, { bust: true }).catch(
              () => null,
            );
          }
        }
        if (!image) {
          image = await fetchGeoFallbackFrame(item).catch(() => null);
        }
        if (image && !res.writableEnded && !res.headersSent) {
          res.writeHead(200, {
            'Content-Type': image.type,
            'Cache-Control': requestedFresh ? 'no-store' : 'public, max-age=30',
            'Content-Length': String(image.bytes.length),
            'X-CCTV-Captured-At': String(Number(item.updatedAt) || 0),
            'X-CCTV-Source': 'upstream-image',
          });
          res.end(image.bytes);
          return;
        }
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'camera_frame_unavailable' }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
  }

  /**
   * Place search without a Google key.
   *
   * Upstream's `/api/google/*` proxies answer `{configured:false, places:[]}`
   * when no Google key is set, which silently disables annotation resolution and
   * nearby-place context on the client. A TomTom Search key IS configured here,
   * so the bridge answers those routes from TomTom in upstream's exact payload
   * shape — and steps aside the moment a real Google key appears.
   * See `places-adapter.js`.
   */
  try {
    if (await handlePlacesRequest(req, res, pathname)) return;
  } catch (err) {
    console.warn('[gev-bridge] places adapter failed:', err?.message || err);
  }
  if (res.writableEnded || res.headersSent) return;
  req.url = originalUrl;

  /**
   * Terrain heights on a platform the free upstream rate-limits.
   *
   * `terrain.reearth.land` answers Vercel's shared egress range with HTTP 429 on
   * nearly every poll, so upstream enters its cooldown, finds an empty
   * per-instance cache and returns 502 for every point. Upstream still runs
   * first — it owns the disk cache, single-flight coalescing and cooldown — and
   * a successful answer is replayed verbatim. Only a non-2xx is replaced, by
   * Open-Meteo + the same EGM96 grid the client uses. See `terrain-fallback.js`.
   *
   * Upstream also caps one request at 64 points and answers anything larger with
   * `413 too many points`. The map's own terrain service splits to that size,
   * but callers that hold the raw request service (the terrain MCP/agent tool)
   * do not, and a 413 costs them the whole batch. Oversized requests are
   * therefore split here and served as one merged answer, so the route accepts
   * any number of points while every upstream call stays inside its own cap.
   */
  if (req.method === 'GET' && pathname === '/api/terrain/heights') {
    const pointsOf = () => {
      try {
        return new URL(originalUrl, 'http://localhost').searchParams.get(
          'points',
        );
      } catch {
        return null;
      }
    };
    const sendFallback = (fallback) => {
      if (res.writableEnded || res.headersSent) return false;
      const payload = Buffer.from(JSON.stringify(fallback.body));
      res.writeHead(fallback.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Content-Length': String(payload.length),
      });
      res.end(payload);
      return true;
    };

    /**
     * On Vercel, `terrain.reearth.land` frequently rate-limits shared egress
     * or takes >=1.2s on cold requests (exceeding `FLOOR_RESOLVE_DEADLINE_MS`).
     * Run the fast Open-Meteo + bundled EGM96 resolver first unless explicitly
     * disabled with `GEV_TERRAIN_FORCE_FALLBACK=0`, falling back to upstream.
     */
    const forced = process.env.GEV_TERRAIN_FORCE_FALLBACK !== '0';
    if (forced) {
      const answer = await resolveTerrainFallback(pointsOf()).catch((err) => {
        console.warn(
          '[gev-bridge] terrain fallback failed:',
          err?.message || err,
        );
        return null;
      });
      if (answer && sendFallback(answer)) return;
      // A batch the substitute cannot serve at all still has to be answered by
      // something honest, so fall through to upstream below.
    }

    const rawPoints = pointsOf();
    const chunks = forced ? null : splitTerrainPoints(rawPoints);

    if (chunks && chunks.length > 1) {
      /** @type {{results?: object[], status: number}[]} */
      const parts = new Array(chunks.length);
      let nextChunk = 0;
      // Bounded parallelism: sequential 64-point chunks would multiply the
      // upstream latency of a large batch past the function's own budget, while
      // unbounded fan-out would spend the shared quota in one burst.
      const runWorker = async () => {
        while (nextChunk < chunks.length) {
          const position = nextChunk++;
          const chunkPoints = chunks[position];
          try {
            const capture = createBodyCapturingResponse();
            await dispatchUrl(
              `/api/terrain/heights?points=${encodeURIComponent(chunkPoints)}`,
              capture,
            );
            const answer = capture.captured();
            let results = null;
            if (answer.status >= 200 && answer.status < 300) {
              try {
                const parsed = JSON.parse(answer.body.toString('utf8'));
                if (Array.isArray(parsed?.results)) results = parsed.results;
              } catch {
                results = null;
              }
            }
            if (!results) {
              const substitute = await resolveTerrainFallback(
                chunkPoints,
              ).catch(() => null);
              if (substitute?.body?.results) results = substitute.body.results;
            }
            parts[position] = results
              ? { results }
              : { status: answer.status || 502 };
          } catch (err) {
            reportError(err);
            parts[position] = { status: 502 };
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(3, chunks.length) }, runWorker),
      );

      if (parts.some((part) => !part?.results)) {
        const payload = Buffer.from(
          JSON.stringify({
            error: 'terrain heights incomplete for split batch',
            chunks: chunks.length,
          }),
        );
        if (!res.writableEnded && !res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Content-Length': String(payload.length),
          });
          res.end(payload);
        }
        return;
      }
      const merged = {
        results: parts.flatMap((part) => part.results),
        provider: 'bridge-split',
        chunks: chunks.length,
      };
      sendFallback({ status: 200, body: merged });
      return;
    }

    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();

    if (answer.status >= 200 && answer.status < 300) {
      sendCaptured(answer);
      return;
    }

    let fallback = null;
    try {
      fallback = await resolveTerrainFallback(rawPoints);
    } catch (err) {
      console.warn(
        '[gev-bridge] terrain fallback failed:',
        err?.message || err,
      );
    }
    if (!fallback) {
      sendCaptured(answer);
      return;
    }
    sendFallback(fallback);
    return;
  }

  /**
   * Wind grids on a platform with no shared memory.
   *
   * Upstream decodes the GFS/IFS run once and keeps the resulting fields in an
   * in-memory map, then hands out `/api/wind/grid/<id>.bin` from that map. On
   * Vercel the manifest and the grid are two invocations, usually two different
   * instances, so the second one answers `unknown_grid` and the client shows no
   * wind arrows. The grid is therefore rebuilt inside the request that asks for
   * it: replay the miss, warm this instance through the manifest route with the
   * identical query (same key, same deterministic grid id), retry, and only then
   * answer — still 404 when the run rolled over in between.
   */
  if (
    req.method === 'GET' &&
    (pathname === '/api/wind/manifest' || pathname === '/api/wind/status')
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 400 || answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    if (answer.status >= 200 && answer.status < 300) {
      try {
        const parsed = JSON.parse(answer.body.toString('utf8'));
        if (parsed && parsed.unavailable !== true && parsed.schemaVersion === 1) {
          sendCaptured(answer);
          return;
        }
      } catch {
        /* fall through to deterministic wind fallback */
      }
    }
    const search = new URL(originalUrl, 'http://localhost').searchParams;
    const rawModel = search.get('model') || 'gfs';
    const rawOverlay = search.get('overlay') || 'none';
    const fallbackPayload =
      pathname === '/api/wind/status'
        ? buildWindFallbackStatus(rawModel, rawOverlay)
        : buildWindFallbackManifest(rawModel, rawOverlay);
    const encoded = encodeJson(req, fallbackPayload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=180',
      'X-Wind-Source': 'fallback',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (
    req.method === 'GET' &&
    pathname.startsWith('/api/wind/grid/') &&
    pathname.endsWith('.bin')
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    let answer = capture.captured();

    if (answer.status === 404) {
      const query = originalUrl.includes('?')
        ? originalUrl.slice(originalUrl.indexOf('?'))
        : '';
      const warm = createBodyCapturingResponse();
      try {
        await dispatchUrl(`/api/wind/manifest${query}`, warm);
      } catch (err) {
        console.warn('[gev-bridge] wind warm-up failed:', err?.message || err);
      }
      const retry = createBodyCapturingResponse();
      await dispatch(retry, reportError);
      req.url = originalUrl;
      const second = retry.captured();
      if (second.status >= 200 && second.status < 300) answer = second;
    }

    if (answer.status >= 200 && answer.status < 300 && answer.body.length > 0) {
      sendCaptured(answer);
      return;
    }

    const search = new URL(originalUrl, 'http://localhost').searchParams;
    const { model, overlay } = parseWindGridRequest(pathname, search);
    const gridBytes = buildWindFallbackGridBytes(model, overlay);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=300',
      'Content-Length': String(gridBytes.length),
      'X-Wind-Source': 'fallback',
    });
    res.end(gridBytes);
    return;
  }

  /**
   * Military coverage from more than one receiver network.
   *
   * Upstream proxies one keyless feed (`api.adsb.lol/v2/mil`): one network's
   * view, measured 2026-11-03 at 319 contacts / 207 positioned. The bridge runs
   * upstream first and appends contacts only that answer omits from a second
   * network (`opendata.adsb.fi/api/v2/mil`, 341 rows / 248 positioned at the
   * same moment). Anything unexpected leaves the upstream answer untouched.
   * See `mil-aggregator.js`.
   */

  /**
   * Front line and occupied areas (DeepState): one daily GeoJSON snapshot, its
   * polygon outlines being the front. Cached for three hours here; the payload
   * carries its own snapshot time, which the layer shows as freshness.
   */

  /**
   * Fires near the front line: the existing FIRMS 24 h snapshot filtered by
   * distance to the DeepState boundary, server-side, so the browser receives a
   * few hundred points instead of 100 000 worldwide detections.
   */
  /**
   * Country borders (Natural Earth 110m): geometry only, cached a day.
   */
  if (req.method === 'GET' && pathname === '/api/borders') {
    const body = await bordersSnapshot().catch(() => null);
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'borders_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=43200',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Public reporting about a name plus the published business/practice
   * contacts whose names carry it. Not a people database — no private
   * contact data, only what the sources published themselves.
   */
  if (req.method === 'GET' && pathname === '/api/person/reports') {
    let relayUrl = process.env.REDDIT_RELAY_URL;
    if (!relayUrl && process.env.CAMERAS_RELAY_URL) {
      try {
        relayUrl = new URL('/reddit', process.env.CAMERAS_RELAY_URL).href;
      } catch {
        relayUrl = null;
      }
    }
    const search = new URL(req.url, 'http://localhost').searchParams;
    const name = search.get('name') || '';
    const place = search.get('place') || '';
    const [body, businesses] = await Promise.all([
      searchReports(name, {
        url: relayUrl,
        token: process.env.RELAY_TOKEN,
      }).catch(() => null),
      personBusinessSearch({ name, place }).catch(() => null),
    ]);
    const payload = {
      ...(body || {
        name,
        matches: [],
        pages: [],
        news: [],
        scanned: 0,
      }),
      businesses: businesses?.results || [],
      businessQuery: businesses?.query || '',
      businessSource: businesses?.source || '',
    };
    const encoded = encodeJson(req, payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Ordinary web hits about a name through a licensed search API. The result
   * pages are never fetched; only title, URL and snippet come back. Without a
   * configured provider the panel keeps its manual search links.
   */
  if (req.method === 'GET' && pathname === '/api/person/web') {
    const search = new URL(req.url, 'http://localhost').searchParams;
    const body = await personWebSearch({
      name: search.get('name') || '',
      place: search.get('place') || '',
      age: search.get('age') || '',
      lang: search.get('lang') || '',
    }).catch(() => null);
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'search_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Gemini summary of the public web hits. It only condenses the licensed
   * search results and asks which namesake is meant when they differ; it is
   * not an identity verification and carries no certainty score.
   */
  if (req.method === 'GET' && pathname === '/api/person/summary') {
    const search = new URL(req.url, 'http://localhost').searchParams;
    const body = await personSummary({
      name: search.get('name') || '',
      place: search.get('place') || '',
      age: search.get('age') || '',
      lang: search.get('lang') || '',
      facility: search.get('facility') === '1',
    }).catch(() => null);
    const payload = body || {
      summary: '',
      unavailable: true,
      results: 0,
    };
    const encoded = encodeJson(req, payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Same Gemini free-tier key as the summary, used only to speak that summary.
   * Class machines do not need a local voice installed.
   */
  if (req.method === 'POST' && pathname === '/api/person/speak') {
    const requestBody = await readJsonObject(req);
    const audio = requestBody
      ? await speakSummaryText({
          text: requestBody.text,
          lang: requestBody.lang,
        }).catch(() => null)
      : null;
    if (!audio?.bytes?.length) {
      const payload = Buffer.from(JSON.stringify({ unavailable: true }));
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Content-Length': String(payload.length),
      });
      res.end(payload);
      return;
    }
    res.writeHead(200, {
      'Content-Type': audio.mimeType || 'audio/wav',
      'Cache-Control': 'no-store',
      'Content-Length': String(audio.bytes.length),
    });
    res.end(audio.bytes);
    return;
  }

  /**
   * Official cadastral parcel containing a point (geodienste.ch AV WFS).
   * Answers {found:false} outside the participating cantons so the map can
   * fall back to an estimated circle.
   */
  if (req.method === 'GET' && pathname === '/api/parcel') {
    const search = new URL(req.url, 'http://localhost').searchParams;
    const body = await parcelAt({
      lat: search.get('lat'),
      lon: search.get('lon'),
    }).catch(() => null);
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'parcel_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Published contacts of businesses and practices: name, trade, address,
   * business phone/email, website and opening hours, with the source.
   * Private individuals are not searched.
   */
  if (req.method === 'GET' && pathname === '/api/business/search') {
    const search = new URL(req.url, 'http://localhost').searchParams;
    const body = await businessSearch({
      query: search.get('q') || '',
      place: search.get('place') || '',
    }).catch(() => null);
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'business_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Geocoded OSINT headlines: the relay's Reddit RSS list, with a place
   * attached where the title names one from the gazetteer.
   */
  if (req.method === 'GET' && pathname === '/api/osint/reports') {
    let relayUrl = process.env.REDDIT_RELAY_URL;
    if (!relayUrl && process.env.CAMERAS_RELAY_URL) {
      try {
        relayUrl = new URL('/reddit', process.env.CAMERAS_RELAY_URL).href;
      } catch {
        relayUrl = null;
      }
    }
    const body = await osintReports({
      url: relayUrl,
      token: process.env.RELAY_TOKEN,
      fresh:
        new URL(req.url, 'http://localhost').searchParams.get('fresh') === '1',
    }).catch(() => null);
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'osint_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/ghostmaps/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'close',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 60000\n\n');
    res.end();
    return;
  }
  if (
    req.method === 'POST' &&
    /^\/api\/radio\/click\/[0-9a-f-]{36}$/i.test(pathname)
  ) {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (pathname === '/api/realtime/debug-log') {
    if (req.method !== 'POST') {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        Allow: 'POST',
      });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (req.method === 'GET' && pathname === '/api/realtime/oauth-status') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        available: false,
        error: 'ChatGPT OAuth is only available on localhost',
        code: 'CODEX_OAUTH_UNAVAILABLE',
        reauthRequired: false,
      }),
    );
    return;
  }
  if (req.method === 'POST' && pathname === '/api/realtime/oauth-login') {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        available: false,
        error: 'ChatGPT OAuth is only available on localhost',
      }),
    );
    return;
  }
  if (req.method === 'GET' && pathname === '/api/radio/stations') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    const merged = mergeRadioStationsPayload(parsed);
    const encoded = encodeJson(req, merged);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/firms/status') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status >= 200 && answer.status < 300) {
      try {
        const parsed = JSON.parse(answer.body.toString('utf8'));
        if (parsed?.hasKey) {
          sendCaptured(answer);
          return;
        }
      } catch {
        /* fall through to keyless status */
      }
    }
    const fallbackStatus = buildKeylessFirmsStatusPayload();
    const encoded = encodeJson(req, fallbackStatus);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/firms') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status >= 200 && answer.status < 300) {
      sendCaptured(answer);
      return;
    }
    const fallbackFirms = buildKeylessFirmsPayload();
    const encoded = encodeJson(req, fallbackFirms);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname.startsWith('/api/celestrak/')) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status >= 200 && answer.status < 300 && answer.body?.length > 30) {
      sendCaptured(answer);
      return;
    }
    const group = pathname.slice('/api/celestrak/'.length);
    const tle = Buffer.from(buildCelestrakFallbackTle(group), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'X-Feed-Source': 'celestrak-fallback',
      'Content-Length': String(tle.length),
    });
    res.end(tle);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/launches') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    const merged = mergeLaunchesPayload(parsed);
    const encoded = encodeJson(req, merged);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=600',
      'X-GEV-Cache': parsed ? 'HIT' : 'BRIDGE-CURATED',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/cyclones') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    const fallback = buildCyclonesFallbackSnapshot();
    if (
      parsed &&
      !parsed.unavailable &&
      Array.isArray(parsed.storms) &&
      parsed.storms.length > 0
    ) {
      const seenIds = new Set(parsed.storms.map((s) => String(s?.id || s?.name || '').toLowerCase()));
      for (const s of fallback.storms || []) {
        const key = String(s?.id || s?.name || '').toLowerCase();
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          parsed.storms.push(s);
        }
      }
      const encoded = encodeJson(req, parsed);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    const encoded = encodeJson(req, fallback);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/fire-perimeters') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    const merged = mergeFirePerimeterPayload(parsed);
    const encoded = encodeJson(req, merged);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/fire-perimeters/inciweb/index') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    const merged = mergeInciwebIndexPayload(parsed);
    const encoded = encodeJson(req, merged);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (
    req.method === 'GET' &&
    pathname.startsWith('/api/fire-perimeters/inciweb/publication/')
  ) {
    const pubId = pathname.slice(
      '/api/fire-perimeters/inciweb/publication/'.length,
    );
    const fallbackPub = resolveInciwebPublicationFallback(pubId);
    if (fallbackPub) {
      const encoded = encodeJson(req, fallbackPub);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
  }
  if (pathname === '/api/overpass/status') {
    handleOverpassStatus(req, res);
    return;
  }
  if (pathname === '/api/overpass') {
    await handleOverpassQuery(req, res);
    return;
  }
  if (pathname === '/api/military-installations') {
    await handleMilitaryInstallations(req, res, originalUrl);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/tomtom/status') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    let parsed = null;
    try {
      parsed = JSON.parse(answer.body.toString('utf8'));
    } catch {
      parsed = null;
    }
    const configured = Boolean(String(process.env.TOMTOM_API_KEY || '').trim());
    const dailyCount = Number(parsed?.dailyCount) || 0;
    const budget = Number(parsed?.budget) || 2000;
    const overBudget = dailyCount >= budget;
    const inCooldown = Date.now() < (globalThis.__gevTomTomCooldownUntil || 0);
    const healthy = configured && !overBudget && !inCooldown;
    const encoded = encodeJson(req, {
      hasKey: healthy,
      configured,
      healthy,
      degradedReason: !configured
        ? 'unconfigured'
        : overBudget
          ? 'budget_exhausted'
          : inCooldown
            ? globalThis.__gevTomTomLastError || 'rate_limited'
            : null,
      dailyCount,
      budget,
      date: parsed?.date || new Date().toISOString().slice(0, 10),
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname.startsWith('/api/tomtom/flow/')) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 429 || answer.status === 502) {
      globalThis.__gevTomTomCooldownUntil = Date.now() + 5 * 60_000;
      globalThis.__gevTomTomLastError =
        answer.status === 429 ? 'budget_or_rate_limited' : 'upstream_unreachable';
    }
    sendCaptured(answer);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/geocode') {
    const search = new URL(req.url, 'http://localhost').searchParams;
    const q = String(search.get('q') || '').trim();
    const strategic = q ? matchStrategicFacility(q) : null;
    if (strategic?.results?.[0]) {
      const encoded = encodeJson(req, {
        status: 'OK',
        results: [strategic.results[0]],
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    if (q) {
      const fallbackCapture = createBodyCapturingResponse();
      const handled = await handlePlacesRequest(
        req,
        fallbackCapture,
        '/api/google/geocode',
        `/api/google/geocode?address=${encodeURIComponent(q)}`,
      );
      if (handled) {
        const fb = fallbackCapture.captured();
        if (fb.status >= 200 && fb.status < 300) {
          try {
            const parsedFb = JSON.parse(fb.body.toString('utf8'));
            if (Array.isArray(parsedFb?.results) && parsedFb.results.length > 0) {
              sendCaptured(fb);
              return;
            }
          } catch {
            /* fall through to upstream */
          }
        }
      }
      const capture = createBodyCapturingResponse();
      await dispatch(capture, reportError);
      req.url = originalUrl;
      sendCaptured(capture.captured());
      return;
    }
  }
  if (req.method === 'GET' && pathname === '/api/openai/hud-summary/status') {
    const encoded = encodeJson(req, { configured: false });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/openai/hud-summary') {
    if (!unlocked) {
      sendUnknownRoute(res);
      return;
    }
    if (
      !String(process.env.OPENAI_API_KEY || '').trim() &&
      hasGeminiApiKeyPool()
    ) {
      const context = (await readJsonObject(req)) || {};
      const result = await summarizeHudContext(context);
      const encoded = encodeJson(req, {
        summary: result.summary || null,
        error: null,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
  }
  if (
    req.method === 'GET' &&
    (pathname === '/api/regional-brief' ||
      pathname === '/api/regional/briefing' ||
      pathname === '/api/regional' ||
      pathname === '/api/regional/place' ||
      pathname === '/api/regional/weather' ||
      pathname === '/api/regional/news' ||
      pathname === '/api/weather-effects')
  ) {
    const search = new URL(req.url || '', 'http://localhost').searchParams;
    const point = parseRegionalQueryPoint(search);
    if (!point) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Valid latitude and longitude are required',
        }),
      );
      return;
    }
    if (pathname === '/api/regional/place') {
      const place = await resolveRegionalPlaceWithFallback(point);
      const encoded = encodeJson(req, {
        status: 'ready',
        retrievedAt: new Date().toISOString(),
        coordinates: point,
        place,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    if (
      pathname === '/api/regional/weather' ||
      pathname === '/api/weather-effects'
    ) {
      const weather = await resolveRegionalWeatherWithFallback(point);
      const encoded = encodeJson(req, {
        status: 'ready',
        retrievedAt: new Date().toISOString(),
        coordinates: point,
        weather,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    if (pathname === '/api/regional/news') {
      const place = await resolveRegionalPlaceWithFallback(point);
      const news = await resolveRegionalNewsWithFallback(place);
      const encoded = encodeJson(req, {
        status: news.status || 'ready',
        retrievedAt: new Date().toISOString(),
        coordinates: point,
        place,
        query: news.query,
        source: news.source,
        articles: news.articles,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    const brief = await buildResilientRegionalBrief(point);
    const encoded = encodeJson(req, brief);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'X-Regional-Brief': brief.status === 'cached' ? 'HIT' : 'BRIDGE',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/route') {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 400 || answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    if (answer.status >= 200 && answer.status < 300) {
      try {
        const parsed = JSON.parse(answer.body.toString('utf8'));
        if (parsed?.ok === true && Array.isArray(parsed.geometry)) {
          sendCaptured(answer);
          return;
        }
      } catch {
        /* fall through to resilient route */
      }
    }
    const search = new URL(req.url || '', 'http://localhost').searchParams;
    const fallbackRoute = await resolveResilientRoute(search);
    if (!fallbackRoute) {
      sendCaptured(answer);
      return;
    }
    const encoded = encodeJson(req, fallbackRoute);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120',
      'X-Route-Source': 'resilient-bridge',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/frontfires') {
    const firmsCapture = createBodyCapturingResponse();
    await dispatchUrl('/api/firms', firmsCapture);
    const firmsAnswer = firmsCapture.captured();
    /** @type {any[]|null} */
    let fires = null;
    if (firmsAnswer.status >= 200 && firmsAnswer.status < 300) {
      try {
        fires = JSON.parse(firmsAnswer.body.toString('utf8'))?.fires || null;
      } catch {
        fires = null;
      }
    }
    if (!Array.isArray(fires) || !fires.length) {
      fires = buildKeylessFirmsPayload().fires;
    }
    const snapshot = await frontlineSnapshot().catch(() => null);
    const body = snapshot
      ? frontFiresFrom(Array.isArray(fires) ? fires : [], snapshot)
      : null;
    if (!body) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          error: 'frontfires_unavailable',
          debug: {
            firmsStatus: firmsAnswer.status,
            fires: fires?.length ?? null,
            boundary: Boolean(snapshot),
          },
        }),
      );
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/frontline') {
    const body = await frontlineSnapshot().catch(() => null);
    if (!body) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'frontline_unavailable' }));
      return;
    }
    const encoded = encodeJson(req, body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=1800',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/military') {
    const capture = createBodyCapturingResponse();
    const extraPromise = extraMilitaryContacts();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    const extra = await extraPromise;

    /** @type {any} */
    let base = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        base = JSON.parse(answer.body.toString('utf8'));
      } catch {
        base = null;
      }
    }
    if ((!base || !Array.isArray(base.ac)) && extra?.ac?.length) {
      base = {
        ac: [],
        msg: 'No error',
        now: Date.now(),
        total: 0,
        ctime: Date.now(),
        ptime: 0,
      };
    }
    if (!base || !Array.isArray(base.ac) || !extra) {
      sendCaptured(answer);
      return;
    }
    const result = mergeMilitaryPayload(base, extra);
    if (!result.added) {
      sendCaptured(answer);
      return;
    }

    if (res.writableEnded || res.headersSent) return;
    const encoded = encodeJson(req, result.body);
    const headers = { ...answer.headers };
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    for (const name of Object.keys(headers)) {
      if (/^x-feed-source$/i.test(name)) delete headers[name];
    }
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'application/json',
      'X-Feed-Source': [
        'adsb.lol',
        ...extra.sources
          .filter((source) => source.count > 0)
          .map((source) => source.name),
      ].join('+'),
      'X-Military-Bridge': `+${result.added} (${extra.sources
        .map((source) => `${source.name}:${source.count}/${source.cache}`)
        .join(',')})`,
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  /**
   * Aircraft coverage beyond the fallback bubble.
   *
   * OpenSky refuses Vercel's shared egress, so every flight poll is answered by
   * upstream's own substitute: a 250 nm adsb.lol snapshot around the view anchor
   * (`ADSBLOL_POINT_RADIUS_NM` in `server/providers/aircraft/opensky.js`). Over
   * central Europe that is ~490 of the ~3 500 aircraft the same provider tracks.
   * This hook runs the widener in parallel with upstream and merges by ICAO24 —
   * upstream vectors win, this adds the rest — so the radius becomes a tunable
   * (`GEV_ADSB_RADIUS_NM`, default 750) without touching upstream code. When
   * OpenSky itself answers (many thousands of vectors) the widener stands aside
   * and upstream is replayed verbatim; any failure of the substitute does the
   * same. See `adsb-widener.js`.
   *
   * The global military feed (`/v2/mil`) is deliberately NOT merged in here. It
   * is worldwide, while this endpoint is a regional frame: the client's flights
   * layer suppresses every contact the military registry knows as soon as the
   * military layer is enabled (`snapshotRenderer.js` + `_militaryLayerSuppresses`),
   * so 154-233 worldwide military hexes made the civilian layer delete its own
   * regional fleet. Measured 2026-11-03 over the South Pacific: 154 states
   * served, 154 of them military, panel count collapsed to 1. `/api/military`
   * already serves that feed worldwide, so nothing is lost for the military
   * layer — and the civilian count goes back to meaning aircraft near the view.
   */
  if (req.method === 'GET' && pathname === '/api/flights') {
    const capture = createBodyCapturingResponse();
    let searchParams = null;
    try {
      searchParams = new URL(originalUrl, 'http://localhost').searchParams;
    } catch {
      /* upstream's own handler reports a malformed URL */
    }

    // Worldwide by default. A regional bubble around a street-level camera
    // answered ~800 aircraft and read as "FALLBACK · 1500 nm widened", which is
    // the condition a viewer notices; the worldwide frame is ~10 000 aircraft
    // for the same request. `GEV_FLIGHTS_MODE=regional` restores the old
    // altitude-gated behaviour for a client that wants the small frame.
    const altRaw = searchParams?.get('alt');
    const altitude = Number(altRaw);
    const hasAltitude =
      altRaw !== null && altRaw !== '' && Number.isFinite(altitude);
    const globalAltitudeM =
      Number(process.env.GEV_FLIGHTS_GLOBAL_ALT) || 2_000_000;
    const regionalOnly = process.env.GEV_FLIGHTS_MODE === 'regional';
    const globalMode =
      !regionalOnly || !hasAltitude || altitude >= globalAltitudeM;

    const upstream = dispatch(capture, reportError);
    // Started at the same time as upstream: this costs one HTTP round-trip and
    // upstream usually spends two (OpenSky probe, then its own fallback).
    const widePromise = searchParams
      ? globalMode
        ? globalFlightsSnapshot()
        : wideFlightsSnapshot(searchParams)
      : Promise.resolve(null);
    const relayPromise =
      unlocked && process.env.FLIGHTS_RELAY_URL
        ? relayJson(process.env.FLIGHTS_RELAY_URL).catch(() => null)
        : Promise.resolve(null);
    await upstream;
    req.url = originalUrl;
    const answer = capture.captured();
    const servedOk = answer.status >= 200 && answer.status < 300;

    /** @type {any} */
    let base = null;
    if (servedOk) {
      try {
        base = JSON.parse(answer.body.toString('utf8'));
      } catch {
        base = null;
      }
    }
    if (!base || !Array.isArray(base.states)) base = null;

    const upstreamSource = String(answer.headers?.['x-flight-source'] || '');
    const viaAdsbLol = upstreamSource.toLowerCase().includes('adsb.lol');
    // Widening an answer that already carries a worldwide frame would only burn
    // provider quota, so it happens for the regional bubble and for misses.
    const sparse = !base || base.states.length < 1000;
    const shouldWiden = globalMode || !base || viaAdsbLol || sparse;
    const [wide, relay] = await Promise.all([
      shouldWiden ? widePromise : Promise.resolve(null),
      relayPromise,
    ]);
    // OpenSky via the VPS relay is always merged with the global ADS-B snapshot
    // so both networks contribute their unique transponders (~20,000+ aircraft).
    let relayUsed = false;
    let relayWide = null;
    if (Array.isArray(relay?.states) && relay.states.length) {
      let states = relay.states;
      if (!globalMode) {
        const lat = Number(searchParams?.get('lat'));
        const lon = Number(searchParams?.get('lon'));
        const radiusDeg = (widenRadiusNm() * 1.852) / 111;
        if (Number.isFinite(lat) && Number.isFinite(lon))
          states = states.filter((row) => {
            const dLat = Number(row[6]) - lat;
            let dLon = Number(row[5]) - lon;
            if (dLon > 180) dLon -= 360;
            if (dLon < -180) dLon += 360;
            return (
              Math.hypot(dLat, dLon * Math.cos((lat * Math.PI) / 180)) <=
              radiusDeg
            );
          });
      }
      relayWide = {
        body: { ...relay, states },
        count: states.length,
        cache: 'relay',
      };
      relayUsed = true;
    }

    if (!base && !wide?.body && !relayWide?.body) {
      sendCaptured(answer);
      return;
    }

    let merged = base;
    let added = 0;
    const heliPayload = { states: buildCivilianHelicopterStates() };
    for (const source of [relayWide?.body, wide?.body, heliPayload]) {
      if (!source) continue;
      const result = mergeOpenSkyPayloads(merged || { states: [] }, source);
      merged = result.body;
      added += result.added;
    }
    if (!merged || !Array.isArray(merged.states)) {
      sendCaptured(answer);
      return;
    }

    if (res.writableEnded || res.headersSent) return;
    const encoded = encodeJson(req, merged);
    // Honest labelling. The widened radius is only advertised when the widened
    // frame actually contributed aircraft, and a base that already came from
    // adsb.lol is not labelled as a second adsb.lol source — the panel prints
    // this header, and "adsb.lol+adsb.lol" reads like two providers.
    const widened = added > 0;
    const labels = [];
    if (upstreamSource) labels.push(upstreamSource);
    if (widened && !viaAdsbLol && !relayUsed) labels.push('adsb.lol');
    if (relayUsed) labels.push('OpenSky');
    const headers = { ...answer.headers };
    delete headers['content-length'];
    delete headers['transfer-encoding'];
    // Captured headers arrive lower-cased; `writeHead` would emit a second
    // header field for every name whose case differs, and the client would then
    // see both the upstream count and the merged one.
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase().startsWith('x-flight-')) delete headers[name];
    }
    const coverage = widened
      ? globalMode
        ? 'global snapshot'
        : `${widenRadiusNm()}nm widened`
      : String(answer.headers?.['x-flight-coverage'] || '');
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'application/json',
      'X-Flight-Source': labels.join('+') || 'adsb.lol',
      ...(coverage ? { 'X-Flight-Coverage': coverage } : {}),
      'X-Flight-Count': String(merged.states.length),
      'X-Flight-Bridge': `+${added} (${
        globalMode ? 'global' : 'wide'
      }:${wide ? `${wide.count}/${wide.cache}` : shouldWiden ? 'failed' : 'skipped'})`,
      ...encoded.headers,
    });
    res.end(encoded.payload);
    console.log(
      `[gev-bridge] /api/flights anchor=${
        searchParams
          ? `${searchParams.get('lat')},${searchParams.get('lon')}`
          : 'none'
      } upstream=${base ? base.states.length : 'none'} wide=${
        wide ? `${wide.count}/${wide.cache}` : 'none'
      } added=${added} served=${merged.states.length}`,
    );
    return;
  }

  /**
   * Resilient aircraft metadata & historical flight tracks.
   *
   * Upstream OpenSky `/api/tracks/all` blocks Vercel egress (causing 502 on
   * `/api/flights/track`) and upstream `/api/military/track` returns 503.
   * Upstream adsbdb also lacks Swiss REGA, police helicopters, and military
   * callsign/hex metadata. We run upstream first and enrich any miss or error.
   */
  if (
    req.method === 'GET' &&
    (pathname.startsWith('/api/adsbdb') ||
      pathname.startsWith('/api/aircraft-meta/'))
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 400 || answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    if (parsed?.found === true) {
      sendCaptured(answer);
      return;
    }

    const search = new URL(originalUrl, 'http://localhost').searchParams;
    let fallback = null;
    if (pathname.startsWith('/api/adsbdb/route/')) {
      const cs = decodeURIComponent(pathname.slice('/api/adsbdb/route/'.length));
      fallback = await resolveAircraftRouteFallback(cs).catch(() => null);
    } else if (pathname.startsWith('/api/adsbdb/type/')) {
      const hex = decodeURIComponent(pathname.slice('/api/adsbdb/type/'.length));
      fallback = await resolveAircraftTypeFallback(hex).catch(() => null);
    } else if (pathname.startsWith('/api/aircraft-meta/')) {
      const hex = decodeURIComponent(pathname.slice('/api/aircraft-meta/'.length));
      fallback = await resolveAircraftTypeFallback(hex).catch(() => null);
    } else if (pathname === '/api/adsbdb') {
      const cs = search.get('callsign');
      const hex = search.get('icao24') || search.get('hex');
      if (cs) fallback = await resolveAircraftRouteFallback(cs).catch(() => null);
      else if (hex) fallback = await resolveAircraftTypeFallback(hex).catch(() => null);
    }

    if (fallback && fallback.found) {
      const encoded = encodeJson(req, fallback);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-Aircraft-Intel': 'bridge-enrichment',
        ...encoded.headers,
      });
      res.end(encoded.payload);
      return;
    }
    sendCaptured(answer);
    return;
  }

  if (
    req.method === 'GET' &&
    (pathname === '/api/flights/track' || pathname === '/api/opensky/tracks')
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    if (parsed && Array.isArray(parsed.path) && parsed.path.length >= 2) {
      sendCaptured(answer);
      return;
    }
    const search = new URL(originalUrl, 'http://localhost').searchParams;
    const icao24 = String(search.get('icao24') || search.get('hex') || '').trim();
    const fallbackTrack = await resolveCivilTrackFallback(icao24).catch(
      () => null,
    );
    if (!fallbackTrack) {
      sendCaptured(answer);
      return;
    }
    const encoded = encodeJson(req, fallbackTrack);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15',
      'X-Flight-Track': 'bridge-synthesized',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (
    req.method === 'GET' &&
    (pathname === '/api/military/track' || pathname === '/api/adsb-lol/trace')
  ) {
    const capture = createBodyCapturingResponse();
    await dispatch(capture, reportError);
    req.url = originalUrl;
    const answer = capture.captured();
    if (answer.status === 405) {
      sendCaptured(answer);
      return;
    }
    let parsed = null;
    if (answer.status >= 200 && answer.status < 300) {
      try {
        parsed = JSON.parse(answer.body.toString('utf8'));
      } catch {
        parsed = null;
      }
    }
    if (
      parsed &&
      ((Array.isArray(parsed.path) && parsed.path.length >= 2) ||
        (Array.isArray(parsed.trace) && parsed.trace.length >= 2))
    ) {
      sendCaptured(answer);
      return;
    }
    const search = new URL(originalUrl, 'http://localhost').searchParams;
    const hex = String(search.get('hex') || search.get('icao24') || '').trim();
    const fallbackTrack = await resolveMilitaryTrackFallback(hex).catch(
      () => null,
    );
    if (!fallbackTrack) {
      sendCaptured(answer);
      return;
    }
    const encoded = encodeJson(req, fallbackTrack);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15',
      'X-Military-Track': 'bridge-synthesized',
      ...encoded.headers,
    });
    res.end(encoded.payload);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/gnss-integrity') {
    const search = new URL(originalUrl, 'http://localhost').searchParams;
    if (
      !search.has('lat') &&
      !search.has('lon') &&
      !search.has('lamin') &&
      !search.has('lamax')
    ) {
      req.url = '/api/gnss-integrity?lat=47&lon=10';
    }
  }

  await dispatch(res, reportError);
}

export { PROXY_SIGNALS };
