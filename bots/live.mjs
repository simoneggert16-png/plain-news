#!/usr/bin/env node
// PLAIN. LIVE — story-level live tickers.
//
// The newsroom publishes one article per event. A live ticker keeps ONE
// continuing event (election night, war, disaster) open and appends verified
// updates for as long as it runs. Pipeline:
//
//   1. RADAR     fetch feeds, match headlines against the active tickers
//   2. DETECT    auto-open a ticker when a watchlist event is covered widely
//   3. WRITE     group the matched headlines into facts (one LLM call per ticker)
//   4. GATE      every update must be confirmed by ≥2 independent outlets
//   5. TRANSLATE new update lines into all site languages (batched per language)
//   6. ARTICLE   refresh the linked article (EN + DE) and keep old versions
//   7. SAVE      Supabase (live, no redeploy) + content/live/*.json (archive)
//
// Runs every 10 minutes while at least one ticker is live.
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
import { fetchFeeds } from './lib/feeds.mjs';
import { chatJSON } from './lib/llm.mjs';
import { STYLE_GUIDE, slopHits } from './lib/style.mjs';
import { loadIndex, saveIndex, loadArticle, saveArticle, toIndexEntry } from './lib/store.mjs';
import { listLiveTickers, saveLiveTicker } from '../lib/liveStore.mjs';
import { liveUpdates, liveLastAt, wantsStats } from '../lib/live.mjs';
import { CATEGORIES, LOCALES, SOURCE_LOCALE } from '../lib/config.mjs';
import { distinctOutlets, importanceFromCoverage, isDuplicateStory } from '../lib/editorial.mjs';
import { watchScore, isLiveWorthy } from '../lib/watchlist.mjs';
import { isTrustedStatsSource } from './lib/stats.mjs';

// ─────────────────────────── config ───────────────────────────
const WINDOW_HOURS = +(process.env.LIVE_WINDOW_HOURS || 6);
const PER_FEED = +(process.env.LIVE_PER_FEED || 25);
const MIN_SOURCES = Math.max(2, +(process.env.LIVE_MIN_SOURCES || 2)); // hard floor: 2 independent outlets
const MIN_OUTLETS_CREATE = Math.max(2, +(process.env.LIVE_MIN_OUTLETS_CREATE || 4));
const MAX_NEW_TICKERS = Math.max(0, +(process.env.LIVE_MAX_NEW_TICKERS || 1));
const MAX_UPDATES_PER_RUN = Math.max(1, +(process.env.LIVE_MAX_UPDATES_PER_RUN || 3));
const ARTICLE_REFRESH_MIN = Math.max(5, +(process.env.LIVE_ARTICLE_REFRESH_MIN || 25));
const IDLE_END_HOURS = Math.max(2, +(process.env.LIVE_IDLE_END_HOURS || 12));
const AUTO_CREATE = process.env.LIVE_AUTO_CREATE !== '0';
const TRANSLATE_CONCURRENCY = Math.max(1, +(process.env.LIVE_TRANSLATE_CONCURRENCY || 4));
const MAX_UPDATES = 400;
const MAX_VERSIONS = 20;

// Statistics: numbers do not need two independent outlets. One trustworthy
// source (statistical office, election commission, central bank, wire service)
// is enough — a published figure is either right or wrong, not a framing.
const STATS_ENABLED = process.env.LIVE_STATS !== '0';
const STATS_MAX_ROWS = Math.max(2, +(process.env.LIVE_STATS_MAX_ROWS || 16));
const STATS_HISTORY = 60;


const nowISO = () => new Date().toISOString();
const log = (...a) => process.stdout.write(`${nowISO().slice(11, 19)} ${a.join(' ')}\n`);
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const randomId = () => Math.random().toString(36).slice(2, 6);

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

// ─────────────────────────── matching ───────────────────────────
function keywordHits(text, keywords = []) {
  const t = String(text).toLowerCase();
  return keywords.reduce((n, k) => (k && t.includes(String(k).toLowerCase()) ? n + 1 : n), 0);
}

function matchesTicker(item, ticker) {
  const text = `${item.title} ${item.summary || ''}`;
  const hits = keywordHits(text, ticker.keywords || []);
  if (!hits) return false;
  // One weak keyword is not enough: "israel" alone can match anything. A single
  // hit is accepted only when the headline itself is watchlist-worthy.
  return hits >= 2 || watchScore(text) >= 2;
}

