import { bordersSnapshot } from '../../vercel-bridge/borders.js';
import {
  businessSearch,
  personBusinessSearch,
} from '../../vercel-bridge/business.js';
import { frontFiresFrom } from '../../vercel-bridge/frontfires.js';
import { frontlineSnapshot } from '../../vercel-bridge/frontline.js';
import { osintReports, searchReports } from '../../vercel-bridge/osint.js';
import { parcelAt } from '../../vercel-bridge/parcels.js';
import { speakSummaryText } from '../../vercel-bridge/person-speech.js';
import { personSummary } from '../../vercel-bridge/person-summary.js';
import { personWebSearch } from '../../vercel-bridge/person-web.js';
import { handlePlacesRequest } from '../../vercel-bridge/places-adapter.js';
import {
  handleStealthSync,
  requestHasStealthAccess,
  sendUnknownRoute,
} from '../../vercel-bridge/wall.js';
import { admitSameSite } from '../providers/common/same-site.js';

function sendJson(res, status, body, cacheControl = 'no-store') {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': cacheControl,
    'Content-Length': String(payload.length),
  });
  res.end(payload);
}

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

function resolveRelayUrl() {
  if (process.env.REDDIT_RELAY_URL) return process.env.REDDIT_RELAY_URL;
  if (process.env.CAMERAS_RELAY_URL) {
    try {
      return new URL('/reddit', process.env.CAMERAS_RELAY_URL).href;
    } catch {
      return null;
    }
  }
  return null;
}

/** Finish unmatched API requests before Vite's HTML fallback. Install last. */
export function apiNotFoundPlugin() {
  const install = (server) => {
    server.middlewares.use('/api', async (req, res) => {
      const rawUrl = String(req.url || '/');
      const subUrl =
        rawUrl === '/api' || rawUrl.startsWith('/api/')
          ? rawUrl.slice(4) || '/'
          : rawUrl;
      req.originalUrl = req.originalUrl || `/api${subUrl}`;
      const parsed = new URL(subUrl, 'http://localhost');
      const pathname = parsed.pathname;
      const search = parsed.searchParams;

      if (admitSameSite(req, res)) return;

      if (pathname === '/ui/sync') {
        return handleStealthSync(req, res);
      }
      if (pathname === '/wall' || pathname.startsWith('/wall/')) {
        return sendUnknownRoute(res);
      }

      if (await handlePlacesRequest(req, res, `/api${pathname}`)) return;

      if (req.method === 'GET' && pathname === '/borders') {
        const body = await bordersSnapshot().catch(() => null);
        if (!body) return sendJson(res, 503, { error: 'borders_unavailable' });
        return sendJson(res, 200, body, 'public, max-age=43200');
      }

      if (!requestHasStealthAccess(req)) {
        return sendUnknownRoute(res);
      }

      if (req.method === 'GET' && pathname === '/person/reports') {
        const name = search.get('name') || '';
        const place = search.get('place') || '';
        const [body, businesses] = await Promise.all([
          searchReports(name, {
            url: resolveRelayUrl(),
            token: process.env.RELAY_TOKEN,
          }).catch(() => null),
          personBusinessSearch({ name, place }).catch(() => null),
        ]);
        return sendJson(res, 200, {
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
        });
      }

      if (req.method === 'GET' && pathname === '/person/web') {
        const body = await personWebSearch({
          name: search.get('name') || '',
          place: search.get('place') || '',
          age: search.get('age') || '',
          lang: search.get('lang') || '',
        }).catch(() => null);
        if (!body) return sendJson(res, 503, { error: 'search_unavailable' });
        return sendJson(res, 200, body);
      }

      if (req.method === 'GET' && pathname === '/person/summary') {
        const body = await personSummary({
          name: search.get('name') || '',
          place: search.get('place') || '',
          age: search.get('age') || '',
          lang: search.get('lang') || '',
          facility: search.get('facility') === '1',
        }).catch(() => null);
        return sendJson(
          res,
          200,
          body || { summary: '', unavailable: true, results: 0 },
        );
      }

      if (req.method === 'POST' && pathname === '/person/speak') {
        const requestBody = await readJsonObject(req);
        const audio = requestBody
          ? await speakSummaryText({
              text: requestBody.text,
              lang: requestBody.lang,
            }).catch(() => null)
          : null;
        if (!audio?.bytes?.length) {
          return sendJson(res, 503, { unavailable: true });
        }
        res.writeHead(200, {
          'Content-Type': audio.mimeType || 'audio/wav',
          'Cache-Control': 'no-store',
          'Content-Length': String(audio.bytes.length),
        });
        res.end(audio.bytes);
        return;
      }

      if (req.method === 'GET' && pathname === '/parcel') {
        const body = await parcelAt({
          lat: search.get('lat'),
          lon: search.get('lon'),
        }).catch(() => null);
        if (!body) return sendJson(res, 503, { error: 'parcel_unavailable' });
        return sendJson(res, 200, body);
      }

      if (req.method === 'GET' && pathname === '/business/search') {
        const body = await businessSearch({
          query: search.get('q') || '',
          place: search.get('place') || '',
        }).catch(() => null);
        if (!body) return sendJson(res, 503, { error: 'business_unavailable' });
        return sendJson(res, 200, body);
      }

      if (req.method === 'GET' && pathname === '/osint/reports') {
        const body = await osintReports({
          url: resolveRelayUrl(),
          token: process.env.RELAY_TOKEN,
          fresh: search.get('fresh') === '1',
        }).catch(() => null);
        if (!body) return sendJson(res, 503, { error: 'osint_unavailable' });
        return sendJson(res, 200, body, 'private, no-store');
      }

      if (req.method === 'GET' && pathname === '/frontline') {
        const body = await frontlineSnapshot().catch(() => null);
        if (!body) {
          return sendJson(res, 502, { error: 'frontline_unavailable' });
        }
        return sendJson(res, 200, body, 'private, no-store');
      }

      if (req.method === 'GET' && pathname === '/frontfires') {
        const port = req.socket?.localPort || 5173;
        const [firmsRes, snapshot] = await Promise.all([
          fetch(`http://127.0.0.1:${port}/api/firms`, {
            signal: AbortSignal.timeout(15_000),
          }).catch(() => null),
          frontlineSnapshot().catch(() => null),
        ]);
        const firmsJson = firmsRes?.ok
          ? await firmsRes.json().catch(() => null)
          : null;
        const fires = Array.isArray(firmsJson?.fires) ? firmsJson.fires : null;
        const body = fires && snapshot ? frontFiresFrom(fires, snapshot) : null;
        if (!body) {
          return sendJson(res, 503, { error: 'frontfires_unavailable' });
        }
        return sendJson(res, 200, body, 'private, no-store');
      }

      sendJson(res, 404, { error: 'Unknown API route' });
    });
  };
  return {
    name: 'api-not-found',
    configureServer: install,
    configurePreviewServer: install,
  };
}
