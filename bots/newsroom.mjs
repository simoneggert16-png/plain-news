#!/usr/bin/env node
// PLAIN. NEWSROOM — runs on a schedule (GitHub Actions). Pipeline:
//   1. SCOUT      fetch diverse RSS feeds
//   2. DESK       cluster headlines into events; keep only events with 2 outlets
//                 (or 1 official primary source)
//   3. REPORTER   read the source articles, write a neutral draft (facts only)
//   4. EDITOR     separate model fact-checks the draft against sources → publish / revise / reject
//   5. TRANSLATOR translate into all site languages
//   6. PUBLISH    write JSON → git commit → Vercel redeploys
//
// Cadence: run hourly and publish every qualifying story found within the
// discovery and runtime budgets. Never invent filler: only publish verified events.
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
import { loadIndex, saveIndex, loadState, saveState, saveArticle, loadArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { CATEGORIES, LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';
import { curateMedia } from './lib/media.mjs';
import { verifyAndCaptionImage } from './lib/vision.mjs';
import { classifySources, normalizeDraft, isPublishableArticle, importanceFromCoverage, freshestAgeHours, distinctOutlets, isDuplicateStory } from '../lib/editorial.mjs';
import { watchScore, isLiveWorthy } from '../lib/watchlist.mjs';

const configuredLimit = (name, fallback = Infinity) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const MAX_STORIES = configuredLimit('MAX_STORIES_PER_RUN');
const MAX_PER_CATEGORY = configuredLimit('MAX_PER_CATEGORY');
const MIN_PER_CATEGORY_PER_CYCLE = Math.max(1, +(process.env.MIN_PER_CATEGORY_PER_CYCLE || 1));
// One newsroom cycle covers the last RECENT_WINDOW_HOURS, so the per-category
// target is per cycle (not per hour).
const RECENT_WINDOW_HOURS = +(process.env.RECENT_WINDOW_HOURS || 1);
const TARGET_PER_CATEGORY_PER_CYCLE = configuredLimit(
  'TARGET_PER_CATEGORY_PER_CYCLE',
  configuredLimit('TARGET_PER_CATEGORY_PER_HOUR')
);
const EVENT_CONCURRENCY = Math.max(1, +(process.env.EVENT_CONCURRENCY || 4));
const TRANSLATION_CONCURRENCY = Math.max(1, +(process.env.TRANSLATION_CONCURRENCY || 8));
const MAX_ARTICLES_PER_DAY = configuredLimit('MAX_ARTICLES_PER_DAY');
const RUN_BUDGET_MS = Math.max(1, +(process.env.RUN_BUDGET_MINUTES || 100)) * 60e3;
const RUN_STARTED = Date.now();
const timeLeft = () => RUN_BUDGET_MS - (Date.now() - RUN_STARTED);
const log = (...a) => {
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${a.join(' ')}\n`);
};

async function pool(items, n, fn) {
  const out = new Array(items.length).fill(null);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      // fn may return null on purpose (time budget exhausted). Calling
      // .catch() on that null crashed whole cycles and threw away every
      // story they had already written.
      try {
        out[k] = await fn(items[k], k);
      } catch (e) {
        out[k] = { error: e };
      }
    }
  }));
  return out;
}

// ─────────────────────────── 2. DESK ───────────────────────────
// Duplicate detection lives in lib/editorial.mjs so the live ticker uses the
// exact same rule. Re-exported for older imports/tests.
export { isDuplicateStory };

// ─────────────────────────── TRANSLATION BACKFILL ───────────────────────────
// A translation call can fail (rate limit, timeout, malformed JSON). The
// article is already published at that point, so the German site silently fell
// back to English - 28 of 817 articles were English-only after one bad batch.
// Retry a few of those at the start of every cycle.
async function backfillTranslations(index, limit = 8) {
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
  // German first: /de is the edition readers actually see. Other languages are
  // filled afterwards by the same pool or by the translations workflow.
  const ordered = ['de', ...targets.filter((c) => c !== 'de')];
  const missing = index.articles
    .filter((e) => targets.some((c) => !e.locales?.[c]?.title))
    .slice(0, limit);
  if (!missing.length) return 0;
  const tasks = ordered.flatMap((locale) =>
    missing.filter((e) => !e.locales?.[locale]?.title).map((entry) => ({ entry, locale }))
  );
  // One cycle can only afford a slice - the German jobs sit at the front.
  const budget = Number(process.env.BACKFILL_MAX_JOBS || 24);
  const batch = Number.isFinite(budget) ? tasks.slice(0, budget) : tasks;
  let done = 0;
  await pool(batch, TRANSLATION_CONCURRENCY, async ({ entry, locale }) => {
    const article = loadArticle(entry.slug);
    if (!article) return;
    try {
      const t = await translate(article.locales[SOURCE_LOCALE], locale);
      if (!t?.title) return;
      article.locales[locale] = t;
      saveArticle(article);
      const i = index.articles.findIndex((x) => x.slug === entry.slug);
      if (i >= 0) index.articles[i] = toIndexEntry(article);
      done++;
    } catch (err) {
      log(`TRANSLATOR backfill ${entry.slug}/${locale}: ${err?.message || err}`);
    }
  });
  if (done) saveIndex(index);
  log(`TRANSLATOR backfill: ${done} of ${batch.length} queued (${tasks.length} missing) translation(s) fixed`);
  return done;
}

async function desk(items, recentTitles, priorityCategories = [], groups = []) {
  const list = groups.length
    ? groups.map((g, gi) => `# candidate event ${gi + 1}\n` + g.map((i) => `${i}|${items[i].outlet}|${items[i].title}`).join('\n')).join('\n\n')
    : items.map((it, i) => `${i}|${it.outlet}|${it.title}`).join('\n');
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the news desk editor of an unbiased global news site. You group headlines into real-world EVENTS.
IMPORTANT: Do NOT output thinking, analysis or preamble. Output ONLY a valid JSON object starting with { and ending with }.`,
    },
    {
      role: 'user',
      content: `Headlines (id|outlet|headline). Lines under a "# candidate event" heading were pre-grouped by keyword overlap; they MIGHT describe the same event. Verify with your own judgement, and merge or split candidate groups freely.
${list}

ALREADY PUBLISHED ARCHIVE (DO NOT REPEAT ANY OF THESE STORIES):
${recentTitles.slice(0, 120).map((t) => '- ' + t).join('\n') || '- none'}

DEDUPLICATION RULE:
- Do not repeat an event that was already published above.
- A clearly NEW development (new death toll, new vote, new ruling, new strike) is allowed; a repeat of the same announcement is not.
- Elections count as major events: a result, a concession, a certified outcome or a coalition deal is a new development even if the campaign was covered before. Never drop an election event just because an older campaign story exists.
- Otherwise choose 100% FRESH events.

${priorityCategories.length ? `PRIORITY DESKS (we are short in these categories this hour): ${priorityCategories.join(', ')}. Prefer these when the event is important enough.` : ''}

Task: Identify real-world events and return ${Number.isFinite(MAX_PER_CATEGORY) ? `up to ${MAX_PER_CATEGORY}` : 'all relevant'} events per category.

SOURCE RULES:
- Two-source rule: a story normally needs at least 2 DIFFERENT outlets covering the same event.
- Exception 1: 1 official primary source is allowed (government, ministry, court, international organisation, scientific journal, company press release). BBC, Reuters, AP, CNBC, newspapers and other news outlets are NOT primary sources.
- Exception 2: constructive-journalism outlets (Good News Network, Positive News, Reasons to Be Cheerful, The Optimist Daily) may be used as a SINGLE source — their stories are original reporting nobody else picks up. Prefer them for the positive mix.
- If an event appears in only one non-primary outlet, do NOT output it.
- NEVER accept random blogs, unverified speculation, gossip, lifestyle, or sponsored posts.
- Importance: 1 (minor) to 5 (major global impact).
- Category must be one of: ${CATEGORIES.filter((c) => c !== 'community').join(', ')}.
- "event": One objective English sentence stating what occurred.

POSITIVE MIX:
- Roughly one in five events should be constructive: scientific or medical breakthroughs, conservation and climate wins, recoveries, community solutions, sport stories about people rather than transfers, culture that is not celebrity gossip.
- It must be a real, verifiable event — never a puff piece, listicle or "inspiring" quote. Label it with "positive": true.

Format response strictly as JSON:
{"events":[{"ids":[0, 14],"category":"world","importance":4,"event":"..."}]}`,
    },
  ], { temperature: 0.1, maxTokens: 12000 });

  const events = (data.events || [])
    .map((e) => ({ ...e, ids: [...new Set((e.ids || []).map(Number))].filter((i) => items[i]) }))
    .filter((e) => CATEGORIES.includes(e.category) && e.category !== 'community')
    .map((e) => {
      const sources = e.ids.map((i) => items[i]);
      const policy = classifySources(sources);
      const positive = Boolean(e.positive) || (sources.length > 0 && sources.every((s) => s.positive));
      const text = `${e.event} ${sources.map((s) => s.title).join(' ')}`;
      const watch = Math.max(watchScore(text), ...sources.map((s) => s.watch || 0));
      const outlets = policy.outlets.length;
      const importance = Math.max(
        Number.isFinite(+e.importance) ? +e.importance : 1,
        importanceFromCoverage({ outlets, ageHours: freshestAgeHours(sources), watch, category: e.category })
      );
      return { ...e, positive, sources, outlets, sourcePolicy: policy.policy, policyOk: policy.ok, watch, importance };
    })
    .filter((e) => e.policyOk)
    .filter((e) => {
      // Programmatic semantic deduplication gate
      const dup = isDuplicateStory(e.event, recentTitles);
      if (dup.isDup) {
        log(`DESK   dropping duplicate event: "${e.event.slice(0, 50)}…" matches existing "${dup.matchingTitle.slice(0, 50)}…"`);
        return false;
      }
      return true;
    });

  // Rank: watchlist first, then importance, then breadth of coverage. Filling an
  // empty category and constructive stories are tiebreakers — they must never
  // outrank a major story.
  events.sort((a, b) => {
    const aNeeded = priorityCategories.includes(a.category) ? 5 : 0;
    const bNeeded = priorityCategories.includes(b.category) ? 5 : 0;
    return (b.watch * 1000 + b.importance * 20 + b.outlets + bNeeded + (b.positive ? 8 : 0))
         - (a.watch * 1000 + a.importance * 20 + a.outlets + aNeeded + (a.positive ? 8 : 0));
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

const ARTICLE_SCHEMA = `{"title":"...","dek":"one-sentence summary, max 30 words","facts":["3-5 short key facts"],"body":["3-6 paragraphs, each 2-4 sentences"],"context":"1-3 sentences of neutral background that helps a young reader understand why this is happening (only from sources)","category":"${CATEGORIES.join('|')}","importance":3}`;

import { AGENT_DESKS } from './lib/desks.mjs';

async function reporter(event, strict = false) {
  const desk = AGENT_DESKS[event.category] || AGENT_DESKS.world;
  const systemPrompt = `${desk.systemPrompt}\n\nDesk: ${desk.name} (Focus: ${desk.focus})\n\n${STYLE_GUIDE}\n\nReply with JSON only.`;
  const { data, model } = await chatJSON('writer', [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `EVENT: ${event.event}\n\nCATEGORY: ${event.category}\n\nSOURCES:\n${sourcePack(event.sources)}\n\nWrite the article in English using ONLY information from the sources. Where outlets frame the event differently, reflect that neutrally with attribution.\nReturn exactly this JSON shape:\n${ARTICLE_SCHEMA}${strict ? '\n\nIMPORTANT: Your previous reply was invalid. Return valid JSON only. "body" and "facts" MUST be arrays of strings. Do not wrap the JSON in markdown.' : ''}`,
    },
  ], { temperature: strict ? 0.2 : 0.3, maxTokens: 12000 });
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
  ], { temperature: 0.1, maxTokens: 12000 });
  return { review: data, model };
}

// ─────────────────────────── 5. TRANSLATOR ─────────────────────────── (see lib/translate.mjs)

function validArticle(a) {
  return a && typeof a.title === 'string' && a.title.length > 10 && a.title.length <= 120 && a.dek && Array.isArray(a.body) && a.body.length >= 2 && Array.isArray(a.facts) && a.facts.length >= 2;
}

// ─────────────────────────── PROCESS ONE EVENT ───────────────────────────
async function processEvent(event, recentTitles, seen) {
  const allSources = [...event.sources];
  try {
    log(`\n▶ ${event.category.toUpperCase()} [${event.importance}] ${event.event} (${event.outlets} outlets, ${event.sourcePolicy})`);
    // Read up to 5 sources in full (one per outlet preferred, direct feeds
    // before Google News redirects, which often have no readable text).
    const preferred = [...event.sources].sort((a, b) => (a.aggregator ? 1 : 0) - (b.aggregator ? 1 : 0));
    const byOutlet = new Map();
    for (const s of preferred) if (!byOutlet.has(s.outlet)) byOutlet.set(s.outlet, s);
    const unique = [...byOutlet.values()];
    const reading = [...unique, ...preferred.filter((s) => !unique.includes(s))].slice(0, 5);
    await pool(reading, 5, async (s) => {
      const details = await fetchArticleDetails(s.url);
      s.text = details.text;
      s.image = details.image;
      s.imageCaption = details.imageCaption;
      s.imageCredit = details.imageCredit;
      s.video = details.video;
    });
    event.sources = reading;

    const policy = classifySources(event.sources);
    if (!policy.ok) {
      log(`  POLICY  insufficient sources after reading (${policy.outlets.join(', ') || 'none'}) → dropped`);
      return null;
    }

    const media = curateMedia(event.sources);
    const heroImage = media.image;
    const heroVideo = media.video;
    log(`  REPORTER reading ${reading.length} sources (${reading.filter((s) => s.text).length} with text, hero image: ${heroImage ? 'found' : 'none'}, video: ${heroVideo ? heroVideo.type : 'none'})`);

    let writer = await reporter(event);
    let draft = normalizeDraft(writer.draft);
    if (!validArticle(draft)) {
      log(`  REPORTER invalid draft (title:${typeof draft?.title}, body:${Array.isArray(draft?.body) ? draft.body.length : typeof draft?.body}, facts:${Array.isArray(draft?.facts) ? draft.facts.length : typeof draft?.facts}) → retry`);
      writer = await reporter(event, true);
      draft = normalizeDraft(writer.draft);
    }
    if (!validArticle(draft)) throw new Error('draft invalid after retry');
    const writerModel = writer.model;
    const deskName = writer.desk;

    let { review, model: editorModel } = await editor(event, draft);
    log(`  EDITOR  ${review.verdict}${review.problems?.length ? ' — ' + review.problems.slice(0, 3).join(' | ') : ''}`);
    if (review.verdict === 'reject') return null;
    let final = review.verdict === 'revise' && validArticle(normalizeDraft(review.article)) ? normalizeDraft(review.article) : draft;

    // Hard anti-slop gate: one more editor pass if banned phrases survived.
    if (slopHits(final).length) {
      log(`  SLOP   ${slopHits(final).join(', ')} → second edit`);
      ({ review } = await editor(event, final));
      if (validArticle(normalizeDraft(review.article))) final = normalizeDraft(review.article);
      if (slopHits(final).length) { log('  SLOP   still present → dropped'); return null; }
    }

    // Final programmatic semantic duplicate check against the archive.
    const dupFinal = isDuplicateStory(final.title, recentTitles);
    if (dupFinal.isDup) {
      log(`  DEDUP  final title matches existing story: "${dupFinal.matchingTitle}" → dropped`);
      return null;
    }

    const category = CATEGORIES.includes(final.category) ? final.category : event.category;
    const now = new Date();

    // Observable importance beats the writer's self-assessment: the model
    // returned 1 for every single story, which killed ranking and EILMELDUNG.
    const computedImportance = importanceFromCoverage({
      outlets: policy.outlets.length,
      ageHours: freshestAgeHours(event.sources),
      watch: event.watch || watchScore(`${event.event} ${final.title}`),
      category,
    });
    const importance = Math.max(computedImportance, Math.min(5, +final.importance || 0));

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
      } else if (vResult?.verified === false) {
        log(`  VISION rejected image: ${vResult.rejectionReason || 'not usable'}; removing.`);
        verifiedImage = null;
      } else {
        // No usable verdict (provider down, quota, timeout, unsure model). The
        // photo already cleared the technical gate, so keep it with the wire's
        // own caption and credit instead of discarding every image of the run.
        imageCaption = media.caption || '';
        imageCaptionDe = null;
        imageCredit = media.credit || event.sources[0]?.outlet || null;
        log(`  VISION no verdict (${vResult?.reason || 'none'}); keeping image with wire caption.`);
      }
    }

    return {
      slug: slugify(final.title, now),
      category,
      image: verifiedImage,
      imageCredit: imageCredit || null,
      video: heroVideo || null,
      importance: Math.min(5, Math.max(1, +event.importance || importance || +final.importance || 3)),
      publishedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      sourcePolicy: policy.policy,
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
  } catch (e) {
    log(`  ✗ failed: ${e.message}`);
    return null;
  } finally {
    allSources.forEach((s) => { if (s?.url) seen.add(s.url); });
  }
}

// ─────────────────────────── MAIN ───────────────────────────
async function main() {
  const state = loadState();
  const index = loadIndex();
  const seen = new Set(state.seenUrls);

  // Fix articles that were published while a translation call was failing.
  if (timeLeft() > 8 * 60e3) {
    await backfillTranslations(index, 8).catch((err) => log(`TRANSLATOR backfill error: ${err?.message || err}`));
  }

  // Daily budget guard: protects the LLM quota and the Vercel build limit.
  const dayAgo = Date.now() - 864e5;
  const publishedToday = index.articles.filter((a) => Date.parse(a.publishedAt) >= dayAgo).length;
  if (publishedToday >= MAX_ARTICLES_PER_DAY) {
    log(`BUDGET daily cap reached (${publishedToday}/${MAX_ARTICLES_PER_DAY} in 24h). Done.`);
    return;
  }

  log(`SCOUT  fetching ${FEEDS.length} feeds…`);
  const { items: raw, feedsOk } = await fetchFeeds(FEEDS, {
    maxAgeHours: +(process.env.MAX_AGE_HOURS || 12),
    perFeed: +(process.env.PER_FEED || 25),
  });
  // Tag every headline before anything is filtered or clustered: watchlist
  // weight (0-3) and whether it looks like rolling live coverage.
  for (const it of raw) {
    const text = `${it.title} ${it.summary || ''}`;
    it.watch = watchScore(text);
    it.liveWorthy = isLiveWorthy(text);
    it.isLive = !!(it.isLive || it.liveWorthy);
  }
  const items = raw.filter((i) => !seen.has(i.url));
  log(`SCOUT  ${feedsOk}/${FEEDS.length} feeds ok, ${raw.length} items, ${items.length} unseen (${items.filter((i) => i.isLive).length} live, ${items.filter((i) => i.watch >= 2).length} watchlist)`);
  if (!items.length) return log('Nothing new. Done.');

  // Deduplicate against the last 14 days (full archive is only ~140 stories, but
  // old titles caused false positives on recurring topics).
  const archiveCutoff = Date.now() - 14 * 864e5;
  const recentTitles = index.articles
    .filter((a) => Date.parse(a.publishedAt) >= archiveCutoff)
    .map((a) => a.locales?.[SOURCE_LOCALE]?.title || a.title)
    .filter(Boolean);
  const dedupTitles = recentTitles.length >= 20 ? recentTitles : index.articles.map((a) => a.locales?.[SOURCE_LOCALE]?.title || a.title).filter(Boolean);

  const categoryCounts = {};
  const publishedInWindow = {};
  for (const c of CATEGORIES) { categoryCounts[c] = 0; publishedInWindow[c] = 0; }
  const windowStart = Date.now() - RECENT_WINDOW_HOURS * 3600e3;
  for (const a of index.articles) {
    if (categoryCounts[a.category] !== undefined) categoryCounts[a.category]++;
    if (Date.parse(a.publishedAt) >= windowStart && publishedInWindow[a.category] !== undefined) publishedInWindow[a.category]++;
  }

  const TARGET_PER_CAT = +(process.env.TARGET_PER_CATEGORY || 25);
  const archiveNeeded = CATEGORIES.filter((c) => c !== 'community' && (categoryCounts[c] || 0) < TARGET_PER_CAT);
  const cycleNeeded = CATEGORIES.filter((c) => c !== 'community' && (publishedInWindow[c] || 0) < TARGET_PER_CATEGORY_PER_CYCLE);
  const priorityCategories = [...new Set([...cycleNeeded, ...archiveNeeded])];
  log(`DESK   last ${RECENT_WINDOW_HOURS}h: ${CATEGORIES.filter((c) => c !== 'community').map((c) => `${c}:${publishedInWindow[c]}`).join(' ')} (target ${Number.isFinite(TARGET_PER_CATEGORY_PER_CYCLE) ? `${TARGET_PER_CATEGORY_PER_CYCLE}/cat/cycle` : 'no category cap'})`);
  log(`DESK   archive: ${Object.entries(categoryCounts).filter(([c]) => c !== 'community').map(([k, v]) => `${k}:${v}`).join(' ')}`);
  if (priorityCategories.length) log(`DESK   prioritizing: ${priorityCategories.join(', ')}`);

  // Cluster headlines by shared keywords so that several outlets covering the
  // SAME event end up in the same desk batch. Splitting them across batches
  // made the desk see only single-source events and drop them.
  const rawWords = (it) => new Set(
    `${it.title} ${it.summary || ''}`.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  );
  // Words that appear in many headlines ("world", "people", "government") are
  // noise for event clustering; drop them dynamically.
  const docFreq = new Map();
  for (const it of items) for (const w of rawWords(it)) docFreq.set(w, (docFreq.get(w) || 0) + 1);
  const commonCut = Math.max(8, Math.floor(items.length * 0.02));
  const commonWords = new Set([...docFreq.entries()].filter(([, c]) => c > commonCut).map(([w]) => w));
  const keywordsOf = (it) => new Set([...rawWords(it)].filter((w) => !commonWords.has(w)));

  const MAX_CLUSTER = Math.max(2, +(process.env.CLUSTER_MAX || 12));
  const clusters = [];
  for (const it of items) {
    const words = keywordsOf(it);
    let target = null;
    for (const c of clusters) {
      if (c.items.length >= MAX_CLUSTER) continue;
      let shared = 0;
      for (const w of words) if (c.rep.has(w)) { shared++; if (shared >= 3) break; }
      let inter = 0;
      for (const w of words) if (c.rep.has(w)) inter++;
      const jaccard = inter / (words.size + c.rep.size - inter || 1);
      if (shared >= 3 || (shared >= 2 && jaccard >= 0.3)) { target = c; break; }
    }
    if (target) target.items.push(it);
    else clusters.push({ rep: words, items: [it] });
  }

  const batchSize = +(process.env.DESK_BATCH_SIZE || 60);
  const prioritySet = new Set(priorityCategories);
  // Rank candidate clusters by what readers would call "the news": watchlist
  // topics first, then the number of independent outlets, then volume, then
  // freshness. This is what used to go wrong — the desk saw whatever fit into
  // two batches, not the stories the most outlets were covering.
  const clusterStats = (c) => {
    const outlets = distinctOutlets(c.items).length;
    const watch = Math.max(0, ...c.items.map((i) => i.watch || 0));
    const newest = Math.max(0, ...c.items.map((i) => Date.parse(i.publishedAt) || 0));
    const ageH = (Date.now() - newest) / 3600e3;
    const fresh = ageH <= 1 ? 3 : ageH <= 4 ? 2 : ageH <= 10 ? 1 : 0;
    return { outlets, watch, fresh, score: watch * 1000 + outlets * 25 + c.items.length + fresh * 10 };
  };
  const ranked = clusters.map((c) => ({ cluster: c, ...clusterStats(c) }));
  ranked.sort((a, b) => b.score - a.score);
  clusters.length = 0;
  clusters.push(...ranked.map((r) => r.cluster));
  log(`SCOUT  widest coverage: ${ranked.slice(0, 6).map((r) => `${r.outlets}x ${r.cluster.items[0].title.slice(0, 40)}`).join(' | ') || 'none'}`);

  // Keep every cluster (event) intact inside one batch.
  const batches = [];
  let current = [];
  let currentCount = 0;
  for (const c of clusters) {
    if (current.length && currentCount + c.items.length > batchSize) { batches.push(current); current = []; currentCount = 0; }
    current.push(c);
    currentCount += c.items.length;
    if (currentCount >= batchSize) { batches.push(current); current = []; currentCount = 0; }
  }
  if (current.length) batches.push(current);
  const maxBatches = Math.min(+(process.env.DESK_MAX_BATCHES || 2), batches.length);

  // Make the blind spot visible. If a watchlist story with several outlets did
  // not even reach the desk, that is a scouting bug, not an editorial decision.
  const batchedClusters = new Set(batches.slice(0, maxBatches).flat());
  for (const r of ranked) {
    if (r.watch >= 2 && r.outlets >= 2 && !batchedClusters.has(r.cluster)) {
      log(`SCOUT MISS  watchlist cluster not shown to desk: "${r.cluster.items[0].title.slice(0, 60)}" (${r.outlets} outlets)`);
    }
  }

  let allEvents = [];
  const publishedTitles = [...dedupTitles];
  for (let b = 0; b < maxBatches; b++) {
    if (timeLeft() < 6 * 60e3) { log('DESK   time budget low → stopping discovery'); break; }
    const clusterGroup = batches[b];
    const chunk = clusterGroup.flatMap((c) => c.items);
    if (!chunk || chunk.length < 1) continue;
    const indexOfItem = new Map(chunk.map((it, i) => [it, i]));
    const groups = clusterGroup.map((c) => c.items.map((it) => indexOfItem.get(it)));
    log(`DESK   clustering batch ${b + 1}/${maxBatches} (${chunk.length} headlines, ${groups.length} candidate groups)…`);
    try {
      const found = await desk(chunk, publishedTitles, priorityCategories, groups);
      for (const ev of found) {
        if (!allEvents.some((existing) => existing.event.toLowerCase() === ev.event.toLowerCase())) {
          allEvents.push(ev);
          publishedTitles.push(ev.event);
        }
      }
    } catch (err) {
      log(`DESK   batch ${b + 1} error: ${err?.message || err}`);
    }
    if (allEvents.length >= Math.max(MAX_STORIES * 2, 8)) break;
  }

  // Constructive slot: the desk model fills its quota with hard news, so the
  // positive feeds (Good News Network, Positive News, Reasons to Be Cheerful,
  // The Optimist Daily) hardly ever survived the ranking. They get their own
  // pass and a reserved slot per cycle.
  const constructive = items.filter((i) => i.positive && !seen.has(i.url)).slice(0, 40);
  if (!allEvents.some((e) => e.positive) && constructive.length) {
    log(`DESK   constructive pass (${constructive.length} headlines)`);
    try {
      const found = await desk(constructive, publishedTitles, []);
      for (const ev of found) {
        if (!allEvents.some((existing) => existing.event.toLowerCase() === ev.event.toLowerCase())) {
          allEvents.push(ev);
          publishedTitles.push(ev.event);
        }
      }
      log(`DESK   constructive pass found ${found.length} event(s)`);
    } catch (err) {
      log(`DESK   constructive pass error: ${err?.message || err}`);
    }
  }

  // Rank by importance + source depth, but reserve one slot per desk before
  // selecting second stories so busy categories cannot crowd out others.
  allEvents.sort((a, b) => ((+b.importance || 1) * 10 + b.outlets) - ((+a.importance || 1) * 10 + a.outlets));
  const projected = { ...publishedInWindow };
  const perCat = {};
  const events = [];

  // 1) Watchlist stories with real coverage are guaranteed a slot: an election
  //    or a war must not lose its place to a thin lobby story just because the
  //    category already hit its hourly target.
  for (const e of allEvents) {
    if (events.length >= MAX_STORIES) break;
    if (e.watch >= 2 && e.importance >= 3) {
      events.push(e);
      perCat[e.category] = (perCat[e.category] || 0) + 1;
      projected[e.category] = (projected[e.category] || 0) + 1;
      log(`DESK   guaranteed slot (watchlist ${e.watch}, ${e.outlets} outlets): ${e.event.slice(0, 70)}`);
    }
  }

  // 2) Reserve one slot per desk so the front page stays varied.
  for (const category of CATEGORIES.filter((c) => c !== 'community')) {
    if ((projected[category] || 0) >= MIN_PER_CATEGORY_PER_CYCLE) continue;
    if ((perCat[category] || 0) >= MAX_PER_CATEGORY || events.length >= MAX_STORIES) continue;
    const event = allEvents.find((e) => e.category === category);
    if (!event) continue;
    events.push(event);
    perCat[category] = 1;
    projected[category] = (projected[category] || 0) + 1;
  }
  // One constructive story per cycle, independent of the ranking.
  const constructiveEvent = allEvents.find((e) => e.positive && !events.includes(e));
  if (constructiveEvent && events.length < MAX_STORIES) {
    events.push(constructiveEvent);
    perCat[constructiveEvent.category] = (perCat[constructiveEvent.category] || 0) + 1;
    projected[constructiveEvent.category] = (projected[constructiveEvent.category] || 0) + 1;
    log(`DESK   reserved constructive slot: ${constructiveEvent.event.slice(0, 60)}`);
  }
  for (const e of allEvents) {
    if (events.length >= MAX_STORIES) break;
    if (events.includes(e)) continue;
    if ((projected[e.category] || 0) >= TARGET_PER_CATEGORY_PER_CYCLE) continue;
    if ((perCat[e.category] || 0) >= MAX_PER_CATEGORY) continue;
    perCat[e.category] = (perCat[e.category] || 0) + 1;
    projected[e.category] = (projected[e.category] || 0) + 1;
    events.push(e);
  }
  log(`DESK   ${events.length} events selected (${events.map((e) => e.category).join(', ') || 'none'})`);
  if (!events.length) {
    state.runs = [{ at: new Date().toISOString(), feedsOk, items: items.length, events: 0, published: 0, reason: 'quota-or-no-events', durationMs: Date.now() - RUN_STARTED }, ...(state.runs || [])].slice(0, 100);
    saveState(state);
    return log('No publishable events this run. Done.');
  }

  // ── Phase 1: report + edit (English) in parallel ──
  const results = await pool(events, EVENT_CONCURRENCY, (ev) => {
    if (timeLeft() < 4 * 60e3) { log('  time budget low → not starting event'); return null; }
    return processEvent(ev, dedupTitles, seen);
  });

  const accepted = [];
  for (const article of results) {
    if (!article || article.error) continue;
    const check = isPublishableArticle(article);
    if (!check.ok) { log(`  POLICY  ${article.slug}: ${check.reason} → dropped`); continue; }
    const dup = isDuplicateStory(article.locales[SOURCE_LOCALE].title, [...dedupTitles, ...accepted.map((a) => a.locales[SOURCE_LOCALE].title)]);
    if (dup.isDup) { log(`  DEDUP  ${article.slug} matches "${dup.matchingTitle}" → dropped`); continue; }
    saveArticle(article);
    index.articles.unshift(toIndexEntry(article));
    saveIndex(index);
    accepted.push(article);
    categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
    log(`  ✓ SAVED ${article.slug} (${article.category}, ${article.sourcePolicy})`);
  }

  // ── Phase 2: translate accepted articles with one global pool ──
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
  // German first: it is the edition readers notice, and the cycle budget is
  // better spent on one finished language than on nine half-done ones.
  const orderedTargets = ['de', ...targets.filter((c) => c !== 'de')];
  const tasks = orderedTargets.flatMap((locale) => accepted.map((article) => ({ article, locale })));
  let translated = 0;
  if (tasks.length && timeLeft() > 2 * 60e3) {
    log(`TRANSLATOR ${tasks.length} jobs (${accepted.length} articles × ${targets.length} languages)…`);
    const out = await pool(tasks, TRANSLATION_CONCURRENCY, async ({ article, locale }) => {
      const t = await translate(article.locales[SOURCE_LOCALE], locale);
      article.locales[locale] = t;
      if (locale === 'de' && article.locales.en.imageCaption) {
        // Vision already returns a German caption when it can; translate fallback only if missing.
        if (!t.imageCaption) t.imageCaption = article.locales.en.imageCaption;
      }
      saveArticle(article);
      return { article, locale };
    });
    for (const r of out) {
      if (r && !r.error) translated++;
      else if (r?.error) log(`    ✗ translation: ${r.error.message}`);
    }
    const bySlug = new Map(accepted.map((a) => [a.slug, a]));
    index.articles = index.articles.map((e) => (bySlug.has(e.slug) ? toIndexEntry(bySlug.get(e.slug)) : e));
    saveIndex(index);
  }

  state.seenUrls = [...seen].slice(-10000);
  state.runs = [{
    at: new Date().toISOString(),
    feedsOk,
    items: items.length,
    events: events.length,
    published: accepted.length,
    translated,
    targetPerCategoryPerCycle: Number.isFinite(TARGET_PER_CATEGORY_PER_CYCLE) ? TARGET_PER_CATEGORY_PER_CYCLE : null,
    recentWindowHours: RECENT_WINDOW_HOURS,
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, accepted.filter((a) => a.category === c).length])),
    sourcePolicies: Object.fromEntries(['two-source', 'primary'].map((p) => [p, accepted.filter((a) => a.sourcePolicy === p).length])),
    durationMs: Date.now() - RUN_STARTED,
  }, ...(state.runs || [])].slice(0, 100);
  saveState(state);
  log(`\nDone. Published ${accepted.length} stories, ${translated} translations in ${Math.round((Date.now() - RUN_STARTED) / 1000)}s.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
