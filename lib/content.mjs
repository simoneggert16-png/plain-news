import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_LOCALE } from './config.mjs';
import { toListing } from './listing.mjs';
import { sharedFetch, withDeadline } from './cache.mjs';
import {
  CONTENT_DIR as REMOTE_CONTENT_DIR,
  readRemoteIndex,
  readRemoteListing,
  readRemoteArticle,
  readRemoteArticles,
  searchRemoteArticles,
  remoteReadEnabled,
} from './contentRemote.mjs';

const CONTENT_DIR = REMOTE_CONTENT_DIR;
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json');

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const CACHE_TTL_MS = IS_BUILD ? Infinity : Number(process.env.CONTENT_CACHE_MS || 30000);
// How long Vercel's data cache may serve a fetched index. A new lambda would
// otherwise download the archive again on every cold start.
const SHARED_TTL_S = Math.max(30, Number(process.env.CONTENT_SHARED_TTL_S || 900));

// 'supabase' keeps the deployment small; 'files' is the offline/local default.
const MODE = (process.env.CONTENT_SOURCE || '').toLowerCase() === 'files'
  ? 'files'
  : (remoteReadEnabled ? 'supabase' : 'files');

export const contentSource = MODE;

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const byPublishedDesc = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);

// Feeds hand us HTML-escaped URLs ("…?v=1&amp;w=1920"). Left as they are, the
// browser asks the CDN for a parameter called "amp;w" and many image hosts
// answer 403/404 - i.e. the picture silently disappears.
function decodeUrl(url) {
  if (typeof url !== 'string' || !url.includes('&')) return url;
  return url
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&quot;/gi, '"');
}

function cleanMedia(article) {
  if (!article) return article;
  const out = { ...article };
  if (out.image) out.image = decodeUrl(out.image);
  if (out.video?.url) out.video = { ...out.video, url: decodeUrl(out.video.url) };
  if (out.locales) {
    out.locales = Object.fromEntries(
      Object.entries(out.locales).map(([key, loc]) => [
        key,
        loc?.image ? { ...loc, image: decodeUrl(loc.image) } : loc,
      ])
    );
  }
  return out;
}

let indexCache = { value: null, at: 0 };
let localIndexCache = { value: null, at: 0 };
let allArticlesCache = { value: null, at: 0 };
const listingCache = new Map();
const articleCache = new Map();

const fresh = (entry) => {
  if (!entry || entry.value === null) return false;
  return CACHE_TTL_MS === Infinity || Date.now() - entry.at < CACHE_TTL_MS;
};

function readLocalIndex() {
  if (fresh(localIndexCache)) return localIndexCache.value;
  const idx = readJSON(INDEX_FILE, { articles: [] });
  const articles = Array.isArray(idx.articles) ? idx.articles : [];
  localIndexCache = { value: articles, at: Date.now() };
  return articles;
}

function warnRemote(err) {
  // Never crash a page because the mirror is briefly unreachable – the bundled
  // snapshot (when present) is a valid fallback.
  console.warn(`[content] Supabase read failed, falling back to local files: ${err.message}`);
}

// Circuit breaker: if the mirror (or its tables) is missing, stop paying a
// network round-trip on every render for a minute.
let remoteDownUntil = 0;
const remoteUsable = () => MODE === 'supabase' && Date.now() >= remoteDownUntil;
function markRemoteDown(err) {
  remoteDownUntil = Date.now() + 60_000;
  warnRemote(err);
}

// Vercel's data cache keeps a fetched index alive across cold starts, so a
// new lambda does not pull the archive again. Outside a Next runtime (the
// bots, scripts) it simply runs the function.
async function shared(key, fn) {
  if (IS_BUILD) return fn();
  return sharedFetch(key, fn, { revalidate: SHARED_TTL_S });
}
/**
 * The list index for one language: what a card needs and nothing else.
 * This is what the home page, the category pages and the long reads load.
 */
