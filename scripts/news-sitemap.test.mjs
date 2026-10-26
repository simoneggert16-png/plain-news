import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  NEWS_WINDOW_MS, MAX_NEWS_ENTRIES, collectNewsEntries, splitNewsEntries,
  snapshotVersion, renderNewsChild, renderNewsIndex, newsLanguage, publicationTime,
  escapeXml, createNewsIndexResponse, createNewsChildResponse, readNewsArticles,
} from '../lib/news-sitemap.mjs';

const NOW = Date.parse('2026-10-22T13:32:47.667Z');
const SITE = { name: 'PLAIN.', url: 'https://www.plain-news.ch' };
const LOCALES = [
  ['en', 'en-GB'], ['de', 'de-DE'], ['fr', 'fr-FR'], ['es', 'es-ES'],
  ['it', 'it-IT'], ['pt', 'pt-PT'], ['zh', 'zh-CN'], ['ja', 'ja-JP'], ['ko', 'ko-KR'],
].map(([code, bcp47]) => ({ code, bcp47 }));
const options = (extra = {}) => ({ site: SITE, locales: LOCALES, sourceLocale: 'en', now: NOW, ...extra });
const article = (i, publishedAt = new Date(NOW - 3600000).toISOString()) => ({
  slug: `story-${i}`, publishedAt,
  locales: Object.fromEntries(LOCALES.map(({ code }) => [code, { title: `Title ${code} ${i}` }])),
});
const rawEntries = (n) => Array.from({ length: n }, (_, i) => ({
  loc: `${SITE.url}/en/a/story-${i}`, name: SITE.name, language: 'en',
  title: `Title ${i}`, publicationDate: new Date(NOW).toISOString(), published: NOW,
}));
const indexLinks = (xml) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const versionedRequest = (entries, at = NOW, page = 1) => new Request(`${SITE.url}/news-sitemap/${page}.xml?at=${at}&v=${snapshotVersion(entries)}`);

for (const [n, expected] of [[0, [0]], [1, [1]], [999, [999]], [1000, [1000]], [1001, [1000, 1]], [1999, [1000, 999]], [2000, [1000, 1000]], [2001, [1000, 1000, 1]], [2034, [1000, 1000, 34]], [9009, Array(9).fill(1000).concat(9)]]) {
  test(`entry boundary ${n}: no truncation, no duplicate, <=1000 per child`, () => {
    const entries = rawEntries(n), parts = splitNewsEntries(entries);
    assert.deepEqual(parts.map((p) => p.length), expected);
    assert.deepEqual(parts.flat(), entries);
    assert.equal(new Set(parts.flat().map((e) => e.loc)).size, n);
    for (const p of parts) assert.ok(p.length <= MAX_NEWS_ENTRIES);
  });
}

test('split AFTER language expansion; never cap 1000 source articles', () => {
  const { entries } = collectNewsEntries(Array.from({ length: 1001 }, (_, i) => article(i)), options());
  assert.equal(entries.length, 9009);
  assert.deepEqual(splitNewsEntries(entries).map((p) => p.length), Array(9).fill(1000).concat(9));
  for (const locale of LOCALES) assert.equal(entries.filter((e) => new URL(e.loc).pathname.startsWith(`/${locale.code}/`)).length, 1001);
});

test('48h inclusive lower/upper limits; one millisecond outside is excluded', () => {
  const times = [NOW - NEWS_WINDOW_MS - 1, NOW - NEWS_WINDOW_MS, NOW - NEWS_WINDOW_MS + 1, NOW, NOW + 1];
  const result = collectNewsEntries(times.map((t, i) => article(i, new Date(t).toISOString())), options());
  assert.equal(result.entries.length, 27);
  assert.deepEqual([...new Set(result.entries.map((e) => e.published))].sort(), times.slice(1, 4).sort());
  assert.equal(result.diagnostics.outsideWindow, 2);
});

