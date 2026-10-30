#!/usr/bin/env node
// PLAIN. INVESTIGATIVE DESK
//
// One dossier can run for months. Every run advances it by one small step:
//
//   INTAKE    Monday: pick at most two reader wishes (or a topic the desk finds
//             itself) — out of at most ten wishes per week.
//   RESEARCH  search, read, extract claims with a source for each, list gaps
//   OUTREACH  draft questions to the institutions involved; a human approves
//             every email before it leaves. Replies land back in the dossier.
//   WRITE     only when the material holds: enough independent sources, enough
//             verified claims, and a right of reply that was actually granted
//             time. Then a deep piece, verified claim by claim.
//   REVIEW    a human editor approves. Nothing publishes without that.
//
// State lives in content/investigations/<slug>.json (git), mirrored into
// Supabase for the admin UI and the reader pages.
import fs from 'node:fs';
import path from 'node:path';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

import { chatJSON, setDeadline, deadlineLeft } from './lib/llm.mjs';
import { fetchFeeds, fetchArticleDetails } from './lib/feeds.mjs';
import { DESK_FEEDS } from './sources.mjs';
import { googleNews, bingNews, webSearch, wideSearch } from './lib/search.mjs';
import { filingCabinets } from './lib/lookup.mjs';
import { openPage } from './lib/browse.mjs';
import { runAgent } from './lib/agent.mjs';
import { STYLE_GUIDE, slopHits, styleProblems } from './lib/style.mjs';
import { collectImages, assignImages } from './lib/illustrate.mjs';
import { loadIndex, saveIndex, saveArticle, toIndexEntry, slugify } from './lib/store.mjs';
import { distinctOutlets, isPrimaryOutlet } from '../lib/editorial.mjs';
import { LOCALES, SOURCE_LOCALE, SITE } from '../lib/config.mjs';
import { terminologyFor } from './lib/terminology.mjs';
import { INVESTIGATION_QUOTAS, weekKey } from '../lib/investigations.mjs';
import {
  addOutreach,
  listOutreach,
  listRequests,
  requestOutreach,
  setInvestigationStatus,
  setOutreach,
  setRequestStatus,
  upsertInvestigation,
} from '../lib/investigationStore.mjs';
import { listMessages, markMessages } from '../lib/inboxStore.mjs';

// ─────────────────────────── config ───────────────────────────
const DOSSIER_DIR = 'content/investigations';
const STATE_FILE = path.join(DOSSIER_DIR, 'state.json');
const DRY_RUN = process.env.INVESTIGATE_DRY_RUN === '1';
const FORCE_SLUG = String(process.env.INVESTIGATE_SLUG || '').trim();
const CAN_SEND = !DRY_RUN && (process.env.GITHUB_ACTIONS === 'true' || process.env.INVESTIGATE_SEND === '1');
const MIN_SOURCES = Math.max(4, +(process.env.INVESTIGATE_MIN_SOURCES || 8));
const MIN_PRIMARY = Math.max(0, +(process.env.INVESTIGATE_MIN_PRIMARY || 2));
const MIN_CLAIMS = Math.max(3, +(process.env.INVESTIGATE_MIN_CLAIMS || 6));
const MIN_WORDS = Math.max(1200, +(process.env.INVESTIGATE_MIN_WORDS || 2500));
const REPLY_HOURS = Math.max(24, +(process.env.INVESTIGATE_REPLY_HOURS || 72));
const MAX_READS = Math.max(2, +(process.env.INVESTIGATE_MAX_READS || 6));
const MAX_SOURCE_CHARS = 6000;
const TRANSLATE_CONCURRENCY = Math.max(1, +(process.env.INVESTIGATE_TRANSLATE_CONCURRENCY || 3));
const TRANSLATE_LOCALES = String(process.env.INVESTIGATE_LOCALES || 'en,de,fr,es,it,pt')
  .split(',').map((s) => s.trim()).filter((c) => LOCALES.some((l) => l.code === c));
const EDITORIAL_EMAIL = process.env.INVESTIGATE_REPLY_TO || process.env.RESEND_FROM_EMAIL || 'simoneggert16@gmail.com';

// The desk answers under its own threaded address, so a reply lands on the
// right dossier instead of in the general editorial inbox.
const deskAddress = (slug) => (process.env.DESK_EMAIL_DOMAIN ? `desk+${slug}@${process.env.DESK_EMAIL_DOMAIN}` : EDITORIAL_EMAIL);
const ACTIVE_STATUSES = ['pitch', 'research', 'outreach', 'drafting', 'review', 'approved'];

setDeadline(Date.now() + Math.max(10, +(process.env.INVESTIGATE_MINUTES || 50)) * 60000);

const nowISO = () => new Date().toISOString();
const log = (...a) => process.stdout.write(`${nowISO().slice(11, 19)} ${a.join(' ')}\n`);
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const ageHours = (iso) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600e3);
const isActive = (d) => ACTIVE_STATUSES.includes(d.status);

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch((e) => ({ error: e })); }
  }));
  return out;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    log(`  ! ${err.message}`);
    return fallback;
  }
}

// A stalled call must not eat the shift. The promise keeps running in the
// background; the desk simply moves on.
function withDeadline(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} did not answer within ${Math.round(ms / 1000)}s`)), ms)),
  ]);
}

// Google News refuses most datacenter requests, so the search feeds come back
// nearly empty on GitHub runners. The desk's own watchlist of world outlets and
// primary sources is always read in addition.
const HOME_FEEDS = DESK_FEEDS;

// ─────────────────────────── dossier storage ───────────────────────────
function loadDossiers() {
  if (!fs.existsSync(DOSSIER_DIR)) return [];
  return fs.readdirSync(DOSSIER_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'state.json')
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(DOSSIER_DIR, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean);
}

function saveDossier(d) {
  d.updatedAt = nowISO();
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_DIR, `${d.slug}.json`), `${JSON.stringify(d, null, 2)}\n`);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

function saveState(s) {
  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(s, null, 2)}\n`);
}

function note(d, status, message) {
  if (status) d.status = status;
  d.history = [...(d.history || []), { at: nowISO(), status: d.status, note: message }].slice(-80);
}

function newDossier({ title, angle, category, queries, origin, requestId = null, brief = null, priority = 2 }) {
  const ts = nowISO();
  return {
    slug: slugify(title),
    title,
    angle,
    category,
    status: 'pitch',
    priority,
    origin,
    requestId,
    brief,
    createdAt: ts,
    updatedAt: ts,
    queries: queries || [],
    keywords: [],
    sources: [],
    claims: [],
    gaps: [],
    contacts: [],
    outreach: [],
    draft: null,
    review: null,
    published: null,
    history: [{ at: ts, status: 'pitch', note: `opened (${origin})` }],
  };
}

function addSource(d, item, extra = {}) {
  const url = String(item.url || '').trim();
  if (!url || d.sources.some((s) => s.url === url)) return false;
  d.sources.push({
    id: `S${d.sources.length + 1}`,
    url,
    outlet: item.outlet || 'unknown',
    title: String(item.title || '').slice(0, 300),
    publishedAt: item.publishedAt || null,
    // The filing cabinets know what they are; the feed path has to guess from
    // the address.
    primary: item.primary != null ? Boolean(item.primary) : Boolean(isPrimaryOutlet(item.outlet)) || /(^|\.)(gov|admin|int)(\.|$)|europa\.eu|parlament|bundesgericht|court|un\.org/i.test(url),
    kind: extra.kind || 'news',
    addedAt: nowISO(),
    text: null,
  });
  return true;
}

const STOPWORDS = new Set(['this', 'that', 'with', 'from', 'have', 'were', 'been', 'will', 'about', 'after', 'over', 'into', 'says', 'said', 'their', 'under', 'more', 'what', 'when', 'where', 'which', 'while', 'there', 'these', 'those', 'should', 'would', 'could', 'were', 'deutsch', 'thema', 'einer', 'eines', 'einem', 'einen', 'diese', 'dieser', 'diesem', 'werden', 'wurde', 'wurden', 'nicht', 'auch', 'sowie', 'oder', 'aber', 'noch', 'nur', 'schon', 'sich', 'sind', 'dass', 'nach', 'ueber', 'über', 'beim', 'vom', 'zum', 'zur', 'durch', 'gegen', 'ohne', 'zwischen', 'immer', 'jeder', 'jede', 'jedes', 'keine', 'mehr', 'sowie']);

function keywordsOf(d) {
  // The brief comes first: it is where the editor names the exact terms the
  // primary sources use, so those must survive the cap.
  const text = `${(d.brief?.hints || '')} ${d.brief?.topic || ''} ${d.brief?.region || ''} ${d.title} ${d.angle}`;
  const seeded = (Array.isArray(d.keywords) ? d.keywords : []).map((k) => String(k).toLowerCase());
  const set = new Set([
    ...seeded,
    ...String(text).toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !STOPWORDS.has(w)),
  ]);
  return [...set].slice(0, 24);
}

function keywordHits(text, keywords) {
  const t = String(text).toLowerCase();
  return keywords.reduce((n, k) => (k && t.includes(k.toLowerCase()) ? n + 1 : n), 0);
}

// Words that describe any story at all. They may never carry a source on
// their own, or every hack in the world matches this investigation.
const GENERIC = new Set(['attack', 'attacks', 'breach', 'hack', 'hacks', 'hacked', 'hacker', 'theft', 'stolen', 'money', 'police', 'report', 'reports', 'reported', 'news', 'story', 'article', 'update', 'latest', 'first', 'last', 'year', 'years', 'said', 'says', 'told', 'after', 'before', 'people', 'group', 'case', 'file', 'files', 'work', 'works', 'world', 'official', 'officials', 'search', 'data', 'part', 'partners', 'investigation', 'investigations', 'business', 'company', 'companies']);