function dedupeByOutletTitle(items) {
  const seen = new Set();
  return items.filter((i) => {
    const key = `${i.outlet.toLowerCase()}|${i.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectCandidates(ticker, items) {
  const seen = new Set(ticker.seenUrls || []);
  const matched = items.filter((i) => !seen.has(i.url) && matchesTicker(i, ticker));
  return dedupeByOutletTitle(matched)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 60);
}

// ─────────────────────────── writing updates ───────────────────────────
async function proposeUpdates(ticker, candidates) {
  const existing = liveUpdates(ticker).slice(0, 15).map((u) => `- ${u.locales?.en?.headline || u.locales?.[SOURCE_LOCALE]?.headline || ''}`);
  const list = candidates
    .map((c, i) => `${i}|${c.outlet}|${c.publishedAt.slice(0, 16).replace('T', ' ')}|${c.title}|${(c.summary || '').slice(0, 220)}`)
    .join('\n');

  const { data, model } = await chatJSON('live', [
    {
      role: 'system',
      content: `You are the live desk of PLAIN., an unbiased news site. You write short, strictly factual ticker updates for ONE running event.
${STYLE_GUIDE}
Return JSON only.`,
    },
    {
      role: 'user',
      content: `EVENT: ${ticker.topic}
CURRENT HEADLINE: ${ticker.locales?.en?.title || ticker.topic}

EXISTING UPDATES (do not repeat or paraphrase any of these):
${existing.join('\n') || '- none yet'}

NEW CANDIDATE REPORTS (id|outlet|published|headline|snippet):
${list}

TASK: Find facts that are NEW relative to the existing updates and write at most ${MAX_UPDATES_PER_RUN} ticker updates, most important first.

HARD RULES
- Two-source rule, non-negotiable: an update is only allowed if at least ${MIN_SOURCES} DIFFERENT outlets in the candidate list report the same fact. Put their ids in source_ids. If only one outlet reports it, leave it out completely — no exceptions, no "reportedly", no speculation.
- Never merge two unrelated facts into one update.
- Only use numbers, percentages, seat counts, tolls, names and quotes that appear literally in the candidates.
- If nothing new and confirmed happened, return {"updates":[]}.
- kind is one of: breaking, result, statement, reaction, context.

UPDATE STYLE
- headline: max 90 characters, a factual statement of what happened, no clickbait, no question marks, no drama words.
- body: 2-3 short sentences. Attribute contested claims ("according to …", "X said"). No adjectives that judge.

Return exactly:
{"updates":[{"headline":"...","body":"...","kind":"result","source_ids":[0,3]}]}`,
    },
  ], { temperature: 0.15, maxTokens: 4000 });

  return { data, model };
}

function validateUpdate(raw, candidates, ticker) {
  const ids = [...new Set((raw?.source_ids || []).map(Number))].filter((i) => candidates[i]);
  const sources = ids.map((i) => candidates[i]);
  const outlets = distinctOutlets(sources);
  if (outlets.length < MIN_SOURCES) return { ok: false, reason: `only ${outlets.length} independent outlet(s)` };

  const headline = String(raw?.headline || '').trim();
  const body = String(raw?.body || '').trim();
  if (headline.length < 12 || headline.length > 120) return { ok: false, reason: `headline length ${headline.length}` };
  if (body.length < 40) return { ok: false, reason: 'body too short' };

  const slop = slopHits({ title: headline, dek: body });
  if (slop.length) return { ok: false, reason: `banned phrase: ${slop.join(', ')}` };

  const existing = liveUpdates(ticker).map((u) => u.locales?.en?.headline || u.locales?.[SOURCE_LOCALE]?.headline || '');
  const dup = isDuplicateStory(headline, existing);
  if (dup.isDup) return { ok: false, reason: `duplicate of "${dup.matchingTitle.slice(0, 40)}"` };
  if ((ticker.seenHeadlines || []).some((h) => isDuplicateStory(headline, [h]).isDup)) {
    return { ok: false, reason: 'already rejected in an earlier run' };
  }

  const newest = Math.max(...sources.map((s) => Date.parse(s.publishedAt) || 0), 0);
  const at = new Date(Math.min(Date.now(), newest || Date.now())).toISOString();
  const kind = ['breaking', 'result', 'statement', 'reaction', 'context'].includes(raw?.kind) ? raw.kind : 'context';

  return {
    ok: true,
    update: {
      id: `u-${Date.parse(at)}-${randomId()}`,
      at,
      kind,
      importance: Math.max(1, Math.min(5, +raw?.importance || (outlets.length >= 5 ? 4 : 3))),
      locales: { [SOURCE_LOCALE]: { headline, body } },
      sources: sources.map(({ outlet, title, url, publishedAt }) => ({ outlet, title, url, publishedAt })),
    },
  };
}

// ─────────────────────────── translation ───────────────────────────
// ─────────────────── statistics (one trusted source is enough) ───────────────
// A number is not a narrative: it is either published or it is not. So the
// two-outlet rule does not apply here. Instead every stats snapshot must trace
// to ONE trustworthy source (statistical office, election commission, central
// bank, wire service). Untrusted single sources are dropped.
async function proposeStats(ticker, candidates) {
  const numeric = candidates.filter((c) => /\d/.test(`${c.title} ${c.summary || ''}`)).slice(0, 60);
  if (!numeric.length) return null;

  const list = numeric
    .map((c, i) => `${i}|${c.outlet}|${c.title}|${(c.summary || '').slice(0, 180)}`)
    .join('\n');
  const previous = ticker.stats
    ? JSON.stringify({
        label: ticker.stats.label,
        asOf: ticker.stats.asOf,
        rows: ticker.stats.rows.map((r) => ({ label: r.locales?.[SOURCE_LOCALE]?.label || r.label, value: r.value })),
      })
    : 'none';

  const { data, model } = await chatJSON('live', [
    {
      role: 'system',
      content: `You extract structured statistics for a live ticker at PLAIN., an unbiased news site. You never estimate, never round in your favour and never fill gaps. If the reports do not state the numbers clearly, you return no stats. Return JSON only.`,
    },
    {
      role: 'user',
      content: `EVENT: ${ticker.topic}
CURRENT SNAPSHOT: ${previous}

REPORTS (id|outlet|headline|snippet):
${list}

TASK: Build ONE current statistics snapshot for this event from these reports — party results, counted share, turnout, seat counts, casualty or case counts, rates, prices, levels. Only what this event actually publishes as numbers.

RULES
- Copy numbers exactly as reported. Do not add, average, extrapolate or update them yourself.
- Every row is one number a reader would compare: a party, region, indicator or category.
- label: what the numbers are ("Vote share", "Seats", "Counted", "Turnout"), max 40 characters.
- rows: 2-${STATS_MAX_ROWS} entries with a short label (max 40 chars), a numeric value and an optional change versus the current snapshot (same unit, may be negative).
- unit: "%", "seats", "votes", "" — omit if the rows have no common unit.
- max: only when the scale is known (percent → 100, parliament seats → total seats), otherwise null.
- source_ids: the report ids that state these numbers, best first. Prefer statistical offices, election commissions, central banks, international organisations and wire services.
- as_of: ISO-8601 timestamp of the newest report you used.
- If no report contains a coherent set of numbers, return {"hasStats":false}.

Return exactly:
{"hasStats":true,"label":"…","note":"one sentence on what these numbers are","unit":"%","max":100,"as_of":"2026-10-27T09:10:00Z","source_ids":[3],"rows":[{"label":"…","value":21.4,"change":-2.3}]}`,
    },
  ], { temperature: 0.1, maxTokens: 2500 });

  // The model references reports by their index in `numeric`, not in the full
  // candidate list — so hand that exact list to the normalizer.
  return { data, model, candidates: numeric };
}

function normalizeStats(raw, candidates) {
  if (!raw?.hasStats) return { stats: null, reason: 'model saw no coherent numbers' };

  const ids = [...new Set((raw.source_ids || []).map(Number))].filter((i) => candidates[i]);
  const sources = ids.map((i) => candidates[i]);
  const trusted = sources.find(isTrustedStatsSource);
  if (!trusted) {
    return { stats: null, reason: `no trusted statistics source among ${sources.length} report(s)` };
  }

  const label = String(raw.label || '').trim().slice(0, 60);
  if (label.length < 3) return { stats: null, reason: 'label too short' };

  const rows = [];
  const seen = new Set();
  for (const r of raw.rows || []) {
    const name = String(r?.label || '').trim().slice(0, 40);
    const value = +r?.value;
    if (!name || !Number.isFinite(value)) continue;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      key,
      label: name,
      value,
      change: Number.isFinite(+r?.change) && r?.change !== null && r?.change !== '' ? +r.change : null,
      locales: {},
    });
  }
  if (rows.length < 2) return { stats: null, reason: `only ${rows.length} numeric row(s)` };

  const asOf = Number.isFinite(Date.parse(raw.as_of)) ? new Date(raw.as_of).toISOString() : nowISO();
  return {
    stats: {
      label,
      note: String(raw.note || '').trim().slice(0, 240),
      unit: String(raw.unit || '').trim().slice(0, 12),
      max: Number.isFinite(+raw.max) && +raw.max > 0 ? +raw.max : null,
      asOf,
      updatedAt: nowISO(),
      source: {
        outlet: trusted.outlet,
        title: trusted.title,
        url: trusted.url,
        publishedAt: trusted.publishedAt,
        trusted: true,
      },
      sourceCount: 1,
      rows,
      locales: {},
    },
    reason: null,
  };
}

async function translateStats(stats, previous) {
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);

  // Re-use labels of rows that already existed with the same key.
  for (const locale of targets) {
    const oldMeta = previous?.locales?.[locale];
    stats.locales[locale] = oldMeta ? { ...oldMeta } : {};
    for (const row of stats.rows) {
      const oldRow = previous?.rows?.find((p) => p.key === row.key);
      if (oldRow?.locales?.[locale]) row.locales[locale] = { ...oldRow.locales[locale] };
    }
  }

  const labelChanged = !previous || previous.label !== stats.label;
  const todo = targets.filter((locale) =>
    labelChanged || !stats.locales[locale]?.label || stats.rows.some((r) => !r.locales?.[locale]?.label)
  );
  if (!todo.length) return;

  await pool(todo, TRANSLATE_CONCURRENCY, async (locale) => {
    const rowsNeeded = stats.rows.filter((r) => labelChanged || !r.locales?.[locale]?.label);
    const items = [
      { id: '__meta', headline: stats.label, body: stats.note || '' },
      ...rowsNeeded.map((r, i) => ({ id: r.key || `row-${i}`, headline: r.label })),
    ];
    const map = await translateItems(items, locale, ['headline', 'body']);
    stats.locales[locale] = {
      label: map.__meta?.headline || stats.label,
      note: map.__meta?.body ?? stats.note,
    };
    for (const r of rowsNeeded) {
      const hit = map[r.key];
      if (hit?.headline) r.locales[locale] = { label: hit.headline };
    }
    return locale;
  });
}

/** Refresh the numeric snapshot of one ticker. Returns true when it changed. */
async function refreshStats(ticker, candidates) {
  if (!STATS_ENABLED || !wantsStats(ticker)) return false;
  if (!candidates.length) return false;

  let proposed;
  try {
    proposed = await proposeStats(ticker, candidates);
  } catch (e) {
    log(`  STATS  proposal failed: ${e.message}`);
    return false;
  }
  if (!proposed) return false;

  const { stats, reason } = normalizeStats(proposed.data, proposed.candidates || candidates);
  if (!stats) {
    if (reason) log(`  STATS  skipped: ${reason}`);
    return false;
  }

  const prev = ticker.stats || null;
  const sameRows = prev && JSON.stringify(prev.rows.map((r) => [r.key, r.value])) === JSON.stringify(stats.rows.map((r) => [r.key, r.value]));
  if (prev && prev.label === stats.label && sameRows) return false;

  try {
    await translateStats(stats, prev);
  } catch (e) {
    log(`  STATS  translation failed, keeping English labels: ${e.message}`);
  }

  const snapshot = { at: stats.asOf, rows: stats.rows.map((r) => ({ key: r.key, value: r.value })) };
  const history = [snapshot, ...(ticker.statsHistory || [])]
    .filter((h, i, all) => i === 0 || JSON.stringify(h.rows) !== JSON.stringify(all[i - 1].rows))
    .slice(0, STATS_HISTORY);

  ticker.stats = stats;
  ticker.statsHistory = history;
  ticker.wantsStats = true;
  ticker.meta = { ...(ticker.meta || {}), statsModel: proposed.model };

  log(`  STATS  ${stats.label}: ${stats.rows.slice(0, 4).map((r) => `${r.locales?.[SOURCE_LOCALE]?.label || r.label} ${r.value}${stats.unit}`).join(' · ')} (${stats.source.outlet})`);
  await saveLiveTicker(ticker);
  return true;
}

async function translateItems(items, locale, fields) {
  const lang = LOCALES.find((l) => l.code === locale);
  const payload = items.map((it) => Object.fromEntries([['id', it.id], ...fields.map((f) => [f, it[f]])]));
  const { data } = await chatJSON('translator', [
    {
      role: 'system',
      content: `You are a professional news translator. Translate every item into ${lang.label} (${lang.bcp47}) in the neutral register of a quality newspaper in that language. Keep meaning exact and keep length close to the original. Never add or remove information. Keep names, numbers, dates and quotes accurate, using the established local spelling. Reply with JSON only: {"items":[{"id":"...","...":"..."}]} with the same ids, the same keys and the same number of items.`,
    },
    { role: 'user', content: JSON.stringify({ items: payload }) },
  ], { temperature: 0.2, maxTokens: 5000 });

  const byId = new Map((data.items || []).map((i) => [String(i.id), i]));
  return Object.fromEntries(items.map((it) => {
    const t = byId.get(String(it.id)) || {};
    return [it.id, Object.fromEntries(fields.map((f) => [f, t[f] || it[f]]))];
  }));
}

async function translateUpdates(updates, ticker) {
  const targets = LOCALES.map((l) => l.code).filter((c) => c !== SOURCE_LOCALE);
  if (updates.length) {
    await pool(targets, TRANSLATE_CONCURRENCY, async (locale) => {
      const map = await translateItems(
        updates.map((u) => ({ id: u.id, headline: u.locales[SOURCE_LOCALE].headline, body: u.locales[SOURCE_LOCALE].body })),
        locale,
        ['headline', 'body']
      );
      for (const u of updates) {
        u.locales[locale] = map[u.id] || { headline: u.locales[SOURCE_LOCALE].headline, body: u.locales[SOURCE_LOCALE].body };
      }
      return locale;
    });
  }
  // Ticker title/dek for every language (only when missing).
  const missing = LOCALES.map((l) => l.code).filter((c) => !ticker.locales?.[c]?.title);
  if (missing.length) {
    await pool(missing, TRANSLATE_CONCURRENCY, async (locale) => {
      const map = await translateItems(
        [{ id: 'ticker', headline: ticker.locales[SOURCE_LOCALE].title, body: ticker.locales[SOURCE_LOCALE].dek || '' }],
        locale,
        ['headline', 'body']
      );
      const t = map.ticker || {};
      ticker.locales[locale] = { title: t.headline || ticker.locales[SOURCE_LOCALE].title, dek: t.body || ticker.locales[SOURCE_LOCALE].dek || '' };
      return locale;
    });
  }
}

// ─────────────────────────── linked article ───────────────────────────
function sourceLine(sources) {
  const seen = new Set();
  return sources
    .filter((s) => {
      const k = s.url;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 14)
    .map((s) => `[${s.outlet}] ${s.title} (${s.publishedAt}) ${s.url}`)
    .join('\n');
}

async function writeArticle(ticker) {
  const updates = liveUpdates(ticker).slice(0, 30).reverse(); // oldest → newest
  const allSources = updates.flatMap((u) => u.sources);
  const previous = ticker.article?.locales?.[SOURCE_LOCALE] || null;

  const { data, model } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are the live-desk reporter at PLAIN. You maintain ONE running news article about a continuing event. Each version must stand on its own for a reader who arrives right now.
${STYLE_GUIDE}
Return JSON only.`,
    },
    {
      role: 'user',
      content: `EVENT: ${ticker.topic}

${previous ? `PREVIOUS VERSION (keep what is still accurate, update what changed):\n${JSON.stringify(previous).slice(0, 4000)}\n` : ''}
VERIFIED UPDATES (oldest first, each already confirmed by ≥2 independent outlets):
${updates.map((u) => `--- ${u.at}\n${u.locales[SOURCE_LOCALE].headline}\n${u.locales[SOURCE_LOCALE].body}`).join('\n')}

SOURCES:
${sourceLine(allSources)}

Write the current version of the article:
- title: factual headline, max 90 characters. If the previous title is still accurate, keep it unchanged.
- dek: one sentence, max 30 words.
- facts: 4-6 short current key facts (counts, results, decisions) — only from the updates.
- body: 6-9 paragraphs, 2-4 sentences each. Lead with the newest confirmed state, then how it developed, then background and reactions. Attribute everything.
- context: 1-3 sentences of neutral background from the sources.
- Do not announce speculation, projections or exit polls as results.
- No "live blog" filler, no "welcome to our coverage".

Return exactly:
{"title":"...","dek":"...","facts":["..."],"body":["..."],"context":"..."}`,
    },
  ], { temperature: 0.25, maxTokens: 8000 });

  return { draft: data, model };
}

