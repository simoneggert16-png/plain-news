// Live ticker store.
//
// Runtime source of truth is Supabase (so ticker updates are visible within
// seconds, without a Vercel redeploy). content/live/*.json is the committed
// archive and the fallback for local dev or when Supabase is not configured.
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_LOCALE } from './config.mjs';
import { liveSummary } from './live.mjs';
import { sharedFetch, withDeadline } from './cache.mjs';

const LIVE_DIR = path.join(process.cwd(), 'content', 'live');
const LIVE_INDEX = path.join(LIVE_DIR, 'index.json');

const TABLE = 'live_tickers';
const CACHE_TTL_MS = 5000;
const cache = new Map();

const supabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = () =>
  process.env.SUPABASE_READ_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function rest(query, init = {}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return { ok: false, configured: false };
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, configured: true, error: `${res.status} ${body.slice(0, 200)}` };
    }
    if (res.status === 204) return { ok: true, configured: true, data: null };
    return { ok: true, configured: true, data: await res.json() };
  } catch (err) {
    return { ok: false, configured: true, error: err.message };
  }
}

const cached = (key, ttl, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  return value;
};

/** The committed ticker index (sync, build-time only). */
export function getLiveIndex() {
  const idx = readJSON(LIVE_INDEX, { tickers: [] });
  const tickers = (idx.tickers || []).filter((t) => t && t.slug);
  return tickers.sort(
    (a, b) => Date.parse(b.updatedAt || b.startedAt || 0) - Date.parse(a.updatedAt || a.startedAt || 0)
  );
}

/** Disk fallback: the committed archive. */
function diskList(status = 'live') {
  const idx = readJSON(LIVE_INDEX, { tickers: [] });
  const tickers = (idx.tickers || []).filter((t) => (status ? t.status === status : true));
  return tickers
    .sort((a, b) => Date.parse(b.updatedAt || b.startedAt || 0) - Date.parse(a.updatedAt || a.startedAt || 0))
    .map((t) => readJSON(path.join(LIVE_DIR, `${t.slug}.json`), null))
    .filter(Boolean);
}

/**
 * Active (or ended) tickers, newest activity first.
 * @returns {Promise<{tickers: object[], source: 'supabase'|'disk'}>}
 */
export async function listLiveTickers({ status = 'live', limit = 25 } = {}) {
  return cached(`list:${status}:${limit}`, CACHE_TTL_MS, async () => {
    if (supabaseUrl() && supabaseKey()) {
      // The homepage must not wait for this query: the data cache keeps the
      // ticker list warm for half a minute, so only one reader pays for it.
      const q = `${TABLE}?select=payload&status=eq.${encodeURIComponent(status)}&order=updated_at.desc&limit=${limit}`;
      // Three seconds, then the committed archive: a slow mirror must not hold
      // the home page hostage.
      const res = await withDeadline(
        sharedFetch(`live-list-${status}-${limit}`, () => rest(q), { revalidate: 30 }),
        3000,
        'live list'
      ).catch(() => null);
      if (res.ok && Array.isArray(res.data)) {
        const tickers = res.data.map((r) => r.payload).filter(Boolean);
        if (tickers.length) return { tickers, source: 'supabase' };
        // Empty table is a valid answer, but fall back to disk if the archive
        // still has live tickers (e.g. Supabase was just set up).
        const fromDisk = diskList(status);
        return { tickers: fromDisk.slice(0, limit), source: fromDisk.length ? 'disk' : 'supabase' };
      }
    }
    return { tickers: diskList(status).slice(0, limit), source: 'disk' };
  });
}

export async function getLiveTicker(slug) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  return cached(`one:${slug}`, CACHE_TTL_MS, async () => {
    if (supabaseUrl() && supabaseKey()) {
      const res = await withDeadline(
        rest(`${TABLE}?select=payload&slug=eq.${encodeURIComponent(slug)}&limit=1`),
        3000,
        'live ticker'
      ).catch(() => null);
      if (res?.ok && Array.isArray(res.data) && res.data[0]?.payload) return res.data[0].payload;
    }
    return readJSON(path.join(LIVE_DIR, `${slug}.json`), null);
  });
}