function coreTermsOf(d) {
  const text = `${d.title} ${d.angle} ${d.brief?.topic || ''}`;
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !GENERIC.has(w));
  return [...new Set(words)].slice(0, 12);
}

// ─────────────────────────── 1. INTAKE ───────────────────────────
const DESK_RADAR = [
  ['public procurement', 'public tender irregularities contract award audit'],
  ['audit office', 'court of auditors report misuse of public funds'],
  ['subsidies', 'subsidy recipients lobby register transparency'],
  ['EU funds', 'EU funds fraud OLAF investigation report'],
  ['UN agencies', 'United Nations agency procurement internal audit misuse'],
  ['development finance', 'World Bank project complaint inspection panel'],
  ['sanctions', 'sanctions enforcement evasion investigation'],
  ['arms trade', 'arms export licence investigation'],
  ['lobbying', 'lobbying disclosure ministers meetings register'],
  ['courts', 'court ruling government secrecy documents access'],
  // State crime and cyber theft: the money that moves is the trail, and the
  // people who lose it are the reason to report it.
  ['state hacking', 'state-sponsored cyber theft attribution North Korea Lazarus investigation'],
  ['crypto theft', 'crypto exchange hack laundering sanctions evasion victims investigation'],
  // People, not process: the desk also follows what is taken from people.
  ['indigenous rights', 'indigenous peoples land rights eviction extraction investigation'],
  ['natural resources', 'illegal fishing logging mining protected area biodiversity investigation'],
];

async function intake(dossiers, state) {
  const week = weekKey();
  if (FORCE_SLUG) return;
  if (state.lastIntake === week && process.env.INVESTIGATE_INTAKE !== '1') {
    log(`INTAKE  already done for ${week}`);
    return;
  }

  const active = dossiers.filter(isActive);
  if (active.length >= INVESTIGATION_QUOTAS.maxActive) {
    log(`INTAKE  ${active.length} active dossiers (max ${INVESTIGATION_QUOTAS.maxActive}) — no new topic this week`);
    state.lastIntake = week;
    return;
  }
  const openedThisWeek = dossiers.filter((d) => weekKey(new Date(d.createdAt)) === week && !['archived', 'dropped'].includes(d.status)).length;
  let slots = Math.min(INVESTIGATION_QUOTAS.newPerWeek - openedThisWeek, INVESTIGATION_QUOTAS.maxActive - active.length);
  if (slots <= 0) {
    log(`INTAKE  ${openedThisWeek} dossier(s) opened this week (max ${INVESTIGATION_QUOTAS.newPerWeek})`);
    state.lastIntake = week;
    return;
  }

  const requests = await safe(() => listRequests({ status: 'new', limit: 40 }), []);
  log(`INTAKE  ${requests.length} open reader wish(es), ${slots} slot(s)`);

  if (requests.length) {
    const picks = await pickRequests(requests, slots);
    for (const pick of picks) {
      const request = requests.find((r) => String(r.id) === String(pick.id));
      if (!request) continue;
      const dossier = newDossier({
        title: pick.title || request.topic,
        angle: pick.angle,
        category: pick.category,
        queries: pick.queries,
        origin: 'reader',
        requestId: request.id,
        priority: 1,
        brief: { topic: request.topic, why: request.why, region: request.region, hints: request.hints },
      });
      if (dossiers.some((d) => d.slug === dossier.slug)) continue;
      dossiers.push(dossier);
      await safe(() => setRequestStatus(request.id, 'selected', dossier.slug));
      log(`INTAKE  ✓ reader wish → ${dossier.slug}`);
      slots--;
    }
  }

  if (slots > 0) {
    const topic = await deskTopic();
    if (topic) {
      const dossier = newDossier({ ...topic, origin: 'desk', priority: 3 });
      if (!dossiers.some((d) => d.slug === dossier.slug)) {
        dossiers.push(dossier);
        log(`INTAKE  ✓ own topic → ${dossier.slug}`);
      }
    } else {
      log('INTAKE  no own topic met the bar this week');
    }
  }

  state.lastIntake = week;
}

