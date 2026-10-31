// Search backends for the desk.
//
// Two independent aggregators: Google News is precise but refuses most
// datacenter requests, Bing News answers reliably from CI but needs its
// apiClick links unwrapped. Together they are the desk's "look something up".
import { fetchFeeds } from './feeds.mjs';

export const googleNews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
export const bingNews = (q, edition = {}) => {
  const { setlang = 'de', cc = 'ch' } = edition;
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&setlang=${setlang}&cc=${cc}`;
};

// The editions the desk asks the news index in. One edition answers with one
// country's outlets: a story is written where it happens, and the Korean press
// knows a Korean story where the Swiss one has not heard of it. The desk works
// internationally, so it asks them all.
export const NEWS_EDITIONS = [
  { setlang: 'en', cc: 'us' },
  { setlang: 'de', cc: 'de' },
  { setlang: 'fr', cc: 'fr' },
  { setlang: 'es', cc: 'es' },
  { setlang: 'it', cc: 'it' },
  { setlang: 'pt', cc: 'br' },
  { setlang: 'ko', cc: 'kr' },
  { setlang: 'ja', cc: 'jp' },
  { setlang: 'zh', cc: 'tw' },
  { setlang: 'ar', cc: 'ae' },
];

export function searchFeeds(queries, { editions = [] } = {}) {
  return queries.flatMap((q) => [
    { outlet: `Search: ${q}`, url: googleNews(q), kind: 'aggregator' },
    { outlet: `Bing: ${q}`, url: bingNews(q), kind: 'bing' },
    // The same question in every edition. The outlet is the host the news
    // index points at, so the desk can open what it finds.
    ...editions.map((edition) => ({
      outlet: `Bing ${edition.setlang}/${edition.cc}: ${q}`,
      url: bingNews(q, edition),
      kind: 'bing',
    })),
  ]);
}


/** Normalised results: title, url, outlet, publishedAt, summary. */
export async function webSearch(query, { limit = 15, maxAgeHours = 24 * 45, editions = [] } = {}) {
  const { items } = await fetchFeeds(searchFeeds([query], { editions }), { maxAgeHours, perFeed: 25 });

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
 * Mwmbl is an independent index of the whole web and it answers a runner
 * where the big engines answer with a captcha. It is the desk's second voice
 * on the wide web.
 */
async function mwmbl(query) {
  const res = await fetch(`https://api.mwmbl.org/search?s=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': WEB_UA, accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) return [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const url = String(row?.url || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    // The title and the extract arrive as pieces, with the search words marked.
    const pieces = (list) => (Array.isArray(list) ? list : []).map((p) => p?.value ?? '').join('').trim();
    out.push({ title: pieces(row.title).slice(0, 300), url, summary: pieces(row.extract).slice(0, 300) });
    if (out.length >= 20) break;
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
  // Two voices on the same question: the second one finds what the first
  // engine refused to show.
  const wide = await mwmbl(q).catch(() => []);
  const merged = [...hits, ...wide];
  const kept = [];
  const seen = new Set();
  for (const h of merged) {
    if (!h?.url || seen.has(h.url)) continue;
    seen.add(h.url);
    kept.push(h);
  }

  const out = kept
    .filter((h) => !/duckduckgo\.com|mojeek\.com|mwmbl\.org/i.test(h.url))
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

// ─────────────────────── the documents that prove it ───────────────────────
// A story is not a headline, it is a paper. These registries answer without a
// key from a runner, and they hold the filings, rules and losses a reporter
// can cite: the company's own filings, the government's own notices, the
// losses the industry recorded.
const jsonGet = async (url, { headers = {}, timeout = 20000 } = {}) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': WEB_UA, accept: 'application/json', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
};