export async function getListing(locale) {
  const code = String(locale || SOURCE_LOCALE);
  const hit = listingCache.get(code);
  if (fresh(hit)) return hit.value;

  let articles = null;
  if (remoteUsable()) {
    try {
      articles = await withDeadline(
        shared(`listing-${code}`, async () => {
          const rows = await readRemoteListing(code);
          if (!rows) throw new Error(`no list index for ${code}`);
          return rows;
        }),
        1200,
        `listing ${code}`
      );
    } catch (err) {
      markRemoteDown(err);
    }
  }
  if (!articles) {
    // The snapshot bundled with the deployment is the fast fallback. Fetching
    // the whole remote index here was the second half of a one-minute home
    // page: a slow mirror must cost seconds, not a chain of timeouts.
    const local = readLocalIndex();
    if (local.length) {
      articles = local.map((a) => toListing(a, code));
    } else {
      const full = await getFullIndex().catch((e) => {
        markRemoteDown(e);
        return null;
      });
      if (full) articles = full.map((a) => toListing(a, code));
    }
  }
  if (!articles) articles = [];

  const sorted = [...articles].map(cleanMedia).sort(byPublishedDesc);
  listingCache.set(code, { value: sorted, at: Date.now() });
  return sorted;
}

/** The complete index, with every language and every field. */
async function getFullIndex() {
  if (fresh(indexCache)) return indexCache.value;

  // The snapshot that ships with the deployment is the fast path. The full
  // index is eight megabytes: no page waits for that from the database, and
  // the mirror no longer writes it. The database only answers when the
  // deployment has no snapshot at all.
  let articles = readLocalIndex();

  if (!articles.length && remoteUsable()) {
    try {
      articles = await withDeadline(
        shared('index', async () => {
          const rows = await readRemoteIndex();
          if (!rows) throw new Error('no index');
          return rows;
        }),
        8000,
        'index'
      );
    } catch (err) {
      markRemoteDown(err);
      articles = [];
    }
  }
  if (!articles.length) console.error('[content] no snapshot and no index in the mirror.');

  const sorted = [...articles].map(cleanMedia).sort(byPublishedDesc);
  indexCache = { value: sorted, at: Date.now() };
  return sorted;
}

/**
 * List of published stories, newest first.
 * With a language it returns the slim list index (fast); without one it
 * returns the complete index.
 */
export async function getIndex(locale) {
  if (locale) return getListing(locale);
  return getFullIndex();
}

export async function getArticle(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  const cached = articleCache.get(slug);
  if (cached && (CACHE_TTL_MS === Infinity || Date.now() - cached.at < CACHE_TTL_MS)) return cached.value;

  let article = null;
  if (remoteUsable()) {
    try {
      // One database round trip per article is one too many when the mirror is
      // busy: the data cache keeps the story warm for the next readers.
      article = await withDeadline(
        shared(`article-${slug}`, () => readRemoteArticle(slug)),
        2000,
        `article ${slug}`
      );
    } catch (err) {
      markRemoteDown(err);
    }
  }
  if (!article) article = readJSON(path.join(ARTICLES_DIR, `${slug}.json`), null);

  article = cleanMedia(article);

  if (articleCache.size > 2000) articleCache.clear();
  articleCache.set(slug, { value: article, at: Date.now() });
  return article;
}

/** Every full article from the snapshot bundled with the deployment. */
export async function getAllArticles() {
  if (fresh(allArticlesCache)) return allArticlesCache.value;

  // The archive on disk costs no network. Downloading every article from
  // Supabase meant 26 MB and a minute of waiting for one search.
  const local = readLocalIndex();
  const onDisk = local
    .map((a) => readJSON(path.join(ARTICLES_DIR, `${a.slug}.json`), null))
    .filter(Boolean);
  allArticlesCache = { value: onDisk.map(cleanMedia), at: Date.now() };
  return allArticlesCache.value;
}