function validArticle(a) {
  return a && typeof a.title === 'string' && a.title.length > 10 && a.title.length <= 120
    && a.dek && Array.isArray(a.body) && a.body.length >= 3
    && Array.isArray(a.facts) && a.facts.length >= 2;
}

async function refreshArticle(ticker, reason) {
  const { draft, model } = await writeArticle(ticker);
  const en = {
    title: String(draft.title || '').trim(),
    dek: String(draft.dek || '').trim(),
    facts: (draft.facts || []).map((f) => String(f).trim()).filter(Boolean).slice(0, 6),
    body: (draft.body || []).map((p) => String(p).trim()).filter(Boolean),
    context: String(draft.context || '').trim(),
    imageCaption: '',
  };
  if (!validArticle(en)) throw new Error('live article invalid');
  if (slopHits(en).length) throw new Error(`live article has banned phrases: ${slopHits(en).join(', ')}`);

  const deMap = await translateItems(
    [{ id: 'a', headline: en.title, body: JSON.stringify({ dek: en.dek, facts: en.facts, body: en.body, context: en.context }) }],
    'de',
    ['headline', 'body']
  );
  let de = { title: en.title, dek: en.dek, facts: en.facts, body: en.body, context: en.context };
  try {
    const t = deMap.a || {};
    const parsed = JSON.parse(t.body);
    de = {
      title: t.headline || en.title,
      dek: parsed.dek || en.dek,
      facts: Array.isArray(parsed.facts) && parsed.facts.length ? parsed.facts : en.facts,
      body: Array.isArray(parsed.body) && parsed.body.length ? parsed.body : en.body,
      context: parsed.context || en.context,
    };
  } catch {
    log('  article translation to DE failed, keeping EN text in DE slot');
  }

  const version = ticker.article?.locales
    ? {
        at: ticker.article.updatedAt || ticker.startedAt,
        reason: ticker.article.reason || 'previous version',
        locales: { en: ticker.article.locales.en, de: ticker.article.locales.de },
      }
    : null;

  const slug = ticker.articleSlug;
  const existing = loadArticle(slug);
  const history = [version, ...(ticker.article?.versions || existing?.history || [])]
    .filter(Boolean)
    .slice(0, MAX_VERSIONS);

  const sources = [];
  const seen = new Set();
  for (const u of liveUpdates(ticker)) {
    for (const s of u.sources || []) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push({ outlet: s.outlet, title: s.title, url: s.url, publishedAt: s.publishedAt });
    }
  }

  const doc = {
    slug,
    category: ticker.category,
    image: existing?.image || null,
    imageCredit: existing?.imageCredit || null,
    video: null,
    importance: ticker.importance,
    publishedAt: existing?.publishedAt || ticker.startedAt,
    updatedAt: nowISO(),
    sourcePolicy: 'two-source',
    live: true,
    liveSlug: ticker.slug,
    stats: ticker.stats || null,
    sources: sources.slice(0, 20),
    locales: { en, de },
    history,
    meta: {
      writer: model,
      editor: null,
      desk: 'Live Desk',
      verdict: 'live-update',
      problemsFixed: [],
      updatedReason: reason,
    },
  };
  saveArticle(doc);

  const index = loadIndex();
  const entry = toIndexEntry(doc);
  const pos = index.articles.findIndex((a) => a.slug === slug);
  if (pos >= 0) index.articles[pos] = entry;
  else index.articles.unshift(entry);
  saveIndex(index);

  ticker.article = {
    slug,
    updatedAt: doc.updatedAt,
    reason,
    locales: { en, de },
    versions: history,
  };
  log(`  ARTICLE updated (${history.length} versions kept, ${sources.length} sources, DE ${de.title.slice(0, 40)}…)`);
}

