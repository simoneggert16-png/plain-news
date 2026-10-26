import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
export const MAX_NEWS_ENTRIES = 1000;
export const MAX_CHILDREN = 50000;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const NEWS_NS = 'http://www.google.com/schemas/sitemap-news/0.9';
const HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  // Never serve build-time or CDN-stale news metadata beyond its 48h window.
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function readNewsArticles(read = readFileSync) {
  // Unlike the generic getIndex() fallback, an unreadable/broken source is an
  // error, not a successful empty news sitemap. This function never writes.
  const index = JSON.parse(read(path.join(process.cwd(), 'content', 'index.json'), 'utf8'));
  if (!index || !Array.isArray(index.articles)
    || index.articles.some((a) => !a || typeof a !== 'object' || Array.isArray(a))) {
    throw new Error('Invalid news source index');
  }
  return index.articles;
}

export function escapeXml(value = '') {
  // XML 1.0 permits these code points only (also reject lone surrogates).
  const clean = [...String(value)].map((c) => {
    const n = c.codePointAt(0);
    return n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0xD7FF)
      || (n >= 0xE000 && n <= 0xFFFD) || (n >= 0x10000 && n <= 0x10FFFF) ? c : '\uFFFD';
  }).join('');
  return clean.replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function publicationTime(value) {
  // W3C date or timestamp with explicit timezone; never accept local/ambiguous dates.
  if (typeof value !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s, , tz] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return NaN;
  if (h !== undefined && (Number(h) > 23 || Number(mi) > 59 || Number(s || 0) > 59)) return NaN;
  if (tz && tz !== 'Z' && (Number(tz.slice(1, 3)) > 23 || Number(tz.slice(4)) > 59)) return NaN;
  return Date.parse(value);
}

export function newsLanguage(locale) {
  const code = (locale.bcp47 || locale.code).toLowerCase();
  if (/^zh-(cn|hans)(-|$)/.test(code)) return 'zh-cn';
  if (/^zh-(tw|hant)(-|$)/.test(code)) return 'zh-tw';
  if (code === 'zh') throw new Error('Chinese news language must specify simplified/traditional');
  const language = code.split('-')[0];
  if (!/^[a-z]{2,3}$/.test(language)) throw new Error('Invalid news language: ' + code);
  return language;
}

export function collectNewsEntries(articles, { site, locales, sourceLocale, now }) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid reference time');
  const origin = new URL(site.url);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('Sitemap site must be an HTTP(S) origin');
  }
  if (typeof site.name !== 'string' || !site.name.trim()) throw new Error('Missing publication name');
  if (!locales.length || new Set(locales.map((l) => l.code)).size !== locales.length) throw new Error('Empty or duplicate locales');
  for (const locale of locales) {
    if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(locale.code)) throw new Error('Invalid locale path');
    newsLanguage(locale);
  }
  const byUrl = new Map();
  const diagnostics = { invalidDates: 0, outsideWindow: 0, duplicateUrls: 0 };
  for (const article of articles) {
    const published = publicationTime(article.publishedAt);
    if (!Number.isFinite(published)) { diagnostics.invalidDates++; continue; }
    if (published < now - NEWS_WINDOW_MS || published > now) { diagnostics.outsideWindow++; continue; }
    // Do not silently discard an in-window record or a configured language.
    if (!/^[a-z0-9-]+$/.test(article.slug || '')) throw new Error('Invalid in-window article slug');
    for (const locale of locales) {
      // Match lib/content.mjs localize() and the public locale routes, including fallback.
      const localized = article.locales?.[locale.code] || article.locales?.[sourceLocale] || {};
      if (typeof localized.title !== 'string' || !localized.title.trim()) throw new Error('Missing in-window title: ' + article.slug + '/' + locale.code);
      const entry = {
        loc: `${origin.origin}/${locale.code}/a/${article.slug}`,
        name: site.name,
        language: newsLanguage(locale),
        publicationDate: article.publishedAt,
        published,
        title: localized.title,
      };
      const previous = byUrl.get(entry.loc);
      if (previous) diagnostics.duplicateUrls++;
      // Canonical URL is unique. Prefer latest eligible publication on conflict,
      // then a deterministic lexical tie-break; input ordering cannot move shards.
      if (!previous || entry.published > previous.published
        || (entry.published === previous.published && compare(JSON.stringify(entry), JSON.stringify(previous)) < 0)) byUrl.set(entry.loc, entry);
    }
  }
  return { entries: [...byUrl.values()].sort((a, b) => compare(a.loc, b.loc)), diagnostics };
}