async function pickRequests(requests, slots) {
  const list = requests.slice(0, 25).map((r, i) => {
    return `#${i + 1} id=${r.id}\nTOPIC: ${r.topic}\nWHY: ${r.why || '-'}\nREGION: ${r.region || '-'}\nHINTS: ${r.hints || '-'}`;
  }).join('\n\n');

  try {
    const { data, model } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You are the investigative editor of PLAIN., a small independent news site. The desk works internationally: prefer stories that cross borders or touch an international institution, and treat purely national affairs as a last resort. You commission at most two investigations per week and you would rather open one than open a weak one. You write about people: a topic where nobody can be named as losing, profiting or living with the consequences is a process topic, not a story. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Reader wishes for this week:\n\n${list}\n\nChoose at most ${slots} to investigate over the coming weeks or months.

A topic qualifies only if ALL of these hold:
- public interest (money, power, safety, rights), not a private dispute or a personal grievance;
- a concrete, verifiable core: decisions, contracts, payments, appointments, court rulings, documents;
- answerable with public records, data, court files and email questions to the institutions — no hidden sources are needed;
- not already covered by our own archive as an investigation;
- serious enough to justify weeks of work;
- people are visible in it: the readers who asked for it, the people it is done to, the ones who profit from it. Preference goes to stories where ordinary people carry the consequences of what powerful actors decide.

Reject speculation, conspiracy framing, "someone should look into X" without a specific institution or decision, and topics that are really opinion.

Return exactly:
{"picks":[{"id":"the id above","title":"working headline, max 90 characters, factual","angle":"one sentence: the question the investigation answers","category":"politics|business|world|tech|science|climate|health|culture|sport","queries":["4-6 search queries in the language of the primary sources, each with the specific institution, programme or decision"]}]}
Return {"picks":[]} if nothing qualifies.`,
      },
    ], { temperature: 0.3, maxTokens: 2000 });
    const picks = (Array.isArray(data.picks) ? data.picks : [])
      .filter((p) => p && p.id)
      .slice(0, slots)
      .map((p) => ({
        id: p.id,
        title: String(p.title || '').trim().slice(0, 120),
        angle: String(p.angle || '').trim().slice(0, 300),
        category: String(p.category || 'politics'),
        queries: (Array.isArray(p.queries) ? p.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6),
      }));
    log(`INTAKE  desk model ${model} selected ${picks.length}`);
    return picks;
  } catch (err) {
    log(`INTAKE  selection failed: ${err.message}`);
    return [];
  }
}

async function deskTopic() {
  const weekNum = Number(weekKey().split('-W')[1]) || 1;
  const picks = [DESK_RADAR[weekNum % DESK_RADAR.length], DESK_RADAR[(weekNum + 3) % DESK_RADAR.length]];
  // The radar queries go through Google News, which is close to empty on CI
  // runners. The desk's own wires are what a reporter actually reads, so they
  // carry the topic hunt and the radar feeds only add to it.
  const feeds = [
    ...picks.map(([label, query]) => ({ outlet: `Radar: ${label}`, url: googleNews(query), kind: 'aggregator' })),
    ...DESK_FEEDS,
  ];
  const { items } = await safe(() => fetchFeeds(feeds, { maxAgeHours: 24 * 10, perFeed: 25 }), { items: [] });
  if (!items.length) return null;

  const newest = [...items].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const heads = newest.slice(0, 60).map((i) => `- ${i.outlet}: ${i.title}`).join('\n');
  try {
    const { data } = await chatJSON('desk', [
      {
        role: 'system',
        content: `You are the investigative editor of PLAIN. You look at the news of the last ten days and ask which development deserves documents, data and questions rather than another report. The desk works internationally; a story that only concerns one country must carry a cross-border institution, a shared pattern or money that crosses a border. You write about people: a story without visible people behind it — without anyone who lost something, profits from it or lives with the consequences — is a process story, not a story. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Recent headlines:\n${heads}\n\nIs there ONE story here with an investigative core — public money, a decision, a contract, a court case, a pattern across institutions? It must be answerable with public records and email questions. It must also have people in it: who loses, who profits, who is left to live with the consequences. Stories about people affected by power — by settlement, extraction, state crime, a hacked account, a taken land — beat stories about a procedure.\n\nReturn {"topic":{"title":"working headline, max 90 characters","angle":"the question the investigation answers","category":"politics|business|world|tech|science|climate|health|culture|sport","queries":["4-6 specific search queries"]}} or {"topic":null} if none qualifies.`,
      },
    ], { temperature: 0.4, maxTokens: 1500 });
    const t = data?.topic;
    if (!t || !t.title || !Array.isArray(t.queries) || t.queries.length < 2) return null;
    return {
      title: String(t.title).slice(0, 120),
      angle: String(t.angle || '').slice(0, 300),
      category: String(t.category || 'politics'),
      queries: t.queries.map(String).filter((q) => q.length > 5).slice(0, 6),
    };
  } catch (err) {
    log(`INTAKE  desk topic failed: ${err.message}`);
    return null;
  }
}

// ─────────────────────────── 2. RESEARCH ───────────────────────────
async function ensureQueries(d) {
  if (d.queries?.length >= 2) return;
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: 'You are a research planner for an investigative desk. Return JSON only.',
    },
    {
      role: 'user',
      content: `Investigation: ${d.title}\nQuestion: ${d.angle}\nReader brief: ${JSON.stringify(d.brief || {})}\n\nWrite 4-6 search queries in the language of the primary sources (English, French, Spanish, German) that would surface: official documents, audit reports, court rulings, procurement notices and reporting by independent outlets. Each query must name a specific institution, programme or decision.\n\nReturn {"queries":["…"]}`,
    },
  ], { temperature: 0.4, maxTokens: 800 });
  d.queries = (Array.isArray(data.queries) ? data.queries : []).map(String).filter((q) => q.length > 5).slice(0, 6);
  if (!d.queries.length) throw new Error('no research queries');
}

// ─────────────────────────── 2a. AGENT ───────────────────────────
// The desk works like a reporter with a browser and a phone: it searches,
// opens documents, follows links, writes down what it can prove, and keeps a
// list of who has to answer. One run per day, state on disk.
async function researchAgent(d) {
  const cache = new Map();
  const startedSources = d.sources.length;
  const startedClaims = d.claims.length;

  // Google and Bing answer CI runners with empty feeds most of the time. The
  // desk's own watchlist — world broadcasters, wires and primary sources — is
  // the corpus a reporter actually reads in the morning, so searching starts
  // there and the aggregators are only the second opinion.
  const wireRes = await safe(
    () => fetchFeeds(DESK_FEEDS, { maxAgeHours: 24 * 7, perFeed: 20 }),
    { items: [] },
  );
  const wire = (wireRes.items || []).filter((it) => it.url);
  log(`WIRE  ${wire.length} headline(s) from ${DESK_FEEDS.length} desk feeds`);

  // Every search opens its first hits; the cap keeps a run with a slow or
  // hostile site from spending the whole budget in page fetches.
  let autoOpenBudget = 6;

  const termsOf = (q) => String(q).toLowerCase()
    .replace(/\bsite:\S+/gi, ' ')
    .replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ')
    .split(/\s+/)
    // A year matches every headline of that year - it is no evidence at all.
    .filter((w) => w.length > 2 && !/^\d+$/.test(w) && !/^(the|and|for|with|from|about|und|der|die|das|von|fuer|mit|auf)$/i.test(w));
  const wireMatches = (q, n = 8) => {
    const terms = termsOf(q);
    if (!terms.length) return [];
    // One shared word is not a match. Two terms, or one distinctive one
    // ("bitget", "lazarus"), before a headline may enter.
    const distinctive = terms.filter((t) => t.length >= 6);
    return wire
      .map((it) => {
        const text = `${it.title} ${it.summary}`.toLowerCase();
        const hits = terms.filter((t) => text.includes(t));
        const strong = hits.some((t) => distinctive.includes(t));
        return { it, score: hits.length, strong };
      })
      .filter((x) => x.score >= 2 || x.strong)
      .sort((a, b) => b.score - a.score || new Date(b.it.publishedAt || 0) - new Date(a.it.publishedAt || 0))
      .slice(0, n)
      .map((x) => x.it);
  };

  const state = () =>
    [
      `SOURCES ON FILE (${d.sources.length})`,
      d.sources.map((s) => `[${s.id}] ${s.outlet}${s.primary ? ' (primary)' : ''} — ${s.title} — ${s.url}`).join('\n') || '(none)',
      '',
      `CLAIMS ON FILE (${d.claims.length})`,
      d.claims.map((c) => `[${c.id}] ${c.text} (${c.sources.join(',')})`).join('\n') || '(none)',
      '',
      `GAPS (${d.gaps.length})`,
      d.gaps.map((g) => `- ${g}`).join('\n') || '(none)',
    ].join('\n');

  const tools = [
    {
      name: 'search',
      args: '{"query": string}',
      description: 'Search the desk wire (world broadcasters, wires, official sources), the filing cabinets (US Justice Department, UN newsroom, World Bank procurement) and the wide web. The first two hits are opened and filed automatically; their text comes back in "opened" with a source id. Read that text and record the claims it supports.',
      run: async ({ query }) => {
        const q = String(query || '').trim().slice(0, 120);
        if (q.length < 3) return { error: 'query too short' };
        const seen = new Set();
        const hits = [];
        const collect = (list) => {
          for (const h of list) {
            if (!h.url || seen.has(h.url)) continue;
            seen.add(h.url);
            hits.push(h);
          }
        };
        const fromWire = wireMatches(q);
        collect(fromWire);
        // The aggregators are thin from CI, not the topic, so the bare-words
        // query goes out in parallel instead of after a 25-second timeout.
        const short = termsOf(q).slice(0, 4).join(' ').trim();
        const [primary, bare, cabinets, wide] = await Promise.all([
          webSearch(q, { limit: 12 }).catch(() => []),
          short && short.toLowerCase() !== q.toLowerCase()
            ? webSearch(short, { limit: 12 }).catch(() => [])
            : Promise.resolve([]),
          filingCabinets(q, { limit: 10 }).catch(() => []),
          wideSearch(q, { limit: 10 }).catch(() => []),
        ]);
        collect(cabinets);
        collect(primary);
        collect(wide);
        if (hits.length < 3) collect(bare);
        // Never answer with an empty page: hand over the newest wire headlines
        // so there is always something to open and follow.
        if (hits.length < 3) collect(wire.slice(0, 10));

        // The desk reads what it finds. Documents come first — a story needs
        // the papers, not only the headlines — and the first two hits are
        // opened and filed right here, because a run that only searches ends
        // with an empty dossier.
        const order = [...hits.filter((h) => h.primary), ...hits.filter((h) => !h.primary)];
        const auto = order.slice(0, 2).filter((h) => autoOpenBudget > 0 && !d.sources.some((s) => s.url === h.url));
        autoOpenBudget -= auto.length;
        const opened = (await Promise.all(auto.map(async (h) => {
          const page = await openPage(h.url, { maxChars: 4000 }).catch(() => null);
          if (!page?.text) return null;
          addSource(d, { url: h.url, outlet: h.outlet || hostOf(h.url), title: page.title || h.title, publishedAt: h.publishedAt || null, primary: h.primary }, { kind: h.kind === 'document' ? 'document' : 'read' });
          const src = d.sources.find((s) => s.url === h.url);
          if (src && !src.text) {
            src.text = page.text.slice(0, MAX_SOURCE_CHARS);
            src.readAt = nowISO();
          }
          return { outlet: h.outlet || hostOf(h.url), url: h.url, sourceId: src?.id || null, title: page.title || h.title, text: page.text.slice(0, 900) };
        }))).filter(Boolean);

        const results = order.slice(0, 10).map((h) => ({ title: h.title, url: h.url, outlet: h.outlet, publishedAt: h.publishedAt, kind: h.kind || 'news', primary: !!h.primary }));
        const wireN = fromWire.filter((w) => seen.has(w.url)).length;
        const docsN = results.filter((r) => r.primary).length;
        return {
          query: q,
          opened,
          results,
          ...(wireN ? { note: `${wireN} hit(s) come from the desk wire; the first two are on file — record what their text proves` } : {}),
          ...(docsN ? { note: `${docsN} primary document(s) on file — open the rest and quote what they say` } : {}),
          ...(results.length ? {} : { note: 'no hits — try 2-3 words, or a "site:" query for the institution\'s own portal' }),
        };
      },
    },
    {
      name: 'open',
      args: '{"url": string}',
      description: 'Open a page or document and return its title, running text and the links that lead further. Only URLs seen in an earlier observation.',
      run: async ({ url }) => {
        const target = String(url || '').trim();
        if (!/^https?:\/\//i.test(target)) return { error: 'not a URL' };
        const page = await openPage(target, { maxChars: 7000 });
        if (page.error && !page.text) return { url: target, error: page.error };
        cache.set(target, page.text || '');
        // What the desk read is part of the dossier's paper trail. Filing it
        // here means a run cannot end with "I read a lot" and nothing on file.
        addSource(d, { url: target, outlet: hostOf(target), title: page.title || target, publishedAt: null }, { kind: 'read' });
        const src = d.sources.find((s) => s.url === target);
        if (src && page.text && !src.text) {
          src.text = page.text.slice(0, MAX_SOURCE_CHARS);
          src.readAt = nowISO();
        }
        return {
          url: target,
          title: page.title,
          text: page.text,
          links: (page.links || []).slice(0, 20),
          sourceId: src?.id || null,
          ...(page.pdf ? { document: 'PDF — text extracted, cite page-level detail only as printed' } : {}),
        };
      },
    },
    {
      name: 'save_source',
      args: '{"url": string, "outlet": string, "title": string, "publishedAt": "YYYY-MM-DD"?}',
      description: 'File a source in the dossier. Use for anything you rely on — articles, official pages, court decisions, tender notices.',
      run: async ({ url, outlet, title, publishedAt }) => {
        const target = String(url || '').trim();
        if (!/^https?:\/\//i.test(target)) return { error: 'not a URL' };
        const added = addSource(
          d,
          { url: target, outlet: String(outlet || hostOf(target)), title: String(title || target), publishedAt: publishedAt || null },
        );
        const src = d.sources.find((s) => s.url === target);
        if (src && cache.has(target) && !src.text) {
          src.text = cache.get(target).slice(0, MAX_SOURCE_CHARS);
          src.readAt = nowISO();
        }
        return { added, id: src?.id || null, total: d.sources.length };
      },
    },
    {
      name: 'save_claim',
      args: '{"text": string, "sources": ["S1"], "contested": boolean?}',
      description: 'Record one verifiable finding that the cited sources directly support. One fact per claim: who, what, when, how much. Never a reading of motives. Source ids come from save_source or the sourceId that open returned.',
      run: async ({ text, sources, contested }) => {
        const value = String(text || '').trim().slice(0, 600);
        const ids = [...new Set((Array.isArray(sources) ? sources : []).map((s) => String(s).trim()).filter(Boolean))];
        const known = new Set(d.sources.map((s) => s.id));
        const valid = ids.filter((id) => known.has(id));
        if (value.length < 20) return { error: 'claim too short' };
        if (!valid.length) return { error: `no valid source id — on file: ${[...known].join(', ') || 'none'}` };
        const norm = value.toLowerCase().replace(/\W+/g, ' ').trim();
        const dup = d.claims.find((c) => c.text.toLowerCase().replace(/\W+/g, ' ').trim() === norm);
        if (dup) return { duplicate: dup.id };
        const claim = {
          id: `C${d.claims.length + 1}`,
          text: value,
          sources: valid,
          status: contested ? 'contested' : 'verified',
          weight: 2,
          checkedAt: nowISO(),
        };
        d.claims.push(claim);
        return { id: claim.id, total: d.claims.length };
      },
    },
    {
      name: 'add_gap',
      args: '{"text": string}',
      description: 'Note an open question that still needs a document, a figure or an answer. Be concrete: which office, which file.',
      run: async ({ text }) => {
        const value = String(text || '').trim().slice(0, 300);
        if (value.length < 15) return { error: 'gap too short' };
        if (d.gaps.some((g) => g.toLowerCase() === value.toLowerCase())) return { duplicate: true };
        d.gaps.push(value);
        return { total: d.gaps.length };
      },
    },
    {
      name: 'contact',
      args: '{"org": string, "role": string, "email"?: string, "sourceUrl"?: string}',
      description: 'File an institution or person who must answer, with the address you found on their own website. Never guess an address; if you cannot find one, omit it.',
      run: async ({ org, role, email, sourceUrl }) => {
        const name = String(org || '').trim().slice(0, 160);
        if (name.length < 3) return { error: 'org too short' };
        const mail = String(email || '').trim();
        if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: 'email looks invalid — drop it or find the published address' };
        const existing = d.contacts.find((c) => c.org.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (mail && !existing.email) {
            existing.email = mail;
            existing.emailSource = sourceUrl || null;
          }
          return { updated: true, total: d.contacts.length };
        }
        d.contacts.push({
          org: name,
          role: String(role || 'must be asked for comment').slice(0, 300),
          ...(mail ? { email: mail, emailSource: sourceUrl || null } : {}),
        });
        return { added: true, total: d.contacts.length };
      },
    },
  ];

  const steps = Math.max(4, +(process.env.INVESTIGATE_AGENT_STEPS || 10));
  const { final, steps: log2 } = await runAgent({
    role: 'desk',
    system: `You are the international investigative desk of PLAIN., an independent news site. You work with documents, not with impressions: you open the tender notice, the audit report, the court ruling and the press release, and you write down only what they say. Your beat is cross-border — Brussels, Washington, Geneva, Nairobi, Singapore — and a national story only matters if it connects to an institution, a programme or a pattern beyond one country. You never invent a URL, a figure, a name or a date, and you never describe what someone was thinking — only what they did and what a document proves. You write about people: for every story you look for the ones who carry the consequences and the ones who profit from them, and you name them. Write your findings in English.`,
    task: `INVESTIGATION: ${d.title}
QUESTION: ${d.angle}
DESK BRIEF: ${JSON.stringify(d.brief || {})}
SEARCHES THAT WORKED FOR THIS STORY: ${(d.queries || []).join(' · ') || '(none yet)'}
${d.nextStep ? `NOTE FROM THE LAST SHIFT: ${d.nextStep}` : ''}
${(d.dropped || []).length ? `ALREADY THROWN OUT (no source carries them):\n${d.dropped.slice(-6).map((x) => `- ${x.text}`).join('\n')}` : ''}

${state()}

WHAT THIS RUN SHOULD ACHIEVE
Target for a publishable investigation: ${MIN_SOURCES} distinct outlets, ${MIN_PRIMARY} official/primary sources, ${MIN_CLAIMS} supported claims.
Priorities, in order: (1) find the primary documents — court judgments, audit reports, procurement and award notices, agency decisions, sanctions lists, FOI releases, official statistics; (2) open them, so they land on file; (3) record claims the documents support, one fact each; (4) find who must respond and their published press address.
Ask for the document itself with "site:" queries: site:ungm.org (UN tenders), site:ted.europa.eu (EU tenders), site:sam.gov (US contracts), site:gao.gov, site:eca.europa.eu and site:nao.org.uk (audit reports), site:curia.europa.eu (EU judgments), site:icc-cpi.int (ICC), site:worldbank.org, site:oecd.org, site:reliefweb.int. When the trail leads into a country, add its audit office, its procurement portal and its court database.
If the story is an attack, a theft or a breach, the question behind it is always "who did it and where did the money go": find the attribution evidence (IP ranges, malware families, on-chain addresses, sanctions listings, indictments), the laundering route, and the people who lost what was taken. Useful doors for that class: site:trmlabs.com, site:chainalysis.com, site:ic3.gov, site:justice.gov, site:ofac.treasury.gov, site:cert.europa.eu, site:enisa.europa.eu, site:un.org, site:ohchr.org, site:sanctions.io. If the story is about land, extraction or settlement, name the people who live there and what they lost.
Every search already opens and files its first two hits. Read the text under "opened", record two or three facts per page with save_claim and the sourceId that came with it, and only then search again — a run that keeps searching without filing has produced nothing.
Every search also goes through the desk's filing cabinets: the US Justice Department's press releases, the UN newsroom, the World Bank's procurement notices and the world archive. Results marked "primary" are documents — open them, they are what makes the story publishable. The wide web is searched too, but it is the least reliable of the four; when it returns nothing, name the institution and search its own portal instead.`,

    tools,
    maxSteps: steps,
    deadline: Number.isFinite(deadlineLeft()) ? Date.now() + deadlineLeft() : 0,
    log,
  });

  if (final) d.nextStep = final.slice(0, 300);
  d.agent = [...(d.agent || []), { at: nowISO(), steps: log2, final }].slice(-3);

  const added = d.sources.length - startedSources;
  let claims = d.claims.length - startedClaims;

  // A weak model can gather the right documents and still forget to write the
  // claims down. The desk then does what a desk does: read the pages on file
  // and extract the facts itself.
  if (claims === 0 && d.sources.some((s) => s.text)) {
    log('RESEARCH  no claim on file — extracting from the pages the desk read');
    await safe(() => extract(d), null);
    claims = d.claims.length - startedClaims;
  }

  log(`RESEARCH  agent: ${added} source(s), ${claims} claim(s), ${d.contacts.length} contact(s)`);

  if (added === 0 && claims === 0 && d.sources.length === 0) return false;
  if (['pitch'].includes(d.status) && d.sources.length >= 3) note(d, 'research', `${d.sources.length} sources`);
  return true;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