test('explicit timezone offsets are compared as instants; DST/calendar days do not replace 48h', () => {
  const result = collectNewsEntries([article(1, '2026-10-22T15:32:47.667+02:00'), article(2, '2026-10-20T15:32:47.667+02:00')], options());
  assert.equal(result.entries.length, 18);
  assert.equal(publicationTime('2026-10-22T15:32:47.667+02:00'), NOW);
  const dstNow = Date.parse('2026-10-26T00:00:00Z');
  assert.equal(collectNewsEntries([article(3, '2026-10-24T00:00:00Z')], options({ now: dstNow })).entries.length, 9);
});

test('invalid, ambiguous and calendar-overflow dates are excluded, not normalized', () => {
  for (const date of ['', undefined, 'tomorrow', '2026-02-30T12:00:00Z', '2026-10-22T12:00:00', '2026-10-22T24:00:00Z', '2026-10-22T12:60:00Z', '2026-10-22T12:00:00+25:00', '0000-01-01']) assert.ok(Number.isNaN(publicationTime(date)), String(date));
  assert.ok(Number.isFinite(publicationTime('2024-02-29T12:00:00Z')));
  assert.ok(Number.isFinite(publicationTime('2026-10-22')));
  const result = collectNewsEntries([article(1, 'bad'), article(2)], options());
  assert.equal(result.entries.length, 9);
  assert.equal(result.diagnostics.invalidDates, 1);
});

test('all nine languages retained; /zh/ URL uses news language zh-cn (not zh)', () => {
  const { entries } = collectNewsEntries([article(1)], options());
  assert.deepEqual(entries.map((e) => e.language).sort(), ['en', 'de', 'fr', 'es', 'it', 'pt', 'zh-cn', 'ja', 'ko'].sort());
  assert.equal(entries.find((e) => e.language === 'zh-cn').loc, `${SITE.url}/zh/a/story-1`);
  assert.equal(newsLanguage({ code: 'zh', bcp47: 'zh-TW' }), 'zh-tw');
  assert.equal(newsLanguage({ code: 'zh', bcp47: 'zh-Hans' }), 'zh-cn');
});

test('fallback semantics match existing routes and never silently drop a language', () => {
  const a = article(1); delete a.locales.zh;
  assert.equal(collectNewsEntries([a], options()).entries.find((e) => e.language === 'zh-cn').title, a.locales.en.title);
  a.locales.zh = { title: '' };
  assert.throws(() => collectNewsEntries([a], options()), /Missing in-window title/);
});

test('canonical URL deduplication and ordering deterministic even with conflicting records', () => {
  const a = article(1), older = article(1, new Date(NOW - 7200000).toISOString()), b = article(2);
  const first = collectNewsEntries([a, older, b, a], options());
  const second = collectNewsEntries([b, a, older, a], options());
  assert.equal(first.entries.length, 18);
  assert.equal(first.diagnostics.duplicateUrls, 18);
  assert.deepEqual(first.entries, second.entries);
  assert.equal(snapshotVersion(first.entries), snapshotVersion(second.entries));
});

test('misconfiguration and malformed eligible records fail closed without truncation', () => {
  assert.throws(() => collectNewsEntries([article(1)], options({ locales: [...LOCALES, LOCALES[0]] })), /duplicate locales/);
  assert.throws(() => collectNewsEntries([article(1)], options({ locales: [] })), /Empty/);
  assert.throws(() => collectNewsEntries([{ ...article(1), slug: '../escape' }], options()), /slug/);
  assert.throws(() => collectNewsEntries([article(1)], options({ site: { ...SITE, url: 'https://www.plain-news.ch/subpath' } })), /origin/);
  assert.throws(() => newsLanguage({ code: 'zh' }), /specify/);
});

test('XML escaping, Unicode, invalid controls and lone surrogates', () => {
  assert.equal(escapeXml(`<>&'\"`), '&lt;&gt;&amp;&apos;&quot;');
  const e = rawEntries(1)[0]; e.title = `Größe 中文 日本語 한국어 & <x> "quote" ' 😀\u0000\uD800`;
  const xml = renderNewsChild([e]);
  assert.ok(xml.includes('中文 日本語 한국어'));
  assert.ok(xml.includes('&amp; &lt;x&gt; &quot;quote&quot; &apos;'));
  assert.ok(!xml.includes('\u0000') && !xml.includes('\uD800'));
  assert.throws(() => renderNewsChild(rawEntries(1001)), /exceeds 1000/);
});

