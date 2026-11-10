import { fetchRegionalJson } from './http.js';
import { normalizeRegionalArticles } from '../../../src/data/regionalModel.js';

const PLAIN_FEED_URL =
  process.env.PLAIN_NEWS_FEED_URL || 'https://www.plain-news.ch/api/maven/feed?locale=de&limit=240';

let cachedPlainFeed = { at: 0, items: [] };

async function getPlainFeedItems() {
  if (Date.now() - cachedPlainFeed.at < 120_000 && cachedPlainFeed.items.length) {
    return cachedPlainFeed.items;
  }
  try {
    const payload = await fetchRegionalJson(PLAIN_FEED_URL, {
      headers: { 'User-Agent': 'PlainMaven/1.0' },
      timeoutMs: 6_000,
    });
    if (Array.isArray(payload?.items)) {
      cachedPlainFeed = { at: Date.now(), items: payload.items };
      return payload.items;
    }
  } catch {
    /* fall through to GDELT */
  }
  return cachedPlainFeed.items;
}

async function fetchRegionalNews(place) {
  const query = place?.locality || place?.region || place?.country;
  if (!query) {
    return { status: 'unavailable', query: null, articles: [], source: null };
  }

  // 1. Primary legal source: PLAIN. Independent Newsroom verified dispatches
  const needle = String(query).trim().toLowerCase();
  const countryNeedle = String(place?.country || '').trim().toLowerCase();
  const plainItems = await getPlainFeedItems();
  if (plainItems.length) {
    const matched = plainItems
      .filter((item) => {
        const hay = `${item.placeName || ''} ${item.canonicalPlace || ''} ${item.country || ''} ${item.title || ''}`.toLowerCase();
        return hay.includes(needle) || (countryNeedle && hay.includes(countryNeedle));
      })
      .slice(0, 5)
      .map((item) => ({
        title: item.title,
        url: item.url,
        domain: 'plain-news.ch',
        publishedAt: item.publishedAt || null,
        sourceCountry: item.country || null,
      }));
    if (matched.length) {
      return {
        status: 'ready',
        query,
        articles: matched,
        source: 'PLAIN. Newsroom',
      };
    }
  }

  // 2. Open academic/public fallback: GDELT Project DOC 2.0 API (citation required)
  const params = new URLSearchParams({
    query: `"${String(query).replace(/["\\]/g, ' ').trim()}"`,
    mode: 'artlist',
    format: 'json',
    maxrecords: '5',
    sort: 'datedesc',
    timespan: '48h',
  });
  try {
    const payload = await fetchRegionalJson(
      `https://api.gdeltproject.org/api/v2/doc/doc?${params}`,
      {
        headers: { 'User-Agent': 'PlainMaven/1.0' },
        timeoutMs: 10_000,
      },
    );
    const articles = normalizeRegionalArticles(payload, 5);
    return {
      status: articles.length ? 'ready' : 'empty',
      query,
      articles,
      source: 'GDELT Project',
    };
  } catch {
    return { status: 'unavailable', query, articles: [], source: null };
  }
}

export { fetchRegionalNews };