// ─────────────────────────── 2b. INBOX ───────────────────────────
// Replies come in under the desk's own address. Each one is read, turned into
// claims and gaps, and — if it asks something — answered in a draft that still
// needs the editor's approval before it leaves the building.
function addEmailSource(d, msg) {
  const url = `mailto:${msg.from_email}`;
  const title = `Antwort: ${String(msg.subject || '(ohne Betreff)').slice(0, 160)}`;
  const existing = d.sources.find((s) => s.kind === 'email' && s.url === url && s.title === title);
  if (existing) return existing;
  const src = {
    id: `S${d.sources.length + 1}`,
    url,
    outlet: String(msg.from_email).split('@')[1] || msg.from_email,
    title,
    publishedAt: msg.received_at || nowISO(),
    primary: true,
    kind: 'email',
    addedAt: nowISO(),
    text: String(msg.body || '').slice(0, MAX_SOURCE_CHARS),
    readAt: nowISO(),
  };
  d.sources.push(src);
  return src;
}

async function classifyMessage(d, msg) {
  const { data } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You read replies to an investigative desk. You record only what the sender wrote — never what you assume they meant. A denial is a finding, not an obstacle. Return JSON only.`,
    },
    {
      role: 'user',
      content: `WE ASKED: ${d.title}
OUR QUESTION: ${d.angle}

FROM: ${msg.from_email}
SUBJECT: ${msg.subject || '(none)'}
MESSAGE:
${String(msg.body || '').slice(0, 4000)}

TASK
1. kind: one of answer | denial | question | auto-reply | unrelated.
2. summary: two sentences, what the sender actually said.
3. claims: facts the sender states that we can use, one per line, with their exact numbers and dates. Only what they wrote. If they deny something, phrase it as their denial.
4. gaps: what they did not answer or what their reply makes newly unclear.
5. needs_reply: true only if they ask us something or a short acknowledgement is due.
6. reply: if needs_reply, a formal German or English answer in plain text, max 150 words, signed "PLAIN. Investigative desk", stating again that the research is AI-assisted and editor-reviewed. Otherwise empty.

Return {"kind":"…","summary":"…","claims":["…"],"gaps":["…"],"needs_reply":false,"reply":""}`,
    },
  ], { temperature: 0.2, maxTokens: 1600 });

  return {
    kind: ['answer', 'denial', 'question', 'auto-reply', 'unrelated'].includes(data.kind) ? data.kind : 'answer',
    summary: String(data.summary || '').slice(0, 1000),
    claims: (Array.isArray(data.claims) ? data.claims : []).map(String).filter((s) => s.trim().length > 20).slice(0, 8),
    gaps: (Array.isArray(data.gaps) ? data.gaps : []).map(String).filter(Boolean).slice(0, 5),
    needsReply: Boolean(data.needs_reply),
    reply: String(data.reply || '').trim(),
  };
}

const replySubject = (subject) => {
  const value = String(subject || '').trim() || 'Ihre Auskunft';
  return /^re:/i.test(value) ? value.slice(0, 160) : `Re: ${value}`.slice(0, 160);
};

async function readInbox(d) {
  let messages = [];
  try {
    messages = await withDeadline(listMessages({ slug: d.slug, status: 'new', limit: 5 }), 12_000, 'the desk mailbox');
  } catch (err) {
    log(`INBOX  ${d.slug}: ${err.message}`);
    return 0;
  }
  if (!messages.length) return 0;

  const rows = (await outreachRows(d.slug).catch(() => []))
    .filter((r) => ['sent', 'replied'].includes(r.status));
  const handled = [];

  for (const msg of messages) {
    if (deadlineLeft() < 120_000) {
      log('INBOX  deadline close — leaving the rest for the next run');
      break;
    }
    const parsed = await classifyMessage(d, msg).catch((err) => {
      log(`INBOX  classify failed (${msg.from_email}): ${err.message}`);
      return null;
    });
    if (!parsed) continue;

    // Anyone can write to the desk address. Only a reply to a request we
    // actually sent counts as evidence; everything else is a lead.
    const row = rows.find((r) => String(r.to_email || '').toLowerCase() === String(msg.from_email).toLowerCase());
    if (!row) {
      const gap = `Unverlangte Mail von ${msg.from_email}: ${parsed.summary.slice(0, 220)}`;
      if (!d.gaps.some((g) => g.toLowerCase() === gap.toLowerCase())) d.gaps.push(gap);
      note(d, null, `mail from ${msg.from_email} (lead, no request on file)`);
      handled.push(msg.id);
      continue;
    }

    const src = addEmailSource(d, msg);
    for (const text of parsed.claims) {
      if (d.claims.some((c) => c.text.toLowerCase() === text.toLowerCase())) continue;
      d.claims.push({
        id: `C${d.claims.length + 1}`,
        text: text.slice(0, 600),
        sources: [src.id],
        status: parsed.kind === 'denial' ? 'contested' : 'verified',
        weight: 3,
        checkedAt: nowISO(),
      });
    }
    for (const gap of parsed.gaps) {
      if (!d.gaps.some((g) => g.toLowerCase() === gap.toLowerCase())) d.gaps.push(gap.slice(0, 300));
    }

    await setOutreach([row.id], { status: 'replied', reply_note: parsed.summary.slice(0, 1000) }).catch(() => {});

    if (parsed.needsReply && parsed.reply.length > 80) {
      await addOutreach([{
        slug: d.slug,
        toEmail: msg.from_email,
        org: row?.org || msg.from_email,
        subject: replySubject(msg.subject),
        body: parsed.reply,
      }]).catch((err) => log(`INBOX  reply draft failed: ${err.message}`));
    }

    note(d, null, `mail from ${msg.from_email} (${parsed.kind})`);
    handled.push(msg.id);
  }

  if (handled.length) {
    await markMessages(handled, { status: 'processed', processed_at: nowISO() }).catch(() => {});
  }
  log(`INBOX  ${handled.length}/${messages.length} message(s) processed`);
  return handled.length;
}

// A desk that publishes on trust is not a desk. Before anything is written or
// asked, every claim is read back against the text it cites: what the document
// does not say leaves the dossier.
async function factcheck(d) {
  const checkable = d.claims.filter(
    (c) => !c.checked && (c.sources || []).some((id) => (d.sources.find((s) => s.id === id)?.text || '').length >= 300),
  );
  const unreadable = d.claims.filter((c) => !c.checked && !checkable.includes(c));
  for (const c of unreadable) c.checked = 'unreadable'; // headline only — cannot be read back
  if (!checkable.length) return;
  if (deadlineLeft() < 6 * 60_000) {
    log('CHECK  deadline close — claims left unchecked');
    return;
  }

  const batch = checkable.slice(0, 8);
  const pack = batch.map((c) => {
    const texts = c.sources
      .map((id) => d.sources.find((s) => s.id === id))
      .filter((s) => s?.text)
      .slice(0, 2)
      .map((s) => `[${s.id}] ${s.outlet} — ${s.title}\n${s.text.slice(0, 1800)}`)
      .join('\n\n');
    return `[${c.id}] CLAIM: ${c.text}\n${texts}`;
  }).join('\n\n────────\n\n');

  let data;
  try {
    ({ data } = await chatJSON('desk', [
      {
        role: 'system',
        content: 'You are the fact-checker of an investigative desk. You compare a claim with the source text it cites. You do not judge plausibility and you do not use outside knowledge: if the text does not carry the claim, the verdict is unsupported. Return JSON only.',
      },
      {
        role: 'user',
        content: `For each claim below, decide against the quoted source text:
- supported: the text states it, including every number and date.
- partial: the text supports the core but not all details, or only one of several citations carries it.
- unsupported: the text does not say it, says something else, or is about a different entity.

${pack}

Return {"checks":[{"id":"C1","verdict":"supported|partial|unsupported","reason":"one sentence, quote the sentence that decides it"}]}`,
      },
    ], { temperature: 0, maxTokens: 1600 }));
  } catch (err) {
    log(`CHECK  failed: ${err.message}`);
    return;
  }

  const verdicts = new Map((Array.isArray(data.checks) ? data.checks : []).map((c) => [String(c.id), c]));
  const dropped = [];
  for (const c of batch) {
    const v = verdicts.get(c.id);
    if (!v) continue;
    const verdict = ['supported', 'partial', 'unsupported'].includes(v.verdict) ? v.verdict : 'partial';
    c.checked = verdict;
    if (verdict === 'partial') c.checkNote = String(v.reason || '').slice(0, 240);
    if (verdict === 'unsupported') dropped.push(c);
  }

  if (dropped.length) {
    const keep = new Set(dropped.map((c) => c.id));
    d.claims = d.claims.filter((c) => !keep.has(c.id));
    d.dropped = [...(d.dropped || []), ...dropped.map((c) => ({ text: c.text, why: c.checkNote || 'nicht belegt' }))].slice(-40);
    for (const c of dropped) d.gaps.push(`Nicht belegt, deshalb gestrichen: ${c.text.slice(0, 200)}`);
    log(`CHECK  ${dropped.length} claim(s) dropped — the cited text does not carry them`);
  }
  log(`CHECK  ${batch.length - dropped.length}/${batch.length} claim(s) stand`);
}

async function research(d) {
  if (process.env.INVESTIGATE_AGENT !== '0') {
    const ok = await researchAgent(d).catch((err) => {
      log(`RESEARCH  agent failed: ${err.message}`);
      return false;
    });
    if (ok) return;
    log('RESEARCH  agent produced nothing — falling back to the feed pass');
  }
  await ensureQueries(d);

  // Rotate the window so a dossier with more than five queries uses all of them
  // over several days instead of hammering the same five every run.
  const size = Math.min(5, d.queries.length);
  const start = ((d.researchRuns || 0) * size) % d.queries.length;
  const picked = Array.from({ length: size }, (_, i) => d.queries[(start + i) % d.queries.length]);
  d.researchRuns = (d.researchRuns || 0) + 1;
  const feeds = [
    ...picked.flatMap((q) => [
      { outlet: `Search: ${q}`, url: googleNews(q), kind: 'aggregator' },
      { outlet: `Bing: ${q}`, url: bingNews(q), kind: 'bing' },
    ]),
    ...HOME_FEEDS,
  ];
  const { items, feedsOk } = await safe(() => fetchFeeds(feeds, { maxAgeHours: 24 * 45, perFeed: 25 }), { items: [], feedsOk: 0 });
  log(`RESEARCH  ${d.slug}: ${items.length} hits from ${feedsOk} search feed(s)`);

  const kw = keywordsOf(d);
  d.keywords = kw;
  // One keyword is not a match: a passing mention is not the story. Two terms,
  // or one term on a document from an official body, before an item may enter.
  // And it has to carry a word from this story's own title.
  const core = coreTermsOf(d);
  const relevant = items
    .map((it) => ({ it, hits: keywordHits(`${it.title} ${it.summary}`, kw), core: keywordHits(`${it.title} ${it.summary}`, core) }))
    .filter((x) => x.core >= 1 && (x.hits >= 2 || (x.hits >= 1 && isPrimaryOutlet(x.it.outlet))))
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.it);

  let added = 0;
  for (const it of relevant.slice(0, 20)) if (addSource(d, it)) added++;

  // Tips from the reader may contain documents or links worth reading.
  for (const url of String(d.brief?.hints || '').match(/https?:\/\/\S+/g) || []) {
    if (addSource(d, { url, outlet: 'Reader tip', title: 'Document from reader wish', publishedAt: null }, { kind: 'tip' })) added++;
  }
  log(`RESEARCH  ${added} new source(s), ${d.sources.length} total`);

  const unread = d.sources.filter((s) => !s.readAt && s.url);
  const toRead = unread.slice(0, MAX_READS);
  await pool(toRead, 3, async (s) => {
    const details = await fetchArticleDetails(s.url, MAX_SOURCE_CHARS).catch(() => null);
    s.readAt = nowISO();
    if (details?.text) s.text = details.text.slice(0, MAX_SOURCE_CHARS);
    if (details?.image) {
      s.image = details.image;
      s.imageCaption = details.imageCaption;
      s.imageCredit = details.imageCredit;
    }
  });

  if (d.sources.length) await extract(d);
  if (d.status === 'pitch' && d.sources.length >= 3) {
    note(d, 'research', `${d.sources.length} sources`);
  }
  d.nextStep = 'read sources, extract claims, find contacts';
}

function sourcePack(d, limit = 8, chars = 3500) {
  return d.sources.slice(0, limit).map((s) =>
    `[${s.id}] ${s.outlet}${s.primary ? ' (official/primary)' : ''} — "${s.title}" (${String(s.publishedAt || '').slice(0, 10)})\nURL: ${s.url}\nTEXT: ${(s.text || '(not readable — headline only)').slice(0, chars)}`
  ).join('\n\n');
}

async function extract(d) {
  const existing = d.claims.map((c) => `[${c.id}] (${c.status}) ${c.text} — sources: ${(c.sources || []).join(', ')}`).join('\n');
  const { data, model } = await chatJSON('desk', [
    {
      role: 'system',
      content: `You are the research desk of an investigative newsroom. You extract only what the sources say. You never add facts from memory. Return JSON only.`,
    },
    {
      role: 'user',
      content: `INVESTIGATION: ${d.title}\nQUESTION: ${d.angle}\n

SOURCES:
${sourcePack(d)}

CLAIMS ALREADY ON FILE:
${existing || '(none)'}

TASK: Build the evidence base.
1. claims: every factual finding that matters — who decided what, how much money, which contract, which date, who benefited, which rule applied or was bypassed, and where sources contradict each other (one claim, both versions, both source ids). Merge duplicates with the claims on file. Keep only claims a source directly supports.
2. gaps: what is still unknown and must be asked or found (documents, figures, names, decisions). Be concrete.
3. contacts: institutions, companies and people who must be asked for comment, and why. No email addresses — the editor supplies the recipient in the admin desk.

Return exactly:
{"claims":[{"id":"C1","text":"…","sources":["S1","S2"],"status":"verified|contested","weight":1}],"gaps":["…"],"contacts":[{"org":"…","why":"why they must answer"}]}`,
    },
  ], { temperature: 0.2, maxTokens: 8000 });

  const validIds = new Set(d.sources.map((s) => s.id));
  const claims = (Array.isArray(data.claims) ? data.claims : [])
    .map((c, i) => ({
      id: `C${i + 1}`,
      text: String(c.text || '').trim().slice(0, 600),
      sources: [...new Set((c.sources || []).map(String).filter((id) => validIds.has(id)))],
      status: c.status === 'contested' ? 'contested' : 'verified',
      weight: Math.min(5, Math.max(1, Number(c.weight) || 2)),
      checkedAt: nowISO(),
    }))
    .filter((c) => c.text.length > 20 && c.sources.length > 0);

  if (!claims.length) {
    log('RESEARCH  extraction produced no supported claims');
    return;
  }
  d.claims = claims;
  d.gaps = (Array.isArray(data.gaps) ? data.gaps : []).map(String).slice(0, 12);
  for (const c of Array.isArray(data.contacts) ? data.contacts : []) {
    const org = String(c.org || '').trim();
    if (!org || d.contacts.some((x) => x.org.toLowerCase() === org.toLowerCase())) continue;
    d.contacts.push({ org, role: String(c.why || 'must be asked for comment').slice(0, 300) });
  }
  log(`RESEARCH  ${d.claims.length} claim(s), ${d.gaps.length} gap(s), ${d.contacts.length} contact(s) — ${model}`);
}

// ─────────────────────────── 3. OUTREACH ───────────────────────────
async function outreachRows(slug) {
  const all = await safe(() => listOutreach({ limit: 300 }), []);
  return all.filter((o) => o.slug === slug);
}

function replyDeadline() {
  const d = new Date(Date.now() + 5 * 864e5);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function draftEmail(d, { org, note: hint }) {
  const claims = [...d.claims].sort((a, b) => b.weight - a.weight).slice(0, 6)
    .map((c) => `- ${c.text}`).join('\n');
  const { data } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You draft formal source requests for the investigative desk of PLAIN. (${SITE.url}), an independent, advertising-free Swiss news site that reports internationally; write in the language of the recipient (English for international bodies). The research is AI-assisted and every text is reviewed by a human editor — say so openly. Never accuse. Never negotiate. Return JSON only.`,
    },
    {
      role: 'user',
      content: `We are investigating: ${d.title}
Our question: ${d.angle}
What our documents and reports currently show (each line is sourced, do not overstate):
${claims}

Write an email to: ${org}${hint ? `\nInternal note from the editor: ${hint}` : ''}

RULES
- Greeting: formal, to the organisation (no invented names).
- One neutral paragraph: who we are (PLAIN., investigative desk, plain-news.ch), that this research is AI-assisted and editor-reviewed, and what we are looking into.
- 3-5 numbered questions. Each must be answerable and about one specific fact, payment, decision or date from the list above.
- Say we will publish their reply; they may choose full or summarized.
- Offer to correct anything factually wrong.
- Ask for an answer by ${replyDeadline()}.
- Sign: PLAIN. Investigative desk, ${EDITORIAL_EMAIL}
- No accusations, no legal threats, no flattery, no emojis, no markdown. Plain text, at most 280 words.

Return {"subject":"…","body":"…"}`,
    },
  ], { temperature: 0.3, maxTokens: 1200 });

  const subject = String(data.subject || '').trim().slice(0, 160);
  const body = String(data.body || '').trim();
  if (!subject || body.length < 200) throw new Error('email draft too thin');
  return { subject, body };
}

