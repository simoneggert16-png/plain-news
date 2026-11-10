/**
 * Zero-trace session sync & private endpoint gate for PLAIN. MAVEN.
 *
 * Public visitors receive all open-license, $0-tier geospatial feeds without
 * any authentication prompt, lock header, or visible UI indicator.
 *
 * Personal / non-commercial / quota-sensitive providers (Cesium Ion Community
 * 3D Tiles, OpenSky personal relay, Reddit/UCDP conflict feeds, S2 GhostMaps,
 * Tavily + Gemini on-demand lookup/voice) are gated behind a signed HMAC token
 * (`_pm_s`). Any unauthenticated or invalid request to a gated route or to the
 * sync endpoint returns the exact same `404 {"error":"Unknown API route"}` as
 * any nonexistent `/api/*` path, leaving zero detectable trace for visitors.
 */

import crypto from 'node:crypto';

export const STEALTH_COOKIE = '_pm_s';
export const WALL_COOKIE = 'gev_wall';

function intFromEnv(key, fallback) {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function wallPin() {
  return String(
    process.env.GEV_WALL_PIN ||
      process.env.GEV_ACCESS_PIN ||
      process.env.WALL_PIN ||
      '',
  ).trim();
}

export function wallEnabled() {
  return wallPin().length > 0;
}

function hmacKey() {
  const secret = String(process.env.GEV_WALL_SECRET || '').trim();
  return crypto
    .createHmac(
      'sha256',
      secret || 'local-dev-fallback-secret-override-in-prod',
    )
    .update('pm-wall-v2:' + wallPin(), 'utf8')
    .digest();
}

function sign(expirySeconds) {
  return crypto
    .createHmac('sha256', hmacKey())
    .update(String(expirySeconds), 'utf8')
    .digest('hex');
}

export function createWallToken(nowSeconds = Math.floor(Date.now() / 1000)) {
  const ttl = intFromEnv('GEV_WALL_TTL_S', 60 * 60 * 24 * 30);
  const expiry = nowSeconds + ttl;
  return { value: `${expiry}.${sign(expiry)}`, maxAgeSeconds: ttl };
}

export function verifyWallToken(
  candidate,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const raw = String(candidate || '').trim();
  if (!wallEnabled() || !raw.includes('.')) return false;
  const [expiryRaw, signatureRaw] = raw.split('.');
  const expiry = Number(expiryRaw);
  const signature = String(signatureRaw || '');
  if (!Number.isFinite(expiry) || expiry <= nowSeconds) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = sign(expiry);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function cookieValue(req, name = STEALTH_COOKIE) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return undefined;
}

/**
 * Fail-closed check for private Tier-2 capabilities.
 * Returns `false` whenever `GEV_WALL_PIN` is unset or no valid token is carried.
 */
export function requestHasStealthAccess(req) {
  if (!wallEnabled()) return false;
  const headerToken = req.headers?.['x-pm-s'];
  if (headerToken && verifyWallToken(headerToken)) return true;
  const stealthCookie = cookieValue(req, STEALTH_COOKIE);
  if (stealthCookie && verifyWallToken(stealthCookie)) return true;
  const legacyCookie = cookieValue(req, WALL_COOKIE);
  if (legacyCookie && verifyWallToken(legacyCookie)) return true;
  try {
    const parsedUrl = new URL(
      req.originalUrl || req.url || '/',
      'http://localhost',
    );
    if (parsedUrl.pathname === '/api/ghostmaps/events') {
      const qToken = parsedUrl.searchParams.get('_s');
      if (qToken && verifyWallToken(qToken)) return true;
    }
  } catch {
    /* ignore malformed query */
  }
  return false;
}

/** Kept for legacy import compatibility; delegates to `requestHasStealthAccess`. */
export function requestIsUnlocked(req) {
  return requestHasStealthAccess(req);
}

/** Identical to `dispatcher.js` fallback 404 so gated routes are indistinguishable. */
export function sendUnknownRoute(res) {
  if (res.writableEnded || res.headersSent) return;
  const payload = Buffer.from(JSON.stringify({ error: 'Unknown API route' }));
  res.writeHead(404, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length),
  });
  res.end(payload);
}

/** Legacy compatibility stub — never reveals any wall status. */
export async function handleWallRequest(_req, res) {
  sendUnknownRoute(res);
}

// --- Brute-force brake (8 attempts / 15 min per IP + constant delay) --------
/** @type {Map<string, {count: number, lockedUntil: number, updatedAt: number}>} */
const attempts = new Map();