/**
 * Mirror the current numbers into the running article without rewriting it.
 * A new snapshot must be visible on the article page even when no new headline
 * was confirmed — otherwise the election count would sit still for 25 minutes.
 */
function syncArticleStats(ticker) {
  const slug = ticker.articleSlug;
  if (!slug || !ticker.stats) return false;
  const existing = loadArticle(slug);
  if (!existing) return false;
  existing.stats = ticker.stats;
  existing.updatedAt = nowISO();
  saveArticle(existing);

  const index = loadIndex();
  const pos = index.articles.findIndex((a) => a.slug === slug);
  if (pos >= 0) {
    index.articles[pos] = toIndexEntry(existing);
    saveIndex(index);
  }
  return true;
}

// ─────────────────────────── per-ticker run ───────────────────────────
async function updateTicker(ticker, items, { forceArticle = false } = {}) {
  const candidates = collectCandidates(ticker, items);
  log(`LIVE   ${ticker.slug}: ${candidates.length} new matching headlines from ${distinctOutlets(candidates).length} outlets`);

  // Numbers are refreshed from ALL matching reports, not only unseen ones: an
  // election count changes in place, it is not a new headline.
  const statsChanged = await refreshStats(ticker, items.filter((i) => matchesTicker(i, ticker)));
  if (statsChanged) syncArticleStats(ticker);

  if (!candidates.length) return { added: 0, stats: statsChanged };

  const { data, model } = await proposeUpdates(ticker, candidates);
  const raw = Array.isArray(data.updates) ? data.updates.slice(0, MAX_UPDATES_PER_RUN) : [];
  if (!raw.length) {
    log('  no new confirmed development');
    return { added: 0 };
  }

  const accepted = [];
  for (const r of raw) {
    if (accepted.length >= MAX_UPDATES_PER_RUN) break;
    const v = validateUpdate(r, candidates, ticker);
    if (!v.ok) {
      log(`  drop: ${v.reason}`);
      ticker.seenHeadlines = [String(r?.headline || '').slice(0, 120), ...(ticker.seenHeadlines || [])].slice(0, 300);
      continue;
    }
    accepted.push(v.update);
  }
  if (!accepted.length) return { added: 0 };

  await translateUpdates(accepted, ticker);
  ticker.updates = [...accepted, ...(ticker.updates || [])].slice(0, MAX_UPDATES);
  ticker.seenUrls = [...new Set([...(ticker.seenUrls || []), ...candidates.map((c) => c.url)])].slice(-4000);
  ticker.updatedAt = nowISO();
  ticker.importance = Math.max(
    ticker.importance || 3,
    importanceFromCoverage({
      outlets: distinctOutlets(liveUpdates(ticker).flatMap((u) => u.sources || [])).length,
      ageHours: 0,
      watch: watchScore(ticker.topic),
      category: ticker.category,
    })
  );
  ticker.sourceCount = distinctOutlets(liveUpdates(ticker).flatMap((u) => u.sources || [])).length;
  ticker.meta = { ...(ticker.meta || {}), lastUpdateModel: model };

  log(`  + ${accepted.length} update(s): ${accepted.map((u) => u.locales[SOURCE_LOCALE].headline.slice(0, 50)).join(' | ')}`);

  const lastArticle = ticker.article?.updatedAt ? Date.parse(ticker.article.updatedAt) : 0;
  const dueForArticle = forceArticle || !lastArticle || Date.now() - lastArticle > ARTICLE_REFRESH_MIN * 60e3;
  if (dueForArticle) {
    try {
      await refreshArticle(ticker, `${accepted.length} new update(s)`);
    } catch (e) {
      log(`  article refresh failed: ${e.message}`);
    }
  }

  const saved = await saveLiveTicker(ticker);
  log(`  saved (supabase: ${saved.supabase ? 'yes' : `no — ${saved.error || 'not configured'}`})`);
  return { added: accepted.length, stats: statsChanged };
}