/** Does the deployment carry the article files at all? */
function localArchiveHasFiles() {
  try {
    return fs.readdirSync(ARTICLES_DIR).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * Slugs of articles whose text contains the query, newest first.
 *
 * In production this is a single Postgres call (trigram index). The local scan
 * below is the offline fallback; it needs every article, so it must never run
 * on the hot path when the mirror is reachable.
 */
export async function searchArticles(query, { limit = 60 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  if (remoteUsable()) {
    try {
      const hits = await searchRemoteArticles(q, limit);
      // No hit is an answer, not a missing index. Falling back to the archive
      // here is what made a search without results take a minute.
      return hits;
    } catch (err) {
      // The index search is a bonus, not a requirement: a slow or missing
      // function must not hold the page for a minute.
      warnRemote(err);
    }
  }

  const needle = q.toLowerCase();
  // The articles themselves carry the text to look through, so the search
  // never has to wait for an index it does not need. Reading a thousand
  // files off disk is still a fallback: it gets a deadline like the database.
  const hits = [];
  const local = await withDeadline(getAllArticles(), 3000, 'local archive').catch(() => []);
  for (const article of local) {
    const locales = article.locales || {};
    const matches = Object.values(locales).some((loc) => {
      const text = [
        loc.title,
        loc.dek,
        loc.standfirst,
        ...(loc.facts || []),
        ...(loc.body || []),
        ...(loc.sections || []).flatMap((s) => [s.heading, ...(s.paragraphs || [])]),
        loc.context,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(needle);
    });
    if (!matches) continue;
    hits.push(article.slug);
    if (hits.length >= limit) break;
  }
  if (local.length) return hits;

  // Neither the index nor the bundled snapshot could answer. Asking the
  // database for the whole archive is the last resort and must stay short:
  // a page that waits a minute for a search is worse than no search at all.
  // It is also pointless when the snapshot ran out of time - the same
  // articles are in the database, and a dead database would only add
  // another timeout to the page.
  if (localArchiveHasFiles() && !remoteUsable()) return hits;
  try {
    const remote = await withDeadline(readRemoteArticles(), 4000, 'archive search');
    for (const article of remote) {
      const locales = article.locales || {};
      const matches = Object.values(locales).some((loc) =>
        [loc.title, loc.dek, loc.standfirst, ...(loc.facts || []), ...(loc.body || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
      if (!matches) continue;
      hits.push(article.slug);
      if (hits.length >= limit) break;
    }
  } catch (err) {
    warnRemote(err);
  }
  return hits;
}

/** Pick localized fields with fallback to the source language. */
export function localize(entry, locale) {
  const l = entry.locales?.[locale] || entry.locales?.[SOURCE_LOCALE] || {};
  return { ...l, isFallback: !entry.locales?.[locale] };
}

export async function listFor({ category, limit, locale } = {}) {
  let list = await getIndex(locale);
  if (category) list = list.filter((a) => a.category === category);
  return limit ? list.slice(0, limit) : list;
}

/** Index entries for a few known slugs (search results, related links).
 *  Reads the snapshot bundled with the deployment: pulling the whole 5 MB
 *  index from Supabase made every search wait on the transfer, although the
 *  page only shows a handful of cards. Falls back to the remote index when
 *  the snapshot is missing, truncated or too old to contain the hits. */
export async function entriesForSlugs(slugs, locale) {
  const wanted = [...new Set((slugs || []).filter(Boolean))];
  if (!wanted.length) return [];
  const local = readLocalIndex();
  if (local.length >= 50) {
    const snapshot = new Map(local.map((a) => [a.slug, a]));
    const missing = wanted.filter((slug) => !snapshot.has(slug)).length;
    if (missing <= Math.ceil(wanted.length * 0.2)) {
      return wanted.map((slug) => snapshot.get(slug)).filter(Boolean).map(cleanMedia);
    }
  }
  const live = new Map((await getIndex(locale)).map((a) => [a.slug, a]));
  return wanted.map((slug) => live.get(slug)).filter(Boolean);
}

export function readingMinutes(article, locale) {
  const l = localize(article, locale);
  const text = [l.dek, ...(l.facts || []), ...(l.body || []), l.context].join(' ');
  // CJK has no spaces – approximate by characters.
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
  const units = cjk ? text.length / 400 : text.split(/\s+/).length / 220;
  return Math.max(1, Math.round(units));
}
