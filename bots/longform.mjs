#!/usr/bin/env node
// PLAIN. LONGFORM — two to three long reads per day.
//
// The newsroom publishes short factual reports all day. This bot turns the raw
// material into one thing a news site normally cannot afford: a long, calm
// piece that explains what happened, who it affects and what comes next.
//
//   1. RADAR    fetch feeds, cluster headlines into candidate topics (≥2 outlets)
//   2. PLAN     one LLM call picks up to N themes worth 1.200+ words
//   3. MATERIAL read full texts + matching archive articles for background
//   4. WRITE    4-6 sections, editor pass, anti-slop gate
//   5. TRANSLATE the long pieces into the main site languages
//   6. PUBLISH  form:"longform" → content/articles + index
//
// Runs daily. Never invents: everything must be supported by the sources.
import fs from 'node:fs';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

import { FEEDS } from './sources.mjs';
import { fetchFeeds, fetchArticleDetails } from './lib/feeds.mjs';
import { chatJSON } from './lib/llm.mjs';
import { STYLE_GUIDE, slopHits, styleProblems } from './lib/style.mjs';
import { collectImages, assignImages } from './lib/illustrate.mjs';
import { loadIndex, saveIndex, loadArticle, saveArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { CATEGORIES, LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';
import { distinctOutlets, isDuplicateStory } from '../lib/editorial.mjs';
import { watchScore } from '../lib/watchlist.mjs';

// ─────────────────────────── config ───────────────────────────
const PER_RUN = Math.max(1, +(process.env.LONGFORM_PER_RUN || 3));
const LOOKBACK_HOURS = Math.max(6, +(process.env.LONGFORM_LOOKBACK_HOURS || 48));
const PER_FEED = Math.max(10, +(process.env.LONGFORM_PER_FEED || 30));
const MIN_SOURCES = Math.max(2, +(process.env.LONGFORM_MIN_SOURCES || 2));
const MIN_WORDS = Math.max(500, +(process.env.LONGFORM_MIN_WORDS || 950));
const MAX_READS = Math.max(2, +(process.env.LONGFORM_MAX_READS || 5));
const TRANSLATE_CONCURRENCY = Math.max(1, +(process.env.LONGFORM_TRANSLATE_CONCURRENCY || 3));
const TRANSLATE_LOCALES = String(process.env.LONGFORM_LOCALES || 'en,de,fr,es,it,pt')
  .split(',').map((s) => s.trim()).filter((c) => LOCALES.some((l) => l.code === c));
const DRY_RUN = process.env.LONGFORM_DRY_RUN === '1';
const LEDGER = 'content/longform-state.json';
const MAX_AGE_DAYS = 21;

const nowISO = () => new Date().toISOString();
const log = (...a) => process.stdout.write(`${nowISO().slice(11, 19)} ${a.join(' ')}\n`);
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

// ─────────────────────────── 1. RADAR ───────────────────────────
const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'first', 'report', 'reports', 'study', 'amid', 'during', 'could', 'would', 'which', 'while', 'where', 'there', 'these', 'those', 'today', 'latest', 'update', 'live', 'breaking', 'news', 'new']);

function wordSet(text) {
  return new Set(String(text).toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w)));
}

function keywordHits(text, keywords = []) {
  const t = String(text).toLowerCase();
  return keywords.reduce((n, k) => (k && t.includes(String(k).toLowerCase()) ? n + 1 : n), 0);
}