async function maybeEnd(ticker) {
  if (ticker.status !== 'live') return;
  const last = liveLastAt(ticker);
  if (!last) return;
  const idleH = (Date.now() - Date.parse(last)) / 3600e3;
  if (idleH < IDLE_END_HOURS) return;
  ticker.status = 'ended';
  ticker.endedAt = last;
  ticker.updatedAt = nowISO();
  await saveLiveTicker(ticker);
  log(`LIVE   ${ticker.slug}: no confirmed update for ${idleH.toFixed(1)}h → closed`);
}

// ─────────────────────────── detection / creation ───────────────────────────
function stableSlug(title) {
  return String(title)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').slice(0, 8).join('-').slice(0, 80) || 'live-event';
}

const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'first', 'report', 'reports', 'study', 'amid', 'during', 'could', 'would', 'which', 'while', 'where', 'there', 'these', 'those', 'today', 'latest', 'update', 'updates', 'live', 'breaking']);

function words(text) {
  return new Set(
    String(text).toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
  );
}

function clusterLiveItems(items) {
  const poolItems = items.filter((i) => i.isLive || (i.watch || 0) >= 2);
  const clusters = [];
  for (const it of poolItems) {
    const w = words(`${it.title} ${it.summary || ''}`);
    let target = null;
    for (const c of clusters) {
      let shared = 0;
      for (const x of w) if (c.rep.has(x)) { shared++; if (shared >= 3) break; }
      if (shared >= 3) { target = c; break; }
    }
    if (target) target.items.push(it);
    else clusters.push({ rep: w, items: [it] });
  }
  return clusters.filter((c) => c.items.length >= 2);
}