test('valid index references unique same-origin children with escaped snapshot query', () => {
  const parts = splitNewsEntries(rawEntries(2034));
  const xml = renderNewsIndex(parts, { site: SITE, at: NOW, version: snapshotVersion(parts.flat()) });
  assert.ok(xml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.includes('&amp;v='));
  const links = indexLinks(xml);
  assert.equal(links.length, 3);
  assert.equal(new Set(links).size, 3);
  links.forEach((link, i) => { const u = new URL(link); assert.equal(u.origin, SITE.url); assert.equal(u.pathname, `/news-sitemap/${i + 1}.xml`); assert.equal(u.searchParams.get('at'), String(NOW)); });
});

test('index/children use runtime generation and no-store; no frozen build-time cache', async () => {
  const articles = [article(1)], entries = collectNewsEntries(articles, options()).entries;
  for (const r of [createNewsIndexResponse(articles, options()), createNewsChildResponse(articles, options(), versionedRequest(entries), '1.xml')]) {
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^application\/xml/);
    for (const header of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) assert.match(r.headers.get(header), /no-store/);
  }
});

test('crawling later expires rows AFTER splitting, preventing shifting/duplicate pages', async () => {
  const articles = Array.from({ length: 224 }, (_, i) => article(i, new Date(i === 0 ? NOW - NEWS_WINDOW_MS : NOW - 1000).toISOString()));
  const entries = collectNewsEntries(articles, options()).entries;
  const parts = splitNewsEntries(entries), all = [];
  for (let i = 0; i < parts.length; i++) {
    const r = createNewsChildResponse(articles, options({ now: NOW + 1 }), versionedRequest(entries, NOW, i + 1), `${i + 1}.xml`);
    assert.equal(r.status, 200);
    const actual = indexLinks(await r.text());
    assert.deepEqual(actual, parts[i].filter((e) => e.published >= NOW + 1 - NEWS_WINDOW_MS).map((e) => e.loc));
    all.push(...actual);
  }
  assert.equal(all.length, 223 * 9);
  assert.equal(new Set(all).size, all.length);
});

test('source/deployment drift is detected, not silently paginated against a changed dataset', () => {
  const articles = [article(1)], entries = collectNewsEntries(articles, options()).entries;
  const changed = [article(1), article(2)];
  assert.equal(createNewsChildResponse(changed, options(), versionedRequest(entries), '1.xml').status, 409);
  const future = article(2, new Date(NOW + 1).toISOString());
  const r = createNewsChildResponse([...articles, future], options({ now: NOW + 2 }), versionedRequest(entries), '1.xml');
  assert.equal(r.status, 200); // The new story belongs only to the next fresh index.
});

test('bad/missing/duplicate query, future or expired snapshot, invalid and missing pages', () => {
  const articles = [article(1)], entries = collectNewsEntries(articles, options()).entries;
  const good = versionedRequest(entries).url;
  const checks = [
    [new Request(SITE.url + '/news-sitemap/1.xml'), '1.xml', 400],
    [new Request(good + '&at=' + NOW), '1.xml', 400],
    [new Request(good + '&extra=1'), '1.xml', 400],
    [versionedRequest(entries, NOW + 1), '1.xml', 400],
    [versionedRequest(entries, NOW - NEWS_WINDOW_MS - 1), '1.xml', 410],
    [versionedRequest(entries), '0.xml', 404],
    [versionedRequest(entries), '01.xml', 404],
    [versionedRequest(entries), '1.xmlx', 404],
    [versionedRequest(entries), '2.xml', 404],
    [versionedRequest(entries), '50001.xml', 404],
  ];
  for (const [request, part, status] of checks) assert.equal(createNewsChildResponse(articles, options(), request, part).status, status);
});

