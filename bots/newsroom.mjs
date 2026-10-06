#!/usr/bin/env node
// PLAIN. NEWSROOM — runs on a schedule (GitHub Actions). Pipeline:
//   1. SCOUT      fetch ~40 diverse RSS feeds
//   2. DESK       cluster headlines into events; keep only events covered by ≥2 different outlets
//   3. REPORTER   read the source articles, write a neutral draft (facts only)
//   4. EDITOR     separate model fact-checks the draft against sources → publish / revise / reject
//   5. TRANSLATOR translate into all site languages
//   6. PUBLISH    write JSON → git commit → Vercel redeploys
import { FEEDS } from './sources.mjs';
import { fetchFeeds, fetchArticleDetails } from './lib/feeds.mjs';
import { chatJSON } from './lib/llm.mjs';
import { STYLE_GUIDE, slopHits } from './lib/style.mjs';
import { translate } from './lib/translate.mjs';
import { loadIndex, saveIndex, loadState, saveState, saveArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { CATEGORIES, LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';
import { curateMedia } from './lib/media.mjs';

const MAX_STORIES = +(process.env.MAX_STORIES_PER_RUN || 8);
const MAX_PER_CATEGORY = +(process.env.MAX_PER_CATEGORY || 3);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

// ─────────────────────────── 2. DESK ───────────────────────────
async function desk(items, recentTitles) {
  const list = items.map((it, i) => `${i}|${it.outlet}|${it.title}`).join('\n');
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the news desk of an unbiased global news site for curious young readers. You group headlines into real-world EVENTS and judge newsworthiness. Reply with JSON only.`,
    },
    {
      role: 'user',
      content: `Headlines (id|outlet|headline). Headlines may be in different languages.
${list}

ALREADY PUBLISHED in the last 48h (do NOT return these events again unless there is a major new development):
${recentTitles.map((t) => '- ' + t).join('\n') || '- none'}

Task: group headlines that report the SAME specific event (same incident/decision/announcement — not just the same topic).
Rules:
- Only return events where the ids come from AT LEAST 2 DIFFERENT outlets.
- Skip opinion, analysis-only pieces, celebrity gossip, product deals, lifestyle, horoscopes, obituaries of non-public figures, local crime with no wider relevance.
- importance 1-5: 5 = globally significant, affects millions; 3 = notable national/international; 1 = minor.
- category must be one of: ${CATEGORIES.join(', ')}.
- "event" = one neutral English sentence describing what happened.

Return valid raw JSON starting with { and ending with }:
{"events":[{"ids":[1,7,22],"category":"world","importance":4,"event":"..."}]}`,
    },
  ], { temperature: 0.1, maxTokens: 3000 });

  const events = (data.events || [])
    .map((e) => ({ ...e, ids: [...new Set((e.ids || []).map(Number))].filter((i) => items[i]) }))
    .filter((e) => CATEGORIES.includes(e.category))
    .map((e) => ({ ...e, sources: e.ids.map((i) => items[i]), outlets: new Set(e.ids.map((i) => items[i].outlet)).size }))
    .filter((e) => e.outlets >= 2);

  // Rank: importance first, then breadth of coverage. Enforce category diversity.
  events.sort((a, b) => b.importance * 10 + b.outlets - (a.importance * 10 + a.outlets));
  const perCat = {};
  return events.filter((e) => (perCat[e.category] = (perCat[e.category] || 0) + 1) <= MAX_PER_CATEGORY);
}

// ─────────────────────────── 3. REPORTER ───────────────────────────
function sourcePack(sources) {
  return sources
    .map((s, i) => `[S${i + 1}] ${s.outlet} — "${s.title}" (${s.publishedAt})\nURL: ${s.url}\nTEXT: ${s.text || s.summary || '(headline only)'}`)
    .join('\n\n');
}

const ARTICLE_SCHEMA = `{"title":"...","dek":"one-sentence summary, max 30 words","facts":["3-5 short key facts"],"body":["3-6 paragraphs, each 2-4 sentences"],"context":"1-3 sentences of neutral background that helps a young reader understand why this is happening (only from sources)","category":"${CATEGORIES.join('|')}","importance":1}`;

async function reporter(event) {
  const { data, model } = await chatJSON('writer', [
    { role: 'system', content: `You are a reporter for PLAIN., an unbiased news site for curious young people.\n\n${STYLE_GUIDE}\n\nReply with JSON only.` },
    {
      role: 'user',
      content: `EVENT: ${event.event}\n\nSOURCES:\n${sourcePack(event.sources)}\n\nWrite the article in English using ONLY information from the sources. Where outlets frame the event differently, reflect that neutrally with attribution.\nReturn exactly this JSON shape:\n${ARTICLE_SCHEMA}`,
    },
  ], { temperature: 0.3, maxTokens: 5000 });
  return { draft: data, model };
}

// ─────────────────────────── 4. EDITOR ───────────────────────────
async function editor(event, draft) {
  const { data, model } = await chatJSON('editor', [
    {
      role: 'system',
      content: `You are the standards editor of PLAIN. You are strict. You check drafts against the sources and the style guide.\n\n${STYLE_GUIDE}\n\nReply with JSON only.`,
    },
    {
      role: 'user',
      content: `SOURCES:\n${sourcePack(event.sources)}\n\nDRAFT:\n${JSON.stringify(draft, null, 2)}\n\nCheck every sentence:
- Is it supported by the sources? Remove or fix anything unsupported (including invented numbers, quotes, dates).
- Is it neutral and attributed? Fix loaded language, one-sided framing, speculation, filler.
- Is the headline factual, ≤90 chars, no clickbait?
- Is it genuinely informative (not thin or repetitive)?
Verdict:
- "publish" if it is already correct,
- "revise" if fixable — then provide the fully corrected article in "article",
- "reject" if sources are too thin/contradictory to publish responsibly.
Return: {"verdict":"publish|revise|reject","problems":["..."],"article":${ARTICLE_SCHEMA}}`,
    },
  ], { temperature: 0.1, maxTokens: 6000 });
  return { review: data, model };
}

// ─────────────────────────── 5. TRANSLATOR ─────────────────────────── (see lib/translate.mjs)

function validArticle(a) {
  return a && typeof a.title === 'string' && a.title.length > 10 && a.title.length <= 120 && a.dek && Array.isArray(a.body) && a.body.length >= 2 && Array.isArray(a.facts) && a.facts.length >= 2;
}

// ─────────────────────────── MAIN ───────────────────────────
async function main() {
  const state = loadState();
  const index = loadIndex();
  const seen = new Set(state.seenUrls);

  log(`SCOUT  fetching ${FEEDS.length} feeds…`);
  const { items: raw, feedsOk } = await fetchFeeds(FEEDS);
  const items = raw.filter((i) => !seen.has(i.url));
  log(`SCOUT  ${feedsOk}/${FEEDS.length} feeds ok, ${raw.length} items, ${items.length} unseen`);
  if (items.length < 5) return log('Nothing new. Done.');

  const recent = index.articles.filter((a) => Date.now() - Date.parse(a.publishedAt) < 48 * 3600e3);
  const recentTitles = recent.map((a) => a.locales?.[SOURCE_LOCALE]?.title).filter(Boolean);

  // Keep prompt size crisp and reliable: cluster in batches of ~45 items across unseen news
  const sortedItems = items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const batchSize = 45;
  const maxBatches = Math.min(4, Math.ceil(sortedItems.length / batchSize));
  let allEvents = [];
  const publishedTitles = [...recentTitles];

  for (let b = 0; b < maxBatches; b++) {
    const chunk = sortedItems.slice(b * batchSize, (b + 1) * batchSize);
    if (chunk.length < 10) break;
    log(`DESK   clustering batch ${b + 1}/${maxBatches} (${chunk.length} headlines)…`);
    try {
      const found = await desk(chunk, publishedTitles);
      for (const ev of found) {
        if (!allEvents.some((existing) => existing.event.toLowerCase() === ev.event.toLowerCase())) {
          allEvents.push(ev);
          publishedTitles.push(ev.event);
        }
      }
    } catch (err) {
      log(`DESK   batch ${b + 1} error: ${err.message}`);
    }
    if (allEvents.length >= MAX_STORIES * 2) break;
  }

  allEvents.sort((a, b) => b.importance * 10 + b.outlets - (a.importance * 10 + a.outlets));
  const perCat = {};
  const events = allEvents
    .filter((e) => (perCat[e.category] = (perCat[e.category] || 0) + 1) <= MAX_PER_CATEGORY)
    .slice(0, MAX_STORIES);
  log(`DESK   ${events.length} events selected across categories`);

  const published = [];
  for (const event of events) {
    log(`\n▶ ${event.category.toUpperCase()} [${event.importance}] ${event.event} (${event.outlets} outlets)`);
    try {
      // Read up to 5 sources in full (one per outlet preferred).
      const byOutlet = new Map();
      for (const s of event.sources) if (!byOutlet.has(s.outlet)) byOutlet.set(s.outlet, s);
      const reading = [...byOutlet.values(), ...event.sources.filter((s) => ![...byOutlet.values()].includes(s))].slice(0, 5);
      await pool(reading, 5, async (s) => {
        const details = await fetchArticleDetails(s.url);
        s.text = details.text;
        s.image = details.image;
        s.video = details.video;
      });
      event.sources = reading;
      const media = curateMedia(event.sources);
      const heroImage = media.image;
      const heroVideo = media.video;
      log(`  REPORTER reading ${reading.length} sources (${reading.filter((s) => s.text).length} with text, hero image: ${heroImage ? 'found' : 'none'}, video: ${heroVideo ? heroVideo.type : 'none'})`);

      let { draft, model: writerModel } = await reporter(event);
      if (!validArticle(draft)) throw new Error('draft invalid');

      let { review, model: editorModel } = await editor(event, draft);
      log(`  EDITOR  ${review.verdict}${review.problems?.length ? ' — ' + review.problems.slice(0, 3).join(' | ') : ''}`);
      if (review.verdict === 'reject') continue;
      let final = review.verdict === 'revise' && validArticle(review.article) ? review.article : draft;

      // Hard anti-slop gate: one more editor pass if banned phrases survived.
      if (slopHits(final).length) {
        log(`  SLOP   ${slopHits(final).join(', ')} → second edit`);
        ({ review } = await editor(event, final));
        if (validArticle(review.article)) final = review.article;
        if (slopHits(final).length) { log('  SLOP   still present → dropped'); continue; }
      }

      const category = CATEGORIES.includes(final.category) ? final.category : event.category;
      const now = new Date();
      const article = {
        slug: slugify(final.title, now),
        category,
        image: heroImage,
        video: heroVideo || null,
        importance: Math.min(5, Math.max(1, +final.importance || event.importance || 3)),
        publishedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        sources: event.sources.map(({ outlet, title, url, publishedAt }) => ({ outlet, title, url, publishedAt })),
        locales: { [SOURCE_LOCALE]: { title: final.title, dek: final.dek, facts: final.facts, body: final.body, context: final.context || '' } },
        meta: { writer: writerModel, editor: editorModel, verdict: review.verdict, problemsFixed: review.problems || [] },
      };

      const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
      log(`  TRANSLATOR → ${targets.join(', ')}`);
      const translations = await pool(targets, 4, (l) => translate(article.locales[SOURCE_LOCALE], l));
      targets.forEach((l, i) => {
        if (translations[i] && !translations[i].error) article.locales[l] = translations[i];
        else log(`    ✗ ${l}: ${translations[i]?.error?.message}`);
      });

      saveArticle(article);
      index.articles.unshift(toIndexEntry(article));
      saveIndex(index);
      published.push(article.slug);
      log(`  ✓ PUBLISHED ${article.slug} (${Object.keys(article.locales).length} languages)`);
    } catch (e) {
      log(`  ✗ failed: ${e.message}`);
    } finally {
      event.sources.forEach((s) => seen.add(s.url));
    }
  }

  state.seenUrls = [...seen].slice(-6000);
  state.runs = [{ at: new Date().toISOString(), feedsOk, items: items.length, events: events.length, published: published.length }, ...(state.runs || [])].slice(0, 50);
  saveState(state);
  log(`\nDone. Published ${published.length} stories.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