async function queueOutreach(d) {
  const rows = await outreachRows(d.slug).catch(() => []);
  const known = new Set(rows.map((r) => String(r.to_email || '').toLowerCase()).filter(Boolean));
  const ready = (d.contacts || []).filter((c) => c.email && !known.has(String(c.email).toLowerCase()));
  const queued = [];
  for (const contact of ready.slice(0, 3)) {
    try {
      await requestOutreach({
        slug: d.slug,
        toEmail: contact.email,
        org: contact.org,
        note: contact.emailSource ? `Adresse gefunden auf ${contact.emailSource}` : null,
      });
      queued.push(contact.org);
    } catch (err) {
      log(`OUTREACH  could not queue ${contact.org}: ${err.message}`);
    }
  }
  if (queued.length) {
    note(d, null, `queued ${queued.length} request(s): ${queued.join(', ')}`);
    log(`OUTREACH  queued ${queued.length} request(s) from its own contact list`);
  }
  return queued.length;
}

async function draftOutreach(d) {
  const rows = await outreachRows(d.slug);
  const requested = rows.filter((r) => r.status === 'requested');
  const drafted = [];

  // Every recipient is set by the editor in the admin desk; the bot only
  // writes the text. That keeps an AI from ever guessing an address.
  for (const row of requested.slice(0, 3)) {
    const org = row.org || row.to_email;
    try {
      const mail = await draftEmail(d, { org, note: row.reply_note || '' });
      await setOutreach([row.id], { ...mail, status: 'draft' });
      drafted.push(org);
      log(`OUTREACH  drafted for ${org}`);
    } catch (err) {
      log(`OUTREACH  draft failed for ${org}: ${err.message}`);
    }
  }

  if (drafted.length) {
    d.outreach = [...(d.outreach || []), ...drafted.map((org) => ({ org, at: nowISO(), status: 'draft' }))].slice(-50);
  }
}