function coveredByTicker(text, tickers) {
  return tickers.some((t) => keywordHits(text, t.keywords || []) >= 2);
}

async function confirmLiveEvent(cluster) {
  const list = cluster.items
    .slice(0, 24)
    .map((i, n) => `${n}|${i.outlet}|${i.publishedAt.slice(0, 16).replace('T', ' ')}|${i.title}`)
    .join('\n');
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: 'You are the planning editor of an unbiased news site. You decide whether an event deserves its own live ticker. Return JSON only, never prose.',
    },
    {
      role: 'user',
      content: `These headlines appeared within the last hours:

${list}

Decision: is this ONE specific, continuing real-world event (an election, a war, a disaster, a court case, a central-bank decision) that will produce a stream of new confirmed facts over the next hours or days?
- A general topic ("the economy", "the Middle East") is not an event.
- A single one-off story is not an event.
- If yes, return a neutral ticker label, a one-sentence dek, and 6-12 lowercase keywords that will match follow-up headlines. Include proper nouns, place names and office holders; avoid words like "news", "report", "today".

Return exactly:
{"create":true,"title":"…","dek":"…","category":"world|politics|business|tech|science|climate|health|culture|sport","keywords":["…"],"importance":1}
or {"create":false,"reason":"…"}`,
    },
  ], { temperature: 0.2, maxTokens: 800 });

  return data;
}

