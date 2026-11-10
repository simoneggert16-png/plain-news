import fs from 'fs';
import path from 'path';
import { safeHttpUrl } from '../safeUrl.mjs';

const SLUG_RE = /^[a-z0-9-]+$/i;
const PLAYERS_DIR = path.resolve(process.cwd(), 'public', 'sport', 'players');

// In-memory cache for resolved player photo URLs (stores { url, expiresAt })
const PHOTO_CACHE = new Map();
const MAX_CACHE_ENTRIES = 2000;
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;

const MAX_CONCURRENT_REMOTE = 4;
let activeRemoteFetches = 0;

function getCached(key) {
  const entry = PHOTO_CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    PHOTO_CACHE.delete(key);
    return undefined;
  }
  return entry.url;
}

function setCached(key, url, ttlMs = url ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) {
  if (!key) return;
  if (PHOTO_CACHE.size >= MAX_CACHE_ENTRIES && !PHOTO_CACHE.has(key)) {
    const oldestKey = PHOTO_CACHE.keys().next().value;
    if (oldestKey !== undefined) PHOTO_CACHE.delete(oldestKey);
  }
  PHOTO_CACHE.set(key, { url, expiresAt: Date.now() + ttlMs });
}

function resolveSafeSlug(player) {
  if (player.slug !== undefined && player.slug !== null && player.slug !== '') {
    const rawSlug = String(player.slug).trim();
    if (!SLUG_RE.test(rawSlug)) return null;
    return rawSlug.toLowerCase();
  }
  if (typeof player.name === 'string' && player.name.trim()) {
    const derived = player.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (derived && SLUG_RE.test(derived)) return derived;
  }
  return null;
}

export async function resolvePlayerPhoto(player, options = {}) {
  if (!player) return null;

  const slug = resolveSafeSlug(player);

  // 1. Check in-memory cache
  if (slug) {
    const cachedUrl = getCached(slug);
    if (cachedUrl !== undefined) {
      return cachedUrl;
    }

    // 2. Check local curated cutout file (strictly confined to PLAYERS_DIR)
    const localPath = path.resolve(PLAYERS_DIR, `${slug}.png`);
    if (localPath.startsWith(PLAYERS_DIR + path.sep) && fs.existsSync(localPath)) {
      const url = `/sport/players/${slug}.png`;
      setCached(slug, url);
      return url;
    }
  }

  // 3. Check official ESPN / provider headshot
  if (player.athlete?.headshot?.href) {
    const url = safeHttpUrl(player.athlete.headshot.href, '');
    if (url) {
      if (slug) setCached(slug, url);
      return url;
    }
  }

  if (!slug || !player.name || typeof player.name !== 'string') {
    return null;
  }

  // 4. Enforce per-request and global concurrency caps on uncached remote lookups
  const remoteBudget = options.remoteBudget;
  if (options.skipRemote) return null;
  if (remoteBudget && typeof remoteBudget.remaining === 'number') {
    if (remoteBudget.remaining <= 0) return null;
    remoteBudget.remaining -= 1;
  }
  if (activeRemoteFetches >= MAX_CONCURRENT_REMOTE) {
    return null;
  }

  // 5. Query Wikipedia / Wikimedia Commons API with strict timeout
  activeRemoteFetches += 1;
  try {
    const query = encodeURIComponent(`${player.name.slice(0, 80)} football`);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&pithumbsize=300&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'PlainNewsBot/1.0 (news@plain-news.ch)' },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      const first = Object.values(pages)[0];
      const thumbUrl = safeHttpUrl(first?.thumbnail?.source, '');
      if (thumbUrl) {
        setCached(slug, thumbUrl);
        return thumbUrl;
      }
    }
    setCached(slug, null);
  } catch {
    // Silently continue to fallback on timeout or upstream error
  } finally {
    activeRemoteFetches = Math.max(0, activeRemoteFetches - 1);
  }

  // 6. Fallback: null so UI renders clean jersey number avatar
  return null;
}