/** Company filings: the words the company itself filed with the regulator. */
async function secFilings(query, limit) {
  const data = await jsonGet(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(query)}`, {
    headers: { 'user-agent': 'PLAIN. news desk desk@plain-news.ch' },
  });
  const hits = data?.hits?.hits || [];
  const out = [];
  const seen = new Set();
  for (const hit of hits) {
    const src = hit?._source || {};
    const name = (src.display_names || [])[0] || '';
    const adsh = String(src.adsh || '');
    const cik = String((src.ciks || [])[0] || '').replace(/^0+/, '');
    if (!adsh || !cik) continue;
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, '')}/`;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      title: `${name} — ${src.form || 'filing'}${src.file_date ? ` (${src.file_date})` : ''}`,
      url,
      outlet: 'US SEC EDGAR',
      publishedAt: src.file_date ? `${src.file_date}T00:00:00.000Z` : null,
      summary: `${src.form || 'filing'} by ${name}`,
      primary: true,
      kind: 'document',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** The rules and notices the US government published itself. */
async function federalRegister(query, limit) {
  const data = await jsonGet(
    `https://www.federalregister.gov/api/v1/documents.json?per_page=${limit}&order=newest&conditions%5Bterm%5D=${encodeURIComponent(query)}`
  );
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows
    .filter((r) => r?.html_url)
    .map((r) => ({
      title: String(r.title || '').slice(0, 300),
      url: r.html_url,
      outlet: 'US Federal Register',
      publishedAt: r.publication_date ? `${r.publication_date}T00:00:00.000Z` : null,
      summary: String(r.abstract || '').slice(0, 400),
      primary: true,
      kind: 'document',
    }));
}

/** Every loss the crypto industry recorded: name, day, amount, chain. */
async function cryptoLosses(query, limit) {
  const rows = await jsonGet('https://api.llama.fi/hacks', { timeout: 25000 });
  if (!Array.isArray(rows)) return [];
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (!words.length) return [];
  const out = [];
  for (const row of rows) {
    const haystack = `${row.name || ''} ${row.description || ''} ${row.targetType || ''}`.toLowerCase();
    if (!words.some((w) => haystack.includes(w))) continue;
    out.push({
      title: `${row.name || 'loss'} — ${row.amount ? `$${Math.round(row.amount).toLocaleString('en-US')}` : 'amount unknown'}`,
      url: 'https://defillama.com/hacks',
      outlet: 'DeFiLlama (recorded losses)',
      publishedAt: row.date ? new Date(row.date * 1000).toISOString() : null,
      summary: String(row.description || '').slice(0, 400),
      primary: false,
      kind: 'document',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The papers behind the story, from the registries that keep them. A desk
 * that can only read headlines can never prove anything; these are the
 * documents a letter can be sent about.
 */
export async function documentSearch(query, { limit = 10 } = {}) {
  const q = String(query || '').trim().slice(0, 160);
  if (q.length < 3) return [];
  const hit = webCache.get(`docs:${q}`);
  if (hit && Date.now() - hit.at < WEB_CACHE_MS) return hit.value.slice(0, limit);

  const groups = await Promise.all([
    secFilings(q, limit).catch(() => []),
    federalRegister(q, limit).catch(() => []),
    cryptoLosses(q, limit).catch(() => []),
  ]);
  const out = [];
  const seen = new Set();
  for (const group of groups) {
    for (const hit2 of group) {
      if (!hit2?.url || seen.has(hit2.url)) continue;
      seen.add(hit2.url);
      out.push(hit2);
    }
  }
  webCache.set(`docs:${q}`, { value: out, at: Date.now() });
  return out.slice(0, limit);
}

/**
 * The copy of a document the archive kept. Documents get pulled: a company
 * takes a page down, a ministry edits a notice. The archive still has it,
 * and a reporter can cite it.
 */
export async function archivedCopy(url, { limit = 3 } = {}) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return [];
  const host = new URL(target).hostname;
  // The document itself first; the pages of the same host only if it was
  // never archived on its own.
  const lookups = [target, `${host}/*`];
  for (const lookup of lookups) {
    const data = await jsonGet(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(lookup)}&output=json&filter=statuscode:200&collapse=urlkey&limit=${Math.max(limit * 10, 20)}`
    );
    if (!Array.isArray(data) || data.length < 2) continue;
    const out = [];
    for (const row of data.slice(1)) {
      const stamp = row?.[1];
      const original = row?.[2];
      if (!stamp || !original) continue;
      out.push({
        title: `Archive copy of ${original}`,
        url: `https://web.archive.org/web/${stamp}/${original}`,
        outlet: 'Internet Archive',
        publishedAt: null,
        summary: `The archive kept this copy of ${original}`,
        primary: true,
        kind: 'document',
      });
      if (out.length >= limit) break;
    }
    if (out.length) return out;
  }
  return [];
}