async function sendApproved(d) {
  if (!CAN_SEND) return 0;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    log('OUTREACH  sending skipped: RESEND_API_KEY / RESEND_FROM_EMAIL missing');
    return 0;
  }
  const rows = await outreachRows(d.slug);
  const approved = rows.filter((r) => r.status === 'approved').slice(0, 5);
  let sent = 0;
  for (const row of approved) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.to_email || '')) {
      await setOutreach([row.id], { status: 'failed', error: 'invalid recipient address' });
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [row.to_email],
          reply_to: deskAddress(d.slug),
          subject: row.subject,
          text: row.body,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await setOutreach([row.id], { status: 'sent', sent_at: nowISO(), error: null });
      d.outreach = [...(d.outreach || []), { org: row.org || row.to_email, email: row.to_email, at: nowISO(), status: 'sent' }].slice(-50);
      if (d.status === 'research' || d.status === 'pitch') note(d, 'outreach', `request sent to ${row.org || row.to_email}`);
      sent++;
      log(`OUTREACH  ✓ sent to ${row.org || row.to_email}`);
    } catch (err) {
      await setOutreach([row.id], { status: 'failed', error: err.message.slice(0, 300) });
      log(`OUTREACH  ✗ ${row.to_email}: ${err.message}`);
    }
  }
  return sent;
}

// ─────────────────────────── 4. WRITE ───────────────────────────
const DRAFT_SCHEMA = `{"title":"…","dek":"one sentence, max 30 words","standfirst":"2-3 sentences that state what we found and how solid it is","facts":["5-8 key facts with numbers and dates"],"sections":[{"heading":"…","paragraphs":["…"]}],"claims":[{"text":"…","sources":["S1","S3"]}],"rightOfReply":"what the institutions answered, or that they did not answer despite repeated requests — with dates","methodology":"how we reported: documents read, data used, questions sent, what we could not verify"}`;

