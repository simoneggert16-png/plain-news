// The desk's research backends are silent when they break: a search that
// answers nothing looks exactly like a story that does not exist. These tests
// pin the parsers against the shapes the registries really send, and the photo
// rules that keep a poster from becoming the picture of a story.
import test from 'node:test';
import assert from 'node:assert/strict';

import { NEWS_EDITIONS, bingNews, searchFeeds, wideSearch, documentSearch, archivedCopy } from '../bots/lib/search.mjs';
import { isPhotograph, isSignageCaption, curateMedia } from '../bots/lib/media.mjs';

const realFetch = globalThis.fetch;

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const textResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  headers: { get: () => 'text/html' },
  text: async () => body,
  json: async () => {
    throw new Error('not json');
  },
});

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('the desk asks the news index in the countries where the story happens', () => {
  const codes = NEWS_EDITIONS.map((e) => e.cc);
  for (const cc of ['us', 'de', 'kr', 'jp', 'br', 'ae']) assert.ok(codes.includes(cc), `missing edition ${cc}`);
  const korean = bingNews('itaewon crowd crush', { setlang: 'ko', cc: 'kr' });
  assert.match(korean, /setlang=ko/);
  assert.match(korean, /cc=kr/);
  assert.match(korean, /format=RSS/);

  const feeds = searchFeeds(['one query'], { editions: NEWS_EDITIONS });
  assert.equal(feeds.length, 2 + NEWS_EDITIONS.length);
  assert.ok(feeds.every((f) => f.kind === 'aggregator' || f.kind === 'bing'));
});

test('Mwmbl is the wide web when the big engines refuse the runner', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('duckduckgo.com')) return textResponse('', false);
    if (u.includes('mojeek.com')) return textResponse('', false);
    if (u.includes('api.mwmbl.org')) {
      return jsonResponse([
        {
          url: 'https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?docid=ruling-42',
          title: [{ value: 'Bundesgericht ' }, { value: 'Urteil 1B_42/2026' }],
          extract: [{ value: 'Der Beschwerdeführer ' }, { value: 'wurde verurteilt.' }],
        },
      ]);
    }
    return textResponse('', false);
  };
  const hits = await wideSearch('surveillance ruling mwmbl-probe', { limit: 5 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].outlet, 'bger.ch');
  assert.equal(hits[0].title, 'Bundesgericht Urteil 1B_42/2026');
  assert.match(hits[0].summary, /Beschwerdeführer/);
});

test('the document registries answer with papers, not headlines', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('efts.sec.gov')) {
      return jsonResponse({
        hits: {
          hits: [
            {
              _source: {
                display_names: ['ACME BRIDGE HOLDINGS'],
                adsh: '0001-25-000001',
                ciks: ['0000000123'],
                form: '8-K',
                file_date: '2026-10-01',
              },
            },
          ],
        },
      });
    }
    if (u.includes('federalregister.gov')) {
      return jsonResponse({
        results: [
          {
            title: 'Notice of enforcement action',
            html_url: 'https://www.federalregister.gov/d/2026-12345',
            publication_date: '2026-10-02',
            abstract: 'The agency acted.',
          },
        ],
      });
    }
    if (u.includes('api.llama.fi')) {
      return jsonResponse([
        { name: 'Bitget exploit', amount: 630000000, date: 1793000000, description: 'Bridge drained' },
        { name: 'Unrelated site', amount: 10, date: 1793000000, description: 'nothing here' },
      ]);
    }
    return jsonResponse(null);
  };

  const hits = await documentSearch('bridge exploit documents-probe', { limit: 10 });
  const sec = hits.find((h) => h.outlet === 'US SEC EDGAR');
  assert.ok(sec, 'the filing is on the desk');
  assert.equal(sec.url, 'https://www.sec.gov/Archives/edgar/data/123/000125000001/');
  assert.equal(sec.primary, true);
  assert.equal(sec.kind, 'document');

  const register = hits.find((h) => h.outlet === 'US Federal Register');
  assert.equal(register.url, 'https://www.federalregister.gov/d/2026-12345');

  const losses = hits.find((h) => h.outlet === 'DeFiLlama (recorded losses)');
  assert.match(losses.title, /630,000,000/);
  assert.ok(!hits.some((h) => /Unrelated/.test(h.title)), 'a loss without the query word is not a hit');
});

test('a pulled document is still readable in the archive', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('web.archive.org/cdx')) {
      return jsonResponse([
        ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
        ['org,example)/doc', '20260101000000', 'https://example.org/doc', 'text/html', '200', 'd', '100'],
      ]);
    }
    return jsonResponse(null);
  };
  const copies = await archivedCopy('https://example.org/doc', { limit: 1 });
  assert.equal(copies.length, 1);
  assert.equal(copies[0].url, 'https://web.archive.org/web/20260101000000/https://example.org/doc');
  assert.equal(copies[0].primary, true);
});

test('a poster is not the picture of the story, a protest photo is', () => {
  assert.equal(isPhotograph('An "Ebola alert" poster reading at the hospital gate'), false);
  assert.equal(isPhotograph('A notice board showing the symptoms at the entrance'), false);
  assert.equal(isPhotograph('Protesters hold signs against the government during a rally'), true);
  assert.equal(isPhotograph('Health workers screen a man at the border post'), true);

  assert.equal(isSignageCaption('An "Ebola alert" poster reading at the hospital gate'), true);
  assert.equal(isSignageCaption('A nurse screens a traveller at the border'), false);

  const media = curateMedia([
    { image: 'https://example.org/poster.jpg', imageCaption: 'A poster saying "Ebola alert" hangs at the gate' },
    { image: 'https://example.org/screening.jpg', imageCaption: 'A nurse screens a traveller at the border' },
  ]);
  assert.equal(media.image, 'https://example.org/screening.jpg');
});