function clusterItems(items) {
  const clusters = [];
  for (const it of [...items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const w = wordSet(`${it.title} ${it.summary || ''}`);
    let target = null;
    for (const c of clusters) {
      let shared = 0;
      for (const x of w) if (c.rep.has(x)) { shared++; if (shared >= 3) break; }
      if (shared >= 3) { target = c; break; }
    }
    if (target) target.items.push(it);
    else clusters.push({ rep: w, items: [it] });
  }
  return clusters
    .filter((c) => distinctOutlets(c.items).length >= MIN_SOURCES)
    .map((c) => ({
      items: c.items,
      outlets: distinctOutlets(c.items).length,
      newest: Math.max(...c.items.map((i) => Date.parse(i.publishedAt) || 0)),
      watch: Math.max(...c.items.map((i) => watchScore(`${i.title} ${i.summary || ''}`))),
    }))
    .sort((a, b) => (b.outlets * 30 + b.watch * 20 + b.newest / 1e9) - (a.outlets * 30 + a.watch * 20 + a.newest / 1e9));
}

// ─────────────────────────── 2. PLAN ───────────────────────────
async function planThemes(clusters, recentLongform) {
  const list = clusters.slice(0, 22).map((c, i) => {
    const heads = c.items.slice(0, 4).map((x) => `${x.outlet}: ${x.title}`).join('\n    ');
    return `#${i} [${c.outlets} outlets] ${c.items[0].title}\n    ${heads}`;
  }).join('\n\n');

  const { data, model } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the longform editor of PLAIN., an unbiased news site. You commission one long, explanatory piece — never an opinion column. Return JSON only.`,
    },
    {
      role: 'user',
      content: `Recent news clusters (each backed by at least ${MIN_SOURCES} independent outlets):

${list}

ALREADY PUBLISHED LONG READS (do not repeat these themes):
${recentLongform.slice(0, 30).map((t) => `- ${t}`).join('\n') || '- none'}

TASK: Choose up to ${PER_RUN} themes that deserve ${MIN_WORDS}+ words today.

WHAT MAKES A GOOD LONG READ
- It explains a development that is already reported: why it happened, who is affected, what the numbers say, what happens next.
- It has enough material: several outlets, concrete facts, names, figures, dates.
- It works without new reporting: we only use what the sources say.
- Not: a single press release, a celebrity item, a match report, a market ticker, a "what we know" list, a profile of a private person, speculation about the future.

RULES
- "title": factual working headline, max 90 characters, no question marks, no clickbait.
- "angle": one sentence stating the question the piece answers.
- "category": one of ${CATEGORIES.filter((c) => c !== 'community').join(', ')}.
- "cluster_ids": the ids above that carry the material (1-3).
- "keywords": 4-10 lowercase keywords to find more reports on it.

Return exactly:
{"themes":[{"title":"…","angle":"…","category":"…","cluster_ids":[0,2],"keywords":["…"]}]}`,
    },
  ], { temperature: 0.35, maxTokens: 2000 });

  const themes = (Array.isArray(data.themes) ? data.themes : [])
    .map((t) => ({
      title: String(t.title || '').trim().slice(0, 120),
      angle: String(t.angle || '').trim().slice(0, 240),
      category: CATEGORIES.includes(t.category) ? t.category : 'world',
      keywords: [...new Set((t.keywords || []).map((k) => String(k).toLowerCase().trim()).filter((k) => k.length >= 3))].slice(0, 10),
      clusters: [...new Set((t.cluster_ids || []).map(Number))].map((i) => clusters[i]).filter(Boolean),
    }))
    .filter((t) => t.title.length > 15 && t.clusters.length)

  return { themes, model };
}

// ─────────────────────────── 3. MATERIAL ───────────────────────────
function archiveMatches(theme, index) {
  const cutoff = Date.now() - 7 * 864e5;
  return index.articles
    .filter((a) => Date.parse(a.publishedAt) >= cutoff && a.category === theme.category)
    .map((a) => {
      const t = a.locales?.[SOURCE_LOCALE] || {};
      const text = `${t.title || ''} ${t.dek || ''}`;
      return { a, hits: keywordHits(text, theme.keywords) };
    })
    .filter((x) => x.hits >= 2)
    .sort((a, b) => b.hits - a.hits || (b.a.importance || 0) - (a.a.importance || 0))
    .slice(0, 3)
    .map((x) => x.a);
}

async function gatherMaterial(theme, items, index) {
  const sources = [];
  const seen = new Set();
  const add = (s) => {
    if (!s?.url || seen.has(s.url)) return;
    seen.add(s.url);
    sources.push(s);
  };

  for (const cluster of theme.clusters) {
    for (const it of cluster.items.slice(0, 8)) {
      add({ outlet: it.outlet, title: it.title, url: it.url, publishedAt: it.publishedAt, summary: it.summary, image: it.image });
    }
  }
  // Fresh reports that carry the theme keywords beyond the seed clusters.
  for (const it of items) {
    if (keywordHits(`${it.title} ${it.summary || ''}`, theme.keywords) >= 2) {
      add({ outlet: it.outlet, title: it.title, url: it.url, publishedAt: it.publishedAt, summary: it.summary, image: it.image });
    }
  }

  // Background from our own archive: already verified, already translated.
  const archive = archiveMatches(theme, index);
  const background = archive.map((a) => {
    const t = a.locales?.[SOURCE_LOCALE] || {};
    return { slug: a.slug, title: t.title, dek: t.dek, facts: t.facts || [], body: t.body || [], context: t.context };
  });
  for (const a of archive) for (const s of a.sources || []) add(s);

  if (distinctOutlets(sources).length < MIN_SOURCES) {
    return { ok: false, reason: `only ${distinctOutlets(sources).length} outlet(s)` };
  }

  // Read the strongest full texts: direct feeds first, one per outlet.
  const ranked = [...sources].sort((a, b) => (a.aggregator ? 1 : 0) - (b.aggregator ? 1 : 0));
  const byOutlet = new Map();
  for (const s of ranked) if (!byOutlet.has(s.outlet)) byOutlet.set(s.outlet, s);
  const toRead = [...byOutlet.values(), ...ranked.filter((s) => !byOutlet.get(s.outlet) || byOutlet.get(s.outlet) !== s)]
    .slice(0, MAX_READS);
  await pool(toRead, 4, async (s) => {
    const d = await fetchArticleDetails(s.url).catch(() => null);
    if (d?.text) s.text = d.text;
    // The article page is what carries the photo; feed enclosures are often too small.
    if (d?.image) {
      s.image = d.image;
      s.imageCaption = d.imageCaption;
      s.imageCredit = d.imageCredit;
    }
  });

  return { ok: true, sources, background, read: toRead.filter((s) => s.text).length };
}

function sourcePack(sources) {
  return sources.slice(0, 14).map((s, i) =>
    `[S${i + 1}] ${s.outlet} — "${s.title}" (${String(s.publishedAt || '').slice(0, 10)})\nURL: ${s.url}\nTEXT: ${(s.text || s.summary || '(headline only)').slice(0, 4000)}`
  ).join('\n\n');
}

function backgroundPack(background) {
  return background.map((b, i) =>
    `[B${i + 1}] ${b.title}\nDEK: ${b.dek}\nFACTS: ${(b.facts || []).join(' | ')}\nBODY: ${(b.body || []).join(' ')}\nCONTEXT: ${b.context || ''}`
  ).join('\n\n');
}

// ─────────────────────────── 4. WRITE ───────────────────────────
const LONGFORM_SCHEMA = `{"title":"…","dek":"one-sentence summary, max 30 words","standfirst":"one calm paragraph that sets the scene, 2-3 sentences","facts":["4-6 short key facts with numbers"],"sections":[{"heading":"…","paragraphs":["…","…"]}],"context":"2-3 sentences of background"}`;

async function writeLongform(theme, material, strict = false) {
  const { data, model } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are a longform reporter at PLAIN., an unbiased news site. You write explanatory pieces that stay strictly inside the sources: no invented scenes, no reconstructed dialogue, no anonymous sourcing. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `THEME: ${theme.title}
QUESTION THE PIECE ANSWERS: ${theme.angle}

BACKGROUND FROM OUR OWN VERIFIED ARCHIVE:
${backgroundPack(material.background) || '(none)'}

SOURCES (reports published in the last ${LOOKBACK_HOURS} hours):
${sourcePack(material.sources)}

TASK: Write ONE long, explanatory piece in English, ${MIN_WORDS}-1600 words total.

STRUCTURE
- standfirst: one calm paragraph that states the concrete development and why it matters, with at least one figure.
- sections: 4-6 sections. Each has a short heading (max 60 characters, no puns) and 3-5 real paragraphs of 3-5 sentences.
- Paragraphs are prose, not stacked facts. A paragraph develops one idea: a figure from the sources, who is affected, what the documents or officials say, what is disputed.
- Move from the concrete (what happened, what the numbers say, who is affected) to the wider context (how it developed, what it compares to) and end with what is confirmed about next steps.
- facts: 4-6 short key facts, each with the number or date it relies on.

RULES
- Only facts stated in SOURCES or BACKGROUND. If a detail is not there, leave it out — do not fill gaps with general knowledge.
- Attribute contested or one-sided claims ("according to …", "X said"), never adopt them.
- Numbers, dates, names and quotes exactly as in the sources.
- No opinion, no predictions of your own, no "experts say" without naming them, no first person, no calls to action.
- No bullet lists, no sub-sub-headings, no "in conclusion", no "it remains to be seen".
- Do not repeat the same fact in two sections.
- Depth comes from detail, not from repetition: use the source's figures, chronology, official titles and exact wording. Never pad a section by restating an earlier fact in new words.
- Do not write four short declarative sentences in a row and do not start consecutive sentences with the same subject. One longer sentence with two clauses per paragraph is mandatory.
- No evaluative summary sentences ("This was a test of…", "It showed…", "The election underlined…"). Stop the paragraph on the last fact.

Return exactly:
${LONGFORM_SCHEMA}${strict ? '\n\nIMPORTANT: your previous reply was invalid. Return valid JSON only: "sections" must be an array of objects, "paragraphs" and "facts" arrays of strings.' : ''}`,
    },
  ], { temperature: strict ? 0.25 : 0.4, maxTokens: 12000 });
  return { draft: data, model };
}

async function editLongform(theme, material, draft, styleIssues = []) {
  const { data, model } = await chatJSON('editor', [
    {
      role: 'system',
      content: `You are the standards editor of PLAIN. and you are strict. You check a longform draft sentence by sentence against the sources. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `SOURCES:\n${sourcePack(material.sources)}\n\nBACKGROUND:\n${backgroundPack(material.background) || '(none)'}\n\nDRAFT:\n${JSON.stringify(draft, null, 2)}
${styleIssues.length ? `\nSTYLE PROBLEMS MEASURED IN THE DRAFT (fix all of them):\n${styleIssues.map((p) => `- ${p}`).join('\n')}\n` : ''}
Check:
- Every claim, number, date, name and quote must appear in the sources. Delete or fix anything unsupported — including plausible-sounding context.
- Remove speculation, opinion, filler, repeated facts and any sentence that only restates the headline.
- Rewrite monotonous prose: vary sentence length, remove repeated sentence openings, cut evaluative summary sentences, and keep every paragraph advancing.
- Keep the explanatory structure and the length (${MIN_WORDS}+ words). Do not shorten it into a news report.
Verdict: "publish" if correct, "revise" with the fully corrected piece in "article", "reject" if the material cannot support ${MIN_WORDS} words honestly.

Return: {"verdict":"publish|revise|reject","problems":["…"],"article":${LONGFORM_SCHEMA}}`,
    },
  ], { temperature: 0.1, maxTokens: 14000 });
  return { review: data, model };
}