async function writeInvestigation(d, outreach) {
  const replies = outreach.filter((o) => o.status === 'replied' && o.reply_note);
  const sent = outreach.filter((o) => ['sent', 'replied'].includes(o.status));
  const claims = d.claims.map((c) => `[${c.id}${c.status === 'contested' ? ' — CONTESTED' : ''}${c.checked === 'partial' ? ` — PARTIAL: ${c.checkNote || 'nur teilweise belegt'}` : ''}] ${c.text} (sources: ${c.sources.join(', ')})`).join('\n');
  const outreachLog = sent.length
    ? sent.map((o) => `- ${o.org || o.to_email}: requested ${day(o.sent_at || o.approved_at || o.created_at)}${o.status === 'replied' ? `\n  REPLY: ${o.reply_note}` : '\n  no reply so far'}`).join('\n')
    : '(no requests sent yet)';

  const { data, model } = await chatJSON('writer', [
    {
      role: 'system',
      content: `You are a senior investigative reporter at PLAIN., an independent Swiss news site. You write from documents, not from impressions. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `INVESTIGATION: ${d.title}
QUESTION: ${d.angle}

VERIFIED CLAIMS (each is bound to sources; contested claims show both versions):
${claims}

GAPS WE COULD NOT CLOSE:
${d.gaps.map((g) => `- ${g}`).join('\n') || '(none)'}

RIGHT-OF-REPLY LOG:
${outreachLog}

SOURCES:
${sourcePack(d, 20, 1500)}

TASK: Write the investigation in English, ${MIN_WORDS}-4000 words.

STRUCTURE (6-9 sections, each heading max 60 characters)
1. Open with the single most concrete finding, not with background.
2. Show the evidence: documents, figures, dates, decisions, who signed what.
3. Show the pattern or the money trail across cases and institutions.
4. State clearly what remains unknown, and why that matters.
5. Include a section on the right of reply: what each institution answered, verbatim where possible, or that they did not answer and when we asked.
6. Close with a section on how we reported: sources read, data sets, questions sent, what we could not verify.

RULES
- Every factual sentence must rest on a claim above. If something is not in the claims, it is not in the piece.
- Numbers, dates, names and titles exactly as in the sources. No rounding invented, no "about".
- Contested claims: name who says what. Never present one side as established fact.
- No opinion, no prosecution rhetoric, no "shocking", no calls to resign. Show the facts; the reader draws the conclusion.
- Long, specific paragraphs. No bullet lists. No "in conclusion".
- Do not write four short declarative sentences in a row, and do not open consecutive sentences with the same subject. Each paragraph needs one longer sentence with two clauses.
- Depth comes from documents, figures and chronology, never from restating a finding in new words.
- No evaluative summary sentences ("This shows…", "The pattern underlines…"). End the paragraph on the last fact.
- The claims array must list every load-bearing fact with the source ids that carry it.

Return exactly:
${DRAFT_SCHEMA}`,
    },
  ], { temperature: 0.35, maxTokens: 14000 });
  return { draft: data, model };
}

async function editInvestigation(d, outreach, draft, styleIssues = []) {
  const { data, model } = await chatJSON('editor', [
    {
      role: 'system',
      content: `You are the standards editor of PLAIN. You verify an investigation claim by claim against its sources. You cut anything that is not supported, and you are not impressed by rhetoric. ${STYLE_GUIDE} Return JSON only.`,
    },
    {
      role: 'user',
      content: `SOURCES:\n${sourcePack(d, 20, 2500)}\n\nCLAIMS ON FILE:\n${d.claims.map((c) => `[${c.id}] ${c.text} — ${c.sources.join(', ')}`).join('\n')}\n\nDRAFT:\n${JSON.stringify(draft)}
${styleIssues.length ? `\nSTYLE PROBLEMS MEASURED IN THE DRAFT (fix all of them):\n${styleIssues.map((p) => `- ${p}`).join('\n')}\n` : ''}
Check every sentence that carries a fact, a number, a date, a name or a quote.\n- Delete or correct anything not supported by the listed sources.\n- Keep the right of reply honest: an unanswered request is not a denial, and "no comment" must be reported as such with the date.\n- Rewrite monotonous prose: vary sentence length, remove repeated sentence openings, cut evaluative summary sentences.\n- Do not add new facts and do not shorten the piece below ${Math.round(MIN_WORDS * 0.9)} words.\n\nVerdict: "publish" if every claim holds, "revise" with the corrected article in "article", "reject" if the evidence cannot carry the piece.\n\nReturn {"verdict":"publish|revise|reject","problems":["…"],"article":${DRAFT_SCHEMA}}`,
    },
  ], { temperature: 0.1, maxTokens: 16000 });
  return { review: data, model };
}

function draftWords(draft) {
  const body = (draft.sections || []).flatMap((s) => [s.heading || '', ...(s.paragraphs || [])]);
  return words([draft.standfirst, draft.dek, ...(draft.facts || []), ...body, draft.rightOfReply, draft.methodology].join(' '));
}

function draftProblem(d, draft) {
  if (!draft || typeof draft !== 'object') return 'no article';
  if (typeof draft.title !== 'string' || draft.title.trim().length < 15) return 'title';
  if (!draft.dek || !draft.standfirst) return 'dek/standfirst';
  if (!Array.isArray(draft.sections) || draft.sections.length < 5) return 'fewer than 5 sections';
  for (const s of draft.sections) {
    if (!s || !Array.isArray(s.paragraphs) || s.paragraphs.length < 2) return 'thin section';
  }
  if (!Array.isArray(draft.facts) || draft.facts.length < 4) return 'facts';
  if (!Array.isArray(draft.claims) || draft.claims.length < MIN_CLAIMS) return `claims (${draft.claims?.length || 0}/${MIN_CLAIMS})`;
  const ids = new Set(d.sources.map((s) => s.id));
  for (const c of draft.claims) {
    if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some((id) => !ids.has(id))) return 'claim without valid source';
  }
  if (!draft.rightOfReply || words(draft.rightOfReply) < 15) return 'right of reply missing';
  if (!draft.methodology || words(draft.methodology) < 20) return 'methodology missing';
  if (draftWords(draft) < MIN_WORDS * 0.9) return `only ${draftWords(draft)} words`;
  const slop = slopHits({ title: draft.title, dek: draft.dek, facts: draft.facts, body: draft.sections.flatMap((s) => s.paragraphs), context: draft.rightOfReply });
  if (slop.length) return `banned phrases: ${slop.join(', ')}`;
  return null;
}

async function maybeWrite(d, outreach) {
  if (d.draft) return;
  if (!isActive(d) || ['review', 'approved'].includes(d.status)) return;

  const outlets = distinctOutlets(d.sources).length;
  const primary = d.sources.filter((s) => s.primary).length;
  const sent = outreach.filter((o) => ['sent', 'replied'].includes(o.status));
  const replied = outreach.some((o) => o.status === 'replied');
  const oldest = sent.map((o) => o.sent_at).filter(Boolean).sort()[0];
  const replyReady = replied || (oldest && ageHours(oldest) >= REPLY_HOURS);

  const missing = [];
  if (outlets < MIN_SOURCES) missing.push(`${outlets}/${MIN_SOURCES} outlets`);
  if (primary < MIN_PRIMARY) missing.push(`${primary}/${MIN_PRIMARY} primary sources`);
  if (d.claims.length < MIN_CLAIMS) missing.push(`${d.claims.length}/${MIN_CLAIMS} claims`);
  if (!replyReady) {
    const replyUntil = oldest ? new Date(new Date(oldest).getTime() + REPLY_HOURS * 3600e3).toISOString().slice(0, 10) : null;
    missing.push(replyUntil ? `right of reply runs until ${replyUntil}` : 'no outreach sent');
  }

  const forced = FORCE_SLUG === d.slug && process.env.INVESTIGATE_FORCE_DRAFT === '1';
  if (missing.length && !forced) {
    d.nextStep = `keep reporting: ${missing.join(', ')}`;
    log(`WRITE   ${d.slug} not ready — ${missing.join(', ')}`);
    return;
  }
  if (forced) log(`WRITE   ${d.slug} forced past: ${missing.join(', ') || 'all gates met'}`);

  log(`WRITE   ${d.slug}: ${outlets} outlets, ${d.claims.length} claims, ${sent.length} request(s)`);
  let { draft, model } = await writeInvestigation(d, outreach);
  let problem = draftProblem(d, draft);
  if (problem) throw new Error(`draft rejected: ${problem}`);

  const styleIssues = styleProblems(draft);
  if (styleIssues.length) log(`WRITE   style: ${styleIssues.join(' | ')}`);

  let editorModel = null;
  let verdict = 'skipped';
  try {
    const { review, model: em } = await editInvestigation(d, outreach, draft, styleIssues);
    editorModel = em;
    verdict = review?.verdict || 'unknown';
    log(`WRITE   editor ${verdict}${review?.problems?.length ? ` — ${review.problems.slice(0, 3).join(' | ')}` : ''}`);
    if (verdict === 'reject') {
      d.gaps = [...new Set([...d.gaps, ...(review.problems || [])])].slice(0, 12);
      d.nextStep = 'evidence did not carry the piece — keep reporting';
      note(d, 'research', 'editor rejected the draft');
      return;
    }
    if (verdict === 'revise' && review?.article && !draftProblem(d, review.article)) draft = review.article;
  } catch (err) {
    log(`WRITE   editor failed (${err.message}); keeping writer draft`);
  }

  d.draft = draft;
  d.review = { verdict, problems: [], at: nowISO(), writer: model, editor: editorModel };
  d.nextStep = 'human approval in /admin/investigations';
  note(d, 'review', `draft ready: ${draftWords(draft)} words, ${draft.claims.length} claims`);
  log(`WRITE   ✓ draft ready (${draftWords(draft)} words)`);
}

// ─────────────────────────── 5. PUBLISH ───────────────────────────
function articleSections(draft, pictures = []) {
  const sections = assignImages(draft.sections.map((s) => ({
    heading: String(s.heading || '').trim().slice(0, 90),
    paragraphs: (s.paragraphs || []).map((p) => String(p).trim()).filter(Boolean),
  })), pictures);
  if (draft.rightOfReply) {
    sections.push({ heading: 'Right of reply', paragraphs: String(draft.rightOfReply).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  }
  if (draft.methodology) {
    sections.push({ heading: 'How we reported this', paragraphs: String(draft.methodology).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  }
  return sections;
}

async function translateInvestigation(block, locale) {
  const lang = LOCALES.find((l) => l.code === locale);
  const { data } = await chatJSON('translator', [
    {
      role: 'system',
      content: `You are a professional investigative-news translator into ${lang.label} (${lang.bcp47}), in the neutral register of a quality newspaper. Keep structure, length and every fact exactly. Keep names, numbers, dates, document titles and quotes accurate, using the established local spelling. Never soften or sharpen a finding.${terminologyFor(locale)} Return JSON only with the same keys.`,
    },
    {
      role: 'user',
      content: `Translate into ${lang.label}. Keep the same number of sections and paragraphs. If a section has an "image" object, keep "url" and "credit" unchanged and translate only "caption".\n\n${JSON.stringify({ title: block.title, dek: block.dek, standfirst: block.standfirst, facts: block.facts, sections: block.sections, context: block.context, imageCaption: block.imageCaption || '' })}`,
    },
  ], { temperature: 0.2, maxTokens: 14000 });
  if (!Array.isArray(data.sections) || data.sections.length !== block.sections.length) throw new Error('translation lost sections');
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
    facts: Array.isArray(data.facts) && data.facts.length === block.facts.length ? data.facts.map(String) : block.facts,
    body: sections.flatMap((s) => s.paragraphs),
    sections,
    context: String(data.context || block.context || '').trim(),
    imageCaption: String(data.imageCaption || block.imageCaption || '').trim(),
  };
}

async function publish(d) {
  if (!d.draft) throw new Error('no draft to publish');
  const draft = d.draft;
  const pictures = await collectImages(d.sources, { max: 3 });
  const hero = pictures[0] || null;
  log(`PUBLISH  ${d.slug}: ${pictures.length} usable image(s)${hero ? ` — hero from ${hero.outlet || 'source'}` : ''}`);
  const sections = articleSections(draft, pictures);
  const body = sections.flatMap((s) => s.paragraphs);
  const wordCount = draftWords(draft);
  const usedIds = new Set((draft.claims || []).flatMap((c) => c.sources || []));
  const sources = d.sources
    .filter((s) => !usedIds.size || usedIds.has(s.id) || s.primary)
    .slice(0, 24)
    .map((s) => ({ outlet: s.outlet, title: s.title, url: s.url, publishedAt: s.publishedAt }));

  const doc = {
    slug: slugify(draft.title),
    category: d.category,
    form: 'investigation',
    image: hero?.url || null,
    imageCredit: hero?.credit || null,
    video: null,
    importance: 5,
    publishedAt: nowISO(),
    updatedAt: nowISO(),
    sourcePolicy: 'two-source',
    readingMinutes: Math.max(6, Math.round(wordCount / 215)),
    sources,
    locales: {
      [SOURCE_LOCALE]: {
        title: String(draft.title).trim(),
        dek: String(draft.dek).trim(),
        standfirst: String(draft.standfirst).trim(),
        facts: (draft.facts || []).map(String).slice(0, 8),
        body,
        sections,
        context: '',
        imageCaption: hero?.caption || '',
      },
    },
    history: [],
    meta: {
      desk: 'Investigativ',
      writer: d.review?.writer || null,
      editor: d.review?.editor || null,
      verdict: d.review?.verdict || null,
      words: wordCount,
      sources: sources.length,
      claims: draft.claims?.length || 0,
      investigation: d.slug,
      origin: d.origin,
    },
  };

  if (DRY_RUN) {
    log(`DRY     would publish "${doc.locales.en.title}" (${doc.readingMinutes} min, ${sources.length} sources)`);
    return;
  }

  saveArticle(doc);
  const index = loadIndex();
  if (!index.articles.some((a) => a.slug === doc.slug)) index.articles.unshift(toIndexEntry(doc));
  else index.articles = index.articles.map((a) => (a.slug === doc.slug ? toIndexEntry(doc) : a));
  saveIndex(index);

  const targets = TRANSLATE_LOCALES.filter((c) => c !== SOURCE_LOCALE);
  await pool(targets, TRANSLATE_CONCURRENCY, async (locale) => {
    try {
      const translated = await translateInvestigation(doc.locales[SOURCE_LOCALE], locale);
      doc.locales[locale] = translated;
      saveArticle(doc);
      index.articles = index.articles.map((a) => (a.slug === doc.slug ? toIndexEntry(doc) : a));
      return locale;
    } catch (err) {
      log(`PUBLISH  ${locale} translation failed: ${err.message}`);
      return null;
    }
  });
  saveIndex(index);

  const publishedAt = doc.publishedAt;
  d.published = { slug: doc.slug, at: publishedAt, translations: Object.keys(doc.locales).length };
  d.nextStep = 'published; monitor corrections and replies';
  note(d, 'published', `published as ${doc.slug} (${Object.keys(doc.locales).length} languages)`);
  await safe(() => setInvestigationStatus(d.slug, 'published', { published_at: publishedAt }));
  log(`PUBLISH ✓ ${doc.slug} — ${Object.keys(doc.locales).length} language(s)`);
}

// ─────────────────────────── mirror ───────────────────────────
async function mirror(d) {
  if (DRY_RUN) return;
  const rows = await outreachRows(d.slug);
  const pending = rows.filter((r) => ['draft', 'approved', 'requested'].includes(r.status)).length;
  const sent = rows.filter((r) => ['sent', 'replied'].includes(r.status)).length;
  await safe(() => upsertInvestigation({
    slug: d.slug,
    title: d.title,
    angle: d.angle,
    category: d.category,
    status: d.status,
    priority: d.priority ?? 2,
    origin: d.origin || 'desk',
    request_id: d.requestId || null,
    source_count: d.sources.length,
    verified_claims: d.claims.length,
    open_questions: (d.gaps || []).length,
    outreach_pending: pending,
    outreach_sent: sent,
    next_step: d.nextStep || null,
    published_at: d.published?.at || null,
  }));
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  const started = Date.now();
  // Last resort: a stalled request must never hold the job for its full timeout.
  const budgetMin = Number(process.env.INVESTIGATE_MINUTES || 55);
  setTimeout(() => {
    log(`WATCHDOG  ${budgetMin + 3} min reached — stopping without saving`);
    process.exit(0);
  }, (budgetMin + 3) * 60_000).unref();
  const indexAvailable = (() => { try { loadIndex(); return true; } catch (e) { log(`FATAL ${e.message}`); return false; } })();
  if (!indexAvailable) process.exit(1);

  fs.mkdirSync(DOSSIER_DIR, { recursive: true });
  const dossiers = loadDossiers();
  const state = loadState();

  // A retired dossier leaves the active set but stays in the admin desk; the
  // status is mirrored once so the UI does not keep it on the working list.
  for (const d of dossiers.filter((x) => x.status === 'archived' && x.mirroredStatus !== 'archived')) {
    if (DRY_RUN) break;
    await mirror(d);
    d.mirroredStatus = 'archived';
    saveDossier(d);
  }

  // Diagnostic mode: only the agent, nothing else, so a test run ends fast.
  if (process.env.INVESTIGATE_ONLY === 'agent') {
    // A forced intake still has to run first — with no active dossier there is
    // nothing for the agent to work on.
    if (!dossiers.some(isActive) && (process.env.INVESTIGATE_INTAKE === '1' || !state.lastIntake)) await intake(dossiers, state);
    const only = FORCE_SLUG ? dossiers.filter((d) => d.slug === FORCE_SLUG) : dossiers.filter(isActive).slice(0, 1);
    for (const d of only) {
      log(`\n▶ ${d.slug} [${d.status}] — agent only`);
      const ok = await researchAgent(d).catch((err) => { log(`AGENT  failed: ${err.message}`); return false; });
      log(`AGENT  ${ok ? 'added' : 'added nothing'} — ${d.sources.length} source(s), ${d.claims.length} claim(s), ${d.contacts.length} contact(s)`);
      saveDossier(d);
    }
    log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
    return;
  }

  await intake(dossiers, state);

  const targets = FORCE_SLUG ? dossiers.filter((d) => d.slug === FORCE_SLUG) : dossiers.filter(isActive);
  log(`DESK  ${targets.length} dossier(s) to advance`);

  for (const d of targets) {
    if (deadlineLeft() < 90000) {
      log(`DESK  deadline close — stopping before ${d.slug}`);
      break;
    }
    try {
      log(`\n▶ ${d.slug} [${d.status}]`);
      if (d.status === 'approved') {
        await publish(d);
      } else if (d.status === 'review') {
        log('  waiting for human approval');
        d.nextStep = 'human approval in /admin/investigations';
      } else {
        // Mail first: a reply from an authority is evidence, and it can change
        // what the agent should look for next.
        await readInbox(d);
        if (['pitch', 'research'].includes(d.status) || d.sources.length < MIN_SOURCES || d.claims.length < MIN_CLAIMS) {
          await research(d);
        }
        log(`CHECK   ${d.claims.length} claim(s), ${d.sources.length} source(s) before reading back`);
        await factcheck(d);
        await queueOutreach(d);
        await draftOutreach(d);
        await sendApproved(d);
        const fresh = await outreachRows(d.slug);
        await maybeWrite(d, fresh);
      }
      await mirror(d);
    } catch (err) {
      log(`✗ ${d.slug}: ${err.message}`);
    } finally {
      saveDossier(d);
    }
  }

  state.runs = [{ at: nowISO(), active: targets.length, ms: Date.now() - started }, ...(state.runs || [])].slice(0, 100);
  saveState(state);
  log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`);
}

// Keep-alive sockets from fetch, rss-parser and pdf.js hold the event loop
// open long after the work is done — a finished run once sat 20 minutes in CI
// on that alone. Everything is on disk by now, so the process can go.
function finish(code = 0) {
  process.stdout.write('', () => process.exit(code));
}

main().then(() => finish(0)).catch((err) => {
  console.error(err);
  finish(1);
});