export function splitNewsEntries(entries) {
  const parts = [];
  for (let offset = 0; offset < entries.length; offset += MAX_NEWS_ENTRIES) parts.push(entries.slice(offset, offset + MAX_NEWS_ENTRIES));
  if (parts.length > MAX_CHILDREN) throw new Error('Sitemap index limit exceeded; no entries were truncated');
  // A valid, intentionally empty child keeps the zero-news index schema-valid.
  return parts.length ? parts : [[]];
}

export function snapshotVersion(entries) {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

export function renderNewsChild(entries) {
  if (entries.length > MAX_NEWS_ENTRIES) throw new Error('News child exceeds 1000 entries');
  const body = entries.map((e) => '<url>' + `<loc>${escapeXml(e.loc)}</loc>`
    + '<news:news><news:publication>' + `<news:name>${escapeXml(e.name)}</news:name>`
    + `<news:language>${escapeXml(e.language)}</news:language></news:publication>`
    + `<news:publication_date>${escapeXml(e.publicationDate)}</news:publication_date>`
    + `<news:title>${escapeXml(e.title)}</news:title></news:news></url>`).join('');
  return XML_HEADER + `<urlset xmlns="${SITEMAP_NS}" xmlns:news="${NEWS_NS}">` + body + '</urlset>';
}

export function renderNewsIndex(parts, { site, at, version }) {
  if (!parts.length || parts.length > MAX_CHILDREN) throw new Error('Invalid child count');
  const origin = new URL(site.url).origin;
  return XML_HEADER + `<sitemapindex xmlns="${SITEMAP_NS}">` + parts.map((_, i) => {
    const child = `${origin}/news-sitemap/${i + 1}.xml?at=${at}&v=${version}`;
    return `<sitemap><loc>${escapeXml(child)}</loc></sitemap>`;
  }).join('') + '</sitemapindex>';
}

const xmlResponse = (xml) => new Response(xml, { headers: HEADERS });
const problem = (status, text) => new Response(text + '\n', {
  status, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
});

export function createNewsIndexResponse(articles, options) {
  const { entries } = collectNewsEntries(articles, options);
  return xmlResponse(renderNewsIndex(splitNewsEntries(entries), {
    site: options.site, at: options.now, version: snapshotVersion(entries),
  }));
}

export function createNewsChildResponse(articles, options, request, part) {
  if (!/^[1-9]\d*\.xml$/.test(part || '')) return problem(404, 'Unknown news sitemap child');
  const page = Number(part.slice(0, -4));
  if (!Number.isSafeInteger(page) || page > MAX_CHILDREN) return problem(404, 'Unknown news sitemap child');
  const query = new URL(request.url).searchParams;
  const atText = query.get('at') || '', version = query.get('v') || '';
  if (query.getAll('at').length !== 1 || query.getAll('v').length !== 1
    || [...query.keys()].some((k) => k !== 'at' && k !== 'v')
    || !/^\d{1,16}$/.test(atText) || !/^[a-f0-9]{64}$/.test(version)) return problem(400, 'Invalid news sitemap snapshot');
  const at = Number(atText), now = options.now;
  if (!Number.isSafeInteger(at) || at > now) return problem(400, 'Invalid news sitemap reference time');
  if (at < now - NEWS_WINDOW_MS) return problem(410, 'News snapshot expired; refresh /news-sitemap.xml');
  // Freeze membership/order at index time: no shifting offset pages during crawling.
  // Source/config changes across deployments fail closed instead of silently losing rows.
  const { entries } = collectNewsEntries(articles, { ...options, now: at });
  if (snapshotVersion(entries) !== version) return problem(409, 'News source changed; refresh /news-sitemap.xml');
  const parts = splitNewsEntries(entries);
  if (page > parts.length) return problem(404, 'Unknown news sitemap child');
  // Remove expired metadata only AFTER chunking so later children do not shift.
  // New stories are advertised by the next fresh index, not spliced into old pages.
  return xmlResponse(renderNewsChild(parts[page - 1].filter((e) => e.published >= now - NEWS_WINDOW_MS && e.published <= now)));
}
