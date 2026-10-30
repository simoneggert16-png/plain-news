// Supabase mirror of the PLAIN. content store.
//
// Why: every article lives in the git repo AND in the Vercel deployment. At
// ~25 KB per article that made each deployment grow by ~2.8 MB per day, which
// is what filled Vercel's 10 GB Hobby deployment storage. The site now reads
// content from Supabase (free tier) and only falls back to the bundled files
// when Supabase is unreachable. Git stays the source of truth + history, Vercel
// only ships code.
//
// Reads use the public anon key (the content is public anyway, RLS grants
// SELECT only); writes use the service-role key and are done by
// scripts/sync-content.mjs.
import path from 'node:path';
import { listingKey } from './listing.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const READ_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const REMOTE_URL = SUPABASE_URL;
export const remoteReadEnabled = Boolean(SUPABASE_URL && READ_KEY);
export const remoteWriteEnabled = Boolean(SUPABASE_URL && WRITE_KEY);

const PAGE_SIZE = 1000;
const TIMEOUT_MS = Number(process.env.CONTENT_FETCH_TIMEOUT_MS || 15000);

function headers(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

export async function rest(pathname, { key = READ_KEY, method = 'GET', body, prefer, timeoutMs } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: { ...headers(key), ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs || TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${pathname} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Index entries ({ slug, publishedAt, locales, ... }) for the whole archive. */
export async function readRemoteIndex() {
  const rows = await rest('content_blobs?key=eq.index&select=data');
  const articles = rows?.[0]?.data?.articles;
  return Array.isArray(articles) && articles.length ? articles : null;
}

/**
 * List index for one language: title, dek, picture, dates - the fields a card
 * shows. A tenth of the full index, so a list page does not wait on 5.6 MB.
 */
export async function readRemoteListing(locale) {
  const rows = await rest(`content_blobs?key=like.${listingKey(locale)}*&select=key,data`);
  const articles = [];
  for (const row of rows || []) {
    const list = row?.data?.articles;
    if (Array.isArray(list)) articles.push(...list);
  }
  if (!articles.length) return null;
  // The head is also part of the archive rows, so a story can be there twice.
  const bySlug = new Map();
  for (const article of articles) {
    if (article?.slug) bySlug.set(article.slug, article);
  }
  return [...bySlug.values()].sort(
    (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
  );
}

export async function readRemoteArticle(slug) {
  const rows = await rest(`articles?slug=eq.${encodeURIComponent(slug)}&select=data`);
  return rows?.[0]?.data || null;
}

/** Full article JSON for the whole archive (used by /search full-text). */
export async function readRemoteArticles() {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = await rest(`articles?select=data&order=published_at.desc&limit=${PAGE_SIZE}&offset=${offset}`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) if (row?.data) all.push(row.data);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * Full-text search across every locale, executed in Postgres.
 * The trigram index keeps this in the tens of milliseconds; downloading the
 * whole archive to scan it in JS took seconds per query.
 */
export async function searchRemoteArticles(query, limit = 60) {
  const text = String(query || '').trim();
  if (text.length < 2) return [];
  const rows = await rest('rpc/search_articles', {
    method: 'POST',
    body: { q: text, lim: Math.min(Math.max(limit, 1), 100) },
    // A search that takes a minute is no search. The fallback in
    // lib/content.mjs scans the archive on disk instead.
    timeoutMs: Math.min(TIMEOUT_MS, 2500),
  });
  return Array.isArray(rows) ? rows.map((row) => row?.slug).filter(Boolean) : [];
}

export async function writeRemoteIndex(index) {
  await rest('content_blobs?on_conflict=key', {
    key: WRITE_KEY,
    method: 'POST',
    body: [{ key: 'index', data: index, updated_at: new Date().toISOString() }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

export async function writeRemoteArticles(articles, { batchSize = 25 } = {}) {
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize).map((article) => ({
      slug: article.slug,
      published_at: article.publishedAt || null,
      updated_at: new Date().toISOString(),
      data: article,
    }));
    await rest('articles?on_conflict=slug', {
      key: WRITE_KEY,
      method: 'POST',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
  return articles.length;
}

export async function remoteArticleCount() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=slug`, {
    method: 'HEAD',
    headers: { ...headers(READ_KEY), Prefer: 'count=exact' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Supabase count failed: ${res.status}`);
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/').pop() || 0);
}

export const CONTENT_DIR = path.join(process.cwd(), 'content');