async function createTickerFromCluster(cluster, items) {
  const outlets = distinctOutlets(cluster.items);
  const text = cluster.items.map((i) => i.title).join(' ');
  const verdict = await confirmLiveEvent(cluster);
  if (!verdict?.create || !verdict.title) {
    log(`DETECT  rejected candidate ("${cluster.items[0].title.slice(0, 50)}"): ${verdict?.reason || 'not one continuing event'}`);
    return null;
  }

  const title = String(verdict.title).trim().slice(0, 110);
  const keywords = [...new Set((verdict.keywords || []).map((k) => String(k).toLowerCase().trim()).filter((k) => k.length >= 3))].slice(0, 14);
  if (!keywords.length) {
    log('DETECT  no usable keywords, skipping');
    return null;
  }
  const category = CATEGORIES.includes(verdict.category) ? verdict.category : 'world';
  const ticker = {
    slug: stableSlug(title),
    status: 'live',
    category,
    importance: Math.max(
      Number.isFinite(+verdict.importance) ? +verdict.importance : 3,
      importanceFromCoverage({ outlets: outlets.length, ageHours: 0, watch: watchScore(text), category })
    ),
    topic: title,
    keywords,
    startedAt: nowISO(),
    endedAt: null,
    updatedAt: nowISO(),
    articleSlug: null,
    sourceCount: outlets.length,
    wantsStats: wantsStats({ topic: title, keywords }),
    updates: [],
    seenUrls: [],
    seenHeadlines: [],
    locales: {
      [SOURCE_LOCALE]: {
        title,
        dek: String(verdict.dek || '').trim().slice(0, 220),
      },
    },
    article: null,
    meta: { createdBy: 'bots/live.mjs', outlets: outlets.slice(0, 12) },
  };
  ticker.articleSlug = ticker.slug;
  log(`DETECT  new ticker "${title}" (${outlets.length} outlets, keywords: ${keywords.join(', ')})`);

  // First batch of updates + the initial article.
  await updateTicker(ticker, items, { forceArticle: true });
  // Translate the ticker label only after the first save so a failure is visible.
  await translateUpdates([], ticker);
  await saveLiveTicker(ticker);
  return ticker;
}