/** The live ticker attached to an article slug (if any). */
export async function getLiveForArticle(articleSlug) {
  if (!articleSlug || !/^[a-z0-9-]+$/.test(articleSlug)) return null;
  return cached(`article:${articleSlug}`, CACHE_TTL_MS, async () => {
    if (supabaseUrl() && supabaseKey()) {
      const res = await withDeadline(
        rest(
          `${TABLE}?select=payload&article_slug=eq.${encodeURIComponent(articleSlug)}&order=updated_at.desc&limit=1`
        ),
        3000,
        'live article ticker'
      ).catch(() => null);
      if (res?.ok && Array.isArray(res.data) && res.data[0]?.payload) return res.data[0].payload;
    }
    const idx = readJSON(LIVE_INDEX, { tickers: [] });
    const hit = (idx.tickers || []).find((t) => t.articleSlug === articleSlug);
    return hit ? readJSON(path.join(LIVE_DIR, `${hit.slug}.json`), null) : null;
  });
}

/** Localized summaries for the banner / overview / API. */
export async function listLiveSummaries({ status = 'live', locale = 'de', limit = 25 } = {}) {
  const { tickers, source } = await listLiveTickers({ status, limit });
  return { summaries: tickers.map((t) => liveSummary(t, locale)), source };
}

/* ─────────────────────────── writes (bot only) ─────────────────────────── */

function writeTickerFile(ticker) {
  fs.mkdirSync(LIVE_DIR, { recursive: true });
  fs.writeFileSync(path.join(LIVE_DIR, `${ticker.slug}.json`), JSON.stringify(ticker, null, 2) + '\n');
}

function writeIndexFile(tickers) {
  fs.mkdirSync(LIVE_DIR, { recursive: true });
  const entries = tickers.map((t) => ({
    ...liveSummary(t, SOURCE_LOCALE),
    locales: Object.fromEntries(
      Object.entries(t.locales || {}).map(([l, v]) => [l, { title: v.title, dek: v.dek }])
    ),
  }));
  entries.sort((a, b) => Date.parse(b.updatedAt || b.startedAt || 0) - Date.parse(a.updatedAt || a.startedAt || 0));
  fs.writeFileSync(LIVE_INDEX, JSON.stringify({ updatedAt: new Date().toISOString(), tickers: entries }, null, 2) + '\n');
}

/** Upsert one ticker to Supabase and to content/live/. Returns where it landed. */
export async function saveLiveTicker(ticker, { disk = true } = {}) {
  const row = {
    slug: ticker.slug,
    status: ticker.status || 'live',
    category: ticker.category || 'world',
    article_slug: ticker.articleSlug || null,
    started_at: ticker.startedAt || new Date().toISOString(),
    ended_at: ticker.endedAt || null,
    updated_at: ticker.updatedAt || new Date().toISOString(),
    payload: ticker,
  };
  const res = await rest(`${TABLE}?on_conflict=slug`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (disk) {
    writeTickerFile(ticker);
    const idx = readJSON(LIVE_INDEX, { tickers: [] });
    const slugs = new Set([ticker.slug]);
    const others = (idx.tickers || []).filter((t) => !slugs.has(t.slug));
    const changed = readJSON(path.join(LIVE_DIR, `${ticker.slug}.json`), ticker);
    writeIndexFile([...others.map((t) => readJSON(path.join(LIVE_DIR, `${t.slug}.json`), null)).filter(Boolean), changed]);
  }
  cache.clear();
  return { supabase: res.ok, error: res.error || null };
}

/** Rewrite the disk index (and optionally Supabase) after status changes. */
export async function saveLiveIndex(tickers) {
  writeIndexFile(tickers);
  return { ok: true };
}