function totalWords(block) {
  const body = (block.sections || []).flatMap((s) => [s.heading || '', ...(s.paragraphs || [])]);
  return words([block.standfirst, block.dek, ...(block.facts || []), ...body, block.context].join(' '));
}

function validLongform(a) {
  if (!a || typeof a.title !== 'string' || a.title.length < 15 || a.title.length > 120) return 'title';
  if (!a.dek || !a.standfirst) return 'dek/standfirst';
  if (!Array.isArray(a.sections) || a.sections.length < 3) return 'sections';
  for (const s of a.sections) {
    if (!s || !Array.isArray(s.paragraphs) || s.paragraphs.length < 2) return 'section paragraphs';
  }
  if (!Array.isArray(a.facts) || a.facts.length < 2) return 'facts';
  return null;
}

async function buildOne(theme, material, index) {
  log(`\n▶ ${theme.category.toUpperCase()} ${theme.title.slice(0, 70)} (${distinctOutlets(material.sources).length} outlets, ${material.read} read)`);

  let { draft, model } = await writeLongform(theme, material);
  let problem = validLongform(draft);
  if (problem) {
    log(`  WRITE  invalid (${problem}), retrying`);
    ({ draft } = await writeLongform(theme, material, true));
    problem = validLongform(draft);
    if (problem) throw new Error(`draft still invalid: ${problem}`);
  }

  // Hard length gate: a "long read" that is short is a normal article.
  const w = totalWords(draft);
  log(`  WRITE  ${w} words, ${draft.sections.length} sections`);
  if (w < MIN_WORDS) throw new Error(`only ${w} words (min ${MIN_WORDS})`);

  const slop = slopHits({ title: draft.title, dek: draft.dek });
  if (slop.length) throw new Error(`banned phrases: ${slop.join(', ')}`);

  const styleIssues = styleProblems(draft);
  if (styleIssues.length) log(`  STYLE  ${styleIssues.join(' | ')}`);

  let final = draft;
  let editorModel = null;
  let verdict = 'skipped';
  try {
    const { review, model: em } = await editLongform(theme, material, draft, styleIssues);
    editorModel = em;
    verdict = review?.verdict || 'unknown';
    log(`  EDITOR ${verdict}${review?.problems?.length ? ' — ' + review.problems.slice(0, 3).join(' | ') : ''}`);
    if (verdict === 'reject') return null;
    if (verdict === 'revise' && !validLongform(review.article)) final = review.article;
  } catch (e) {
    log(`  EDITOR failed (${e.message}); keeping writer draft`);
  }

  const edited = validLongform(final) ? final : draft;
  const finalWords = totalWords(edited);
  if (finalWords < MIN_WORDS * 0.9) {
    log(`  EDITOR  shrank to ${finalWords} words, keeping the writer draft`);
    final = draft;
  }

  const leftoverStyle = styleProblems(validLongform(final) ? final : draft);
  if (leftoverStyle.length) log(`  STYLE  after edit: ${leftoverStyle.join(' | ')}`);

  const dup = isDuplicateStory(edited.title, index.articles.map((a) => a.locales?.[SOURCE_LOCALE]?.title || '').filter(Boolean));
  if (dup.isDup) {
    log(`  DEDUP  "${edited.title}" ≈ "${dup.matchingTitle}" → skipped`);
    return null;
  }

  const sources = [];
  const seen = new Set();
  for (const s of material.sources) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push({ outlet: s.outlet, title: s.title, url: s.url, publishedAt: s.publishedAt });
  }

  const pictures = await collectImages(material.sources, { max: 3 });
  const hero = pictures[0] || null;
  log(`  PHOTO  ${pictures.length} usable image(s)${hero ? ` — hero from ${hero.outlet || 'source'}` : ''}`);

  const sections = assignImages(edited.sections.map((s) => ({
    heading: String(s.heading || '').trim().slice(0, 90),
    paragraphs: (s.paragraphs || []).map((p) => String(p).trim()).filter(Boolean),
  })), pictures);

  const doc = {
    slug: slugify(edited.title),
    category: theme.category,
    form: 'longform',
    image: hero?.url || null,
    imageCredit: hero?.credit || null,
    video: null,
    importance: Math.min(5, 3 + (distinctOutlets(sources).length >= 5 ? 1 : 0) + (theme.category === 'world' || theme.category === 'politics' ? 1 : 0)),
    publishedAt: nowISO(),
    updatedAt: nowISO(),
    sourcePolicy: 'two-source',
    readingMinutes: Math.max(4, Math.round(finalWords / 215)),
    sources: sources.slice(0, 20),
    locales: {
      [SOURCE_LOCALE]: {
        title: String(edited.title).trim(),
        dek: String(edited.dek).trim(),
        standfirst: String(edited.standfirst).trim(),
        facts: (edited.facts || []).map((f) => String(f).trim()).filter(Boolean).slice(0, 6),
        body: sections.flatMap((s) => s.paragraphs),
        sections,
        context: String(edited.context || '').trim(),
        imageCaption: hero?.caption || '',
      },
    },
    history: [],
    meta: { writer: model, editor: editorModel, desk: 'Longform', verdict, words: finalWords, theme: theme.title },
  };

  return doc;
}