async function detectNewTicker(items, tickers) {
  const clusters = clusterLiveItems(items);
  const candidates = clusters
    .map((c) => ({
      cluster: c,
      outlets: distinctOutlets(c.items).length,
      watch: Math.max(0, ...c.items.map((i) => i.watch || 0)),
      newest: Math.max(0, ...c.items.map((i) => Date.parse(i.publishedAt) || 0)),
    }))
    .filter((c) => c.outlets >= MIN_OUTLETS_CREATE && c.watch >= 2 && isLiveWorthy(c.cluster.items.map((i) => i.title).join(' ')))
    .filter((c) => !coveredByTicker(c.cluster.items.map((i) => i.title).join(' '), tickers))
    .sort((a, b) => (b.watch * 1000 + b.outlets * 25 + b.newest / 1e9) - (a.watch * 1000 + a.outlets * 25 + a.newest / 1e9));

  if (!candidates.length) {
    log('DETECT  no new live-worthy event with enough coverage');
    return null;
  }
  for (const c of candidates.slice(0, MAX_NEW_TICKERS)) {
    try {
      const ticker = await createTickerFromCluster(c.cluster, items);
      if (ticker) return ticker;
    } catch (e) {
      log(`DETECT  creation failed: ${e.message}`);
    }
  }
  return null;
}

// ─────────────────────────── manual controls ───────────────────────────
async function manualCreate(args) {
  const title = args.title || args.create;
  if (!title) throw new Error('--create needs a title: node bots/live.mjs --create "Israel election 2026" --keywords "israel,knesset,wahl,netanjahu"');
  const { items } = await fetchFeeds(FEEDS, { maxAgeHours: WINDOW_HOURS, perFeed: PER_FEED });
  for (const it of items) it.watch = watchScore(`${it.title} ${it.summary || ''}`);
  const keywords = (args.keywords || title).split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  const ticker = {
    slug: stableSlug(title),
    status: 'live',
    category: CATEGORIES.includes(args.category) ? args.category : 'politics',
    importance: 4,
    topic: args.topic || title,
    keywords,
    startedAt: nowISO(),
    endedAt: null,
    updatedAt: nowISO(),
    articleSlug: null,
    sourceCount: 0,
    wantsStats: wantsStats({ topic: title, keywords }),
    updates: [],
    seenUrls: [],
    seenHeadlines: [],
    locales: { [SOURCE_LOCALE]: { title, dek: args.topic || '' } },
    article: null,
    meta: { createdBy: 'manual' },
  };
  ticker.articleSlug = ticker.slug;
  log(`MANUAL creating "${title}" with keywords ${keywords.join(', ')}`);
  await updateTicker(ticker, items, { forceArticle: true });
  await translateUpdates([], ticker);
  await saveLiveTicker(ticker);
  log(`MANUAL done: /live/${ticker.slug}`);
}

async function manualEnd(slug) {
  const { tickers } = await listLiveTickers({ status: 'live', limit: 50 });
  const t = tickers.find((x) => x.slug === slug);
  if (!t) throw new Error(`no live ticker "${slug}"`);
  t.status = 'ended';
  t.endedAt = nowISO();
  t.updatedAt = nowISO();
  await saveLiveTicker(t);
  log(`MANUAL closed ${slug}`);
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--create' || a === '--end') args[a.slice(2)] = argv[++i];
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }

  if (args.end) return manualEnd(args.end);
  if (args.create) return manualCreate(args);

  log(`RADAR  fetching ${FEEDS.length} feeds (last ${WINDOW_HOURS}h)…`);
  const { items, feedsOk } = await fetchFeeds(FEEDS, { maxAgeHours: WINDOW_HOURS, perFeed: PER_FEED });
  for (const it of items) {
    const text = `${it.title} ${it.summary || ''}`;
    it.watch = watchScore(text);
    if (isLiveWorthy(text)) it.isLive = true;
  }
  log(`RADAR  ${feedsOk}/${FEEDS.length} feeds ok, ${items.length} items`);

  const { tickers } = await listLiveTickers({ status: 'live', limit: 25 });
  log(`LIVE   ${tickers.length} active ticker(s): ${tickers.map((t) => t.slug).join(', ') || 'none'}`);

  if (AUTO_CREATE) {
    try {
      const created = await detectNewTicker(items, tickers);
      if (created && !tickers.some((t) => t.slug === created.slug)) tickers.push(created);
    } catch (e) {
      log(`DETECT  failed: ${e.message}`);
    }
  }

  let added = 0;
  for (const ticker of tickers) {
    try {
      const r = await updateTicker(ticker, items);
      added += r.added || 0;
    } catch (e) {
      log(`LIVE   ${ticker.slug} failed: ${e.message}`);
    }
    await maybeEnd(ticker).catch((e) => log(`  end-check failed: ${e.message}`));
  }

  log(`\nDone. ${added} new update(s) across ${tickers.length} ticker(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
