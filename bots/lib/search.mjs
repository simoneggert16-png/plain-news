// Search backends for the desk.
//
// Two independent aggregators: Google News is precise but refuses most
// datacenter requests, Bing News answers reliably from CI but needs its
// apiClick links unwrapped. Together they are the desk's "look something up".
import { fetchFeeds } from './feeds.mjs';

export const googleNews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
export const bingNews = (q) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&setlang=de&cc=ch`;

export function searchFeeds(queries) {
  return queries.flatMap((q) => [
    { outlet: `Search: ${q}`, url: googleNews(q), kind: 'aggregator' },
    { outlet: `Bing: ${q}`, url: bingNews(q), kind: 'bing' },
  ]);
}

/** Normalised results: title, url, outlet, publishedAt, summary. */
export async function webSearch(query, { limit = 15, maxAgeHours = 24 * 45 } = {}) {
  const { items } = await fetchFeeds(searchFeeds([query]), { maxAgeHours, perFeed: 25 });
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.url)) continue;
    // Google's RSS links are JavaScript redirects, not the article. The desk
    // has to be able to open what it sees, so only publisher URLs survive.
    if (/^https?:\/\/news\.google\.com\//i.test(it.url)) continue;
    seen.add(it.url);
    out.push({
      title: it.title,
      url: it.url,
      outlet: it.outlet,
      publishedAt: it.publishedAt,
      summary: String(it.summary || '').slice(0, 240),
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ─────────────────────────── wide web ───────────────────────────
// News RSS knows what a newsroom published. An investigator needs the index
// of the whole web: court rulings, sanctions lists, audit reports, company
// press pages. DuckDuckGo answers without a key; Mojeek is the second voice.
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const webCache = new Map();
const WEB_CACHE_MS = 10 * 60 * 1000;

const stripTags = (s = '') =>
  String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** DuckDuckGo wraps every hit in a redirect; the real address is inside. */
function unwrap(url) {
  const raw = String(url || '').trim();
  if (raw.startsWith('//')) return `https:${raw}`;
  const m = raw.match(/[?&]uddg=([^&]+)/);
  if (!m) return raw;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return raw;
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': WEB_UA, 'accept-language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return '';
  return res.text().catch(() => '');
}

async function duckduckgo(query) {
  const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const url = unwrap(m[1]);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: stripTags(m[2]).slice(0, 300), url });
  }
  if (out.length) {
    // The snippet sits in the block after the link.
    const snips = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((x) => stripTags(x[1]));
    out.forEach((o, i) => { o.summary = (snips[i] || '').slice(0, 300); });
  }
  return out;
}

async function mojeek(query) {
  const html = await fetchHtml(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+class="ob"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const url = unwrap(m[1]);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: stripTags(m[2]).slice(0, 300), url });
  }
  return out;
}

/**
 * The whole web, not only the news: primary documents, official statements,
 * company pages. Normalised like webSearch, with the host as the outlet.
 *
 * DuckDuckGo and Mojeek answer datacenter requests with an anti-bot page, so
 * this usually ends at the document finder: the news index reaches every
 * publisher with the address the document really lives at.
 */
export async function wideSearch(query, { limit = 12 } = {}) {
  const q = String(query || '').trim().slice(0, 160);
  if (q.length < 3) return [];
  const hit = webCache.get(q);
  if (hit && Date.now() - hit.at < WEB_CACHE_MS) return hit.value.slice(0, limit);

  let hits = [];
  try {
    hits = await duckduckgo(q);
  } catch {
    hits = [];
  }
  if (!hits.length) {
    try {
      hits = await mojeek(q);
    } catch {
      hits = [];
    }
  }

  const out = hits
    .filter((h) => !/duckduckgo\.com|mojeek\.com/i.test(h.url))
    .map((h) => {
      let host = 'unknown';
      try {
        host = new URL(h.url).hostname.replace(/^www\./, '');
      } catch {
        /* keep unknown */
      }
      return { title: h.title, url: h.url, outlet: host, publishedAt: null, summary: h.summary || '' };
    });

  if (!out.length) {
    const { findDocuments } = await import('./documents.mjs');
    const docs = await findDocuments(q, { limit }).catch(() => []);
    for (const d of docs) {
      out.push({
        title: d.title,
        url: d.url,
        outlet: d.outlet,
        publishedAt: d.publishedAt,
        summary: '',
        // The document finder knows where the document lives; the wide web
        // does not make it primary.
        primary: false,
        kind: 'news',
      });
    }
  }

  webCache.set(q, { value: out, at: Date.now() });
  return out.slice(0, limit);
}
