import Parser from 'rss-parser';

const UA = 'Mozilla/5.0 (compatible; PlainNewsBot/1.0; +https://github.com/plain-news)';
const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': UA } });

export const clean = (s = '') =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();

// Hard junk only. Live blogs, "live updates" and "as it happened" are kept on
// purpose: those are exactly the pages that carry rolling coverage of
// elections, wars and disasters. They get flagged with isLive instead of being
// thrown away before the desk ever sees them.
const JUNK = /(quiz|crossword|wordle|horoscope|podcast|newsletter|sponsored|deal(s)? of|best .* to buy|op-ed|letters:|in pictures|photo gallery|live stream|how to watch)/i;
const OPINION = /\b(opinion|commentary|column|editorial board|analysis:)\b/i;
const LINK_JUNK = /\/(opinion|commentisfree|video|videos|gallery|pictures|slideshow)\//i;
const LIVE_RE = /\b(live|liveticker|live ticker|live updates?|as it happened|breaking|eilmeldung|rolling coverage)\b/i;

/** Google News RSS puts the real publisher at the end: "Headline - The Guardian". */
function publisherFromAggregator(title = '') {
  const m = title.match(/\s[-–—]\s([^-–—]{2,40})$/);
  if (!m) return { title, publisher: null };
  const publisher = m[1].trim();
  if (!publisher || /google|news\.google|^\W+$/i.test(publisher)) return { title, publisher: null };
  return { title: title.slice(0, m.index).trim(), publisher };
}

/** Fetch all feeds in parallel; return recent, de-junked items. */
export async function fetchFeeds(feeds, { maxAgeHours = 30, perFeed = 20 } = {}) {
  const cutoff = Date.now() - maxAgeHours * 3600e3;
  // rss-parser's own timeout covers the HTTP request, not a stalled socket or
  // a server that never finishes the body. One hung feed blocked the whole
  // newsroom cycle, so every feed gets a hard deadline.
  const FEED_TIMEOUT_MS = Number(process.env.FEED_TIMEOUT_MS || 25000);
  const withDeadline = (f) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`feed timeout: ${f.url}`)), FEED_TIMEOUT_MS);
    });
    return Promise.race([parser.parseURL(f.url), timeout])
      .then((r) => ({ f, r }))
      .finally(() => clearTimeout(timer));
  };
  const results = await Promise.allSettled(feeds.map(withDeadline));
  const items = [];
  let ok = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    ok++;
    const { f, r } = res.value;
    for (const it of (r.items || []).slice(0, perFeed)) {
      let title = clean(it.title);
      let outlet = f.outlet;
      if (!title) continue;

      if (f.kind === 'aggregator') {
        const parsed = publisherFromAggregator(title);
        if (!parsed.publisher) continue; // no publisher = cannot count as a source
        title = parsed.title;
        outlet = parsed.publisher;
      }

      const link = it.link?.trim();
      if (!link || JUNK.test(title) || OPINION.test(title) || LINK_JUNK.test(link)) continue;
      const ts = Date.parse(it.isoDate || it.pubDate || '') || Date.now();
      if (ts < cutoff) continue;
      const img = it.enclosure?.url || it['media:content']?.url || it['media:thumbnail']?.url || null;
      const summary = clean(it.contentSnippet || it.content || it.summary || it.description || '').slice(0, 700);
      items.push({
        outlet,
        title,
        url: link,
        image: img,
        summary,
        publishedAt: new Date(ts).toISOString(),
        ...(f.positive ? { positive: true } : {}),
        via: f.via || (f.kind === 'aggregator' ? 'Google News' : null),
        aggregator: f.kind === 'aggregator',
        isLive: LIVE_RE.test(title) || /\/live\//i.test(link),
      });
    }
  }
  // de-dup by URL and by outlet+title (the same story often appears in two
  // section feeds of the same outlet under different URLs).
  const seen = new Set();
  const seenTitle = new Set();
  const unique = items.filter((i) => {
    if (seen.has(i.url)) return false;
    seen.add(i.url);
    const key = `${i.outlet.toLowerCase()}|${i.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90)}`;
    if (seenTitle.has(key)) return false;
    seenTitle.add(key);
    return true;
  });
  return { items: unique, feedsOk: ok, feedsTotal: feeds.length };
}

import { extractVideoFromHtml, extractImagesFromHtml, isJunkImage, cleanImageUrl } from './media.mjs';

/** Best-effort full text, high-res photo & video: grab text paragraphs and media */
export async function fetchArticleDetails(url, maxChars = 3500) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!res.ok) return { text: '', image: null, video: null };
    const html = await res.text();

    // Extract video (YouTube embed or MP4 stream)
    const video = extractVideoFromHtml(html);

    // Extract images, prioritizing non-junk editorial photojournalism
    const candidateImages = extractImagesFromHtml(html);
    const top = candidateImages.length > 0 ? candidateImages.sort((a, b) => b.score - a.score)[0] : null;
    const image = top ? cleanImageUrl(top.url) : null;
    const imageCaption = top ? top.caption : null;
    const imageCredit = top ? top.credit : null;

    const stripped = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
    const paras = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => clean(m[1]))
      .filter((p) => p.length > 60 && !/cookie|subscribe|sign up|newsletter|advertis|all rights reserved|javascript/i.test(p));

    return { text: paras.join('\n').slice(0, maxChars), image, imageCaption, imageCredit, video };
  } catch {
    return { text: '', image: null, imageCaption: null, imageCredit: null, video: null };
  }
}