export function extractClientIp(req) {
  const realIp = String(req.headers?.['x-real-ip'] || '').trim();
  if (realIp) return realIp;
  const vercelFwd = String(req.headers?.['x-vercel-forwarded-for'] || '')
    .split(',')
    .pop()
    ?.trim();
  if (vercelFwd) return vercelFwd;
  if (req._clientIp) return String(req._clientIp);
  return req.socket?.remoteAddress || 'unknown';
}

function clientIp(req) {
  return extractClientIp(req);
}

export function attemptLockRemainingMs(req, now = Date.now()) {
  const record = attempts.get(clientIp(req));
  if (!record) return 0;
  return Math.max(0, record.lockedUntil - now);
}

export function registerFailedAttempt(req) {
  const now = Date.now();
  const ip = clientIp(req);
  const max = intFromEnv('GEV_WALL_MAX_ATTEMPTS', 8);
  const lockMs = intFromEnv('GEV_WALL_LOCK_MS', 15 * 60 * 1000);
  const existing = attempts.get(ip);
  const record =
    existing &&
    (existing.lockedUntil > now || now - existing.updatedAt <= 15 * 60 * 1000)
      ? existing
      : { count: 0, lockedUntil: 0, updatedAt: now };
  record.count += 1;
  record.updatedAt = now;
  if (record.count >= max) {
    record.lockedUntil = now + lockMs;
    record.count = 0;
  }
  attempts.delete(ip);
  attempts.set(ip, record);
  if (attempts.size > 500) {
    for (const [key, value] of attempts) {
      if (
        (value.lockedUntil > 0 && value.lockedUntil < now) ||
        now - value.updatedAt > 15 * 60 * 1000
      ) {
        attempts.delete(key);
      }
    }
    if (attempts.size > 500) {
      for (const key of attempts.keys()) {
        if (attempts.size <= 500) break;
        attempts.delete(key);
      }
    }
  }
  return new Promise((resolve) => setTimeout(resolve, 350));
}

export const recordAttempt = registerFailedAttempt;

function clearFailedAttempts(req) {
  attempts.delete(clientIp(req));
}

async function readSmallJson(req) {
  if (req?.body && typeof req.body === 'object') return req.body;
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 4096) return null;
      chunks.push(bytes);
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

function sendJson(res, status, object, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(object));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length),
    ...extraHeaders,
  });
  res.end(payload);
}

function resolvePrivateCesiumToken() {
  return String(
    process.env.MAVEN_PRIVATE_CESIUM_TOKEN || process.env.CESIUM_ION_TOKEN || '',
  ).trim();
}

/**
 * Stealth sync handler mounted at `/api/ui/sync`.
 *
 * - `GET` without valid token -> `404 {"error":"Unknown API route"}`
 * - `GET` with valid token -> `200 {"ok":1,"ion":"..."}`
 * - `POST {"clear":1}` -> clears cookie & returns `204`
 * - `POST {"c":"..."}` with wrong code or locked IP -> `404 {"error":"Unknown API route"}`
 * - `POST {"c":"..."}` with matching code -> sets partitioned cookie & returns `200 {"ok":1,"t":"...","ion":"..."}`
 */
export async function handleStealthSync(req, res) {
  if (req.method === 'GET') {
    if (!requestHasStealthAccess(req)) {
      sendUnknownRoute(res);
      return;
    }
    sendJson(res, 200, {
      ok: 1,
      ion: resolvePrivateCesiumToken(),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendUnknownRoute(res);
    return;
  }

  const body = await readSmallJson(req);
  if (body?.clear) {
    res.writeHead(204, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        `${STEALTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`,
        `${WALL_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`,
        `${WALL_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      ],
    });
    res.end();
    return;
  }

  if (!wallEnabled() || attemptLockRemainingMs(req) > 0) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    sendUnknownRoute(res);
    return;
  }

  const submitted = String(body?.c || '').trim();
  if (!submitted) {
    await registerFailedAttempt(req);
    sendUnknownRoute(res);
    return;
  }

  const digestSubmitted = crypto
    .createHash('sha256')
    .update(submitted, 'utf8')
    .digest();
  const digestExpected = crypto
    .createHash('sha256')
    .update(wallPin(), 'utf8')
    .digest();
  const matched =
    digestSubmitted.length === digestExpected.length &&
    crypto.timingSafeEqual(digestSubmitted, digestExpected);

  if (!matched) {
    await registerFailedAttempt(req);
    sendUnknownRoute(res);
    return;
  }

  clearFailedAttempts(req);
  const token = createWallToken();
  sendJson(
    res,
    200,
    {
      ok: 1,
      t: token.value,
      ion: resolvePrivateCesiumToken(),
    },
    {
      'Set-Cookie': `${STEALTH_COOKIE}=${token.value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${token.maxAgeSeconds}`,
    },
  );
}

export const handleSyncRequest = handleStealthSync;
