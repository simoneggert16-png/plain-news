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
