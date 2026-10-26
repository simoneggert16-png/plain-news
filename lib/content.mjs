import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_LOCALE } from './config.mjs';
import {
  CONTENT_DIR as REMOTE_CONTENT_DIR,
  readRemoteIndex,
  readRemoteArticle,
  readRemoteArticles,
  remoteReadEnabled,
} from './contentRemote.mjs';

const CONTENT_DIR = REMOTE_CONTENT_DIR;
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json');

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const CACHE_TTL_MS = IS_BUILD ? Infinity : Number(process.env.CONTENT_CACHE_MS || 30000);

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

let indexCache = { value: null, at: 0 };
let allArticlesCache = { value: null, at: 0 };
const articleCache = new Map();

const fresh = (entry) => CACHE_TTL_MS === Infinity ? entry.value !== null : entry.value !== null && Date.now() - entry.at < CACHE_TTL_MS;

function readLocalIndex() {
  const idx = readJSON(INDEX_FILE, { articles: [] });
  return Array.isArray(idx.articles) ? idx.articles : [];
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

/** Lightweight list of all published stories (newest first). */
export async function getIndex() {
  if (fresh(indexCache)) return indexCache.value;

  let articles = null;
  if (remoteUsable()) {
    try {
      articles = await readRemoteIndex();
    } catch (err) {
      markRemoteDown(err);
    }
    if (!articles) {
      const local = readLocalIndex();
      articles = local.length ? local : [];
      if (!local.length) console.error('[content] Supabase returned no index and no local snapshot exists.');
    }
  } else {
    articles = readLocalIndex();
  }

  const sorted = [...articles].sort(byPublishedDesc);
  indexCache = { value: sorted, at: Date.now() };
  return sorted;
}

export async function getArticle(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  const cached = articleCache.get(slug);
  if (cached && (CACHE_TTL_MS === Infinity || Date.now() - cached.at < CACHE_TTL_MS)) return cached.value;

  let article = null;
  if (remoteUsable()) {
    try {
      article = await readRemoteArticle(slug);
    } catch (err) {
      markRemoteDown(err);
    }
  }
  if (!article) article = readJSON(path.join(ARTICLES_DIR, `${slug}.json`), null);

  if (articleCache.size > 2000) articleCache.clear();
  articleCache.set(slug, { value: article, at: Date.now() });
  return article;
}

/** Every full article. Only used by search, which needs body text. */
export async function getAllArticles() {
  if (fresh(allArticlesCache)) return allArticlesCache.value;

  let articles = null;
  if (remoteUsable()) {
    try {
      articles = await readRemoteArticles();
    } catch (err) {
      markRemoteDown(err);
    }
  }
  if (!articles?.length) {
    articles = readLocalIndex()
      .map((a) => readJSON(path.join(ARTICLES_DIR, `${a.slug}.json`), null))
      .filter(Boolean);
  }
  allArticlesCache = { value: articles, at: Date.now() };
  return articles;
}

/** Pick localized fields with fallback to the source language. */
export function localize(entry, locale) {
  const l = entry.locales?.[locale] || entry.locales?.[SOURCE_LOCALE] || {};
  return { ...l, isFallback: !entry.locales?.[locale] };
}

export async function listFor({ category, limit } = {}) {
  let list = await getIndex();
  if (category) list = list.filter((a) => a.category === category);
  return limit ? list.slice(0, limit) : list;
}

export function readingMinutes(article, locale) {
  const l = localize(article, locale);
  const text = [l.dek, ...(l.facts || []), ...(l.body || []), l.context].join(' ');
  // CJK has no spaces – approximate by characters.
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
  const units = cjk ? text.length / 400 : text.split(/\s+/).length / 220;
  return Math.max(1, Math.round(units));
}