// ─────────────────────────── 5. TRANSLATE ───────────────────────────
async function translateLongform(block, locale) {
  const lang = LOCALES.find((l) => l.code === locale);
  const { data } = await chatJSON('translator', [
    {
      role: 'system',
      content: `You are a professional longform translator into ${lang.label} (${lang.bcp47}), writing in the neutral register of a quality newspaper. Keep the structure, the length and every fact exactly. Never add or remove information. Keep names, numbers, dates and quotes accurate using the established local spelling. Return JSON only with the same shape.`,
    },
    {
      role: 'user',
      content: `Translate this JSON into ${lang.label}. Keep "sections" as an array with the same number of items, each with "heading" and "paragraphs". If a section has an "image" object, keep its "url" and "credit" unchanged and translate only "caption". Return exactly the same keys.

${JSON.stringify({ title: block.title, dek: block.dek, standfirst: block.standfirst, facts: block.facts, sections: block.sections, context: block.context, imageCaption: block.imageCaption || '' })}`,
    },
  ], { temperature: 0.2, maxTokens: 12000 });

  if (!Array.isArray(data.sections) || data.sections.length < 2) throw new Error('translation lost sections');
  const sections = data.sections.map((s, i) => {
    const source = block.sections?.[i];
    const section = { heading: String(s.heading || ''), paragraphs: (s.paragraphs || []).map(String) };
    if (source?.image?.url) {
      section.image = {
        url: source.image.url,
        credit: source.image.credit || '',
        caption: String(s?.image?.caption || source.image.caption || '').trim(),
      };
    }
    return section;
  });

  return {
    title: String(data.title || block.title).trim(),
    dek: String(data.dek || block.dek).trim(),
    standfirst: String(data.standfirst || block.standfirst).trim(),
    facts: Array.isArray(data.facts) && data.facts.length ? data.facts.map(String) : block.facts,
    body: sections.flatMap((s) => s.paragraphs),
    sections,
    context: String(data.context || block.context || '').trim(),
    imageCaption: String(data.imageCaption || block.imageCaption || '').trim(),
  };
}