test('zero eligible entries: one discoverable intentionally empty child, no old/future news', async () => {
  const r = createNewsIndexResponse([], options());
  const links = indexLinks(await r.text());
  assert.equal(links.length, 1);
  const child = createNewsChildResponse([], options(), new Request(links[0]), '1.xml');
  assert.equal(child.status, 200);
  assert.equal(indexLinks(await child.text()).length, 0);
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('Next route adapters: dynamic Node runtime, async params, real helper invocation', async () => {
  for (const child of [false, true]) {
    const file = path.join(root, child ? 'app/news-sitemap/[part]/route.js' : 'app/news-sitemap.xml/route.js');
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /export const dynamic = 'force-dynamic'/);
    assert.match(source, /export const runtime = 'nodejs'/);
    const transformed = source.replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    const articles = [article(1)];
    const entries = collectNewsEntries(articles, options()).entries;
    const context = vm.createContext({ SITE, LOCALES, SOURCE_LOCALE: 'en', getIndex: async () => articles,
      createNewsIndexResponse, createNewsChildResponse, Date: { now: () => NOW } });
    vm.runInContext(transformed + '\nthis.handler = GET;', context);
    const response = child ? await context.handler(versionedRequest(entries), { params: Promise.resolve({ part: '1.xml' }) }) : await context.handler();
    assert.equal(response.status, 200);
  }
});

test('existing middleware matcher excludes child URLs containing .xml, without middleware edits', () => {
  // Match the unchanged literal matcher from middleware.js.
  const matcher = /^\/((?!api|_next|favicon|icon|robots|sitemap|.*\..*).*)$/;
  assert.equal(matcher.test('/news-sitemap/1.xml'), false);
  assert.equal(matcher.test('/news-sitemap.xml'), false);
  assert.equal(matcher.test('/news-sitemap/not-xml'), true); // Not an advertised child.
});

test('sitemap index hard limit is enforced without silently capping child list', () => {
  const parts = Array.from({ length: 50000 }, () => []);
  assert.equal(indexLinks(renderNewsIndex(parts, { site: SITE, at: NOW, version: 'a'.repeat(64) })).length, 50000);
  assert.throws(() => renderNewsIndex([...parts, []], { site: SITE, at: NOW, version: 'a'.repeat(64) }), /Invalid child count/);
});

test('title/language/source correction between index and child fails closed', () => {
  const a = article(1), entries = collectNewsEntries([a], options()).entries;
  const changed = structuredClone(a); changed.locales.zh.title += ' corrected';
  assert.equal(createNewsChildResponse([changed], options(), versionedRequest(entries), '1.xml').status, 409);
  const otherLocales = LOCALES.map((l) => l.code === 'zh' ? { ...l, bcp47: 'zh-TW' } : l);
  assert.equal(createNewsChildResponse([a], options({ locales: otherLocales }), versionedRequest(entries), '1.xml').status, 409);
});

test('future record cannot override an eligible duplicate or enter any advertised child', async () => {
  const eligible = article(1), future = article(1, new Date(NOW + 1).toISOString());
  const { entries } = collectNewsEntries([future, eligible], options());
  assert.equal(entries.length, 9);
  assert.ok(entries.every((e) => e.published <= NOW));
  const r = createNewsChildResponse([future, eligible], options(), versionedRequest(entries), '1.xml');
  const xml = await r.text();
  assert.ok(!xml.includes(future.publishedAt));
  assert.equal((xml.match(/<news:news>/g) || []).length, 9);
});

test('unreadable, malformed or wrong-shaped source is an error, not a silent empty sitemap', () => {
  assert.throws(() => readNewsArticles(() => { throw new Error('ENOENT'); }), /ENOENT/);
  assert.throws(() => readNewsArticles(() => '{broken'), SyntaxError);
  for (const source of ['{}', 'null', '{"articles":null}', '{"articles":[null]}', '{"articles":[[]]}']) {
    assert.throws(() => readNewsArticles(() => source), /Invalid news source/);
  }
});

test('strict source reader is read-only and distinguishes intentionally empty from missing', () => {
  const source = [article(1)];
  assert.deepEqual(readNewsArticles((file, encoding) => {
    assert.equal(file, path.join(process.cwd(), 'content', 'index.json'));
    assert.equal(encoding, 'utf8');
    return JSON.stringify({ articles: source });
  }), source);
  assert.deepEqual(readNewsArticles(() => '{"articles":[]}'), []);
});
