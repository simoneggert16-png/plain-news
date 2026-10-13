#!/usr/bin/env node
// PLAIN. NEWSROOM — runs on a schedule (GitHub Actions). Pipeline:
//   1. SCOUT      fetch ~40 diverse RSS feeds
//   2. DESK       cluster headlines into events; keep only events covered by ≥2 different outlets
//   3. REPORTER   read the source articles, write a neutral draft (facts only)
//   4. EDITOR     separate model fact-checks the draft against sources → publish / revise / reject
//   5. TRANSLATOR translate into all site languages
//   6. PUBLISH    write JSON → git commit → Vercel redeploys
import fs from 'node:fs';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

import { FEEDS } from './sources.mjs';
import { fetchFeeds, fetchArticleDetails } from './lib/feeds.mjs';
import { chatJSON } from './lib/llm.mjs';
import { STYLE_GUIDE, slopHits } from './lib/style.mjs';
import { translate } from './lib/translate.mjs';
import { loadIndex, saveIndex, loadState, saveState, saveArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { CATEGORIES, LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';
import { curateMedia } from './lib/media.mjs';
import { verifyAndCaptionImage } from './lib/vision.mjs';

const MAX_STORIES = +(process.env.MAX_STORIES_PER_RUN || 9);
const MAX_PER_CATEGORY = +(process.env.MAX_PER_CATEGORY || 1);
const log = (...a) => {
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);
};

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

// ─────────────────────────── 2. DESK ───────────────────────────
// ─────────────────────────── DEDUPLICATION ENGINE ───────────────────────────
const STOP_WORDS = new Set(['this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'first', 'report', 'study', 'finds', 'announces', 'amid', 'during', 'could']);

export function isDuplicateStory(candidateText, existingTitles = []) {
  if (!candidateText || !existingTitles.length) return { isDup: false };
  const getKeywords = (str) => {
    return new Set(
      str.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    );
  };
  const candWords = getKeywords(candidateText);
  if (candWords.size === 0) return { isDup: false };

  for (const existing of existingTitles) {
    const existWords = getKeywords(existing);
    let matchCount = 0;
    for (const w of candWords) {
      if (existWords.has(w)) matchCount++;
    }
    const overlap = matchCount / Math.min(candWords.size, existWords.size);
    if ((matchCount >= 3 && overlap >= 0.45) || (matchCount >= 2 && overlap >= 0.65)) {
      return { isDup: true, matchCount, overlap, matchingTitle: existing };
    }
  }
  return { isDup: false };
}

// ─────────────────────────── 2. DESK ───────────────────────────
async function desk(items, recentTitles, neededCategories = []) {
  const list = items.map((it, i) => `${i}|${it.outlet}|${it.title}`).join('\n');
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the news desk editor of an unbiased global news site. You group headlines into real-world EVENTS.
IMPORTANT: Do NOT output thinking, analysis or preamble. Output ONLY a valid JSON object starting with { and ending with }.`,
    },
    {
      role: 'user',
      content: `Headlines (id|outlet|headline):
${list}

ALREADY PUBLISHED ARCHIVE (DO NOT REPEAT ANY OF THESE STORIES):
${recentTitles.slice(0, 150).map((t) => '- ' + t).join('\n') || '- none'}

CRITICAL DEDUPLICATION RULE:
- NEVER output an event that was already published above.
- If a story was covered in the archive above (e.g. Nobel Prize, past elections, previous strikes), IT IS FORBIDDEN to report it again unless there is a dramatic, game-changing NEW development.
- Otherwise, strictly choose 100% FRESH events that have not been published yet.
${neededCategories.length ? `\nPRIORITY DESKS: We are actively building depth in these categories: ${neededCategories.join(', ')}. Prioritize events matching these topics.` : ''}

Task: Identify real-world events.
SOURCE RULES:
- Primary/Authoritative Source Rule: A story can be covered with 1 SINGLE authoritative source IF that source is an official company press release, scientific institute/journal (Nature, ScienceDaily, Phys.org), government agency (CDC, WHO, NASA), or premier broadcaster/wire (Reuters, BBC, AP, CNBC, Wall Street Journal).
- Secondary/General Rule: If the source is not a primary authority, require AT LEAST 2 DIFFERENT outlets.
- NEVER accept random blogs, unverified speculation, gossip, lifestyle, or sponsored posts.
- Importance: 1 (minor) to 5 (major global impact).
- Category must be one of: ${CATEGORIES.filter((c) => c !== 'community').join(', ')}.
- "event": One objective English sentence stating what occurred.

Format response strictly as JSON:
{"events":[{"ids":[0, 14],"category":"world","importance":4,"event":"..."}]}`,
    },
  ], { temperature: 0.1, maxTokens: 12000 });

  const events = (data.events || [])
    .map((e) => ({ ...e, ids: [...new Set((e.ids || []).map(Number))].filter((i) => items[i]) }))
    .filter((e) => CATEGORIES.includes(e.category))
    .filter((e) => {
      // Programmatic semantic deduplication gate
      const dup = isDuplicateStory(e.event, recentTitles);
      if (dup.isDup) {
        log(`DESK   dropping duplicate event: "${e.event.slice(0, 50)}…" matches existing "${dup.matchingTitle.slice(0, 50)}…"`);
        return false;
      }
      return true;
    })
    .map((e) => ({ ...e, sources: e.ids.map((i) => items[i]), outlets: new Set(e.ids.map((i) => items[i].outlet)).size }))
    .filter((e) => {
      if (e.outlets >= 2) return true;
      // Single authoritative primary sources permitted
      const singleOutlet = e.sources[0]?.outlet || '';
      const isAuthoritative = /Nature|ScienceDaily|Phys\.org|InsideClimate News|Mongabay|Medical News Today|STAT News|CNBC|Wall Street Journal|Ars Technica|TechCrunch|The Verge|Wired|BBC|NPR|DW|France 24|Tagesschau|UN News/i.test(singleOutlet);
      return isAuthoritative && e.sources.length >= 1;
    });

  // Rank: priority desk boost first, then importance, then breadth of coverage.
  events.sort((a, b) => {
    const aNeeded = neededCategories.includes(a.category) ? 50 : 0;
    const bNeeded = neededCategories.includes(b.category) ? 50 : 0;
    return (bNeeded + b.importance * 10 + b.outlets) - (aNeeded + a.importance * 10 + a.outlets);
  });
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

import { AGENT_DESKS } from './lib/desks.mjs';

async function reporter(event) {
  const desk = AGENT_DESKS[event.category] || AGENT_DESKS.world;
  const systemPrompt = `${desk.systemPrompt}\n\nDesk: ${desk.name} (Focus: ${desk.focus})\n\n${STYLE_GUIDE}\n\nReply with JSON only.`;
  const { data, model } = await chatJSON('writer', [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `EVENT: ${event.event}\n\nCATEGORY: ${event.category}\n\nSOURCES:\n${sourcePack(event.sources)}\n\nWrite the article in English using ONLY information from the sources. Where outlets frame the event differently, reflect that neutrally with attribution.\nReturn exactly this JSON shape:\n${ARTICLE_SCHEMA}`,
    },
  ], { temperature: 0.3, maxTokens: 10000 });
  return { draft: data, model, desk: desk.name };
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
  ], { temperature: 0.1, maxTokens: 10000 });
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

  // Full archive deduplication: check against all published articles (up to 200)
  const recentTitles = index.articles.map((a) => a.locales?.[SOURCE_LOCALE]?.title || a.title).filter(Boolean);

  const categoryCounts = {};
  for (const c of CATEGORIES) categoryCounts[c] = 0;
  for (const a of index.articles) {
    if (categoryCounts[a.category] !== undefined) categoryCounts[a.category]++;
  }
  const TARGET_PER_CAT = +(process.env.TARGET_PER_CATEGORY || 25);
  const neededCategories = CATEGORIES.filter((c) => (categoryCounts[c] || 0) < TARGET_PER_CAT);
  log(`DESK   category counts: ${Object.entries(categoryCounts).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  if (neededCategories.length) {
    log(`DESK   prioritizing under-target categories (<${TARGET_PER_CAT}): ${neededCategories.join(', ')}`);
  }

  // Sort items so topic-related stories from different outlets appear in the same chunk
  const PRIORITY_KEYWORDS = {
    science: /nobel|space|telescope|physics|biology|nasa|esa|genome|dna|discovery|satellite/i,
    climate: /climate|warming|cop|cop\d+|emissions|carbon|renewable|solar|wind|glacier|drought|wildfire/i,
    culture: /culture|film|movie|theatre|theater|museum|art|exhibition|author|book|novel|award|oscars/i,
    health: /health|who|cdc|virus|vaccine|disease|hospital|plague|epidemic|cancer|clinical/i,
    business: /market|stock|inflation|rate|central bank|fed|ecb|acquisition|merger|gdp|economy|earnings/i,
  };

  const prioritized = [];
  const others = [];
  for (const it of items) {
    const text = `${it.title} ${it.summary || ''}`;
    const matchesPriority = neededCategories.some((c) => PRIORITY_KEYWORDS[c]?.test(text));
    if (matchesPriority) prioritized.push(it);
    else others.push(it);
  }

  const sortedItems = [...prioritized, ...others];
  const batchSize = 45;
  const maxBatches = Math.min(4, Math.ceil(sortedItems.length / batchSize));
  let allEvents = [];
  const publishedTitles = [...recentTitles];

  for (let b = 0; b < maxBatches; b++) {
    const chunk = sortedItems.slice(b * batchSize, (b + 1) * batchSize);
    if (chunk.length < 5) break;
    log(`DESK   clustering batch ${b + 1}/${maxBatches} (${chunk.length} headlines)…`);
    try {
      const found = await desk(chunk, publishedTitles, neededCategories);
      for (const ev of found) {
        if (!allEvents.some((existing) => existing.event.toLowerCase() === ev.event.toLowerCase())) {
          allEvents.push(ev);
          publishedTitles.push(ev.event);
        }
      }
    } catch (err) {
      log(`DESK   batch ${b + 1} error: ${err?.message || err}`);
    }
    if (allEvents.length >= MAX_STORIES * 2) break;
  }

  allEvents.sort((a, b) => {
    // Sort by importance and source depth
    return (b.importance * 10 + b.outlets) - (a.importance * 10 + a.outlets);
  });
  const perCat = {};
  const events = allEvents
    .filter((e) => {
      return (perCat[e.category] = (perCat[e.category] || 0) + 1) <= MAX_PER_CATEGORY;
    })
    .slice(0, MAX_STORIES);
  log(`DESK   ${events.length} events selected across categories (${Object.keys(perCat).join(', ')})`);

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
        s.imageCaption = details.imageCaption;
        s.imageCredit = details.imageCredit;
        s.video = details.video;
      });
      event.sources = reading;
      const media = curateMedia(event.sources);
      const heroImage = media.image;
      const heroVideo = media.video;
      log(`  REPORTER reading ${reading.length} sources (${reading.filter((s) => s.text).length} with text, hero image: ${heroImage ? 'found' : 'none'}, video: ${heroVideo ? heroVideo.type : 'none'})`);

      let { draft, model: writerModel, desk: deskName } = await reporter(event);
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

      // Final programmatic semantic duplicate check against full archive
      const dupFinal = isDuplicateStory(final.title, recentTitles);
      if (dupFinal.isDup) {
        log(`  DEDUP  final title matches existing story: "${dupFinal.matchingTitle}" → dropped`);
        continue;
      }

      const category = CATEGORIES.includes(final.category) ? final.category : event.category;
      const now = new Date();

      // Multimodal double-check & captioning
      let imageCaption = null;
      let imageCaptionDe = null;
      let imageCredit = null;
      let verifiedImage = heroImage;
      if (heroImage) {
        log(`  VISION double-checking image & generating caption…`);
        const vResult = await verifyAndCaptionImage(heroImage, {
          category,
          title: final.title,
          facts: final.facts,
          sources: event.sources,
          sourceCaption: media.caption,
          sourceCredit: media.credit,
        }).catch(() => null);

        if (vResult?.verified === true) {
          imageCaption = vResult.caption?.en || media.caption || final.title;
          imageCaptionDe = vResult.caption?.de || null;
          imageCredit = vResult.credit || media.credit || event.sources[0]?.outlet || null;
          log(`  VISION verified: "${imageCaption.slice(0, 60)}…" (Credit: ${imageCredit})`);
        } else {
          log(`  VISION rejected or unverified image; removing.`);
          verifiedImage = null;
        }
      }

      const article = {
        slug: slugify(final.title, now),
        category,
        image: verifiedImage,
        imageCredit: imageCredit || null,
        video: heroVideo || null,
        importance: Math.min(5, Math.max(1, +final.importance || event.importance || 3)),
        publishedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        sources: event.sources.map(({ outlet, title, url, publishedAt }) => ({ outlet, title, url, publishedAt })),
        locales: {
          [SOURCE_LOCALE]: {
            title: final.title,
            dek: final.dek,
            facts: final.facts,
            body: final.body,
            context: final.context || '',
            imageCaption: imageCaption || '',
          },
        },
        meta: { writer: writerModel, editor: editorModel, desk: deskName, verdict: review.verdict, problemsFixed: review.problems || [] },
      };

      const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
      log(`  TRANSLATOR → ${targets.join(', ')}`);
      const translations = await pool(targets, 4, (l) => translate(article.locales[SOURCE_LOCALE], l));
      targets.forEach((l, i) => {
        if (translations[i] && !translations[i].error) {
          article.locales[l] = translations[i];
          if (l === 'de' && imageCaptionDe) {
            article.locales['de'].imageCaption = imageCaptionDe;
          }
        } else {
          log(`    ✗ ${l}: ${translations[i]?.error?.message}`);
        }
      });

      saveArticle(article);
      index.articles.unshift(toIndexEntry(article));
      saveIndex(index);
      published.push(article.slug);
      categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
      log(`  ✓ PUBLISHED ${article.slug} (${Object.keys(article.locales).length} langs) [${article.category.toUpperCase()}: ${categoryCounts[article.category]}/${TARGET_PER_CAT}]`);

      // Push immediately to production so users never wait for batch end
      try {
        const { execSync } = await import('node:child_process');
        execSync(`git add content/ && git commit -m "newsroom: live [${article.category.toUpperCase()}] ${article.slug.slice(0, 45)}" && git push origin main`, { stdio: 'pipe', timeout: 45000 });
        log(`  🚀 PUSHED TO ORIGIN MAIN → live on plain-news.ch`);
      } catch (pushErr) {
        log(`  push notice: ${pushErr.message?.slice(0, 80)}`);
      }
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
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