// ─────────────────────────── 6. PUBLISH ───────────────────────────
function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { runs: [], themes: [] }; }
}
function saveLedger(l) {
  fs.mkdirSync('content', { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');
}

async function main() {
  const started = Date.now();
  const index = loadIndex();
  const ledger = loadLedger();

  const recentLongform = index.articles
    .filter((a) => a.form === 'longform' && Date.parse(a.publishedAt) > Date.now() - MAX_AGE_DAYS * 864e5)
    .map((a) => a.locales?.[SOURCE_LOCALE]?.title || a.slug);
  const recentThemes = (ledger.themes || [])
    .filter((t) => Date.parse(t.at) > Date.now() - 10 * 864e5)
    .map((t) => t.title);

  log(`RADAR  fetching ${FEEDS.length} feeds (${LOOKBACK_HOURS}h)…`);
  const { items, feedsOk } = await fetchFeeds(FEEDS, { maxAgeHours: LOOKBACK_HOURS, perFeed: PER_FEED });
  log(`RADAR  ${feedsOk}/${FEEDS.length} feeds ok, ${items.length} items`);

  const clusters = clusterItems(items);
  log(`PLAN   ${clusters.length} candidate cluster(s) with ≥${MIN_SOURCES} outlets`);
  if (!clusters.length) {
    log('Nothing to build a long read from. Done.');
    return;
  }

  const { themes, model: planModel } = await planThemes(clusters, [...recentLongform, ...recentThemes]);
  log(`PLAN   ${themes.length} theme(s) chosen by ${planModel}`);
  if (!themes.length) {
    log('No theme passed the editorial filter. Done.');
    return;
  }

  let published = 0;
  for (const theme of themes.slice(0, PER_RUN)) {
    try {
      if (recentLongform.concat(recentThemes).some((t) => isDuplicateStory(theme.title, [t]).isDup)) {
        log(`SKIP   "${theme.title}" repeats a recent long read`);
        continue;
      }
      const material = await gatherMaterial(theme, items, index);
      if (!material.ok) {
        log(`SKIP   "${theme.title}": ${material.reason}`);
        continue;
      }
      const doc = await buildOne(theme, material, index);
      if (!doc) continue;

      if (DRY_RUN) {
        log(`DRY    would publish "${doc.locales.en.title}" (${doc.readingMinutes} min, ${doc.meta.words} words)`);
        continue;
      }

      saveArticle(doc);
      index.articles.unshift(toIndexEntry(doc));
      saveIndex(index);

      // Translations run after the piece is saved, so a translation failure
      // never costs us the article.
      const targets = TRANSLATE_LOCALES.filter((c) => c !== SOURCE_LOCALE);
      await pool(targets, TRANSLATE_CONCURRENCY, async (locale) => {
        const t = await translateLongform(doc.locales[SOURCE_LOCALE], locale);
        doc.locales[locale] = t;
        saveArticle(doc);
        return locale;
      });
      const translated = Object.keys(doc.locales).filter((c) => c !== SOURCE_LOCALE);
      index.articles = index.articles.map((e) => (e.slug === doc.slug ? toIndexEntry(doc) : e));
      saveIndex(index);

      ledger.themes = [{ at: nowISO(), title: doc.locales[SOURCE_LOCALE].title, slug: doc.slug }, ...(ledger.themes || [])].slice(0, 200);
      published++;
      log(`✓ PUBLISHED ${doc.slug} (${doc.meta.words} words, ${doc.readingMinutes} min, ${translated.length} translation(s))`);
    } catch (e) {
      log(`✗ ${theme.title.slice(0, 50)}: ${e.message}`);
    }
  }

  ledger.runs = [{ at: nowISO(), feedsOk, items: items.length, clusters: clusters.length, themes: themes.length, published, ms: Date.now() - started }, ...(ledger.runs || [])].slice(0, 60);
  if (!DRY_RUN) saveLedger(ledger);

  log(`\nDone. ${published} long read(s) in ${Math.round((Date.now() - started) / 1000)}s.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
