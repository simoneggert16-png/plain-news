import Parser from 'rss-parser';

const UA = 'Mozilla/5.0 (compatible; PlainNewsBot/1.0; +https://github.com/plain-news)';
const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': UA } });

export const clean = (s = '') =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();

const JUNK = /(live:|live updates|as it happened|quiz|crossword|wordle|horoscope|podcast|newsletter|sponsored|deal(s)? of|best .* to buy|opinion|op-ed|letters:|in pictures|watch:|video:|gallery)/i;

/** Fetch all feeds in parallel; return recent, de-junked items. */
export async function fetchFeeds(feeds, { maxAgeHours = 30, perFeed = 14 } = {}) {
  const cutoff = Date.now() - maxAgeHours * 3600e3;
  const results = await Promise.allSettled(feeds.map((f) => parser.parseURL(f.url).then((r) => ({ f, r }))));
  const items = [];
  let ok = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    ok++;
    const { f, r } = res.value;
    for (const it of (r.items || []).slice(0, perFeed)) {
      const title = clean(it.title);
      const link = it.link?.trim();
      if (!title || !link || JUNK.test(title) || /\/(opinion|commentisfree|video|live)\//i.test(link)) continue;
      const ts = Date.parse(it.isoDate || it.pubDate || '') || Date.now();
      if (ts < cutoff) continue;
      const img = it.enclosure?.url || it['media:content']?.url || it['media:thumbnail']?.url || null;
      items.push({
        outlet: f.outlet,
        title,
        url: link,
        image: img,
        summary: clean(it.contentSnippet || it.content || it.summary || it.description || '').slice(0, 500),
        publishedAt: new Date(ts).toISOString(),
      });
    }
  }
  // de-dup by URL
  const seen = new Set();
  return { items: items.filter((i) => (seen.has(i.url) ? false : seen.add(i.url))), feedsOk: ok, feedsTotal: feeds.length };
}

import { extractVideoFromHtml, extractImagesFromHtml, isJunkImage } from './media.mjs';

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
    const image = candidateImages.length > 0 ? candidateImages.sort((a, b) => b.score - a.score)[0].url : null;

    const stripped = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
    const paras = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => clean(m[1]))
      .filter((p) => p.length > 60 && !/cookie|subscribe|sign up|newsletter|advertis|all rights reserved|javascript/i.test(p));

    return { text: paras.join('\n').slice(0, maxChars), image, video };
  } catch {
    return { text: '', image: null, video: null };
  }
}

